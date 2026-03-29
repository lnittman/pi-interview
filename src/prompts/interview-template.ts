/**
 * Quiz prompt template.
 *
 * Every question MUST be multiple choice.
 * No "text" type questions — the UI handles freeform via "Type something else..." option.
 */

import type { TurnContext, QuizConfig } from "../core/types.js";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + "…";
}

export interface QuizPromptContext {
  assistantText: string;
  turnStatus: TurnContext["status"];
  recentUserPrompts: string[];
  toolSignals: string[];
  touchedFiles: string[];
  unresolvedQuestions: string[];
  abortContextNote?: string;
  maxQuestions: number;
  maxOptions: number;
  customInstruction: string;
}

export function buildQuizPromptContext(
  turn: TurnContext,
  config: QuizConfig
): QuizPromptContext {
  return {
    assistantText: truncate(turn.assistantText, 50_000),
    turnStatus: turn.status,
    recentUserPrompts: turn.recentUserPrompts
      .slice(0, 10)
      .map((p) => truncate(p, 500)),
    toolSignals: turn.toolSignals.slice(0, 12),
    touchedFiles: turn.touchedFiles.slice(0, 10),
    unresolvedQuestions: turn.unresolvedQuestions.slice(0, 8),
    abortContextNote: turn.abortContextNote
      ? truncate(turn.abortContextNote, 300)
      : undefined,
    maxQuestions: config.maxQuestions,
    maxOptions: config.maxOptions,
    customInstruction: config.customInstruction,
  };
}

export function renderQuizPrompt(ctx: QuizPromptContext): string {
  return `You generate multiple-choice questions to help a developer decide what to instruct their coding agent next.

EVERY question MUST have concrete options. No free-text questions.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "string",
      "text": "Short question (under 80 chars)",
      "type": "single",
      "options": [
        { "label": "Concrete action (under 60 chars)", "description": "optional context" }
      ]
    }
  ],
  "skipped": false
}

If the next step is obvious (e.g. agent proposed something clear), return:
{ "questions": [], "skipped": true, "skipReason": "brief reason" }

── Context ──

TurnStatus: ${ctx.turnStatus}
${ctx.abortContextNote ? `\nAbortContext:\n${ctx.abortContextNote}` : ""}

RecentUserMessages:
${ctx.recentUserPrompts.length > 0 ? ctx.recentUserPrompts.map((p) => `- ${p}`).join("\n") : "(none)"}

ToolSignals:
${ctx.toolSignals.length > 0 ? ctx.toolSignals.map((s) => `- ${s}`).join("\n") : "(none)"}

TouchedFiles:
${ctx.touchedFiles.length > 0 ? ctx.touchedFiles.map((f) => `- ${f}`).join("\n") : "(none)"}

UnresolvedQuestions:
${ctx.unresolvedQuestions.length > 0 ? ctx.unresolvedQuestions.map((q) => `- ${q}`).join("\n") : "(none)"}

LatestAssistantMessage:
\`\`\`
${ctx.assistantText || "(empty)"}
\`\`\`
${ctx.customInstruction.trim() ? `\nPreference:\n${ctx.customInstruction.trim()}` : ""}

── Rules ──

GROUNDING (critical):
- Every option label MUST reference specific artifacts from the context above
- If TouchedFiles has "src/auth/login.ts", options should name that file, not say "the auth module"
- If ToolSignals has "bash(npm test):error", options should reference the test failure specifically
- If UnresolvedQuestions exist, turn them into structured options verbatim
- NEVER generate generic options like "Continue working", "Fix issues", "Improve code"
- Bad: "Add error handling" — Good: "Add try/catch to parseConfig in src/config/loader.ts"
- Bad: "Run tests" — Good: "Re-run the 3 failing vitest specs in packages/backend"

STRUCTURE:
- Generate 1-${ctx.maxQuestions} questions, each with 2-${ctx.maxOptions} options
- type is ALWAYS "single" or "multi" — NEVER "text"
- First option = most natural/likely next step
- Use "multi" only when combining makes sense (e.g. "fix lint AND run tests")
- description field: use for file paths, error counts, or other concrete context

SKIP when:
- Agent proposed a clear next step and user just needs to affirm
- Conversation is wrapping up naturally
- The last exchange was a simple Q&A with no follow-up implied`;
}
