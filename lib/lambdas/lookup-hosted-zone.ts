import { CloudFormationCustomResourceCreateEvent, CloudFormationCustomResourceEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { getHostedZone } from "./utility";

AWS.config.update({
  maxRetries: 10,
  retryDelayOptions: {
    base: 100
  }
});

interface RequestProperties {
  readonly DomainName: string;
}

interface ResponseProperties {
  readonly PhysicalResourceId: string;
}

async function createEvent(event: CloudFormationCustomResourceCreateEvent): Promise<ResponseProperties> {
  const request = event.ResourceProperties as unknown as RequestProperties;
  // 1. Find hosted zone for domain
  const route53 = new AWS.Route53();
  const hostedZone = await getHostedZone(request.DomainName, route53);
  return {
    PhysicalResourceId: hostedZone.Id
  };
}

/**
 * Handler for get/create of ACM certificate
 *
 * @param {CloudFormationCustomResourceEvent} event - lambda custom resource event
 * @returns {Promise<ResponseProperties>} the response
 */
export async function handler(event: CloudFormationCustomResourceEvent): Promise<ResponseProperties> {
  console.log(`event: ${JSON.stringify(event)}`);
  // Create/Update can be treated the same
  if (event.RequestType === "Create") {
    const response = await createEvent(event);
    console.log(JSON.stringify(response));
    return response;
  } else {
    return {
      PhysicalResourceId: event.PhysicalResourceId
    };
  }
}
