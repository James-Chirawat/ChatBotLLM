// unit test ของการตรวจลายเซ็น webhook

// ใช้ createHmac สร้างลายเซ็นที่ถูกต้องสำหรับใช้ทดสอบ
import { createHmac } from "node:crypto";
// ดึงเครื่องมือของ Vitest
import { describe, expect, it } from "vitest";
// ดึงฟังก์ชันที่จะทดสอบ
import { isValidLineSignature } from "./line-signature";

// กลุ่ม test ของ isValidLineSignature
describe("isValidLineSignature", () => {
  // secret ปลอม
  const secret = "channel-secret";
  // body ตัวอย่าง
  const rawBody = '{"events":[]}';
  // สร้างลายเซ็นที่ถูกต้องด้วยวิธีเดียวกับที่ LINE ใช้
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  // test: body และลายเซ็นถูกต้อง ต้องผ่าน
  it("accepts a valid signature for the untouched raw body", () => {
    // ต้องได้ true
    expect(isValidLineSignature(rawBody, signature, secret)).toBe(true);
  });

  // test: ถ้า body หรือลายเซ็นถูกแก้ไข ต้องไม่ผ่าน
  it("rejects a changed body or signature", () => {
    // เติมช่องว่างแค่ตัวเดียวท้าย body ลายเซ็นก็ต้องไม่ตรงแล้ว
    expect(isValidLineSignature(`${rawBody} `, signature, secret)).toBe(false);
    // ลายเซ็นมั่ว (ความยาวต่างกัน) ต้องคืน false และต้องไม่ throw
    expect(isValidLineSignature(rawBody, "not-a-signature", secret)).toBe(false);
  });
});
