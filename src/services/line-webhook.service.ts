import { getBotInstructions, getLineConfig, getQwenConfig } from "@/config/runtime-config";
import { QwenAnswerProvider } from "@/lib/ai/qwen-answer-provider";
import { getLineImageContent, replyToLine, startLineLoadingIndicator } from "@/lib/line/client";
import type { AnswerResult } from "@/lib/ai/answer-provider";
import type { LineWebhookEvent } from "@/types/line";
import { AnswerService } from "@/services/answer.service";

const FALLBACK_REPLY = "ขออภัยค่ะ ตอนนี้น้องมีนาตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่นะคะ";

export async function handleLineEvent(event: LineWebhookEvent): Promise<void> {
  const message = event.message;
  const isTextMessage = message?.type === "text" && Boolean(message.text?.trim());
  const isImageMessage = message?.type === "image" && Boolean(message.id);
  if (event.type !== "message" || !event.replyToken || (!isTextMessage && !isImageMessage)) return;

  const line = getLineConfig();
  let reply = FALLBACK_REPLY;

  // LINE only supports this animation in a one-to-one Official Account chat.
  if (event.source?.type === "user" && event.source.userId) {
    try {
      await startLineLoadingIndicator({ ...line, chatId: event.source.userId, loadingSeconds: 60 });
    } catch (error) {
      // This visual enhancement must never prevent the actual reply.
      console.error("Unable to show LINE loading indicator", error instanceof Error ? error.message : "unknown error");
    }
  }

  try {
    const provider = new QwenAnswerProvider(getQwenConfig());
    const answers = new AnswerService(provider, getBotInstructions());
    const answer = isImageMessage
      ? await answers.createAnswer({
          userText: "ผู้ใช้ส่งรูปภาพมา กรุณาอธิบายสิ่งที่เห็น อ่านข้อความในภาพเมื่ออ่านได้ และตอบคำถามหรือช่วยเหลืออย่างเหมาะสมค่ะ",
          imageDataUrl: (await getLineImageContent({ ...line, messageId: message.id as string })).dataUrl,
        })
      : await answers.createAnswer({ userText: message.text as string });
    reply = formatLineAnswer(answer);
  } catch (error) {
    // Do not log request text, tokens, or credentials: they can contain user data.
    console.error("Unable to generate LINE bot answer", error instanceof Error ? error.message : "unknown error");
  }

  await replyToLine({ ...line, replyToken: event.replyToken, text: reply });
}

function formatLineAnswer(answer: AnswerResult): string {
  const sourceBlock = answer.sources.length
    ? `\n\nแหล่งข้อมูลจากการค้นหา:\n${answer.sources.map((source, index) => `${index + 1}. ${source.title}\n${source.url}`).join("\n")}`
    : "";
  return `${answer.text.slice(0, 3_200)}${sourceBlock}`.slice(0, 4_500);
}
