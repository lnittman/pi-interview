/**
 * Interview UI — multi-select + notes.
 *
 * Key mappings:
 *   j/k or ↑↓         → navigate options
 *   Enter/Space       → toggle checkbox
 *   ≤ (Option+,)      → toggle checkbox (alt)
 *   Tab               → confirm & advance
 *   i or Esc          → notes mode (Esc enters notes, second Esc saves)
 *   ≤ (Option+,)      → notes mode (alt)
 *   ≥ (Option+.)      → toggle checkbox (alt)
 *   h/l or ←→         → switch question
 *   q                 → dismiss
 *   1-9               → quick-toggle option
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizQuestion, QuizSubmission, QuizConfig } from "../core/types.js";
export declare function showInterviewUI(ctx: ExtensionContext, questions: QuizQuestion[], config: QuizConfig): Promise<QuizSubmission>;
//# sourceMappingURL=interview-ui.d.ts.map