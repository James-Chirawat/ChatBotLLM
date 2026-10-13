// หน้าแรกของเว็บ (path "/") เป็นแค่หน้าแนะนำวิธีติดตั้ง ไม่เกี่ยวกับการทำงานของบอท
// ใน App Router ไฟล์ page.tsx ในโฟลเดอร์ src/app/ จะกลายเป็นหน้า "/" อัตโนมัติ

// ข้อมูลขั้นตอนติดตั้ง 3 ขั้น เก็บเป็น array ของ [ลำดับ, หัวข้อ, คำอธิบาย] เพื่อนำไปวนแสดงผล
const steps = [
  // ขั้นที่ 1: เตรียมไฟล์ env ที่เก็บ secret
  ["1", "ตั้งค่า secrets", "คัดลอก .env.example เป็น .env.local แล้วใส่ LINE และ Qwen credentials"],
  // ขั้นที่ 2: รันเซิร์ฟเวอร์และเปิดให้ LINE เข้าถึงได้ผ่าน HTTPS
  ["2", "เริ่มเซิร์ฟเวอร์", "รัน npm run dev และเปิด public HTTPS tunnel ระหว่างพัฒนา"],
  // ขั้นที่ 3: บอก LINE ว่าให้ส่ง webhook มาที่ URL ไหน
  ["3", "ใส่ Webhook URL", "ตั้ง https://your-domain.com/api/webhooks/line ใน LINE Developers Console แล้วกด Verify"],
];

// คอมโพเนนต์หลักของหน้า Next.js จะ render ฝั่งเซิร์ฟเวอร์ (Server Component) โดยค่าเริ่มต้น
export default function Home() {
  // คืนค่า JSX ที่จะกลายเป็น HTML
  return (
    // <main> คือเนื้อหาหลักของหน้า
    <main>
      {/* ส่วนหัวขนาดใหญ่ (hero) */}
      <section className="hero">
        {/* ข้อความเล็กด้านบนหัวข้อ */}
        <p className="eyebrow">Open starter kit</p>
        {/* หัวข้อหลัก <br /> ใช้ขึ้นบรรทัดใหม่ */}
        <h1>LINE × Qwen<br />เลขานุการ AI ที่ต่อยอดได้</h1>
        {/* คำอธิบายสั้น ๆ ใต้หัวข้อ */}
        <p>Next.js + TypeScript สำหรับตอบคำถามทั่วไปด้วยบุคลิกสุภาพ พร้อมโครงสร้างโค้ดที่แยกเป็นชั้นและนำไปสอนได้ง่าย</p>
      {/* ปิดส่วน hero */}
      </section>
      {/* ส่วนแสดงขั้นตอน aria-label ช่วยให้โปรแกรมอ่านหน้าจอรู้ว่าส่วนนี้คืออะไร */}
      <section className="steps" aria-label="Quick start">
        {/* วนแต่ละขั้นตอน แล้วแยก array ย่อยออกเป็นตัวแปร number, title, description */}
        {steps.map(([number, title, description]) => (
          // การ์ดหนึ่งใบต่อหนึ่งขั้นตอน React ต้องการ key ที่ไม่ซ้ำเพื่อติดตามแต่ละรายการ
          <article key={number}>
            {/* วงกลมแสดงเลขลำดับ */}
            <span>{number}</span>
            {/* หัวข้อของขั้นตอน */}
            <h2>{title}</h2>
            {/* คำอธิบายขั้นตอน */}
            <p>{description}</p>
          {/* ปิดการ์ด */}
          </article>
        ))}
      {/* ปิดส่วนขั้นตอน */}
      </section>
      {/* หมายเหตุบอก path ของ webhook */}
      <p className="note">Webhook endpoint: <code>/api/webhooks/line</code></p>
    {/* ปิด main */}
    </main>
  );
}
