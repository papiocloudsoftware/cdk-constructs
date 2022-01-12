import { ICertificate } from "@aws-cdk/aws-certificatemanager";
import { Metric, MetricOptions } from "@aws-cdk/aws-cloudwatch";
import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Runtime, SingletonFunction } from "@aws-cdk/aws-lambda";
import { Construct, CustomResource, Duration, Stack } from "@aws-cdk/core";
import { RemovalPolicy } from "@aws-cdk/core/lib/removal-policy";
import { ResourceEnvironment } from "@aws-cdk/core/lib/resource";
import { Provider } from "@aws-cdk/custom-resources";
import * as path from "path";

import { singletonResource } from "../core";

/**
 * Props required to create {SharedCertificate}
 */
export interface SharedCertificateProps {
  readonly certificateDomain: string;
}

/**
 * Certificate construct meant for sharing certificates across apps that will first check for the
 * existence of one before creating it.
 */
export class SharedCertificate extends Construct implements ICertificate {
  private readonly certificate: CustomResource;

  constructor(scope: Construct, id: string, props: SharedCertificateProps) {
    super(scope, id);
    // Certificate should be a singleton on the stack
    this.certificate = singletonResource(
      this,
      `Certificate_${props.certificateDomain}`,
      (scope: Construct, resourceId: string) => {
        const certificateFunction = new SingletonFunction(this, "Function", {
          code: Code.fromAsset(path.resolve(__dirname, "..", "lambdas")),
          handler: "get-or-create-cert.handler",
          runtime: Runtime.NODEJS_12_X,
          timeout: Duration.minutes(10),
          uuid: "papio-get-or-create-cert-function",
          initialPolicy: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "acm:DeleteCertificate",
                "acm:DescribeCertificate",
                "acm:RequestCertificate",
                "acm:ListCertificates",
                "route53:ListHostedZonesByName",
                "route53:ChangeResourceRecordSets"
              ],
              resources: ["*"]
            })
          ]
        });

        const provider = new Provider(this, "Provider", {
          onEventHandler: certificateFunction
        });

        return new CustomResource(scope, resourceId, {
          resourceType: "Custom::GetOrCreateCertificate",
          serviceToken: provider.serviceToken,
          properties: { CertificateDomain: props.certificateDomain }
        });
      }
    );
  }

  get stack(): Stack {
    return this.certificate.stack;
  }

  get env(): ResourceEnvironment {
    return this.certificate.env;
  }

  get certificateArn(): string {
    return this.certificate.ref;
  }

  applyRemovalPolicy(policy: RemovalPolicy): void {
    this.certificate.applyRemovalPolicy(policy);
  }

  metricDaysToExpiry(props?: MetricOptions): Metric {
    throw Error("Unsupported operation");
  }
}
