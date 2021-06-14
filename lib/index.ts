import * as cdk from "@aws-cdk/core";

/**
 * Props required to create {CdkConstructs}
 */
export interface CdkConstructsProps {
  // Define construct properties here
}

/**
 * Placeholder cdk construct
 */
export class CdkConstructs extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CdkConstructsProps = {}) {
    super(scope, id);

    // Define construct contents here
  }
}
