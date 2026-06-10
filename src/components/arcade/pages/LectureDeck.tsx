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
  FALLBACK_MOCK_NOTES,
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
} from "lucide-react";
import { showApiError } from "../ErrorToast";
import { toast } from "sonner";

type ConnStatus = "idle" | "checking" | "connected" | "failed";

export function LectureDeck() {
  const { lectures, activeLecture, setActiveLecture, setLectures } = useArcade();
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const configured = isConfigured(loadSettings());

  // Granola connector state
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connError, setConnError] = useState<string | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [folders, setFolders] = useState<GranolaFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [notesByFolder, setNotesByFolder] = useState<Record<string, GranolaNote[]>>({});
  const [notesLoading, setNotesLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);

  // Mock/offline raw notes
  const [mockNotes, setMockNotes] = useState<GranolaNote[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const v = localStorage.getItem("lectureloop_raw_notes");
      return v ? JSON.parse(v) : [];
    } catch {
      return [];
    }
  });
  const saveMockNotes = (notes: GranolaNote[]) => {
    setMockNotes(notes);
    localStorage.setItem("lectureloop_raw_notes", JSON.stringify(notes));
  };

  const [selectedRawNote, setSelectedRawNote] = useState<GranolaNote | null>(null);

  // ---- Granola connection lifecycle ----
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const f = await fetchGranolaFolders();
      if (f && f.length > 0) {
        setFolders(f);
        setSelectedFolderId((prev) => prev || (f[0]?.id ?? ""));
      } else {
        // Scenario A: No folders exist in user's account -> Inject virtual fallback folder
        const fallbackFolders: GranolaFolder[] = [{ id: "all_notes", name: "All Meetings 📚" }];
        setFolders(fallbackFolders);
        setSelectedFolderId("all_notes");

        // Immediately trigger follow-up fetch for all loose notes
        setNotesLoading(true);
        try {
          const notes = await fetchGranolaNotes(); // bypass folder param
          setNotesByFolder((prev) => ({ ...prev, all_notes: notes }));
        } catch (noteErr) {
          toast.error("Failed to load loose meeting notes", {
            description: noteErr instanceof Error ? noteErr.message : String(noteErr),
          });
        } finally {
          setNotesLoading(false);
        }
      }
    } catch (e) {
      toast.error("Failed to load Granola workspaces", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const handleFolderSelect = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

  const checkConnection = useCallback(async () => {
    setConnStatus("checking");
    setConnError(null);
    setShowWarningBanner(false);

    // Only check for actual Granola-specific keys
    const hasManualKey = !!(
      localStorage.getItem("granola_api_key") ||
      localStorage.getItem("lectureloop_granola_key")
    );

    if (hasManualKey) {
      // Manual key present — mark connected and load folders
      setConnStatus("connected");
      setShowWarningBanner(false);
      void loadFolders();
      return;
    }

    // No manual key — check communication to local endpoints or /api/ai/completions
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

    // No manual key — try the backend gateway
    const s = await fetchGranolaStatus();

    if (s.outcome === "gateway" || s.outcome === "manual_key") {
      canCommunicate = true;
    }

    if (s.connected) {
      setConnStatus("connected");
      setShowWarningBanner(false);
      void loadFolders();
    } else {
      setConnStatus("failed");
      setConnError(s.reason ?? "No active gateway connection or Granola API key found.");
      setShowWarningBanner(!canCommunicate);
    }
  }, [loadFolders]);


  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  // Fetch notes when folder selected
  useEffect(() => {
    if (connStatus !== "connected" || !selectedFolderId) return;
    if (notesByFolder[selectedFolderId]) return;
    let cancelled = false;
    (async () => {
      setNotesLoading(true);
      try {
        const idToPass = (selectedFolderId === "all_notes" || selectedFolderId === "all") ? undefined : selectedFolderId;
        const notes = await fetchGranolaNotes(idToPass);
        if (!cancelled) {
          setNotesByFolder((prev) => ({ ...prev, [selectedFolderId]: notes }));
        }
      } catch (e) {
        if (!cancelled) {
          toast.error("Failed to load notes", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connStatus, selectedFolderId, notesByFolder]);

  const liveNotes = selectedFolderId ? notesByFolder[selectedFolderId] ?? [] : [];
  // Always combine live + mock notes, deduplicating by id
  const visibleRawNotes: GranolaNote[] = (() => {
    const combined = [...liveNotes];
    for (const m of mockNotes) {
      if (!combined.some((n) => n.id === m.id)) combined.push(m);
    }
    return combined;
  })();

  // Workspace name for display
  const selectedFolderName =
    folders.find((f) => f.id === selectedFolderId)?.name ?? "All";

  // ---- Mock data ----
  const handleLoadMockData = () => {
    const merged = [...mockNotes];
    FALLBACK_MOCK_NOTES.forEach((m) => {
      if (!merged.some((n) => n.id === m.id || n.title === m.title)) merged.push(m);
    });
    saveMockNotes(merged);

    // Also inject into the notesByFolder so they show up when connected
    if (selectedFolderId) {
      setNotesByFolder((prev) => {
        const existing = prev[selectedFolderId] ?? [];
        const combined = [...existing];
        for (const m of merged) {
          if (!combined.some((n) => n.id === m.id)) combined.push(m);
        }
        return { ...prev, [selectedFolderId]: combined };
      });
    }
    toast.success("📚 Sample mock data loaded!");
  };

  const handleDeleteRawNote = (id: string) => {
    saveMockNotes(mockNotes.filter((n) => n.id !== id));
    setNotesByFolder((prev) => {
      const updated = { ...prev };
      for (const folderId in updated) {
        updated[folderId] = updated[folderId].filter((n) => n.id !== id);
      }
      return updated;
    });
    if (selectedRawNote?.id === id) setSelectedRawNote(null);
  };

  const handleDeleteMasteredNote = (id: string) => {
    setLectures(lectures.filter((l) => l.id !== id));
    if (activeLecture?.id === id) setActiveLecture(null);
  };

  const handleClearAllRawNotes = () => {
    if (window.confirm("Are you sure you want to clear all raw notes?")) {
      saveMockNotes([]);
      setNotesByFolder({});
      setSelectedRawNote(null);
      toast.success("💥 All raw notes cleared!");
    }
  };

  const handleClearAllMasteredNotes = () => {
    if (window.confirm("Are you sure you want to clear all mastered notes from the deck?")) {
      setLectures([]);
      setActiveLecture(null);
      toast.success("💥 Mastered deck cleared!");
    }
  };

  // ---- AI parse ----
  async function parseText(text: string, titleHint: string, assumedWorkspace = "Custom") {
    if (!text.trim()) {
      toast.error("Content is empty.");
      return;
    }
    setLoading(true);

    const fakeFallback = (): ParsedLecture => {
      // Extract real sentences from the content for meaningful flashcards
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


    try {
      const raw = await callAIGateway(PARSE_PROMPT(text), true);
      const parsed = extractJSON<ParsedLecture>(raw);
      if (!parsed.subject || parsed.subject === "Custom") parsed.subject = assumedWorkspace;
      addLecture(titleHint, text, parsed);
      toast.success("⚡ Imported & analyzed!");
    } catch (e) {
      showApiError(e, () => {
        addLecture(titleHint, text, fakeFallback());
        toast.info("Loaded fallback mock analysis.");
      });
    } finally {
      setLoading(false);
    }
  }

  function addLecture(title: string, raw: string, parsed: ParsedLecture) {
    const exists = lectures.find((l) => l.title === title);
    if (exists) {
      setActiveLecture(exists);
      toast.info("Already in Mastered Deck — opening existing.");
      setSelectedRawNote(null);
      return;
    }
    const newLecture: Lecture = {
      id: crypto.randomUUID(),
      title,
      workspace: parsed.subject || "Custom",
      raw,
      parsed,
    };
    setLectures([newLecture, ...lectures]);
    setActiveLecture(newLecture);
    setSelectedRawNote(null);
    setPasted("");
  }

  const handleAddToMasteredDeck = (lecture: Lecture) => {
    const exists = lectures.some((l) => l.id === lecture.id || l.title === lecture.title);
    if (!exists) {
      setLectures([lecture, ...lectures]);
      toast.success("🏆 Added to Mastered Deck!");
    } else {
      toast.info("Topic already mastered.");
    }
  };

  const handleImportSelected = async () => {
    if (!selectedRawNote) return;
    setLoading(true);
    let note = selectedRawNote;
    
    // Force detail fetch to get full transcript
    const detail = await fetchGranolaNoteDetail(note.id);
    if (detail) {
      note = detail;
      setSelectedRawNote(detail);
      if (selectedFolderId) {
        setNotesByFolder((prev) => {
          const folderNotes = prev[selectedFolderId] ?? [];
          return {
            ...prev,
            [selectedFolderId]: folderNotes.map((n) => (n.id === note.id ? detail : n)),
          };
        });
      }
    }

    const richContext = `
LECTURE TITLE: ${note.title}
FOLDER/SUBJECT: ${note.workspace || "General"}
BRIEF NOTES: ${note.ai_summary || ""}
=========================================
FULL MEETING TRANSCRIPT (CORE SOURCE OF TRUTH):
${note.transcript || "No transcript available."}
=========================================
`;

    parseText(richContext, note.title, note.workspace);
  };

  const handleSelectRawNote = (n: GranolaNote) => {
    setActiveLecture(null);
    setSelectedRawNote(n);
  };
  const handleSelectMastered = (l: Lecture) => {
    setSelectedRawNote(null);
    setActiveLecture(l);
  };

  const isMastered = activeLecture
    ? lectures.some((l) => l.id === activeLecture.id || l.title === activeLecture.title)
    : false;

  const showInitialPlaceholder =
    visibleRawNotes.length === 0 && !activeLecture && !selectedRawNote;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text mb-1">📚 My Lecture Deck</h2>
        <p className="text-muted-foreground">
          Granola Hub — connect, browse workspaces, and master your meeting notes.
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
          {/* CONNECT BUTTON */}
          <ConnectButton status={connStatus} onClick={checkConnection} />

          {/* WORKSPACE SELECTOR */}
          <div className="arcade-card p-3 bg-muted/20">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Select Granola Workspace</span>
              {foldersLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => handleFolderSelect(e.target.value)}
              disabled={connStatus !== "connected" || foldersLoading}
              className="w-full mt-1.5 rounded-md bg-input border border-border p-2 text-sm text-foreground focus:outline-none focus:border-indigo-arcade disabled:opacity-50"
            >
              {connStatus !== "connected" && <option>— Connect to Granola first —</option>}
              {connStatus === "connected" && folders.length === 0 && (
                <option>— No workspaces found —</option>
              )}
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* RAW NOTES */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-arcade flex items-center justify-between gap-1.5 px-1 w-full">
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
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {visibleRawNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">
                  {connStatus === "connected"
                    ? "No notes in this workspace yet."
                    : "Connect to Granola or load mock data below."}
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
                      disabled={loading}
                      onClick={() => handleSelectRawNote(t)}
                      className="flex-1 text-left p-2.5 flex flex-col gap-1 disabled:opacity-50"
                    >
                      <div className="font-semibold text-foreground group-hover:text-amber-arcade transition-colors line-clamp-1">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-between w-full">
                        <span className="line-clamp-1">{t.workspace}</span>
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
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MASTERED */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-fuchsia-arcade px-1 flex items-center justify-between w-full">
              <span>🎮 Mastered Portal Deck ({lectures.length})</span>
              {lectures.length > 0 && (
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
              {lectures.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">No study guides yet.</p>
              ) : (
                lectures.map((l) => (
                  <div
                    key={l.id}
                    className={`group flex items-center justify-between gap-1 w-full rounded-lg border transition-all ${
                      activeLecture?.id === l.id
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
                          {l.parsed.difficulty}
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
            <h3 className="font-bold mb-2 text-sm text-foreground">
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

          {showInitialPlaceholder ? (
            <div className="arcade-card p-12 text-center flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-indigo-arcade/50 bg-indigo-arcade/5 animate-bounce-in">
              <BookOpen className="h-16 w-16 text-indigo-arcade animate-pulse" />
              <h3 className="font-bold text-xl text-foreground">No study modules loaded yet!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Connect to Granola, paste a transcript, or load mock data to begin.
              </p>
              <Button
                onClick={handleLoadMockData}
                className="bg-indigo-arcade hover:bg-indigo-arcade/80 text-primary-foreground font-bold px-6 py-5 rounded-lg transition-all active:scale-95"
              >
                Load Sample Mock Data 📚
              </Button>
            </div>
          ) : selectedRawNote ? (
            <div className="arcade-card p-10 text-center flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-amber-arcade/50 bg-amber-arcade/5 animate-bounce-in">
              <FileText className="h-14 w-14 text-amber-arcade animate-pulse" />
              <h3 className="font-bold text-xl text-foreground">
                Importing Note: {selectedRawNote.title}
              </h3>
              <div className="bg-muted/40 p-4 rounded-lg w-full text-left max-h-40 overflow-y-auto text-xs border border-border">
                <strong>AI Summary:</strong>{" "}
                {selectedRawNote.ai_summary || <em>No summary available.</em>}
              </div>
              <Button
                onClick={handleImportSelected}
                disabled={loading}
                className="bg-amber-arcade hover:bg-amber-arcade/80 text-background font-bold text-base px-6 py-6 rounded-xl animate-pulse-glow"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" /> Import & Analyze with AI ⚡
                  </>
                )}
              </Button>
            </div>
          ) : activeLecture ? (
            <>
              <div className="arcade-card p-5 border-l-4 border-l-indigo-arcade">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-bold text-lg text-foreground">
                    🍰 Summary Panel — {activeLecture.title}
                  </h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {activeLecture.parsed.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-arcade/20 border border-indigo-arcade/40 text-indigo-arcade"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <Markdown text={activeLecture.parsed.summary} />
                <div className="pt-3 mt-3 border-t border-border/50">
                  <Button
                    disabled={isMastered}
                    onClick={() => handleAddToMasteredDeck(activeLecture)}
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

              <div className="arcade-card p-5">
                <h3 className="font-bold text-lg mb-3 text-foreground">
                  🃏 Flashcard Arena (Click to flip)
                </h3>
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
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-arcade bg-emerald-arcade/15 text-emerald-arcade font-bold py-3 transition-all hover:bg-emerald-arcade/25 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
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
      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-fuchsia-arcade bg-fuchsia-arcade/15 text-fuchsia-arcade font-bold py-3 transition-all hover:bg-fuchsia-arcade/25 hover:scale-[1.02] active:scale-95 animate-pulse-glow"
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
              className="text-sm text-foreground/90"
              dangerouslySetInnerHTML={{ __html: "• " + html }}
            />
          );
        })}
    </ul>
  );
}
