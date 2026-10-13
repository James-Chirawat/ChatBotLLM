// รวมการอ่านค่า environment variables ไว้ในที่เดียว ส่วนอื่นของโค้ดจะไม่อ่าน process.env เอง
// ค่าทั้งหมดในไฟล์นี้อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามตั้งชื่อขึ้นต้นด้วย NEXT_PUBLIC_ เพราะจะหลุดไปถึงเบราว์เซอร์

// URL เริ่มต้นของ Qwen (endpoint ภูมิภาคสิงคโปร์ ที่ใช้รูปแบบเดียวกับ OpenAI API)
const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

// ฟังก์ชันช่วยอ่านตัวแปรที่ "จำเป็นต้องมี" ถ้าไม่มีจะ throw error ทันที แทนที่จะปล่อยให้ไปพังที่อื่น
function required(name: string): string {
  // อ่านค่าตามชื่อแล้วตัดช่องว่างหัวท้าย (?. ป้องกันกรณีค่าเป็น undefined)
  const value = process.env[name]?.trim();
  // ถ้าว่างหรือไม่มีค่า ให้ throw error พร้อมบอกชื่อตัวแปรที่ขาด
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  // คืนค่าที่อ่านได้
  return value;
}

// ฟังก์ชันตรวจว่า URL ถูกต้องและเป็น HTTPS เพื่อป้องกันการส่ง API key ผ่านช่องทางที่ไม่เข้ารหัส
function httpsUrl(value: string, name: string): string {
  // ประกาศตัวแปรไว้เก็บ URL ที่แปลงแล้ว
  let url: URL;
  // ลองแปลงข้อความเป็น URL object
  try {
    // new URL จะ throw error ถ้ารูปแบบ URL ไม่ถูกต้อง
    url = new URL(value);
  } catch {
    // แปลง error ให้อ่านง่ายและบอกชื่อตัวแปรที่ผิด
    throw new Error(`${name} must be a valid URL`);
  }
  // ไม่ยอมรับ http:// หรือ protocol อื่น ยอมรับเฉพาะ https://
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  // คืน URL และตัด / ตัวท้ายออก เพื่อให้ต่อ path แบบ `${baseUrl}/responses` ได้ไม่เกิด // ซ้อน
  return url.toString().replace(/\/$/, "");
}

// อ่านค่าสำหรับเชื่อมต่อ LINE Messaging API
export function getLineConfig() {
  // คืน object ที่มีทั้งสองค่า ถ้าขาดตัวใดตัวหนึ่ง required() จะ throw
  return {
    // Channel ID ใช้คู่กับ secret ตอนขอ access token
    channelId: required("LINE_CHANNEL_ID"),
    // Channel secret ใช้ตรวจลายเซ็น webhook และขอ access token (เป็นค่าที่สำคัญที่สุด ห้ามหลุด)
    channelSecret: required("LINE_CHANNEL_SECRET"),
  };
}

// อ่านค่าสำหรับเรียก Qwen
export function getQwenConfig() {
  // คืน object การตั้งค่าทั้งหมดของ Qwen
  return {
    // API key จำเป็นต้องมี
    apiKey: required("QWEN_API_KEY"),
    // ชื่อโมเดล ถ้าไม่ได้ตั้งค่าจะใช้ qwen3.8-flash (|| ใช้ค่าขวามือเมื่อค่าซ้ายว่าง)
    model: process.env.QWEN_MODEL?.trim() || "qwen3.8-flash",
    // base URL ถ้าไม่ได้ตั้งจะใช้ค่าเริ่มต้น และต้องผ่านการตรวจ HTTPS เสมอ
    baseUrl: httpsUrl(process.env.QWEN_BASE_URL?.trim() || DEFAULT_QWEN_BASE_URL, "QWEN_BASE_URL"),
    // เปิด web search เป็นค่าเริ่มต้น จะปิดก็ต่อเมื่อตั้งค่าเป็นคำว่า "false" เท่านั้น (ไม่สนตัวพิมพ์เล็กใหญ่)
    webSearchEnabled: process.env.QWEN_ENABLE_WEB_SEARCH?.trim().toLowerCase() !== "false",
  };
}

// อ่านข้อมูลเพิ่มเติมขององค์กร (ไม่บังคับ) ที่จะถูกต่อท้าย system prompt เช่น เวลาทำการ หรือเบอร์ติดต่อ
export function getBotInstructions(): string {
  // ถ้าไม่ได้ตั้งค่า ให้คืน string ว่าง
  return process.env.BOT_INSTRUCTIONS?.trim() || "";
}
