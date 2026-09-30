import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createModelServer,
  CANONICAL_PRICING_URL,
  declaredFieldsForAction,
  findModelForAction,
  findModels,
  friendlyError,
  jsonText,
  lookupRuntimePrice,
  RunApiClient,
  runtimePricingErrorMessage,
  taskStatus,
  mcpZodObjectForFields,
  type Contract,
  type ContractAction,
  type ModelInfo,
  type ModelServerTool,
} from "@runapi.ai/mcp-core";
import { readContract } from "./data.js";
import { META } from "./meta.js";

type RuntimeContractAction = ContractAction & {
  task_type?: "synchronous" | "asynchronous";
};

function taskType(action: ContractAction): "synchronous" | "asynchronous" {
  return (action as RuntimeContractAction).task_type ?? "asynchronous";
}

function lineService(contract: Contract): string {
  return Object.keys(contract.actions)[0]?.split("/")[0] ?? META.lineSlug;
}

function lineEndpoints(contract: Contract, filter?: "synchronous" | "asynchronous"): string[] {
  const seen = new Set<string>();
  for (const action of Object.values(contract.actions)) {
    if (filter && taskType(action) !== filter) {
      continue;
    }
    seen.add(action.endpoint);
  }
  return [...seen];
}

// A provider-neutral resource publishes its own public route instead of
// living under the model line's service slug.
function routeForEndpoint(contract: Contract, endpoint: string): string | undefined {
  for (const action of Object.values(contract.actions)) {
    if (action.endpoint === endpoint && action.path) {
      return action.path;
    }
  }
  return undefined;
}

function buildTools(contract: Contract): ModelServerTool[] {
  const tools: ModelServerTool[] = [];

  for (const [key, action] of Object.entries(contract.actions)) {
    if (taskType(action) === "synchronous") {
      continue;
    }
    const service = key.split("/")[0];
    const endpoint = action.endpoint;
    tools.push({
      name: endpoint,
      description: `Create a ${action.model} task on RunAPI (${endpoint.replace(/_/g, " ")}). Returns a task id, status, and ${["blend_lyrics","generate_lyrics"].includes(endpoint) ? "result payload" : "output URLs"}.`,
      service,
      action: endpoint,
      models: action.models
    });
  }

  return tools;
}

async function runtimePricingFor(info: ModelInfo, client: RunApiClient) {
  try {
    return await lookupRuntimePrice(client, {
      service: info.service,
      action: info.action,
      model: info.model
    });
  } catch (error) {
    return {
      error: runtimePricingErrorMessage(error),
      pricing_url: CANONICAL_PRICING_URL
    };
  }
}

function registerSynchronousTools(server: McpServer, contract: Contract, client: RunApiClient): void {
  for (const [key, action] of Object.entries(contract.actions)) {
    if (taskType(action) !== "synchronous") {
      continue;
    }

    const service = key.split("/")[0];
    const endpoint = action.endpoint;
    const shape: Record<string, z.ZodType> = {};
    if (action.models.length > 0) {
      shape.model = z.unknown().optional().meta({ type: "string" }).describe("RunAPI model slug for this model line.");
    }

    server.registerTool(
      endpoint,
      {
        description: `Run a synchronous ${action.model} operation on RunAPI (${endpoint.replace(/_/g, " ")}). Returns the operation result.`,
        inputSchema: mcpZodObjectForFields(declaredFieldsForAction(action), shape)
      },
      async (args) => {
        const { model, ...params } = args as Record<string, unknown> & { model?: string };
        try {
          const selectedModel = model === undefined ? action.models[0] : model;
          const body = {
            ...params,
            ...(action.models.length > 0 ? { model: selectedModel } : {})
          };
          const result = await client.createTask(service, endpoint, body, undefined, action.path);
          return jsonText({ result });
        } catch (error) {
          return jsonText({ error: friendlyError(error) });
        }
      }
    );
  }
}

function registerLineTools(server: McpServer, contract: Contract, client: RunApiClient): void {
  const service = lineService(contract);
  const endpoints = lineEndpoints(contract);
  const asynchronousEndpoints = lineEndpoints(contract, "asynchronous");
  const endpointEnum = endpoints.length > 0 ? z.enum(endpoints as [string, ...string[]]) : z.string();

  if (asynchronousEndpoints.length > 0) {
    const asynchronousEndpointEnum = z.enum(asynchronousEndpoints as [string, ...string[]]);
    // With one endpoint, action defaults safely. With several, a wrong default
    // would query the wrong task route, so the caller must name the endpoint.
    const getTaskAction = asynchronousEndpoints.length > 1
      ? asynchronousEndpointEnum.describe("Asynchronous endpoint the task was created on.")
      : asynchronousEndpointEnum.optional().describe("Asynchronous endpoint the task was created on. Defaults to the line's only asynchronous endpoint.");

    server.tool(
      "get_task",
      `Fetch the current status and latest result payload for a ${META.lineSlug} task.`,
      {
        task_id: z.string().describe("Task id returned when the task was created."),
        action: getTaskAction
      },
      async ({ task_id, action }) => {
        try {
          const endpoint = action ?? asynchronousEndpoints[0];
          const task = await client.getTask(service, task_id, endpoint, {route: routeForEndpoint(contract, endpoint)});
          return jsonText({ task_id, status: taskStatus(task), task });
        } catch (error) {
          return jsonText({ error: friendlyError(error) });
        }
      }
    );
  }

  server.tool(
    "check_pricing",
    `Look up RunAPI pricing for the ${META.lineSlug} model line.`,
    {
      model: z.string().optional().describe("Model slug. Defaults to the line's primary model."),
      action: endpointEnum.optional().describe("Endpoint name. Defaults to the endpoint that offers the model.")
    },
    async ({ model, action }) => {
      const noMatch = { supported: false, message: "No matching model/endpoint in this model line." };
      const priced = async (info: ModelInfo) =>
        jsonText({ supported: true, model: info.model, service: info.service, action: info.action, price: await runtimePricingFor(info, client) });
      // No-model endpoints stay model-less; otherwise price the requested model.
      const withModel = (info: ModelInfo): ModelInfo =>
        info.model === undefined || model === undefined ? info : { ...info, model };

      // Explicit endpoint: price exactly that model on that endpoint.
      if (action) {
        const info = findModelForAction(service, action, undefined, contract);
        return info ? priced(withModel(info)) : jsonText(noMatch);
      }

      // No endpoint and no model: price the line's primary model/endpoint.
      if (!model) {
        const info = findModelForAction(service, endpoints[0], undefined, contract);
        return info ? priced(info) : jsonText(noMatch);
      }

      // No endpoint named: a model may be offered on several endpoints at
      // different prices, so report every endpoint that offers it rather than
      // silently pricing only the first one found.
      const matches = findModels(model, contract);
      if (matches.length === 0) {
        const info = endpoints.length === 1 ? findModelForAction(service, endpoints[0], undefined, contract) : undefined;
        return info ? priced(withModel(info)) : jsonText(noMatch);
      }
      if (matches.length === 1) {
        return priced(matches[0]);
      }
      return jsonText({
        supported: true,
        model: matches[0].model,
        service: matches[0].service,
        endpoints: await Promise.all(matches.map(async (info) => ({ action: info.action, price: await runtimePricingFor(info, client) })))
      });
    }
  );
}

export function createServer(): McpServer {
  const contract = readContract();
  const tools = buildTools(contract);
  const client = new RunApiClient();

  const server = createModelServer({
    name: META.name,
    version: META.version,
    lineSlug: META.lineSlug,
    contract,
    tools,
    client
  });

  registerSynchronousTools(server, contract, client);
  registerLineTools(server, contract, client);
  return server;
}
