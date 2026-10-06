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

let watchTimer = null;

async function loadMailbox() {
  const config = await api("/api/correo");
  const form = document.querySelector("#mail-form");
  if (config.configured) {
    form.host.value = config.host;
    form.port.value = config.port || 993;
    form.user.value = config.user;
    form.mailbox.value = config.mailbox;
    document.querySelector("#mail-status").textContent = watchTimer
      ? `Vigilando ${config.user}. La clave no se muestra.`
      : `Buzón guardado para ${config.user}. La clave no se muestra.`;
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

async function readInbox() {
  const form = document.querySelector("#mail-form");
  const data = formData(form);
  if (data.password) await api("/api/correo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  return api("/api/correo/escanear", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sinceDays: Number(form.sinceDays.value || 21) }),
  });
}

function reportLine(report) {
  return `${report.examined} mensajes. ${report.created} guías nuevas, ${report.already} ya estaban, ${report.unmatched} sin producto, ${report.ignored} no eran despachos.`;
}

document.querySelector("#scan").addEventListener("click", async () => {
  const status = document.querySelector("#mail-status");
  status.textContent = "Leyendo el buzón…";
  try {
    const report = await readInbox();
    status.textContent = reportLine(report);
    renderArrivals(report.items, true);
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#watch").addEventListener("click", async () => {
  const button = document.querySelector("#watch");
  const status = document.querySelector("#mail-status");
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
    button.textContent = "Vigilar buzón";
    status.textContent = "Vigilancia detenida. La clave sigue en el servidor.";
    return;
  }
  button.textContent = "Detener vigilancia";
  const tick = async () => {
    try {
      const report = await readInbox();
      status.textContent = `Vigilando cada 45 s. ${reportLine(report)} La clave no se muestra.`;
      renderArrivals(report.items, false);
    } catch (error) {
      status.textContent = error.message;
    }
  };
  await tick();
  watchTimer = setInterval(tick, 45_000);
});

document.querySelector("#samples").addEventListener("click", async () => {
  const button = document.querySelector("#samples");
  button.disabled = true;
  try {
    const report = await api("/api/correo/ejemplos", { method: "POST" });
    document.querySelector("#arrivals").innerHTML = "";
    for (const item of report.items) {
      prependArrival(item, true);
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    document.querySelector("#mail-status").textContent = `Llegadas de ejemplo: ${report.created} nuevas, ${report.already} ya estaban, ${report.unmatched} sin producto.`;
  } catch (error) {
    document.querySelector("#mail-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

const outcomeLabel = {
  creado: "asociada",
  "ya-estaba": "ya estaba",
  "sin-producto": "sin producto",
  ignorado: "no es despacho",
};

function arrivalKey(item) {
  return [item.from, item.subject, item.parsed?.trackingNumber || item.detail].join("|");
}

function renderArrivals(items, replace) {
  const box = document.querySelector("#arrivals");
  if (replace) box.innerHTML = "";
  const known = new Set([...box.querySelectorAll("[data-key]")].map((node) => node.dataset.key));
  for (const item of items) {
    const key = arrivalKey(item);
    const previous = [...box.querySelectorAll("[data-key]")].find((node) => node.dataset.key === key);
    if (previous) previous.remove();
    prependArrival(item, !known.has(key) && !replace);
  }
}

function prependArrival(item, isNew) {
  const box = document.querySelector("#arrivals");
  const read = item.parsed
    ? `${item.parsed.store} · pedido ${item.parsed.storeOrderNumber} · guía ${item.parsed.trackingNumber}`
    : item.detail;
  const product = item.outcome === "creado"
    ? "El pedido ya estaba. La guía entra al producto."
    : item.outcome === "ya-estaba"
      ? "Esa guía ya estaba registrada. No se duplica."
      : item.outcome === "sin-producto"
        ? "Ningún producto tiene ese pedido."
        : "No se crea un envío.";
  const tone = [item.from ? "done" : "wait", item.parsed ? "done" : "bad", item.outcome === "creado" || item.outcome === "ya-estaba" ? "done" : item.outcome === "sin-producto" ? "wait" : "bad"];
  const article = document.createElement("article");
  article.className = `card arrival${isNew ? " new" : ""}`;
  article.dataset.key = arrivalKey(item);
  article.innerHTML = `<header><strong>${escapeHtml(item.subject || item.from || "Mensaje")}</strong><span class="tag ${item.outcome === "sin-producto" ? "hold" : item.outcome === "ignorado" ? "alert" : ""}">${outcomeLabel[item.outcome]}</span></header>
    <ol class="pipe">
      <li class="${tone[0]}"><strong>1. Llegó</strong><span>${escapeHtml(item.from || "sin remitente")}</span></li>
      <li class="${tone[1]}"><strong>2. Lectura</strong><span>${escapeHtml(read)}</span></li>
      <li class="${tone[2]}"><strong>3. Producto</strong><span>${escapeHtml(product)}</span></li>
    </ol>
    <p class="muted">${escapeHtml(item.detail)}</p>
    ${item.outcome === "sin-producto" ? `<button type="button">Vincular</button>` : ""}`;
  const link = article.querySelector("button");
  if (link) link.addEventListener("click", () => linkParsed(item.parsed));
  box.prepend(article);
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
