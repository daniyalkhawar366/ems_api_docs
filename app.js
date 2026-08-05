const PASS_HASH =
  "f809fd9e5c54b9afa54a932625182cd06ff4bd26134d4b246960eae58219feb8";
const AUTH_KEY = "ems_docs_auth_v1";
const SITE_NAME = "EMS APIs Tecnext";

const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gate-form");
const gateError = document.getElementById("gate-error");
const gateInput = document.getElementById("gate-password");

let spyObserver = null;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function unlock() {
  gate.hidden = true;
  app.hidden = false;
  document.body.classList.remove("locked");
  render();
}

function lock() {
  sessionStorage.removeItem(AUTH_KEY);
  gate.hidden = false;
  app.hidden = true;
  document.body.classList.add("locked");
  gateInput.value = "";
  gateError.textContent = "";
  if (spyObserver) {
    spyObserver.disconnect();
    spyObserver = null;
  }
}

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const hash = await sha256Hex(gateInput.value);
  if (hash === PASS_HASH) {
    sessionStorage.setItem(AUTH_KEY, "1");
    unlock();
  } else {
    gateError.textContent = "Incorrect password.";
  }
});

document.getElementById("logout-btn")?.addEventListener("click", lock);

if (sessionStorage.getItem(AUTH_KEY) === "1") {
  unlock();
} else {
  document.body.classList.add("locked");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function methodClass(m) {
  return (m || "").toUpperCase() === "POST" ? "post" : "";
}

function reqBadge(p) {
  if (p.disabled) return '<span class="badge off">off</span>';
  if (p.required === true) return '<span class="badge req">required</span>';
  if (p.required === false) return '<span class="badge opt">optional</span>';
  return "";
}

function paramsTable(params, emptyLabel) {
  if (!params?.length) {
    return `<p class="desc">${esc(emptyLabel)}</p>`;
  }
  const rows = params
    .map(
      (p) => `<tr>
      <td><code>${esc(p.key)}</code></td>
      <td>${reqBadge(p)}</td>
      <td>${esc(p.description || "—")}</td>
      <td class="mono">${esc(p.value || "")}</td>
    </tr>`
    )
    .join("");
  return `<table class="params">
    <thead><tr><th>Name</th><th></th><th>Description</th><th>Example</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function formatBody(raw) {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function samplesBlock(ep) {
  const items = [];
  for (const ex of ep.examples || []) {
    items.push({
      label: `${ex.name}${ex.code != null ? ` · ${ex.code}` : ""}`,
      body: formatBody(ex.body),
    });
  }
  if (ep.liveSample?.body) {
    items.push({
      label: `Live sample · ${ep.liveSample.status}`,
      body: formatBody(ep.liveSample.body),
    });
  }
  if (!items.length) {
    return `<p class="desc">No sample response saved yet. Update the Postman collection examples or run <code>node fetch-samples.mjs</code> for safe GETs.</p>`;
  }
  const tabs = items
    .map(
      (it, i) =>
        `<button type="button" data-i="${i}" class="${i === 0 ? "active" : ""}">${esc(it.label)}</button>`
    )
    .join("");
  const panels = items
    .map(
      (it, i) =>
        `<pre class="sample" data-panel="${i}" ${i === 0 ? "" : "hidden"}>${esc(it.body)}</pre>`
    )
    .join("");
  return `<div class="sample-tabs" data-samples>${tabs}</div>${panels}`;
}

function renderEndpoint(ep) {
  const url = ep.rawUrl || `{{base_url}}/${ep.path}`;
  return `<article class="endpoint spy-target" id="${esc(ep.id)}" data-nav-id="${esc(ep.id)}">
    <div class="endpoint-head">
      <span class="method ${methodClass(ep.method)}">${esc(ep.method)}</span>
      <h3>${esc(ep.name)}</h3>
    </div>
    <code class="path-line">${esc(url)}</code>
    ${ep.description ? `<p class="desc">${esc(ep.description)}</p>` : ""}
    <div class="section-label">Query parameters</div>
    ${paramsTable(ep.query, "None")}
    <div class="section-label">Body parameters ${ep.bodyMode ? `(${esc(ep.bodyMode)})` : ""}</div>
    ${paramsTable(ep.bodyParams, ep.method === "GET" ? "No body" : "None")}
    <div class="section-label">Sample responses</div>
    ${samplesBlock(ep)}
  </article>`;
}

function gettingStartedHtml(data) {
  return `
    <section class="hero" id="overview">
      <h2>${esc(SITE_NAME)}</h2>
      <p>Complete technical reference for the EMS Appointment &amp; Test Drive API (Wallan Group · AI Project). Covers authentication, endpoints, request parameters, and response samples for TecNext development.</p>
      <div class="meta-row">
        <span><strong>21</strong> endpoints</span>
        <span><strong>REST</strong> architecture</span>
        <span><strong>JSON</strong> responses</span>
      </div>
      <div class="toolbar">
        <button type="button" id="logout-btn">Lock docs</button>
      </div>
    </section>

    <section class="doc-section spy-target" id="getting-started" data-nav-id="getting-started">
      <h2 class="doc-h2">Getting Started</h2>
      <p class="desc">Use this guide while integrating outbound agents and tools against EMS. Source of truth for params is the Postman collection; regenerate this site after API changes.</p>
    </section>

    <section class="doc-section spy-target" id="authentication" data-nav-id="authentication">
      <h3 class="doc-h3">Authentication</h3>
      <p class="desc">All API requests require a valid <code>api_key</code>.</p>
      <div class="section-label">Recommended — POST body</div>
      <table class="params">
        <thead><tr><th>Key</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td><code>api_key</code></td><td class="mono">EMS-AI-B299-X721</td></tr>
        </tbody>
      </table>
      <div class="section-label">Alternative — URL parameter</div>
      <table class="params">
        <thead><tr><th>Key</th><th>Format</th></tr></thead>
        <tbody>
          <tr><td><code>api_key</code></td><td class="mono">?api_key=EMS-AI-B299-X721</td></tr>
        </tbody>
      </table>
      <div class="note-box">Prefer sending <code>api_key</code> in the POST body for write endpoints. GET helpers typically use the query string.</div>
    </section>

    <section class="doc-section spy-target" id="base-url" data-nav-id="base-url">
      <h3 class="doc-h3">Base URL &amp; Formats</h3>
      <p class="desc">Common configuration for all API requests.</p>
      <code class="path-line">${esc(data.baseUrl)}/</code>
      <table class="params">
        <thead><tr><th>Area</th><th>Prefix</th></tr></thead>
        <tbody>
          <tr><td>Service booking</td><td class="mono">${esc(data.baseUrl)}/appointment/</td></tr>
          <tr><td>Call back</td><td class="mono">${esc(data.baseUrl)}/call_back/</td></tr>
          <tr><td>Test drive</td><td class="mono">${esc(data.baseUrl)}/test_drive/</td></tr>
        </tbody>
      </table>
      <div class="section-label">Typical booking flow</div>
      <ol class="flow-list">
        <li>Franchises → Departments → Branches → Service Types</li>
        <li>Available Slots (capture <code>sa_id</code>)</li>
        <li>Customer Lookup (or Create Customer)</li>
        <li>Book Appointment</li>
      </ol>
      <div class="section-label">Typical test drive flow</div>
      <ol class="flow-list">
        <li>Brands → Cities → Showrooms → Cars</li>
        <li>TD Slots</li>
        <li>TD Book (optional: Lookup / Get / Cancel)</li>
      </ol>
      <div class="note-box">
        Postman source: <code>${esc(data.source)}</code>.
        Official EMS page: <a href="${esc(data.officialDocs)}" target="_blank" rel="noopener">Documentation.php</a>
      </div>
    </section>
  `;
}

function setActiveNav(id) {
  if (!id) return;
  const nav = document.getElementById("nav");
  let activeLink = null;
  nav.querySelectorAll("a").forEach((a) => {
    const match = a.getAttribute("href") === `#${id}`;
    a.classList.toggle("active", match);
    if (match) activeLink = a;
  });
  if (activeLink) {
    const side = activeLink.closest(".sidebar");
    if (side) {
      const aTop = activeLink.offsetTop;
      const aBottom = aTop + activeLink.offsetHeight;
      const viewTop = side.scrollTop;
      const viewBottom = viewTop + side.clientHeight;
      if (aTop < viewTop + 40 || aBottom > viewBottom - 40) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }
}

function setupScrollSpy() {
  if (spyObserver) spyObserver.disconnect();

  const targets = [...document.querySelectorAll(".spy-target")];
  if (!targets.length) return;

  const visible = new Map();

  spyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.navId || entry.target.id;
        if (entry.isIntersecting) visible.set(id, entry.intersectionRatio);
        else visible.delete(id);
      }
      let bestId = null;
      let bestRatio = -1;
      for (const [id, ratio] of visible) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }
      if (!bestId) {
        // Fallback: nearest section above viewport midpoint
        const mid = window.innerHeight * 0.28;
        let nearest = null;
        let nearestDist = Infinity;
        for (const el of targets) {
          if (el.hidden) continue;
          const top = el.getBoundingClientRect().top;
          const dist = Math.abs(top - mid);
          if (top <= mid + 80 && dist < nearestDist) {
            nearestDist = dist;
            nearest = el.dataset.navId || el.id;
          }
        }
        bestId = nearest;
      }
      if (bestId) setActiveNav(bestId);
    },
    {
      root: null,
      rootMargin: "-15% 0px -55% 0px",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    }
  );

  targets.forEach((el) => spyObserver.observe(el));

  // Hash / click sync
  document.getElementById("nav").onclick = (ev) => {
    const a = ev.target.closest("a");
    if (!a) return;
    const id = a.getAttribute("href")?.slice(1);
    if (id) {
      // slight delay so scroll settles, then force highlight
      setTimeout(() => setActiveNav(id), 50);
    }
  };

  if (location.hash) {
    setActiveNav(location.hash.slice(1));
  } else {
    setActiveNav("getting-started");
  }
}

function render() {
  const data = window.EMS_DOCS;
  if (!data) {
    document.getElementById("main").innerHTML =
      "<p>Missing data.js — run <code>node build.mjs</code>.</p>";
    return;
  }

  document.title = SITE_NAME;
  document.getElementById("brand-title").textContent = SITE_NAME;

  const startLinks = `
    <div class="nav-group">
      <h2>Getting Started</h2>
      <a href="#getting-started">Overview</a>
      <a href="#authentication">Authentication</a>
      <a href="#base-url">Base URL &amp; Formats</a>
    </div>
  `;

  const nav = document.getElementById("nav");
  nav.innerHTML =
    startLinks +
    data.folders
      .map((folder) => {
        const links = data.endpoints
          .filter((e) => e.folder === folder)
          .map(
            (e) =>
              `<a href="#${esc(e.id)}"><span class="method ${methodClass(e.method)}" style="min-width:2.6rem;font-size:0.65rem">${esc(e.method)}</span><span>${esc(e.name)}</span></a>`
          )
          .join("");
        return `<div class="nav-group"><h2>${esc(folder)}</h2>${links}</div>`;
      })
      .join("");

  document.getElementById("main").innerHTML = `
    ${gettingStartedHtml(data)}
    ${data.endpoints.map(renderEndpoint).join("")}
  `;

  document.getElementById("logout-btn")?.addEventListener("click", lock);

  document.querySelectorAll("[data-samples]").forEach((tabs) => {
    tabs.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const i = btn.dataset.i;
      const root = tabs.parentElement;
      tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      root.querySelectorAll("[data-panel]").forEach((p) => {
        p.hidden = p.dataset.panel !== i;
      });
    });
  });

  const search = document.getElementById("search");
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll(".endpoint").forEach((el) => {
      const hit = !q || el.textContent.toLowerCase().includes(q);
      el.hidden = !hit;
    });
    document.querySelectorAll(".nav-group a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (
        href === "#getting-started" ||
        href === "#authentication" ||
        href === "#base-url"
      ) {
        a.hidden = false;
        return;
      }
      const id = href.slice(1);
      const ep = document.getElementById(id);
      a.hidden = ep ? ep.hidden : false;
    });
  };

  setupScrollSpy();
}
