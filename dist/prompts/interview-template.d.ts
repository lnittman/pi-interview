/**
 * Interview prompt template.
 *
 * Informed by:
 * - Saya's signal calibration (directive types: inform/clarify/help)
 * - Ask-deep's question archetypes (clarification/preference/scope/edge-case)
 * - Agents CLI's HIL workflow patterns (structured questions with typed answers)
 * - Ask-user extension's multi-select + notes UX
 */
import type { TurnContext, QuizConfig } from "../core/types.js";
import type { ProjectSnapshot } from "../core/project-context.js";
import type { AgentContext } from "../core/agent-context.js";
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
export declare function buildQuizPromptContext(turn: TurnContext, config: QuizConfig, project?: ProjectSnapshot, agent?: AgentContext | null): QuizPromptContext;
export declare function renderQuizPrompt(ctx: QuizPromptContext): string;
//# sourceMappingURL=interview-template.d.ts.map