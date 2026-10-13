// ไฟล์นี้คือ "ประตูหน้าบ้าน" ของบอท: LINE จะส่ง HTTP POST มาที่ /api/webhooks/line ทุกครั้งที่มีเหตุการณ์ในแชท
// Next.js App Router จับคู่ path จากโฟลเดอร์ src/app/api/webhooks/line/ และไฟล์ชื่อ route.ts ให้อัตโนมัติ

// ดึงฟังก์ชันอ่านค่า LINE_CHANNEL_ID / LINE_CHANNEL_SECRET จาก environment variables
import { getLineConfig } from "@/config/runtime-config";
// ดึงฟังก์ชันตรวจลายเซ็น HMAC เพื่อยืนยันว่า request มาจาก LINE จริง ไม่ใช่คนปลอมตัวมา
import { isValidLineSignature } from "@/lib/security/line-signature";
// ดึงฟังก์ชันที่จัดการเหตุการณ์ (event) แต่ละตัว เช่น ผู้ใช้ส่งข้อความหรือรูปภาพ
import { handleLineEvent } from "@/services/line-webhook.service";
// ดึงเฉพาะ "type" (ไม่มีโค้ดจริง ใช้แค่ตอนตรวจชนิดข้อมูล) ของ payload ที่ LINE ส่งมา
import type { LineWebhookPayload } from "@/types/line";

// บังคับให้ route นี้รันบน Node.js runtime (ไม่ใช่ Edge) เพราะเราใช้โมดูล node:crypto และ Buffer
export const runtime = "nodejs";

// ฟังก์ชันชื่อ POST จะถูกเรียกเมื่อมี HTTP POST เข้ามาที่ path นี้ (ชื่อฟังก์ชันต้องตรงกับ HTTP method)
export async function POST(request: Request): Promise<Response> {
  // อ่าน body เป็นข้อความดิบ "ก่อน" แปลงเป็น JSON เพราะลายเซ็นคำนวณจาก byte ดิบ ถ้าแปลงก่อนลายเซ็นจะไม่ตรง
  const rawBody = await request.text();

  // ประกาศตัวแปรไว้ก่อน เพื่อใช้ต่อหลังออกจากบล็อก try
  let channelSecret: string;
  // ลองอ่าน Channel secret จาก env ถ้าไม่ได้ตั้งค่าไว้ ฟังก์ชันจะ throw error
  try {
    // เก็บ channelSecret ไว้ใช้ตรวจลายเซ็น
    channelSecret = getLineConfig().channelSecret;
  } catch (error) {
    // log เฉพาะข้อความ error (ไม่ log ค่า secret) เพื่อให้ผู้ดูแลรู้ว่าลืมตั้ง env
    console.error("LINE configuration error", error instanceof Error ? error.message : "unknown error");
    // ตอบ 500 กลับไปพร้อมข้อความกลาง ๆ ไม่บอกรายละเอียดภายในให้คนภายนอกรู้
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  // ตรวจลายเซ็นใน header x-line-signature เทียบกับ HMAC ที่คำนวณเองจาก body และ secret
  if (!isValidLineSignature(rawBody, request.headers.get("x-line-signature"), channelSecret)) {
    // ลายเซ็นไม่ตรง แปลว่าไม่ได้มาจาก LINE หรือถูกแก้ไขระหว่างทาง ให้ปฏิเสธทันทีด้วย 401
    return Response.json({ error: "Invalid LINE signature" }, { status: 401 });
  }

  // ประกาศตัวแปรสำหรับเก็บ payload ที่แปลงเป็น object แล้ว
  let payload: LineWebhookPayload;
  // แปลงข้อความ JSON เป็น object (ทำหลังตรวจลายเซ็นผ่านแล้วเท่านั้น)
  try {
    // JSON.parse แปลงข้อความเป็น object แล้วบอก TypeScript ว่ามีรูปร่างแบบ LineWebhookPayload
    payload = JSON.parse(rawBody) as LineWebhookPayload;
  } catch {
    // ถ้า JSON เสีย ให้ตอบ 400 (Bad Request)
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // payload ที่ถูกต้องต้องมี events เป็น array ถ้าไม่ใช่ให้ตอบ 400
  if (!Array.isArray(payload.events)) return Response.json({ error: "Invalid event payload" }, { status: 400 });

  // ประมวลผลทุก event พร้อมกัน allSettled จะรอจนครบทุกตัว แม้บางตัวจะล้มเหลวก็ไม่ทำให้ตัวอื่นหยุด
  const results = await Promise.allSettled(payload.events.map(handleLineEvent));
  // วนดูผลลัพธ์ของแต่ละ event
  for (const result of results) {
    // ถ้า event ไหนล้มเหลว ให้ log ไว้ดูภายหลัง (ไม่ตอบ error กลับไปให้ LINE)
    if (result.status === "rejected") console.error("LINE event handling failed", result.reason);
  }

  // ตอบ 200 OK ให้ LINE รู้ว่าได้รับ webhook แล้ว
  return Response.json({ ok: true });
}
