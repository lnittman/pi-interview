/**
 * Interview UI — multi-select + notes.
 *
 * Key mappings:
 *   j/k or ↑↓         → navigate options
 *   Enter/Space        → toggle checkbox
 *   ≤ (Option+,)       → toggle checkbox (alt)
 *   Tab                → confirm & advance
 *   i or Esc           → notes mode (Esc enters notes, second Esc saves)
 *   ≥ (Option+.)       → notes mode (alt)
 *   h/l or ←→          → switch question
 *   q                  → dismiss
 *   1-9                → quick-toggle option
 */
import { Key, matchesKey, truncateToWidth, wrapTextWithAnsi, } from "@mariozechner/pi-tui";
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
        let noteText = "";
        let cachedLines;
        const selections = new Map();
        const notes = new Map();
        for (const q of questions) {
            selections.set(q.id, new Set());
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
            // ── Note mode ──
            if (noteMode) {
                if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter)) {
                    const trimmed = noteText.trim();
                    if (trimmed)
                        notes.set(q().id, trimmed);
                    else
                        notes.delete(q().id);
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
                // Strip control chars and bracketed paste markers.
                const printable = data
                    .replace(/\x1b\[20[01]~/g, "")
                    .replace(/\[20[01]~/g, "")
                    .replace(/[\x00-\x1f\x7f]/g, "");
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
            // ── Notes mode: i, Escape, ≤ (Option+,), ≥ (Option+.) ──
            if (data === "i" || data === "\u2264" || data === "\u2265" || matchesKey(data, Key.escape)) {
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
            // ── Options ──
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
            // ── Selection summary ──
            if (sel.size > 0) {
                blank();
                add(`  ${theme.fg("success", `${sel.size} selected`)}`);
            }
            // ── Notes section ──
            blank();
            const existingNote = notes.get(question.id);
            if (noteMode) {
                // Active note input — bordered for clarity
                const innerW = w - 6;
                add(`  ${theme.fg("accent", "\u250c" + "\u2500".repeat(Math.max(1, innerW)) + "\u2510")}`);
                const text = noteText;
                const placeholder = theme.fg("dim", "type a note...");
                if (text.length === 0) {
                    // Show placeholder with cursor
                    add(`  ${theme.fg("accent", "\u2502")} ${placeholder}${theme.fg("accent", "\u2588")}${" ".repeat(Math.max(0, innerW - 17))}${theme.fg("accent", "\u2502")}`);
                }
                else {
                    // Wrap note text inside the box
                    const noteLines = wrapTextWithAnsi(text, innerW - 2);
                    for (let nl = 0; nl < noteLines.length; nl++) {
                        const isLast = nl === noteLines.length - 1;
                        const cursor = isLast ? theme.fg("accent", "\u2588") : "";
                        add(`  ${theme.fg("accent", "\u2502")} ${noteLines[nl]}${cursor} ${theme.fg("accent", "\u2502")}`);
                    }
                }
                add(`  ${theme.fg("accent", "\u2514" + "\u2500".repeat(Math.max(1, innerW)) + "\u2518")}`);
                add(theme.fg("dim", `  Enter save . Esc save . Backspace delete`));
            }
            else if (existingNote) {
                // Saved note — subtle display
                add(`  ${theme.fg("dim", "\u250a")} ${theme.fg("muted", existingNote)}`);
            }
            else {
                // No note yet — hint
                add(theme.fg("dim", `  i/Esc to add a note`));
            }
            // ── Hints ──
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