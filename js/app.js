(function () {
  const STORAGE_KEYS = { users: "irs_users", currentUser: "irs_current_user", requests: "irs_requests", logs: "irs_logs" };
  const defaultUsers = [
    { username: "it", password: "it", role: "IT", permissions: ["all"] },
    { username: "fns", password: "fns", role: "FNS", permissions: ["create", "view_all", "export_pdf"] },
    { username: "sns", password: "sns", role: "SNS", permissions: ["create", "view_all", "export_pdf"] },
    { username: "ceo", password: "ceo", role: "CEO", permissions: ["view_all", "approve"] }
  ];
  const roleAr = { IT: "تقنية المعلومات", FNS: "المالية", SNS: "SNS", CEO: "الإدارة العليا" };
  const statusAr = { Pending: "قيد الانتظار", Approved: "موافق عليه", Rejected: "مرفوض" };

  function safeRead(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } }
  function safeWrite(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function initData() {
    if (!localStorage.getItem(STORAGE_KEYS.users)) safeWrite(STORAGE_KEYS.users, defaultUsers);
    else {
      const users = getUsers();
      if (!users.some((u) => u.username === "sns")) {
        users.push({ username: "sns", password: "sns", role: "SNS", permissions: ["create", "view_all", "export_pdf"] });
        safeWrite(STORAGE_KEYS.users, users);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.requests)) safeWrite(STORAGE_KEYS.requests, []);
    if (!localStorage.getItem(STORAGE_KEYS.logs)) safeWrite(STORAGE_KEYS.logs, []);
  }

  const getUsers = () => safeRead(STORAGE_KEYS.users, defaultUsers);
  const getCurrentUser = () => safeRead(STORAGE_KEYS.currentUser, null);
  const setCurrentUser = (u) => safeWrite(STORAGE_KEYS.currentUser, u);
  const clearCurrentUser = () => localStorage.removeItem(STORAGE_KEYS.currentUser);
  const getRequests = () => safeRead(STORAGE_KEYS.requests, []);
  const setRequests = (i) => {
    safeWrite(STORAGE_KEYS.requests, i);
    window.IRSCloud?.pushState({ requests: i });
  };
  const getLogs = () => safeRead(STORAGE_KEYS.logs, []);
  const setLogs = (i) => {
    safeWrite(STORAGE_KEYS.logs, i);
    window.IRSCloud?.pushState({ logs: i });
  };

  function addLog(user, action) {
    const logs = getLogs();
    logs.unshift({ user, action, timestamp: new Date().toISOString() });
    setLogs(logs.slice(0, 1000));
  }

  function nextRequestId() {
    const r = getRequests();
    return r.length ? Math.max(...r.map((x) => Number(x.id) || 0)) + 1 : 1;
  }

  function formatDate(iso) { return new Date(iso).toLocaleString("ar-IQ"); }

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightText(text, query) {
    const clean = escapeHtml(text || "");
    if (!query) return clean;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return clean.replace(new RegExp(`(${q})`, "ig"), "<mark>$1</mark>");
  }

  function showToast(message, type = "success") {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const n = document.createElement("div");
    n.className = `toast ${type}`;
    n.textContent = message;
    c.appendChild(n);
    setTimeout(() => n.remove(), 2500);
  }

  function getNavItems(role) {
    const common = [{ href: "dashboard.html", label: "لوحة التحكم" }, { href: "requests.html", label: "الطلبات" }, { href: "reports.html", label: "التقارير" }];
    if (role === "FNS" || role === "SNS" || role === "IT") common.push({ href: "create.html", label: "إنشاء طلب" });
    if (role === "CEO" || role === "FNS" || role === "IT") common.push({ href: "approvals.html", label: "الموافقات" });
    if (role === "IT") common.push({ href: "logs.html", label: "السجلات" });
    return common;
  }

  function renderShell() {
    const user = getCurrentUser();
    const sidebar = document.getElementById("sidebar");
    const topbar = document.getElementById("topbar");
    if (!user || !sidebar || !topbar) return;
    const currentPage = location.pathname.split("/").pop();
  sidebar.innerHTML = `<div class="sidebar-brand"><img src="Logo Iraq Takaful Option.jpg(1).jpeg" alt="Logo Iraq Takaful" class="sidebar-logo" /><div>شركة تكافل العراق للتامين التكافلي</div></div>${getNavItems(user.role).map((n) => `<a class="nav-link ${currentPage === n.href ? "active" : ""}" href="${n.href}">${n.label}</a>`).join("")}`;
    topbar.innerHTML = `<div><strong>بوابة ${roleAr[user.role] || user.role}</strong><div style="color: var(--muted); font-size: .85rem;">مرحبًا، ${user.username}</div></div><button id="logoutBtn" class="btn btn-ghost">تسجيل الخروج</button>`;
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      addLog(user.username, "تسجيل خروج");
      clearCurrentUser();
      location.href = "index.html";
    });
  }

  window.IRS = {
    STORAGE_KEYS,
    initData,
    getUsers,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    getRequests,
    setRequests,
    getLogs,
    setLogs,
    addLog,
    nextRequestId,
    formatDate,
    highlightText,
    showToast,
    renderShell,
    statusAr: (s) => statusAr[s] || s
  };

  initData();
  window.IRSCloud?.hydrateToLocalStorage();
  window.IRSCloud?.subscribeRealtime();
})();

