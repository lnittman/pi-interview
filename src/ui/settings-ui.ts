/**
 * Settings UI for pi-interview.
 *
 * Lightweight config menu — model, thinking, mode, maxQuestions.
 * Independent of the chat session model.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type { QuizConfig } from "../core/types.js";

interface SettingsResult {
  config: Partial<QuizConfig>;
  cancelled: boolean;
}

interface SettingRow {
  key: keyof QuizConfig;
  label: string;
  options: string[];
  current: string;
}

export async function showSettingsUI(
  ctx: ExtensionContext,
  config: QuizConfig,
  availableModels: string[]
): Promise<SettingsResult> {
  if (!ctx.hasUI) return { config: {}, cancelled: true };

  // Build model options — put current first
  const modelOpts = [config.model, ...availableModels.filter((m) => m !== config.model)].slice(0, 8);

  const rows: SettingRow[] = [
    {
      key: "model",
      label: "Model",
      options: modelOpts,
      current: config.model,
    },
    {
      key: "thinkingLevel",
      label: "Thinking",
      options: ["off", "minimal", "low"],
      current: config.thinkingLevel,
    },
    {
      key: "mode",
      label: "Trigger",
      options: ["auto", "manual"],
      current: config.mode,
    },
    {
      key: "maxQuestions",
      label: "Max questions",
      options: ["1", "2", "3", "4", "5"],
      current: String(config.maxQuestions),
    },
    {
      key: "maxOptions",
      label: "Max options",
      options: ["3", "4", "5", "6", "7", "8"],
      current: String(config.maxOptions),
    },
    {
      key: "skipOnSimpleResponse",
      label: "Skip simple",
      options: ["true", "false"],
      current: String(config.skipOnSimpleResponse),
    },
  ];

  return ctx.ui.custom<SettingsResult>((tui, theme, _kb, done) => {
    let rowIdx = 0;
    let optIdx = rows.map((r) => r.options.indexOf(r.current)).map((i) => Math.max(0, i));
    let cachedLines: string[] | undefined;
    const changes = new Map<string, string>();

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function handleInput(data: string): void {
      // Navigate rows
      if (matchesKey(data, Key.up) || data === "k") {
        rowIdx = Math.max(0, rowIdx - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down) || data === "j") {
        rowIdx = Math.min(rows.length - 1, rowIdx + 1);
        refresh();
        return;
      }

      // Navigate options within row
      if (matchesKey(data, Key.left) || data === "h") {
        optIdx[rowIdx] = Math.max(0, optIdx[rowIdx] - 1);
        changes.set(rows[rowIdx].key, rows[rowIdx].options[optIdx[rowIdx]]);
        refresh();
        return;
      }
      if (matchesKey(data, Key.right) || data === "l") {
        optIdx[rowIdx] = Math.min(rows[rowIdx].options.length - 1, optIdx[rowIdx] + 1);
        changes.set(rows[rowIdx].key, rows[rowIdx].options[optIdx[rowIdx]]);
        refresh();
        return;
      }

      // Space/Enter also cycles right
      if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
        optIdx[rowIdx] = (optIdx[rowIdx] + 1) % rows[rowIdx].options.length;
        changes.set(rows[rowIdx].key, rows[rowIdx].options[optIdx[rowIdx]]);
        refresh();
        return;
      }

      // Escape: save and close
      if (matchesKey(data, Key.escape)) {
        const result: Partial<QuizConfig> = {};
        for (const [k, v] of changes) {
          if (k === "model") (result as any).model = v;
          else if (k === "thinkingLevel") (result as any).thinkingLevel = v;
          else if (k === "mode") (result as any).mode = v;
          else if (k === "maxQuestions") (result as any).maxQuestions = parseInt(v);
          else if (k === "maxOptions") (result as any).maxOptions = parseInt(v);
          else if (k === "skipOnSimpleResponse") (result as any).skipOnSimpleResponse = v === "true";
        }
        done({ config: result, cancelled: false });
        return;
      }

      // q: quit without saving
      if (data === "q") {
        done({ config: {}, cancelled: true });
        return;
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const w = Math.max(30, width);
      const add = (s: string) => lines.push(truncateToWidth(s, w));
      const blank = () => lines.push("");

      add(theme.fg("accent", "─".repeat(w)));
      add(` ${theme.fg("accent", theme.bold("interview settings"))}`);
      blank();

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const active = r === rowIdx;
        const pointer = active ? theme.fg("accent", " > ") : "   ";
        const label = active
          ? theme.fg("accent", row.label.padEnd(15))
          : theme.fg("text", row.label.padEnd(15));

        const optParts = row.options.map((opt, i) => {
          const selected = i === optIdx[r];
          const changed = changes.has(row.key) && opt === changes.get(row.key);
          if (selected && active) return theme.fg("accent", `[${opt}]`);
          if (selected) return theme.fg("success", `[${opt}]`);
          if (changed) return theme.fg("warning", opt);
          return theme.fg("dim", opt);
        });

        add(`${pointer}${label} ${optParts.join("  ")}`);
      }

      blank();
      if (changes.size > 0) {
        add(`  ${theme.fg("success", `${changes.size} changed`)}`);
      }
      blank();
      add(theme.fg("dim", `  j/k rows . h/l/Space cycle . Esc save . q cancel`));
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
