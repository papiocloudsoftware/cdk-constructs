import {
  IMachineImage,
  LookupMachineImageProps,
  MachineImageConfig,
  OperatingSystemType,
  UserData
} from "@aws-cdk/aws-ec2";
import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Runtime, SingletonFunction } from "@aws-cdk/aws-lambda";
import { Construct, CustomResource, Duration } from "@aws-cdk/core";
import { Provider } from "@aws-cdk/custom-resources";
import * as crypto from "crypto";
import * as path from "path";

/**
 * Class for looking up a machine image at deploy time
 */
export class MachineImageLookup implements IMachineImage {
  readonly props: LookupMachineImageProps;

  constructor(props: LookupMachineImageProps) {
    this.props = props;
  }

  getImage(scope: Construct): MachineImageConfig {
    // Create a unique hash to avoid scope child id conflict, if same props should be same object
    const id = crypto.createHash("sha256").update(JSON.stringify(this.props)).digest("hex").substring(0, 6);

    const lookupFunction = new SingletonFunction(scope, `MachineImageLookupFunction_${id}`, {
      code: Code.fromAsset(path.resolve(__dirname, "..", "lambdas")),
      handler: "machine-image-lookup.handler",
      runtime: Runtime.NODEJS_12_X,
      timeout: Duration.minutes(10),
      uuid: "papio-machine-image-lookup-function",
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["ec2:DescribeImages"],
          resources: ["*"]
        })
      ]
    });

    const provider = new Provider(scope, `MachineImageLookupProvider_${id}`, { onEventHandler: lookupFunction });
    const resource = new CustomResource(scope, `MachineImageLookupResource_${id}`, {
      resourceType: "Custom::MachineImageLookup",
      serviceToken: provider.serviceToken,
      properties: { LookupMachineImage: this.props }
    });
    // TODO: Support windows?
    return {
      imageId: resource.ref,
      osType: OperatingSystemType.LINUX,
      userData: this.props.userData || UserData.forOperatingSystem(OperatingSystemType.LINUX)
    };
  }
}
