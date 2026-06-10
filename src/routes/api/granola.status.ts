import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/granola/status")({
  server: {
    handlers: {
      GET: async () => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        const granolaKey = process.env.GRANOLA_API_KEY;
        if (!lovableKey || !granolaKey) {
          return new Response(
            JSON.stringify({
              connected: false,
              reason: !granolaKey
                ? "Granola connector not linked. Enable it in your Lovable Workspace Settings."
                : "LOVABLE_API_KEY missing.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        try {
          const res = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": granolaKey,
            },
          });
          const body = await res.json().catch(() => ({}));
          const ok = res.ok && (body.outcome === "verified" || body.outcome === "skipped");
          return new Response(
            JSON.stringify({
              connected: ok,
              outcome: body.outcome ?? "unknown",
              reason: ok ? null : body.error ?? `Gateway returned ${res.status}`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ connected: false, reason: e instanceof Error ? e.message : String(e) }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
