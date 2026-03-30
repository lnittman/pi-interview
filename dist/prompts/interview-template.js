/**
 * Interview prompt template.
 *
 * Informed by:
 * - Ask-deep SKILL.md: OARS technique, question archetypes, depth calibration
 * - Saya: signal calibration (directive types), intimacy/channel tier scaling
 * - Agents CLI: HIL workflow patterns (structured questions → typed answers)
 * - Ask-user extension: multi-select + notes UX (the UI contract)
 */
import { formatProjectContext } from "../core/project-context.js";
import { formatAgentContext } from "../core/agent-context.js";
function truncate(value, maxChars) {
    if (value.length <= maxChars)
        return value;
    return value.slice(0, maxChars) + "\u2026";
}
export function buildQuizPromptContext(turn, config, project, agent) {
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
        trajectory: turn.trajectory,
        sessionFiles: turn.sessionFiles,
        maxQuestions: config.maxQuestions,
        maxOptions: config.maxOptions,
        customInstruction: config.customInstruction,
    };
}
export function renderQuizPrompt(ctx) {
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
${ctx.trajectory && ctx.trajectory.length > 0 ? `SessionTrajectory (what happened earlier):
${ctx.trajectory.map((t) => `- ${t}`).join("\n")}
` : ""}${ctx.sessionFiles && ctx.sessionFiles.length > 0 ? `AllSessionFiles (touched across all turns):
${ctx.sessionFiles.map((f) => `- ${f}`).join("\n")}
` : ""}
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


── Question Design ──

ARCHETYPE — match the situation:

IF TurnStatus=success AND no UnresolvedQuestions AND trajectory shows steady progress:
  → Direction archetype: "What next?" with concrete follow-up actions from the session arc
  → Or SKIP if the assistant proposed a clear next step

IF TurnStatus=success AND UnresolvedQuestions exist:
  → Clarification archetype: turn each unresolved question into structured options
  → This is the highest-value case — the agent asked, help the user answer

IF TurnStatus=error:
  → Recovery archetype: offer specific fix strategies based on the error signals
  → Include "Show me the error details" as an option if context is ambiguous

IF TurnStatus=aborted:
  → Redirect archetype: offer to resume, restart with changes, or pivot entirely
  → Reference what was in-progress from trajectory

IF session is early (1-2 turns) AND trajectory is short:
  → Scope archetype: help define what to build, reference project ecosystem
  → Include skill suggestions if a domain skill matches

IF multiple files touched across session AND task seems complete:
  → Ship archetype: test, lint, commit, deploy options with specific file counts

SKIP (return skipped=true) WHEN:
- Assistant proposed a clear action and user likely just needs to say "yes"
- Last exchange was simple Q&A with no branching paths
- User's recent messages are short directives ("do it", "go ahead", "yes")
- Session depth > 15 turns unless genuinely ambiguous

GROUNDING (critical):
- Every option MUST name a specific artifact: file path, function, test, error
- Reference trajectory: "Resume the auth refactor from earlier" not "Continue"
- Reference session files: "Run tests for src/auth/jwt.ts" not "Run tests"
- If a skill matches — include "Use [skill-name]" as an option
- BANNED: "Continue working", "Fix issues", "Improve code", "Look into it"

OPTION QUALITY:
- Action verb first: Fix, Add, Run, Refactor, Deploy, Use, Test, Ship, Resume
- Specific target: the file, function, test suite, endpoint, branch
- 3-5 options per question
- First option = most natural next step
- description: why this matters, what it unblocks, file path — max 60 chars
- ${ctx.maxQuestions} questions max, ${ctx.maxOptions} options max, type always "multi"`;
}
//# sourceMappingURL=interview-template.js.map