import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceUpdateEvent
} from "aws-lambda";
import * as AWS from "aws-sdk";
import { AccessKey } from "aws-sdk/clients/iam";
import * as crypto from "crypto";

interface ResourceProperties {
  readonly UserName: string;
}

interface ResponseProperties {
  readonly PhysicalResourceId: string;
  readonly Data?: {
    readonly SmtpUserName: string;
    readonly SmtpUserPasswordSecretArn: string;
  };
}

function getResourceProperties(properties: { [key: string]: any }): ResourceProperties {
  if (!properties.UserName) {
    throw new Error("Must supply UserName for the IAM user to generate credentials for");
  }
  return {
    UserName: properties.UserName
  };
}

function getEventResourceProperties(event: CloudFormationCustomResourceEvent): ResourceProperties {
  return getResourceProperties(event.ResourceProperties);
}

async function createAccessKey(user: string): Promise<AccessKey> {
  const iam = new AWS.IAM();
  const response = await iam
    .createAccessKey({
      UserName: user
    })
    .promise();
  console.log(`Created access key for user: ${user}`);
  return response.AccessKey;
}

async function deleteAccessKey(user: string, accessKeyId: string): Promise<void> {
  const iam = new AWS.IAM();
  await iam
    .deleteAccessKey({
      UserName: user,
      AccessKeyId: accessKeyId
    })
    .promise();
}

function hmacSha256(data: crypto.BinaryLike, key: crypto.BinaryLike): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function convertToSmtpPassword(region: string, secretAccessKey: string): string {
  // https://docs.aws.amazon.com/ses/latest/DeveloperGuide/smtp-credentials.html
  const date = "11111111";
  const service = "ses";
  const terminal = "aws4_request";
  const message = "SendRawEmail";
  const version = 0x04;

  const kDate = hmacSha256(date, `AWS4${secretAccessKey}`);
  const kRegion = hmacSha256(region, kDate);
  const kService = hmacSha256(service, kRegion);
  const kTerminal = hmacSha256(terminal, kService);
  const kMessage = hmacSha256(message, kTerminal);
  return Buffer.concat([Buffer.from([version]), kMessage]).toString("base64");
}

async function storeSmtpPassword(user: string, smtpPassword: string): Promise<string> {
  const secretsManager = new AWS.SecretsManager();
  const response = await secretsManager
    .createSecret({
      Name: `${user}-smtp`,
      SecretString: smtpPassword
    })
    .promise();
  console.log(`Stored smtp password to: ${response.ARN}`);
  return response.ARN!;
}

async function deleteSmtpPasswordSecret(user: string): Promise<void> {
  const secretsManager = new AWS.SecretsManager();
  await secretsManager
    .deleteSecret({
      SecretId: `${user}-smtp`,
      ForceDeleteWithoutRecovery: true
    })
    .promise();
}

function getEventRegion(event: CloudFormationCustomResourceEvent): string {
  return event.StackId.split(":")[3];
}

async function onCreate(event: CloudFormationCustomResourceCreateEvent): Promise<ResponseProperties> {
  const properties = getEventResourceProperties(event);
  const accessKey = await createAccessKey(properties.UserName);
  return {
    PhysicalResourceId: `${properties.UserName}:${accessKey.AccessKeyId}`,
    Data: {
      SmtpUserName: accessKey.AccessKeyId,
      SmtpUserPasswordSecretArn: await storeSmtpPassword(
        properties.UserName,
        convertToSmtpPassword(getEventRegion(event), accessKey.SecretAccessKey)
      )
    }
  };
}

async function onUpdate(event: CloudFormationCustomResourceUpdateEvent): Promise<ResponseProperties> {
  const oldProperties = getResourceProperties(event.OldResourceProperties);
  const newProperties = getEventResourceProperties(event);
  if (oldProperties.UserName !== newProperties.UserName) {
    throw new Error("Update of UserName requires resource recreation");
  }
  return {
    PhysicalResourceId: event.PhysicalResourceId
  };
}

async function onDelete(event: CloudFormationCustomResourceDeleteEvent): Promise<ResponseProperties> {
  const physicalResourceId = event.PhysicalResourceId;
  const resourceIdParts = physicalResourceId.split(":");
  const userName = resourceIdParts[0];
  const accessKeyId = resourceIdParts[1];
  await deleteAccessKey(userName, accessKeyId);
  await deleteSmtpPasswordSecret(userName);
  return {
    PhysicalResourceId: physicalResourceId
  };
}

/**
 * Setups up an IAM User for SMTP email sending
 *
 * @param {CloudFormationCustomResourceEvent} event - the cloudformation event payload
 * @returns {Promise<ResponseProperties>} the response
 */
export async function handle(event: CloudFormationCustomResourceEvent): Promise<ResponseProperties> {
  console.log(event);
  let response: ResponseProperties;
  if (event.RequestType === "Create") {
    response = await onCreate(event);
  } else if (event.RequestType === "Update") {
    response = await onUpdate(event);
  } else if (event.RequestType === "Delete") {
    response = await onDelete(event);
  } else {
    throw new Error(`Invalid RequestType!`);
  }
  console.log(JSON.stringify(response));
  return response;
}
