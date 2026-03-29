/**
 * Quiz UI — always multiple choice.
 *
 * Every question shows numbered options + "Type something else..." at the bottom.
 * Uses pi-tui's matchesKey/Key for cross-terminal key handling.
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizQuestion, QuizSubmission, QuizConfig } from "../core/types.js";
export declare function showQuizUI(ctx: ExtensionContext, questions: QuizQuestion[], config: QuizConfig): Promise<QuizSubmission>;
//# sourceMappingURL=interview-ui.d.ts.map