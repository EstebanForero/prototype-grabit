const views = ["board", "mail", "product"];

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.view));
});

function show(name) {
  for (const view of views) {
    document.querySelector(`#${view}`).hidden = view !== name;
  }
  document.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  if (name === "board") loadBoard();
  if (name === "mail") loadMailbox();
}

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "La solicitud falló.");
  return body;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function loadBoard() {
  const rows = await api("/api/seguimiento");
  const attention = rows.filter((row) => row.alerts.length || row.held).length;
  document.querySelector("#metrics").innerHTML = [
    ["Productos", rows.length],
    ["Con alerta o retención", attention],
    ["Al día", rows.length - attention],
  ].map(([label, value]) => `<article class="metric"><strong>${value}</strong><span>${label}</span></article>`).join("");
  document.querySelector("#rows").innerHTML = rows.length
    ? rows.map(renderRow).join("")
    : `<article class="card"><div><strong>Todavía no hay productos.</strong><div class="muted">Registra una compra o carga los correos de ejemplo.</div></div></article>`;
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openDossier(button.dataset.open));
  });
}

function renderRow(row) {
  const alerts = row.alerts.map((alert) => `<span class="tag alert">${escapeHtml(alert.kind)}</span>`).join(" ");
  const held = row.held ? `<span class="tag hold">retenido</span>` : `<span class="tag">${escapeHtml(row.clientLabel)}</span>`;
  return `<article class="card">
    <div><strong>${escapeHtml(row.productId)}</strong><div class="muted">${escapeHtml(row.statusLabel)} · día ${row.daysInStatus}</div></div>
    <div>${held}</div>
    <div>${alerts || `<span class="muted">${escapeHtml(row.holdReason || "Sin alertas")}</span>`}</div>
    <button type="button" data-open="${escapeHtml(row.productId)}">Ficha</button>
  </article>`;
}

async function openDossier(id) {
  const dossier = await api(`/api/productos/${encodeURIComponent(id)}`);
  const legs = dossier.shipments.map((shipment) => `<div class="leg"><strong>${escapeHtml(shipment.trackingNumber || shipment.contactName || shipment.id)}</strong>
    <div class="muted">${escapeHtml(shipment.destination)} · ${escapeHtml(shipment.mode)} · ${escapeHtml(shipment.recordStatus)} · entró por ${escapeHtml(shipment.intake)}</div></div>`).join("");
  const decisions = dossier.decisions.map((decision) => `<div class="leg"><strong>${escapeHtml(decision.outcome)} ${escapeHtml(decision.status)}</strong><div class="muted">${escapeHtml(decision.reason)}</div></div>`).join("");
  const box = document.querySelector("#dossier");
  box.hidden = false;
  box.innerHTML = `<h3>${escapeHtml(dossier.product.id)}</h3>
    <p>Estado interno: ${escapeHtml(dossier.product.status)}. El cliente ve <strong>${escapeHtml(dossier.clientLabel)}</strong>.</p>
    <div class="timeline">${legs || "<p>Sin envíos.</p>"}</div>
    <h3>Decisiones</h3>
    <div class="timeline">${decisions || "<p>Todavía no hay una decisión.</p>"}</div>`;
}

async function loadMailbox() {
  const config = await api("/api/correo");
  const form = document.querySelector("#mail-form");
  if (config.configured) {
    form.host.value = config.host;
    form.user.value = config.user;
    form.mailbox.value = config.mailbox;
    document.querySelector("#mail-status").textContent = `Buzón guardado para ${config.user}. La clave no se muestra.`;
  }
}

document.querySelector("#mail-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#mail-status");
  status.textContent = "Probando la conexión…";
  try {
    await api("/api/correo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(formData(form)) });
    const result = await api("/api/correo/probar", { method: "POST" });
    status.textContent = `Conexión correcta con ${result.user}. Ya se puede escanear.`;
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#scan").addEventListener("click", async () => {
  const form = document.querySelector("#mail-form");
  const status = document.querySelector("#mail-status");
  status.textContent = "Leyendo el buzón…";
  try {
    const data = formData(form);
    if (data.password) await api("/api/correo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const report = await api("/api/correo/escanear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sinceDays: Number(form.sinceDays.value || 21) }),
    });
    status.textContent = `${report.examined} mensajes. ${report.created} guías asociadas, ${report.unmatched} sin producto, ${report.ignored} no eran despachos.`;
    renderScan(report);
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#samples").addEventListener("click", async () => {
  const report = await api("/api/correo/ejemplos", { method: "POST" });
  document.querySelector("#mail-status").textContent = `Ejemplos locales: ${report.created} asociadas, ${report.unmatched} sin producto.`;
  renderScan(report);
});

function renderScan(report) {
  document.querySelector("#scan-results").innerHTML = report.items.map((item) => `<article class="card scan-item">
    <div><strong>${escapeHtml(item.outcome)}</strong><div class="muted">${escapeHtml(item.subject || item.from || "")}</div></div>
    <div></div>
    <div>${escapeHtml(item.detail)}</div>
    <div>${item.outcome === "sin-producto" ? `<button type="button" data-link="${escapeHtml(JSON.stringify(item.parsed))}">Vincular</button>` : ""}</div>
  </article>`).join("");
  document.querySelectorAll("[data-link]").forEach((button) => {
    button.addEventListener("click", () => linkParsed(JSON.parse(button.dataset.link)));
  });
}

async function linkParsed(parsed) {
  const city = window.prompt("Ciudad del cliente", "Bogotá");
  if (!city) return;
  const mode = window.confirm("¿La compra es nacional? Aceptar = nacional. Cancelar = internacional.") ? "national" : "international";
  await api("/api/correo/vincular", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...parsed, customerCountry: "CO", customerCity: city, mode }),
  });
  document.querySelector("#mail-status").textContent = `Pedido ${parsed.storeOrderNumber} vinculado.`;
  show("board");
}

document.querySelector("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#product-status");
  try {
    const product = await api("/api/productos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formData(event.currentTarget)),
    });
    status.textContent = `Producto ${product.id} en ${product.status}. El correo con ese pedido ya puede asociar la guía.`;
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#refresh").addEventListener("click", loadBoard);

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

loadBoard();
