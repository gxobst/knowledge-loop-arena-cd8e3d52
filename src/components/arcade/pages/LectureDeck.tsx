import { useState, useEffect, useCallback } from "react";
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
  fetchGranolaFolders,
  fetchGranolaStatus,
  fetchGranolaNoteDetail,
  type GranolaNote,
  type GranolaFolder,
} from "@/lib/aiGateway";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  FileText,
  ArrowRight,
  Trash2,
  BookOpen,
  Plug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trophy,
  XCircle,
} from "lucide-react";
import { showApiError } from "../ErrorToast";
import { toast } from "sonner";

type ConnStatus = "idle" | "checking" | "connected" | "failed";

export function LectureDeck() {
  const { lectures, activeLecture, setActiveLecture, setLectures } = useArcade();
  
  // IMPLEMENT THREE-TIER STATE MANAGEMENT
  // State A: All raw meetings available in your Granola account (hidden from sidebar by default)
  const [allGranolaMeetings, setAllGranolaMeetings] = useState<any[]>([]);

  // State B: Only meetings the user has explicitly selected and imported from the selection pane
  const [importedRawNotes, setImportedRawNotes] = useState<any[]>([]);

  // State C: Only meetings successfully parsed by the AI (no raw transcripts shown here)
  const [masteredDeck, setMasteredDeck] = useState<any[]>([]);

  // UI States
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [selectedRawNote, setSelectedRawNote] = useState<any | null>(null);
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connError, setConnError] = useState<string | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"cheat" | "flashcards" | "quiz">("cheat");
  const [dropdownSelectedId, setDropdownSelectedId] = useState<string>("");
  const [showRawTextToggle, setShowRawTextToggle] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const configured = isConfigured(loadSettings());

  // Store Sync Hook — Sync local selectedNote with global activeLecture
  useEffect(() => {
    setActiveLecture(selectedNote);
  }, [selectedNote, setActiveLecture]);

  // Store Sync Hook — Sync local masteredDeck with global lectures
  useEffect(() => {
    setLectures(masteredDeck);
  }, [masteredDeck, setLectures]);

  // Initial Sync Hook — Load global lectures on mount if present (run once on mount)
  useEffect(() => {
    if (lectures && lectures.length > 0) {
      setMasteredDeck(lectures);
    }
    if (activeLecture) {
      setSelectedNote(activeLecture);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Granola Data Fetcher
  const fetchGranolaData = async () => {
    setNotesLoading(true);
    try {
      const notes = await fetchGranolaNotes();
      setAllGranolaMeetings(notes);
    } catch (e) {
      console.error("Failed to load Granola data:", e);
    } finally {
      setNotesLoading(false);
    }
  };

  // Initial mount connection check
  useEffect(() => {
    const checkLiveConnection = async () => {
      try {
        const res = await fetch('/api/granola/folders?page_size=30');
        if (res.ok) {
          fetchGranolaData();
        }
      } catch (e) {
        console.log("LectureDeck: Offline/unconfigured on initial mount. Keeping deck empty.");
      }
    };
    checkLiveConnection();
  }, []);

  // Connection Checker
  const checkConnection = useCallback(async () => {
    setConnStatus("checking");
    setConnError(null);
    setShowWarningBanner(false);

    const hasManualKey = !!(
      localStorage.getItem("granola_api_key") ||
      localStorage.getItem("lectureloop_granola_key")
    );

    if (hasManualKey) {
      setConnStatus("connected");
      setShowWarningBanner(false);
      void fetchGranolaData();
      return;
    }

    let canCommunicate = false;
    try {
      const res = await fetch("/api/ai/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "ping" }),
      });
      if (res.status !== 404 && res.status !== 502 && res.status !== 504) {
        canCommunicate = true;
      }
    } catch (e) {
      // ignore
    }

    const s = await fetchGranolaStatus();
    if (s.outcome === "gateway" || s.outcome === "manual_key") {
      canCommunicate = true;
    }

    if (s.connected) {
      setConnStatus("connected");
      setShowWarningBanner(false);
      void fetchGranolaData();
    } else {
      setConnStatus("failed");
      setConnError(s.reason ?? "No active gateway connection or Granola API key found.");
      setShowWarningBanner(!canCommunicate);
    }
  }, []);

  // Load Sample Mock Data handler (loads samples straight into State A selection dropdown)
  const handleLoadMockData = () => {
    const sampleModules = [
      {
        id: "mock-1",
        title: "MIT CS 6.100L Lecture 1 — Computation Notes",
        workspace_name: "Computer Science",
        ai_summary: "### Topics Covered\n- Declarative vs. Imperative knowledge.\n- How computers execute instructions.\n- Basic Python variables and scalar types (int, float, bool).",
        notes: "Professor Ana Bell. Declarative: statements of fact. Imperative: recipes/how-to.",
        transcript: "Welcome to 6.100L. Today we're learning the fundamentals of computer science. Declarative knowledge consists of statements of fact, whereas imperative knowledge is a recipe or a sequence of steps to solve a problem. In Python, variables bind a name to a value, and we have scalar types like int, float, and boolean."
      },
      {
        id: "mock-2",
        title: "Intro to Photosynthesis Meeting",
        workspace_name: "Biology",
        ai_summary: "### Topics Covered\n- Light-dependent reactions.\n- Calvin Cycle and ATP generation.",
        notes: "Light reactions occur in the thylakoid membrane. Calvin cycle occurs in the stroma.",
        transcript: "Let's review the photosynthesis workflow. First, we have the light-dependent reactions in the thylakoid membrane where chlorophyll absorbs light energy, generating ATP and NADPH. Then, the Calvin Cycle takes place in the stroma, using carbon dioxide to produce glucose."
      }
    ];

    setAllGranolaMeetings(prev => {
      const existingIds = new Set(prev.map(item => item.id));
      const uniqueNewSamples = sampleModules.filter(item => !existingIds.has(item.id));
      return [...prev, ...uniqueNewSamples];
    });
    
    toast.success("📚 Sample mock data loaded!");
  };

  const fakeFallback = (text: string, titleHint: string, assumedWorkspace = "Custom") => {
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    const terms = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g) ?? [];
    const blacklist = ["Summary", "Transcript", "Note", "Lecture", "Takeaway", "Key", "Insight", "General", "Custom", "AI", "Configure", "Engine"];
    const uniqueTerms = [...new Set(terms)].filter((t) => t.length > 3 && !blacklist.includes(t)).slice(0, 5);

    const flashcards =
      uniqueTerms.length >= 2
        ? uniqueTerms.map((term, i) => ({
            term,
            definition:
              sentences[i]?.slice(0, 140) ??
              `A concept from ${titleHint} relating to ${term.toLowerCase()}.`,
          }))
        : [
            {
              term: titleHint.split(/\s+/).slice(0, 3).join(" "),
              definition: sentences[0]?.slice(0, 140) ?? `Primary takeaway from ${titleHint}.`,
            },
            {
              term: "Key Insight",
              definition: sentences[1]?.slice(0, 140) ?? `An important concept discussed in this material.`,
            },
            {
              term: "Application",
              definition: sentences[2]?.slice(0, 140) ?? `How these ideas connect to the broader field of ${assumedWorkspace}.`,
            },
          ];

    return {
      subject: assumedWorkspace,
      difficulty: "Intermediate",
      tags: ["imported", assumedWorkspace.toLowerCase().replace(/\s+/g, "-")],
      summary:
        sentences.length >= 2
          ? sentences
              .slice(0, 4)
              .map((s, i) => `- ${["🧠", "📦", "🔄", "⚙️"][i % 4]} ${s}`)
              .join("\n")
          : `- 📝 **Summary** for *${titleHint}*\n- 🔌 Configure AI Engine to generate richer analysis.`,
      flashcards,
      quiz: [
        {
          question: `Which concept is most central to "${titleHint}"?`,
          options: [
            flashcards[0]?.term ?? assumedWorkspace,
            "Unrelated Topic A",
            "Unrelated Topic B",
            "None of the above",
          ],
          correct_index: 0,
          explanations: [
            "Correct — this is the primary focus.",
            "Incorrect.",
            "Incorrect.",
            "Incorrect.",
          ],
        },
      ],
    };
  };

  // Import Raw Note from State A (allGranolaMeetings) to State B (importedRawNotes)
  const handleImportRawNote = async () => {
    if (!dropdownSelectedId) return;
    const meeting = allGranolaMeetings.find(m => m.id === dropdownSelectedId);
    if (!meeting) return;

    try {
      setIsImporting(true);
      const res = await fetch(`/api/granola/notes/${meeting.id}?include=transcript`).catch(() => null);
      const detailNote = res && res.ok ? await res.json().catch(() => meeting) : meeting;

      setImportedRawNotes(prev => {
        if (prev.some(item => item.id === detailNote.id)) return prev;
        return [...prev, detailNote];
      });

      setDropdownSelectedId("");
      toast.success(`📥 Note "${detailNote.title}" imported!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import note.");
    } finally {
      setIsImporting(false);
    }
  };

  // Process raw note from State B, triggering AI completions and transferring note to State C (masteredDeck)
  const handleImportAndProcess = async (note: any) => {
    try {
      setIsImporting(true);
      
      let detailNote = note;
      if (!note.transcript) {
        const res = await fetch(`/api/granola/notes/${note.id}?include=transcript`).catch(() => null);
        detailNote = res && res.ok ? await res.json().catch(() => note) : note;
      }

      const richContext = `
        LECTURE TITLE: ${detailNote.title}
        FOLDER: ${detailNote.workspace_name || detailNote.workspace || 'General'}
        BRIEF NOTES: ${detailNote.notes || detailNote.ai_summary || ''}
        =========================================
        FULL MEETING TRANSCRIPT (CORE TRUTH):
        ${detailNote.transcript || detailNote.text || 'No transcript available.'}
      `;
      
      let parsedData: any;
      try {
        const rawResponse = await callAIGateway(PARSE_PROMPT(richContext), true);
        parsedData = extractJSON<any>(rawResponse);
      } catch (e) {
        console.warn("AI generation failed, using fallback mock parser:", e);
        parsedData = fakeFallback(richContext, detailNote.title, detailNote.workspace_name || detailNote.workspace || 'General');
      }

      const processedModule = {
        id: detailNote.id,
        title: detailNote.title,
        workspace: detailNote.workspace_name || detailNote.workspace || 'General',
        raw: richContext,
        summary: parsedData.summary,
        flashcards: parsedData.flashcards,
        quiz: parsedData.quiz,
        notes: detailNote.notes || detailNote.ai_summary || '',
        transcript: detailNote.transcript || detailNote.text || '',
        parsed: parsedData
      };

      setMasteredDeck(prev => {
        if (prev.some(item => item.id === processedModule.id)) return prev;
        return [...prev, processedModule];
      });

      setImportedRawNotes(prev => prev.filter(item => item.id !== note.id));
      
      setSelectedNote(processedModule);
      setSelectedRawNote(null);
      toast.success("🏆 Added to Mastered Deck!");
    } catch (error) {
      console.error("AI Generation failed:", error);
      toast.error("Generation failed. Loaded fallback content.");
    } finally {
      setIsImporting(false);
    }
  };

  // AI manual parsing route
  async function parseText(text: string, titleHint: string, assumedWorkspace = "Custom") {
    if (!text.trim()) {
      toast.error("Content is empty.");
      return;
    }
    setLoading(true);

    try {
      const rawResponse = await callAIGateway(PARSE_PROMPT(text), true);
      const parsedData = extractJSON<any>(rawResponse);

      const processedModule = {
        id: crypto.randomUUID(),
        title: titleHint,
        workspace: assumedWorkspace,
        raw: text,
        summary: parsedData.summary,
        flashcards: parsedData.flashcards,
        quiz: parsedData.quiz,
        notes: text,
        transcript: text,
        parsed: parsedData
      };

      setMasteredDeck(prev => {
        if (prev.some(item => item.title === processedModule.title)) return prev;
        return [...prev, processedModule];
      });
      setSelectedNote(processedModule);
      setSelectedRawNote(null);
      setPasted("");
      toast.success("⚡ Imported & analyzed!");
    } catch (e) {
      showApiError(e, () => {
        const fallbackData = fakeFallback(text, titleHint, assumedWorkspace);
        const processedModule = {
          id: crypto.randomUUID(),
          title: titleHint,
          workspace: assumedWorkspace,
          raw: text,
          summary: fallbackData.summary,
          flashcards: fallbackData.flashcards,
          quiz: fallbackData.quiz,
          notes: text,
          transcript: text,
          parsed: fallbackData
        };
        setMasteredDeck(prev => {
          if (prev.some(item => item.title === processedModule.title)) return prev;
          return [...prev, processedModule];
        });
        setSelectedNote(processedModule);
        setSelectedRawNote(null);
        setPasted("");
        toast.info("Loaded fallback mock analysis.");
      });
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteRawNote = (id: string) => {
    setImportedRawNotes(prev => prev.filter(n => n.id !== id));
    if (selectedRawNote?.id === id) setSelectedRawNote(null);
  };

  const handleDeleteMasteredNote = (id: string) => {
    setMasteredDeck(prev => prev.filter(l => l.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
  };

  const handleClearAllRawNotes = () => {
    if (window.confirm("Are you sure you want to clear all raw notes?")) {
      setImportedRawNotes([]);
      setSelectedRawNote(null);
      toast.success("💥 All raw notes cleared!");
    }
  };

  const handleClearAllMasteredNotes = () => {
    if (window.confirm("Are you sure you want to clear all mastered notes from the deck?")) {
      setMasteredDeck([]);
      setSelectedNote(null);
      toast.success("💥 Mastered deck cleared!");
    }
  };

  const handleSelectRawNote = (n: any) => {
    setSelectedNote(null);
    setSelectedRawNote(n);
  };

  const handleSelectMastered = (l: any) => {
    setSelectedRawNote(null);
    setSelectedNote(l);
  };

  const handleAddToMasteredDeck = (lecture: any) => {
    const exists = masteredDeck.some((l) => l.id === lecture.id || l.title === lecture.title);
    if (!exists) {
      setMasteredDeck([lecture, ...masteredDeck]);
      toast.success("🏆 Added to Mastered Deck!");
    } else {
      toast.info("Topic already mastered.");
    }
  };

  // Sidebar visible raw notes
  const visibleRawNotes = importedRawNotes;

  // Dropdown options: exclude already imported/mastered meetings
  const availableToImport = allGranolaMeetings.filter((m) => {
    const isImported = importedRawNotes.some((r) => r.id === m.id);
    const isMastered = masteredDeck.some((d) => d.id === m.id);
    return !isImported && !isMastered;
  });

  const isMastered = selectedNote
    ? masteredDeck.some((l) => l.id === selectedNote.id || l.title === selectedNote.title)
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">📚 My Lecture Deck</h2>
        <p className="text-muted-foreground">
          Granola Hub — connect, browse, and master your meeting notes.
        </p>
      </div>

      {showWarningBanner && (
        <div className="arcade-card p-4 border-amber-arcade bg-amber-arcade/10 flex items-start gap-3 animate-pulse-glow">
          <AlertTriangle className="text-amber-arcade h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>No active gateway connection found.</strong> Open settings or click{" "}
            <em>Connect to Granola</em> to establish connection.
            {connError && <div className="opacity-70 text-xs mt-1">{connError}</div>}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        {/* SIDEBAR */}
        <div className="space-y-4">
          <ConnectButton status={connStatus} onClick={checkConnection} />

          {/* 1. REPURPOSED DROP-DOWN PANEL (IMPORT FROM GRANOLA) */}
          <div className="arcade-card p-3 bg-muted/20 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Import from Granola</span>
              {notesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </label>
            <select
              value={dropdownSelectedId}
              onChange={(e) => setDropdownSelectedId(e.target.value)}
              disabled={availableToImport.length === 0}
              className="w-full mt-1.5 rounded-md bg-input border border-border p-2 text-sm text-foreground focus:outline-none focus:border-indigo-arcade disabled:opacity-50"
            >
              {availableToImport.length === 0 ? (
                <option value="">— No meetings available —</option>
              ) : (
                <>
                  <option value="">— Select meeting to import —</option>
                  {availableToImport.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </>
              )}
            </select>
            {/* 2. THE IMPORT NOTE BUTTON */}
            <Button
              onClick={handleImportRawNote}
              disabled={!dropdownSelectedId || isImporting}
              className="w-full mt-2 bg-indigo-arcade hover:bg-indigo-arcade/80 text-white font-bold h-9 text-xs"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Import Selected Note ⚡
            </Button>
          </div>

          {/* SIDEBAR "GRANOLA RAW NOTES" */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-arcade flex items-center justify-between gap-1.5 px-1 w-full text-left">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Granola Raw Notes ({visibleRawNotes.length})
              </span>
              <div className="flex items-center gap-2">
                {notesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {visibleRawNotes.length > 0 && (
                  <button
                    onClick={handleClearAllRawNotes}
                    className="text-[10px] text-muted-foreground hover:text-destructive uppercase font-bold tracking-wider transition-colors cursor-pointer"
                    title="Remove all raw notes"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {visibleRawNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 leading-relaxed text-left">
                  No imported notes in sidebar yet. Select a meeting in the dropdown to import.
                </p>
              ) : (
                visibleRawNotes.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center justify-between gap-1 w-full rounded-lg border border-dashed transition-all ${
                      selectedRawNote?.id === t.id
                        ? "bg-amber-arcade/20 border-amber-arcade"
                        : "bg-card/40 border-muted-foreground/30 hover:bg-amber-arcade/10 hover:border-amber-arcade hover:scale-[1.01]"
                    }`}
                  >
                    <button
                      disabled={loading || isImporting}
                      onClick={() => handleSelectRawNote(t)}
                      className="flex-1 text-left p-2.5 flex flex-col gap-1 disabled:opacity-50"
                    >
                      <div className="font-semibold text-foreground group-hover:text-amber-arcade transition-colors line-clamp-1">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.workspace_name || t.workspace || "General"}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRawNote(t.id);
                      }}
                      className="p-2 mr-1 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/15"
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MASTERED PORTAL DECK */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-fuchsia-arcade px-1 flex items-center justify-between w-full text-left">
              <span>🎮 Mastered Portal Deck ({masteredDeck.length})</span>
              {masteredDeck.length > 0 && (
                <button
                  onClick={handleClearAllMasteredNotes}
                  className="text-[10px] text-muted-foreground hover:text-destructive uppercase font-bold tracking-wider transition-colors cursor-pointer"
                  title="Remove all mastered notes"
                >
                  Clear All
                </button>
              )}
            </h4>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {masteredDeck.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 text-left">No study guides yet.</p>
              ) : (
                masteredDeck.map((l) => (
                  <div
                    key={l.id}
                    className={`group flex items-center justify-between gap-1 w-full rounded-lg border transition-all ${
                      selectedNote?.id === l.id
                        ? "bg-fuchsia-arcade/20 border-fuchsia-arcade"
                        : "bg-card border-border hover:bg-muted hover:scale-[1.01]"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectMastered(l)}
                      className="flex-1 text-left p-3"
                    >
                      <div className="font-semibold text-sm line-clamp-1">{l.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {l.workspace} ·{" "}
                        <span className="text-emerald-arcade font-medium">
                          {l.parsed?.difficulty || "Intermediate"}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMasteredNote(l.id);
                      }}
                      className="p-2 mr-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/15"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="space-y-4">
          <div className="arcade-card p-4">
            <h3 className="font-bold mb-2 text-sm text-foreground text-left">
              ✍️ Alternative Manual Paste Input
            </h3>
            <Textarea
              rows={3}
              placeholder="Paste custom raw items or transcripts directly..."
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
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Parse Manual Text
              </Button>
            </div>
          </div>

          {/* RENDER PLACEHOLDER, SELECTIVE IMPORT LANDING SCREEN, OR MASTERED STUDY GUIDE */}
          {allGranolaMeetings.length === 0 && importedRawNotes.length === 0 && masteredDeck.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800 rounded-2xl border border-dashed border-slate-700 max-w-lg mx-auto mt-12">
              <span className="text-5xl mb-4">🎮</span>
              <h3 className="text-xl font-bold text-slate-200 mb-2">Ready to study?</h3>
              <p className="text-slate-400 max-w-sm mb-6">Connect your Granola workspace, paste custom text, or load our pre-populated sample modules to explore the study arcade!</p>
              <button
                onClick={handleLoadMockData}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition duration-200 cursor-pointer"
              >
                Load Sample Mock Data 📚
              </button>
            </div>
          ) : selectedRawNote ? (
            /* 3. COLLAPSIBLE RAW NOTES & TRANSCRIPTS */
            <div className="arcade-card p-6 border-l-4 border-l-amber-arcade space-y-4 text-left animate-bounce-in">
              <h3 className="font-bold text-xl text-foreground">
                Selected Raw Note: {selectedRawNote.title}
              </h3>
              
              <p className="text-sm text-muted-foreground">
                This meeting has not been analyzed yet. Click 'Analyze with AI ⚡' below to generate your study arcade.
              </p>

              {/* Collapsible raw notes & transcripts accordion drawer */}
              <div className="border border-slate-750 bg-slate-900/40 rounded-lg p-3">
                <button
                  onClick={() => setShowRawTextToggle(!showRawTextToggle)}
                  className="flex items-center justify-between w-full font-semibold text-sm text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    📄 View Raw Text & Transcript
                  </span>
                  <span>{showRawTextToggle ? '▲' : '▼'}</span>
                </button>
                {showRawTextToggle && (
                  <div className="grid md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-800">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Raw Notes</span>
                      <div className="p-3 bg-slate-950 rounded h-40 overflow-y-auto text-xs whitespace-pre-line text-slate-300 scrollbar-thin">
                        {selectedRawNote.notes || 'No raw notes.'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Raw Transcript</span>
                      <div className="p-3 bg-slate-950 rounded h-40 overflow-y-auto text-xs whitespace-pre-line text-slate-300 scrollbar-thin">
                        {selectedRawNote.transcript || 'No transcript available.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. AI ANALYSIS MOVEMENT BUTTON */}
              <div className="pt-2">
                <Button
                  onClick={() => handleImportAndProcess(selectedRawNote)}
                  disabled={isImporting}
                  className="bg-amber-arcade hover:bg-amber-arcade/80 text-background font-bold text-base px-6 py-6 rounded-xl animate-pulse-glow w-full"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" /> Analyze with AI ⚡
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : selectedNote ? (
            /* MASTERED PORTAL DECK VIEW (ORIGINAL TRANSCRIPT HIDDEN) */
            <>
              {/* Tab Selector Buttons */}
              <div className="flex border-b border-border mb-4">
                <button
                  onClick={() => setActiveTab("cheat")}
                  className={`flex-1 py-2.5 font-bold text-sm border-b-2 transition-all ${
                    activeTab === "cheat"
                      ? "border-fuchsia-arcade text-fuchsia-arcade"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📝 Cheat Sheet
                </button>
                <button
                  onClick={() => setActiveTab("flashcards")}
                  className={`flex-1 py-2.5 font-bold text-sm border-b-2 transition-all ${
                    activeTab === "flashcards"
                      ? "border-fuchsia-arcade text-fuchsia-arcade"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🃏 Flashcards
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`flex-1 py-2.5 font-bold text-sm border-b-2 transition-all ${
                    activeTab === "quiz"
                      ? "border-fuchsia-arcade text-fuchsia-arcade"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🎮 Quiz Arena
                </button>
              </div>

              {activeTab === "cheat" && (
                <div className="arcade-card p-5 border-l-4 border-l-indigo-arcade animate-fade-in text-left">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="font-bold text-lg text-foreground">
                      🍰 Summary Panel — {selectedNote.title}
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedNote.parsed?.tags?.map((t: string) => (
                        <span
                          key={t}
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-arcade/20 border border-indigo-arcade/40 text-indigo-arcade"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Markdown text={selectedNote.summary || selectedNote.parsed?.summary || ""} />
                  <div className="pt-3 mt-3 border-t border-border/50">
                    <Button
                      disabled={isMastered}
                      onClick={() => handleAddToMasteredDeck(selectedNote)}
                      className={`w-full py-5 text-sm font-bold uppercase tracking-wider rounded-lg ${
                        isMastered
                          ? "bg-emerald-arcade/20 border border-emerald-arcade text-emerald-arcade opacity-80"
                          : "bg-amber-arcade hover:bg-amber-arcade/80 text-background"
                      }`}
                    >
                      {isMastered ? "Topic Mastered ✔️" : "Add to Mastered Deck 🏆"}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "flashcards" && (
                <div className="arcade-card p-5 animate-fade-in text-left">
                  <h3 className="font-bold text-lg mb-3 text-foreground">
                    🃏 Flashcard Arena (Click to flip)
                  </h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(selectedNote.flashcards || selectedNote.parsed?.flashcards || []).map((f: any, i: number) => (
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
              )}

              {activeTab === "quiz" && (
                <div className="arcade-card p-5 animate-fade-in text-left">
                  <QuizTabModule selectedNote={selectedNote} />
                </div>
              )}
            </>
          ) : (
            <div className="arcade-card p-12 border-dashed flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/5">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-2 animate-bounce" />
              <h3 className="font-bold text-lg text-foreground/80">Study Arena Offline</h3>
              <p className="text-sm max-w-sm mt-1">
                Select an item from <strong>Granola Raw Notes</strong> to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizTabModule({ selectedNote }: { selectedNote: any }) {
  const { addXp, addMistake, unlock } = useArcade();
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const quiz = selectedNote?.quiz || selectedNote?.parsed?.quiz || [];

  if (quiz.length === 0) {
    return <div className="text-center text-muted-foreground p-4">No quiz questions available.</div>;
  }

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
        lectureTitle: selectedNote!.title,
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
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <h4 className="font-bold text-foreground">🎮 Quiz Arena</h4>
        <span>Question {i + 1} of {quiz.length}</span>
      </div>

      {done ? (
        <div className="text-center p-6 bg-slate-950/30 rounded-lg border border-border">
          <Trophy className="h-12 w-12 mx-auto text-amber-arcade mb-2" />
          <h3 className="text-xl font-bold text-slate-200">Victory!</h3>
          <p className="text-sm mt-1">{score} / {quiz.length} correct</p>
          <p className="text-emerald-arcade text-lg font-bold mt-2">+50 XP ✨</p>
          <Button onClick={reset} className="mt-4 bg-fuchsia-arcade hover:bg-fuchsia-arcade/80 text-xs">
            Play Again
          </Button>
        </div>
      ) : (
        <div className="p-4 bg-slate-950/20 rounded-lg border border-border space-y-4">
          <h3 className="font-bold text-base text-foreground">{q.question}</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {q.options.map((o: string, idx: number) => {
              const isCorrect = idx === q.correct_index;
              const isSelected = idx === selected;
              const show = selected !== null;
              const cls = !show
                ? "border-border hover:bg-muted/30"
                : isCorrect
                ? "border-emerald-arcade bg-emerald-arcade/20 text-emerald-arcade"
                : isSelected
                ? "border-destructive bg-destructive/20 text-destructive animate-shake"
                : "border-border opacity-50";
              return (
                <button
                  key={idx}
                  disabled={show}
                  onClick={() => pick(idx)}
                  className={`p-3 rounded border text-left text-xs transition-all flex items-center gap-2 ${cls}`}
                >
                  {show && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-arcade animate-bounce-in" />}
                  {show && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <div className="p-3 rounded bg-muted/20 text-xs text-muted-foreground">
              <strong>Explanation:</strong> {q.explanations[selected]}
            </div>
          )}
          {selected !== null && (
            <Button onClick={next} className="w-full bg-fuchsia-arcade hover:bg-fuchsia-arcade/80 text-xs h-9">
              {i + 1 >= quiz.length ? "Finish" : "Next →"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectButton({
  status,
  onClick,
}: {
  status: ConnStatus;
  onClick: () => void;
}) {
  if (status === "connected") {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-arcade bg-emerald-arcade/15 text-emerald-arcade font-bold py-3 transition-all hover:bg-emerald-arcade/25 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
      >
        <CheckCircle2 className="h-4 w-4" />
        Granola Connected ✔️
      </button>
    );
  }
  if (status === "checking") {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-indigo-arcade/60 bg-indigo-arcade/10 text-indigo-arcade font-bold py-3"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-fuchsia-arcade bg-fuchsia-arcade/15 text-fuchsia-arcade font-bold py-3 transition-all hover:bg-fuchsia-arcade/25 hover:scale-[1.02] active:scale-95 animate-pulse-glow cursor-pointer"
    >
      <Plug className="h-4 w-4" />
      Connect to Granola 🔌
    </button>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <ul className="space-y-2">
      {lines
        .filter((l) => l.trim())
        .map((l, i) => {
          const stripped = l.replace(/^\s*[-*]\s*/, "");
          const html = stripped
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>");
          return (
            <li
              key={i}
              className="text-sm text-foreground/90 text-left"
              dangerouslySetInnerHTML={{ __html: "• " + html }}
            />
          );
        })}
    </ul>
  );
}
