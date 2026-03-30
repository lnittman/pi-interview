/**
 * Interview prompt template.
 *
 * No archetypes, no situation matching, no template logic.
 * Give the model the full context and let it reason about what to ask.
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
    trajectory?: string[];
    sessionFiles?: string[];
    maxQuestions: number;
    maxOptions: number;
    customInstruction: string;
}
export declare function buildQuizPromptContext(turn: TurnContext, config: QuizConfig, project?: ProjectSnapshot, agent?: AgentContext | null): QuizPromptContext;
export declare function renderQuizPrompt(ctx: QuizPromptContext): string;
//# sourceMappingURL=interview-template.d.ts.map