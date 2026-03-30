/**
 * Settings UI for pi-interview.
 *
 * Lightweight config menu — model, thinking, mode, maxQuestions.
 * Independent of the chat session model.
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizConfig } from "../core/types.js";
interface SettingsResult {
    config: Partial<QuizConfig>;
    cancelled: boolean;
}
export declare function showSettingsUI(ctx: ExtensionContext, config: QuizConfig, availableModels: string[]): Promise<SettingsResult>;
export {};
//# sourceMappingURL=settings-ui.d.ts.map