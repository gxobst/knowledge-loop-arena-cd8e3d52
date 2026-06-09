import { ProgressBars, StreakRing } from "../charts";
import { useArcade } from "../store";

export function Dashboard() {
  const { xp, streak, lectures, achievements } = useArcade();
  const unlocked = Object.values(achievements).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">🏠 Welcome back, Player One!</h2>
        <p className="text-muted-foreground">Your study quest continues — keep that streak alive! ✨</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="arcade-card arcade-card-hover p-5 flex flex-col items-center">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Streak Tracker</h3>
          <StreakRing value={streak} />
          <p className="mt-2 text-amber-arcade font-bold">🔥 {streak}-Day Streak!</p>
        </div>
        <div className="arcade-card arcade-card-hover p-5">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">XP this week</h3>
          <ProgressBars
            data={[
              { label: "Mon", value: 30, color: "oklch(0.68 0.28 340)" },
              { label: "Tue", value: 55, color: "oklch(0.55 0.22 280)" },
              { label: "Wed", value: 80, color: "oklch(0.82 0.18 80)" },
              { label: "Thu", value: 45, color: "oklch(0.72 0.18 160)" },
              { label: "Fri", value: 90, color: "oklch(0.68 0.28 340)" },
            ]}
          />
        </div>
        <div className="arcade-card arcade-card-hover p-5 flex flex-col">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Quick Stats</h3>
          <div className="flex-1 grid grid-cols-2 gap-3 mt-2">
            <Stat label="Total XP" value={xp} color="text-emerald-arcade" />
            <Stat label="Lectures" value={lectures.length} color="text-fuchsia-arcade" />
            <Stat label="Trophies" value={unlocked} color="text-amber-arcade" />
            <Stat label="Streak" value={streak} color="text-indigo-arcade" />
          </div>
        </div>
      </div>

      <div className="arcade-card p-5">
        <h3 className="text-lg font-bold mb-3">📈 Mastery Progress</h3>
        <ProgressBars
          data={lectures.slice(0, 4).map((l, i) => ({
            label: l.parsed.subject.slice(0, 6),
            value: 40 + i * 15,
            color: ["oklch(0.68 0.28 340)", "oklch(0.55 0.22 280)", "oklch(0.82 0.18 80)", "oklch(0.72 0.18 160)"][i % 4],
          }))}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/40">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
