/**
 * Interview prompt template.
 *
 * No archetypes, no situation matching, no template logic.
 * Give the model the full context and let it reason about what to ask.
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
    return `You generate interview questions to help a developer decide what to tell their coding agent next. The user sees multi-select checkboxes and can add freeform notes.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "string",
      "text": "Question under 80 chars",
      "type": "multi",
      "options": [
        { "label": "Action under 60 chars", "description": "brief context" }
      ]
    }
  ],
  "skipped": false
}

Return { "questions": [], "skipped": true, "skipReason": "..." } when the next step is obvious.

${ctx.projectContext ? `Project:\n${ctx.projectContext}\n` : ""}${ctx.agentContext ? `Ecosystem:\n${ctx.agentContext}\n` : ""}${ctx.trajectory && ctx.trajectory.length > 0 ? `Session trajectory:\n${ctx.trajectory.map((t) => `- ${t}`).join("\n")}\n` : ""}${ctx.sessionFiles && ctx.sessionFiles.length > 0 ? `All files touched this session:\n${ctx.sessionFiles.map((f) => `- ${f}`).join("\n")}\n` : ""}
Turn: ${ctx.turnStatus}${ctx.abortContextNote ? ` (${ctx.abortContextNote})` : ""}

Recent user messages:
${ctx.recentUserPrompts.length > 0 ? ctx.recentUserPrompts.map((p) => `- ${p}`).join("\n") : "(none)"}

Tools used this turn:
${ctx.toolSignals.length > 0 ? ctx.toolSignals.map((s) => `- ${s}`).join("\n") : "(none)"}

Files changed this turn:
${ctx.touchedFiles.length > 0 ? ctx.touchedFiles.map((f) => `- ${f}`).join("\n") : "(none)"}

Questions the agent asked:
${ctx.unresolvedQuestions.length > 0 ? ctx.unresolvedQuestions.map((q) => `- ${q}`).join("\n") : "(none)"}

Agent's message:
${ctx.assistantText || "(empty)"}
${ctx.customInstruction.trim() ? `\nUser preference: ${ctx.customInstruction.trim()}` : ""}

Rules:
- Every option must name a specific file, function, test, or error from the context above
- BANNED options: "Continue working", "Fix issues", "Improve code", "Look into it", or anything generic
- ${ctx.maxQuestions} questions max, ${ctx.maxOptions} options max per question, type always "multi"`;
}
//# sourceMappingURL=interview-template.js.map