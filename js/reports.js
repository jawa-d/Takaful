(function () {
  const fromDate = document.getElementById("fromDate");
  const toDate = document.getElementById("toDate");
  const statusSel = document.getElementById("statusSel");
  const deptSearch = document.getElementById("deptSearch");

  function formatAmount(amount, currency) {
    const n = Number(amount || 0);
    if (currency === "IQD") return `${n.toLocaleString("ar-IQ")} د.ع`;
    return `$${n.toLocaleString("en-US")}`;
  }

  function filteredRequests() {
    let rows = IRS.getRequests();
    const user = IRS.getCurrentUser();
    if (user?.role === "FNS") rows = rows;
    const from = fromDate?.value ? new Date(fromDate.value + "T00:00:00").getTime() : null;
    const to = toDate?.value ? new Date(toDate.value + "T23:59:59").getTime() : null;
    const st = statusSel?.value || "all";
    const dep = (deptSearch?.value || "").trim().toLowerCase();

    return rows.filter((r) => {
      const t = new Date(r.date).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (st !== "all" && r.status !== st) return false;
      if (dep && !String(r.department || "").toLowerCase().includes(dep)) return false;
      return true;
    });
  }

  function renderKpis(rows) {
    const host = document.getElementById("reportKpis");
    if (!host) return;
    const approved = rows.filter((r) => r.status === "Approved");
    const usd = approved.filter((r) => r.currency === "USD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const iqd = approved.filter((r) => r.currency === "IQD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    host.innerHTML = `
      <article class="report-kpi"><div class="label">إجمالي الطلبات</div><div class="value">${rows.length}</div></article>
      <article class="report-kpi"><div class="label">قيد الانتظار</div><div class="value">${rows.filter((r) => r.status === "Pending").length}</div></article>
      <article class="report-kpi"><div class="label">موافق عليه</div><div class="value">${approved.length}</div></article>
      <article class="report-kpi"><div class="label">مرفوض</div><div class="value">${rows.filter((r) => r.status === "Rejected").length}</div></article>
      <article class="report-kpi"><div class="label">إجمالي المعتمد USD</div><div class="value">${formatAmount(usd, "USD")}</div></article>
      <article class="report-kpi"><div class="label">إجمالي المعتمد IQD</div><div class="value">${formatAmount(iqd, "IQD")}</div></article>
    `;
  }

  function drawSimpleBars(canvasId, labels, values, colors) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const max = Math.max(...values, 1);
    const bw = 56;
    const gap = 24;
    const margin = 20;
    values.forEach((v, i) => {
      const x = margin + i * (bw + gap);
      const h = ((c.height - 70) * v) / max;
      const y = c.height - 35 - h;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, bw, h);
      ctx.fillStyle = "#1c2740";
      ctx.font = "12px Cairo";
      ctx.fillText(labels[i], x, c.height - 12);
      ctx.fillText(String(v), x + 20, y - 6);
    });
  }

  function renderDept(rows) {
    const body = document.getElementById("deptBody");
    if (!body) return;
    const map = {};
    rows.forEach((r) => {
      const k = r.department || "غير محدد";
      if (!map[k]) map[k] = { total: 0, approved: 0, rejected: 0 };
      map[k].total += 1;
      if (r.status === "Approved") map[k].approved += 1;
      if (r.status === "Rejected") map[k].rejected += 1;
    });
    const entries = Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    body.innerHTML = entries.length
      ? entries.map(([k, v]) => `<tr><td>${k}</td><td>${v.total}</td><td>${v.approved}</td><td>${v.rejected}</td></tr>`).join("")
      : `<tr><td colspan="4">لا توجد بيانات</td></tr>`;
  }

  function renderTypes(rows) {
    const body = document.getElementById("typeBody");
    if (!body) return;
    const map = {};
    rows.forEach((r) => {
      const k = r.requestType || "غير محدد";
      map[k] = (map[k] || 0) + 1;
    });
    const total = rows.length || 1;
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    body.innerHTML = entries.length
      ? entries.map(([k, n]) => `<tr><td>${k}</td><td>${n}</td><td>${((n / total) * 100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="3">لا توجد بيانات</td></tr>`;
  }

  function renderTrend(rows) {
    const map = {};
    rows.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + 1;
    });
    const keys = Object.keys(map).sort().slice(-6);
    const vals = keys.map((k) => map[k]);
    drawSimpleBars("trendBar", keys.length ? keys : ["-"], vals.length ? vals : [0], ["#1f5cd2"]);
  }

  function renderStatusChart(rows) {
    const data = [
      rows.filter((r) => r.status === "Pending").length,
      rows.filter((r) => r.status === "Approved").length,
      rows.filter((r) => r.status === "Rejected").length
    ];
    drawSimpleBars("reportBar", ["قيد الانتظار", "موافق", "مرفوض"], data, ["#bc8a00", "#00a88f", "#d63649"]);
  }

  function renderAll() {
    const rows = filteredRequests();
    renderKpis(rows);
    renderStatusChart(rows);
    renderTrend(rows);
    renderDept(rows);
    renderTypes(rows);
  }

  [fromDate, toDate, statusSel, deptSearch].forEach((el) => el?.addEventListener("input", renderAll));
  [statusSel].forEach((el) => el?.addEventListener("change", renderAll));
  renderAll();
})();
