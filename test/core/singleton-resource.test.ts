import { User } from "@aws-cdk/aws-iam";
import { App, Construct, Stack } from "@aws-cdk/core";

import { singletonResource } from "../../lib";

type MockFactoryMethod = (scope: Construct, id: string) => Construct;

describe("singletonResource", () => {
  let app: App;
  let stack: Stack;

  let factory: MockFactoryMethod;

  beforeEach(() => {
    jest.clearAllMocks();

    app = new App();
    stack = new Stack(app, "TestStack");
    factory = jest.fn((scope: Construct, id: string) => {
      return new User(scope, id);
    });
  });

  it("will throw an error if the stack can't be resolved for the scope", () => {
    expect(() => singletonResource(app, "TestId", factory)).toThrow(/no Stack found$/);
  });

  it("will call the factory method only when the resource is not found", () => {
    // Call twice
    singletonResource(stack, "TestId", factory);
    singletonResource(stack, "TestId", factory);
    // Factory method called once
    expect(factory).toHaveBeenCalledTimes(1);

    // One Users found on stack
    const users = stack.node.children.filter((child) => child instanceof User);
    expect(users.length).toEqual(1);
  });

  it("will call the factory method if a different uniqueId is passed in", () => {
    // Call twice
    singletonResource(stack, "TestId1", factory);
    singletonResource(stack, "TestId2", factory);
    // Factory method called once
    expect(factory).toHaveBeenCalledTimes(2);

    // Two Users found on stack
    const users = stack.node.children.filter((child) => child instanceof User);
    expect(users.length).toEqual(2);
  });
});
