import * as AWS from "aws-sdk";
import { HostedZone } from "aws-sdk/clients/route53";

/**
 * Given the domain name, lookup the hosted zone in the account that owns it
 *
 * @param {string} domainName - the domain name to get the hosted zone for
 * @param {AWS.Route53} route53 - optional route53 client
 * @returns {HostedZone} the found zone, throws exception if not found
 */
export async function getHostedZone(domainName: string, route53 = new AWS.Route53()): Promise<HostedZone> {
  const domainParts = domainName.split(".");
  if (domainParts.length < 2) {
    throw new Error("Hosted zone domain must consist of at least two parts (example.com)");
  }
  let hostedZone: HostedZone | undefined = undefined;
  let startIdx = 0;
  while (!hostedZone && startIdx < domainParts.length - 1) {
    const zoneDomain = domainParts.slice(startIdx, domainParts.length).join(".");
    const hostedZones = await route53.listHostedZonesByName({ DNSName: zoneDomain }).promise();
    if (hostedZones.HostedZones && hostedZones.HostedZones.length > 0) {
      hostedZone = hostedZones.HostedZones[0];
    } else {
      startIdx += 1;
    }
  }
  if (!hostedZone) {
    throw new Error(`No hosted zone with domain: ${domainName}`);
  }
  return hostedZone;
}
