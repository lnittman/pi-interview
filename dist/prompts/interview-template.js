/**
 * Interview prompt template.
 *
 * Informed by:
 * - Saya's signal calibration (directive types: inform/clarify/help)
 * - Ask-deep's question archetypes (clarification/preference/scope/edge-case)
 * - Agents CLI's HIL workflow patterns (structured questions with typed answers)
 * - Ask-user extension's multi-select + notes UX
 */
import { formatProjectContext } from "../core/project-context.js";
import { formatAgentContext } from "../core/agent-context.js";
function truncate(value, maxChars) {
    if (value.length <= maxChars)
        return value;
    return value.slice(0, maxChars) + "…";
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
        maxQuestions: config.maxQuestions,
        maxOptions: config.maxOptions,
        customInstruction: config.customInstruction,
    };
}
export function renderQuizPrompt(ctx) {
    return `You generate interview questions to help a developer decide what to instruct their coding agent next. The user sees these as multi-select checkboxes — they can pick one or several options, and add freeform notes.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "string",
      "text": "Short question (under 80 chars)",
      "type": "multi",
      "options": [
        { "label": "Concrete action (under 60 chars)", "description": "brief context" }
      ]
    }
  ],
  "skipped": false
}

Skip (return { "questions": [], "skipped": true, "skipReason": "..." }) when:
- Agent proposed a clear next step and user just needs to affirm
- Last exchange was a simple Q&A
- Conversation is wrapping up

── Context ──
${ctx.projectContext ? `\nProject:\n${ctx.projectContext}\n` : ""}${ctx.agentContext ? `\nAgent Ecosystem:\n${ctx.agentContext}\n` : ""}
TurnStatus: ${ctx.turnStatus}
${ctx.abortContextNote ? `\nAbortContext:\n${ctx.abortContextNote}` : ""}

RecentUserMessages:
${ctx.recentUserPrompts.length > 0 ? ctx.recentUserPrompts.map((p) => `- ${p}`).join("\n") : "(none)"}

ToolSignals:
${ctx.toolSignals.length > 0 ? ctx.toolSignals.map((s) => `- ${s}`).join("\n") : "(none)"}

TouchedFiles:
${ctx.touchedFiles.length > 0 ? ctx.touchedFiles.map((f) => `- ${f}`).join("\n") : "(none)"}

UnresolvedQuestions (from assistant):
${ctx.unresolvedQuestions.length > 0 ? ctx.unresolvedQuestions.map((q) => `- ${q}`).join("\n") : "(none)"}

LatestAssistantMessage:
\`\`\`
${ctx.assistantText || "(empty)"}
\`\`\`
${ctx.customInstruction.trim() ? `\nUserPreference:\n${ctx.customInstruction.trim()}` : ""}

── Question Design ──

QUESTION ARCHETYPES (pick the best fit for the situation):
- Direction: "What should we focus on next?" — when a task completed and multiple paths exist
- Scope: "What's in scope for this change?" — when the task is broad or expanding
- Recovery: "How should we handle the failures?" — when errors occurred
- Trade-off: "Which approach do you prefer?" — when there are valid alternatives
- Delegation: "Should we use a skill for this?" — when a skill/agent matches the work
- Validation: "Does this look right?" — when confirming before a destructive/irreversible step

GROUNDING (critical):
- Every option MUST reference specific artifacts from the context above
- Name actual files, not abstractions: "src/auth/login.ts" not "the auth module"
- Name actual errors: "the 3 failing vitest specs" not "fix the tests"
- If UnresolvedQuestions exist, turn them into options verbatim
- If the Agent Ecosystem lists relevant skills, include "Use [skill-name] for this" as an option
- If multiple projects are listed, include cross-project options when relevant
- NEVER generate generic options: "Continue working", "Fix issues", "Improve code"

STRUCTURE:
- Generate 1-${ctx.maxQuestions} questions, each with 2-${ctx.maxOptions} options
- type is ALWAYS "multi" — user checks one or several
- First option = most natural next step
- description field: file paths, error counts, token costs, or why this option matters
- The user can add freeform notes via the UI — don't generate text-only questions

OPTION QUALITY:
- Start with an action verb: "Fix", "Add", "Run", "Refactor", "Deploy", "Use"
- Include the specific target: file, function, test suite, endpoint
- Be direct — these are developer instructions, not marketing copy
- 3-5 options per question is the sweet spot — enough choice, not overwhelming`;
}
//# sourceMappingURL=interview-template.js.map