<h1 align="center">Suno MCP Server</h1>

<p align="center">
  <strong>Create Suno AI tasks through RunAPI — 6 endpoints, 6 models — then poll status and check pricing. One MCP server, one API key.</strong>
</p>

<p align="center">
  <sub>Works with Claude Code, Codex, Cursor, Windsurf, VS Code, Roo Code, and any MCP-compatible host.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@runapi.ai/suno-mcp"><img src="https://img.shields.io/npm/v/%40runapi.ai/suno-mcp?style=flat-square&color=blue" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square" alt="Apache-2.0 license"></a>
  <img src="https://img.shields.io/badge/Type-MCP_Server-blue?style=flat-square" alt="MCP Server">
  <img src="https://img.shields.io/badge/Models-6-green?style=flat-square" alt="6 models">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> |
  <a href="#tools">Tools</a> |
  <a href="#models">Models</a> |
  <a href="#examples">Examples</a> |
  <a href="#configuration">Configuration</a>
</p>

---

## What Is This?

`@runapi.ai/suno-mcp` is a focused MCP server for the **Suno** model line on RunAPI.
It lets an MCP-compatible assistant create Suno tasks, poll their status, and check current pricing — all through a single RunAPI API key.

`check_pricing` works without a key. Task creation and status polling require `RUNAPI_API_KEY`.
This package is a pure client; it does not run a local generation backend.

---

## Quick Start

Add it to Claude Code:

```bash
claude mcp add suno -s user -- npx -y @runapi.ai/suno-mcp
```

- `-s user`: global, available in all of your projects.
- `-s project`: team-shared, written to `.mcp.json` in the current repo so it can be committed.

For other hosts, or for manual configuration, use this JSON:

```json
{
  "mcpServers": {
    "suno": {
      "command": "npx",
      "args": ["-y", "@runapi.ai/suno-mcp"],
      "env": { "RUNAPI_API_KEY": "${RUNAPI_API_KEY}" }
    }
  }
}
```

Create an API key at [runapi.ai](https://runapi.ai) and expose it as `RUNAPI_API_KEY`.
See `examples/` for ready-made config files for Claude, Cursor, Windsurf, VS Code, and Roo.

---

## Tools

| Tool | Auth | Purpose |
|---|---|---|
| `cover_audio` | Yes | Create a Suno task (cover audio) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `create_mashup` | Yes | Create a Suno task (create mashup) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `extend_music` | Yes | Create a Suno task (extend music) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `generate_lyrics` | Yes | Create a Suno task (generate lyrics) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `text_to_music` | Yes | Create a Suno task (text to music) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `text_to_sound` | Yes | Create a Suno task (text to sound) and optionally poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. |
| `get_task` | Yes | Fetch the current status and latest payload for an existing task. |
| `check_pricing` | No | Look up the current price for a Suno model and endpoint. |

---

## Models

Suno covers 6 models across 6 endpoints. Each tool accepts the models listed for it:

| Tool | Models |
|---|---|
| `cover_audio` | `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5` |
| `create_mashup` | `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5` |
| `extend_music` | `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5` |
| `generate_lyrics` | _no model parameter_ |
| `text_to_music` | `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5` |
| `text_to_sound` | `suno-v5`, `suno-v5.5` |

Call `check_pricing` for the current price of any model. Model availability can change between releases.

---

## Examples

Ask your assistant in natural language; it uses the tools to confirm pricing and run the task.

### Create a task

```text
Run a Suno cover audio task with RunAPI.
```

The assistant calls `check_pricing` to confirm the cost, then `cover_audio`, and returns the task id, status, and output URLs.

### Submit without waiting

```text
Create the task but don't wait for it to finish.
```

The assistant calls the create tool with `wait: false` and returns the task id. Check on it later with `get_task`.

### Check pricing

```text
What does Suno cost?
```

The assistant calls `check_pricing` and shows the current snapshot, or links to [runapi.ai/pricing](https://runapi.ai/pricing).

---

## Configuration

The server reads the API key in this order:

1. `RUNAPI_API_KEY` environment variable
2. `~/.config/runapi/config.json`

Example config file:

```json
{
  "apiKey": "your_runapi_key"
}
```

Do not commit real API keys. Get one at [runapi.ai](https://runapi.ai); pricing is listed at [runapi.ai/pricing](https://runapi.ai/pricing).

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
