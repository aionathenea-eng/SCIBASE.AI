(function () {
  "use strict";

  const STATUS_META = {
    pendiente: "Pendiente",
    enviado: "Contactado",
    respondio: "Respondió",
    interesado: "Interesado",
    demo_agendada: "Demo agendada",
    no_interesado: "No interesado",
    cliente: "Cliente",
  };
  const STATUS_ORDER = Object.keys(STATUS_META);
  const OWNER_LABEL = { andre: "André", cristina: "Cristina" };
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
    if (res.status === 401) { location.href = "login.html"; throw new Error("Não autenticado"); }
    if (!res.ok) {
      let msg = "Erro " + res.status;
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
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  // --- Router ---
  const routes = [
    { pattern: /^#\/dashboard$/, view: viewDashboard, tab: "dashboard" },
    { pattern: /^#\/contacts$/, view: viewContacts, tab: "contacts" },
    { pattern: /^#\/contacts\/new$/, view: viewNewContact, tab: "new" },
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
        catch (e) { view.innerHTML = `<div class="empty">Erro: ${escapeHtml(e.message)}</div>`; }
        return;
      }
    }
    location.hash = "#/dashboard";
  }
  window.addEventListener("hashchange", router);

  // --- Dashboard ---
  async function viewDashboard() {
    view.innerHTML = `<div class="empty">A carregar…</div>`;
    const contacts = await api("GET", "/api/contacts");
    const total = contacts.length;
    const pendientes = contacts.filter((c) => c.status === "pendiente").length;
    const interesados = contacts.filter((c) => c.status === "interesado").length;
    const demos = contacts.filter((c) => c.status === "demo_agendada").length;
    view.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="label">Total contactos</div><div class="value">${total}</div></div>
        <div class="kpi"><div class="label">Pendientes</div><div class="value" style="color:var(--pending)">${pendientes}</div></div>
        <div class="kpi"><div class="label">Interesados</div><div class="value" style="color:var(--won)">${interesados}</div></div>
        <div class="kpi"><div class="label">Demo agendada</div><div class="value" style="color:var(--purple)">${demos}</div></div>
      </div>
      <div class="panel">
        <h2>Próximas acciones</h2>
        <div id="nextActions"></div>
      </div>
    `;
    const withAction = contacts
      .filter((c) => c.next_action)
      .sort((a, b) => (a.next_action_at || "").localeCompare(b.next_action_at || ""))
      .slice(0, 8);
    $("#nextActions").innerHTML = withAction.length
      ? withAction.map((c) => `
          <a class="contact-card" href="#/contacts/${c.id}">
            <div class="top">
              <div class="name">${escapeHtml(c.business_name)}</div>
              <span class="badge ${c.status}">${STATUS_META[c.status]}</span>
            </div>
            <div class="meta">${escapeHtml(c.next_action)}${c.next_action_at ? " · " + escapeHtml(c.next_action_at) : ""}</div>
          </a>`).join("")
      : `<div class="empty">Sem ações pendentes.</div>`;
  }

  // --- Lista de contactos ---
  let listFilters = { status: "", owner: "", channel: "", q: "" };

  async function viewContacts() {
    view.innerHTML = `
      <div class="filters">
        <input id="fq" placeholder="Buscar negocio, contacto, notas…" value="${escapeHtml(listFilters.q)}" />
        <select id="fstatus"><option value="">Todos los estados</option>${STATUS_ORDER.map((s) =>
          `<option value="${s}" ${listFilters.status === s ? "selected" : ""}>${STATUS_META[s]}</option>`).join("")}</select>
        <select id="fowner"><option value="">André / Cristina</option>
          <option value="andre" ${listFilters.owner === "andre" ? "selected" : ""}>André</option>
          <option value="cristina" ${listFilters.owner === "cristina" ? "selected" : ""}>Cristina</option>
        </select>
        <select id="fchannel"><option value="">Todos los canales</option>
          ${Object.entries(CHANNEL_LABEL).map(([v, l]) =>
            `<option value="${v}" ${listFilters.channel === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div id="list"><div class="empty">A carregar…</div></div>
    `;
    const load = async () => {
      const params = new URLSearchParams();
      Object.entries(listFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const contacts = await api("GET", "/api/contacts?" + params.toString());
      $("#list").innerHTML = contacts.length ? contacts.map(contactCard).join("") :
        `<div class="empty">Nenhum contacto encontrado.</div>`;
    };
    $("#fq").addEventListener("input", debounce((e) => { listFilters.q = e.target.value; load(); }, 300));
    $("#fstatus").addEventListener("change", (e) => { listFilters.status = e.target.value; load(); });
    $("#fowner").addEventListener("change", (e) => { listFilters.owner = e.target.value; load(); });
    $("#fchannel").addEventListener("change", (e) => { listFilters.channel = e.target.value; load(); });
    await load();
  }

  function contactCard(c) {
    return `
      <a class="contact-card" href="#/contacts/${c.id}">
        <div class="top">
          <div>
            <div class="name">${escapeHtml(c.business_name)}</div>
            <div class="meta">${escapeHtml(c.sector || "")}${c.contact_name ? " · " + escapeHtml(c.contact_name) : ""}</div>
          </div>
          <span class="badge ${c.status}">${STATUS_META[c.status]}</span>
        </div>
        <div class="bottom">
          <span class="owner-chip">${OWNER_LABEL[c.owner] || c.owner}</span>
          <span class="owner-chip">${CHANNEL_LABEL[c.channel] || c.channel}</span>
        </div>
      </a>`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // --- Añadir contacto ---
  async function viewNewContact() {
    view.innerHTML = `
      <div class="panel">
        <h2>Añadir contacto</h2>
        <form id="form">
          <label class="field"><span>Nombre del negocio *</span><input id="business_name" required /></label>
          <div class="row2">
            <label class="field"><span>Sector</span><input id="sector" placeholder="Ej.: dental, restauración…" /></label>
            <label class="field"><span>Responsable</span>
              <select id="owner"><option value="andre">André</option><option value="cristina">Cristina</option></select>
            </label>
          </div>
          <div class="row2">
            <label class="field"><span>Móvil</span><input id="mobile" /></label>
            <label class="field"><span>Email</span><input id="email" type="email" /></label>
          </div>
          <div class="row2">
            <label class="field"><span>Canal</span>
              <select id="channel">
                <option value="whatsapp">WhatsApp</option><option value="email">Email</option>
                <option value="llamada">Llamada</option><option value="otro">Otro</option>
              </select>
            </label>
            <label class="field"><span>Nombre de contacto</span><input id="contact_name" /></label>
          </div>
          <label class="field"><span>Notas</span><textarea id="notes"></textarea></label>
          <button type="submit" class="block">Guardar contacto</button>
        </form>
      </div>
    `;
    $("#form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const created = await api("POST", "/api/contacts", {
          business_name: $("#business_name").value,
          sector: $("#sector").value,
          owner: $("#owner").value,
          mobile: $("#mobile").value,
          email: $("#email").value,
          channel: $("#channel").value,
          contact_name: $("#contact_name").value,
          notes: $("#notes").value,
        });
        toast("Contacto añadido");
        location.hash = "#/contacts/" + created.id;
      } catch (err) { toast(err.message); }
    });
  }

  // --- Detalle de contacto ---
  async function viewContactDetail(id) {
    view.innerHTML = `<div class="empty">A carregar…</div>`;
    const [c, interactions] = await Promise.all([
      api("GET", `/api/contacts/${id}`),
      api("GET", `/api/contacts/${id}/interactions`),
    ]);
    view.innerHTML = `
      <div class="panel">
        <div class="top" style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <h2 style="margin-bottom:2px">${escapeHtml(c.business_name)}</h2>
            <div class="meta" style="color:var(--muted);font-size:13px">
              ${escapeHtml(c.sector || "")}${c.contact_name ? " · " + escapeHtml(c.contact_name) : ""}
            </div>
          </div>
          <span class="owner-chip">${OWNER_LABEL[c.owner] || c.owner}</span>
        </div>
        <div class="hint">${escapeHtml(c.mobile || "")} ${c.email ? " · " + escapeHtml(c.email) : ""}</div>
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
        <h2>Próxima acción</h2>
        <form id="nextForm">
          <label class="field"><span>Qué hacer</span><input id="next_action" value="${escapeHtml(c.next_action)}" /></label>
          <label class="field"><span>Cuándo</span><input id="next_action_at" type="date" value="${escapeHtml(c.next_action_at)}" /></label>
          <button type="submit" class="ghost">Guardar próxima acción</button>
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
        <h2>Registrar interacción</h2>
        <form id="interactionForm">
          <div class="row2">
            <label class="field"><span>Dirección</span>
              <select id="direction"><option value="outbound">Enviado</option><option value="inbound">Recibido</option></select>
            </label>
            <label class="field"><span>Canal</span>
              <select id="i_channel">
                <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="llamada">Llamada</option>
              </select>
            </label>
          </div>
          <label class="field"><span>Mensaje</span><textarea id="message"></textarea></label>
          <label class="field"><span>Resultado</span><input id="outcome" placeholder="Ej.: sin respuesta, interesado…" /></label>
          <button type="submit" class="block">Añadir al historial</button>
        </form>
      </div>

      <div class="panel">
        <h2>Historial</h2>
        <div id="history">${renderHistory(interactions)}</div>
      </div>

      <label class="field"><span>Notas</span><textarea id="notes">${escapeHtml(c.notes)}</textarea></label>
      <button type="button" id="saveNotes" class="ghost">Guardar notas</button>
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
        toast("Próxima acción guardada");
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
        toast("Interacción registrada");
        viewContactDetail(id);
      } catch (err) { toast(err.message); }
    });
  }

  function renderHistory(items) {
    if (!items.length) return `<div class="empty">Sin interacciones todavía.</div>`;
    return items.map((i) => `
      <div class="interaction ${i.direction}">
        <div class="head">
          <span>${i.direction === "outbound" ? "→ Enviado" : "← Recibido"}</span>
          <span>${CHANNEL_LABEL[i.channel] || i.channel}</span>
          <span>${escapeHtml((i.created_at || "").slice(0, 16).replace("T", " "))}</span>
        </div>
        ${i.message ? `<div class="msg">${escapeHtml(i.message)}</div>` : ""}
        ${i.outcome ? `<div class="hint">Resultado: ${escapeHtml(i.outcome)}</div>` : ""}
      </div>
    `).join("");
  }

  // --- Boot ---
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
