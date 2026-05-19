(function () {
  const roleAccess = {
    "dashboard.html": ["IT", "FNS", "SNS", "CEO"],
    "requests.html": ["IT", "FNS", "SNS", "CEO"],
    "reports.html": ["IT", "FNS", "SNS", "CEO"],
    "create.html": ["IT", "FNS", "SNS"],
    "approvals.html": ["IT", "FNS", "CEO"],
    "logs.html": ["IT"]
  };

  function redirectForRole() { return "dashboard.html"; }

  function guardPage() {
    const file = location.pathname.split("/").pop() || "index.html";
    const user = IRS.getCurrentUser();
    if (file === "index.html" || file === "") { if (user) location.href = redirectForRole(user.role); return; }
    if (!user) { location.href = "index.html"; return; }
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
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim().toLowerCase();
      const password = document.getElementById("password").value.trim();
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
        const user = IRS.getUsers().find((u) => u.username === username && u.password === password);
        if (!user) {
          error.textContent = "بيانات الدخول غير صحيحة.";
          IRS.showToast("فشل تسجيل الدخول", "error");
          btn.disabled = false;
          btn.textContent = "دخول";
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
