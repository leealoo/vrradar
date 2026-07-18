import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { refreshFeeds } from "@/lib/rss";
import type { RefreshStreamMessage } from "@/lib/refreshProgress";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const streamRequested = body?.stream === true || request.headers.get("accept")?.includes("application/x-ndjson");
  const feedId = typeof body?.feedId === "string" ? body.feedId : undefined;

  if (streamRequested) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let connected = true;

        const send = (message: RefreshStreamMessage) => {
          if (!connected) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
          } catch {
            connected = false;
          }
        };

        void (async () => {
          try {
            await ensureDatabaseSchema();
            const result = await refreshFeeds(feedId, (progress) => send({ type: "progress", progress }));
            send({ type: "complete", result });
          } catch (error) {
            send({ type: "error", message: error instanceof Error ? error.message : String(error) });
          } finally {
            if (connected) {
              try {
                controller.close();
              } catch {
                // The client may have disconnected while the refresh kept running.
              }
            }
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  try {
    await ensureDatabaseSchema();
    const result = await refreshFeeds(feedId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
