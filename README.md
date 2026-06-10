# 🕹️ LectureLoop Arcade

**LectureLoop Arcade** is a vibrant, retro-themed, gamified AI study portal built on **TanStack Start** and powered by a multi-provider AI engine. It transforms raw meeting transcripts, lectures, and custom text documents into interactive study quests, featuring quizzes, flashcards, a Socratic debate arena, and an AI curriculum architect.

---

## 🚀 Key Features

### 🏠 1. Player Dashboard
*   **Streak Tracker:** Tracks your consecutive study days with a visual ring progress chart.
*   **XP Tracker:** Visualizes weekly study progress (XP earned) across the days of the week.
*   **Mastery Progress:** Charts your learning coverage and mastery levels across different subjects.
*   **Quick Stats:** Instant view of total XP, total mastered lectures, trophies unlocked, and current streak.

### 📚 2. Lecture Deck (Granola Hub)
The central control room of your study material, featuring a **Three-Tier State Management System** that links your raw notes to finished gamified study packages:
*   **State A (Granola Account Meetings):** A checklist selection panel loaded dynamically from your connected Granola account.
*   **State B (Imported Raw Notes):** User-selected notes imported to the raw sidebar. Features two separate collapsible drawers to preview original notes and full transcript separately. Transcripts are dynamically parsed from Granola's structured JSON arrays and formatted as clean speaker-attributed text blocks (`[Speaker Label]: text`).
*   **State C (Mastered Portal Deck):** Completed, AI-analyzed modules. Shows parsed summaries (Cheat Sheets), flashcards, and quizzes.
*   *Alternative Manual Paste:* Allow students to paste custom transcripts or notes directly into the parser.

### 🎮 3. Arcade Arena
*   **Active Quiz Quest:** Tests your comprehension of the active lecture's concepts.
*   **Instant Feedback:** Reveals correct answers, highlights incorrect guesses with a screen shake animation, and provides comprehensive explanations.
*   **Score & XP:** Complete the quiz to earn **+50 XP** and unlock corresponding achievement badges.
*   **Spaced Repetition Mistakes:** Incorrect answers are logged to be resolved later in the Curriculum Architect.

### 🗣️ 4. Socratic Debate Arena
Engage in a live, dual-agent intellectual debate on any concept from your lectures:
*   **Dr. Analogy (🎩):** A friendly, eccentric professor who explains complex topics to a 10-year-old using vivid and fun metaphors.
*   **The Strict Compiler (🤖):** A precise, zero-nonsense robot tutor who critiques the analogy for oversimplifications or omissions and challenges you with a deep follow-up question.

### 🧠 5. Curriculum Architect
*   **Cognitive Gap Finder:** Analyzes mistakes logged during the quizzes to pinpoint specific areas of weakness.
*   **Personalized Study Path:** Generates a custom 3-step action plan to turn weak spots into masteries.
*   **Custom Practice Questions:** Provides tailored sample questions to test and resolve identified cognitive gaps.
*   **Real AI Analysis:** Enabled to use secure server-side cloud proxy routing out-of-the-box, meaning actual AI analysis runs seamlessly even if no local browser API key settings are configured.

### 📝 6. Critique Sandbox
*   **Open-Ended Essays:** Test your long-form retention by explaining a lecture in your own words.
*   **Double-Agent Feedback Loop:**
    1.  *Critique (Step A):* Grades your submission out of 10 and generates detailed critique feedback based strictly on facts in the lecture context.
    2.  *Supportive Refinement (Step B):* Refines the grading to be highly encouraging, avoids giving away correct answers, and suggests 3 incremental hints.

### 🏆 7. Trophy Room (Achievements)
*   Unlock interactive badges based on your performance, such as *First Quest*, *On Fire (3-day streak)*, *Quiz Master*, *AI Tamer*, *Polyglot*, and *Perfectionist*.

---

## 🛠️ Technology Stack & Styling

*   **Core Framework:** [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) — High-performance React application with file-based routing and seamless server-side capabilities.
*   **Styling System:** [Tailwind CSS v4](https://tailwindcss.com/) — Utilizes the new `@theme inline` configuration, with custom-designed arcade color palettes (`oklch` harmonized coordinates).
*   **Animations:** Retro screen-shake, interactive 3D card flipping, and smooth bounce-in animations configured natively in `src/styles.css`.
*   **API Connectors & Proxy:**
    *   **Granola.ai API:** Integrations for folders, note lists, and rich transcripts (`/api/granola/*` endpoints).
    *   **CORS Bypass Proxy:** Local routing `/api/granola/$` acts as a backend proxy that forwards queries to `https://public-api.granola.ai/v1` when manual browser-local keys are detected, bypassing browser cross-origin constraints.
    *   **Lovable AI Gateway:** Dynamic secure proxy routing (`/api/ai/completions`) utilizing Gemini models.

---

## ⚡ Setup & Integration

### Prerequisites
*   Node.js (v18+) or Bun installed.

### Installation
1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd knowledge-loop-arena-main
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    bun install
    ```

### Configuration (AI & Granola)
The app runs a fully functional **frictionless demo mode** out-of-the-box using mock datasets. To unlock the full power of real-time AI and import live notes from your Granola account:

#### Option 1: In-App UI Configuration
Click the **Gear Icon ⚙️** (AI Engine Control) in the top header:
1.  Select your preferred provider (OpenAI, Anthropic, Gemini, Vertex, Azure, Mistral, Ollama, Bedrock, etc.).
2.  Provide your API Key/Credentials and base URL.
3.  Click **Test Connection ⚡** and save settings.
4.  Enter your Granola API credentials in the settings modal or set a manual key in your browser's local storage under `granola_api_key`.

#### Option 2: Server-Side Environment Variables
Create a `.env` file in the root directory:
```env
LOVABLE_API_KEY="your-lovable-api-key"
GRANOLA_API_KEY="your-granola-api-key"
```

### Running Locally
Start the development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000` (or the port specified by Vite).

---

## 📂 Project Structure

```
├── .lovable/
├── src/
│   ├── components/
│   │   ├── arcade/             # Gamified study features & components
│   │   │   ├── pages/          # Individual tool pages (Dashboard, Arena, Socratic, etc.)
│   │   │   ├── AppShell.tsx    # Header, streak tracking, global navigation
│   │   │   ├── SettingsModal.ts# Multi-provider API configuration
│   │   │   └── store.tsx       # Global state and achievements provider
│   │   └── ui/                 # Shadcn & custom UI components
│   ├── hooks/                  # React hooks
│   ├── lib/
│   │   └── aiGateway.ts        # AI completions dispatcher and mockup builders
│   ├── routes/
│   │   ├── api/                # TanStack Start server-side handler routes
│   │   │   ├── ai.completions.ts
│   │   │   ├── granola.$.ts
│   │   │   └── granola.status.ts
│   │   ├── __root.tsx          # Root shell layout
│   │   └── index.tsx           # Home entrypoint loading the Arcade Provider
│   ├── styles.css              # Custom Tailwind variables and neon styling
│   └── main.tsx
├── package.json
└── vite.config.ts
```
