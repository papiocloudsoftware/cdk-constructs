import { Effect, Policy, PolicyStatement, User } from "@aws-cdk/aws-iam";
import { Code, Runtime, SingletonFunction } from "@aws-cdk/aws-lambda";
import { ISecret, Secret } from "@aws-cdk/aws-secretsmanager";
import { Construct, CustomResource, Duration } from "@aws-cdk/core";
import { Provider } from "@aws-cdk/custom-resources";
import * as path from "path";

/**
 * Props required to create {SesSmtpUser}
 */
export interface SesSmtpUserProps {
  readonly userName: string;
  // TODO: Add specific domain
  // readonly emailDomain: string;
}

/**
 * SMTP User Account
 */
export class SesSmtpUser extends Construct {
  readonly smtpUserName: string;
  readonly smtpUserPassword: ISecret;

  constructor(scope: Construct, id: string, props: SesSmtpUserProps) {
    super(scope, id);

    const user = new User(this, "SmtpUser", {
      userName: props.userName
    });
    user.attachInlinePolicy(
      new Policy(this, "SmtpUserPolicy", {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["ses:SendEmail", "ses:SendRawEmail"],
            resources: ["*"]
          })
        ]
      })
    );

    const userSetupFunction = new SingletonFunction(this, "SetupSmtpUserHandler", {
      uuid: "papiocloud-smtp-user-setup",
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(path.resolve(__dirname, "..", "lambdas")),
      handler: "setup-ses-user.handle",
      timeout: Duration.minutes(15),
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "iam:CreateAccessKey",
            "iam:DeleteAccessKey",
            "secretsmanager:CreateSecret",
            "secretsmanager:DeleteSecret"
          ],
          resources: ["*"]
        })
      ]
    });

    const provider = new Provider(this, "Provider", {
      onEventHandler: userSetupFunction
    });

    // This custom resource will trigger the userSetupFunction lambda to generate smtp credentials
    const resource = new CustomResource(this, "SetupSesSmtpUser", {
      resourceType: "Custom::SetupSesSmtpUser",
      serviceToken: provider.serviceToken,
      properties: {
        UserName: user.userName
      }
    });

    this.smtpUserName = resource.getAttString("SmtpUserName");
    this.smtpUserPassword = Secret.fromSecretCompleteArn(
      this,
      "SmtpPassword",
      resource.getAttString("SmtpUserPasswordSecretArn")
    );
  }
}
