// ป้ายลอยน้ำ: มีคนแจ้งป้ายใหม่ → ส่งแจ้งเตือนหาเจ้าของที่เปิดแจ้งเตือนไว้
//   - เลขตรง: "มีคนเจอป้าย ... แล้ว"
//   - เลขใกล้เคียง (ต่าง 1 หลัก / สลับหลักติดกัน): "มีผู้พบทะเบียนใกล้เคียง ลองตรวจสอบ เผื่อพิมพ์ผิด"
// ทำงานเฉพาะตอนมีป้ายใหม่ (ไม่มี cron ไม่มี endpoint สาธารณะ) ค่าใช้จ่ายจึงแทบเป็นศูนย์
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const SITE = "https://pailoynam.web.app";
const DEAD_TOKEN = /registration-token-not-registered|invalid-registration-token|invalid-argument/;

// เหมือนฝั่งหน้าเว็บ: ต่าง 1 หลัก หรือสลับหลักติดกัน
function nearNumbers(n) {
  const d = n.split(""), out = new Set();
  d.forEach((ch, i) => { for (let c = 0; c < 10; c++) if (String(c) !== ch) { const x = [...d]; x[i] = String(c); out.add(x.join("")); } });
  for (let i = 0; i < d.length - 1; i++) if (d[i] !== d[i + 1]) { const x = [...d]; [x[i], x[i + 1]] = [x[i + 1], x[i]]; out.add(x.join("")); }
  return [...out].filter((x) => x.length === 1 || x[0] !== "0");
}

async function subsFor(db, numbers) {
  const docs = [];
  for (let i = 0; i < numbers.length; i += 30) {
    const snap = await db.collection("subs").where("numberKey", "in", numbers.slice(i, i + 30)).limit(500).get();
    docs.push(...snap.docs);
  }
  return docs;
}

async function send(db, docs, notification, link, tag) {
  const tokens = [...new Set(docs.map((d) => d.get("token")))];
  if (!tokens.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification,
    webpush: { fcmOptions: { link }, notification: { icon: `${SITE}/icon-192.png`, tag } },
  });
  // ลบ token ที่ใช้ไม่ได้แล้ว (ถอนแอป/ล้างข้อมูล) กันส่งซ้ำเปล่าๆ
  const dead = new Set();
  res.responses.forEach((r, i) => { if (!r.success && DEAD_TOKEN.test(r.error?.code || "")) dead.add(tokens[i]); });
  if (dead.size) {
    const batch = db.batch();
    docs.forEach((d) => { if (dead.has(d.get("token"))) batch.delete(d.ref); });
    await batch.commit();
  }
}

exports.notifyOwners = onDocumentCreated(
  { document: "plates/{id}", region: "asia-southeast1", maxInstances: 5, memory: "256MiB" },
  async (event) => {
    const p = event.data?.data();
    if (!p?.numberKey) return;

    const db = getFirestore();
    const plate = `${p.prefix || ""} ${p.number}`.trim();
    const where = [p.pickupType, p.pickupPlace].filter(Boolean).join(" ");
    const link = `${SITE}/?q=${p.numberKey}`;

    const exact = await subsFor(db, [p.numberKey]);
    await send(db, exact, {
      title: `มีคนเจอป้าย ${plate} แล้ว`,
      body: `${where ? "รับคืนที่ " + where + " · " : ""}แตะเพื่อดูรูปและนำทาง`,
    }, link, `plate-${p.numberKey}`);

    // เลขใกล้เคียง: เฉพาะเลข 3-4 หลัก (เลขสั้นใกล้เคียงกันเยอะเกินไป) และไม่ส่งซ้ำคนที่ได้แจ้งเตือนเลขตรงแล้ว
    if (p.numberKey.length < 3) return;
    const got = new Set(exact.map((d) => d.get("token")));
    const near = (await subsFor(db, nearNumbers(p.numberKey))).filter((d) => !got.has(d.get("token")));
    await send(db, near, {
      title: `มีผู้พบทะเบียนใกล้เคียง ${plate}`,
      body: "ลองตรวจสอบ เผื่อพิมพ์เลขผิด · แตะเพื่อดูรูป",
    }, link, `near-${p.numberKey}`);
  }
);
