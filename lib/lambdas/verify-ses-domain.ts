import { CloudFormationCustomResourceEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { getHostedZone } from "./utility";

AWS.config.update({
  maxRetries: 10,
  retryDelayOptions: {
    base: 1000
  }
});

interface ResourceProperties {
  readonly EmailDomain: string;
}

interface ResponseProperties {
  readonly PhysicalResourceId: string;
}

async function sleep(millis: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
}

async function isVerifiedIdentity(ses: AWS.SES, identity: string): Promise<boolean> {
  const verificationAttrs = await ses.getIdentityVerificationAttributes({ Identities: [identity] }).promise();
  return verificationAttrs.VerificationAttributes[identity]?.VerificationStatus === "Success";
}

async function verifyIdentity(props: ResourceProperties) {
  const ses = new AWS.SES();
  let verified = await isVerifiedIdentity(ses, props.EmailDomain);
  if (!verified) {
    const route53 = new AWS.Route53();
    // Lookup hosted zone
    const hostedZone = await getHostedZone(props.EmailDomain, route53);
    // Verify domain
    const response = await ses
      .verifyDomainIdentity({
        Domain: props.EmailDomain
      })
      .promise();

    // UPSERT (update/insert) Domain Verification Token
    await route53
      .changeResourceRecordSets({
        HostedZoneId: hostedZone.Id,
        ChangeBatch: {
          Changes: [
            {
              Action: "UPSERT",
              ResourceRecordSet: {
                Type: "TXT",
                Name: props.EmailDomain,
                TTL: 600,
                ResourceRecords: [{ Value: `"${response.VerificationToken}"` }]
              }
            }
          ]
        }
      })
      .promise();

    // Wait until SES has verified the identity
    do {
      await sleep(30 * 1000);
      verified = await isVerifiedIdentity(ses, props.EmailDomain);
    } while (!verified);
  }
}

/**
 * Verifies the SES domain
 *
 * @param {CloudFormationCustomResourceEvent} event - the cloudformation event payload
 * @returns {Promise<ResponseProperties>} the physical resource id
 */
export async function handle(event: CloudFormationCustomResourceEvent): Promise<ResponseProperties> {
  if (event.RequestType === "Create" || event.RequestType === "Update") {
    const props = event.ResourceProperties as unknown as ResourceProperties;
    await verifyIdentity(props);
    return { PhysicalResourceId: props.EmailDomain };
  } else {
    // TODO: Delete identity
    return { PhysicalResourceId: event.PhysicalResourceId };
  }
}
