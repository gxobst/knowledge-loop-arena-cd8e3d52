import { useArcade } from "../store";

const BADGES: { id: string; emoji: string; name: string; desc: string }[] = [
  { id: "first-quiz", emoji: "🎯", name: "First Quest", desc: "Started your first quiz" },
  { id: "streak-3", emoji: "🔥", name: "On Fire", desc: "3-day study streak" },
  { id: "quiz-complete", emoji: "🏆", name: "Quiz Master", desc: "Completed a full quiz" },
  { id: "streak-7", emoji: "⚡", name: "Lightning Mind", desc: "7-day study streak" },
  { id: "ai-tamer", emoji: "🤖", name: "AI Tamer", desc: "Connected an AI model" },
  { id: "polyglot", emoji: "🌍", name: "Polyglot", desc: "Studied 5 different subjects" },
  { id: "socratic", emoji: "🗣️", name: "Debater", desc: "Used the Socratic Arena" },
  { id: "perfectionist", emoji: "💎", name: "Perfectionist", desc: "Scored 100% on a quiz" },
];

export function Achievements() {
  const { achievements } = useArcade();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">🏆 Trophy Room</h2>
        <p className="text-muted-foreground">Collect them all, hero!</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {BADGES.map((b) => {
          const unlocked = !!achievements[b.id];
          return (
            <div
              key={b.id}
              className={`arcade-card p-5 text-center transition-all ${
                unlocked ? "arcade-card-hover animate-pulse-glow" : "opacity-40 grayscale"
              }`}
            >
              <div className="text-5xl mb-2">{b.emoji}</div>
              <div className="font-bold">{b.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
              <div className={`mt-2 text-xs font-bold ${unlocked ? "text-emerald-arcade" : "text-muted-foreground"}`}>
                {unlocked ? "UNLOCKED" : "LOCKED"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
