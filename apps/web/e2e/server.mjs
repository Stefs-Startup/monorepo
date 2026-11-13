import http from "node:http";
import { getWebAppGreeting, runWebSliceHealthCheck } from "../dist/src/index.js";

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

function renderPage() {
  const greeting = getWebAppGreeting();
  const report = runWebSliceHealthCheck();

  const auditRows = report.wcagAudit.entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.pairName)}</td>
          <td><code>${escapeHtml(entry.fg)}</code></td>
          <td><code>${escapeHtml(entry.bg)}</code></td>
          <td>${entry.contrastRatio.toFixed(2)}:1</td>
          <td>${entry.passesWcagAA ? "Pass" : "Fail"}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>@cmp/web — Focus Horizon</title>
  <style>
    :root {
      --bg: #FFFFFF;
      --surface: #F8FAFC;
      --fg: #0F172A;
      --fg-muted: #475569;
      --primary-bg: #1D4ED8;
      --primary-fg: #FFFFFF;
      --border: #CBD5E1;
      --focus-ring: #1D4ED8;
    }
    html[data-theme="dark"] {
      --bg: #0F172A;
      --surface: #1E293B;
      --fg: #F8FAFC;
      --fg-muted: #CBD5E1;
      --primary-bg: #1D4ED8;
      --primary-fg: #FFFFFF;
      --border: #475569;
      --focus-ring: #93C5FD;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.5;
    }
    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      padding: 0.75rem 1rem;
      background: var(--primary-bg);
      color: var(--primary-fg);
      z-index: 100;
    }
    .skip-link:focus {
      left: 0.5rem;
      top: 0.5rem;
    }
    :focus-visible {
      outline: 3px solid var(--focus-ring);
      outline-offset: 2px;
    }
    header, main, footer {
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem 1.5rem;
    }
    header {
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    nav ul {
      list-style: none;
      display: flex;
      gap: 1rem;
      margin: 0;
      padding: 0;
    }
    nav a {
      color: var(--fg);
      text-decoration: underline;
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0.25rem 0.5rem;
    }
    button {
      cursor: pointer;
      min-height: 44px;
      min-width: 44px;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
      font: inherit;
    }
    button.primary {
      background: var(--primary-bg);
      color: var(--primary-fg);
      border-color: var(--primary-bg);
    }
    section {
      margin-top: 1.5rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }
    .focus-list {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .focus-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .muted {
      color: var(--fg-muted);
    }
    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }
    input[type="text"] {
      min-height: 44px;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--fg);
      font: inherit;
    }
    footer {
      border-top: 1px solid var(--border);
      margin-top: 2rem;
      color: var(--fg-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header>
    <div>
      <h1>Focus Horizon</h1>
      <p class="muted">${escapeHtml(greeting)}</p>
    </div>
    <nav aria-label="Primary">
      <ul>
        <li><a href="#scarcity-section">Pinned Focus</a></li>
        <li><a href="#audit-section">Contrast Audit</a></li>
        <li><a href="#note-section">Quick Note</a></li>
      </ul>
    </nav>
    <button id="theme-toggle" type="button" aria-pressed="false">
      Switch to Dark Theme
    </button>
  </header>

  <main id="main-content" tabindex="-1">
    <section id="scarcity-section" aria-labelledby="scarcity-heading">
      <h2 id="scarcity-heading">Top-3 Focus Scarcity</h2>
      <p class="muted">At most 3 items may be pinned simultaneously.</p>
      <p id="pin-status" role="status" aria-live="polite">2 of 3 focus items pinned.</p>
      <ul class="focus-list">
        <li class="focus-item">
          <span>Focus 1 — Accessibility Gate</span>
          <button type="button" class="pin-btn primary" data-id="focus-1" aria-pressed="true">Unpin Focus 1</button>
        </li>
        <li class="focus-item">
          <span>Focus 2 — Zero-PII Telemetry</span>
          <button type="button" class="pin-btn primary" data-id="focus-2" aria-pressed="true">Unpin Focus 2</button>
        </li>
        <li class="focus-item">
          <span>Focus 3 — Contrast Audit</span>
          <button type="button" class="pin-btn" data-id="focus-3" aria-pressed="false">Pin Focus 3</button>
        </li>
        <li class="focus-item">
          <span>Focus 4 — Scarcity Check</span>
          <button type="button" class="pin-btn" data-id="focus-4" aria-pressed="false">Pin Focus 4</button>
        </li>
      </ul>
    </section>

    <section id="audit-section" aria-labelledby="audit-heading">
      <h2 id="audit-heading">WCAG 2.2 AA Contrast Audit</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Foreground</th>
            <th scope="col">Background</th>
            <th scope="col">Ratio</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          ${auditRows}
        </tbody>
      </table>
    </section>

    <section id="note-section" aria-labelledby="note-heading">
      <h2 id="note-heading">Quick Note</h2>
      <form id="note-form" class="form-row">
        <label for="focus-note">Focus note</label>
        <input id="focus-note" name="focusNote" type="text" placeholder="Add a short focus note" />
        <button type="submit" class="primary">Save Note</button>
      </form>
      <p id="note-status" role="status" aria-live="polite"></p>
    </section>
  </main>

  <footer>
    <p>@cmp/web slice health: ${report.passed ? "PASS" : "FAIL"}</p>
  </footer>

  <script>
    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.addEventListener("click", () => {
      const root = document.documentElement;
      const isDark = root.getAttribute("data-theme") === "dark";
      const next = isDark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      themeToggle.setAttribute("aria-pressed", String(!isDark));
      themeToggle.textContent = isDark ? "Switch to Dark Theme" : "Switch to Light Theme";
    });

    const pinned = new Set(["focus-1", "focus-2"]);
    const pinStatus = document.getElementById("pin-status");
    for (const btn of document.querySelectorAll(".pin-btn")) {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const num = id.split("-")[1];
        if (pinned.has(id)) {
          pinned.delete(id);
          btn.setAttribute("aria-pressed", "false");
          btn.classList.remove("primary");
          btn.textContent = "Pin Focus " + num;
          pinStatus.textContent = pinned.size + " of 3 focus items pinned.";
        } else if (pinned.size >= 3) {
          pinStatus.textContent = "Swap required: 3 of 3 focus items already pinned.";
        } else {
          pinned.add(id);
          btn.setAttribute("aria-pressed", "true");
          btn.classList.add("primary");
          btn.textContent = "Unpin Focus " + num;
          pinStatus.textContent = pinned.size + " of 3 focus items pinned.";
        }
      });
    }

    const noteForm = document.getElementById("note-form");
    const noteInput = document.getElementById("focus-note");
    const noteStatus = document.getElementById("note-status");
    noteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const val = noteInput.value.trim();
      noteStatus.textContent = val ? "Saved note: " + val : "Please enter a focus note.";
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(renderPage());
});

server.listen(PORT, HOST, () => {
  console.log(`@cmp/web a11y server listening on http://${HOST}:${PORT}`);
});
