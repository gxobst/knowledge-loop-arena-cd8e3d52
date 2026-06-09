import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useArcade, type Lecture } from "../store";
import {
  callAIGateway,
  extractJSON,
  isConfigured,
  loadSettings,
  PARSE_PROMPT,
  type ParsedLecture,
  fetchGranolaNotes,
  type GranolaNote,
  FALLBACK_MOCK_NOTES
} from "@/lib/aiGateway";
import { Loader2, Sparkles, AlertTriangle, FileText, ArrowRight, Trash2, BookOpen } from "lucide-react";
import { showApiError } from "../ErrorToast";
import { toast } from "sonner";

export function LectureDeck() {
  const { lectures, activeLecture, setActiveLecture, setLectures } = useArcade();
  const [workspace, setWorkspace] = useState<string>("All");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const configured = isConfigured(loadSettings());

  // Dynamic raw granola notes state
  const [rawNotes, setRawNotes] = useState<GranolaNote[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const val = localStorage.getItem("lectureloop_raw_notes");
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  // Highlighted unparsed note from the sidebar
  const [selectedRawNote, setSelectedRawNote] = useState<GranolaNote | null>(null);

  // Sync rawNotes to localStorage
  const saveRawNotes = (notes: GranolaNote[]) => {
    setRawNotes(notes);
    localStorage.setItem("lectureloop_raw_notes", JSON.stringify(notes));
  };

  // On mount, fetch granola notes if none exist in localStorage
  useEffect(() => {
    async function loadNotes() {
      const stored = localStorage.getItem("lectureloop_raw_notes");
      if (!stored || JSON.parse(stored).length === 0) {
        try {
          const notes = await fetchGranolaNotes();
          saveRawNotes(notes);
        } catch (err) {
          console.error("Failed to load Granola notes on mount:", err);
        }
      }
    }
    loadNotes();
  }, []);

  // Workspace list built dynamically from fetched granola workspace folders
  const uniqueWorkspaces = Array.from(new Set(rawNotes.map((n) => n.workspace))).filter(Boolean);

  // Workspace filtering logic
  const filteredGranola = workspace === "All"
    ? rawNotes
    : rawNotes.filter((t) => t.workspace === workspace);

  const filteredMastered = workspace === "All"
    ? lectures
    : lectures.filter((l) => l.workspace === workspace);

  // Load mock data on demand
  const handleLoadMockData = () => {
    const newNotes = [...rawNotes];
    FALLBACK_MOCK_NOTES.forEach((mock) => {
      if (!newNotes.some((n) => n.id === mock.id || n.title === mock.title)) {
        newNotes.push(mock);
      }
    });
    saveRawNotes(newNotes);
    toast.success("Sample mock data loaded successfully!");
  };

  // Trash handlers
  const handleDeleteRawNote = (noteId: string) => {
    const updated = rawNotes.filter((n) => n.id !== noteId);
    saveRawNotes(updated);
    if (selectedRawNote?.id === noteId) {
      setSelectedRawNote(null);
    }
    toast.success("Raw note deleted.");
  };

  const handleDeleteMasteredNote = (noteId: string) => {
    const updated = lectures.filter((l) => l.id !== noteId);
    setLectures(updated);
    if (activeLecture?.id === noteId) {
      setActiveLecture(null);
    }
    toast.success("Mastered note deleted.");
  };

  // Main parse AI action
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
      showApiError(e, () => {
        // Fallback option in case of error
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
        toast.info("Loaded mock fallback data.");
      });
    } finally {
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

    // Deduplication check: Validate if the note is already in the masteredDeck array by verifying its unique ID or title.
    const exists = lectures.some((l) => l.title === newLecture.title);
    if (!exists) {
      setLectures([newLecture, ...lectures]);
    }
    setActiveLecture(newLecture);
    setSelectedRawNote(null);
    setPasted("");
  }

  // Add to Mastered Deck button click handler
  const handleAddToMasteredDeck = (lecture: Lecture) => {
    const exists = lectures.some((l) => l.title === lecture.title || l.id === lecture.id);
    if (!exists) {
      setLectures([lecture, ...lectures]);
      toast.success("🏆 Added to Mastered Deck!");
    } else {
      toast.info("Topic already mastered.");
    }
  };

  const handleSelectRawNote = (note: GranolaNote) => {
    setActiveLecture(null);
    setSelectedRawNote(note);
  };

  const handleSelectMasteredNote = (lecture: Lecture) => {
    setSelectedRawNote(null);
    setActiveLecture(lecture);
  };

  const showInitialPlaceholder = rawNotes.length === 0 && !activeLecture && !selectedRawNote;
  const isMastered = activeLecture ? lectures.some((l) => l.title === activeLecture.title || l.id === activeLecture.id) : false;

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
              <option value="All">All</option>
              {uniqueWorkspaces.map((w) => <option key={w} value={w}>{w}</option>)}
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
                  <div
                    key={t.id}
                    className={`group flex items-center justify-between gap-1 w-full rounded-lg border border-dashed transition-all ${
                      selectedRawNote?.id === t.id
                        ? "bg-amber-arcade/20 border-amber-arcade"
                        : "bg-card/40 border-muted-foreground/30 hover:bg-amber-arcade/10 hover:border-amber-arcade hover:scale-[1.01]"
                    }`}
                  >
                    <button
                      disabled={loading}
                      onClick={() => handleSelectRawNote(t)}
                      className="flex-1 text-left p-2.5 flex flex-col gap-1 disabled:opacity-50"
                    >
                      <div className="font-semibold text-foreground group-hover:text-amber-arcade transition-colors line-clamp-1">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-between w-full">
                        <span>Workspace: {t.workspace}</span>
                        <span className="text-amber-arcade font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          View <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRawNote(t.id);
                      }}
                      className="p-2 mr-1 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/15"
                      title="Delete raw note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                  <div
                    key={l.id}
                    className={`group flex items-center justify-between gap-1 w-full rounded-lg border transition-all ${
                      activeLecture?.id === l.id
                        ? "bg-fuchsia-arcade/20 border-fuchsia-arcade"
                        : "bg-card border-border hover:bg-muted hover:scale-[1.01]"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectMasteredNote(l)}
                      className="flex-1 text-left p-3"
                    >
                      <div className="font-semibold text-sm line-clamp-1">{l.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{l.workspace} · <span className="text-emerald-arcade font-medium">{l.parsed.difficulty}</span></div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMasteredNote(l.id);
                      }}
                      className="p-2 mr-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/15"
                      title="Delete mastered note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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

          {showInitialPlaceholder ? (
            <div className="arcade-card p-12 text-center flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-indigo-arcade/50 bg-indigo-arcade/5 animate-bounce-in">
              <BookOpen className="h-16 w-16 text-indigo-arcade animate-pulse" />
              <h3 className="font-bold text-xl text-foreground">No study modules loaded yet!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Paste a transcript, fetch from your Granola workspace, or load sample mock data to explore.
              </p>
              <Button
                onClick={handleLoadMockData}
                className="bg-indigo-arcade hover:bg-indigo-arcade/80 text-primary-foreground font-bold px-6 py-5 rounded-lg transition-all active:scale-95"
              >
                Load Sample Mock Data 📚
              </Button>
            </div>
          ) : selectedRawNote ? (
            <div className="arcade-card p-12 text-center flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-amber-arcade/50 bg-amber-arcade/5 animate-bounce-in">
              <FileText className="h-16 w-16 text-amber-arcade animate-pulse" />
              <h3 className="font-bold text-xl text-foreground">
                Study Arena - Selected Lecture: {selectedRawNote.title}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Click 'Import & Analyze' to process this meeting.
              </p>
              <div className="bg-muted/40 p-4 rounded-lg w-full text-left max-h-40 overflow-y-auto mb-2 text-xs border border-border">
                <strong>Raw Summary:</strong> {selectedRawNote.ai_summary}
              </div>
              <Button
                onClick={() => {
                  const promptText = `Summary: ${selectedRawNote.ai_summary}\n\nTranscript: ${selectedRawNote.transcript}`;
                  parseText(promptText, selectedRawNote.title, selectedRawNote.workspace);
                }}
                disabled={loading}
                className="bg-amber-arcade hover:bg-amber-arcade/80 text-background font-bold text-base px-6 py-6 rounded-xl animate-pulse-glow"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Import & Analyze with AI ⚡
                  </>
                )}
              </Button>
            </div>
          ) : activeLecture ? (
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
                <div className="mb-4">
                  <Markdown text={activeLecture.parsed.summary} />
                </div>
                <div className="pt-3 border-t border-border/50">
                  <Button
                    onClick={() => handleAddToMasteredDeck(activeLecture)}
                    disabled={isMastered}
                    className={`w-full py-5 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                      isMastered
                        ? "bg-emerald-arcade/20 border border-emerald-arcade text-emerald-arcade opacity-80 cursor-not-allowed"
                        : "bg-amber-arcade hover:bg-amber-arcade/80 text-background"
                    }`}
                  >
                    {isMastered ? "Topic Mastered ✔️" : "Add to Mastered Deck 🏆"}
                  </Button>
                </div>
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