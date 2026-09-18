import { getLineConfig } from "@/config/runtime-config";
import { isValidLineSignature } from "@/lib/security/line-signature";
import { handleLineEvent } from "@/services/line-webhook.service";
import type { LineWebhookPayload } from "@/types/line";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let channelSecret: string;
  try {
    channelSecret = getLineConfig().channelSecret;
  } catch (error) {
    console.error("LINE configuration error", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (!isValidLineSignature(rawBody, request.headers.get("x-line-signature"), channelSecret)) {
    return Response.json({ error: "Invalid LINE signature" }, { status: 401 });
  }

  let payload: LineWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LineWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload.events)) return Response.json({ error: "Invalid event payload" }, { status: 400 });

  const results = await Promise.allSettled(payload.events.map(handleLineEvent));
  for (const result of results) {
    if (result.status === "rejected") console.error("LINE event handling failed", result.reason);
  }

  return Response.json({ ok: true });
}
