import "server-only";

// Side-effect imports: each module registers its tool(s) into the shared
// registry (src/server/neo/tool-registry.ts). Importing this module once
// (from orchestrator.ts) is enough to populate the full catalogue.
import "./pesquisar";
import "./capturar";
import "./extrair";
import "./mapear";
import "./monitorar";
import "./auxiliares";

export { listNeoTools, getNeoTool, buildResponsesTools, isNeoToolPersistent } from "@/server/neo/tool-registry";
