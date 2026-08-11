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

  function normalizeDeletedIds(ids) {
    return Array.from(new Set((Array.isArray(ids) ? ids : [])
      .map((id) => Number(id))
      .filter(Boolean)));
  }

  function getLocalDeletedIds() {
    return normalizeDeletedIds(readLocal("irs_deleted_request_ids", []));
  }

  function writeLocalDeletedIds(ids) {
    writeLocal("irs_deleted_request_ids", normalizeDeletedIds(ids));
  }

  function filterDeletedRequests(requests, deletedIds) {
    const deleted = new Set(normalizeDeletedIds(deletedIds));
    return (Array.isArray(requests) ? requests : []).filter((request) => !deleted.has(Number(request?.id)));
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
      const deletedIds = normalizeDeletedIds(data.deletedRequestIds);
      writeLocalDeletedIds([...getLocalDeletedIds(), ...deletedIds]);
      if (Array.isArray(data.requests)) writeLocal("irs_requests", filterDeletedRequests(data.requests, getLocalDeletedIds()));
      if (Array.isArray(data.logs)) writeLocal("irs_logs", data.logs);
      window.dispatchEvent(new Event("irs:data-updated"));
    } catch (e) {
      console.error("Firebase hydrate failed:", e);
    }
  }

  async function pushState(partial) {
    if (!enabled || !db) return;
    try {
      const nextPartial = { ...partial };
      if (Array.isArray(nextPartial.requests)) {
        nextPartial.requests = filterDeletedRequests(nextPartial.requests, getLocalDeletedIds());
        writeLocal("irs_requests", nextPartial.requests);
      }
      await db.collection("irs_state").doc("main").set({
        ...nextPartial,
        deletedRequestIds: getLocalDeletedIds(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firebase push failed:", e);
    }
  }

  async function deleteRequest(requestId, nextRequests) {
    const id = Number(requestId);
    const deletedIds = normalizeDeletedIds([...getLocalDeletedIds(), id]);
    const filteredRequests = (Array.isArray(nextRequests) ? nextRequests : readLocal("irs_requests", []))
      .filter((request) => Number(request?.id) !== id);

    writeLocal("irs_requests", filteredRequests);
    writeLocalDeletedIds(deletedIds);

    if (!enabled || !db) {
      window.dispatchEvent(new Event("irs:data-updated"));
      return;
    }

    try {
      const ref = db.collection("irs_state").doc("main");
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? (snap.data() || {}) : {};
        const cloudDeletedIds = normalizeDeletedIds(data.deletedRequestIds);
        const nextDeletedIds = normalizeDeletedIds([...cloudDeletedIds, id]);
        const cloudRequests = Array.isArray(data.requests) ? data.requests : [];
        transaction.set(ref, {
          requests: filterDeletedRequests(cloudRequests, nextDeletedIds),
          deletedRequestIds: nextDeletedIds,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });
      window.dispatchEvent(new Event("irs:data-updated"));
    } catch (e) {
      console.error("Firebase delete request failed:", e);
      throw e;
    }
  }

  function subscribeRealtime() {
    if (!enabled || !db || unsub) return;
    unsub = db.collection("irs_state").doc("main").onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      const deletedIds = normalizeDeletedIds(data.deletedRequestIds);
      writeLocalDeletedIds([...getLocalDeletedIds(), ...deletedIds]);
      if (Array.isArray(data.requests)) writeLocal("irs_requests", filterDeletedRequests(data.requests, getLocalDeletedIds()));
      if (Array.isArray(data.logs)) writeLocal("irs_logs", data.logs);
      window.dispatchEvent(new Event("irs:data-updated"));
    }, (err) => console.error("Firebase realtime failed:", err));
  }

  window.IRSCloud = {
    enabled,
    hydrateToLocalStorage,
    pushState,
    deleteRequest,
    subscribeRealtime
  };
})();
