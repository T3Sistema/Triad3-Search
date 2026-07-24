import { describe, expect, it } from "vitest";
import { parseNeoEvent } from "./events";
import { baseNeoAnswer } from "./answer-fixtures";

describe("parseNeoEvent", () => {
  it("accepts a valid execucao.iniciada event", () => {
    const evento = parseNeoEvent({ tipo: "execucao.iniciada", execucaoId: "e1", mensagemId: "m1" });
    expect(evento?.tipo).toBe("execucao.iniciada");
  });

  it("accepts a valid resposta.concluida event carrying a full NeoAnswer", () => {
    const evento = parseNeoEvent({
      tipo: "resposta.concluida",
      mensagemId: "m1",
      resposta: baseNeoAnswer({ titulo: "t", respostaDireta: "r" }),
    });
    expect(evento?.tipo).toBe("resposta.concluida");
  });

  it("rejects an event with an unknown tipo — never surfaces an unvalidated payload to the UI", () => {
    expect(parseNeoEvent({ tipo: "ferramenta.chamada", ferramenta: "monitor_excluir" })).toBeNull();
  });

  it("rejects malformed/partial payloads", () => {
    expect(parseNeoEvent({ tipo: "etapa.iniciada" })).toBeNull();
    expect(parseNeoEvent(null)).toBeNull();
    expect(parseNeoEvent("not an object")).toBeNull();
  });
});
