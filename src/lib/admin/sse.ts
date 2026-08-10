// Shared module-level store of connected admin SSE clients.
// All requests within the same Worker isolate share this instance.

const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

export type AdminEvent =
  | { event: "new_order"; ref: string; total: number }
  | { event: "new_message"; name: string }
  | { event: "new_cancellation"; name: string; orderRef: string }
  | { event: "ping" };

export function notifyAdmins(payload: AdminEvent) {
  if (clients.size === 0) return;
  const bytes = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  for (const ctrl of [...clients]) {
    try {
      ctrl.enqueue(bytes);
    } catch {
      clients.delete(ctrl);
    }
  }
}

export function addClient(ctrl: ReadableStreamDefaultController<Uint8Array>) {
  clients.add(ctrl);
}

export function removeClient(ctrl: ReadableStreamDefaultController<Uint8Array>) {
  clients.delete(ctrl);
}
