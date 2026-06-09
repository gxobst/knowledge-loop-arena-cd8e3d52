import { useState } from "react";
import { useArcade } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callAIGateway, isConfigured, loadSettings } from "@/lib/aiGateway";
import { showApiError } from "../ErrorToast";
import { Loader2 } from "lucide-react";

interface Turn { who: "user" | "analogy" | "compiler"; text: string }

export function SocraticDebate() {
  const { activeLecture } = useArcade();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!q.trim()) return;
    const concept = q.trim();
    setTurns((t) => [...t, { who: "user", text: concept }]);
    setQ("");
    setLoading(true);

    const ctx = activeLecture ? `Lecture context: ${activeLecture.title}. Summary: ${activeLecture.parsed.summary}\n\n` : "";

    if (!isConfigured(loadSettings())) {
      setTurns((t) => [
        ...t,
        { who: "analogy", text: `🎩 Imagine "${concept}" is like a pizza party — every slice is a tiny piece of the bigger idea! [Mock answer — connect an AI to see the real magic.]` },
        { who: "compiler", text: `🤖 Pizza? Imprecise! "${concept}" technically refers to a structured concept. Question: can you formally define it in one sentence?` },
      ]);
      setLoading(false);
      return;
    }

    try {
      const a = await callAIGateway(`${ctx}You are Dr. Analogy, a friendly, eccentric professor. Explain the following concept to a 10-year-old using a vivid, fun metaphor: ${concept}`);
      setTurns((t) => [...t, { who: "analogy", text: a }]);

      const b = await callAIGateway(`${ctx}You are 'The Strict Compiler', a precise robot tutor. Here is Dr. Analogy's explanation of "${concept}":\n\n${a}\n\nCritique Dr. Analogy's explanation for any oversimplifications or technical omissions, clarify the precise definition, and end with one challenging question for the student.`);
      setTurns((t) => [...t, { who: "compiler", text: b }]);
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">🗣️ Socratic Debate Arena</h2>
        <p className="text-muted-foreground">Dr. Analogy 🎩 vs. The Strict Compiler 🤖</p>
      </div>

      <div className="arcade-card p-4 min-h-[300px] space-y-3">
        {turns.length === 0 && <p className="text-muted-foreground text-center py-10">Ask a question about your lecture to start the debate!</p>}
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-3 animate-bounce-in ${t.who === "user" ? "justify-end" : ""}`}>
            {t.who !== "user" && (
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                t.who === "analogy" ? "bg-amber-arcade/30 border-2 border-amber-arcade" : "bg-indigo-arcade/30 border-2 border-indigo-arcade"
              }`}>
                {t.who === "analogy" ? "🎩" : "🤖"}
              </div>
            )}
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
              t.who === "user" ? "bg-fuchsia-arcade text-primary-foreground"
              : t.who === "analogy" ? "bg-amber-arcade/15 border border-amber-arcade/50"
              : "bg-indigo-arcade/15 border border-indigo-arcade/50"
            }`}>
              {t.who !== "user" && <div className="text-xs font-bold mb-1 opacity-70">{t.who === "analogy" ? "Dr. Analogy" : "The Strict Compiler"}</div>}
              {t.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-center text-muted-foreground"><Loader2 className="inline animate-spin h-4 w-4" /> Thinking...</div>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Ask: 'Explain recursion'..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && ask()}
        />
        <Button onClick={ask} disabled={loading} className="bg-fuchsia-arcade hover:bg-fuchsia-arcade/80">Ask</Button>
      </div>
    </div>
  );
}
