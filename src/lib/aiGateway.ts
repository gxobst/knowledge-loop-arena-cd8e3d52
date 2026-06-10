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
  const s = loadSettings();
  if (!isConfigured(s)) throw new Error("No AI configuration set. Open AI Engine Settings.");
  const model = getModel(s);

  // Anthropic
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
    if (!res.ok) throw new Error(await parseError(res));
    const j = await res.json();
    return j.content?.[0]?.text ?? "";
  }

  // Gemini AI Studio
  if (s.provider === "gemini") {
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
    if (!res.ok) throw new Error(await parseError(res));
    const j = await res.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // Vertex AI
  if (s.provider === "vertex") {
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
    if (!res.ok) throw new Error(await parseError(res));
    const j = await res.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // Microsoft Foundry / Azure
  if (s.provider === "foundry") {
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
    if (!res.ok) throw new Error(await parseError(res));
    const j = await res.json();
    return j.choices?.[0]?.message?.content ?? "";
  }

  // OpenAI-compatible: openai, mistral, openrouter, deepseek, qwen, ollama, ernie, bedrock(proxy)
  const url = `${s.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
  };
  if (isJSONMode) body.response_format = { type: "json_object" };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await parseError(res));
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
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

export async function fetchGranolaStatus(): Promise<{ connected: boolean; reason?: string | null; outcome?: string }> {
  try {
    const res = await fetch("/api/granola/status");
    if (!res.ok) return { connected: false, reason: `Status ${res.status}` };
    return await res.json();
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchGranolaFolders(): Promise<GranolaFolder[]> {
  const all: GranolaFolder[] = [];
  let cursor: string | undefined;
  let guard = 0;
  do {
    const qs = new URLSearchParams({ page_size: "30" });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(`/api/granola/folders?${qs.toString()}`);
    if (!res.ok) throw new Error(`Folders fetch failed: ${res.status}`);
    const data = await res.json();
    const folders = (data.folders ?? []) as Array<{ id: string; name: string }>;
    all.push(...folders.map((f) => ({ id: f.id, name: f.name })));
    cursor = data.hasMore ? data.cursor : undefined;
    guard++;
  } while (cursor && guard < 10);
  return all;
}

export async function fetchGranolaNotes(folderId?: string): Promise<GranolaNote[]> {
  const all: GranolaNote[] = [];
  let cursor: string | undefined;
  let guard = 0;
  do {
    const qs = new URLSearchParams({ limit: "20" });
    if (cursor) qs.set("cursor", cursor);
    if (folderId) qs.set("folder_id", folderId);
    const res = await fetch(`/api/granola/notes?${qs.toString()}`);
    if (!res.ok) throw new Error(`Notes fetch failed: ${res.status}`);
    const data = await res.json();
    const notes = (data.notes ?? []) as Array<Record<string, unknown>>;
    all.push(
      ...notes.map((n) => ({
        id: String(n.id ?? crypto.randomUUID()),
        title: String(n.title ?? "Untitled Meeting"),
        ai_summary: String(n.ai_summary ?? n.summary ?? ""),
        transcript: String(n.transcript ?? ""),
        workspace: String(
          (n.folder as { name?: string } | undefined)?.name ??
            n.folder_name ??
            n.workspace ??
            "General",
        ),
      })),
    );
    cursor = data.hasMore ? data.cursor : undefined;
    guard++;
  } while (cursor && guard < 5);
  return all;
}

export async function fetchGranolaNoteDetail(id: string): Promise<GranolaNote | null> {
  try {
    const res = await fetch(`/api/granola/notes/${encodeURIComponent(id)}?include=transcript`);
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

