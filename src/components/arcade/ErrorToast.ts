import { toast } from "sonner";

export function showApiError(err: unknown, onFallback?: () => void) {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error("⚠️ AI Connection Failed!", {
    description: `Please verify your API Key, Base URL, or Model Name in the AI Engine Settings. [${msg.slice(0, 200)}]`,
    duration: 8000,
    className: "animate-shake",
    action: onFallback
      ? { label: "View Mock Data", onClick: onFallback }
      : undefined,
  });
}
