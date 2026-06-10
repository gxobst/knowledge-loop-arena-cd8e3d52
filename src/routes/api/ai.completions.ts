import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/completions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { prompt, isJSONMode } = body as { prompt?: string; isJSONMode?: boolean };

          if (!prompt) {
            return new Response(
              JSON.stringify({ error: "Missing required parameter: prompt" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const apiKey = process.env.MISTRAL_API_KEY || (typeof Deno !== "undefined" ? Deno.env.get("MISTRAL_API_KEY") : undefined);
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: "MISTRAL_API_KEY is not configured on the server." }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "mistral-large-latest",
              messages: [{ role: "user", content: prompt }],
              ...(isJSONMode ? { response_format: { type: "json_object" } } : {}),
            }),
          });

          const data = await response.json().catch(() => ({}));
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
