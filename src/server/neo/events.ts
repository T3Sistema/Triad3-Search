import "server-only";
import type { NeoEvent } from "@/lib/neo/events";

/** Encodes one Neo event as an SSE frame. Keep every event pt-BR/neutral — see src/lib/neo/events.ts. */
export function encodeNeoEvent(event: NeoEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Thin wrapper around a ReadableStream controller so orchestration code doesn't touch stream internals directly. */
export class NeoEventEmitter {
  private readonly controller: ReadableStreamDefaultController<Uint8Array>;
  private readonly encoder = new TextEncoder();
  private closed = false;

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller;
  }

  emit(event: NeoEvent): void {
    if (this.closed) return;
    try {
      this.controller.enqueue(this.encoder.encode(encodeNeoEvent(event)));
    } catch {
      this.closed = true;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller.close();
    } catch {
      // Already closed by the client disconnecting — nothing to do.
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
