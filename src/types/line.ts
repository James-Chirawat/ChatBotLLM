// type ของข้อมูลที่ LINE ส่งมาทาง webhook (เขียนเฉพาะฟิลด์ที่โปรเจคนี้ใช้)
// ถ้าต้องการรองรับ event อื่น ให้ดูฟิลด์เพิ่มเติมได้จากเอกสาร LINE Messaging API

// โครงสร้างของ body ทั้งก้อน
export type LineWebhookPayload = {
  // LINE อาจรวมหลาย event ไว้ใน request เดียว
  events: LineWebhookEvent[];
};

// event หนึ่งตัว
export type LineWebhookEvent = {
  // ชนิดของ event เช่น "message", "follow", "unfollow"
  type: string;
  // token สำหรับตอบกลับ ใช้ได้ครั้งเดียว (บาง event ไม่มี)
  replyToken?: string;
  // แหล่งที่มาของ event
  source?: {
    // แชทหนึ่งต่อหนึ่ง (user), กลุ่ม (group) หรือห้องแชทหลายคน (room)
    type: "user" | "group" | "room";
    // userId ของผู้ส่ง
    userId?: string;
  };
  // ข้อมูลข้อความ (มีเฉพาะ event ชนิด "message")
  message?: {
    // id ของข้อความ ใช้ดาวน์โหลดรูปหรือไฟล์
    id?: string;
    // ชนิดข้อความ เช่น "text", "image", "sticker"
    type: string;
    // ตัวข้อความ (มีเฉพาะชนิด "text")
    text?: string;
  };
};
