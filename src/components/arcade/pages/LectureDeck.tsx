import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useArcade, type Lecture } from "../store";
import { MOCK_WORKSPACES, callAIGateway, extractJSON, isConfigured, loadSettings, PARSE_PROMPT, type ParsedLecture } from "@/lib/aiGateway";
import { Loader2, Sparkles, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { showApiError } from "../ErrorToast";
import { toast } from "sonner";

// Datastore containing unparsed notes pulled fresh from Granola workspaces
const FRESH_GRANOLA_TRANSCRIPTS = [
  {
    id: "g-raw-1",
    title: "MIT CS 6.100L Lecture 1 — Computation Notes",
    workspace: "Computer Science",
    raw: "Lecture notes on computation, primitive data types, evaluation of expressions, operators, and interpreter behavior in modern environments like Python. Variables bind specific memory locations to reuse references across sequences."
  },
  {
    id: "g-raw-2",
    title: "Intro to Photosynthesis Meeting",
    workspace: "Biology",
    raw: "Photosynthesis converts light energy into complex chemical configurations. The process relies on chlorophyll pigments stored directly within plant chloroplast architectures to successfully execute light reactions alongside the traditional Calvin cycle."
  },
  {
    id: "g-raw-3",
    title: "Macroeconomics Principles & Inflationary Pressures",
    workspace: "Economics",
    raw: "An examination of how shifts in structural liquidity and consumer index metrics force monetary updates. Discussed pricing structures, supply chain disruptions, and historic models tracking resource pricing behavior."
  },
  {
    id: "g-raw-4",
    title: "Renaissance Art Movements & Perspectives",
    workspace: "Art History",
    raw: "A comprehensive breakdown of linear perspective techniques introduced during the early 15th century. Explored humanism impacts on iconographic choices and panel painting compositions across Florence."
  }
];

export function LectureDeck() {
  const { lectures, activeLecture, setActiveLecture, setLectures } = useArcade();
  const [workspace, setWorkspace] = useState<string>("All");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const configured = isConfigured(loadSettings());

  // Workspace filtering logic
  const filteredGranola = workspace === "All" 
    ? FRESH_GRANOLA_TRANSCRIPTS 
    : FRESH_GRANOLA_TRANSCRIPTS.filter((t) => t.workspace === workspace);

  const filteredMastered = workspace === "All" 
    ? lectures 
    : lectures.filter((l) => l.workspace === workspace);

  async function parseText(text: string, titleHint: string, assumedWorkspace: string = "Custom") {
    if (!text.trim()) {
      toast.error("Pasted text content cannot be empty!");
      return;
    }
    
    setLoading(true);
    
    if (!configured) {
      toast.warning("Using mock fallback parser — Check AI Engine Control ⚙️");
      const fake: ParsedLecture = {
        subject: assumedWorkspace,
        difficulty: "Intermediate",
        tags: ["imported", assumedWorkspace.toLowerCase().replace(" ", "-")],
        summary: `- 📝 **Instant summary generated** for raw file: *${titleHint}*\n- 🔌 Configure an API engine key in your options modal to process live tokens.`,
        flashcards: [
          { term: "Core Concept", definition: `Primary takeaway parsed from ${titleHint}.` },
          { term: "Terminology Reference", definition: "A placeholder technical definition for offline debugging." }
        ],
        quiz: [{
          question: `Which topic best summarizes the imported ${titleHint} file?`,
          options: [assumedWorkspace, "Unrelated Category A", "Unrelated Category B", "None of the above"],
          correct_index: 0,
          explanations: ["Correct — Parsed item classification match.", "Incorrect option choice.", "Incorrect option choice.", "Incorrect option choice."],
        }],
      };
      
      addLecture(titleHint, text, fake);
      setLoading(false);
      return;
    }

    try {
      const rawResponse = await callAIGateway(PARSE_PROMPT(text), true);
      const parsedData = extractJSON<ParsedLecture>(rawResponse);
      
      // Ensure subject aligns with workspace categorization if model drifts
      if (!parsedData.subject || parsedData.subject === "Custom") {
        parsedData.subject = assumedWorkspace;
      }
      
      addLecture(titleHint, text, parsedData);
      toast.success("⚡ Transcript processed and loaded into Portal Deck!");
    } catch (e) {
      showApiError(e);
    } {
      setLoading(false);
    }
  }

  function addLecture(title: string, raw: string, parsed: ParsedLecture) {
    const newLecture: Lecture = {
      id: crypto.randomUUID(),
      title,
      workspace: parsed.subject || "Custom",
      raw,
      parsed
    };
    setLectures([newLecture, ...lectures]);
    setActiveLecture(newLecture);
    setPasted("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">📚 My Lecture Deck</h2>
        <p className="text-muted-foreground">Granola Hub — pull transcripts from your workspaces, parse, and master your materials.</p>
      </div>

      {!configured && (
        <div className="arcade-card p-4 border-amber-arcade bg-amber-arcade/10 flex items-start gap-3 animate-pulse-glow">
          <AlertTriangle className="text-amber-arcade h-5 w-5 mt-0.5" />
          <div className="text-sm">
            <strong>No active gateway connection found.</strong> Open ⚙️ AI Engine Control to configure credentials. Currently utilizing the integrated offline analyzer engine.
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        {/* SIDEBAR TRANSCRIPT ROUTER CONSOLE */}
        <div className="space-y-4">
          <div className="arcade-card p-3 bg-muted/20">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Granola Workspace</label>
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="w-full mt-1.5 rounded-md bg-input border border-border p-2 text-sm text-foreground focus:outline-none focus:border-indigo-arcade"
            >
              <option>All</option>
              {MOCK_WORKSPACES.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>

          {/* FRESH UNPARSED NOTES SECTION */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-arcade flex items-center gap-1.5 px-1">
              <FileText className="h-3.5 w-3.5" /> Granola Raw Notes ({filteredGranola.length})
            </h4>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {filteredGranola.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">No unparsed items in workspace.</p>
              ) : (
                filteredGranola.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => parseText(t.raw, t.title, t.workspace)}
                    disabled={loading}
                    className="w-full text-left p-2.5 rounded-lg border border-dashed border-muted-foreground/30 bg-card/40 hover:bg-amber-arcade/10 hover:border-amber-arcade transition-all text-xs group flex flex-col gap-1 disabled:opacity-50"
                  >
                    <div className="font-semibold text-foreground group-hover:text-amber-arcade transition-colors line-clamp-1">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between w-full">
                      <span>Workspace: {t.workspace}</span>
                      <span className="text-amber-arcade font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        Parse <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* PARSED CHANNELS */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-fuchsia-arcade px-1">
              🎮 Mastered Portal Deck ({filteredMastered.length})
            </h4>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {filteredMastered.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">No parsed study guides available.</p>
              ) : (
                filteredMastered.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLecture(l)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activeLecture?.id === l.id
                        ? "bg-fuchsia-arcade/20 border-fuchsia-arcade"
                        : "bg-card border-border hover:bg-muted hover:scale-[1.01]"
                    }`}
                  >
                    <div className="font-semibold text-sm line-clamp-1">{l.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.workspace} · <span className="text-emerald-arcade font-medium">{l.parsed.difficulty}</span></div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* WORKSPACE OPERATIONS DISPLAY MAIN HUB */}
        <div className="space-y-4">
          <div className="arcade-card p-4">
            <h3 className="font-bold mb-2 text-sm text-foreground">✍️ Alternative Manual Paste Input</h3>
            <Textarea
              rows={3}
              placeholder="Alternative option: Paste custom raw items or transcripts directly into this terminal..."
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              className="bg-input/60 border-border text-sm focus-visible:ring-fuchsia-arcade"
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => parseText(pasted, "Manually Pasted Notes", "Custom")}
                disabled={loading || !pasted.trim()}
                className="bg-fuchsia-arcade hover:bg-fuchsia-arcade/80 text-xs h-9"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Parse Manual Text
              </Button>
              {activeLecture && (
                <Button 
                  variant="secondary" 
                  onClick={() => parseText(activeLecture.raw, activeLecture.title, activeLecture.workspace)} 
                  disabled={loading}
                  className="text-xs h-9"
                >
                  Re-parse Active Guide
                </Button>
              )}
            </div>
          </div>

          {activeLecture ? (
            <>
              {/* BITE-SIZED SUMMARY TERMINAL */}
              <div className="arcade-card p-5 border-l-4 border-l-indigo-arcade">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-bold text-lg text-foreground">🍰 Summary Panel — {activeLecture.title}</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {activeLecture.parsed.tags.map((t) => (
                      <span key={t} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-arcade/20 border border-indigo-arcade/40 text-indigo-arcade">{t}</span>
                    ))}
                  </div>
                </div>
                <Markdown text={activeLecture.parsed.summary} />
              </div>

              {/* FLASHCARD VIEW */}
              <div className="arcade-card p-5">
                <h3 className="font-bold text-lg mb-3 text-foreground">🃏 Flashcard Arena (Click card to flip)</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeLecture.parsed.flashcards.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setFlipped((p) => ({ ...p, [i]: !p[i] }))}
                      className={`flip-card cursor-pointer h-36 ${flipped[i] ? "flipped" : ""}`}
                    >
                      <div className="flip-inner">
                        <div className="flip-face arcade-card flex items-center justify-center p-4 text-center font-bold text-fuchsia-arcade text-sm bg-card/60">
                          {f.term}
                        </div>
                        <div className="flip-face flip-back arcade-card flex items-center justify-center p-4 text-center text-xs bg-muted/40 text-foreground border-indigo-arcade/50">
                          {f.definition}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="arcade-card p-12 border-dashed flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/5">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-2 animate-bounce" />
              <h3 className="font-bold text-lg text-foreground/80">Study Arena Offline</h3>
              <p className="text-sm max-w-sm mt-1">Select an item from the <strong>Granola Raw Notes</strong> sidebar console to run the engine mapping sequence.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <ul className="space-y-2">
      {lines.filter((l) => l.trim()).map((l, i) => {
        const stripped = l.replace(/^\s*[-*]\s*/, "");
        const html = stripped
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        return <li key={i} className="text-sm text-foreground/90" dangerouslySetInnerHTML={{ __html: "• " + html }} />;
      })}
    </ul>
  );
}