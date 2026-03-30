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
            // Next unanswered
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
                    noteMode = false;
                    refresh();
                    return;
                }
                if (matchesKey(data, Key.backspace)) {
                    noteText = noteText.slice(0, -1);
                    refresh();
                    return;
                }
                if (data.length >= 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
                    noteText += data;
                    refresh();
                    return;
                }
                return;
            }
            // ── Dismiss: q only ──
            // Escape is a no-op — terminal escape sequences cause accidental
            // dismissals. Only 'q' reliably dismisses across all input methods.
            if (data === "q") {
                finish(true);
                return;
            }
            if (matchesKey(data, Key.escape)) {
                return; // swallow
            }
            // ── Notes mode: 'i' (vim insert) or ≤ (Option+,) ──
            if (data === "i" || data === "\u2264") {
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
                    const active = idx === currentQ;
                    const dot = has ? "\u25cf" : "\u25cb";
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
                const display = noteText || theme.fg("dim", "type a note...");
                add(`  note: ${display}_`);
                add(theme.fg("dim", "  Enter save . Esc cancel"));
            }
            else if (existingNote) {
                add(`  ${theme.fg("dim", "note: " + existingNote)}`);
            }
            // Hints
            blank();
            if (!noteMode) {
                const h = ["j/k nav", "Enter toggle", "Tab confirm", "i note"];
                if (questions.length > 1)
                    h.push("h/l switch");
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
//# sourceMappingURL=interview-ui.js.map