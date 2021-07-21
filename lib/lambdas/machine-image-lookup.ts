import { LookupMachineImageProps } from "@aws-cdk/aws-ec2";
import { CloudFormationCustomResourceEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { Filter } from "aws-sdk/clients/ec2";

interface RequestProperties {
  readonly LookupMachineImage: LookupMachineImageProps;
}

interface ResponseProperties {
  readonly PhysicalResourceId: string;
}

function descending<A>(valueOf: (x: A) => number) {
  return (a: A, b: A) => {
    return valueOf(b) - valueOf(a);
  };
}

async function createOrUpdateEvent(event: CloudFormationCustomResourceEvent): Promise<ResponseProperties> {
  const request = event.ResourceProperties as unknown as RequestProperties;
  const props = request.LookupMachineImage;

  const filters: Filter[] = [
    {
      Name: "name",
      Values: [props.name]
    }
  ];
  for (const filterKey in props.filters || {}) {
    filters.push({
      Name: filterKey,
      Values: props.filters![filterKey]
    });
  }

  const ec2 = new AWS.EC2();
  const response = await ec2
    .describeImages({
      Owners: props.owners,
      Filters: filters
    })
    .promise();

  const images = [...(response.Images || [])].filter((i) => i.ImageId !== undefined);

  if (images.length === 0) {
    throw new Error("No AMI found that matched the search criteria");
  }

  // Return the most recent one
  // Note: Date.parse() is not going to respect the timezone of the string,
  // but since we only care about the relative values that is okay.
  images.sort(descending((i) => Date.parse(i.CreationDate || "1970")));

  return {
    PhysicalResourceId: images[0].ImageId!
  };
}

/**
 * Handler for get/create of ACM certificate
 *
 * @param {CloudFormationCustomResourceEvent} event - the cloud formation event payload
 * @returns {Promise<ResponseProperties>} the response
 */
export async function handler(event: CloudFormationCustomResourceEvent): Promise<ResponseProperties> {
  console.log(`event: ${JSON.stringify(event)}`);
  // Create/Update can be treated the same
  if (event.RequestType === "Create" || event.RequestType === "Update") {
    return createOrUpdateEvent(event);
  } else {
    return {
      PhysicalResourceId: event.PhysicalResourceId
    };
  }
}
