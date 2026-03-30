/**
 * Interview UI — multi-select + notes, controller-ergonomic.
 *
 * Key design for DualSense compatibility:
 *   D-pad up/down → arrow keys → navigate options (works via karabiner rule 04)
 *   Cross/X (button1) → Enter → confirm selection
 *   Circle (button2) → Escape → dismiss (but we require DOUBLE escape to cancel,
 *     so a single triangle press in nvim terminal mode doesn't accidentally dismiss)
 *   Space → toggle checkbox
 *   'n' → notes mode (safe — not mapped to any face button)
 *   Number keys → quick-toggle
 *   Tab → next question (L1/R1 in some configs)
 *
 * No coupling to any specific controller config — just robust key handling
 * that doesn't break under common terminal escape sequences.
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizQuestion, QuizSubmission, QuizConfig } from "../core/types.js";
export declare function showInterviewUI(ctx: ExtensionContext, questions: QuizQuestion[], config: QuizConfig): Promise<QuizSubmission>;
//# sourceMappingURL=interview-ui.d.ts.map