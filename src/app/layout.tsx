// Root layout คือโครง HTML ที่ครอบทุกหน้าในเว็บ (App Router บังคับต้องมีไฟล์นี้)

// ดึง type Metadata มาใช้กำหนดชนิดข้อมูลของ title/description
import type { Metadata } from "next";
// โหลด CSS ส่วนกลาง ซึ่งจะมีผลกับทุกหน้า
import "./globals.css";

// metadata ที่ export ออกไป Next.js จะนำไปสร้างแท็ก <title> และ <meta name="description"> ให้อัตโนมัติ
export const metadata: Metadata = {
  // ข้อความบนแท็บของเบราว์เซอร์
  title: "LINE + Qwen Secretary Bot",
  // คำอธิบายสำหรับ search engine และตอนแชร์ลิงก์
  description: "A reusable Next.js LINE bot starter powered by Qwen.",
};

// คอมโพเนนต์ layout รับ children ซึ่งคือเนื้อหาของหน้าที่กำลังแสดงอยู่ (เช่น page.tsx)
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // คืนโครง HTML ทั้งหน้า
  return (
    // lang="th" บอกเบราว์เซอร์และโปรแกรมอ่านหน้าจอว่าเนื้อหาเป็นภาษาไทย
    <html lang="th">
      {/* วางเนื้อหาของแต่ละหน้าไว้ใน body */}
      <body>{children}</body>
    {/* ปิดแท็ก html */}
    </html>
  );
}
