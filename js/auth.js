(function () {
  const roleAccess = {
    "dashboard.html": ["IT", "FNS", "SNS", "CEO"],
    "requests.html": ["IT", "FNS", "SNS", "CEO"],
    "reports.html": ["IT", "FNS", "SNS", "CEO"],
    "create.html": ["IT", "FNS", "SNS"],
    "approvals.html": ["IT", "FNS", "CEO"],
    "logs.html": ["IT"]
  };
  const fallbackUsers = [
    { username: "it_", password: "IT2026Secure", role: "IT", permissions: ["all"] },
    { username: "ceo", password: "CEO2026Approve", role: "CEO", permissions: ["view_all", "approve"] },
    { username: "fns", password: "FNS2026Finance", role: "FNS", permissions: ["create", "view_all", "export_pdf"] },
    { username: "sns", password: "SNS2026Access", role: "SNS", permissions: ["create", "view_all", "export_pdf"] }
  ];

  function redirectForRole() {
    return "dashboard.html";
  }

  function normalizeDigits(value) {
    return String(value || "")
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  }

  function normalizeInput(value) {
    return normalizeDigits(value)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  function normalizeUsername(value) {
    return normalizeInput(value).toLowerCase();
  }

  function getLoginUsers() {
    const storedUsers = Array.isArray(IRS.getUsers?.()) ? IRS.getUsers() : [];
    const byUsername = {};
    [...storedUsers, ...fallbackUsers].forEach((user) => {
      byUsername[normalizeUsername(user.username)] = user;
    });
    return Object.values(byUsername);
  }

  function guardPage() {
    const file = location.pathname.split("/").pop() || "index.html";
    const user = IRS.getCurrentUser();
    if (file === "index.html" || file === "") {
      if (user) location.href = redirectForRole(user.role);
      return;
    }
    if (!user) {
      location.href = "index.html";
      return;
    }
    const allowed = roleAccess[file];
    if (allowed && !allowed.includes(user.role)) {
      IRS.showToast("غير مصرح لك بالدخول", "error");
      location.href = "dashboard.html";
      return;
    }
    IRS.renderShell();
  }

  function setupLogin() {
    const form = document.getElementById("loginForm");
    const resetBtn = document.getElementById("resetLoginBtn");

    resetBtn?.addEventListener("click", () => {
      localStorage.removeItem(IRS.STORAGE_KEYS.currentUser);
      localStorage.removeItem(IRS.STORAGE_KEYS.users);
      IRS.initData();
      IRS.showToast("تم تحديث بيانات الدخول");
    });

    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = normalizeUsername(document.getElementById("username").value);
      const password = normalizeInput(document.getElementById("password").value);
      const error = document.getElementById("loginError");
      const btn = document.getElementById("loginBtn");
      error.textContent = "";

      if (!username || !password) {
        error.textContent = "يرجى إدخال اسم المستخدم وكلمة المرور.";
        return;
      }

      btn.disabled = true;
      btn.textContent = "جاري الدخول...";

      setTimeout(() => {
        const user = getLoginUsers().find((u) => {
          return normalizeUsername(u.username) === username && normalizeInput(u.password) === password;
        });

        if (!user) {
          error.textContent = "بيانات الدخول غير صحيحة.";
          IRS.showToast("فشل تسجيل الدخول", "error");
          btn.disabled = false;
          btn.textContent = "تسجيل الدخول";
          return;
        }

        IRS.setCurrentUser({ username: user.username, role: user.role, permissions: user.permissions });
        IRS.addLog(user.username, "تسجيل دخول");
        IRS.showToast("تم تسجيل الدخول بنجاح");
        location.href = redirectForRole(user.role);
      }, 300);
    });
  }

  guardPage();
  setupLogin();
})();
