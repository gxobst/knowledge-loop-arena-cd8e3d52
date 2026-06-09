import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  PROVIDERS,
  type AISettings,
  loadSettings,
  saveSettings,
  defaultSettings,
  testConnection,
} from "@/lib/aiGateway";
import { toast } from "sonner";

export function SettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [s, setS] = useState<AISettings>(defaultSettings);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  const provider = PROVIDERS.find((p) => p.id === s.provider)!;

  function update<K extends keyof AISettings>(k: K, v: AISettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function changeProvider(id: string) {
    const p = PROVIDERS.find((x) => x.id === id)!;
    setS((prev) => ({
      ...prev,
      provider: p.id,
      model: p.models[0],
      baseUrl: p.defaultBaseUrl ?? prev.baseUrl,
    }));
  }

  function handleSave() {
    saveSettings(s);
    toast.success("⚡ AI Engine settings saved!");
    onOpenChange(false);
  }

  async function handleTest() {
    saveSettings(s);
    setTesting(true);
    setResult(null);
    const r = await testConnection();
    setResult(r);
    setTesting(false);
  }

  const needsApiKey = !["vertex", "ollama"].includes(s.provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto arcade-card">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Zap className="text-amber-arcade" /> AI Engine Control
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Select AI Provider</Label>
            <select
              value={s.provider}
              onChange={(e) => changeProvider(e.target.value)}
              className="w-full mt-1 rounded-md bg-input border border-border p-2 text-foreground"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Select Model</Label>
            <select
              value={s.model}
              disabled={s.useCustomModel}
              onChange={(e) => update("model", e.target.value)}
              className="w-full mt-1 rounded-md bg-input border border-border p-2 text-foreground disabled:opacity-50"
            >
              {provider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="customModel"
              checked={s.useCustomModel}
              onCheckedChange={(v) => update("useCustomModel", !!v)}
            />
            <Label htmlFor="customModel" className="cursor-pointer">Use Custom Model Name</Label>
          </div>

          {s.useCustomModel && (
            <Input
              placeholder="e.g. my-org/custom-llm-2026"
              value={s.customModel}
              onChange={(e) => update("customModel", e.target.value)}
            />
          )}

          {needsApiKey && (
            <div>
              <Label>API Key / Credentials</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={s.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
              />
            </div>
          )}

          {!["vertex", "foundry", "gemini"].includes(s.provider) && (
            <div>
              <Label>Base API URL</Label>
              <Input value={s.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} />
            </div>
          )}

          {s.provider === "vertex" && (
            <div className="space-y-3 p-3 rounded-md bg-muted/40 border border-border">
              <div>
                <Label>Project ID</Label>
                <Input value={s.projectId} onChange={(e) => update("projectId", e.target.value)} />
              </div>
              <div>
                <Label>Region / Location</Label>
                <Input value={s.region} onChange={(e) => update("region", e.target.value)} placeholder="us-central1" />
              </div>
              <div>
                <Label>OAuth Access Token</Label>
                <Input type="password" value={s.oauthToken} onChange={(e) => update("oauthToken", e.target.value)} />
              </div>
            </div>
          )}

          {s.provider === "foundry" && (
            <div className="space-y-3 p-3 rounded-md bg-muted/40 border border-border">
              <div>
                <Label>Resource Name</Label>
                <Input value={s.resourceName} onChange={(e) => update("resourceName", e.target.value)} />
              </div>
              <div>
                <Label>Project / Deployment ID</Label>
                <Input value={s.deploymentId} onChange={(e) => update("deploymentId", e.target.value)} />
              </div>
              <div>
                <Label>API Version</Label>
                <Input value={s.apiVersion} onChange={(e) => update("apiVersion", e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleTest} disabled={testing} variant="secondary" className="gap-1">
              {testing ? <Loader2 className="animate-spin h-4 w-4" /> : <Zap className="h-4 w-4" />}
              Test Connection ⚡
            </Button>
            <Button onClick={handleSave} className="bg-fuchsia-arcade hover:bg-fuchsia-arcade/80">Save Settings</Button>
          </div>

          {result && (
            <div
              className={`p-3 rounded-md flex items-start gap-2 text-sm ${
                result.ok
                  ? "bg-emerald-arcade/20 border border-emerald-arcade text-emerald-arcade"
                  : "bg-destructive/20 border border-destructive text-destructive animate-shake"
              }`}
            >
              {result.ok ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <XCircle className="h-5 w-5 mt-0.5" />}
              <div>
                <strong>{result.ok ? "Success!" : "Error"}</strong>
                <div className="opacity-90">{result.message}</div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
