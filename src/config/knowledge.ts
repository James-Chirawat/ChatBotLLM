// อ่านเอกสารอ้างอิงขององค์กร (แปลงจาก PDF ด้วย npm run knowledge) เพื่อแนบไปกับ system prompt

// ดึงฟังก์ชันอ่านไฟล์แบบ async
import { readFile } from "node:fs/promises";
// ดึงฟังก์ชันต่อ path
import path from "node:path";

// ตำแหน่งไฟล์ความรู้ (ต้องตรงกับ outputFileTracingIncludes ใน next.config.ts เพื่อให้ไฟล์ติดไปตอน deploy)
const KNOWLEDGE_FILE = path.join(process.cwd(), "knowledge", "knowledge.txt");
// เพดานจำนวนตัวอักษร เพราะเอกสารถูกส่งไปกับทุกคำถาม ยิ่งยาวยิ่งเสียค่า token และตอบช้า
const MAX_KNOWLEDGE_CHARS = 100_000;

// คืนข้อความเอกสาร หรือ string ว่างถ้ายังไม่ได้สร้างไฟล์ (บอทจะทำงานแบบเดิมโดยไม่มีเอกสาร)
// อ่านใหม่ทุกครั้งที่เรียก (ใช้เวลาไม่กี่มิลลิวินาที) จึงรัน npm run knowledge ใหม่ได้โดยไม่ต้อง restart server
export async function getKnowledgeText(): Promise<string> {
  // ลองอ่านไฟล์
  try {
    // อ่านเป็นข้อความแล้วตัดช่องว่างหัวท้าย
    const text = (await readFile(KNOWLEDGE_FILE, "utf8")).trim();
    // ถ้ายาวเกินเพดาน ให้เตือนใน log แล้วตัดส่วนเกินทิ้ง
    if (text.length > MAX_KNOWLEDGE_CHARS) console.warn(`knowledge.txt is longer than ${MAX_KNOWLEDGE_CHARS} characters and was truncated`);
    // คืนข้อความที่ไม่เกินเพดาน
    return text.slice(0, MAX_KNOWLEDGE_CHARS);
  } catch (error) {
    // ไม่มีไฟล์ถือเป็นเรื่องปกติ (ยังไม่ได้ใส่ PDF) จึงคืนค่าว่างเงียบ ๆ
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    // error อื่น เช่น ไม่มีสิทธิ์อ่าน ให้ส่งต่อ เพื่อให้ผู้ดูแลเห็นใน log
    throw error;
  }
}
