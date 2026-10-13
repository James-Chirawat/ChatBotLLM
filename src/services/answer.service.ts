// ชั้น service ที่ประกอบ prompt แล้วส่งให้ AI โดยไม่ผูกกับ AI เจ้าใดเจ้าหนึ่ง (ใช้ผ่าน interface AnswerProvider)
// ถ้าจะเพิ่มความจำแชท ให้ส่งประวัติการคุยสั้น ๆ เข้ามาที่ชั้นนี้

// ดึง system prompt ที่กำหนดบุคลิกของบอท
import { DEFAULT_BOT_PERSONA } from "@/config/bot-persona";
// ดึง type ของ provider และของผลลัพธ์
import type { AnswerProvider, AnswerResult } from "@/lib/ai/answer-provider";

// คลาสสำหรับสร้างคำตอบ
export class AnswerService {
  // รับ provider และคำสั่งเพิ่มเติมจากภายนอก (dependency injection) ทำให้เปลี่ยน AI หรือใส่ตัวปลอมตอนเขียน test ได้ง่าย
  constructor(
    // AI ที่จะใช้ตอบ เช่น QwenAnswerProvider
    private readonly provider: AnswerProvider,
    // ข้อมูลองค์กรจาก BOT_INSTRUCTIONS (อาจเป็น string ว่าง)
    private readonly additionalInstructions: string,
  ) {}

  // สร้างคำตอบจากข้อความ (และรูป ถ้ามี) ของผู้ใช้
  async createAnswer(input: { userText: string; imageDataUrl?: string }): Promise<AnswerResult> {
    // ตัดช่องว่างหัวท้าย แล้วจำกัดไม่เกิน 4,000 ตัวอักษร เพื่อคุมค่าใช้จ่ายและกันข้อความยาวผิดปกติ
    const normalizedText = input.userText.trim().slice(0, 4_000);
    // ถ้าข้อความว่าง ให้ตอบขอข้อมูลเพิ่มเลย โดยไม่ต้องเรียก AI
    if (!normalizedText) return { text: "รบกวนพิมพ์คำถามเพิ่มอีกนิดนะคะ น้องมีนายินดีช่วยค่ะ", sources: [] };

    // ต่อ persona กับข้อมูลองค์กร filter(Boolean) ตัดค่าว่างทิ้ง จึงจะไม่มีหัวข้อ "ข้อมูลเพิ่มเติม" ถ้าไม่ได้ตั้ง BOT_INSTRUCTIONS
    const systemPrompt = [DEFAULT_BOT_PERSONA, this.additionalInstructions].filter(Boolean).join("\n\nข้อมูลเพิ่มเติมขององค์กร:\n");
    // ส่งต่อให้ provider ตอบ
    return this.provider.answer({ systemPrompt, userText: normalizedText, imageDataUrl: input.imageDataUrl });
  }
}
