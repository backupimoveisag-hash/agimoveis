// AG Imobiliária — Firebase Authentication + Cloud Firestore
// Firebase Storage NÃO é utilizado pelo CRM. O Google Drive é usado para backup JSON via Apps Script.
// A configuração do Drive é feita pelo gateway do Apps Script dentro do CRM.
window.EI_FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyC2PSL6Tkr8InBfsVoWLvItPRG6jZzbZFQ",
  authDomain: "agimoveis-6308b.firebaseapp.com",
  projectId: "agimoveis-6308b",
  storageBucket: "agimoveis-6308b.firebasestorage.app", // presente no config do projeto, mas não utilizado
  databaseId: "(default)",
  messagingSenderId: "280440406177",
  appId: "1:280440406177:web:14cf4e7b4d92c91f4770e0",
  workspaceId: "main",
  publicSiteUrl: "www.imoveisag.com",
  // WebRTC: servidores de descoberta de rede. Pode trocar por STUN/TURN próprio futuramente.
  rtcIceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
  buildId: "v134-price-on-request"
};
