# Agentify

> **Turn any microservice into an MCP tool — instantly.**

Agentify is a CLI tool that reads your service's OpenAPI spec (`/v3/api-docs`, `/openapi.json`, or a local file) and **generates a ready-to-run MCP (Model Context Protocol) server** in TypeScript or Python — no changes to your existing services required.

Built for engineers who want to connect AI agents (Claude, Cursor, custom LLM apps) directly to their backend APIs — in under a minute.

![Agentify CLI Preview](https://raw.githubusercontent.com/skyaque/agentify/main/preview.png)

---

## Why Agentify?

> *"A single engineer can expose 10 microservices to AI agents in 5 minutes — a task that would otherwise take 1.5 engineer weeks of manual MCP server writing."*

| Business Impact | Without Agentify | With Agentify |
|---|---|---|
| ⏱ **Time to AI integration** | 4–8 hrs per service | ~30 seconds per service |
| 🔁 **API change maintenance** | Manual update every tool definition | Re-run one command, done |
| 🐛 **Integration error rate** | High — manual type/param mapping | Near-zero — reads from spec directly |
| 🚀 **Skill barrier** | Requires MCP protocol expertise | Any engineer with an API URL |
| 🔒 **Safe AI experimentation** | Full API access by default | `--read-only` = GET/HEAD only, zero write risk |
| ☁️ **Cloud deployment** | Extra setup required | `PORT=8080` = SSE server, deploy to Cloud Run |

**10 services · manually:** ~60 hours &nbsp;|&nbsp; **10 services · Agentify:** ~5 minutes

```bash
npx @skyaque/agentify generate --services services.yaml
# → generated/server.ts   (TypeScript MCP server, ready to run)
# → generated/tools.ts    (Tool definitions with input schemas)
# → generated/schemas.ts  (Zod runtime validation)
# → generated/AGENTS.md   (Auto-generated tool documentation)

npx @skyaque/agentify generate --services services.yaml --lang python
# → generated/server.py   (FastMCP server — stdio + SSE, deployable anywhere)
# → generated/AGENTS.md   (Auto-generated tool documentation)
```

---

## Preview

```
░█████╗░░██████╗░███████╗███╗░░██╗████████╗██╗███████╗██╗░░░██╗
██╔══██╗██╔════╝░██╔════╝████╗░██║╚══██╔══╝██║██╔════╝╚██╗░██╔╝
███████║██║░░██╗░█████╗░░██╔██╗██║░░░██║░░░██║█████╗░░░╚████╔╝░
██╔══██║██║░░╚██╗██╔══╝░░██║╚████║░░░██║░░░██║██╔══╝░░░░╚██╔╝░░
██║░░██║╚██████╔╝███████╗██║░╚███║░░░██║░░░██║██║░░░░░░░░██║░░░
╚═╝░░╚═╝░╚═════╝░╚══════╝╚═╝░░╚══╝░░░╚═╝░░░╚═╝╚═╝░░░░░░░░╚═╝░░░

  Turn any microservice into an MCP tool — instantly.
  v0.4.0  ·  npm: @skyaque/agentify  ·  by skyaque

╭──────────────────────────────────────────────╮
│ Config                                       │
│   Services:  2                               │
│   File:      services.yaml                   │
│   Output:    ./generated                     │
╰──────────────────────────────────────────────╯

  ✔ orders ← http://localhost:8081/v3/api-docs   12 tools
  ✔ users  ← http://localhost:8082/v3/api-docs    8 tools

  ✦ Interactive Setup

  ? Output language:
  ❯ TypeScript  — server.ts + tools.ts + Zod schemas (Node.js)
    Python      — server.py with async httpx calls (stdio + SSE)

  ? Generation mode:
  ❯ Full       — include all HTTP methods (GET, POST, PUT, PATCH, DELETE)
    Read-only  — GET and HEAD only (safe for analytics / monitoring agents)

  ? Select tools to generate:
  ◉ orders_listOrders          [GET]    List all orders
  ◉ orders_createOrder         [POST]   Create a new order
  ◉ orders_getOrderById        [GET]    Get order by ID
  ○ orders_deleteOrder         [DELETE] Delete an order
  ◉ users_getUserById          [GET]    Get user by ID
  ◉ users_updateProfile        [PUT]    Update user profile
  ...

  ✔ Generated → ./generated

╭─────────────────────────────────────────────╮
│ ✔ Done!                                     │
│                                             │
│   2 service(s) · 18 tools · python          │
│                                             │
│   ● orders  (12 tools)                      │
│   ● users   (8 tools)                       │
╰─────────────────────────────────────────────╯
```

---

## Table of Contents

- [How It Works](#how-it-works)
- [Install](#install)
- [Quick Start](#quick-start)
- [What Gets Generated](#what-gets-generated)
- [CLI Reference](#cli-reference)
- [Services YAML Format](#services-yaml-format)
- [Authentication](#authentication)
- [Testing with MCP Inspector](#testing-with-mcp-inspector)
- [Works With Any Framework](#works-with-any-framework)
- [FAQ](#faq)
- [License](#license)

---

## How It Works

Point Agentify at your service's OpenAPI spec. It reads every endpoint, extracts the parameters and descriptions, and generates a complete MCP server — in TypeScript or Python — that you can run immediately.

**At runtime**, the generated server acts as a bridge:

```
AI Agent (Claude / Cursor)
    │
    │  MCP JSON-RPC (stdio or SSE)
    ▼
Generated server (server.ts / server.py)
    │  Resolves path params  /users/{id} → /users/42
    │  Appends query params for GET requests
    │  Sends JSON body for POST / PUT / PATCH
    │  Injects auth headers if configured
    ▼
Your Microservice HTTP API
    └── Returns { status, ok, body } back to the agent
```

The generated server supports **two transports**:

- **stdio** (default) — for local IDE clients (Claude Code, Cursor). Zero config, just run `python server.py`.
- **SSE** — for remote/cloud deployment. Set `PORT` and the server switches to HTTP automatically.

---

## Install

```bash
# Run without installing (recommended)
npx @skyaque/agentify generate --services services.yaml

# Install globally
npm install -g @skyaque/agentify
agentify generate --services services.yaml
```

**Requirements:** Node.js 18+

---

## Quick Start

### 1. Create `services.yaml`

```yaml
services:
  - name: orders
    url: http://localhost:8081/v3/api-docs

  - name: inventory
    url: http://localhost:8082/v3/api-docs

  - name: users
    file: ./specs/user-service.json    # local file also works
```

### 2. Generate

```bash
# Interactive mode — prompts for language, mode, and tool selection
npx @skyaque/agentify generate --services services.yaml

# Non-interactive — TypeScript, all tools
npx @skyaque/agentify generate --services services.yaml --lang typescript --all-tools

# Python, read-only (GET/HEAD only)
npx @skyaque/agentify generate --services services.yaml --lang python --read-only --all-tools
```

### 3. Run

**TypeScript:**
```bash
cd generated
npm install
AGENTIFY_BASE_URL=http://your-platform:8080 npm run mcp
```

**Python — locally (stdio):**
```bash
cd generated
pip install -r requirements.txt
AGENTIFY_BASE_URL=http://your-platform:8080 python server.py
```

**Python — remote / Cloud Run (SSE):**
```bash
PORT=8080 AGENTIFY_BASE_URL=https://your-api.com python server.py
```

### 4. Connect to Claude Code

Add to `.mcp.json` in your project root:

**TypeScript:**
```json
{
  "mcpServers": {
    "agentify": {
      "command": "npx",
      "args": ["tsx", "/path/to/generated/server.ts"],
      "env": {
        "AGENTIFY_BASE_URL": "http://your-platform:8080"
      }
    }
  }
}
```

**Python:**
```json
{
  "mcpServers": {
    "agentify": {
      "command": "python",
      "args": ["/path/to/generated/server.py"],
      "env": {
        "AGENTIFY_BASE_URL": "http://your-platform:8080"
      }
    }
  }
}
```

Restart Claude Code — your microservice tools appear automatically.

---

## What Gets Generated

### TypeScript (`--lang typescript`, default)

```
generated/
  server.ts      MCP stdio server (ready to run with tsx)
  tools.ts       Tool definitions with input schemas
  handlers.ts    HTTP dispatch to your services
  schemas.ts     Zod validation schemas per tool
  AGENTS.md      Tool documentation for agents and humans
  package.json   Pre-configured with mcp sdk, zod, tsx
  tsconfig.json
```

### Python (`--lang python`)

```
generated/
  server.py        FastMCP server — async tools, inline httpx calls,
                   stdio (local) + SSE (cloud) auto-detection
  AGENTS.md        Tool documentation
  requirements.txt mcp>=1.0.0, httpx>=0.27.0
```

---

## CLI Reference

```
npx @skyaque/agentify generate

  --services <file>     Path to services.yaml             [default: services.yaml]
  --out <dir>           Output directory                  [default: generated]
  --lang <lang>         Output language: typescript|python (skips language prompt)
  --read-only           Generate GET/HEAD tools only      (skips mode prompt)
  --all-tools           Use all tools                     (skips tool picker)
  --auth-basic <token>  Inject Basic auth header into all calls
  --apikey <token>      Inject apikey header into all calls
```

> **Interactive mode**: Run without `--lang`, `--read-only`, or `--all-tools` and Agentify will prompt you to choose your language, mode, and exactly which tools to include.

---

## Services YAML Format

```yaml
baseUrl: http://my-platform:8080     # optional — prepended to relative URLs

services:
  - name: order-service              # becomes tool prefix: order-service_listOrders
    url: http://localhost:8081/v3/api-docs

  - name: user-service
    url: /user-service/v3/api-docs   # relative — resolved against baseUrl

  - name: inventory-service
    file: ./specs/inventory.json     # local OpenAPI file (JSON or YAML)
```

Tool names are prefixed by service name: `orders_listOrders`, `users_getUserById`.

---

## Authentication

Pass credentials at generation time — they get baked into the generated server with env var override support:

```bash
# Basic auth
npx @skyaque/agentify generate --services services.yaml --auth-basic "dXNlcjpwYXNz"

# API key header
npx @skyaque/agentify generate --services services.yaml --apikey "my-secret-key"
```

At runtime you can override via env vars:

```bash
AGENTIFY_AUTH_BASIC=<token> AGENTIFY_BASE_URL=... python server.py
AGENTIFY_APIKEY=<key>       AGENTIFY_BASE_URL=... python server.py
```

---

## Testing with MCP Inspector

```bash
# TypeScript
cd generated && npm install
AGENTIFY_BASE_URL=http://your-service:8080 npx @modelcontextprotocol/inspector npx tsx server.ts

# Python
cd generated && pip install -r requirements.txt
AGENTIFY_BASE_URL=http://your-service:8080 npx @modelcontextprotocol/inspector python server.py
```

---

## Works With Any Framework

Agentify reads OpenAPI specs — it doesn't touch your source code. It works with:

| Framework | Language | Spec endpoint |
|---|---|---|
| Spring Boot | Java | `/v3/api-docs` (springdoc) |
| FastAPI | Python | `/openapi.json` |
| Gin / Echo | Go | any spec URL |
| Django REST | Python | `/api/schema/` |
| Express + swagger-jsdoc | Node | `/api-docs` |
| Any service | Any | local `.json` / `.yaml` file |

---

## FAQ

### "Why not just ask AI to write the MCP server for me?"

That's a fair question. You can ask an AI to write an MCP server — and for a single, simple API, it'll work fine. But Agentify solves a different problem: **scale, repeatability, and correctness at the spec level.**

| "Just ask AI" | Agentify |
|---|---|
| Requires manually describing every endpoint to the AI | Reads the **actual OpenAPI spec** — no human error |
| One-off, not repeatable | Run again after API changes → updated server instantly |
| Needs a human in the loop each time | **Zero human effort** — point at a URL, get a server |
| AI may hallucinate parameter names or types | Spec-driven → generated from real types |
| Doesn't scale to 5+ microservices | `services.yaml` → **all services in one shot** |
| No auth, no `--read-only`, no env var support | Production-ready flags baked in |

**The bottom line:** Agentify is a **deterministic compiler**, not a conversation. It turns your OpenAPI contract into a verified, runnable MCP server — consistently, every time, for any number of services.

---

## License

MIT
