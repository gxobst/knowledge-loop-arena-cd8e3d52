import { useState } from "react";
import { useArcade } from "../store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileCheck2, Loader2 } from "lucide-react";
import { callAIGateway } from "@/lib/aiGateway";
import { showApiError } from "../ErrorToast";

export function CritiqueSandbox() {
  const { activeLecture } = useArcade();
  const [answer, setAnswer] = useState("");
  const [step1, setStep1] = useState("");
  const [step2, setStep2] = useState("");
  const [loading, setLoading] = useState(false);

  const prompt = activeLecture
    ? `Summarize in your own words: "${activeLecture.title}"`
    : "Pick a topic and explain it in your own words.";

  async function evaluate() {
    if (!answer.trim()) return;
    setLoading(true);
    setStep1(""); setStep2("");

    try {
      const ctx = activeLecture 
        ? `LECTURE CONTEXT (CORE SOURCE OF TRUTH):\n${activeLecture.raw}\n\n` 
        : "";
      const s1 = await callAIGateway(
        `${ctx}Question: ${prompt}\nStudent Answer: ${answer}\n\n` +
        `Grade the student's response out of 10 and write initial critique feedback. ` +
        `You must strictly evaluate the factual accuracy of the student's answer based on the facts explicitly discussed in the provided lecture transcript. Do NOT allow any assumptions or external facts outside of the transcript context.`
      );
      setStep1(s1);
      const s2 = await callAIGateway(`Read your previous grading critique below. Refine it to ensure it is incredibly supportive, doesn't give away the correct answer, and generates 3 incremental hints to help the student improve their score.\n\nPrevious critique:\n${s1}`);
      setStep2(s2);
    } catch (e) {
      showApiError(e, () => {
        setStep1("**Score: 7/10** — Good effort! Your answer shows understanding but could be more specific.");
        setStep2("🌟 You're on the right track! Try these hints:\n1. 🧩 Think about *why* this concept matters.\n2. 🔍 Add one concrete example.\n3. ✨ Try to connect it to something you already know.\n\n_[Mock feedback — connect an AI for real grading.]_");
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">📝 Critique Sandbox</h2>
        <p className="text-muted-foreground">Open-ended writing with self-correcting AI feedback.</p>
      </div>

      <div className="arcade-card p-5">
        <h3 className="font-bold mb-2">✍️ Prompt</h3>
        <p className="text-sm text-fuchsia-arcade mb-3">{prompt}</p>
        <Textarea
          rows={6}
          placeholder="Type your answer in your own words..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <Button onClick={evaluate} disabled={loading} className="mt-3 bg-fuchsia-arcade hover:bg-fuchsia-arcade/80">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck2 className="h-4 w-4 mr-1" />}
          Evaluate Answer
        </Button>
      </div>

      {step1 && (
        <div className="arcade-card p-5 opacity-70">
          <h3 className="font-bold text-sm mb-2 text-muted-foreground">Step A — Initial Critique (draft)</h3>
          <div className="whitespace-pre-wrap text-sm">{step1}</div>
        </div>
      )}

      {step2 && (
        <div className="arcade-card p-5 border-2 border-emerald-arcade animate-pulse-glow animate-bounce-in">
          <h3 className="font-bold mb-2 flex items-center gap-2 text-emerald-arcade">✨ Refined Supportive Feedback</h3>
          <div className="whitespace-pre-wrap text-sm">{step2}</div>
        </div>
      )}
    </div>
  );
}
