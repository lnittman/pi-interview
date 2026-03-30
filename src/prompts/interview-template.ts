/**
 * Interview prompt template.
 *
 * Informed by:
 * - Ask-deep SKILL.md: OARS technique, question archetypes, depth calibration
 * - Saya: signal calibration (directive types), intimacy/channel tier scaling
 * - Agents CLI: HIL workflow patterns (structured questions → typed answers)
 * - Ask-user extension: multi-select + notes UX (the UI contract)
 */

import type { TurnContext, QuizConfig } from "../core/types.js";
import type { ProjectSnapshot } from "../core/project-context.js";
import { formatProjectContext } from "../core/project-context.js";
import type { AgentContext } from "../core/agent-context.js";
import { formatAgentContext } from "../core/agent-context.js";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + "\u2026";
}

export interface QuizPromptContext {
  assistantText: string;
  turnStatus: TurnContext["status"];
  recentUserPrompts: string[];
  toolSignals: string[];
  touchedFiles: string[];
  unresolvedQuestions: string[];
  abortContextNote?: string;
  projectContext?: string;
  agentContext?: string;
  maxQuestions: number;
  maxOptions: number;
  customInstruction: string;
}

export function buildQuizPromptContext(
  turn: TurnContext,
  config: QuizConfig,
  project?: ProjectSnapshot,
  agent?: AgentContext | null
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
    projectContext: project ? formatProjectContext(project) : undefined,
    agentContext: agent ? formatAgentContext(agent) : undefined,
    maxQuestions: config.maxQuestions,
    maxOptions: config.maxOptions,
    customInstruction: config.customInstruction,
  };
}

export function renderQuizPrompt(ctx: QuizPromptContext): string {
  return `You generate interview questions to help a developer decide what to tell their coding agent next.

The user sees multi-select checkboxes. They toggle options with Enter/Space and confirm with Tab.
They can also add freeform notes via 'i' key. You do NOT generate text-input questions.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "string",
      "text": "Question under 80 chars",
      "type": "multi",
      "options": [
        { "label": "Action under 60 chars", "description": "brief why/what" }
      ]
    }
  ],
  "skipped": false
}

Skip: { "questions": [], "skipped": true, "skipReason": "..." }

\u2500\u2500 Situation \u2500\u2500
${ctx.projectContext ? `\nProject:\n${ctx.projectContext}\n` : ""}${ctx.agentContext ? `\nEcosystem:\n${ctx.agentContext}\n` : ""}
TurnStatus: ${ctx.turnStatus}
${ctx.abortContextNote ? `AbortContext: ${ctx.abortContextNote}\n` : ""}
RecentUserMessages:
${ctx.recentUserPrompts.length > 0 ? ctx.recentUserPrompts.map((p) => `- ${p}`).join("\n") : "(none)"}

ToolSignals:
${ctx.toolSignals.length > 0 ? ctx.toolSignals.map((s) => `- ${s}`).join("\n") : "(none)"}

TouchedFiles:
${ctx.touchedFiles.length > 0 ? ctx.touchedFiles.map((f) => `- ${f}`).join("\n") : "(none)"}

UnresolvedQuestions:
${ctx.unresolvedQuestions.length > 0 ? ctx.unresolvedQuestions.map((q) => `- ${q}`).join("\n") : "(none)"}

AssistantMessage:
\`\`\`
${ctx.assistantText || "(empty)"}
\`\`\`
${ctx.customInstruction.trim() ? `\nPreference: ${ctx.customInstruction.trim()}` : ""}

\u2500\u2500 Question Design (from ask-deep) \u2500\u2500

ARCHETYPE SELECTION \u2014 pick the best fit:
- Direction: "What should we focus on next?" \u2014 task completed, multiple paths
- Scope: "What\u2019s in scope?" \u2014 broad task, risk of scope creep
- Recovery: "How should we handle the failures?" \u2014 errors occurred
- Trade-off: "Which approach?" \u2014 valid alternatives with different costs
- Delegation: "Should we use a skill/agent?" \u2014 a skill or role matches the work
- Validation: "Does this look right?" \u2014 before irreversible action

SKIP WHEN (save the user\u2019s time):
- Agent proposed a clear next step \u2014 user just needs to affirm
- Simple Q&A with no follow-up needed
- Session is wrapping up
- The last user message was a direct instruction that was completed

DEPTH CALIBRATION (from session context):
- Early session (turns 1-2): broader questions, more options, help set direction
- Mid session (turns 3-8): focused questions, specific to what just happened
- Deep session (9+): minimal questions, only when genuinely ambiguous
- If the user gives short answers or says "just do it": skip or 1 question max

GROUNDING (critical \u2014 no generic options ever):
- Every option MUST name a specific artifact: file path, function, test suite, error message
- "src/auth/login.ts" not "the auth module". "3 failing vitest specs" not "the tests"
- If UnresolvedQuestions exist \u2014 turn them into options verbatim
- If a skill from the ecosystem matches the current work \u2014 include it as an option
- If multiple projects listed \u2014 include cross-project option when relevant
- BANNED: "Continue working", "Fix issues", "Improve code", "Look into it"

OPTION QUALITY:
- Start with action verb: Fix, Add, Run, Refactor, Deploy, Use, Test, Ship
- Include specific target: the file, the function, the test, the endpoint
- 3-5 options per question (cognitive load sweet spot from NN/g research)
- First option = most likely next step
- description: file path, error count, why this matters \u2014 max 60 chars
- ${ctx.maxQuestions} questions max, ${ctx.maxOptions} options max per question, type always "multi"`;
}
