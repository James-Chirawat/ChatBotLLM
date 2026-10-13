// AnswerProvider สำหรับ Qwen: เรียก Qwen Responses API แล้วแปลงผลลัพธ์ให้อยู่ในรูปแบบกลางของโปรเจค

// ดึง type กลางที่ provider ทุกตัวต้องใช้ร่วมกัน
import type { AnswerProvider, AnswerResult, AnswerSource } from "@/lib/ai/answer-provider";

// อธิบายรูปร่าง JSON ที่ Qwen ตอบกลับมา (เขียนเฉพาะฟิลด์ที่เราใช้ ทุกฟิลด์มี ? เพราะไม่รับประกันว่าจะมีเสมอ)
type QwenResponse = {
  // สถานะของคำตอบ เช่น "completed" หรือ "incomplete"
  status?: string;
  // ข้อความคำตอบที่ Qwen รวมไว้ให้แล้ว (บางครั้งไม่มี)
  output_text?: string;
  // รายการผลลัพธ์ทีละชิ้น เช่น reasoning, การเรียก tool, ข้อความตอบ
  output?: Array<{
    // ชนิดของชิ้นผลลัพธ์ เช่น "message" หรือ "reasoning"
    type?: string;
    // บทบาทของผู้พูด เช่น "assistant"
    role?: string;
    // เนื้อหาย่อยภายในชิ้นผลลัพธ์
    content?: Array<{
      // ชนิดของเนื้อหา เช่น "output_text"
      type?: string;
      // ข้อความ
      text?: string;
      // ข้อมูลประกอบข้อความ เช่น ลิงก์อ้างอิงจากการค้นเว็บ (url_citation)
      annotations?: Array<{ type?: string; title?: string; url?: string }>;
    // ปิด type ของ content
    }>;
  // ปิด type ของ output
  }>;
  // ข้อมูล error เมื่อเรียก API ไม่สำเร็จ
  error?: { message?: string };
};

// คลาสที่ทำตามสัญญา AnswerProvider
export class QwenAnswerProvider implements AnswerProvider {
  // constructor รับค่าตั้งค่า แล้ว "private readonly" จะสร้าง this.config ให้อัตโนมัติ (ใช้ได้เฉพาะในคลาสและแก้ไขไม่ได้)
  constructor(
    // ค่าที่ได้จาก getQwenConfig()
    private readonly config: { apiKey: string; model: string; baseUrl: string; webSearchEnabled: boolean },
  ) {}

  // เมธอดหลัก: ส่งคำถามไปให้ Qwen แล้วคืนคำตอบ
  async answer({ systemPrompt, userText, imageDataUrl }: { systemPrompt: string; userText: string; imageDataUrl?: string }): Promise<AnswerResult> {
    // AbortController ใช้สั่งยกเลิก fetch กลางทางได้
    const controller = new AbortController();
    // ตั้งเวลา 35 วินาที ถ้า Qwen ยังไม่ตอบให้ยกเลิก เพราะ reply token ของ LINE มีอายุจำกัด
    const timeout = setTimeout(() => controller.abort(), 35_000);

    // ใช้ try/finally เพื่อให้ล้าง timer เสมอ ไม่ว่าจะสำเร็จหรือ error
    try {
      // สร้างเนื้อหาของข้อความผู้ใช้ เริ่มจากข้อความก่อน
      const userContent = [
        // ส่วนที่เป็นข้อความ
        { type: "input_text", text: userText },
        // ถ้ามีรูปให้เพิ่มเข้าไปด้วย ถ้าไม่มีให้กระจาย array ว่าง (...[] คือไม่เพิ่มอะไร)
        ...(imageDataUrl ? [{ type: "input_image", image_url: imageDataUrl }] : []),
      ];
      // เรียก endpoint /responses ของ Qwen ด้วย HTTP POST
      const response = await fetch(`${this.config.baseUrl}/responses`, {
        // ส่งข้อมูลไปสร้างคำตอบ จึงใช้ POST
        method: "POST",
        // HTTP headers
        headers: {
          // ยืนยันตัวตนด้วย API key แบบ Bearer token
          Authorization: `Bearer ${this.config.apiKey}`,
          // บอกว่า body เป็น JSON
          "Content-Type": "application/json",
        },
        // แปลง object เป็นข้อความ JSON
        body: JSON.stringify({
          // ชื่อโมเดลที่จะใช้
          model: this.config.model,
          // ข้อความที่ส่งให้โมเดล เรียงตามลำดับบทสนทนา
          input: [
            // system prompt กำหนดบุคลิกและกฎ (โมเดลให้น้ำหนักมากกว่าข้อความผู้ใช้)
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            // ข้อความ (และรูป) จากผู้ใช้
            { role: "user", content: userContent },
          ],
          // ถ้าเปิด web search ให้แนบ tool ค้นเว็บและอ่านหน้าเว็บ แล้วโมเดลจะตัดสินใจเองว่าจะใช้หรือไม่
          ...(this.config.webSearchEnabled ? { tools: [{ type: "web_search" }, { type: "web_extractor" }] } : {}),
          // Qwen3.8 คิด (reasoning) ระดับ xhigh เป็นค่าเริ่มต้น ตั้งเป็น low เพื่อให้ตอบใน LINE ได้เร็ว
          // และเหลือ token ใน max_output_tokens พอสำหรับคำตอบที่ผู้ใช้จะเห็น
          reasoning: { effort: "low" },
          // จำกัดความยาวคำตอบ (รวม reasoning) เพื่อคุมเวลาและค่าใช้จ่าย
          max_output_tokens: 1_600,
        }),
        // ผูกกับ AbortController เพื่อให้ timeout ยกเลิก request ได้
        signal: controller.signal,
        // ไม่ให้ Next.js cache ผลลัพธ์ เพราะทุกคำถามต้องได้คำตอบใหม่
        cache: "no-store",
        // ไม่ยอมให้ redirect เพื่อกันไม่ให้ API key ถูกส่งต่อไปที่ปลายทางอื่น
        redirect: "error",
      });

      // อ่าน body เป็น JSON ถ้าอ่านไม่ได้ (เช่นได้ HTML กลับมา) ให้ใช้ object ว่างแทนการ throw
      const body = (await response.json().catch(() => ({}))) as QwenResponse;
      // ถ้า HTTP status ไม่ใช่ 2xx ให้ throw error พร้อมรหัสและข้อความจาก Qwen
      if (!response.ok) throw new Error(`Qwen request failed (${response.status}): ${body.error?.message ?? "unknown error"}`);

      // ใช้ output_text ก่อน ถ้าไม่มีให้ประกอบคำตอบเองจากรายการ output
      const answer = body.output_text?.trim() || body.output
        // เลือกเฉพาะชิ้นที่เป็นข้อความตอบของ assistant (ข้าม reasoning และการเรียก tool)
        ?.filter((item) => item.type === "message" || item.role === "assistant")
        // รวม content ของทุกชิ้นเป็น array เดียว
        .flatMap((item) => item.content ?? [])
        // ดึงเฉพาะข้อความ
        .map((part) => part.text ?? "")
        // ต่อข้อความทั้งหมดเข้าด้วยกัน
        .join("")
        // ตัดช่องว่างหัวท้าย
        .trim();
      // ถ้าสุดท้ายไม่มีข้อความเลย (เช่นใช้ token หมดไปกับ reasoning)
      if (!answer) {
        // รวบรวมชนิดของ output ทั้งหมดเพื่อใช้ debug เช่น "reasoning,web_search_call"
        const outputTypes = body.output?.map((item) => item.type ?? "unknown").join(",") || "none";
        // throw error ที่บอกสาเหตุ ไม่แกล้งทำเป็นว่ามีคำตอบ
        throw new Error(`Qwen returned no text answer (status=${body.status ?? "unknown"}, output=${outputTypes})`);
      }
      // คืนคำตอบพร้อมแหล่งอ้างอิงที่กรองแล้ว
      return { text: answer, sources: extractSources(body) };
    } finally {
      // ยกเลิก timer เสมอ ไม่ให้ค้างอยู่ในหน่วยความจำ
      clearTimeout(timeout);
    }
  }
}

// ดึงลิงก์อ้างอิงที่ปลอดภัยจากคำตอบ โดยไม่ซ้ำและไม่เกิน 3 ลิงก์
function extractSources(response: QwenResponse): AnswerSource[] {
  // เริ่มจากรายการ output ทั้งหมด
  const sources = response.output
    // รวม content ของทุกชิ้นเป็น array เดียว
    ?.flatMap((item) => item.content ?? [])
    // รวม annotations ของทุก content เป็น array เดียว
    .flatMap((part) => part.annotations ?? [])
    // เก็บเฉพาะ url_citation ที่ URL เป็น http(s) เพื่อตัดลิงก์อันตรายอย่าง javascript: ทิ้ง
    .filter((annotation) => annotation.type === "url_citation" && isSafeHttpUrl(annotation.url))
    // แปลงเป็น AnswerSource ถ้าไม่มีชื่อให้ใช้คำว่า "แหล่งข้อมูล" (?? [] ใช้ array ว่างกรณีไม่มี output เลย)
    .map((annotation) => ({ title: annotation.title?.trim() || "แหล่งข้อมูล", url: annotation.url as string })) ?? [];

  // ใช้ Map ที่มี key เป็น url เพื่อตัดลิงก์ซ้ำ แล้วแปลงกลับเป็น array และเก็บแค่ 3 รายการแรก
  return Array.from(new Map(sources.map((source) => [source.url, source])).values()).slice(0, 3);
}

// ตรวจว่าข้อความเป็น URL ที่ใช้ protocol http หรือ https เท่านั้น
function isSafeHttpUrl(value: string | undefined): boolean {
  // ไม่มีค่า ถือว่าไม่ปลอดภัย
  if (!value) return false;
  // ลองแปลงเป็น URL
  try {
    // แปลงข้อความเป็น URL object (จะ throw ถ้ารูปแบบผิด)
    const url = new URL(value);
    // ยอมรับเฉพาะ https: และ http:
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    // รูปแบบ URL ไม่ถูกต้อง
    return false;
  }
}
