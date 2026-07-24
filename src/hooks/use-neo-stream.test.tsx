// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useNeoStream } from "@/hooks/use-neo-stream";

function sseFrame(evento: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(evento)}\n\n`);
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useNeoStream — watchdog de conexão perdida", () => {
  it("never leaves the UI in an infinite spinner: flips to erro/conexaoPerdida when the stream goes silent past the watchdog timeout", async () => {
    let releaseNext: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseFrame({ tipo: "execucao.iniciada", execucaoId: "e1", mensagemId: "m1" }));
        // Never enqueue again and never close — simulates a stalled connection
        // (function killed mid-stream) that produces no terminal event.
      },
      pull() {
        return new Promise<void>((resolve) => {
          releaseNext = resolve;
        });
      },
    });
    void releaseNext;

    vi.spyOn(global, "fetch").mockResolvedValue(new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useNeoStream("conv1"), { wrapper: wrapper(queryClient) });

    act(() => {
      result.current.iniciar("investigue algo", "idem-1");
    });

    // Let the initial frame's microtasks settle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state.status).toBe("streaming");

    // Advance well past WATCHDOG_TIMEOUT_MS (30s) without any further activity.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    expect(result.current.state.status).toBe("erro");
    expect(result.current.state.conexaoPerdida).toBe(true);
    expect(result.current.emExecucao).toBe(false);
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
