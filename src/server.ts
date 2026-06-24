import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createModelServer,
  findModelForAction,
  findModels,
  friendlyError,
  jsonText,
  priceForModel,
  RunApiClient,
  taskStatus,
  type Contract,
  type ContractAction,
  type InputRule,
  type ModelServerTool,
  type PricingConfig
} from "@runapi.ai/mcp-core";
import { readContract, readPricing } from "./data.js";
import { META } from "./meta.js";

function lineService(contract: Contract): string {
  return Object.keys(contract.actions)[0]?.split("/")[0] ?? META.lineSlug;
}

function lineEndpoints(contract: Contract): string[] {
  const seen = new Set<string>();
  for (const action of Object.values(contract.actions)) {
    seen.add(action.endpoint);
  }
  return [...seen];
}

function lineModels(contract: Contract): string[] {
  const seen = new Set<string>();
  for (const action of Object.values(contract.actions)) {
    for (const model of action.models) {
      seen.add(model);
    }
  }
  return [...seen];
}

function rulesForAction(action: ContractAction): InputRule[] {
  return action.rules ?? [];
}

function buildTools(contract: Contract): { tools: ModelServerTool[]; inputRules: Record<string, InputRule[]> } {
  const tools: ModelServerTool[] = [];
  const inputRules: Record<string, InputRule[]> = {};

  for (const [key, action] of Object.entries(contract.actions)) {
    const service = key.split("/")[0];
    const endpoint = action.endpoint;
    tools.push({
      name: endpoint,
      description: `Create a ${action.model} task on RunAPI (${endpoint.replace(/_/g, " ")}). Returns a task id, status, and output URLs.`,
      service,
      action: endpoint,
      models: action.models
    });
    inputRules[endpoint] = rulesForAction(action);
  }

  return { tools, inputRules };
}

function registerLineTools(server: McpServer, contract: Contract, pricing: PricingConfig, client: RunApiClient): void {
  const service = lineService(contract);
  const endpoints = lineEndpoints(contract);
  const models = lineModels(contract);
  const endpointEnum = endpoints.length > 0 ? z.enum(endpoints as [string, ...string[]]) : z.string();
  const modelEnum = models.length > 0 ? z.enum(models as [string, ...string[]]) : z.string();
  // With one endpoint, action defaults safely. With several, a wrong default
  // would query the wrong task route, so the caller must name the endpoint.
  const getTaskAction = endpoints.length > 1
    ? endpointEnum.describe("Endpoint the task was created on.")
    : endpointEnum.optional().describe("Endpoint the task was created on. Defaults to the line's only endpoint.");

  server.tool(
    "get_task",
    `Fetch the current status and latest result payload for a ${META.lineSlug} task.`,
    {
      task_id: z.string().describe("Task id returned when the task was created."),
      action: getTaskAction
    },
    async ({ task_id, action }) => {
      try {
        const task = await client.getTask(service, task_id, action ?? endpoints[0]);
        return jsonText({ task_id, status: taskStatus(task), task });
      } catch (error) {
        return jsonText({ error: friendlyError(error) });
      }
    }
  );

  server.tool(
    "check_pricing",
    `Look up RunAPI pricing for the ${META.lineSlug} model line.`,
    {
      model: modelEnum.optional().describe("Model slug. Defaults to the line's primary model."),
      action: endpointEnum.optional().describe("Endpoint name. Defaults to the endpoint that offers the model.")
    },
    async ({ model, action }) => {
      const noMatch = { supported: false, message: "No matching model/endpoint in this model line." };

      // Explicit endpoint: price exactly that model on that endpoint.
      if (action) {
        const info = findModelForAction(service, action, model, contract);
        return info
          ? jsonText({ supported: true, model: info.model, service: info.service, action: info.action, price: priceForModel(info, pricing) })
          : jsonText(noMatch);
      }

      // No endpoint and no model: price the line's primary model/endpoint.
      if (!model) {
        const info = findModelForAction(service, endpoints[0], undefined, contract);
        return info
          ? jsonText({ supported: true, model: info.model, service: info.service, action: info.action, price: priceForModel(info, pricing) })
          : jsonText(noMatch);
      }

      // No endpoint named: a model may be offered on several endpoints at
      // different prices, so report every endpoint that offers it rather than
      // silently pricing only the first one found.
      const matches = findModels(model, contract);
      if (matches.length === 0) {
        return jsonText(noMatch);
      }
      if (matches.length === 1) {
        const info = matches[0];
        return jsonText({ supported: true, model: info.model, service: info.service, action: info.action, price: priceForModel(info, pricing) });
      }
      return jsonText({
        supported: true,
        model: matches[0].model,
        service: matches[0].service,
        endpoints: matches.map((info) => ({ action: info.action, price: priceForModel(info, pricing) }))
      });
    }
  );
}

export function createServer(): McpServer {
  const contract = readContract();
  const pricing = readPricing();
  const { tools, inputRules } = buildTools(contract);
  const client = new RunApiClient();

  const server = createModelServer({
    name: META.name,
    version: META.version,
    lineSlug: META.lineSlug,
    contract,
    pricing,
    inputRules,
    tools,
    client
  });

  registerLineTools(server, contract, pricing, client);
  return server;
}
