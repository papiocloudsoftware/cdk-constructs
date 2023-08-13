import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";
import { Construct, CustomResource, Duration } from "@aws-cdk/core";
import { Provider } from "@aws-cdk/custom-resources";
import * as path from "path";

/**
 * Props required to create {SesDomainVerification}
 */
export interface SesDomainVerificationProps {
  readonly domain: string;
}

/**
 * Verifies an SES domain for sending emails
 */
export class SesDomainVerification extends Construct {
  constructor(scope: Construct, id: string, props: SesDomainVerificationProps) {
    super(scope, id);

    const runTaskFunction = new Function(this, "VerifySesDomainHandler", {
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(path.resolve(__dirname, "..", "lambdas")),
      handler: "verify-ses-domain.handle",
      timeout: Duration.minutes(15),
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "ses:GetIdentityVerificationAttributes",
            "ses:VerifyDomainIdentity",
            "route53:ListHostedZonesByName",
            "route53:ChangeResourceRecordSets"
          ],
          resources: ["*"]
        })
      ]
    });

    const provider = new Provider(this, "Provider", {
      onEventHandler: runTaskFunction
    });

    // This custom resource will trigger the runTaskFunction lambda to start the migrations container
    new CustomResource(this, "VerifySesDomain", {
      resourceType: "Custom::VerifySesDomain",
      serviceToken: provider.serviceToken,
      properties: {
        EmailDomain: props.domain
      }
    });
  }
}
