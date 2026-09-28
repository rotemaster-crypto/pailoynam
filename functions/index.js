// ป้ายลอยน้ำ: มีคนแจ้งป้ายใหม่ → ส่งแจ้งเตือนหาเจ้าของที่เปิดแจ้งเตือนเลขนี้ไว้
// ทำงานเฉพาะตอนมีป้ายใหม่ (ไม่มี cron ไม่มี endpoint สาธารณะ) ค่าใช้จ่ายจึงแทบเป็นศูนย์
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const SITE = "https://pailoynam.web.app";
const DEAD_TOKEN = /registration-token-not-registered|invalid-registration-token|invalid-argument/;

exports.notifyOwners = onDocumentCreated(
  { document: "plates/{id}", region: "asia-southeast1", maxInstances: 5, memory: "256MiB" },
  async (event) => {
    const p = event.data?.data();
    if (!p?.numberKey) return;

    const db = getFirestore();
    const subs = await db.collection("subs").where("numberKey", "==", p.numberKey).limit(500).get();
    if (subs.empty) return;

    const tokens = [...new Set(subs.docs.map((d) => d.get("token")))];
    const plate = `${p.prefix || ""} ${p.number}`.trim();
    const where = [p.pickupType, p.pickupPlace].filter(Boolean).join(" ");
    const link = `${SITE}/?q=${p.numberKey}`;

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: `มีคนเจอป้าย ${plate} แล้ว`,
        body: `${where ? "รับคืนที่ " + where + " · " : ""}แตะเพื่อดูรูปและนำทาง`,
      },
      webpush: {
        fcmOptions: { link },
        notification: { icon: `${SITE}/icon-192.png`, tag: `plate-${p.numberKey}` },
      },
    });

    // ลบ token ที่ใช้ไม่ได้แล้ว (ถอนแอป/ล้างข้อมูล) กันส่งซ้ำเปล่าๆ
    const dead = new Set();
    res.responses.forEach((r, i) => { if (!r.success && DEAD_TOKEN.test(r.error?.code || "")) dead.add(tokens[i]); });
    if (dead.size) {
      const batch = db.batch();
      subs.docs.forEach((d) => { if (dead.has(d.get("token"))) batch.delete(d.ref); });
      await batch.commit();
    }
  }
);
