import { CloudFormationCustomResourceCreateEvent, CloudFormationCustomResourceEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import {
  CertificateDetail,
  DescribeCertificateResponse,
  ListCertificatesResponse,
  ResourceRecord
} from "aws-sdk/clients/acm";
import { HostedZone } from "aws-sdk/clients/route53";
import * as crypto from "crypto";

import { getHostedZone } from "./utility";

AWS.config.update({
  maxRetries: 10,
  retryDelayOptions: {
    base: 100
  }
});

interface RequestProperties {
  readonly CertificateDomain: string;
}

interface ResponseProperties {
  readonly PhysicalResourceId: string;
}

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function changeCertificateResourceRecord(
  action: "UPSERT" | "DELETE",
  certificate: CertificateDetail,
  route53 = new AWS.Route53(),
  hostedZone?: HostedZone
) {
  const domainValidationList = certificate.DomainValidationOptions;
  if (!domainValidationList || domainValidationList.length === 0) {
    throw new Error(`Certificate does not have domain validation options: ${domainValidationList}`);
  }

  if (!hostedZone) {
    hostedZone = await getHostedZone(certificate.DomainName as string, route53);
  }

  // Expect a single record (until this supports Subject Alternative Names)
  const resourceRecord = domainValidationList[0].ResourceRecord as ResourceRecord;
  await route53
    .changeResourceRecordSets({
      HostedZoneId: hostedZone.Id,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name: resourceRecord.Name,
              Type: resourceRecord.Type,
              ResourceRecords: [{ Value: resourceRecord.Value }],
              TTL: 300
            }
          }
        ]
      }
    })
    .promise();
}

async function createEvent(event: CloudFormationCustomResourceCreateEvent): Promise<ResponseProperties> {
  const request = event.ResourceProperties as unknown as RequestProperties;
  // 1. Find hosted zone for domain
  const route53 = new AWS.Route53();
  const hostedZone = await getHostedZone(request.CertificateDomain, route53);

  // 2. Look for certificate for domain provided
  const acm = new AWS.ACM();
  let nextToken: string | undefined = undefined;
  const matchingCertPromises: Promise<DescribeCertificateResponse>[] = [];
  do {
    const listResponse: ListCertificatesResponse = await acm.listCertificates({ NextToken: nextToken }).promise();
    const certificates = (listResponse.CertificateSummaryList || [])
      .filter((certificate) => {
        return certificate.DomainName === request.CertificateDomain && certificate.CertificateArn;
      })
      .map((certificate) =>
        acm.describeCertificate({ CertificateArn: certificate.CertificateArn as string }).promise()
      );
    matchingCertPromises.push(...certificates);
    nextToken = listResponse.NextToken;
  } while (nextToken);

  let certificateArn = undefined as unknown as string;
  const matchingCertificates = (await Promise.all(matchingCertPromises)).filter((certificate) => {
    return certificate.Certificate && certificate.Certificate.Status === "ISSUED";
  });
  if (matchingCertificates.length > 0) {
    console.log(`Found ${matchingCertificates.length} matching certificates!`);
    console.log(JSON.stringify(matchingCertificates));
    matchingCertificates.sort((a, b) => {
      // Want the latest one
      return (b.Certificate?.NotAfter?.getTime() as number) - (a.Certificate?.NotAfter?.getTime() as number);
    });
    certificateArn = matchingCertificates[0].Certificate?.CertificateArn as string;
  }

  if (!certificateArn) {
    console.log("Did not find matching certificate! Creating one now!");
    // 3. Create certificate if it doesn't exist
    const requestResponse = await acm
      .requestCertificate({
        IdempotencyToken: crypto
          .createHash("sha256")
          .update(request.CertificateDomain)
          .digest()
          .toString("hex")
          .substring(0, 32),
        DomainName: request.CertificateDomain,
        ValidationMethod: "DNS"
      })
      .promise();
    if (!requestResponse.CertificateArn) {
      throw new Error("Certificate was not requested properly!");
    }
    certificateArn = requestResponse.CertificateArn;
    let foundDomainValidation = false;
    do {
      const describeResponse = await acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      if (!describeResponse.Certificate) {
        throw new Error("Unable to describe certificate after request");
      }
      foundDomainValidation =
        describeResponse.Certificate.DomainValidationOptions !== undefined &&
        describeResponse.Certificate.DomainValidationOptions.length > 0 &&
        describeResponse.Certificate.DomainValidationOptions[0].ResourceRecord !== undefined;

      if (foundDomainValidation) {
        // 4. Add DNS entry to the hosted zone
        await changeCertificateResourceRecord("UPSERT", describeResponse.Certificate, route53, hostedZone);
      } else {
        await sleep(10);
      }
    } while (!foundDomainValidation);

    // 5. Wait until certificate validated (wait indefinitely)
    let validated = false;
    while (!validated) {
      const response = await acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      if (!response.Certificate) {
        throw new Error(`Certificate with ${certificateArn} not found!`);
      } else if (response.Certificate.Status === "ISSUED") {
        validated = true;
      } else {
        await sleep(30);
      }
    }
  }

  // Return certificate arn
  return { PhysicalResourceId: certificateArn };
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
