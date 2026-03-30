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
      const allAnswers: QuizAnswer[] = questions.map((question) => {
        const sel = selections.get(question.id);
        const selectedLabels = sel && sel.size > 0
          ? [...sel].sort((a, b) => a - b).map((idx) => question.options[idx]?.label).filter(Boolean)
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
      // Next unanswered
      for (let i = currentQ + 1; i < questions.length; i++) {
        const sel = selections.get(questions[i].id);
        if (!sel || sel.size === 0) { currentQ = i; optionCursor = 0; refresh(); return; }
      }
      for (let i = 0; i < currentQ; i++) {
        const sel = selections.get(questions[i].id);
        if (!sel || sel.size === 0) { currentQ = i; optionCursor = 0; refresh(); return; }
      }
      finish(false);
    }

    function toggleCurrent() {
      const sel = selections.get(q().id)!;
      if (sel.has(optionCursor)) sel.delete(optionCursor);
      else sel.add(optionCursor);
      refresh();
    }

    function handleInput(data: string): void {
      // ── Note mode ──
      if (noteMode) {
        if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter)) {
          const trimmed = noteText.trim();
          if (trimmed) notes.set(q().id, trimmed);
          noteMode = false;
          refresh();
          return;
        }
        if (matchesKey(data, Key.backspace)) {
          noteText = noteText.slice(0, -1);
          refresh();
          return;
        }
        // Accept printable text including paste (multi-char) and Unicode.
        // Filter out control chars (0x00-0x1f) except we already handled
        // Enter/Esc/Backspace above. Tab in note mode inserts nothing.
        const printable = data.replace(/[\x00-\x1f]/g, "");
        if (printable.length > 0) {
          noteText += printable;
          refresh();
          return;
        }
        return;
      }

      // ── Dismiss: q only ──
      if (data === "q") {
        finish(true);
        return;
      }

      // ── Notes mode: i, Escape, or ≤ (Option+,) ──
      // Escape enters notes mode instead of dismissing. This makes
      // terminals that send Esc on certain keys (or double-Esc)
      // toggle in/out of notes naturally: first Esc enters, second saves.
      if (data === "i" || data === "\u2264" || matchesKey(data, Key.escape)) {
        noteMode = true;
        noteText = notes.get(q().id) || "";
        refresh();
        return;
      }

      // ── Navigate: j/k or ↑↓ ──
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

      // ── Toggle: Enter / Space / ≥ (Option+. / R1) ──
      if (matchesKey(data, Key.enter) || matchesKey(data, Key.space) || data === "\u2265") {
        toggleCurrent();
        return;
      }

      // ── Confirm & advance: Tab / R2 ──
      if (matchesKey(data, Key.tab)) {
        const sel = selections.get(q().id)!;
        if (sel.size === 0) sel.add(optionCursor);
        advance();
        return;
      }

      // ── Switch question: h/l or ←→ or Shift+Tab ──
      if (data === "l" || matchesKey(data, Key.right)) {
        if (questions.length > 1) {
          currentQ = (currentQ + 1) % questions.length;
          optionCursor = 0;
          refresh();
        }
        return;
      }
      if (data === "h" || matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) {
        if (questions.length > 1) {
          currentQ = (currentQ - 1 + questions.length) % questions.length;
          optionCursor = 0;
          refresh();
        }
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
        }
        return;
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

      add(theme.fg("accent", "\u2500".repeat(w)));

      // Progress
      if (questions.length > 1) {
        const dots = questions.map((qn, idx) => {
          const has = (selections.get(qn.id)?.size ?? 0) > 0;
          const active = idx === currentQ;
          const dot = has ? "\u25cf" : "\u25cb";
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
      for (let idx = 0; idx < opts.length; idx++) {
        const opt = opts[idx];
        const cursor = idx === optionCursor;
        const checked = sel.has(idx);
        const pointer = cursor ? theme.fg("accent", " > ") : "   ";
        const box = checked ? theme.fg("success", "[x]") : theme.fg("muted", "[ ]");
        const num = theme.fg("dim", `${idx + 1}`);
        const color = cursor ? "accent" : checked ? "success" : "text";
        const optLines = wrapTextWithAnsi(opt.label, w - 12);
        for (let li = 0; li < optLines.length; li++) {
          add(li === 0
            ? `${pointer}${box} ${num} ${theme.fg(color, optLines[li])}`
            : `          ${theme.fg(color, optLines[li])}`);
        }
        if (opt.description) {
          for (const dl of wrapTextWithAnsi(opt.description, w - 12)) {
            add(`          ${theme.fg("dim", dl)}`);
          }
        }
      }

      // Selection count
      if (sel.size > 0) {
        blank();
        add(`  ${theme.fg("success", `${sel.size} selected`)}`);
      }

      // Notes
      blank();
      const existingNote = notes.get(question.id);
      if (noteMode) {
        const prefix = "  note: ";
        const cursor = "_";
        const text = noteText || theme.fg("dim", "type a note...");
        // Wrap note text to fit terminal width
        const maxNoteW = w - prefix.length - 1;
        if (maxNoteW > 10) {
          const noteLines = wrapTextWithAnsi(text + cursor, maxNoteW);
          for (let nl = 0; nl < noteLines.length; nl++) {
            add(nl === 0 ? `${prefix}${noteLines[nl]}` : `  ${" ".repeat(prefix.length - 2)}${noteLines[nl]}`);
          }
        } else {
          add(`${prefix}${text}${cursor}`);
        }
        add(theme.fg("dim", "  Enter save . Esc save"));
      } else if (existingNote) {
        // Wrap existing note too
        const noteLines = wrapTextWithAnsi(existingNote, w - 8);
        for (let nl = 0; nl < noteLines.length; nl++) {
          add(nl === 0
            ? `  ${theme.fg("dim", "note: " + noteLines[nl])}`
            : `        ${theme.fg("dim", noteLines[nl])}`);
        }
      }

      // Hints
      blank();
      if (!noteMode) {
        const h: string[] = ["j/k nav", "Enter toggle", "Tab confirm", "i/Esc note"];
        if (questions.length > 1) h.push("h/l switch");
        h.push("q quit");
        add(theme.fg("dim", `  ${h.join(" . ")}`));
      }

      add(theme.fg("accent", "\u2500".repeat(w)));
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
