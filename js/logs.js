(function () {
  const body = document.getElementById("logsTableBody");
  const clearBtn = document.getElementById("clearLogsBtn");
  const user = IRS.getCurrentUser();

  function renderLogs() {
    if (!body) return;
    const logs = IRS.getLogs();
    body.innerHTML = logs.length
      ? logs.map((log) => `<tr><td>${IRS.formatDate(log.timestamp)}</td><td>${log.user}</td><td>${log.action}</td></tr>`).join("")
      : `<tr><td colspan="3">لا توجد سجلات متاحة.</td></tr>`;
  }

  if (clearBtn) {
    if (!user || user.role !== "IT") {
      clearBtn.style.display = "none";
    } else {
      clearBtn.addEventListener("click", () => {
        const ok = window.confirm("هل تريد حذف كل السجلات؟");
        if (!ok) return;
        IRS.setLogs([]);
        IRS.addLog(user.username, "حذف كل السجلات");
        IRS.showToast("تم حذف السجلات");
        renderLogs();
      });
    }
  }

  renderLogs();
})();
