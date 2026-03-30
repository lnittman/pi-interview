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