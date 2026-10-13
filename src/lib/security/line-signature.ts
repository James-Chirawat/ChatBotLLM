// ตรวจลายเซ็น webhook เพื่อยืนยันว่า request มาจาก LINE จริงและไม่ถูกแก้ไขระหว่างทาง
// หลักการ: LINE คำนวณ HMAC-SHA256 ของ body ด้วย Channel secret แล้วส่งมาใน header x-line-signature
// เราคำนวณแบบเดียวกันเอง ถ้าผลตรงกัน แปลว่าผู้ส่งรู้ secret ซึ่งก็คือ LINE

// createHmac ใช้คำนวณ HMAC ส่วน timingSafeEqual ใช้เปรียบเทียบข้อมูลในเวลาคงที่
import { createHmac, timingSafeEqual } from "node:crypto";

// ต้องตรวจจาก body ดิบที่ LINE ส่งมาแบบไม่แก้ไข และต้องตรวจก่อนแปลงเป็น JSON
export function isValidLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  // ไม่มี header ลายเซ็นมาเลย ถือว่าไม่ผ่าน
  if (!signature) return false;

  // คำนวณ HMAC-SHA256 ของ body โดยใช้ secret เป็นกุญแจ แล้วแปลงผลเป็น base64 (รูปแบบเดียวกับที่ LINE ส่งมา)
  const expected = createHmac("sha256", channelSecret).update(rawBody, "utf8").digest("base64");
  // แปลงลายเซ็นที่คำนวณได้เป็น byte เพื่อใช้กับ timingSafeEqual
  const expectedBytes = Buffer.from(expected, "utf8");
  // แปลงลายเซ็นที่ได้รับมาเป็น byte เช่นกัน
  const signatureBytes = Buffer.from(signature, "utf8");

  // timingSafeEqual ใช้เวลาเท่ากันไม่ว่าจะต่างกันที่ตำแหน่งไหน จึงกันการเดาลายเซ็นจากเวลาตอบสนอง (timing attack)
  // ต้องเช็คความยาวก่อน เพราะ timingSafeEqual จะ throw ถ้าความยาวไม่เท่ากัน
  return expectedBytes.length === signatureBytes.length && timingSafeEqual(expectedBytes, signatureBytes);
}
