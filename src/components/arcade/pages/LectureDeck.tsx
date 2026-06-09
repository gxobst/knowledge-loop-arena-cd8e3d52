import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useArcade, type Lecture } from "../store";
import { MOCK_WORKSPACES, callAIGateway, extractJSON, isConfigured, loadSettings, PARSE_PROMPT, type ParsedLecture } from "@/lib/aiGateway";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { showApiError } from "../ErrorToast";
import { toast } from "sonner";

export function LectureDeck() {
  const { lectures, activeLecture, setActiveLecture, setLectures } = useArcade();
  const [workspace, setWorkspace] = useState<string>("All");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const configured = isConfigured(loadSettings());

  const filtered = workspace === "All" ? lectures : lectures.filter((l) => l.workspace === workspace);

  async function parseText(text: string, titleHint: string) {
    if (!text.trim()) {
      toast.error("Paste some lecture text first!");
      return;
    }
    if (!configured) {
      toast.warning("Using mock parser — connect an AI in Settings ⚙️");
      const fake: ParsedLecture = {
        subject: "Custom",
        difficulty: "Intermediate",
        tags: ["pasted", "custom"],
        summary: `- 📝 Quick mock summary of: *${titleHint}*\n- 🔌 Connect an AI model to get real parsing.`,
        flashcards: [{ term: "Term", definition: "Definition" }],
        quiz: [{
          question: "Sample question?",
          options: ["A", "B", "C", "D"],
          correct_index: 0,
          explanations: ["Right!", "Nope.", "Nope.", "Nope."],
        }],
      };
      addLecture(titleHint, text, fake);
      return;
    }
    setLoading(true);
    try {
      const raw = await callAIGateway(PARSE_PROMPT(text), true);
      const parsed = extractJSON<ParsedLecture>(raw);
      addLecture(titleHint, text, parsed);
      toast.success("✨ Lecture parsed!");
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  }

  function addLecture(title: string, raw: string, parsed: ParsedLecture) {
    const l: Lecture = { id: crypto.randomUUID(), title, workspace: parsed.subject || "Custom", raw, parsed };
    setLectures([l, ...lectures]);
    setActiveLecture(l);
    setPasted("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">📚 My Lecture Deck</h2>
        <p className="text-muted-foreground">Granola Hub — pull, parse, and master your notes.</p>
      </div>

      {!configured && (
        <div className="arcade-card p-4 border-amber-arcade bg-amber-arcade/10 flex items-start gap-3 animate-pulse-glow">
          <AlertTriangle className="text-amber-arcade h-5 w-5 mt-0.5" />
          <div className="text-sm">
            <strong>No AI configured.</strong> Open ⚙️ AI Engine Settings to add an API key. Meanwhile, enjoy pre-parsed mock lectures!
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Granola Workspace</label>
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="w-full mt-1 rounded-md bg-input border border-border p-2"
            >
              <option>All</option>
              {MOCK_WORKSPACES.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLecture(l)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  activeLecture?.id === l.id
                    ? "bg-fuchsia-arcade/20 border-fuchsia-arcade"
                    : "bg-card border-border hover:bg-muted hover:scale-[1.02]"
                }`}
              >
                <div className="font-semibold text-sm">{l.title}</div>
                <div className="text-xs text-muted-foreground">{l.workspace} · {l.parsed.difficulty}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="arcade-card p-4">
            <h3 className="font-bold mb-2">✍️ Manual Paste</h3>
            <Textarea
              rows={4}
              placeholder="Paste lecture notes or transcript here..."
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => parseText(pasted, "Pasted Notes")}
                disabled={loading}
                className="bg-fuchsia-arcade hover:bg-fuchsia-arcade/80"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Parse with AI
              </Button>
              {activeLecture && (
                <Button variant="secondary" onClick={() => parseText(activeLecture.raw, activeLecture.title)} disabled={loading}>
                  Re-parse active lecture
                </Button>
              )}
            </div>
          </div>

          {activeLecture && (
            <>
              <div className="arcade-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-bold text-lg">🍰 Bite-Sized Summary — {activeLecture.title}</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {activeLecture.parsed.tags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-indigo-arcade/30 border border-indigo-arcade">{t}</span>
                    ))}
                  </div>
                </div>
                <Markdown text={activeLecture.parsed.summary} />
              </div>

              <div className="arcade-card p-5">
                <h3 className="font-bold text-lg mb-3">🃏 Flashcard Arena (click to flip!)</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeLecture.parsed.flashcards.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setFlipped((p) => ({ ...p, [i]: !p[i] }))}
                      className={`flip-card cursor-pointer h-36 ${flipped[i] ? "flipped" : ""}`}
                    >
                      <div className="flip-inner">
                        <div className="flip-face arcade-card flex items-center justify-center p-4 text-center font-bold text-fuchsia-arcade">
                          {f.term}
                        </div>
                        <div className="flip-face flip-back arcade-card flex items-center justify-center p-4 text-center text-sm">
                          {f.definition}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  // Tiny markdown for bullets + bold + italic
  const lines = text.split("\n");
  return (
    <ul className="space-y-1.5">
      {lines.filter((l) => l.trim()).map((l, i) => {
        const stripped = l.replace(/^\s*[-*]\s*/, "");
        const html = stripped
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        return <li key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: "• " + html }} />;
      })}
    </ul>
  );
}
