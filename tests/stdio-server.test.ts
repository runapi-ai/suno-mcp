import fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("suno stdio MCP server", () => {
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let tempHome: string | undefined;
  let api: Server | undefined;
  let runtimePricingAvailable = true;

  afterEach(async () => {
    await client?.close();
    await transport?.close();
    await new Promise<void>((resolve, reject) => api?.close((error) => error ? reject(error) : resolve()) ?? resolve());
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
    client = undefined;
    transport = undefined;
    tempHome = undefined;
    api = undefined;
  });

  it("exposes the model-line tools over the real stdio transport", async () => {
    const tsxPath = [
      path.resolve("node_modules/.bin/tsx"),
      path.resolve("../../node_modules/.bin/tsx")
    ].find((candidate) => fs.existsSync(candidate));
    expect(tsxPath).toBeDefined();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "runapi-mcp-home-"));
    runtimePricingAvailable = true;
    const requestedPaths: Array<{method: string; url: string}> = [];
    api = createRuntimeApi(() => runtimePricingAvailable, (request: {method: string; url: string}) => requestedPaths.push(request));
    await new Promise<void>((resolve) => api!.listen(0, "127.0.0.1", resolve));
    const apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

    client = new Client({ name: "suno-mcp-test", version: "0.1.0" });
    transport = new StdioClientTransport({
      command: tsxPath!,
      args: ["src/index.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
      env: {
        HOME: tempHome,
        PATH: process.env.PATH || "",
        RUNAPI_API_KEY: "stdio-test-key",
        RUNAPI_BASE_URL: apiUrl
      }
    });

    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    expect(names).toEqual(["add_samples","blend_lyrics","boost_style","check_pricing","convert_audio","cover_audio","create_mashup","extend_music","generate_lyrics","generate_persona","generate_voice","get_task","get_timestamped_lyrics","inspire_music","login","remaster_audio","separate_audio_stems","stitch_audio","text_to_music","text_to_sound","visualize_music"]);
    // An action published on its own public route must create and poll there
    // instead of the model line's derived route.
    const routedActions: Record<string, {route: string; arguments: Record<string, unknown>; polls: boolean}> = {
      "convert_audio": {route: "/api/v1/audio_exports", arguments: {"source_audio_id":"runapi route sample","wait":false}, polls: true},
      "add_samples": {route: "/api/v1/music_from_sample", arguments: {"audio_url":"runapi route sample","start_seconds":1,"end_seconds":2,"wait":false}, polls: true},
      "visualize_music": {route: "/api/v1/music_visualizations", arguments: {"source_audio_id":"runapi route sample","wait":false}, polls: true},
      "generate_persona": {route: "/api/v1/personas", arguments: {"source_task_id":"runapi route sample","source_audio_id":"runapi route sample","name":"runapi route sample","description":"runapi route sample"}, polls: false},
      "boost_style": {route: "/api/v1/style_expansions", arguments: {"description":"runapi route sample"}, polls: false},
      "get_timestamped_lyrics": {route: "/api/v1/timestamped_lyrics", arguments: {"source_audio_id":"runapi route sample"}, polls: false},
      "generate_voice": {route: "/api/v1/voices", arguments: {"source_audio_url":"runapi route sample"}, polls: false}
    };
    for (const [endpoint, routed] of Object.entries(routedActions)) {
      const created = await client.callTool({ name: endpoint, arguments: routed.arguments });
      const createdContent = created.content?.[0];
      if (!createdContent || createdContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      expect(requestedPaths[requestedPaths.length - 1], `${endpoint} must create on its public route`).toEqual({method: "POST", url: routed.route});

      if (!routed.polls) {
        continue;
      }

      const polled = await client.callTool({ name: "get_task", arguments: {task_id: "550e8400-e29b-41d4-a716-446655440000", action: endpoint} });
      const polledContent = polled.content?.[0];
      if (!polledContent || polledContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      expect(requestedPaths[requestedPaths.length - 1], `${endpoint} must poll its public route`).toEqual({method: "GET", url: `${routed.route}/550e8400-e29b-41d4-a716-446655440000`});
    }
    for (const endpoint of ["generate_persona","boost_style","get_timestamped_lyrics","generate_voice"]) {
      const tool = tools.tools.find((candidate) => candidate.name === endpoint);
      expect(tool?.inputSchema.properties, `${endpoint} is synchronous and must not expose polling controls`).not.toHaveProperty("wait");
    }

    const pricing = await client.callTool({ name: "check_pricing", arguments: {} });
    const content = pricing.content?.[0];
    if (!content || content.type !== "text") {
      throw new Error("Expected text tool response");
    }
    expect(JSON.parse(content.text)).toMatchObject({ supported: true, price: {price_schedule: {unit_price_cents: 37}} });

    // Every advertised model must price without naming an endpoint, even one
    // that only lives on a non-primary endpoint of a multi-endpoint line.
    for (const model of []) {
      const priced = await client.callTool({ name: "check_pricing", arguments: { model } });
      const pricedContent = priced.content?.[0];
      if (!pricedContent || pricedContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      expect(JSON.parse(pricedContent.text), `check_pricing should support ${model}`).toMatchObject({ supported: true, price: {price_schedule: {unit_price_cents: 37}} });
    }

    // A model offered on several endpoints must report every endpoint's price
    // without naming one, not silently price only the first endpoint found.
    const multiEndpointModels: Record<string, string[]> = {"suno-v4":["cover_audio","create_mashup","extend_music","inspire_music","add_samples","remaster_audio","stitch_audio","text_to_music"],"suno-v4.5":["cover_audio","create_mashup","extend_music","inspire_music","add_samples","remaster_audio","stitch_audio","text_to_music"],"suno-v4.5-all":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v4.5-plus":["cover_audio","create_mashup","extend_music","inspire_music","add_samples","remaster_audio","stitch_audio","text_to_music"],"suno-v5":["cover_audio","create_mashup","extend_music","inspire_music","add_samples","remaster_audio","stitch_audio","text_to_music","text_to_sound"],"suno-v5.5":["cover_audio","create_mashup","extend_music","inspire_music","add_samples","remaster_audio","stitch_audio","text_to_music","text_to_sound"],"suno-v6":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v6-mini":["cover_audio","create_mashup","extend_music","text_to_music"],"suno-v6-wild":["cover_audio","create_mashup","extend_music","text_to_music"]};
    for (const [model, actions] of Object.entries(multiEndpointModels)) {
      const spread = await client.callTool({ name: "check_pricing", arguments: { model } });
      const spreadContent = spread.content?.[0];
      if (!spreadContent || spreadContent.type !== "text") {
        throw new Error("Expected text tool response");
      }
      const parsed = JSON.parse(spreadContent.text) as { endpoints?: { action: string }[] };
      expect(parsed.endpoints?.map((entry) => entry.action).sort(), `check_pricing should price ${model} on every endpoint`).toEqual([...actions].sort());
    }

    runtimePricingAvailable = false;

    runtimePricingAvailable = false;
    const unavailable = await client.callTool({ name: "check_pricing", arguments: {} });
    const unavailableContent = unavailable.content?.[0];
    if (!unavailableContent || unavailableContent.type !== "text") {
      throw new Error("Expected text tool response");
    }
    expect(JSON.parse(unavailableContent.text)).toMatchObject({
      supported: true,
      price: {
        error: expect.stringContaining("https://runapi.ai/pricing"),
        pricing_url: "https://runapi.ai/pricing"
      }
    });
  });
});

function createRuntimeApi(runtimeAvailable: () => boolean, recordRequest?: (request: {method: string; url: string}) => void): Server {
  return createServer((request, response) => {
    recordRequest?.({method: request.method ?? "GET", url: request.url ?? ""});
    response.setHeader("content-type", "application/json");
    if (request.method === "POST" && request.url?.startsWith("/api/v1/")) {
      response.end(JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "queued",
        billing: {reservation: {amount_cents: 37}, settlement: null, refund: null}
      }));
      return;
    }
    if (!request.url?.startsWith("/api/v1/price_schedules")) {
      response.statusCode = 404;
      response.end(JSON.stringify({message: "not found"}));
      return;
    }
    if (!runtimeAvailable()) {
      response.statusCode = 503;
      response.end(JSON.stringify({message: "runtime pricing unavailable"}));
      return;
    }

    const url = new URL(request.url, "http://example.test");
    if (url.searchParams.get("service")?.includes("-")) {
      response.statusCode = 400;
      response.end(JSON.stringify({message: "service must use the public API namespace"}));
      return;
    }
    const model = url.searchParams.get("model");
    response.end(JSON.stringify({
      as_of: "2026-07-30T00:00:00.000000Z",
      price_schedules: [{
        service: url.searchParams.get("service"),
        action: url.searchParams.get("action"),
        ...(model ? {model} : {}),
        unit_price_cents: 37
      }]
    }));
  });
}
