import { toast } from "sonner";

export type Provider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "vertex"
  | "foundry"
  | "mistral"
  | "openrouter"
  | "deepseek"
  | "qwen"
  | "ernie"
  | "ollama"
  | "bedrock";

export interface ProviderInfo {
  id: Provider;
  label: string;
  models: string[];
  defaultBaseUrl?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "openai", label: "OpenAI", models: ["gpt-5.5-instant", "gpt-5.4", "gpt-5.4-mini"], defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic Claude", models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"], defaultBaseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini (AI Studio)", models: ["gemini-3.5-flash", "gemini-3.1-pro"] },
  { id: "vertex", label: "Google Cloud Vertex AI", models: ["gemini-3.5-flash", "gemini-3.1-pro"] },
  { id: "foundry", label: "Microsoft Foundry (Azure AI)", models: ["custom-deployment"] },
  { id: "mistral", label: "Mistral AI", models: ["mistral-large-latest"], defaultBaseUrl: "https://api.mistral.ai/v1" },
  { id: "openrouter", label: "OpenRouter", models: ["meta-llama/llama-3-8b-instruct:free", "mistralai/mistral-7b-instruct"], defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"], defaultBaseUrl: "https://api.deepseek.com/v1" },
  { id: "qwen", label: "Alibaba Qwen (DashScope)", models: ["qwen-plus", "qwen-turbo"], defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "ernie", label: "Baidu Ernie", models: ["ernie-4.0-ultra", "ernie-3.5-8b"], defaultBaseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1" },
  { id: "ollama", label: "Ollama (Local)", models: ["llama3", "mistral", "phi3"], defaultBaseUrl: "http://localhost:11434/v1" },
  { id: "bedrock", label: "AWS Bedrock / Custom Proxy", models: ["anthropic.claude-3-sonnet", "meta.llama3-70b-instruct"] },
];

export interface AISettings {
  provider: Provider;
  model: string;
  customModel: string;
  useCustomModel: boolean;
  apiKey: string;
  baseUrl: string;
  // Vertex
  projectId: string;
  region: string;
  oauthToken: string;
  // Foundry
  resourceName: string;
  deploymentId: string;
  apiVersion: string;
}

const STORAGE_KEY = "lectureloop_ai_settings";

export const defaultSettings: AISettings = {
  provider: "openai",
  model: "gpt-5.5-instant",
  customModel: "",
  useCustomModel: false,
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  projectId: "",
  region: "us-central1",
  oauthToken: "",
  resourceName: "",
  deploymentId: "",
  apiVersion: "2024-08-01-preview",
};

export function loadSettings(): AISettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: AISettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function isConfigured(s: AISettings): boolean {
  switch (s.provider) {
    case "vertex":
      return !!(s.projectId && s.region && s.oauthToken);
    case "foundry":
      return !!(s.resourceName && s.deploymentId && s.apiKey);
    case "ollama":
      return !!s.baseUrl;
    default:
      return !!s.apiKey;
  }
}

function getModel(s: AISettings) {
  return s.useCustomModel && s.customModel ? s.customModel : s.model;
}

async function parseError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return `${res.status} ${res.statusText} — ${t.slice(0, 300)}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export async function callAIGateway(prompt: string, isJSONMode = false): Promise<string> {
  // PATH 1 (Local Override): If localStorage.getItem('mistral_api_key') is present
  const mistralLocalKey = typeof window !== 'undefined' ? localStorage.getItem('mistral_api_key') : null;
  if (mistralLocalKey) {
    try {
      const url = "https://api.mistral.ai/v1/chat/completions";
      const body = {
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        ...(isJSONMode ? { response_format: { type: "json_object" } } : {})
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralLocalKey}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const j = await res.json();
        return j.choices?.[0]?.message?.content ?? "";
      }
    } catch (e) {
      console.warn("Direct Mistral client fetch failed, falling back...", e);
    }
  }

  // PATH 2 (Secure Cloud Secret): Attempt to route to secure Lovable backend proxy
  const lovableApiKey = typeof window !== 'undefined'
    ? ((window as any).LOVABLE_API_KEY || (import.meta.env.VITE_LOVABLE_API_KEY || ''))
    : '';
  const proxyHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (lovableApiKey) {
    proxyHeaders["Authorization"] = `Bearer ${lovableApiKey}`;
    proxyHeaders["X-Lovable-Api-Key"] = lovableApiKey;
  }

  for (const proxyUrl of ["/api/ai/completions", "/api/completions"]) {
    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify({
          prompt,
          messages: [{ role: "user", content: prompt }],
          isJSONMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content ?? data.choices?.[0]?.message?.content ?? data.text ?? data.result;
        if (text) return text;
      }
    } catch (e) {
      console.warn(`Proxy fetch to ${proxyUrl} failed, trying next...`, e);
    }
  }

  // Fallback to user-configured custom keys in settings modal (original flows)
  try {
    const s = loadSettings();
    if (isConfigured(s)) {
      const model = getModel(s);
      if (s.provider === "anthropic") {
        const url = `${s.baseUrl || "https://api.anthropic.com/v1"}/messages`;
        const sysPrompt = isJSONMode
          ? "Respond ONLY with raw valid JSON. No markdown fences, no commentary."
          : "";
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": s.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: sysPrompt,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          return j.content?.[0]?.text ?? "";
        }
      } else if (s.provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${s.apiKey}`;
        const body: Record<string, unknown> = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        };
        if (isJSONMode) body.generationConfig = { responseMimeType: "application/json" };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const j = await res.json();
          return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
      } else if (s.provider === "vertex") {
        const url = `https://${s.region}-aiplatform.googleapis.com/v1/projects/${s.projectId}/locations/${s.region}/publishers/google/models/${model}:generateContent`;
        const body: Record<string, unknown> = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        };
        if (isJSONMode) body.generationConfig = { responseMimeType: "application/json" };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s.oauthToken}`,
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const j = await res.json();
          return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
      } else if (s.provider === "foundry") {
        const url = `https://${s.resourceName}.openai.azure.com/openai/deployments/${s.deploymentId}/chat/completions?api-version=${s.apiVersion}`;
        const body: Record<string, unknown> = {
          messages: [{ role: "user", content: prompt }],
        };
        if (isJSONMode) body.response_format = { type: "json_object" };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": s.apiKey },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const j = await res.json();
          return j.choices?.[0]?.message?.content ?? "";
        }
      } else {
        const url = `${s.baseUrl.replace(/\/$/, "")}/chat/completions`;
        const body: Record<string, unknown> = {
          model,
          messages: [{ role: "user", content: prompt }],
        };
        if (isJSONMode) body.response_format = { type: "json_object" };
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          const j = await res.json();
          return j.choices?.[0]?.message?.content ?? "";
        }
      }
    }
  } catch (e) {
    console.warn("Custom key API connection failed, falling back...", e);
  }

  // PATH 3 (Frictionless Demo Fallback)
  toast.warning("⚠️ AI Gateway busy. Activating frictionless demo mode.", {
    duration: 5000,
  });

  return getFrictionlessDemoData(prompt, isJSONMode);
}

// ---- Content-aware demo data builders ----

const SUBJECT_FLASHCARDS: Record<string, { term: string; definition: string }[]> = {
  biology: [
    { term: "Photosynthesis", definition: "The process by which green plants convert sunlight, CO₂, and water into glucose and oxygen using chlorophyll." },
    { term: "Chlorophyll", definition: "The green pigment in chloroplasts that absorbs sunlight to drive the light reactions of photosynthesis." },
    { term: "Calvin Cycle", definition: "The light-independent stage of photosynthesis where CO₂ is fixed into organic sugar molecules (G3P)." },
    { term: "Stomata", definition: "Tiny pores on leaf surfaces that regulate gas exchange (CO₂ in, O₂ out) and water vapor transpiration." },
    { term: "ATP (Adenosine Triphosphate)", definition: "The primary energy currency molecule of cells, produced during light reactions and used in the Calvin Cycle." },
    { term: "Cellular Respiration", definition: "The metabolic process that breaks down glucose to produce ATP, releasing CO₂ and water as byproducts." },
    { term: "DNA (Deoxyribonucleic Acid)", definition: "A double-helix molecule carrying the genetic instructions for growth, development, and reproduction of organisms." },
    { term: "Mitosis", definition: "A type of cell division producing two genetically identical daughter cells from a single parent cell." },
  ],
  economics: [
    { term: "Inflation", definition: "A sustained increase in the general price level of goods and services, reducing purchasing power over time." },
    { term: "GDP (Gross Domestic Product)", definition: "The total monetary value of all finished goods and services produced within a country's borders in a given period." },
    { term: "Fiscal Policy", definition: "Government use of taxation and spending to influence economic conditions, aggregate demand, and employment." },
    { term: "Monetary Policy", definition: "Central bank actions—adjusting interest rates and money supply—to control inflation and stabilize currency." },
    { term: "Supply & Demand", definition: "The economic model where prices are determined by the relationship between product availability and consumer desire." },
    { term: "Opportunity Cost", definition: "The value of the next-best alternative forgone when making a choice between scarce resources." },
    { term: "Consumer Price Index (CPI)", definition: "A measure tracking the average change in prices paid by consumers for a basket of goods and services over time." },
    { term: "Trade Deficit", definition: "An economic condition where a country's imports exceed its exports, resulting in a negative balance of trade." },
  ],
  art: [
    { term: "Linear Perspective", definition: "A mathematical system for creating the illusion of depth on a flat surface, using converging lines to a vanishing point." },
    { term: "Chiaroscuro", definition: "The use of strong contrasts between light and dark to give the illusion of volume and three-dimensionality in painting." },
    { term: "Humanism", definition: "A Renaissance intellectual movement emphasizing human potential, classical learning, and secular subjects in art." },
    { term: "Fresco", definition: "A technique of painting on freshly laid wet plaster, allowing pigments to become part of the wall surface." },
    { term: "Iconography", definition: "The study and interpretation of symbolic imagery, themes, and subjects in visual art." },
    { term: "Sfumato", definition: "A painting technique using subtle gradations of tone and color to blur outlines, creating a smoky atmospheric effect (pioneered by da Vinci)." },
    { term: "Baroque", definition: "An ornate artistic style (1600s–1700s) characterized by dramatic lighting, rich color, emotional intensity, and grandeur." },
    { term: "Composition", definition: "The arrangement of visual elements within an artwork to create a unified, balanced, and aesthetically pleasing whole." },
  ],
  cs: [
    { term: "Declarative Knowledge", definition: "Statements of truth explaining 'what is'—facts, definitions, or mathematical formulas without procedural steps." },
    { term: "Imperative Knowledge", definition: "A recipe, procedure, or sequence of step-by-step instructions showing 'how to' compute a result." },
    { term: "Variable Binding", definition: "Associating a variable name in a namespace with a specific address in memory containing a data object." },
    { term: "Type Casting", definition: "Explicitly converting a value from one data type to another (e.g., float('3.14') converts string to float)." },
    { term: "Loop Termination", definition: "The logical condition under which a repeating sequence (loop) halts execution to prevent infinite iteration." },
    { term: "Algorithm", definition: "A finite, well-defined sequence of computational steps that transforms input into a desired output." },
    { term: "Recursion", definition: "A technique where a function calls itself with modified arguments, approaching a base case to solve problems by decomposition." },
    { term: "Big-O Notation", definition: "A mathematical notation describing the upper bound of an algorithm's time or space complexity as input grows." },
  ],
};

const SUBJECT_QUIZZES: Record<string, { question: string; options: string[]; correct_index: number; explanations: string[] }[]> = {
  biology: [
    {
      question: "What is the primary role of chlorophyll in photosynthesis?",
      options: ["Absorb sunlight energy to drive light reactions", "Fix CO₂ into glucose during the Calvin Cycle", "Transport water from roots to leaves", "Produce ATP in the mitochondria"],
      correct_index: 0,
      explanations: ["Correct! Chlorophyll absorbs light energy that powers the light-dependent reactions.", "Incorrect. CO₂ fixation is done by RuBisCO, not chlorophyll.", "Incorrect. Water transport is handled by xylem vessels.", "Incorrect. Mitochondria produce ATP via cellular respiration, not photosynthesis."],
    },
    {
      question: "What gas do plants release as a byproduct of photosynthesis?",
      options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"],
      correct_index: 2,
      explanations: ["Incorrect. CO₂ is absorbed, not released.", "Incorrect. Nitrogen is not involved.", "Correct! O₂ is released as a byproduct of splitting water molecules.", "Incorrect. Hydrogen atoms are used to build glucose."],
    },
  ],
  economics: [
    {
      question: "What is the primary goal of fiscal policy?",
      options: ["Influence aggregate demand through government spending and taxation", "Adjust interest rates to control money supply", "Regulate international trade tariffs only", "Set minimum wage levels nationwide"],
      correct_index: 0,
      explanations: ["Correct! Fiscal policy uses spending and taxes to influence economic activity.", "Incorrect. Interest rates are adjusted through monetary policy by central banks.", "Incorrect. Trade regulation is only one narrow aspect, not the primary goal.", "Incorrect. Minimum wage is a labor policy, not fiscal policy."],
    },
    {
      question: "What does GDP measure?",
      options: ["Government tax revenue", "Total value of goods and services produced in a country", "National debt level", "Average household income"],
      correct_index: 1,
      explanations: ["Incorrect. Tax revenue is just one component.", "Correct! GDP measures the total monetary value of all finished goods and services produced domestically.", "Incorrect. National debt is a separate metric.", "Incorrect. Household income is measured by different indicators."],
    },
  ],
  art: [
    {
      question: "What artistic innovation did linear perspective introduce?",
      options: ["A mathematical system for creating depth illusion on flat surfaces", "A method for mixing oil-based pigments", "A technique for carving marble sculptures", "A system for cataloging Renaissance artworks"],
      correct_index: 0,
      explanations: ["Correct! Linear perspective uses converging lines and vanishing points to simulate three-dimensional depth.", "Incorrect. Pigment mixing is unrelated to perspective.", "Incorrect. Sculpture techniques are separate from perspective drawing.", "Incorrect. Cataloging is art history methodology, not a visual technique."],
    },
    {
      question: "What is chiaroscuro?",
      options: ["A type of marble used in Renaissance sculpture", "The use of strong light-dark contrasts to create volume", "A method of gold leaf application", "The study of symbolic imagery in art"],
      correct_index: 1,
      explanations: ["Incorrect. Chiaroscuro is a painting technique.", "Correct! Chiaroscuro uses dramatic light and shadow to give the illusion of three-dimensional form.", "Incorrect. Gold leaf application is a different technique called gilding.", "Incorrect. That describes iconography."],
    },
  ],
  cs: [
    {
      question: "What is the primary difference between declarative and imperative knowledge?",
      options: ["Declarative describes what is true; imperative describes the steps to compute it.", "Declarative uses loops; imperative is strictly declarative.", "Declarative is compiled; imperative is interpreted.", "Declarative is mathematical; imperative is only conceptual."],
      correct_index: 0,
      explanations: ["Correct! Declarative focuses on truth/facts, while imperative focuses on recipes/procedures.", "Incorrect. Loops are part of imperative control flow.", "Incorrect. Both types of knowledge can exist in any language environment.", "Incorrect. Declarative is not limited to math, and imperative is fully executable."],
    },
    {
      question: "What happens during variable binding in Python?",
      options: ["A copy of the object is created in a local directory.", "A name is bound to a specific memory location/object reference.", "The computer compiles code to native assembly language.", "A loop is instantly initialized."],
      correct_index: 1,
      explanations: ["Incorrect. Objects are not copied during simple binding.", "Correct! Binding associates a name with an object in memory.", "Incorrect. Python is generally interpreted or byte-compiled.", "Incorrect. Loops are unrelated to namespace bindings."],
    },
  ],
};

/** Extract keywords from prompt to pick the most relevant flashcards */
function pickRelevantFlashcards(prompt: string, pool: { term: string; definition: string }[], count = 5): { term: string; definition: string }[] {
  const lc = prompt.toLowerCase();
  // Score each flashcard by how many of its keywords appear in the prompt
  const scored = pool.map((fc) => {
    const words = fc.term.toLowerCase().split(/\s+/).concat(
      fc.definition.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    );
    const score = words.filter(w => lc.includes(w)).length;
    return { fc, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // Always return at least `count` items — top scored, then fill from pool
  const picked = scored.slice(0, count).map(s => s.fc);
  return picked;
}

function buildContextualSummary(prompt: string, subject: string): string {
  // Extract the first few meaningful sentences from the prompt as basis
  const contentSection = prompt
    .replace(/^.*?Lecture notes:\s*"""/s, "")
    .replace(/"""$/, "")
    .replace(/^Summary:\s*/i, "")
    .replace(/\nTranscript:\s*/i, " ")
    .trim();

  const sentences = contentSection
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .slice(0, 5);

  if (sentences.length >= 2) {
    const emojis = ["🧠", "📦", "🔄", "⚙️", "🎯"];
    const bullets = sentences.map((s, i) => `- ${emojis[i % emojis.length]} **${s.split(/[,;]/)[0].trim()}**: ${s}`);
    return `### 🚀 Key Takeaways — ${subject}\n${bullets.join("\n")}`;
  }

  return `### 🚀 Key Takeaways — ${subject}\n- 🧠 **Core Concepts**: ${contentSection.slice(0, 200)}...\n- 📦 **Application**: Key principles from this ${subject.toLowerCase()} topic are essential for deeper study.\n- 🔄 **Connections**: These ideas link to broader themes in ${subject}.`;
}

function buildContextualFlashcards(prompt: string, subject: string): { term: string; definition: string }[] {
  const pool = SUBJECT_FLASHCARDS[subject] ?? SUBJECT_FLASHCARDS.cs;
  return pickRelevantFlashcards(prompt, pool, 5);
}

function buildContextualQuiz(prompt: string, subject: string): { question: string; options: string[]; correct_index: number; explanations: string[] }[] {
  const pool = SUBJECT_QUIZZES[subject] ?? SUBJECT_QUIZZES.cs;
  const lc = prompt.toLowerCase();
  // Score and pick most relevant quizzes
  const scored = pool.map((q) => {
    const qWords = q.question.toLowerCase().split(/\s+/);
    const score = qWords.filter(w => w.length > 3 && lc.includes(w)).length;
    return { q, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map(s => s.q);
}

/** Generic fallback: extract real terms from the prompt when no subject matches */
function buildGenericDemoFromContent(prompt: string): object {
  // Strip prompt wrapper to get raw content
  const content = prompt
    .replace(/^.*?Lecture notes:\s*"""/s, "")
    .replace(/"""$/, "")
    .replace(/^Summary:\s*/i, "")
    .replace(/\nTranscript:\s*/i, " ")
    .trim();

  // Extract capitalized terms and key phrases
  const termMatches = content.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3}\b/g) ?? [];
  const uniqueTerms = [...new Set(termMatches)].filter(t => t.length > 3).slice(0, 6);

  // Extract sentences for definitions
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

  const flashcards = uniqueTerms.map((term, i) => ({
    term,
    definition: sentences[i] ? sentences[i].slice(0, 150) + (sentences[i].length > 150 ? "…" : "") : `A key concept discussed in this lecture relating to ${term.toLowerCase()}.`,
  }));

  // Ensure at least 3 flashcards
  if (flashcards.length < 3) {
    const fallbackTerms = ["Key Concept", "Core Principle", "Main Takeaway"];
    for (let i = flashcards.length; i < 3; i++) {
      flashcards.push({
        term: fallbackTerms[i] ?? `Concept ${i + 1}`,
        definition: sentences[i] ?? `An important idea from this lecture material.`,
      });
    }
  }

  // Detect subject from content
  const lc = content.toLowerCase();
  let subject = "General Studies";
  if (lc.includes("comput") || lc.includes("algorithm") || lc.includes("code")) subject = "Computer Science";
  else if (lc.includes("cell") || lc.includes("organism") || lc.includes("biolog")) subject = "Biology";
  else if (lc.includes("econom") || lc.includes("market") || lc.includes("price")) subject = "Economics";
  else if (lc.includes("paint") || lc.includes("sculpt") || lc.includes("art")) subject = "Art History";

  // Build a quiz from the extracted content
  const quizQuestion = flashcards.length >= 2
    ? `Which of the following best describes "${flashcards[0].term}"?`
    : "What is a central theme of this lecture?";

  return {
    subject,
    difficulty: "Intermediate" as const,
    tags: uniqueTerms.slice(0, 3).map(t => t.toLowerCase().replace(/\s+/g, "-")),
    summary: buildContextualSummary(prompt, subject),
    flashcards,
    quiz: [{
      question: quizQuestion,
      options: [
        flashcards[0]?.definition?.slice(0, 80) ?? "The primary concept discussed",
        "An unrelated mathematical theorem",
        "A historical event from the 18th century",
        "None of the above",
      ],
      correct_index: 0,
      explanations: [
        "Correct! This matches the lecture content.",
        "Incorrect. This is not relevant to the topic.",
        "Incorrect. The lecture covers different material.",
        "Incorrect. The first option accurately describes this concept.",
      ],
    }],
  };
}

function getFrictionlessDemoData(prompt: string, isJSONMode: boolean): string {
  const lowercasePrompt = prompt.toLowerCase();

  if (isJSONMode || lowercasePrompt.includes("subject") || lowercasePrompt.includes("flashcards") || lowercasePrompt.includes("lecture notes")) {
    // Detect subject from actual content
    const subjectDemos: Record<string, () => object> = {
      biology: () => ({
        subject: "Biology",
        difficulty: "Intermediate",
        tags: ["biology", "cells", "life-science"],
        summary: buildContextualSummary(prompt, "Biology"),
        flashcards: buildContextualFlashcards(prompt, "biology"),
        quiz: buildContextualQuiz(prompt, "biology"),
      }),
      economics: () => ({
        subject: "Economics",
        difficulty: "Intermediate",
        tags: ["economics", "markets", "policy"],
        summary: buildContextualSummary(prompt, "Economics"),
        flashcards: buildContextualFlashcards(prompt, "economics"),
        quiz: buildContextualQuiz(prompt, "economics"),
      }),
      art: () => ({
        subject: "Art History",
        difficulty: "Intermediate",
        tags: ["art", "history", "culture"],
        summary: buildContextualSummary(prompt, "Art History"),
        flashcards: buildContextualFlashcards(prompt, "art"),
        quiz: buildContextualQuiz(prompt, "art"),
      }),
      cs: () => ({
        subject: "Computer Science",
        difficulty: "Intermediate",
        tags: ["computation", "programming", "mit-cs"],
        summary: buildContextualSummary(prompt, "Computer Science"),
        flashcards: buildContextualFlashcards(prompt, "cs"),
        quiz: buildContextualQuiz(prompt, "cs"),
      }),
    };

    // Match subject from prompt content
    let factory: (() => object) | undefined;
    if (lowercasePrompt.includes("photosynthesis") || lowercasePrompt.includes("biology") || lowercasePrompt.includes("chloro") || lowercasePrompt.includes("cell") || lowercasePrompt.includes("dna") || lowercasePrompt.includes("organism")) {
      factory = subjectDemos.biology;
    } else if (lowercasePrompt.includes("economics") || lowercasePrompt.includes("inflation") || lowercasePrompt.includes("macroeconomics") || lowercasePrompt.includes("gdp") || lowercasePrompt.includes("fiscal") || lowercasePrompt.includes("monetary")) {
      factory = subjectDemos.economics;
    } else if (lowercasePrompt.includes("art") || lowercasePrompt.includes("renaissance") || lowercasePrompt.includes("painting") || lowercasePrompt.includes("sculpture") || lowercasePrompt.includes("perspective")) {
      factory = subjectDemos.art;
    } else if (lowercasePrompt.includes("variable") || lowercasePrompt.includes("loop") || lowercasePrompt.includes("python") || lowercasePrompt.includes("algorithm") || lowercasePrompt.includes("function") || lowercasePrompt.includes("computation")) {
      factory = subjectDemos.cs;
    }

    if (factory) {
      return JSON.stringify(factory());
    }

    // Generic fallback — extract terms from the actual prompt content
    return JSON.stringify(buildGenericDemoFromContent(prompt));
  }

  if (lowercasePrompt.includes("dr. analogy") || lowercasePrompt.includes(" eccentrically ") || lowercasePrompt.includes(" eccentric professor ")) {
    let concept = "variables & computer memory";
    if (lowercasePrompt.includes("declarative")) concept = "declarative vs imperative knowledge";
    else if (lowercasePrompt.includes("loop")) concept = "loops and repetition";
    else if (lowercasePrompt.includes("casting")) concept = "type casting and conversions";
    return `Dr. Analogy: "Aha! Think of ${concept} like a series of labeled drawers in a magical wizard chest. When we bind a variable, we are simply pasting a sticky note label onto one of these drawers so we can quickly find our potions later! If we change the name, we are just moving the sticky note to a different drawer!"`;
  }

  if (lowercasePrompt.includes("strict compiler") || lowercasePrompt.includes(" robot tutor ")) {
    return `Strict Compiler: "ERROR: Metaphor detected. Oversimplification identified. Wizard chests do not accurately represent pointers, reference counts, or stack vs. heap allocations. In computer science, variables bind references to heap objects. Question for student: If two variable labels are bound to the same list object, what happens when you modify the list using the first label?"`;
  }

  if (lowercasePrompt.includes("curriculum architect") || lowercasePrompt.includes("mistakes")) {
    return `🧠 Cognitive Gap identified: The student confuses declarative facts with imperative execution processes, particularly when tracking variable reference updates in loops.

3-Step Study Path:
1. 📖 Code Tracing: Draw a stack-and-heap memory box on paper for each line of code in a loop.
2. 🎯 Variable Audits: Track variable references at loop iterations 0, 1, and 2.
3. ✍️ Metacognition: Write out the declarative rule before implementing an imperative script.

Practice Question:
What is the state of variable x after running:
x = 5
for i in range(3):
  x = x + i
(Answer: x is 8. Traced as: 5 + 0 = 5, 5 + 1 = 6, 6 + 2 = 8)`;
  }

  if (lowercasePrompt.includes("supportive") || lowercasePrompt.includes("grade") || lowercasePrompt.includes("evaluate")) {
    return `Grading Assessment: 9/10

SUPPORTIVE FEEDBACK:
Your explanation of variables and memory binding is extremely clear and demonstrates a solid understanding of namespaces! You accurately noted that variables hold object references.

3 Incremental Hints for Mastery:
1. 💡 Think about what happens when an object has no variables bound to it (Garbage Collection).
2. 💡 Differentiate between mutable (e.g. lists) and immutable (e.g. integers) objects during assignment.
3. 💡 Explain what a compiler does when it encounters a variable declaration vs an assignment.`;
  }

  return `Demo completion response. The system is operating in frictionless hackathon mode. All algorithms are fully simulated with premium static concepts.`;
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await callAIGateway("Reply with just the word: pong");
    return { ok: true, message: `Connected. Sample: "${out.slice(0, 60)}"` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function extractJSON<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

// ---------------- MOCK DATA ----------------

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

export const MOCK_LECTURES: { id: string; title: string; workspace: string; raw: string; parsed: ParsedLecture }[] = [
  {
    id: "mit-6100l-1",
    title: "MIT CS 6.100L Lecture 1 — What is Computation?",
    workspace: "Computer Science",
    raw: "Lecture notes on computation, data types, expressions...",
    parsed: {
      subject: "Computer Science",
      difficulty: "Beginner",
      tags: ["python", "computation", "data types"],
      summary:
        "- 💻 **Computation** is the manipulation of information using rules.\n- 🔢 **Data types**: integers, floats, strings, booleans.\n- ⚙️ Programs are sequences of *expressions* evaluated by an interpreter.\n- 🧠 Variables bind names to values for later reuse.",
      flashcards: [
        { term: "Expression", definition: "A combination of values and operators that evaluates to a value." },
        { term: "Variable", definition: "A name bound to a value in memory." },
        { term: "Interpreter", definition: "A program that executes source code line by line." },
        { term: "Data Type", definition: "A classification telling the interpreter how to use a value." },
      ],
      quiz: [
        {
          question: "Which of these is NOT a primitive data type in Python?",
          options: ["int", "float", "matrix", "str"],
          correct_index: 2,
          explanations: [
            "int IS a primitive.",
            "float IS a primitive.",
            "Correct — matrix is not built-in; you'd use NumPy.",
            "str IS a primitive.",
          ],
        },
        {
          question: "What does '3 + 4' represent?",
          options: ["A variable", "An expression", "A statement", "A type"],
          correct_index: 1,
          explanations: [
            "Variables bind names to values.",
            "Correct — it evaluates to 7.",
            "Statements perform actions; this evaluates.",
            "Types classify values, not operations.",
          ],
        },
      ],
    },
  },
  {
    id: "bio-photo-1",
    title: "Intro to Photosynthesis",
    workspace: "Biology",
    raw: "Photosynthesis converts light energy to chemical energy...",
    parsed: {
      subject: "Biology",
      difficulty: "Beginner",
      tags: ["plants", "chemistry", "energy"],
      summary:
        "- 🌱 Plants convert **sunlight + CO₂ + water → glucose + oxygen**.\n- ☀️ Happens in the *chloroplasts* using chlorophyll.\n- 🔄 Two stages: **light reactions** & **Calvin cycle**.\n- 🌍 Foundation of nearly all food chains.",
      flashcards: [
        { term: "Chlorophyll", definition: "The green pigment that absorbs sunlight." },
        { term: "Calvin Cycle", definition: "The light-independent stage that fixes CO₂ into sugars." },
        { term: "Stomata", definition: "Tiny pores on leaves for gas exchange." },
      ],
      quiz: [
        {
          question: "What gas do plants release during photosynthesis?",
          options: ["CO₂", "Nitrogen", "Oxygen", "Hydrogen"],
          correct_index: 2,
          explanations: [
            "CO₂ is absorbed, not released.",
            "Nitrogen is not produced here.",
            "Correct — O₂ is released as a byproduct.",
            "Hydrogen is split from water but not released.",
          ],
        },
      ],
    },
  },
];

export const MOCK_WORKSPACES = ["Computer Science", "Biology", "Economics", "Art History"];

export const PARSE_PROMPT = (text: string) => `You are an expert study assistant. Analyze the following lecture notes and return ONLY a valid raw JSON object (no markdown fences) matching this exact schema:

{
  "subject": "e.g., Biology, Economics, Art History",
  "difficulty": "Beginner | Intermediate | Advanced",
  "tags": ["tag1","tag2","tag3"],
  "summary": "A clean, bulleted, emoji-friendly markdown summary",
  "flashcards": [{"term":"...","definition":"..."}],
  "quiz": [{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanations":["...","...","...","..."]}]
}

Lecture notes:
"""
${text}
"""`;

export interface GranolaNote {
  id: string;
  title: string;
  ai_summary: string;
  transcript: string;
  workspace: string;
}

export interface GranolaFolder {
  id: string;
  name: string;
}

export const FALLBACK_MOCK_NOTES: GranolaNote[] = [
  {
    id: "g-raw-1",
    title: "MIT CS 6.100L Lecture 1 — Computation Notes",
    workspace: "Computer Science",
    ai_summary: "Lecture notes on computation, primitive data types, evaluation of expressions, operators, and interpreter behavior in modern environments like Python.",
    transcript: "Lecture notes on computation, primitive data types, evaluation of expressions, operators, and interpreter behavior in modern environments like Python. Variables bind specific memory locations to reuse references across sequences."
  },
  {
    id: "g-raw-2",
    title: "Intro to Photosynthesis Meeting",
    workspace: "Biology",
    ai_summary: "Photosynthesis converts light energy into complex chemical configurations.",
    transcript: "Photosynthesis converts light energy into complex chemical configurations. The process relies on chlorophyll pigments stored directly within plant chloroplast architectures to successfully execute light reactions alongside the traditional Calvin cycle."
  },
  {
    id: "g-raw-3",
    title: "Macroeconomics Principles & Inflationary Pressures",
    workspace: "Economics",
    ai_summary: "An examination of how shifts in structural liquidity and consumer index metrics force monetary updates.",
    transcript: "An examination of how shifts in structural liquidity and consumer index metrics force monetary updates. Discussed pricing structures, supply chain disruptions, and historic models tracking resource pricing behavior."
  },
  {
    id: "g-raw-4",
    title: "Renaissance Art Movements & Perspectives",
    workspace: "Art History",
    ai_summary: "A comprehensive breakdown of linear perspective techniques introduced during the early 15th century.",
    transcript: "A comprehensive breakdown of linear perspective techniques introduced during the early 15th century. Explored humanism impacts on iconographic choices and panel painting compositions across Florence."
  }
];

function getGranolaRequestInit(manualKey: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (manualKey) {
    headers["Authorization"] = `Bearer ${manualKey}`;
    return { headers };
  }
  
  const lovableApiKey = typeof window !== 'undefined'
    ? ((window as any).LOVABLE_API_KEY || (import.meta.env.VITE_LOVABLE_API_KEY || ''))
    : '';
  if (lovableApiKey) {
    headers["Authorization"] = `Bearer ${lovableApiKey}`;
    headers["X-Lovable-Api-Key"] = lovableApiKey;
  }
  return { headers };
}

function getGranolaUrl(endpoint: string, manualKey: string | null): string {
  if (manualKey) {
    return `https://public-api.granola.ai/v1${endpoint}`;
  }
  return `/api/granola${endpoint}`;
}

export async function fetchGranolaStatus(): Promise<{ connected: boolean; reason?: string | null; outcome?: string }> {
  try {
    const manualKey = typeof window !== 'undefined'
      ? (localStorage.getItem('granola_api_key') || localStorage.getItem('lectureloop_granola_key'))
      : null;
    if (manualKey) {
      return { connected: true, outcome: "manual_key" };
    }
    try {
      const res = await fetch("/api/granola/status", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return { connected: true, outcome: "gateway" };
      }
    } catch {
      // Gateway unreachable — not fatal, fall through
    }
    return { connected: false, reason: "No Granola API key found and gateway is unavailable." };
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchGranolaFolders(): Promise<GranolaFolder[]> {
  const manualKey = typeof window !== 'undefined'
    ? (localStorage.getItem('granola_api_key') || localStorage.getItem('lectureloop_granola_key'))
    : null;
  const init = getGranolaRequestInit(manualKey);
  const all: GranolaFolder[] = [];
  let cursor: string | undefined;
  let guard = 0;
  try {
    do {
      const qs = new URLSearchParams({ page_size: "30" });
      if (cursor) qs.set("cursor", cursor);
      const url = getGranolaUrl(`/folders?${qs.toString()}`, manualKey);
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        console.warn(`[Granola] Folders endpoint returned ${res.status}, returning empty list`);
        return all; // Return whatever we have so far (likely empty)
      }
      const data = await res.json();
      const folders = (data.folders ?? []) as Array<{ id: string; name: string }>;
      all.push(...folders.map((f) => ({ id: f.id, name: f.name })));
      cursor = data.hasMore ? data.cursor : undefined;
      guard++;
    } while (cursor && guard < 10);
  } catch (e) {
    console.warn("[Granola] Folders fetch error, returning empty list:", e);
  }
  return all;
}

export async function fetchGranolaNotes(folderId?: string): Promise<GranolaNote[]> {
  const manualKey = typeof window !== 'undefined'
    ? (localStorage.getItem('granola_api_key') || localStorage.getItem('lectureloop_granola_key'))
    : null;
  const init = getGranolaRequestInit(manualKey);
  const all: GranolaNote[] = [];
  let cursor: string | undefined;
  let guard = 0;
  try {
    do {
      const qs = new URLSearchParams({ limit: "30", page_size: "30" });
      if (cursor) qs.set("cursor", cursor);
      if (folderId) qs.set("folder_id", folderId);

      let url = getGranolaUrl(`/notes?${qs.toString()}`, manualKey);
      let res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });

      // Fallback if proxy route fails (e.g. 404/500) and we don't have a manual key
      if (!res.ok && !manualKey) {
        try {
          const altUrl = `/api/connectors/granola/meetings?${qs.toString()}`;
          const altRes = await fetch(altUrl, { ...init, signal: AbortSignal.timeout(8000) });
          if (altRes.ok) res = altRes;
        } catch {
          // alt route also unavailable
        }
      }

      if (!res.ok) {
        console.warn(`[Granola] Notes endpoint returned ${res.status}, returning what we have`);
        return all;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.notes || data.meetings || []);
      all.push(
        ...list.map((n: any) => ({
          id: String(n.id ?? crypto.randomUUID()),
          title: String(n.title ?? "Untitled Meeting"),
          ai_summary: String(n.ai_summary ?? n.summary ?? ""),
          transcript: String(n.transcript ?? ""),
          workspace: String(
            (n.workspace ||
            n.workspace_name ||
            n.workspaceName ||
            (n.folder as { name?: string } | undefined)?.name) ??
              n.folder_name ??
              "General"
          ),
        })),
      );
      cursor = data.hasMore ? data.cursor : undefined;
      guard++;
    } while (cursor && guard < 5);
  } catch (e) {
    console.warn("[Granola] Notes fetch error, returning what we have:", e);
  }
  return all;
}

export async function fetchGranolaNoteDetail(id: string): Promise<GranolaNote | null> {
  const manualKey = typeof window !== 'undefined'
    ? (localStorage.getItem('granola_api_key') || localStorage.getItem('lectureloop_granola_key'))
    : null;
  const init = getGranolaRequestInit(manualKey);
  try {
    const url = getGranolaUrl(`/notes/${encodeURIComponent(id)}?include=transcript`, manualKey);
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const n = await res.json();
    return {
      id: String(n.id ?? id),
      title: String(n.title ?? "Untitled"),
      ai_summary: String(n.ai_summary ?? n.summary ?? ""),
      transcript: String(n.transcript ?? ""),
      workspace: String((n.folder as { name?: string } | undefined)?.name ?? n.folder_name ?? n.workspace ?? "General"),
    };
  } catch {
    return null;
  }
}

