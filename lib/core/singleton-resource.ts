import { Construct, IConstruct, Stack, Token } from "@aws-cdk/core";
import * as crypto from "crypto";

/**
 * Creates a resource only if the resource was not already found on the stack
 *
 * @template {Construct} T - The Construct Type
 * @param {Construct} scope - the scope for the resource
 * @param {string} uniqueId - the uniqueId for the resource
 * @param {() => T} factoryMethod - method to use to create if resource not found
 * @returns {T} created construct or singleton instance
 */
export function singletonResource<T extends IConstruct>(
  scope: Construct,
  uniqueId: string,
  factoryMethod: (scope: Construct, id: string) => T
): T {
  const stack = Stack.of(scope);
  let resourceId: string;
  if (Token.isUnresolved(uniqueId)) {
    resourceId = crypto.createHash("sha256").update(uniqueId).digest().toString("hex").substr(0, 8);
  } else {
    resourceId = uniqueId.replace(/[.*]/, "_");
  }
  resourceId = `Singleton_${resourceId}`;

  let construct: T | undefined = stack.node.tryFindChild(resourceId) as T;
  if (!construct) {
    construct = factoryMethod(stack, resourceId);
  }
  return construct;
}
