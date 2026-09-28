#!/usr/bin/env bash
# ป้ายลอยน้ำ — ตั้งค่าและ deploy ขึ้น Firebase ในคำสั่งเดียว
# ใช้: ./deploy.sh <project-id> [--new]
#   --new = สร้างโปรเจกต์ Firebase ใหม่ให้ด้วย
set -euo pipefail

PROJECT="${1:-}"
[ -z "$PROJECT" ] && { echo "ใช้: ./deploy.sh <project-id> [--new]"; exit 1; }
command -v firebase >/dev/null || { echo "ติดตั้งก่อน: npm i -g firebase-tools"; exit 1; }
command -v node >/dev/null || { echo "ต้องมี Node.js"; exit 1; }

firebase login --no-localhost >/dev/null 2>&1 || firebase login

if [ "${2:-}" = "--new" ]; then
  echo "▶ สร้างโปรเจกต์ $PROJECT"
  firebase projects:create "$PROJECT" --display-name "Pai Loy Nam"
fi

echo "{ \"projects\": { \"default\": \"$PROJECT\" } }" > .firebaserc
firebase use "$PROJECT"

echo "▶ สร้างฐานข้อมูล Firestore (asia-southeast1) — ถ้ามีแล้วจะข้าม"
firebase firestore:databases:create "(default)" --location=asia-southeast1 --project "$PROJECT" 2>/dev/null || echo "  (มีอยู่แล้ว ข้าม)"

echo "▶ หา/สร้าง Web App"
APP_ID=$(firebase apps:list WEB --project "$PROJECT" --json | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).result||[];process.stdout.write(r[0]?.appId||"")})')
if [ -z "$APP_ID" ]; then
  APP_ID=$(firebase apps:create WEB "payloynam-web" --project "$PROJECT" --json | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).result.appId))')
fi
echo "  appId: $APP_ID"

echo "▶ ใส่ config ลงใน public/index.html"
firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT" --json > /tmp/sdkconfig.json
node -e '
  const fs=require("fs");
  const cfg=JSON.parse(fs.readFileSync("/tmp/sdkconfig.json","utf8")).result.sdkConfig;
  const keep={apiKey:cfg.apiKey,authDomain:cfg.authDomain,projectId:cfg.projectId,storageBucket:cfg.storageBucket,appId:cfg.appId};
  const f="public/index.html"; let s=fs.readFileSync(f,"utf8");
  s=s.replace(/const firebaseConfig = \{[\s\S]*?\};/, "const firebaseConfig = "+JSON.stringify(keep,null,2)+";");
  fs.writeFileSync(f,s); console.log("  projectId:",keep.projectId);'

echo "▶ Deploy (Hosting + Firestore rules)"
firebase deploy --only hosting,firestore --project "$PROJECT"

echo
echo "✅ เสร็จแล้ว: https://$PROJECT.web.app"
echo "   หน้าแจ้งป้าย: https://$PROJECT.web.app/#report"
echo
echo "⚠️  อย่าลืม 2 อย่างใน console (ทำครั้งเดียว):"
echo "   1) Authentication > Sign-in method > เปิด Anonymous"
echo "      https://console.firebase.google.com/project/$PROJECT/authentication/providers"
echo "   2) AI Logic > Get started > Gemini Developer API (ถ้าต้องการให้ AI อ่านป้าย)"
echo "      https://console.firebase.google.com/project/$PROJECT/ailogic"
