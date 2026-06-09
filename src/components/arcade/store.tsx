import { createContext, useContext, useState, type ReactNode } from "react";

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
}

interface Ctx {
  xp: number;
  streak: number;
  addXp: (n: number) => void;
  lectures: Lecture[];
  setLectures: (l: Lecture[]) => void;
  activeLecture: Lecture | null;
  setActiveLecture: (l: Lecture | null) => void;
  mistakes: QuizMistake[];
  addMistake: (m: QuizMistake) => void;
  clearMistakes: () => void;
  achievements: Record<string, boolean>;
  unlock: (id: string) => void;
}

const ArcadeContext = createContext<Ctx | null>(null);

export function ArcadeProvider({ children }: { children: ReactNode }) {
  const [xp, setXp] = useState(120);
  const [streak] = useState(3);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [mistakes, setMistakes] = useState<QuizMistake[]>([]);
  const [achievements, setAchievements] = useState<Record<string, boolean>>({
    "first-quiz": true,
    "streak-3": true,
  });

  return (
    <ArcadeContext.Provider
      value={{
        xp,
        streak,
        addXp: (n) => setXp((x) => x + n),
        lectures,
        setLectures,
        activeLecture,
        setActiveLecture,
        mistakes,
        addMistake: (m) => setMistakes((p) => [...p, m]),
        clearMistakes: () => setMistakes([]),
        achievements,
        unlock: (id) => setAchievements((a) => ({ ...a, [id]: true })),
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