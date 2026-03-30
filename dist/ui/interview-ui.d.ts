/**
 * Interview UI — multi-select + notes.
 *
 * Key mappings:
 *   j/k or ↑↓         → navigate options
 *   Enter/Space       → toggle checkbox
 *   ≤ (Option+,)      → toggle checkbox (alt)
 *   Tab               → confirm & advance
 *   i                 → notes mode (vim insert)
 *   ≥ (Option+.)      → notes mode (alt)
 *   h/l or ←→         → switch question
 *   q                 → dismiss
 *   1-9               → quick-toggle option
 *
 * Escape is intentionally a no-op to prevent accidental dismiss
 * from terminal escape sequences and mode-switching keybinds.
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizQuestion, QuizSubmission, QuizConfig } from "../core/types.js";
export declare function showInterviewUI(ctx: ExtensionContext, questions: QuizQuestion[], config: QuizConfig): Promise<QuizSubmission>;
//# sourceMappingURL=interview-ui.d.ts.map