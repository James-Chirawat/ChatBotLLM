const steps = [
  ["1", "ตั้งค่า secrets", "คัดลอก .env.example เป็น .env.local แล้วใส่ LINE และ Qwen credentials"],
  ["2", "เริ่มเซิร์ฟเวอร์", "รัน npm run dev และเปิด public HTTPS tunnel ระหว่างพัฒนา"],
  ["3", "ใส่ Webhook URL", "ตั้ง https://your-domain.com/api/webhooks/line ใน LINE Developers Console แล้วกด Verify"],
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Open starter kit</p>
        <h1>LINE × Qwen<br />เลขานุการ AI ที่ต่อยอดได้</h1>
        <p>Next.js + TypeScript สำหรับตอบคำถามทั่วไปด้วยบุคลิกสุภาพ พร้อมโครงสร้างโค้ดที่แยกเป็นชั้นและนำไปสอนได้ง่าย</p>
      </section>
      <section className="steps" aria-label="Quick start">
        {steps.map(([number, title, description]) => (
          <article key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <p className="note">Webhook endpoint: <code>/api/webhooks/line</code></p>
    </main>
  );
}
