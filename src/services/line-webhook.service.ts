// จัดการ webhook event หนึ่งตัวตั้งแต่ต้นจนจบ: กรองชนิด event → แสดง loading → ถาม AI → ตอบกลับ LINE

// ดึงฟังก์ชันอ่านค่าตั้งค่าต่าง ๆ จาก env
import { getBotInstructions, getLineConfig, getQwenConfig } from "@/config/runtime-config";
// ดึงฟังก์ชันอ่านเอกสารที่แปลงจาก PDF
import { getKnowledgeText } from "@/config/knowledge";
// ดึง provider ของ Qwen
import { QwenAnswerProvider } from "@/lib/ai/qwen-answer-provider";
// ดึงฟังก์ชันเรียก LINE API
import { getLineImageContent, replyToLine, startLineLoadingIndicator } from "@/lib/line/client";
// ดึง type ของผลลัพธ์คำตอบ
import type { AnswerResult } from "@/lib/ai/answer-provider";
// ดึง type ของ webhook event
import type { LineWebhookEvent } from "@/types/line";
// ดึง service ที่ประกอบ prompt
import { AnswerService } from "@/services/answer.service";

// ข้อความสำรองที่จะส่งเมื่อเกิด error ใด ๆ เพื่อไม่ให้ผู้ใช้รอเงียบ ๆ
const FALLBACK_REPLY = "ขออภัยค่ะ ตอนนี้น้องมีนาตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่นะคะ";

// ฟังก์ชันหลักที่ route.ts เรียกกับ event ทีละตัว
export async function handleLineEvent(event: LineWebhookEvent): Promise<void> {
  // ดึงข้อมูลข้อความออกมา (อาจเป็น undefined ถ้า event ไม่ใช่ข้อความ เช่น follow หรือ unfollow)
  const message = event.message;
  // เป็นข้อความตัวอักษรที่ไม่ว่างหรือไม่
  const isTextMessage = message?.type === "text" && Boolean(message.text?.trim());
  // เป็นรูปภาพที่มี id ให้ดาวน์โหลดหรือไม่
  const isImageMessage = message?.type === "image" && Boolean(message.id);
  // ข้าม event ที่ไม่ใช่ข้อความ ไม่มี reply token หรือไม่ใช่ข้อความหรือรูป (เช่น sticker หรือ location)
  if (event.type !== "message" || !event.replyToken || (!isTextMessage && !isImageMessage)) return;

  // อ่าน Channel ID และ secret สำหรับเรียก LINE API
  const line = getLineConfig();
  // ตั้งคำตอบเริ่มต้นเป็นข้อความสำรอง ถ้าสร้างคำตอบสำเร็จจะถูกแทนที่
  let reply = FALLBACK_REPLY;

  // LINE รองรับ loading animation เฉพาะแชทหนึ่งต่อหนึ่งกับ Official Account (ไม่รองรับกลุ่ม)
  if (event.source?.type === "user" && event.source.userId) {
    // ห่อด้วย try เพราะเป็นแค่ส่วนตกแต่ง
    try {
      // แสดงสถานะกำลังพิมพ์ 60 วินาที (จะหายเองทันทีเมื่อบอทตอบ)
      await startLineLoadingIndicator({ ...line, chatId: event.source.userId, loadingSeconds: 60 });
    } catch (error) {
      // ส่วนตกแต่งนี้ต้องไม่ทำให้การตอบจริงล้มเหลว จึงแค่ log แล้วทำงานต่อ
      console.error("Unable to show LINE loading indicator", error instanceof Error ? error.message : "unknown error");
    }
  }

  // ส่วนที่อาจ error (เรียก AI หรือดาวน์โหลดรูป) ห่อไว้ทั้งหมด
  try {
    // สร้าง provider ของ Qwen จากค่าตั้งค่า
    const provider = new QwenAnswerProvider(getQwenConfig());
    // สร้าง service โดยส่ง provider ข้อมูลองค์กร และเอกสารจาก PDF เข้าไป
    const answers = new AnswerService(provider, getBotInstructions(), await getKnowledgeText());
    // เลือกวิธีถามตามชนิดข้อความ
    const answer = isImageMessage
      // ถ้าเป็นรูป: ใช้คำสั่งสำเร็จรูปให้ AI อธิบายภาพ แล้วแนบรูปที่ดาวน์โหลดมา
      ? await answers.createAnswer({
          // ข้อความที่ใช้แทนคำถามของผู้ใช้ เพราะรูปไม่มีข้อความมาด้วย
          userText: "ผู้ใช้ส่งรูปภาพมา กรุณาอธิบายสิ่งที่เห็น อ่านข้อความในภาพเมื่ออ่านได้ และตอบคำถามหรือช่วยเหลืออย่างเหมาะสมค่ะ",
          // ดาวน์โหลดรูปจาก LINE แล้วใช้ data URL (as string บอก TypeScript ว่ามั่นใจแล้วว่า id มีค่า)
          imageDataUrl: (await getLineImageContent({ ...line, messageId: message.id as string })).dataUrl,
        })
      // ถ้าเป็นข้อความ: ส่งข้อความผู้ใช้ไปถามตรง ๆ
      : await answers.createAnswer({ userText: message.text as string });
    // จัดรูปแบบคำตอบ (ต่อท้ายด้วยแหล่งอ้างอิง) แล้วแทนที่ข้อความสำรอง
    reply = formatLineAnswer(answer);
  } catch (error) {
    // ห้าม log ข้อความผู้ใช้ token หรือ credential เพราะอาจมีข้อมูลส่วนตัว จึง log แค่ข้อความ error
    console.error("Unable to generate LINE bot answer", error instanceof Error ? error.message : "unknown error");
  }

  // ตอบกลับผู้ใช้ (ได้คำตอบจริงหรือข้อความสำรอง อย่างใดอย่างหนึ่ง)
  await replyToLine({ ...line, replyToken: event.replyToken, text: reply });
}

// แปลงคำตอบเป็นข้อความเดียวสำหรับส่งใน LINE
function formatLineAnswer(answer: AnswerResult): string {
  // ถ้ามีแหล่งอ้างอิงให้สร้างบล็อกรายการลิงก์ ถ้าไม่มีให้เป็น string ว่าง
  const sourceBlock = answer.sources.length
    // แต่ละแหล่งแสดงเป็น "ลำดับ. ชื่อ" แล้วตามด้วยลิงก์ในบรรทัดถัดไป
    ? `\n\nแหล่งข้อมูลจากการค้นหา:\n${answer.sources.map((source, index) => `${index + 1}. ${source.title}\n${source.url}`).join("\n")}`
    // ไม่มีแหล่งอ้างอิง
    : "";
  // ตัดคำตอบไม่ให้เกิน 3,200 ตัวอักษร เพื่อเหลือที่ให้ลิงก์ แล้วตัดข้อความรวมไม่ให้เกิน 4,500 ตัวอักษรอีกชั้น
  return `${answer.text.slice(0, 3_200)}${sourceBlock}`.slice(0, 4_500);
}
