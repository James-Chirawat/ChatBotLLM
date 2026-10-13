// ฟังก์ชันสำหรับเรียก LINE Messaging API: ขอ token, ตอบข้อความ, แสดงสถานะกำลังพิมพ์ และดาวน์โหลดรูป

// รูปร่าง JSON ที่ LINE ตอบกลับตอนขอ access token
type StatelessTokenResponse = {
  // token ที่ได้ (ไม่มีถ้าขอไม่สำเร็จ)
  access_token?: string;
  // คำอธิบาย error จาก LINE
  error_description?: string;
};

// ข้อมูลประจำตัวของ channel ที่ทุกฟังก์ชันในไฟล์นี้ต้องใช้
type LineCredentials = {
  // Channel ID จาก LINE Developers Console
  channelId: string;
  // Channel secret จาก LINE Developers Console
  channelSecret: string;
};

// ขนาดรูปสูงสุดที่ยอมรับ คือ 5 MB (5 × 1024 × 1024 ไบต์)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// ชนิดไฟล์รูปที่ยอมส่งต่อให้ Qwen (ใช้ Set เพราะเช็คได้เร็วด้วย .has())
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// ขอ stateless channel access token ใหม่จาก LINE (มีอายุ 15 นาที)
// ตั้งใจไม่เก็บหรือ cache token ไว้ แต่จะขอใหม่ทุกครั้งก่อนเรียก Messaging API
async function issueStatelessLineAccessToken(credentials: LineCredentials): Promise<string> {
  // สร้าง body แบบ form (application/x-www-form-urlencoded) ตามที่ LINE กำหนด
  const form = new URLSearchParams({
    // ใช้ OAuth แบบ client credentials (ยืนยันตัวตนด้วย ID และ secret)
    grant_type: "client_credentials",
    // Channel ID
    client_id: credentials.channelId,
    // Channel secret
    client_secret: credentials.channelSecret,
  });

  // ส่ง request ไปที่ endpoint ขอ token ของ LINE
  const response = await fetch("https://api.line.me/oauth2/v3/token", {
    // การขอ token ต้องใช้ POST
    method: "POST",
    // บอกว่า body เป็นแบบ form
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // แปลง form เป็นข้อความ เช่น grant_type=...&client_id=...
    body: form.toString(),
    // ไม่ให้ Next.js cache เพราะต้องได้ token ใหม่ทุกครั้ง
    cache: "no-store",
    // ไม่ยอมให้ redirect เพื่อกันไม่ให้ secret ถูกส่งต่อไปที่อื่น
    redirect: "error",
  });

  // อ่าน JSON ถ้าอ่านไม่ได้ให้ใช้ object ว่าง
  const body = (await response.json().catch(() => ({}))) as StatelessTokenResponse;
  // ถ้า HTTP error หรือไม่ได้ token กลับมา
  if (!response.ok || !body.access_token) {
    // throw error พร้อมรหัส status และคำอธิบายจาก LINE (ไม่ใส่ secret ลงในข้อความ)
    throw new Error(`LINE stateless token request failed (${response.status}): ${body.error_description ?? "unknown error"}`);
  }

  // คืน token ที่ได้
  return body.access_token;
}

// ตอบกลับข้อความของผู้ใช้ด้วย reply token (ใช้ได้ครั้งเดียวและมีอายุสั้น)
export async function replyToLine(input: LineCredentials & { replyToken: string; text: string }): Promise<void> {
  // ขอ access token ก่อน
  const accessToken = await issueStatelessLineAccessToken(input);
  // เรียก reply API
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    // ส่งข้อความด้วย POST
    method: "POST",
    // HTTP headers
    headers: {
      // ยืนยันตัวตนด้วย token ที่เพิ่งขอมา
      Authorization: `Bearer ${accessToken}`,
      // body เป็น JSON
      "Content-Type": "application/json",
    },
    // ข้อมูลที่จะส่ง
    body: JSON.stringify({
      // reply token ที่ได้มาจาก webhook event
      replyToken: input.replyToken,
      // ข้อความตอบกลับ ตัดไม่ให้เกิน 4,500 ตัวอักษร (LINE จำกัดไว้ที่ 5,000)
      messages: [{ type: "text", text: input.text.slice(0, 4_500) }],
    }),
    // ไม่ cache
    cache: "no-store",
    // ไม่ยอมให้ redirect เพื่อกันไม่ให้ access token ถูกส่งต่อไปที่อื่น
    redirect: "error",
  });

  // ถ้า LINE ตอบ error ให้ throw (route จะเป็นคน log)
  if (!response.ok) throw new Error(`LINE reply failed with status ${response.status}`);
}

// แสดงสถานะ "กำลังพิมพ์..." ของ LINE ในแชทแบบหนึ่งต่อหนึ่ง
export async function startLineLoadingIndicator(input: LineCredentials & { chatId: string; loadingSeconds: number }): Promise<void> {
  // ขอ access token ก่อน
  const accessToken = await issueStatelessLineAccessToken(input);
  // เรียก API เริ่มแสดง loading animation
  const response = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
    // ต้องใช้ POST
    method: "POST",
    // HTTP headers
    headers: {
      // ยืนยันตัวตน
      Authorization: `Bearer ${accessToken}`,
      // body เป็น JSON
      "Content-Type": "application/json",
    },
    // chatId คือ userId ของผู้ใช้ และ loadingSeconds คือจำนวนวินาทีที่จะแสดง (จะหายไปเองเมื่อบอทตอบ)
    body: JSON.stringify({ chatId: input.chatId, loadingSeconds: input.loadingSeconds }),
    // ไม่ cache
    cache: "no-store",
    // ไม่ยอมให้ redirect
    redirect: "error",
  });

  // ถ้า LINE ตอบ error ให้ throw (ผู้เรียกจะดักไว้ ไม่ให้กระทบการตอบจริง)
  if (!response.ok) throw new Error(`LINE loading indicator failed with status ${response.status}`);
}

// ดาวน์โหลดรูปที่ผู้ใช้ส่งมา โดยเก็บไว้แค่ในหน่วยความจำของ request นี้ ผู้เรียกต้องไม่บันทึกรูปลงที่ใดถาวร
export async function getLineImageContent(input: LineCredentials & { messageId: string }): Promise<{ dataUrl: string }> {
  // ขอ access token ก่อน
  const accessToken = await issueStatelessLineAccessToken(input);
  // ดาวน์โหลดไฟล์รูป (โดเมนเป็น api-data ไม่ใช่ api) และ encodeURIComponent กันอักขระพิเศษใน messageId
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(input.messageId)}/content`, {
    // ยืนยันตัวตน
    headers: { Authorization: `Bearer ${accessToken}` },
    // ไม่ cache รูปของผู้ใช้
    cache: "no-store",
    // ไม่ยอมให้ redirect
    redirect: "error",
  });
  // ดาวน์โหลดไม่สำเร็จ ให้ throw
  if (!response.ok) throw new Error(`LINE image download failed with status ${response.status}`);

  // อ่านชนิดไฟล์จาก header เช่น "image/jpeg; charset=..." แล้วเก็บแค่ส่วนก่อน ; และแปลงเป็นตัวพิมพ์เล็ก
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  // ถ้าไม่ใช่ชนิดรูปที่รองรับ ให้ปฏิเสธ
  if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) throw new Error("LINE returned an unsupported image type");

  // อ่านขนาดไฟล์จาก header (ถ้าไม่มี header นี้ Number(null) จะได้ 0)
  const contentLength = Number(response.headers.get("content-length"));
  // ถ้ารู้ขนาดล่วงหน้าและเกิน 5 MB ให้ปฏิเสธทันทีโดยไม่ต้องดาวน์โหลด
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) throw new Error("LINE image is larger than 5 MB");

  // อ่านข้อมูลรูปทั้งหมดเป็น Buffer
  const image = Buffer.from(await response.arrayBuffer());
  // เช็คขนาดจริงซ้ำอีกครั้ง เผื่อ header ไม่มีหรือไม่ตรงกับความจริง
  if (image.byteLength > MAX_IMAGE_BYTES) throw new Error("LINE image is larger than 5 MB");

  // แปลงเป็น data URL แบบ base64 (data:image/png;base64,....) ซึ่งเป็นรูปแบบที่ Qwen รับได้
  return { dataUrl: `data:${contentType};base64,${image.toString("base64")}` };
}
