// ไฟล์ตั้งค่าของ Next.js

// ดึง type ของ config เพื่อให้ editor ช่วยเติมคำและตรวจชื่อตัวเลือกได้
import type { NextConfig } from "next";

// object ค่าตั้งค่า
const nextConfig: NextConfig = {
  // เปิด React Strict Mode ช่วยจับโค้ดที่มีปัญหาตอนพัฒนา (ไม่มีผลกับ production)
  reactStrictMode: true,
  // บังคับให้ไฟล์เอกสารที่แปลงจาก PDF ติดไปกับ webhook route ตอน deploy (Next.js ตามไฟล์ที่อ่านด้วย fs ไม่เจอเองเสมอไป)
  outputFileTracingIncludes: {
    "/api/webhooks/line": ["./knowledge/knowledge.txt"],
  },
};

// export ให้ Next.js นำไปใช้
export default nextConfig;
