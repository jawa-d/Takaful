(function () {
  const fromDate = document.getElementById("fromDate");
  const toDate = document.getElementById("toDate");
  const statusSel = document.getElementById("statusSel");
  const deptSearch = document.getElementById("deptSearch");

  const AR = {
    totalRequests: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
    pending: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631",
    approved: "\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064a\u0647",
    rejected: "\u0645\u0631\u0641\u0648\u0636",
    totalApprovedUsd: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0639\u062a\u0645\u062f USD",
    totalApprovedIqd: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0639\u062a\u0645\u062f IQD",
    noData: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a",
    unspecified: "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f",
    total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
    requestsWord: "\u0637\u0644\u0628"
  };

  function formatAmount(amount, currency) {
    const n = Number(amount || 0);
    if (currency === "IQD") return `${n.toLocaleString("ar-IQ")} \u062f.\u0639`;
    return `$${n.toLocaleString("en-US")}`;
  }

  function filteredRequests() {
    let rows = IRS.getRequests();
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
      <article class="report-kpi"><div class="label">${AR.totalRequests}</div><div class="value">${rows.length}</div></article>
      <article class="report-kpi"><div class="label">${AR.pending}</div><div class="value">${rows.filter((r) => r.status === "Pending").length}</div></article>
      <article class="report-kpi"><div class="label">${AR.approved}</div><div class="value">${approved.length}</div></article>
      <article class="report-kpi"><div class="label">${AR.rejected}</div><div class="value">${rows.filter((r) => r.status === "Rejected").length}</div></article>
      <article class="report-kpi"><div class="label">${AR.totalApprovedUsd}</div><div class="value">${formatAmount(usd, "USD")}</div></article>
      <article class="report-kpi"><div class="label">${AR.totalApprovedIqd}</div><div class="value">${formatAmount(iqd, "IQD")}</div></article>
    `;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawEmptyState(ctx, w, h, text) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#8a99b2";
    ctx.font = "700 18px Cairo";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2);
  }

  function drawTrendLine(canvasId, labels, values) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;

    if (!values.length || values.every((v) => v === 0)) {
      drawEmptyState(ctx, w, h, AR.noData);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const pad = { top: 22, right: 16, bottom: 42, left: 34 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const max = Math.max(...values, 1);

    ctx.strokeStyle = "#e2eaf8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (ch * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    const step = values.length > 1 ? cw / (values.length - 1) : 0;
    const points = values.map((v, i) => ({
      x: pad.left + i * step,
      y: pad.top + ch - (v / max) * ch,
      v
    }));

    const renderFrame = (progress) => {
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "#e2eaf8";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const y = pad.top + (ch * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
      }

      if (points.length > 1) {
        const grad = ctx.createLinearGradient(pad.left, pad.top, w - pad.right, h - pad.bottom);
        grad.addColorStop(0, "#2f73de");
        grad.addColorStop(1, "#0f4ec7");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        points.forEach((p, i) => {
          const x = points[0].x + (p.x - points[0].x) * progress;
          const y = points[0].y + (p.y - points[0].y) * progress;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      points.forEach((p, i) => {
        const x = points[0].x + (p.x - points[0].x) * progress;
        const y = points[0].y + (p.y - points[0].y) * progress;
        ctx.beginPath();
        ctx.fillStyle = "#0f4ec7";
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#29405f";
        ctx.font = "600 11px Cairo";
        ctx.textAlign = "center";
        ctx.fillText(String(p.v), x, y - 9);

        ctx.fillStyle = "#5f708d";
        ctx.font = "600 10px Cairo";
        ctx.fillText(labels[i], p.x, h - 16);
      });
    };

    const start = performance.now();
    const duration = 380;
    const animate = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      renderFrame(eased);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  function drawStatusDonut(canvasId, labels, values, colors) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;
    const total = values.reduce((s, v) => s + v, 0);

    if (!total) {
      drawEmptyState(ctx, w, h, AR.noData);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const cx = Math.round(w * 0.35);
    const cy = Math.round(h * 0.52);
    const radius = Math.min(w, h) * 0.28;
    const ring = radius * 0.34;

    let start = -Math.PI / 2;
    values.forEach((v, i) => {
      const angle = (v / total) * Math.PI * 2;
      const end = start + angle;

      ctx.beginPath();
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = ring;
      ctx.lineCap = "round";
      ctx.arc(cx, cy, radius, start, end);
      ctx.stroke();
      start = end + 0.01;
    });

    ctx.fillStyle = "#1b2f4c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 24px Cairo";
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = "#7083a2";
    ctx.font = "600 12px Cairo";
    ctx.fillText(AR.requestsWord, cx, cy + 16);

    const lx = Math.round(w * 0.66);
    const ly = Math.round(h * 0.3);
    const rowH = 42;

    labels.forEach((label, i) => {
      const y = ly + i * rowH;
      const pct = total ? ((values[i] / total) * 100).toFixed(0) : "0";

      ctx.fillStyle = colors[i];
      roundRect(ctx, lx - 16, y - 8, 10, 10, 3);
      ctx.fill();

      ctx.fillStyle = "#243a59";
      ctx.font = "700 13px Cairo";
      ctx.textAlign = "right";
      ctx.fillText(label, w - 16, y);

      ctx.fillStyle = "#6b7d98";
      ctx.font = "600 12px Cairo";
      ctx.fillText(`${values[i]} (${pct}%)`, w - 16, y + 14);
    });
  }

  function renderDept(rows) {
    const body = document.getElementById("deptBody");
    if (!body) return;

    const map = {};
    rows.forEach((r) => {
      const k = r.department || AR.unspecified;
      if (!map[k]) map[k] = { total: 0, approved: 0, rejected: 0 };
      map[k].total += 1;
      if (r.status === "Approved") map[k].approved += 1;
      if (r.status === "Rejected") map[k].rejected += 1;
    });

    const entries = Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    body.innerHTML = entries.length
      ? entries.map(([k, v]) => `<tr><td>${k}</td><td>${v.total}</td><td>${v.approved}</td><td>${v.rejected}</td></tr>`).join("")
      : `<tr><td colspan="4">${AR.noData}</td></tr>`;
  }

  function renderTypes(rows) {
    const body = document.getElementById("typeBody");
    if (!body) return;

    const map = {};
    rows.forEach((r) => {
      const k = r.requestType || AR.unspecified;
      map[k] = (map[k] || 0) + 1;
    });

    const total = rows.length || 1;
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    body.innerHTML = entries.length
      ? entries.map(([k, n]) => `<tr><td>${k}</td><td>${n}</td><td>${((n / total) * 100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="3">${AR.noData}</td></tr>`;
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
    drawTrendLine("trendBar", keys.length ? keys : ["-"], vals.length ? vals : [0]);
  }

  function renderStatusChart(rows) {
    const labels = [AR.pending, AR.approved, AR.rejected];
    const values = [
      rows.filter((r) => r.status === "Pending").length,
      rows.filter((r) => r.status === "Approved").length,
      rows.filter((r) => r.status === "Rejected").length
    ];
    drawStatusDonut("reportBar", labels, values, ["#d09a11", "#10a37f", "#db3d52"]);
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
