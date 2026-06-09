import { useState } from "react";
import { useArcade } from "../store";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export function ArcadeArena() {
  const { activeLecture, addXp, addMistake, unlock } = useArcade();
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!activeLecture) {
    return <div className="arcade-card p-6">📚 Select a lecture in the Deck first to play the quiz!</div>;
  }

  const quiz = activeLecture.parsed.quiz;
  const q = quiz[i];

  function pick(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === q.correct_index;
    if (correct) {
      setScore((s) => s + 1);
    } else {
      addMistake({
        question: q.question,
        selected: q.options[idx],
        correct: q.options[q.correct_index],
        lectureTitle: activeLecture!.title,
      });
    }
  }

  function next() {
    if (i + 1 >= quiz.length) {
      setDone(true);
      addXp(50);
      unlock("quiz-complete");
      toast.success("🎉 +50 XP! Quiz complete!", { className: "animate-bounce-in" });
      return;
    }
    setI(i + 1);
    setSelected(null);
  }

  function reset() {
    setI(0); setSelected(null); setScore(0); setDone(false);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">🎮 Arcade Arena</h2>
        <p className="text-muted-foreground">Quiz: <strong>{activeLecture.title}</strong></p>
      </div>

      {done ? (
        <div className="arcade-card p-8 text-center animate-bounce-in">
          <Trophy className="h-20 w-20 mx-auto text-amber-arcade animate-pulse-glow" />
          <h3 className="text-3xl font-bold mt-4 neon-text">Victory!</h3>
          <p className="text-xl mt-2">{score} / {quiz.length} correct</p>
          <p className="text-emerald-arcade text-2xl font-bold mt-3">+50 XP ✨</p>
          <Button onClick={reset} className="mt-4 bg-fuchsia-arcade hover:bg-fuchsia-arcade/80">
            <Sparkles className="h-4 w-4 mr-1" /> Play Again
          </Button>
        </div>
      ) : (
        <div className="arcade-card p-6 animate-bounce-in">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Question {i + 1} of {quiz.length}</span>
            <span>Score: {score}</span>
          </div>
          <h3 className="text-xl font-bold mb-4">{q.question}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {q.options.map((o, idx) => {
              const isCorrect = idx === q.correct_index;
              const isSelected = idx === selected;
              const show = selected !== null;
              const cls = !show
                ? "border-border hover:bg-muted hover:scale-[1.02]"
                : isCorrect
                ? "border-emerald-arcade bg-emerald-arcade/20"
                : isSelected
                ? "border-destructive bg-destructive/20 animate-shake"
                : "border-border opacity-50";
              return (
                <button
                  key={idx}
                  disabled={show}
                  onClick={() => pick(idx)}
                  className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-2 ${cls}`}
                >
                  {show && isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-arcade" />}
                  {show && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" />}
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm animate-bounce-in">
              <strong>Explanation:</strong> {q.explanations[selected]}
            </div>
          )}
          {selected !== null && (
            <Button onClick={next} className="mt-4 w-full bg-fuchsia-arcade hover:bg-fuchsia-arcade/80">
              {i + 1 >= quiz.length ? "Finish" : "Next →"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
