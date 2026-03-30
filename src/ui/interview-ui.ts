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
import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import type {
  QuizQuestion,
  QuizAnswer,
  QuizSubmission,
  QuizConfig,
} from "../core/types.js";
import { buildSubmission } from "../prompts/compose-template.js";

export async function showInterviewUI(
  ctx: ExtensionContext,
  questions: QuizQuestion[],
  config: QuizConfig
): Promise<QuizSubmission> {
  const startTime = Date.now();

  if (!ctx.hasUI || questions.length === 0) {
    return buildSubmission(questions, [], config.maxPromptChars, startTime, true);
  }

  return ctx.ui.custom<QuizSubmission>((tui, theme, _kb, done) => {
    let currentQ = 0;
    let optionCursor = 0;
    let noteMode = false;
    let noteText = "";
    let cachedLines: string[] | undefined;
    let pendingEscape = false;
    let escapeTimer: ReturnType<typeof setTimeout> | undefined;

    const selections = new Map<string, Set<number>>();
    const notes = new Map<string, string>();
    for (const q of questions) {
      selections.set(q.id, new Set());
    }

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function q(): QuizQuestion {
      return questions[currentQ];
    }

    function finish(cancelled: boolean) {
      if (escapeTimer) clearTimeout(escapeTimer);
      const allAnswers: QuizAnswer[] = questions.map((question) => {
        const sel = selections.get(question.id);
        const selectedLabels = sel && sel.size > 0
          ? [...sel].sort((a, b) => a - b).map((i) => question.options[i]?.label).filter(Boolean)
          : undefined;
        const note = notes.get(question.id);
        return {
          questionId: question.id,
          selectedOptions: selectedLabels,
          text: note,
          skipped: !selectedLabels?.length && !note,
        };
      });
      done(buildSubmission(questions, allAnswers, config.maxPromptChars, startTime, cancelled));
    }

    function advance() {
      if (questions.length === 1) {
        finish(false);
        return;
      }
      for (let i = currentQ + 1; i < questions.length; i++) {
        const sel = selections.get(questions[i].id);
        if (!sel || sel.size === 0) {
          currentQ = i;
          optionCursor = 0;
          refresh();
          return;
        }
      }
      for (let i = 0; i < currentQ; i++) {
        const sel = selections.get(questions[i].id);
        if (!sel || sel.size === 0) {
          currentQ = i;
          optionCursor = 0;
          refresh();
          return;
        }
      }
      finish(false);
    }

    function handleInput(data: string): void {
      // ── Note mode ──
      if (noteMode) {
        if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter)) {
          const trimmed = noteText.trim();
          if (trimmed) notes.set(q().id, trimmed);
          noteMode = false;
          pendingEscape = false;
          refresh();
          return;
        }
        if (matchesKey(data, Key.backspace)) {
          noteText = noteText.slice(0, -1);
          refresh();
          return;
        }
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          noteText += data;
          refresh();
          return;
        }
        return;
      }

      // ── Double-escape to dismiss ──
      // Single Escape is too easy to hit accidentally (e.g. DualSense triangle
      // in nvim terminal mode sends Esc+Esc). Require two Escapes within 400ms.
      if (matchesKey(data, Key.escape)) {
        if (pendingEscape) {
          if (escapeTimer) clearTimeout(escapeTimer);
          pendingEscape = false;
          finish(true);
          return;
        }
        pendingEscape = true;
        escapeTimer = setTimeout(() => { pendingEscape = false; }, 400);
        refresh();
        return;
      }
      // Any non-escape key clears the pending escape
      if (pendingEscape) {
        pendingEscape = false;
        if (escapeTimer) clearTimeout(escapeTimer);
      }

      // ── 'n' key: notes mode ──
      if (data === "n") {
        noteMode = true;
        noteText = notes.get(q().id) || "";
        refresh();
        return;
      }

      // ── Arrow / vim navigation ──
      if (matchesKey(data, Key.up) || data === "k") {
        optionCursor = Math.max(0, optionCursor - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down) || data === "j") {
        optionCursor = Math.min(q().options.length - 1, optionCursor + 1);
        refresh();
        return;
      }

      // ── Tab: next question ──
      if (matchesKey(data, Key.tab) || data === "l") {
        if (questions.length > 1) {
          currentQ = (currentQ + 1) % questions.length;
          optionCursor = 0;
          refresh();
        }
        return;
      }
      if (matchesKey(data, Key.shift("tab")) || data === "h") {
        if (questions.length > 1) {
          currentQ = (currentQ - 1 + questions.length) % questions.length;
          optionCursor = 0;
          refresh();
        }
        return;
      }

      // ── Space: toggle checkbox ──
      if (matchesKey(data, Key.space)) {
        const sel = selections.get(q().id)!;
        if (sel.has(optionCursor)) sel.delete(optionCursor);
        else sel.add(optionCursor);
        refresh();
        return;
      }

      // ── Enter: confirm and advance ──
      if (matchesKey(data, Key.enter)) {
        const sel = selections.get(q().id)!;
        if (sel.size === 0) sel.add(optionCursor);
        advance();
        return;
      }

      // ── Number keys: quick-toggle ──
      if (data.length === 1 && data >= "1" && data <= "9") {
        const num = parseInt(data, 10) - 1;
        if (num < q().options.length) {
          const sel = selections.get(q().id)!;
          if (sel.has(num)) sel.delete(num);
          else sel.add(num);
          refresh();
          return;
        }
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const w = Math.max(20, width);
      const question = q();
      const sel = selections.get(question.id)!;

      const add = (s: string) => lines.push(truncateToWidth(s, w));
      const blank = () => lines.push("");

      add(theme.fg("accent", "─".repeat(w)));

      // Progress dots
      if (questions.length > 1) {
        const dots = questions.map((qn, i) => {
          const has = (selections.get(qn.id)?.size ?? 0) > 0;
          const active = i === currentQ;
          const dot = has ? "●" : "○";
          return active ? theme.fg("accent", dot) : theme.fg(has ? "success" : "dim", dot);
        }).join(" ");
        add(` ${theme.fg("accent", "*")} ${dots}`);
      } else {
        add(` ${theme.fg("accent", "*")}`);
      }

      // Question
      const qLines = wrapTextWithAnsi(theme.bold(question.text), w - 2);
      for (const ql of qLines) add(` ${ql}`);
      blank();

      // Options
      const opts = question.options;
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        const isCursor = i === optionCursor;
        const isChecked = sel.has(i);

        const pointer = isCursor ? theme.fg("accent", " > ") : "   ";
        const box = isChecked ? theme.fg("success", "[x]") : theme.fg("muted", "[ ]");
        const num = theme.fg("dim", `${i + 1}`);
        const color = isCursor ? "accent" : isChecked ? "success" : "text";

        const optLines = wrapTextWithAnsi(opt.label, w - 12);
        for (let li = 0; li < optLines.length; li++) {
          if (li === 0) {
            add(`${pointer}${box} ${num} ${theme.fg(color, optLines[li])}`);
          } else {
            add(`          ${theme.fg(color, optLines[li])}`);
          }
        }
        if (opt.description) {
          const descLines = wrapTextWithAnsi(opt.description, w - 12);
          for (const dl of descLines) add(`          ${theme.fg("dim", dl)}`);
        }
      }

      // Selection summary
      if (sel.size > 0) {
        blank();
        add(`  ${theme.fg("success", `${sel.size} selected`)}`);
      }

      // Notes
      blank();
      const existingNote = notes.get(question.id);
      if (noteMode) {
        const display = noteText || theme.fg("dim", "add a note...");
        add(`  notes: ${display}_`);
        add(theme.fg("dim", "  Enter/Esc save"));
      } else if (existingNote) {
        add(`  ${theme.fg("dim", "note: " + existingNote)}`);
      }

      // Help + escape state
      blank();
      if (!noteMode) {
        const hints: string[] = [];
        hints.push("j/k nav");
        hints.push("Space toggle");
        hints.push("Enter confirm");
        hints.push("n note");
        if (questions.length > 1) hints.push("h/l question");
        hints.push(pendingEscape
          ? theme.fg("warning", "Esc again to dismiss")
          : "Esc Esc dismiss");
        add(theme.fg("dim", `  ${hints.join(" . ")}`));
      }

      add(theme.fg("accent", "─".repeat(w)));
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate() { cachedLines = undefined; },
      handleInput,
    };
  });
}
