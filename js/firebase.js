(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const enabled = Boolean(cfg.apiKey && cfg.projectId);
  let db = null;
  let unsub = null;

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

  if (enabled && window.firebase) {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
  }

  async function hydrateToLocalStorage() {
    if (!enabled || !db) return;
    try {
      const snap = await db.collection("irs_state").doc("main").get();
      if (!snap.exists) {
        // إنشاء المستند أول مرة من النسخة المحلية
        await db.collection("irs_state").doc("main").set({
          requests: readLocal("irs_requests", []),
          logs: readLocal("irs_logs", []),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return;
      }
      const data = snap.data() || {};
      if (Array.isArray(data.requests)) writeLocal("irs_requests", mergeRequests(readLocal("irs_requests", []), data.requests));
      if (Array.isArray(data.logs)) writeLocal("irs_logs", data.logs);
      window.dispatchEvent(new Event("irs:data-updated"));
    } catch (e) {
      console.error("Firebase hydrate failed:", e);
    }
  }

  async function pushState(partial) {
    if (!enabled || !db) return;
    try {
      await db.collection("irs_state").doc("main").set({
        ...partial,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firebase push failed:", e);
    }
  }

  function subscribeRealtime() {
    if (!enabled || !db || unsub) return;
    unsub = db.collection("irs_state").doc("main").onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (Array.isArray(data.requests)) writeLocal("irs_requests", mergeRequests(readLocal("irs_requests", []), data.requests));
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
