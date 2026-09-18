type StatelessTokenResponse = {
  access_token?: string;
  error_description?: string;
};

type LineCredentials = {
  channelId: string;
  channelSecret: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * LINE stateless tokens are intentionally not persisted or cached. A new
 * 15-minute token is issued immediately before each Messaging API call.
 */
export async function issueStatelessLineAccessToken(credentials: LineCredentials): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.channelId,
    client_secret: credentials.channelSecret,
  });

  const response = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
    redirect: "error",
  });

  const body = (await response.json().catch(() => ({}))) as StatelessTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(`LINE stateless token request failed (${response.status}): ${body.error_description ?? "unknown error"}`);
  }

  return body.access_token;
}

export async function replyToLine(input: LineCredentials & { replyToken: string; text: string }): Promise<void> {
  const accessToken = await issueStatelessLineAccessToken(input);
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken: input.replyToken,
      messages: [{ type: "text", text: input.text.slice(0, 4_500) }],
      notificationDisabled: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`LINE reply failed with status ${response.status}`);
}

/** Shows LINE's native typing indicator in a one-to-one chat. */
export async function startLineLoadingIndicator(input: LineCredentials & { chatId: string; loadingSeconds: number }): Promise<void> {
  const accessToken = await issueStatelessLineAccessToken(input);
  const response = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chatId: input.chatId, loadingSeconds: input.loadingSeconds }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`LINE loading indicator failed with status ${response.status}`);
}

/** Downloads a LINE image only for the active request; callers must not persist it. */
export async function getLineImageContent(input: LineCredentials & { messageId: string }): Promise<{ dataUrl: string }> {
  const accessToken = await issueStatelessLineAccessToken(input);
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(input.messageId)}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`LINE image download failed with status ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) throw new Error("LINE returned an unsupported image type");

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) throw new Error("LINE image is larger than 5 MB");

  const image = Buffer.from(await response.arrayBuffer());
  if (image.byteLength > MAX_IMAGE_BYTES) throw new Error("LINE image is larger than 5 MB");

  return { dataUrl: `data:${contentType};base64,${image.toString("base64")}` };
}
