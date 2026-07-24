import { describe, expect, it } from "vitest";
import { SERVICE_LABELS, toneForStatus, translateService, translateStatus } from "./status-labels";

describe("translateStatus", () => {
  it.each([
    ["running", "Em execução"],
    ["completed", "Concluído"],
    ["failed", "Falhou"],
    ["stopped", "Interrompido"],
    ["active", "Ativo"],
    ["paused", "Pausado"],
    ["pending", "Pendente"],
    ["connected", "Conectado"],
    ["disconnected", "Desconectado"],
  ])("translates %s to %s", (raw, expected) => {
    expect(translateStatus(raw)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(translateStatus("RUNNING")).toBe("Em execução");
  });

  it("falls back to the raw value for unknown statuses instead of throwing", () => {
    expect(translateStatus("something-new")).toBe("something-new");
  });

  it("returns a placeholder for missing status", () => {
    expect(translateStatus(undefined)).toBe("—");
    expect(translateStatus(null)).toBe("—");
  });
});

describe("translateService", () => {
  it("translates all known services to Portuguese", () => {
    for (const key of Object.keys(SERVICE_LABELS)) {
      const translated = translateService(key);
      expect(translated).not.toBe(key);
      expect(translated).toMatch(/[a-zà-ú]/i);
    }
  });
});

describe("toneForStatus", () => {
  it("maps success-like statuses to the success tone", () => {
    expect(toneForStatus("completed")).toBe("success");
    expect(toneForStatus("active")).toBe("success");
  });

  it("maps failure-like statuses to the error tone", () => {
    expect(toneForStatus("failed")).toBe("error");
  });

  it("defaults to neutral for unknown statuses", () => {
    expect(toneForStatus("mystery")).toBe("neutral");
  });
});
