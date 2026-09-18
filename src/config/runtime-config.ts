const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function httpsUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return url.toString().replace(/\/$/, "");
}

export function getLineConfig() {
  return {
    channelId: required("LINE_CHANNEL_ID"),
    channelSecret: required("LINE_CHANNEL_SECRET"),
  };
}

export function getQwenConfig() {
  return {
    apiKey: required("QWEN_API_KEY"),
    model: process.env.QWEN_MODEL?.trim() || "qwen3.8-flash",
    baseUrl: httpsUrl(process.env.QWEN_BASE_URL?.trim() || DEFAULT_QWEN_BASE_URL, "QWEN_BASE_URL"),
    webSearchEnabled: process.env.QWEN_ENABLE_WEB_SEARCH?.trim().toLowerCase() !== "false",
  };
}

export function getBotInstructions(): string {
  return process.env.BOT_INSTRUCTIONS?.trim() || "";
}
