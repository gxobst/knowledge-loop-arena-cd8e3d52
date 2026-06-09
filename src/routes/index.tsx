import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ArcadeProvider } from "@/components/arcade/store";
import { AppShell, type Page } from "@/components/arcade/AppShell";
import { Dashboard } from "@/components/arcade/pages/Dashboard";
import { LectureDeck } from "@/components/arcade/pages/LectureDeck";
import { ArcadeArena } from "@/components/arcade/pages/ArcadeArena";
import { SocraticDebate } from "@/components/arcade/pages/SocraticDebate";
import { CurriculumArchitect } from "@/components/arcade/pages/CurriculumArchitect";
import { CritiqueSandbox } from "@/components/arcade/pages/CritiqueSandbox";
import { Achievements } from "@/components/arcade/pages/Achievements";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LectureLoop Arcade — Level up your learning" },
      { name: "description", content: "A vibrant, gamified AI study portal with multi-provider AI engine, flashcards, quizzes, and Socratic agents." },
      { property: "og:title", content: "LectureLoop Arcade" },
      { property: "og:description", content: "Retro-arcade study portal powered by your choice of AI." },
    ],
  }),
  component: Index,
});

function Index() {
  const [page, setPage] = useState<Page>("dashboard");
  return (
    <ArcadeProvider>
      <AppShell page={page} onPage={setPage}>
        {page === "dashboard" && <Dashboard />}
        {page === "deck" && <LectureDeck />}
        {page === "arcade" && <ArcadeArena />}
        {page === "socratic" && <SocraticDebate />}
        {page === "architect" && <CurriculumArchitect />}
        {page === "critique" && <CritiqueSandbox />}
        {page === "achievements" && <Achievements />}
      </AppShell>
      <Toaster theme="dark" position="top-right" />
    </ArcadeProvider>
  );
}
