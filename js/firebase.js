(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const enabled = !isLocal && Boolean(cfg.apiKey && cfg.projectId);
  let db = null;
  let unsub = null;
  let dbPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureDb() {
    if (!enabled) return null;
    if (db) return db;
    if (!dbPromise) {
      dbPromise = (async () => {
        if (!window.firebase) {
          await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
          await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");
        }
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.firestore();
        return db;
      })();
    }
    return dbPromise;
  }

  function readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function timestampOf(request) {
    const value = request?.updatedAt || request?.date || "";
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  function mergeRequests(localRequests, cloudRequests) {
    const merged = new Map();
    [...(Array.isArray(cloudRequests) ? cloudRequests : []), ...(Array.isArray(localRequests) ? localRequests : [])].forEach((request) => {
      const id = Number(request?.id);
      if (!id) return;
      const existing = merged.get(id);
      if (!existing || timestampOf(request) >= timestampOf(existing)) merged.set(id, request);
    });
    return Array.from(merged.values()).sort((a, b) => Number(b.id) - Number(a.id));
  }

  async function hydrateToLocalStorage() {
    const cloudDb = await ensureDb();
    if (!cloudDb) return;
    try {
      const snap = await cloudDb.collection("irs_state").doc("main").get();
      if (!snap.exists) {
        // إنشاء المستند أول مرة من النسخة المحلية
        await cloudDb.collection("irs_state").doc("main").set({
          requests: readLocal("irs_requests", []),
          logs: readLocal("irs_logs", []),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return;
      }
      const data = snap.data() || {};
      if (Array.isArray(data.requests)) writeLocal("irs_requests", data.requests);
      if (Array.isArray(data.logs)) writeLocal("irs_logs", data.logs);
      window.dispatchEvent(new Event("irs:data-updated"));
    } catch (e) {
      console.error("Firebase hydrate failed:", e);
    }
  }

  async function pushState(partial) {
    const cloudDb = await ensureDb();
    if (!cloudDb) return;
    try {
      await cloudDb.collection("irs_state").doc("main").set({
        ...partial,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firebase push failed:", e);
    }
  }

  async function subscribeRealtime() {
    const cloudDb = await ensureDb();
    if (!cloudDb || unsub) return;
    unsub = cloudDb.collection("irs_state").doc("main").onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (Array.isArray(data.requests)) writeLocal("irs_requests", data.requests);
      if (Array.isArray(data.logs)) writeLocal("irs_logs", data.logs);
      window.dispatchEvent(new Event("irs:data-updated"));
    }, (err) => console.error("Firebase realtime failed:", err));
  }

  window.IRSCloud = {
    enabled,
    hydrateToLocalStorage,
    pushState,
    subscribeRealtime
  };
})();
