import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies the exact raw body supplied by LINE before JSON parsing. */
export function isValidLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", channelSecret).update(rawBody, "utf8").digest("base64");
  const expectedBytes = Buffer.from(expected, "utf8");
  const signatureBytes = Buffer.from(signature, "utf8");

  return expectedBytes.length === signatureBytes.length && timingSafeEqual(expectedBytes, signatureBytes);
}
