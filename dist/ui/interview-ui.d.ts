/**
 * Interview UI — multi-select + notes.
 *
 * Selection mode:
 *   j/k or ↑↓         → navigate options
 *   Enter/Space        → toggle checkbox
 *   Tab                → confirm & advance
 *   i or Esc           → enter notes mode
 *   h/l or ←→          → switch question
 *   q                  → dismiss
 *   1-9                → quick-toggle option
 *
 * Notes mode (full text editing via pi-tui Input):
 *   ←→                 → move cursor
 *   Ctrl+A / Home      → start of line
 *   Ctrl+E / End       → end of line
 *   Alt+B / Alt+F      → word backward/forward
 *   Ctrl+K             → kill to end of line
 *   Ctrl+U             → kill to start of line
 *   Ctrl+W / Alt+Bksp  → delete word backward
 *   Ctrl+Y             → yank (paste from kill ring)
 *   Ctrl+Z             → undo
 *   Enter or Esc       → save note and return to selection
 */
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { QuizQuestion, QuizSubmission, QuizConfig } from "../core/types.js";
export declare function showInterviewUI(ctx: ExtensionContext, questions: QuizQuestion[], config: QuizConfig): Promise<QuizSubmission>;
//# sourceMappingURL=interview-ui.d.ts.map