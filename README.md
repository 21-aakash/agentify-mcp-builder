# Agentify

**Turn any microservice into an MCP tool.**

Point Agentify at your service's OpenAPI spec — it generates a ready-to-run MCP server. No code changes to your services. Works with Spring Boot, FastAPI, Go, Django, or anything that exposes `/v3/api-docs`.

```bash
npx agentify generate --services services.yaml
# → generated/server.ts  (TypeScript MCP server)
# → generated/AGENTS.md  (tool docs)
```

---

## Install

```bash
# Run without installing (recommended)
npx agentify generate --services services.yaml

# Or install globally
npm install -g agentify
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
# TypeScript server (default)
agentify generate --services services.yaml

# Python server
agentify generate --services services.yaml --lang python

# Read-only (GET/HEAD only — safe for analytics/monitoring agents)
agentify generate --services services.yaml --read-only

# All options
agentify generate --services services.yaml --out ./generated --lang python --read-only
```

### 3. Run

**TypeScript:**
```bash
cd generated
npm install
AGENTIFY_BASE_URL=http://your-platform:8080 npm run mcp
```

**Python:**
```bash
cd generated
pip install -r requirements.txt
AGENTIFY_BASE_URL=http://your-platform:8080 python server.py
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
  schemas.ts     Zod validation schemas
  AGENTS.md      Tool documentation for agents and humans
  package.json
  tsconfig.json
```

### Python (`--lang python`)

```
generated/
  server.py      MCP stdio server (FastMCP)
  handlers.py    HTTP dispatch via requests
  AGENTS.md      Tool documentation
  requirements.txt
```

---

## CLI Reference

```
agentify generate

  --services <file>     Path to services.yaml             [default: services.yaml]
  --out <dir>           Output directory                  [default: generated]
  --lang <lang>         Output language: typescript|python [default: typescript]
  --read-only           Generate GET/HEAD tools only
  --auth-basic <token>  Inject Basic auth header into all calls
  --apikey <token>      Inject apikey header into all calls
```

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

Pass credentials at generation time — they get baked into `handlers.ts` / `handlers.py` with env var override:

```bash
# Basic auth
agentify generate --services services.yaml --auth-basic "dXNlcjpwYXNz"

# API key header
agentify generate --services services.yaml --apikey "my-secret-key"
```

At runtime you can override via env vars:

```bash
AGENTIFY_AUTH_BASIC=<token> AGENTIFY_BASE_URL=... npm run mcp
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

Point `url:` or `file:` at wherever your spec lives.

---

## License

MIT
