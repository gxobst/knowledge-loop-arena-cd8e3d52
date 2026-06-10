import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/granola";

function buildHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const granolaKey = process.env.GRANOLA_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!granolaKey) throw new Error("GRANOLA_API_KEY is not configured — connect Granola in Workspace Settings");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": granolaKey,
  };
}

export const Route = createFileRoute("/api/granola/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const splat = (params as { _splat?: string })._splat ?? "";
          const url = new URL(request.url);
          const target = `${GATEWAY_URL}/v1/${splat}${url.search}`;
          const res = await fetch(target, { method: "GET", headers: buildHeaders() });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
