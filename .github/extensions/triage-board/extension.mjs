// Extension: triage-board
// A small issue triage board for the current repository session.

import { createServer } from "node:http";
import { URL } from "node:url";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const repository = "mpcnat/tailspin-toys-devdays";
const servers = new Map();

const fallbackIssues = [
    {
        number: 9,
        title: "Add a Backer Concierge assistant for catalog questions",
        body: "Build a catalog-grounded assistant that recommends games, refuses unsupported facts, and is accessible from the site.",
        html_url: `https://github.com/${repository}/issues/9`,
    },
    {
        number: 7,
        title: "Allow users to filter games by category and publisher",
        body: "Add combined category and publisher filters to the game list, including data-layer, accessibility, unit, and end-to-end coverage.",
        html_url: `https://github.com/${repository}/issues/7`,
    },
    {
        number: 6,
        title: "Implement pagination on the game list page",
        body: "Add deterministic pagination support in the data layer and accessible pagination controls to keep the catalog manageable as it grows.",
        html_url: `https://github.com/${repository}/issues/6`,
    },
];

const topReasons = {
    9: "Highest product impact: it is a user-facing capability that can answer discovery questions and has explicit grounding and accessibility requirements.",
    7: "Strong discovery value with clear reuse of existing category and publisher data; it also unlocks more useful browsing as the catalog expands.",
    6: "A foundational scalability improvement: it keeps the catalog usable and fast, and the scope is focused enough to deliver before the list becomes unwieldy.",
};

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function issueForCard(issue, featured) {
    return {
        number: issue.number,
        title: issue.title,
        body: issue.body || "No description provided.",
        url: issue.html_url || `https://github.com/${repository}/issues/${issue.number}`,
        featured,
        reason: featured ? topReasons[issue.number] : "",
    };
}

async function loadIssues() {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${repository}/issues?state=open&per_page=100`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    "User-Agent": "tailspin-triage-board",
                },
            },
        );
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const issues = (await response.json()).filter((issue) => !issue.pull_request);
        const featured = issues.filter((issue) => [9, 7, 6].includes(issue.number));
        const remainder = issues.filter((issue) => ![9, 7, 6].includes(issue.number));
        return [
            ...featured.map((issue) => issueForCard(issue, true)),
            ...remainder.map((issue) => issueForCard(issue, false)),
        ];
    } catch {
        return fallbackIssues.map((issue) => issueForCard(issue, true));
    }
}

function renderCard(issue) {
    const reason = issue.featured
        ? `<p class="reason"><strong>Why it is here:</strong> ${escapeHtml(issue.reason)}</p>`
        : "";
    return `<article class="card${issue.featured ? " featured" : ""}">
      <div class="card-heading">
        <span class="issue-number">#${issue.number}</span>
        <a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.title)}</a>
      </div>
      <p>${escapeHtml(issue.body)}</p>
      ${reason}
      <button type="button" data-issue="${issue.number}" data-testid="add-issue-${issue.number}">Add to current context</button>
    </article>`;
}

function renderHtml(issues) {
    const featured = issues.filter((issue) => issue.featured);
    const remainder = issues.filter((issue) => !issue.featured);
    const remainderMarkup = remainder.length
        ? remainder.map(renderCard).join("")
        : `<p class="empty">No other open issues right now.</p>`;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Issue triage board</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; padding: 24px; background: var(--background-color-default, #fff); color: var(--text-color-default, #1f2328); font: 14px/1.5 var(--font-sans, system-ui, sans-serif); }
      main { max-width: 1050px; margin: auto; }
      h1 { margin: 0 0 6px; font-size: 26px; }
      h2 { margin: 28px 0 12px; font-size: 18px; }
      .intro, .empty { color: var(--text-color-muted, #656d76); }
      .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .card { display: flex; flex-direction: column; gap: 8px; padding: 16px; border: 1px solid var(--border-color-default, #d0d7de); border-radius: 10px; background: var(--background-color-muted, #f6f8fa); }
      .featured { border-color: var(--true-color-blue, #0969da); }
      .card-heading { display: flex; gap: 8px; align-items: baseline; }
      .card-heading a { color: var(--text-color-default, #1f2328); font-weight: 600; text-decoration: none; }
      .card-heading a:hover { text-decoration: underline; }
      .issue-number { color: var(--text-color-muted, #656d76); font-family: var(--font-mono, monospace); }
      .card p { margin: 0; }
      .reason { color: var(--text-color-muted, #656d76); font-size: 13px; }
      button { align-self: flex-start; margin-top: auto; border: 1px solid var(--border-color-default, #d0d7de); border-radius: 6px; padding: 7px 10px; background: var(--background-color-default, #fff); color: var(--text-color-default, #1f2328); cursor: pointer; }
      button:hover { border-color: var(--true-color-blue, #0969da); }
      button:focus-visible { outline: 2px solid var(--color-focus-outline, #0969da); outline-offset: 2px; }
      button[disabled] { cursor: wait; opacity: .65; }
      #status { min-height: 1.5em; margin-top: 16px; color: var(--text-color-muted, #656d76); }
    </style>
  </head>
  <body>
    <main>
      <h1>Issue triage board</h1>
      <p class="intro">The three issues most likely to need attention now are shown first. Add any issue to the current session context to start working on it.</p>
      <h2>Needs attention now</h2>
      <section class="board" aria-label="Issues needing attention">${featured.map(renderCard).join("")}</section>
      <h2>Remaining open issues</h2>
      <section class="board" aria-label="Remaining open issues">${remainderMarkup}</section>
      <p id="status" role="status" aria-live="polite"></p>
    </main>
    <script>
      const status = document.querySelector("#status");
      document.querySelectorAll("button[data-issue]").forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          status.textContent = "Adding issue to the current context…";
          try {
            const response = await fetch("/add-to-context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ number: Number(button.dataset.issue) }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to add issue");
            status.textContent = "Issue added to the current context.";
            button.textContent = "Added to context";
          } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
          }
        });
      });
    </script>
  </body>
</html>`;
}

async function startServer() {
    const issues = await loadIssues();
    const server = createServer(async (request, response) => {
        const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
        if (request.method === "POST" && requestUrl.pathname === "/add-to-context") {
            let body = "";
            for await (const chunk of request) body += chunk;
            try {
                const number = Number(JSON.parse(body).number);
                const issue = issues.find((candidate) => candidate.number === number);
                if (!issue) throw new Error("Issue not found on the board");
                await session.send({
                    prompt: `Add GitHub issue #${issue.number} to the current work context and prepare to work on it.\n\nTitle: ${issue.title}\nURL: ${issue.url}\nDescription:\n${issue.body}`,
                });
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end(JSON.stringify({ ok: true }));
            } catch (error) {
                response.writeHead(400, { "Content-Type": "application/json" });
                response.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(renderHtml(issues));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

let session;
session = await joinSession({
    canvases: [
        createCanvas({
            id: "triage-board",
            displayName: "Issue triage board",
            description: "A Kanban-style board that prioritizes open repository issues and adds selected issues to the current session context.",
            actions: [
                {
                    name: "add_issue_to_context",
                    description: "Add an open repository issue to the current session context so work can begin on it.",
                    inputSchema: {
                        type: "object",
                        properties: { number: { type: "integer", minimum: 1 } },
                        required: ["number"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const issues = await loadIssues();
                        const issue = issues.find((candidate) => candidate.number === ctx.input.number);
                        if (!issue) throw new Error(`Issue #${ctx.input.number} is not open or could not be loaded.`);
                        await session.send({
                            prompt: `Add GitHub issue #${issue.number} to the current work context and prepare to work on it.\n\nTitle: ${issue.title}\nURL: ${issue.url}\nDescription:\n${issue.body}`,
                        });
                        return { added: true, number: issue.number, title: issue.title };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer();
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Issue triage board", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
