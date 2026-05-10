(function () {
  function getVisibleRequests() {
    const user = IRS.getCurrentUser();
    const requests = IRS.getRequests();
    if (!user) return [];
    if (user.role === "FNS") return requests;
    return requests;
  }

  function formatAmount(amount, currency) {
    if (amount === undefined || amount === null || amount === "") return "-";
    const val = Number(amount);
    if (Number.isNaN(val)) return "-";
    if (currency === "IQD") return `${val.toLocaleString("ar-IQ")} د.ع`;
    return `$${val.toLocaleString("en-US")}`;
  }

  function statusText(status) {
    if (status === "Approved") return "موافق";
    if (status === "Rejected") return "غير موافق";
    return "قيد الانتظار";
  }

  function drawBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const labels = ["قيد الانتظار", "موافق عليه", "مرفوض"];
    const colors = ["#bc8a00", "#00a88f", "#d63649"];
    const max = Math.max(...data, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const h = canvas.height;
    const margin = 28;
    const barWidth = 64;
    const gap = 34;
    data.forEach((val, i) => {
      const x = margin + i * (barWidth + gap);
      const bh = ((h - 85) * val) / max;
      const y = h - 42 - bh;
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, barWidth, bh);
      ctx.fillStyle = "#1c2740";
      ctx.font = "12px Cairo";
      ctx.fillText(labels[i], x, h - 18);
      ctx.fillText(String(val), x + 26, y - 8);
    });
  }

  function drawPieChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const total = data.reduce((sum, x) => sum + x, 0);
    const colors = ["#bc8a00", "#00a88f", "#d63649"];
    const labels = ["قيد الانتظار", "موافق عليه", "مرفوض"];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!total) {
      ctx.fillStyle = "#6b7690";
      ctx.font = "14px Cairo";
      ctx.fillText("لا توجد بيانات بعد", 150, 120);
      return;
    }
    let start = -Math.PI / 2;
    data.forEach((val, i) => {
      const slice = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(130, 120);
      ctx.arc(130, 120, 82, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      start += slice;
    });
    labels.forEach((label, i) => {
      ctx.fillStyle = colors[i];
      ctx.fillRect(245, 70 + i * 26, 12, 12);
      ctx.fillStyle = "#1c2740";
      ctx.font = "12px Cairo";
      ctx.fillText(`${label} (${data[i]})`, 265, 80 + i * 26);
    });
  }

  function setupDashboardCardLinks() {
    document.querySelectorAll(".kpi-link").forEach((card) => {
      card.style.cursor = "pointer";
      card.title = "عرض الطلبات";
      card.addEventListener("click", () => {
        const status = card.getAttribute("data-status") || "all";
        location.href = `requests.html?status=${encodeURIComponent(status)}`;
      });
    });
  }

  function renderDashboard() {
    const k = document.getElementById("kpiGrid");
    if (!k) return;
    const v = getVisibleRequests();
    const pending = v.filter((r) => r.status === "Pending").length;
    const approved = v.filter((r) => r.status === "Approved").length;
    const rejected = v.filter((r) => r.status === "Rejected").length;
    k.innerHTML = `<article class="kpi-card kpi-link" data-status="all"><div>إجمالي الطلبات</div><div class="kpi-value">${v.length}</div></article><article class="kpi-card kpi-link" data-status="Pending"><div>قيد الانتظار</div><div class="kpi-value">${pending}</div></article><article class="kpi-card kpi-link" data-status="Approved"><div>موافق عليه</div><div class="kpi-value">${approved}</div></article><article class="kpi-card kpi-link" data-status="Rejected"><div>مرفوض</div><div class="kpi-value">${rejected}</div></article>`;

    const amountGrid = document.getElementById("amountGrid");
    if (amountGrid) {
      const approvedOnly = v.filter((r) => r.status === "Approved");
      const usdTotal = approvedOnly.filter((r) => r.currency === "USD").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const iqdTotal = approvedOnly.filter((r) => r.currency === "IQD").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      amountGrid.innerHTML = `
        <article class="amount-card usd"><div class="amount-label">إجمالي مبالغ الدولار المعتمدة (USD)</div><div class="amount-value">$${usdTotal.toLocaleString("en-US")}</div></article>
        <article class="amount-card iqd"><div class="amount-label">إجمالي مبالغ الدينار المعتمدة (IQD)</div><div class="amount-value">${iqdTotal.toLocaleString("ar-IQ")} د.ع</div></article>
      `;
    }

    drawBarChart("barChart", [pending, approved, rejected]);
    drawPieChart("pieChart", [pending, approved, rejected]);
    setupDashboardCardLinks();

    const host = document.getElementById("recentActivity");
    if (!host) return;
    const recent = IRS.getLogs().slice(0, 6);
    host.innerHTML = recent.length
      ? recent.map((log) => `<div class="activity-item"><strong>${log.user}</strong> - ${log.action}<br><small>${IRS.formatDate(log.timestamp)}</small></div>`).join("")
      : "<div class='activity-item'>لا توجد أنشطة حتى الآن.</div>";
  }

  async function fileToDataUrl(path) {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function exportDecisionPdf(request) {
    if (!window.html2canvas || !window.jspdf) throw new Error("pdf libs missing");
    const { jsPDF } = window.jspdf;
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "0";
    wrapper.style.width = "900px";
    wrapper.style.background = "#fff";
    wrapper.style.padding = "30px";
    wrapper.style.direction = "rtl";
    wrapper.style.fontFamily = "Cairo, sans-serif";
    let logoHtml = "";
    try {
      const logoData = await fileToDataUrl("Logo Iraq Takaful Option.jpg(1).jpeg");
      logoHtml = `<img src="${logoData}" style="width:120px;height:auto;object-fit:contain;" />`;
    } catch {
      logoHtml = `<div style="width:120px;height:70px;border:1px dashed #999;display:flex;align-items:center;justify-content:center;font-size:12px;">LOGO</div>`;
    }
    const decisionColor = request.status === "Rejected" ? "#d63649" : request.status === "Approved" ? "#0f7c67" : "#0b1220";
    wrapper.innerHTML = `
      <div style="border:2px solid #0038a8;border-radius:12px;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d9e2ff;padding-bottom:14px;margin-bottom:18px;">
          <div>${logoHtml}</div>
          <div style="text-align:left"><h2 style="margin:0;color:#0038a8;">تكافل العراق للتأمين التكافلي</h2><div style="font-size:14px;margin-top:6px;">مستند داخلي</div></div>
        </div>
        <h3 style="margin:0 0 14px 0;color:${decisionColor};">قرار الطلب: ${statusText(request.status)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>رقم الطلب</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">#${request.id}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>نوع الطلب</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.requestType || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>اسم الموظف</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.employeeName || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>اسم مقدم الطلب</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.requesterName || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>القسم</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.department || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>المبلغ</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${formatAmount(request.amount, request.currency)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>تاريخ الإنشاء</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${IRS.formatDate(request.date)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>آخر تحديث</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${IRS.formatDate(request.updatedAt || request.date)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>تفاصيل الطلب</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.requestDetails || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>الملاحظات</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${request.notes || "-"}</td></tr>
        </table>
      </div>`;
    document.body.appendChild(wrapper);
    const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: "#ffffff" });
    wrapper.remove();
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW - 12;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 6, 6, imgW, imgH);
    const statusName = request.status === "Approved" ? "موافق" : request.status === "Rejected" ? "غير-موافق" : "قيد-الانتظار";
    pdf.save(`طلب-${request.id}-${statusName}.pdf`);
  }

  function canDeleteRequest(request) {
    const user = IRS.getCurrentUser();
    if (!user || !request) return false;
    if (user.role === "IT") return true;
    return false;
  }

  function renderRequestsTable() {
    const body = document.getElementById("requestsTableBody");
    if (!body) return;
    const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
    const status = document.getElementById("statusFilter")?.value || "all";
    let rows = getVisibleRequests();
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    if (search) {
      rows = rows.filter((r) =>
        String(r.requestType || "").toLowerCase().includes(search) ||
        String(r.requestDetails || "").toLowerCase().includes(search) ||
        String(r.employeeName || "").toLowerCase().includes(search) ||
        String(r.requesterName || "").toLowerCase().includes(search) ||
        String(r.department || "").toLowerCase().includes(search)
      );
    }

    body.innerHTML = rows.length
      ? rows.map((r) => {
        const exportBtn = `<button class="btn btn-sm btn-ghost js-export" data-id="${r.id}">PDF</button>`;
        const deleteBtn = canDeleteRequest(r) ? `<button class="btn btn-sm btn-danger js-delete" data-id="${r.id}">حذف</button>` : "";
        return `<tr><td>#${r.id}</td><td>${IRS.highlightText(r.requestType || "-", search)}</td><td>${IRS.highlightText(r.employeeName || "-", search)}</td><td>${IRS.highlightText(r.requesterName || "-", search)}</td><td>${IRS.highlightText(r.department || "-", search)}</td><td>${formatAmount(r.amount, r.currency)}</td><td><span class="badge ${r.status}">${IRS.statusAr(r.status)}</span></td><td>${IRS.formatDate(r.date)}</td><td>${IRS.formatDate(r.updatedAt || r.date)}</td><td style="display:flex;gap:6px;white-space:nowrap;">${exportBtn}${deleteBtn}</td></tr>`;
      }).join("")
      : `<tr><td colspan="10">لا توجد نتائج.</td></tr>`;

    body.querySelectorAll(".js-export").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const req = IRS.getRequests().find((x) => x.id === id);
        if (!req) return;
        try {
          await exportDecisionPdf(req);
          IRS.showToast(`تم تصدير الطلب #${id}`);
          const user = IRS.getCurrentUser();
          if (user) IRS.addLog(user.username, `تصدير PDF للطلب #${id}`);
        } catch {
          IRS.showToast("تعذر تصدير PDF", "error");
        }
      });
    });
    body.querySelectorAll(".js-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const all = IRS.getRequests();
        const req = all.find((x) => x.id === id);
        if (!req || !canDeleteRequest(req)) return;
        if (!window.confirm(`هل تريد حذف الطلب #${id}؟`)) return;
        IRS.setRequests(all.filter((x) => x.id !== id));
        const user = IRS.getCurrentUser();
        if (user) IRS.addLog(user.username, `حذف الطلب #${id}`);
        IRS.showToast(`تم حذف الطلب #${id}`);
        renderRequestsTable();
      });
    });
  }

  function setupFilters() {
    const params = new URLSearchParams(location.search);
    const statusFromUrl = params.get("status");
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter && statusFromUrl && ["all", "Pending", "Approved", "Rejected"].includes(statusFromUrl)) {
      statusFilter.value = statusFromUrl;
    }
    document.getElementById("searchInput")?.addEventListener("input", renderRequestsTable);
    document.getElementById("statusFilter")?.addEventListener("change", renderRequestsTable);
  }

  function setupCreateRequest() {
    const form = document.getElementById("createRequestForm");
    if (!form) return;
    const reqNoInput = document.getElementById("requestNo");
    const statusInput = document.getElementById("status");
    const createdAtInput = document.getElementById("createdAt");
    const updatedAtInput = document.getElementById("updatedAt");
    function refreshMeta() {
      const now = new Date().toISOString();
      if (reqNoInput) reqNoInput.value = `#${IRS.nextRequestId()}`;
      if (statusInput) statusInput.value = "قيد الانتظار";
      if (createdAtInput) createdAtInput.value = IRS.formatDate(now);
      if (updatedAtInput) updatedAtInput.value = IRS.formatDate(now);
    }
    refreshMeta();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = IRS.getCurrentUser();
      const requestType = document.getElementById("requestType").value.trim();
      const receiptNo = document.getElementById("receiptNo").value.trim();
      const employeeName = document.getElementById("employeeName").value.trim();
      const requesterName = document.getElementById("requesterName").value.trim();
      const department = document.getElementById("department").value.trim();
      const amount = document.getElementById("amount").value.trim();
      const currency = document.getElementById("currency").value;
      const priority = document.getElementById("priority").value;
      const requestDetails = document.getElementById("requestDetails").value.trim();
      const notes = document.getElementById("notes").value.trim();
      const requesterSignature = document.getElementById("requesterSignature").value.trim();
      const managerSignature = document.getElementById("managerSignature").value.trim();
      const attachments = Array.from(document.getElementById("attachments").files || []).map((f) => f.name);
      const error = document.getElementById("createError");
      const btn = document.getElementById("createBtn");
      error.textContent = "";
      if (!requestType || !employeeName || !requesterName || !department || !amount || !currency || !priority || !requestDetails) {
        error.textContent = "يرجى إكمال جميع الحقول الإلزامية.";
        return;
      }
      btn.disabled = true;
      btn.textContent = "جاري الإرسال...";
      const requests = IRS.getRequests();
      const now = new Date().toISOString();
      const id = IRS.nextRequestId();
      requests.unshift({ id, requestType, receiptNo, employeeName, requesterName, department, amount: Number(amount), currency, priority, requestDetails, notes, attachments, requesterSignature, managerSignature, title: requestType, description: requestDetails, createdBy: user.username, status: "Pending", date: now, updatedAt: now });
      IRS.setRequests(requests);
      IRS.addLog(user.username, `إنشاء طلب رقم #${id}`);
      IRS.showToast("تم إرسال الطلب بنجاح");
      form.reset();
      refreshMeta();
      btn.disabled = false;
      btn.textContent = "إرسال الطلب";
    });
  }

  let modalState = { id: null, action: null };
  function setupApprovals() {
    const host = document.getElementById("approvalsList");
    if (!host) return;
    const modal = document.getElementById("confirmModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const detailsModal = document.getElementById("detailsModal");
    const detailsBody = document.getElementById("detailsBody");
    function openModal(id, action, title) {
      modalState = { id, action };
      modalTitle.textContent = action === "Approve" ? "تأكيد الموافقة" : "تأكيد الرفض";
      modalMessage.textContent = action === "Approve" ? `هل تريد الموافقة على الطلب "${title}"؟` : `هل تريد رفض الطلب "${title}"؟`;
      modal.classList.remove("hidden");
    }
    function closeModal() { modal.classList.add("hidden"); modalState = { id: null, action: null }; }
    function closeDetailsModal() { detailsModal?.classList.add("hidden"); }
    function openDetailsModal(req) {
      if (!detailsModal || !detailsBody) return;
      detailsBody.innerHTML = `<div class="details-grid"><div class="details-item"><strong>رقم الطلب</strong><span>#${req.id}</span></div><div class="details-item"><strong>الحالة</strong><span>${IRS.statusAr(req.status)}</span></div><div class="details-item"><strong>نوع الطلب</strong><span>${req.requestType || "-"}</span></div><div class="details-item"><strong>الأولوية</strong><span>${req.priority || "-"}</span></div><div class="details-item"><strong>اسم الموظف</strong><span>${req.employeeName || "-"}</span></div><div class="details-item"><strong>اسم مقدم الطلب</strong><span>${req.requesterName || "-"}</span></div><div class="details-item"><strong>القسم</strong><span>${req.department || "-"}</span></div><div class="details-item"><strong>المبلغ</strong><span>${formatAmount(req.amount, req.currency)}</span></div><div class="details-item"><strong>تاريخ الإنشاء</strong><span>${IRS.formatDate(req.date)}</span></div><div class="details-item"><strong>آخر تحديث</strong><span>${IRS.formatDate(req.updatedAt || req.date)}</span></div></div><div class="details-item"><strong>تفاصيل الطلب</strong><span>${req.requestDetails || "-"}</span></div><div class="details-item"><strong>الملاحظات</strong><span>${req.notes || "-"}</span></div><div class="details-grid"><div class="details-item"><strong>توقيع مقدم الطلب</strong><span>${req.requesterSignature || "-"}</span></div><div class="details-item"><strong>توقيع المدير المفوض</strong><span>${req.managerSignature || "-"}</span></div></div><div class="details-item"><strong>المرفقات</strong><span>${(req.attachments && req.attachments.length) ? req.attachments.join("، ") : "-"}</span></div>`;
      detailsModal.classList.remove("hidden");
    }
    document.getElementById("modalCancel")?.addEventListener("click", closeModal);
    document.getElementById("detailsClose")?.addEventListener("click", closeDetailsModal);
    detailsModal?.addEventListener("click", (e) => { if (e.target === detailsModal) closeDetailsModal(); });
    document.getElementById("modalConfirm")?.addEventListener("click", async () => {
      const { id, action } = modalState;
      if (!id || !action) return;
      const user = IRS.getCurrentUser();
      const reqs = IRS.getRequests();
      const req = reqs.find((r) => r.id === id);
      if (!req) return closeModal();
      req.status = action === "Approve" ? "Approved" : "Rejected";
      req.updatedAt = new Date().toISOString();
      IRS.setRequests(reqs);
      IRS.addLog(user.username, action === "Approve" ? `الموافقة على الطلب #${id}` : `رفض الطلب #${id}`);
      IRS.showToast(action === "Approve" ? `تمت الموافقة على الطلب #${id}` : `تم رفض الطلب #${id}`);
      try { await exportDecisionPdf(req); } catch { IRS.showToast("تعذر إنشاء PDF", "error"); }
      closeModal();
      renderApprovals();
    });
    function renderApprovals() {
      const items = IRS.getRequests();
      host.innerHTML = items.length
        ? items.map((r) => `<div class="approval-item" data-open-id="${r.id}" style="cursor:pointer;"><strong>#${r.id} ${r.requestType || "-"}</strong><div>${r.requestDetails || "-"}</div><small>الموظف: ${r.employeeName || "-"} | مقدم الطلب: ${r.requesterName || r.createdBy} | القسم: ${r.department || "-"} | المبلغ: ${formatAmount(r.amount, r.currency)} | أولوية ${r.priority || "غير محدد"} | ${IRS.formatDate(r.date)}</small><div style="margin-top:8px;"><span class="badge ${r.status}">${IRS.statusAr(r.status)}</span></div>${r.status === "Pending" ? `<div class="approval-actions"><button class="btn btn-sm btn-success" data-id="${r.id}" data-title="${r.requestType || "طلب"}" data-action="Approve">موافقة</button><button class="btn btn-sm btn-danger" data-id="${r.id}" data-title="${r.requestType || "طلب"}" data-action="Reject">رفض</button></div>` : ""}</div>`).join("")
        : `<div class="approval-item">لا توجد طلبات للمراجعة.</div>`;
      host.querySelectorAll("button[data-id]").forEach((btn) => btn.addEventListener("click", () => openModal(Number(btn.dataset.id), btn.dataset.action, btn.dataset.title)));
      host.querySelectorAll("[data-open-id]").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          const id = Number(card.getAttribute("data-open-id"));
          const req = items.find((x) => x.id === id);
          if (req) openDetailsModal(req);
        });
      });
    }
    renderApprovals();
  }

  renderDashboard();
  setupFilters();
  renderRequestsTable();
  setupCreateRequest();
  setupApprovals();
})();
