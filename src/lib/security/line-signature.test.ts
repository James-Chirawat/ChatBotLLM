import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidLineSignature } from "./line-signature";

describe("isValidLineSignature", () => {
  const secret = "channel-secret";
  const rawBody = '{"events":[]}';
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  it("accepts a valid signature for the untouched raw body", () => {
    expect(isValidLineSignature(rawBody, signature, secret)).toBe(true);
  });

  it("rejects a changed body or signature", () => {
    expect(isValidLineSignature(`${rawBody} `, signature, secret)).toBe(false);
    expect(isValidLineSignature(rawBody, "not-a-signature", secret)).toBe(false);
  });
});
