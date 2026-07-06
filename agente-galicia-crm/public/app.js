(function () {
  "use strict";

  const STATUS_META = {
    pendiente: "Pendiente",
    enviado: "Contactado",
    respondio: "Respondio",
    interesado: "Interesado",
    demo_agendada: "Demo agendada",
    no_interesado: "No interesado",
    cliente: "Cliente",
  };
  const STATUS_ORDER = Object.keys(STATUS_META);
  const OWNER_LABEL = { andre: "Andre", cristina: "Cristina" };
  const CHANNEL_LABEL = { whatsapp: "WhatsApp", email: "Email", llamada: "Llamada", otro: "Otro" };

  const $ = (s, ctx) => (ctx || document).querySelector(s);
  const view = $("#view");
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      location.href = "login.html";
      throw new Error("No autenticado");
    }
    if (!res.ok) {
      let msg = "Error " + res.status;
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  const routes = [
    { pattern: /^#\/dashboard$/, view: viewDashboard, tab: "dashboard" },
    { pattern: /^#\/contacts$/, view: viewContacts, tab: "contacts" },
    { pattern: /^#\/contacts\/new$/, view: viewNewContact, tab: "new" },
    { pattern: /^#\/contacts\/([^/]+)\/edit$/, view: viewEditContact, tab: "" },
    { pattern: /^#\/contacts\/([^/]+)$/, view: viewContactDetail, tab: "" },
  ];

  function setActiveTab(tab) {
    document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.route === tab));
  }

  async function router() {
    const hash = location.hash || "#/dashboard";
    for (const r of routes) {
      const m = hash.match(r.pattern);
      if (m) {
        setActiveTab(r.tab);
        try { await r.view(...m.slice(1)); }
        catch (e) { view.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`; }
        return;
      }
    }
    location.hash = "#/dashboard";
  }
  window.addEventListener("hashchange", router);

  async function viewDashboard() {
    view.innerHTML = `<div class="empty">Cargando...</div>`;
    const contacts = await api("GET", "/api/contacts");
    const total = contacts.length;
    const pendientes = contacts.filter((c) => c.status === "pendiente").length;
    const interesados = contacts.filter((c) => c.status === "interesado").length;
    const demos = contacts.filter((c) => c.status === "demo_agendada").length;
    const won = contacts.filter((c) => c.status === "cliente").length;
    const withAction = contacts
      .filter((c) => c.next_action)
      .sort((a, b) => (a.next_action_at || "9999").localeCompare(b.next_action_at || "9999"))
      .slice(0, 8);

    view.innerHTML = `
      <section class="hero-panel">
        <div>
          <div class="eyebrow">Trabajo comercial</div>
          <h2>${total} contactos en seguimiento</h2>
          <p>Prioriza quien necesita respuesta, quien mostro interes y cual es el siguiente paso.</p>
        </div>
        <a class="primary-link" href="#/contacts/new">+ Nuevo contacto</a>
      </section>
      <div class="kpis">
        <div class="kpi"><div class="label">Total</div><div class="value">${total}</div></div>
        <div class="kpi"><div class="label">Pendientes</div><div class="value" style="color:var(--pending)">${pendientes}</div></div>
        <div class="kpi"><div class="label">Interesados</div><div class="value" style="color:var(--won)">${interesados}</div></div>
        <div class="kpi"><div class="label">Demos</div><div class="value" style="color:var(--purple)">${demos}</div></div>
        <div class="kpi wide"><div class="label">Clientes</div><div class="value" style="color:var(--won)">${won}</div></div>
      </div>
      <div class="panel">
        <div class="section-head">
          <h2>Proximas acciones</h2>
          <a href="#/contacts">Ver todos</a>
        </div>
        <div id="nextActions"></div>
      </div>
    `;
    $("#nextActions").innerHTML = withAction.length
      ? withAction.map((c) => `
          <a class="action-card" href="#/contacts/${c.id}">
            <div>
              <strong>${escapeHtml(c.business_name)}</strong>
              <span>${escapeHtml(c.next_action)}${c.next_action_at ? " - " + escapeHtml(c.next_action_at) : ""}</span>
            </div>
            <span class="badge ${c.status}">${STATUS_META[c.status]}</span>
          </a>`).join("")
      : `<div class="empty compact">Sin acciones pendientes.</div>`;
  }

  let listFilters = { status: "", owner: "", channel: "", q: "" };

  async function viewContacts() {
    view.innerHTML = `
      <div class="filters">
        <input id="fq" placeholder="Buscar negocio, contacto, notas..." value="${escapeHtml(listFilters.q)}" />
        <select id="fstatus"><option value="">Todos los estados</option>${STATUS_ORDER.map((s) =>
          `<option value="${s}" ${listFilters.status === s ? "selected" : ""}>${STATUS_META[s]}</option>`).join("")}</select>
        <select id="fowner"><option value="">Andre / Cristina</option>
          <option value="andre" ${listFilters.owner === "andre" ? "selected" : ""}>Andre</option>
          <option value="cristina" ${listFilters.owner === "cristina" ? "selected" : ""}>Cristina</option>
        </select>
        <select id="fchannel"><option value="">Todos los canales</option>
          ${Object.entries(CHANNEL_LABEL).map(([v, l]) =>
            `<option value="${v}" ${listFilters.channel === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="list-toolbar">
        <div>
          <div class="eyebrow">Pipeline comercial</div>
          <strong id="listCount">0 contactos</strong>
        </div>
        <a class="primary-link" href="#/contacts/new">+ Anadir</a>
      </div>
      <div id="list"><div class="empty">Cargando...</div></div>
    `;

    const load = async () => {
      const params = new URLSearchParams();
      Object.entries(listFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const contacts = await api("GET", "/api/contacts?" + params.toString());
      $("#listCount").textContent = `${contacts.length} contacto${contacts.length === 1 ? "" : "s"}`;
      $("#list").innerHTML = contacts.length ? contacts.map(contactCard).join("") :
        `<div class="empty">Ningun contacto encontrado.</div>`;
    };
    $("#fq").addEventListener("input", debounce((e) => { listFilters.q = e.target.value; load(); }, 300));
    $("#fstatus").addEventListener("change", (e) => { listFilters.status = e.target.value; load(); });
    $("#fowner").addEventListener("change", (e) => { listFilters.owner = e.target.value; load(); });
    $("#fchannel").addEventListener("change", (e) => { listFilters.channel = e.target.value; load(); });
    await load();
  }

  function contactCard(c) {
    const contactBits = [c.mobile, c.email].filter(Boolean).map(escapeHtml).join(" - ");
    const next = c.next_action
      ? `${escapeHtml(c.next_action)}${c.next_action_at ? " - " + escapeHtml(c.next_action_at) : ""}`
      : "Sin proxima accion definida";
    return `
      <article class="contact-card status-${c.status}">
        <div class="top">
          <div>
            <div class="name">${escapeHtml(c.business_name)}</div>
            <div class="meta">${escapeHtml(c.sector || "Sin sector")}${c.contact_name ? " - " + escapeHtml(c.contact_name) : ""}</div>
          </div>
          <span class="badge ${c.status}">${STATUS_META[c.status]}</span>
        </div>
        <div class="contact-line">${contactBits || "Sin telefono/email guardado"}</div>
        <div class="next-line ${c.next_action ? "" : "muted"}">${next}</div>
        <div class="bottom">
          <div class="chips">
            <span class="owner-chip">${OWNER_LABEL[c.owner] || c.owner}</span>
            <span class="owner-chip">${CHANNEL_LABEL[c.channel] || c.channel}</span>
          </div>
          <div class="card-actions">
            <a href="#/contacts/${c.id}">Ver</a>
            <a href="#/contacts/${c.id}/edit">Editar</a>
          </div>
        </div>
      </article>`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  async function viewNewContact() {
    renderContactForm({ mode: "new" });
    $("#form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const created = await api("POST", "/api/contacts", collectContactForm());
        toast("Contacto anadido");
        location.hash = "#/contacts/" + created.id;
      } catch (err) { toast(err.message); }
    });
  }

  async function viewEditContact(id) {
    view.innerHTML = `<div class="empty">Cargando...</div>`;
    const c = await api("GET", `/api/contacts/${id}`);
    renderContactForm({ mode: "edit", contact: c });
    $("#form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("PATCH", `/api/contacts/${id}`, collectContactForm());
        toast("Contacto actualizado");
        location.hash = "#/contacts/" + id;
      } catch (err) { toast(err.message); }
    });
  }

  function formValue(contact, key, fallback = "") {
    return escapeHtml(contact ? contact[key] ?? fallback : fallback);
  }

  function selected(contact, key, value, fallback) {
    const current = contact ? contact[key] || fallback : fallback;
    return current === value ? "selected" : "";
  }

  function renderContactForm({ mode, contact }) {
    const isEdit = mode === "edit";
    view.innerHTML = `
      <div class="panel form-panel">
        <div class="form-head">
          <div>
            <div class="eyebrow">${isEdit ? "Editar ficha" : "Nuevo contacto"}</div>
            <h2>${isEdit ? escapeHtml(contact.business_name) : "Anadir contacto"}</h2>
          </div>
          <a class="ghost-link" href="${isEdit ? "#/contacts/" + contact.id : "#/contacts"}">Cancelar</a>
        </div>
        <form id="form">
          <label class="field"><span>Nombre del negocio *</span><input id="business_name" required value="${formValue(contact, "business_name")}" /></label>
          <div class="row2">
            <label class="field"><span>Sector</span><input id="sector" placeholder="Ej.: dental, restauracion..." value="${formValue(contact, "sector")}" /></label>
            <label class="field"><span>Responsable</span>
              <select id="owner">
                <option value="andre" ${selected(contact, "owner", "andre", "andre")}>Andre</option>
                <option value="cristina" ${selected(contact, "owner", "cristina", "andre")}>Cristina</option>
              </select>
            </label>
          </div>
          <div class="row2">
            <label class="field"><span>Movil</span><input id="mobile" value="${formValue(contact, "mobile")}" /></label>
            <label class="field"><span>Email</span><input id="email" type="email" value="${formValue(contact, "email")}" /></label>
          </div>
          <div class="row2">
            <label class="field"><span>Canal preferido</span>
              <select id="channel">
                ${Object.entries(CHANNEL_LABEL).map(([v, l]) => `<option value="${v}" ${selected(contact, "channel", v, "whatsapp")}>${l}</option>`).join("")}
              </select>
            </label>
            <label class="field"><span>Estado</span>
              <select id="status">
                ${STATUS_ORDER.map((s) => `<option value="${s}" ${selected(contact, "status", s, "pendiente")}>${STATUS_META[s]}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="row2">
            <label class="field"><span>Nombre de contacto</span><input id="contact_name" value="${formValue(contact, "contact_name")}" /></label>
            <label class="field"><span>Fuente</span><input id="source" placeholder="Google Maps, recomendacion..." value="${formValue(contact, "source")}" /></label>
          </div>
          <label class="field"><span>URL de fuente</span><input id="source_url" value="${formValue(contact, "source_url")}" /></label>
          <div class="row2">
            <label class="field"><span>Proxima accion</span><input id="next_action" value="${formValue(contact, "next_action")}" /></label>
            <label class="field"><span>Fecha</span><input id="next_action_at" type="date" value="${formValue(contact, "next_action_at")}" /></label>
          </div>
          <label class="field"><span>Mensaje preparado</span><textarea id="last_message">${formValue(contact, "last_message")}</textarea></label>
          <label class="field"><span>Notas</span><textarea id="notes">${formValue(contact, "notes")}</textarea></label>
          <button type="submit" class="block">${isEdit ? "Guardar cambios" : "Guardar contacto"}</button>
        </form>
      </div>
    `;
  }

  function collectContactForm() {
    return {
      business_name: $("#business_name").value,
      sector: $("#sector").value,
      owner: $("#owner").value,
      mobile: $("#mobile").value,
      email: $("#email").value,
      channel: $("#channel").value,
      status: $("#status").value,
      contact_name: $("#contact_name").value,
      source: $("#source").value,
      source_url: $("#source_url").value,
      next_action: $("#next_action").value,
      next_action_at: $("#next_action_at").value,
      last_message: $("#last_message").value,
      notes: $("#notes").value,
    };
  }

  async function viewContactDetail(id) {
    view.innerHTML = `<div class="empty">Cargando...</div>`;
    const [c, interactions] = await Promise.all([
      api("GET", `/api/contacts/${id}`),
      api("GET", `/api/contacts/${id}/interactions`),
    ]);
    view.innerHTML = `
      <div class="panel">
        <div class="detail-head">
          <div>
            <div class="eyebrow">Ficha comercial</div>
            <h2>${escapeHtml(c.business_name)}</h2>
            <div class="meta">${escapeHtml(c.sector || "Sin sector")}${c.contact_name ? " - " + escapeHtml(c.contact_name) : ""}</div>
          </div>
          <div class="detail-actions">
            <span class="owner-chip">${OWNER_LABEL[c.owner] || c.owner}</span>
            <a class="ghost-link" href="#/contacts/${c.id}/edit">Editar</a>
          </div>
        </div>
        <div class="contact-line">${escapeHtml(c.mobile || "")}${c.email ? " - " + escapeHtml(c.email) : ""}</div>
      </div>

      <div class="panel">
        <h2>Estado</h2>
        <div class="status-grid" id="statusGrid">
          ${STATUS_ORDER.map((s) =>
            `<button type="button" class="status-btn ${s} ${s === c.status ? "current" : ""}" data-status="${s}">${STATUS_META[s]}</button>`
          ).join("")}
        </div>
      </div>

      <div class="panel">
        <h2>Proxima accion</h2>
        <form id="nextForm">
          <label class="field"><span>Que hacer</span><input id="next_action" value="${escapeHtml(c.next_action)}" /></label>
          <label class="field"><span>Cuando</span><input id="next_action_at" type="date" value="${escapeHtml(c.next_action_at)}" /></label>
          <button type="submit" class="ghost">Guardar proxima accion</button>
        </form>
      </div>

      <div class="panel">
        <h2>Mensaje para WhatsApp</h2>
        <div class="copy-row">
          <textarea id="lastMessage">${escapeHtml(c.last_message)}</textarea>
          <button type="button" id="copyBtn">Copiar</button>
        </div>
      </div>

      <div class="panel">
        <h2>Registrar interaccion</h2>
        <form id="interactionForm">
          <div class="row2">
            <label class="field"><span>Direccion</span>
              <select id="direction"><option value="outbound">Enviado</option><option value="inbound">Recibido</option></select>
            </label>
            <label class="field"><span>Canal</span>
              <select id="i_channel">
                <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="llamada">Llamada</option>
              </select>
            </label>
          </div>
          <label class="field"><span>Mensaje</span><textarea id="message"></textarea></label>
          <label class="field"><span>Resultado</span><input id="outcome" placeholder="Ej.: sin respuesta, interesado..." /></label>
          <button type="submit" class="block">Anadir al historial</button>
        </form>
      </div>

      <div class="panel">
        <h2>Historial</h2>
        <div id="history">${renderHistory(interactions)}</div>
      </div>

      <label class="field standalone"><span>Notas rapidas</span><textarea id="notes">${escapeHtml(c.notes)}</textarea></label>
      <button type="button" id="saveNotes" class="ghost block">Guardar notas</button>
    `;

    $("#statusGrid").addEventListener("click", async (e) => {
      const btn = e.target.closest(".status-btn");
      if (!btn) return;
      try {
        await api("PATCH", `/api/contacts/${id}`, { status: btn.dataset.status });
        toast("Estado actualizado");
        viewContactDetail(id);
      } catch (err) { toast(err.message); }
    });

    $("#nextForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("PATCH", `/api/contacts/${id}`, {
          next_action: $("#next_action").value,
          next_action_at: $("#next_action_at").value,
        });
        toast("Proxima accion guardada");
      } catch (err) { toast(err.message); }
    });

    $("#copyBtn").addEventListener("click", async () => {
      await copyToClipboard($("#lastMessage").value);
      toast("Mensaje copiado");
    });

    $("#saveNotes").addEventListener("click", async () => {
      try {
        await api("PATCH", `/api/contacts/${id}`, { notes: $("#notes").value });
        toast("Notas guardadas");
      } catch (err) { toast(err.message); }
    });

    $("#interactionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("POST", `/api/contacts/${id}/interactions`, {
          direction: $("#direction").value,
          channel: $("#i_channel").value,
          message: $("#message").value,
          outcome: $("#outcome").value,
        });
        toast("Interaccion registrada");
        viewContactDetail(id);
      } catch (err) { toast(err.message); }
    });
  }

  function renderHistory(items) {
    if (!items.length) return `<div class="empty compact">Sin interacciones todavia.</div>`;
    return items.map((i) => `
      <div class="interaction ${i.direction}">
        <div class="head">
          <span>${i.direction === "outbound" ? "Enviado" : "Recibido"}</span>
          <span>${CHANNEL_LABEL[i.channel] || i.channel}</span>
          <span>${escapeHtml((i.created_at || "").slice(0, 16).replace("T", " "))}</span>
        </div>
        ${i.message ? `<div class="msg">${escapeHtml(i.message)}</div>` : ""}
        ${i.outcome ? `<div class="hint">Resultado: ${escapeHtml(i.outcome)}</div>` : ""}
      </div>
    `).join("");
  }

  async function boot() {
    try {
      const me = await api("GET", "/api/me");
      $("#whoami").textContent = OWNER_LABEL[me.username] || me.username;
    } catch (e) { return; }
    $("#logout").addEventListener("click", async () => {
      await api("POST", "/api/logout");
      location.href = "login.html";
    });
    router();
  }
  boot();
})();
