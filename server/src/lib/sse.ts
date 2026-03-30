// lib/sse.ts
type Listener = (data: any) => void;

export function createPubSub() {
  const listeners = new Map<number, Set<Listener>>();

  function subscribe(id: number, fn: Listener) {
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id)!.add(fn);

    return () => {
      const set = listeners.get(id);
      if (!set) return;
      set.delete(fn);
      if (set.size === 0) listeners.delete(id);
    };
  }

  function publish(id: number, payload: any) {
    const listenerSet = listeners.get(id);
    if (!listenerSet) return;
    listenerSet.forEach((fn) => fn(payload));
  }

  return { subscribe, publish };
}

export function createSSEResponse(
  request: Request,
  subscribeFn: (send: (data: any) => void) => () => void,
  initialEvent?: any,
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        let eventId = 0;
        let closed = false;

        const send = (data: any) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(
                `id: ${++eventId}\nevent: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch (err) {
            console.error("[SSE] Failed to enqueue event:", err);
            cleanup();
          }
        };

        const unsubscribe = subscribeFn(send);

        if (initialEvent) send(initialEvent);

        const heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(":\n\n"));
          } catch {
            cleanup();
          }
        }, 15_000);

        function cleanup() {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }

        request.signal.addEventListener("abort", cleanup);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    },
  );
}
