import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/completions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { prompt, isJSONMode, model } = body as {
            prompt?: string;
            isJSONMode?: boolean;
            model?: string;
          };

          if (!prompt) {
            return new Response(
              JSON.stringify({ error: "Missing required parameter: prompt" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY is not configured on the server." }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify({
              model: model || "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: prompt }],
              ...(isJSONMode ? { response_format: { type: "json_object" } } : {}),
            }),
          });

          const text = await response.text();
          return new Response(text, {
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
