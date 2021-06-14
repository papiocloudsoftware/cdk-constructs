import { AaaaRecord, AaaaRecordProps, ARecord, ARecordProps } from "@aws-cdk/aws-route53";
import { Construct } from "@aws-cdk/core";

/**
 * Construct that creates IPv4 and IPv6 records for a given alias target
 */
export class AliasRecord extends Construct {
  constructor(scope: Construct, id: string, props: ARecordProps & AaaaRecordProps) {
    super(scope, id);

    new AaaaRecord(this, "IPv6", props);
    new ARecord(this, "IPv4", props);
  }
}
