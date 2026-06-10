import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/granola";

function resolveTarget(request: Request, splat: string) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token && (token.startsWith("grn_") || token.length > 25)) {
      return {
        target: `https://public-api.granola.ai/v1/${splat}`,
        headers: {
          Authorization: `Bearer ${token}`,
        }
      };
    }
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  const granolaKey = process.env.GRANOLA_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!granolaKey) throw new Error("GRANOLA_API_KEY is not configured — connect Granola in Workspace Settings");

  return {
    target: `${GATEWAY_URL}/v1/${splat}`,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": granolaKey,
    }
  };
}

export const Route = createFileRoute("/api/granola/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const splat = (params as { _splat?: string })._splat ?? "";
          const url = new URL(request.url);
          const { target, headers } = resolveTarget(request, splat);
          const fullTarget = `${target}${url.search}`;
          
          const res = await fetch(fullTarget, { 
            method: "GET", 
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
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
