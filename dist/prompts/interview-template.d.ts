/**
 * Quiz prompt template.
 *
 * Every question MUST be multiple choice.
 * No "text" type questions — the UI handles freeform via "Type something else..." option.
 */
import type { TurnContext, QuizConfig } from "../core/types.js";
import type { ProjectSnapshot } from "../core/project-context.js";
export interface QuizPromptContext {
    assistantText: string;
    turnStatus: TurnContext["status"];
    recentUserPrompts: string[];
    toolSignals: string[];
    touchedFiles: string[];
    unresolvedQuestions: string[];
    abortContextNote?: string;
    projectContext?: string;
    maxQuestions: number;
    maxOptions: number;
    customInstruction: string;
}
export declare function buildQuizPromptContext(turn: TurnContext, config: QuizConfig, project?: ProjectSnapshot): QuizPromptContext;
export declare function renderQuizPrompt(ctx: QuizPromptContext): string;
//# sourceMappingURL=interview-template.d.ts.map