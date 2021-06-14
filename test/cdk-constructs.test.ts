import { countResources, expect as expectCDK } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";

import * as CdkConstructs from "../lib/index";

/*
 * Example test
 */
test("SNS Topic Created", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  // WHEN
  new CdkConstructs.CdkConstructs(stack, "MyTestConstruct");
  // THEN
  expectCDK(stack).to(countResources("AWS::SNS::Topic", 0));
});
