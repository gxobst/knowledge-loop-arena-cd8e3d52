import { Settings, Home, BookOpen, Gamepad2, MessageSquare, Brain, FileCheck2, Trophy, Zap, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SettingsModal } from "./SettingsModal";
import { useArcade } from "./store";
import { toast } from "sonner";

export type Page =
  | "dashboard"
  | "deck"
  | "arcade"
  | "socratic"
  | "architect"
  | "critique"
  | "achievements";

const NAV: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "🏠 Dashboard", icon: Home },
  { id: "deck", label: "📚 Lecture Deck", icon: BookOpen },
  { id: "arcade", label: "🎮 Arcade Arena", icon: Gamepad2 },
  { id: "socratic", label: "Socratic Debate", icon: MessageSquare },
  { id: "architect", label: "Curriculum Architect", icon: Brain },
  { id: "critique", label: "Critique Sandbox", icon: FileCheck2 },
  { id: "achievements", label: "🏆 Achievements", icon: Trophy },
];

export function AppShell({ page, onPage, children }: { page: Page; onPage: (p: Page) => void; children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { xp, streak, resetStudyProgress } = useArcade();

  const handleReset = () => {
    const ok = window.confirm("Are you sure you want to reset your study quest? This will clear your XP, streak, mastered deck, and tracking history, but will NOT delete your API credentials.");
    if (ok) {
      resetStudyProgress();
      toast.success("Study quest has been reset!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🕹️</div>
            <div>
              <h1 className="text-xl font-bold neon-text">LectureLoop Arcade</h1>
              <p className="text-xs text-muted-foreground">Level up your learning</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-arcade/20 border border-amber-arcade text-amber-arcade font-bold text-sm">
              🔥 {streak}-Day Streak
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-arcade/20 border border-emerald-arcade text-emerald-arcade font-bold text-sm">
              <Zap className="h-4 w-4" /> {xp} XP
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-all hover:scale-110 duration-200"
              aria-label="Reset Study Quest"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-all hover:rotate-90 duration-300"
              aria-label="AI Engine Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {NAV.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onPage(n.id)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all duration-200 font-medium ${
                  active
                    ? "bg-fuchsia-arcade text-primary-foreground shadow-lg scale-105"
                    : "bg-card border border-border hover:bg-muted hover:scale-105"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 animate-bounce-in">{children}</main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
