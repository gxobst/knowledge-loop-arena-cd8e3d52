import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface QuizMistake {
  question: string;
  selected: string;
  correct: string;
  lectureTitle: string;
}

export interface ParsedLecture {
  subject: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tags: string[];
  summary: string;
  flashcards: { term: string; definition: string }[];
  quiz: {
    question: string;
    options: string[];
    correct_index: number;
    explanations: string[];
  }[];
}

export interface Lecture {
  id: string;
  title: string;
  workspace: string;
  raw: string;
  parsed: ParsedLecture;
  notes?: string;
  transcript?: string;
}

interface Ctx {
  xp: number;
  streak: number;
  addXp: (n: number) => void;
  setStreak: (s: number) => void;
  lectures: Lecture[];
  setLectures: (l: Lecture[]) => void;
  activeLecture: Lecture | null;
  setActiveLecture: (l: Lecture | null) => void;
  mistakes: QuizMistake[];
  addMistake: (m: QuizMistake) => void;
  clearMistakes: () => void;
  achievements: Record<string, boolean>;
  unlock: (id: string) => void;
  resetStudyProgress: () => void;
}

const ArcadeContext = createContext<Ctx | null>(null);

export function ArcadeProvider({ children }: { children: ReactNode }) {
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lectures, setLecturesState] = useState<Lecture[]>([]);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [mistakes, setMistakesState] = useState<QuizMistake[]>([]);
  const [achievements, setAchievements] = useState<Record<string, boolean>>({ "first-quiz": true, "streak-3": true });

  useEffect(() => {
    const savedXp = localStorage.getItem("lectureloop_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));

    const savedStreak = localStorage.getItem("lectureloop_streak");
    if (savedStreak) setStreak(parseInt(savedStreak, 10));

    try {
      const savedLectures = localStorage.getItem("lectureloop_lectures");
      if (savedLectures) setLecturesState(JSON.parse(savedLectures));
    } catch (e) {
      console.error("Failed to parse saved lectures:", e);
    }

    try {
      const savedMistakes = localStorage.getItem("lectureloop_mistakes");
      if (savedMistakes) setMistakesState(JSON.parse(savedMistakes));
    } catch (e) {
      console.error("Failed to parse saved mistakes:", e);
    }

    try {
      const savedAchievements = localStorage.getItem("lectureloop_achievements");
      if (savedAchievements) setAchievements(JSON.parse(savedAchievements));
    } catch (e) {
      console.error("Failed to parse saved achievements:", e);
    }
  }, []);

  const addXp = (n: number) => {
    setXp((prev) => {
      const next = prev + n;
      localStorage.setItem("lectureloop_xp", String(next));
      return next;
    });
  };

  const updateStreak = (s: number) => {
    setStreak(s);
    localStorage.setItem("lectureloop_streak", String(s));
  };

  const setLectures = (l: Lecture[]) => {
    setLecturesState(l);
    localStorage.setItem("lectureloop_lectures", JSON.stringify(l));
  };

  const addMistake = (m: QuizMistake) => {
    setMistakesState((prev) => {
      const next = [...prev, m];
      localStorage.setItem("lectureloop_mistakes", JSON.stringify(next));
      return next;
    });
  };

  const clearMistakes = () => {
    setMistakesState([]);
    localStorage.removeItem("lectureloop_mistakes");
  };

  const unlock = (id: string) => {
    setAchievements((prev) => {
      const next = { ...prev, [id]: true };
      localStorage.setItem("lectureloop_achievements", JSON.stringify(next));
      return next;
    });
  };

  const resetStudyProgress = () => {
    setXp(120);
    setStreak(0);
    setLecturesState([]);
    setActiveLecture(null);
    setMistakesState([]);
    setAchievements({ "first-quiz": true, "streak-3": true });

    localStorage.setItem("lectureloop_xp", "120");
    localStorage.setItem("lectureloop_streak", "0");
    localStorage.setItem("lectureloop_lectures", "[]");
    localStorage.setItem("lectureloop_mistakes", "[]");
    localStorage.setItem("lectureloop_achievements", JSON.stringify({ "first-quiz": true, "streak-3": true }));
  };

  return (
    <ArcadeContext.Provider
      value={{
        xp,
        streak,
        addXp,
        setStreak: updateStreak,
        lectures,
        setLectures,
        activeLecture,
        setActiveLecture,
        mistakes,
        addMistake,
        clearMistakes,
        achievements,
        unlock,
        resetStudyProgress,
      }}
    >
      {children}
    </ArcadeContext.Provider>
  );
}

export function useArcade() {
  const c = useContext(ArcadeContext);
  if (!c) throw new Error("useArcade must be used within ArcadeProvider");
  return c;
}