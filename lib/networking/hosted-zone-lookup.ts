import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Runtime, SingletonFunction } from "@aws-cdk/aws-lambda";
import { IHostedZone, PublicHostedZone } from "@aws-cdk/aws-route53";
import { Construct, CustomResource, Duration, Stack } from "@aws-cdk/core";
import { RemovalPolicy } from "@aws-cdk/core/lib/removal-policy";
import { ResourceEnvironment } from "@aws-cdk/core/lib/resource";
import { Provider } from "@aws-cdk/custom-resources";
import * as path from "path";

import { singletonResource } from "../core";

/**
 * Props to create a {HostedZoneLookup}
 */
export interface HostedZoneLookupProps {
  readonly domainName: string;
}

/**
 * Construct that looks up a hosted zone given a domain name
 */
export class HostedZoneLookup extends Construct implements IHostedZone {
  private readonly hostedZone: IHostedZone;

  constructor(scope: Construct, id: string, props: HostedZoneLookupProps) {
    super(scope, id);
    this.hostedZone = singletonResource(
      this,
      `${props.domainName.replace(".", "_")}`,
      (scope: Construct, resourceId: string) => {
        const certificateFunction = new SingletonFunction(this, "Function", {
          code: Code.fromAsset(path.resolve(__dirname, "..", "lambdas")),
          handler: "lookup-hosted-zone.handler",
          runtime: Runtime.NODEJS_12_X,
          timeout: Duration.minutes(10),
          uuid: "papio-lookup-hosted-zone-function",
          initialPolicy: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["route53:ListHostedZonesByName"],
              resources: ["*"]
            })
          ]
        });

        const provider = new Provider(this, "Provider", {
          onEventHandler: certificateFunction
        });

        const resource = new CustomResource(scope, resourceId, {
          resourceType: "Custom::LookupHostedZone",
          serviceToken: provider.serviceToken,
          properties: { DomainName: props.domainName }
        });

        return PublicHostedZone.fromHostedZoneAttributes(scope, `HostedZone_${resourceId}`, {
          hostedZoneId: resource.ref,
          zoneName: props.domainName
        });
      }
    );
  }

  get stack(): Stack {
    return this.hostedZone.stack;
  }

  get env(): ResourceEnvironment {
    return this.hostedZone.env;
  }

  get hostedZoneId(): string {
    return this.hostedZone.hostedZoneId;
  }

  get zoneName(): string {
    return this.hostedZone.zoneName;
  }

  get hostedZoneArn(): string {
    return this.hostedZone.hostedZoneArn;
  }

  get hostedZoneNameServers(): string[] | undefined {
    return this.hostedZone.hostedZoneNameServers;
  }

  applyRemovalPolicy(policy: RemovalPolicy): void {
    this.hostedZone.applyRemovalPolicy(policy);
  }
}
