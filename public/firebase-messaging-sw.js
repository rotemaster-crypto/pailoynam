// รับแจ้งเตือนตอนปิดเว็บอยู่ (FCM แสดงแจ้งเตือนให้เอง แตะแล้วเปิดลิงก์ค้นหาเลขนั้น)
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC2vYWQOCgoPFwtHHnKP9vCPYNHgAjF_tI",
  authDomain: "pailoynam.firebaseapp.com",
  projectId: "pailoynam",
  storageBucket: "pailoynam.firebasestorage.app",
  messagingSenderId: "1055762038842",
  appId: "1:1055762038842:web:4eaebda5a8954abc0df503"
});
firebase.messaging();
