(function () {
  const roleAccess = {
    "dashboard.html": ["IT", "FNS", "SNS", "CEO"],
    "requests.html": ["IT", "FNS", "SNS", "CEO"],
    "reports.html": ["IT", "FNS", "SNS", "CEO"],
    "create.html": ["IT", "FNS", "SNS"],
    "approvals.html": ["IT", "FNS", "CEO"],
    "logs.html": ["IT"]
  };

  const defaultLoginUsers = [
    { username: "it_", password: "IT2026Secure", role: "IT", permissions: ["all"] },
    { username: "1", password: "1", role: "CEO", permissions: ["view_all", "approve"] },
    { username: "ceo", password: "CEO2026Approve", role: "CEO", permissions: ["view_all", "approve"] },
    { username: "fns", password: "FNS2026Finance", role: "FNS", permissions: ["create", "view_all", "export_pdf"] },
    { username: "sns", password: "SNS2026Access", role: "SNS", permissions: ["create", "view_all", "export_pdf"] }
  ];

  const ceoDirectUser = { username: "ceo", role: "CEO", permissions: ["view_all", "approve"] };

  function redirectForRole() {
    return "dashboard.html";
  }

  function normalizeDigits(value) {
    return String(value || "")
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
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
    [...storedUsers, ...defaultLoginUsers].forEach((user) => {
      byUsername[normalizeUsername(user.username)] = user;
    });
    return Object.values(byUsername);
  }

  function loginAs(user) {
    IRS.setCurrentUser({ username: user.username, role: user.role, permissions: user.permissions });
    IRS.addLog(user.username, "تسجيل دخول");
    IRS.showToast("تم تسجيل الدخول بنجاح");
    location.href = redirectForRole(user.role);
  }

  function refreshLoginData() {
    localStorage.removeItem(IRS.STORAGE_KEYS.currentUser);
    localStorage.removeItem(IRS.STORAGE_KEYS.users);
    IRS.initData();
    IRS.showToast("تم تحديث بيانات الدخول");
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

  function setupCeoDirectLogin() {
    const directBtn = document.getElementById("ceoDirectBtn");
    const codeWrap = document.getElementById("ceoCodeWrap");
    const codeInput = document.getElementById("ceoCode");
    const codeBtn = document.getElementById("ceoCodeBtn");
    const codeError = document.getElementById("ceoCodeError");
    if (!directBtn || !codeWrap || !codeInput || !codeBtn || !codeError) return;

    directBtn.addEventListener("click", () => {
      codeError.textContent = "";
      codeWrap.classList.remove("hidden");
      codeInput.focus();
    });

    function verifyCode() {
      const code = normalizeInput(codeInput.value);
      if (code !== "0011") {
        codeError.textContent = "رمز الدخول غير صحيح.";
        IRS.showToast("رمز الدخول غير صحيح", "error");
        return;
      }
      loginAs(ceoDirectUser);
    }

    codeBtn.addEventListener("click", verifyCode);
    codeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") verifyCode();
    });
  }

  function setupLogin() {
    const form = document.getElementById("loginForm");
    const resetBtn = document.getElementById("resetLoginBtn");
    resetBtn?.addEventListener("click", refreshLoginData);
    setupCeoDirectLogin();
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
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
        const user = getLoginUsers().find((item) => {
          return normalizeUsername(item.username) === username && normalizeInput(item.password) === password;
        });

        if (!user) {
          error.textContent = "بيانات الدخول غير صحيحة.";
          IRS.showToast("فشل تسجيل الدخول", "error");
          btn.disabled = false;
          btn.textContent = "تسجيل الدخول";
          return;
        }

        loginAs(user);
      }, 200);
    });
  }

  guardPage();
  setupLogin();
})();
