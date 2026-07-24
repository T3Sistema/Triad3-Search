import { describe, expect, it, beforeAll } from "vitest";
import { zodResponsesFunction } from "openai/helpers/zod";
import "@/server/neo/tools"; // registers the full catalogue as a side effect
import { buildResponsesTools, getNeoTool, isNeoToolPersistent, listNeoTools } from "@/server/neo/tool-registry";
import { NEO_PERSISTENT_TOOLS, NEO_TOOL_NAMES } from "@/server/neo/tool-names";

interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

describe("Neo tool registry", () => {
  let tools: ReturnType<typeof listNeoTools>;

  beforeAll(() => {
    tools = listNeoTools();
  });

  it("registers exactly the 18 catalogued tools", () => {
    expect(NEO_TOOL_NAMES.length).toBe(18);
    expect(tools.length).toBe(18);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...NEO_TOOL_NAMES].sort());
  });

  it("gives every tool a stable name, a public pt-BR label, and a model-facing description", () => {
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.nomePublico.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("produces a strict=true JSON Schema for every tool with additionalProperties:false and every property required", () => {
    for (const tool of tools) {
      const fn = zodResponsesFunction({ name: tool.name, description: tool.description, parameters: tool.parameters });
      expect(fn.strict).toBe(true);
      const schema = fn.parameters as JsonSchemaObject;
      expect(schema.additionalProperties).toBe(false);
      const propertyNames = Object.keys(schema.properties ?? {});
      expect(schema.required ?? []).toEqual(propertyNames);
    }
  });

  it("classifies exactly the five monitor-mutation tools as persistent (effect vs. read-only)", () => {
    const persistentNames = tools.filter((t) => t.persistent).map((t) => t.name).sort();
    expect(persistentNames).toEqual([...NEO_PERSISTENT_TOOLS].sort());
    for (const name of NEO_PERSISTENT_TOOLS) {
      expect(isNeoToolPersistent(name)).toBe(true);
    }
    expect(isNeoToolPersistent("pesquisar_web")).toBe(false);
  });

  it("gives every tool a positive timeout", () => {
    for (const tool of tools) {
      expect(tool.timeoutMs).toBeGreaterThan(0);
    }
  });

  it("returns undefined for an unknown/unregistered tool name", () => {
    expect(getNeoTool("excluir_tudo")).toBeUndefined();
    expect(getNeoTool("")).toBeUndefined();
  });

  it("builds a Responses-API tools array matching the registry size", () => {
    expect(buildResponsesTools().length).toBe(tools.length);
  });
});
