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
import { Input, Key, matchesKey, truncateToWidth, wrapTextWithAnsi, } from "@mariozechner/pi-tui";
import { buildSubmission } from "../prompts/compose-template.js";
export async function showInterviewUI(ctx, questions, config) {
    const startTime = Date.now();
    if (!ctx.hasUI || questions.length === 0) {
        return buildSubmission(questions, [], config.maxPromptChars, startTime, true);
    }
    return ctx.ui.custom((tui, theme, _kb, done) => {
        let currentQ = 0;
        let optionCursor = 0;
        let noteMode = false;
        let cachedLines;
        const selections = new Map();
        const notes = new Map();
        for (const q of questions) {
            selections.set(q.id, new Set());
        }
        // Use pi-tui's Input component for full text editing in notes mode
        const noteInput = new Input();
        noteInput.onSubmit = () => {
            saveNote();
        };
        noteInput.onEscape = () => {
            saveNote();
        };
        function saveNote() {
            const val = noteInput.getValue().trim();
            if (val)
                notes.set(q().id, val);
            else
                notes.delete(q().id);
            noteMode = false;
            refresh();
        }
        function refresh() {
            cachedLines = undefined;
            tui.requestRender();
        }
        function q() {
            return questions[currentQ];
        }
        function finish(cancelled) {
            const allAnswers = questions.map((question) => {
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
        function toggleCurrent() {
            const sel = selections.get(q().id);
            if (sel.has(optionCursor))
                sel.delete(optionCursor);
            else
                sel.add(optionCursor);
            refresh();
        }
        function handleInput(data) {
            // ── Notes mode: delegate to pi-tui Input ──
            if (noteMode) {
                noteInput.handleInput(data);
                refresh();
                return;
            }
            // ── Dismiss: q only ──
            if (data === "q") {
                finish(true);
                return;
            }
            // ── Enter notes mode: i, Esc, ≤, ≥ ──
            if (data === "i" || data === "\u2264" || data === "\u2265" || matchesKey(data, Key.escape)) {
                noteMode = true;
                noteInput.setValue(notes.get(q().id) || "");
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
            // ── Toggle: Enter / Space ──
            if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
                toggleCurrent();
                return;
            }
            // ── Confirm & advance: Tab ──
            if (matchesKey(data, Key.tab)) {
                const sel = selections.get(q().id);
                if (sel.size === 0)
                    sel.add(optionCursor);
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
                    const sel = selections.get(q().id);
                    if (sel.has(num))
                        sel.delete(num);
                    else
                        sel.add(num);
                    refresh();
                }
                return;
            }
        }
        function render(width) {
            if (cachedLines)
                return cachedLines;
            const lines = [];
            const w = Math.max(20, width);
            const question = q();
            const sel = selections.get(question.id);
            const add = (s) => lines.push(truncateToWidth(s, w));
            const blank = () => lines.push("");
            add(theme.fg("accent", "\u2500".repeat(w)));
            // Progress
            if (questions.length > 1) {
                const dots = questions.map((qn, idx) => {
                    const has = (selections.get(qn.id)?.size ?? 0) > 0;
                    const hasNote = notes.has(qn.id);
                    const active = idx === currentQ;
                    let dot = has ? "\u25cf" : "\u25cb";
                    if (hasNote)
                        dot += "+";
                    return active ? theme.fg("accent", dot) : theme.fg(has ? "success" : "dim", dot);
                }).join(" ");
                add(` ${theme.fg("accent", "*")} ${dots}`);
            }
            else {
                add(` ${theme.fg("accent", "*")}`);
            }
            // Question
            const qLines = wrapTextWithAnsi(theme.bold(question.text), w - 2);
            for (const ql of qLines)
                add(` ${ql}`);
            blank();
            // Options
            const opts = question.options;
            for (let idx = 0; idx < opts.length; idx++) {
                const opt = opts[idx];
                const isCursor = idx === optionCursor;
                const checked = sel.has(idx);
                const pointer = isCursor ? theme.fg("accent", " > ") : "   ";
                const box = checked ? theme.fg("success", "[x]") : theme.fg("muted", "[ ]");
                const num = theme.fg("dim", `${idx + 1}`);
                const color = isCursor ? "accent" : checked ? "success" : "text";
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
            // Selection summary
            if (sel.size > 0) {
                blank();
                add(`  ${theme.fg("success", `${sel.size} selected`)}`);
            }
            // Notes section
            blank();
            const existingNote = notes.get(question.id);
            if (noteMode) {
                // Render pi-tui Input component on filled background
                const inputLines = noteInput.render(w - 4);
                for (const il of inputLines) {
                    add(`  ${theme.bg("selectedBg", ` ${il}${" ".repeat(Math.max(0, w - 6))} `)}`);
                }
                add(theme.fg("dim", `  Enter save . Esc save . arrows/ctrl+a/e move`));
            }
            else if (existingNote) {
                const noteLines = wrapTextWithAnsi(existingNote, w - 4);
                for (const nl of noteLines) {
                    add(`  ${theme.fg("muted", nl)}`);
                }
            }
            else {
                add(theme.fg("dim", `  i to add a note`));
            }
            // Hints
            blank();
            if (!noteMode) {
                const h = [];
                h.push(theme.fg("dim", "j/k"));
                h.push(theme.fg("dim", "Enter toggle"));
                h.push(theme.fg("dim", "Tab confirm"));
                h.push(theme.fg("dim", "i note"));
                if (questions.length > 1)
                    h.push(theme.fg("dim", "h/l switch"));
                h.push(theme.fg("dim", "q quit"));
                add(`  ${h.join(theme.fg("dim", " \u00b7 "))}`);
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
//# sourceMappingURL=interview-ui.js.map