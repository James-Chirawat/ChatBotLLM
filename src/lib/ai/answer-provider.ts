// "สัญญา" (interface) กลางสำหรับ AI ทุกเจ้า ถ้าต้องการเปลี่ยนไปใช้ OpenAI, Gemini หรือ Claude
// ให้สร้างคลาสใหม่ที่ implements AnswerProvider โดยไม่ต้องแก้ service หรือ webhook

// แหล่งอ้างอิงหนึ่งรายการที่ได้จากการค้นเว็บ
export type AnswerSource = {
  // ชื่อหน้าเว็บที่จะแสดงให้ผู้ใช้เห็น
  title: string;
  // ลิงก์ไปยังหน้าเว็บนั้น
  url: string;
};

// ผลลัพธ์ที่ AI ทุกเจ้าต้องส่งกลับมาในรูปแบบเดียวกัน
export type AnswerResult = {
  // ข้อความคำตอบ
  text: string;
  // รายการแหล่งอ้างอิง (ถ้าไม่ได้ค้นเว็บจะเป็น array ว่าง)
  sources: AnswerSource[];
};

// interface ที่กำหนดว่า provider ต้องมีเมธอด answer() ที่รับและคืนค่าตามรูปแบบนี้
export interface AnswerProvider {
  // รับ system prompt, ข้อความผู้ใช้ และรูปภาพแบบ data URL (ไม่บังคับ) แล้วคืนคำตอบแบบ async
  answer(input: { systemPrompt: string; userText: string; imageDataUrl?: string }): Promise<AnswerResult>;
}
