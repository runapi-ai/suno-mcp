# @runapi.ai/suno-mcp

RunAPI MCP server for the **Suno** model line. Create tasks,
poll their status, and check pricing through a single RunAPI API key.

## Tools

- `cover_audio` — create a Suno task (cover audio) and (optionally) poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. Models: `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5`.
- `create_mashup` — create a Suno task (create mashup) and (optionally) poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. Models: `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5`.
- `extend_music` — create a Suno task (extend music) and (optionally) poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. Models: `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5`.
- `text_to_music` — create a Suno task (text to music) and (optionally) poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. Models: `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5`.
- `text_to_sound` — create a Suno task (text to sound) and (optionally) poll until it reaches a terminal status. Returns the task id, status, output URLs, and a price snapshot. Models: `suno-v4`, `suno-v4.5`, `suno-v4.5-all`, `suno-v4.5-plus`, `suno-v5`, `suno-v5.5`.
- `get_task` — fetch the current status and latest payload for a task.
- `check_pricing` — look up pricing for a model in this line.

## Configuration

Set a RunAPI API key via the `RUNAPI_API_KEY` environment variable, or write
it to `~/.config/runapi/config.json`:

```bash
mkdir -p ~/.config/runapi
echo '{"api_key":"YOUR_KEY"}' > ~/.config/runapi/config.json
```

Get an API key at https://runapi.ai. Pricing is listed at
https://runapi.ai/pricing.

## Usage

Run the server over stdio:

```bash
npx -y @runapi.ai/suno-mcp
```

Add it to an MCP client (see `examples/` for per-client configs):

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

## License

Apache-2.0
