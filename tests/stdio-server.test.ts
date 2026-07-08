import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("suno stdio MCP server", () => {
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let tempHome: string | undefined;

  afterEach(async () => {
    await client?.close();
    await transport?.close();
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
    client = undefined;
    transport = undefined;
    tempHome = undefined;
  });

  it("exposes the model-line tools over the real stdio transport", async () => {
    const tsxPath = [
      path.resolve("node_modules/.bin/tsx"),
      path.resolve("../../node_modules/.bin/tsx")
    ].find((candidate) => fs.existsSync(candidate));
    expect(tsxPath).toBeDefined();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "runapi-mcp-home-"));

    client = new Client({ name: "suno-mcp-test", version: "0.1.0" });
    transport = new StdioClientTransport({
      command: tsxPath!,
      args: ["src/index.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
      env: {
        HOME: tempHome,
        PATH: process.env.PATH || ""
      }
    });

    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    expect(names).toEqual(["check_pricing","cover_audio","create_mashup","extend_music","generate_lyrics","get_task","login","text_to_music","text_to_sound"]);

    const pricing = await client.callTool({ name: "check_pricing", arguments: {} });
    const content = pricing.content?.[0];
    if (!content || content.type !== "text") {
      throw new Error("Expected text tool response");
    }
    expect(JSON.parse(content.text)).toMatchObject({ supported: true });

    // Every advertised model must price without naming an endpoint, even one
    // that only lives on a non-primary endpoint of a multi-endpoint line.
    for (const model of ["suno-v4","suno-v4.5","suno-v4.5-all","suno-v4.5-plus","suno-v5","suno-v5.5"]) {
      const priced = await client.callTool({ name: "check_pricing", arguments: { model } });
      const pricedContent = priced.content?.[0];
      if (!pricedContent || pricedContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      expect(JSON.parse(pricedContent.text), `check_pricing should support ${model}`).toMatchObject({ supported: true });
    }

    // A model offered on several endpoints must report every endpoint's price
    // without naming one, not silently price only the first endpoint found.
    const multiEndpointModels: Record<string, string[]> = {"suno-v4":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v4.5":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v4.5-all":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v4.5-plus":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v5":["cover_audio","create_mashup","extend_music","text_to_music","text_to_sound"],"suno-v5.5":["cover_audio","create_mashup","extend_music","text_to_music","text_to_sound"]};
    for (const [model, actions] of Object.entries(multiEndpointModels)) {
      const spread = await client.callTool({ name: "check_pricing", arguments: { model } });
      const spreadContent = spread.content?.[0];
      if (!spreadContent || spreadContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      const parsed = JSON.parse(spreadContent.text) as { endpoints?: { action: string }[] };
      expect(parsed.endpoints?.map((entry) => entry.action).sort(), `check_pricing should price ${model} on every endpoint`).toEqual([...actions].sort());
    }
  });
});
