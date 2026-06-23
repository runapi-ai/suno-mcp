import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Contract, PricingConfig } from "@runapi.ai/mcp-core";

function dataRoot(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(current, "..", "..", "data"),
    path.resolve(current, "..", "data")
  ];

  const root = candidates.find((candidate) => existsSync(path.join(candidate, "contract.json")));
  if (!root) {
    throw new Error("Unable to locate the embedded RunAPI data directory.");
  }

  return root;
}

export function readContract(): Contract {
  return JSON.parse(readFileSync(path.join(dataRoot(), "contract.json"), "utf8")) as Contract;
}

export function readPricing(): PricingConfig {
  return JSON.parse(readFileSync(path.join(dataRoot(), "pricing.json"), "utf8")) as PricingConfig;
}
