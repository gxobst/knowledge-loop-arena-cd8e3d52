import { useState } from "react";
import { useArcade } from "../store";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, Trash2 } from "lucide-react";
import { callAIGateway } from "@/lib/aiGateway";
import { showApiError } from "../ErrorToast";

export function CurriculumArchitect() {
  const { mistakes, clearMistakes } = useArcade();
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);

  async function consult() {
    if (mistakes.length === 0) {
      setPlan("✨ No mistakes yet — go play the Arcade Arena first!");
      return;
    }
    setLoading(true);
    const list = mistakes.map((m, i) => `${i + 1}. Q: ${m.question}\n   Student chose: "${m.selected}"\n   Correct: "${m.correct}"\n   From: ${m.lectureTitle}`).join("\n\n");
    const prompt = `You are the Curriculum Architect. Analyze these student mistakes, identify the exact cognitive gap, draft a 3-step highly personalized study path, and generate one unique practice question designed to test this weak point.\n\nMistakes:\n${list}`;



    try {
      const out = await callAIGateway(prompt);
      setPlan(out);
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">🧠 Curriculum Architect</h2>
        <p className="text-muted-foreground">Your personalized AI tutor — turns mistakes into mastery.</p>
      </div>

      <div className="arcade-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">📝 Tracked Mistakes ({mistakes.length})</h3>
          {mistakes.length > 0 && (
            <button onClick={clearMistakes} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> clear
            </button>
          )}
        </div>
        {mistakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mistakes tracked yet. Take a quiz!</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {mistakes.map((m, i) => (
              <li key={i} className="p-2 rounded bg-muted/40">
                <div className="font-semibold">{m.question}</div>
                <div className="text-xs"><span className="text-destructive">You: {m.selected}</span> · <span className="text-emerald-arcade">Correct: {m.correct}</span></div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button onClick={consult} disabled={loading} className="w-full bg-fuchsia-arcade hover:bg-fuchsia-arcade/80 text-base py-6">
        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Brain className="h-5 w-5 mr-2" />}
        Consult Architect 🧠
      </Button>

      {plan && (
        <div className="arcade-card p-5 border-2 border-emerald-arcade animate-pulse-glow animate-bounce-in">
          <h3 className="font-bold mb-2 flex items-center gap-2"><Brain className="text-emerald-arcade" /> Your Custom Pathway</h3>
          <div className="whitespace-pre-wrap text-sm">{plan}</div>
        </div>
      )}
    </div>
  );
}
