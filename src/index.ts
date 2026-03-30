/**
 * pi-interview — Multiple-choice + notes interview for pi.
 *
 * Every question is multi-select with checkboxes. Grounded in specific files, errors, signals.
 * Ctrl+I to trigger. /interview for commands. Haiku by default.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { completeSimple } from "@mariozechner/pi-ai";
import { buildTurnContext, buildTurnContextFromBranch } from "./core/signals.js";
import { buildQuizPromptContext } from "./prompts/interview-template.js";
import { QuizModelClient } from "./adapters/model-client.js";
import { showInterviewUI } from "./ui/interview-ui.js";
import { showSettingsUI } from "./ui/settings-ui.js";
import {
  emptyState,
  recordQuizCall,
  shouldBackOff,
  formatUsageStatus,
  type QuizSessionState,
} from "./core/state.js";
import {
  buildProjectSnapshot,
  type ProjectSnapshot,
} from "./core/project-context.js";
import type { TurnContext, QuizConfig } from "./core/types.js";
import { DEFAULT_CONFIG } from "./core/types.js";
import { getDemoTurn, listDemoScenarios } from "./core/demo.js";
import {
  buildAgentContext,
  extractSessionDepth,
  type AgentContext,
} from "./core/agent-context.js";
import { extractTrajectory } from "./core/trajectory.js";

const CUSTOM_TYPE = "pi-interview-state";

export default function interview(pi: ExtensionAPI) {
  // Register custom renderer for interview answers
  pi.registerMessageRenderer("pi-interview-answer", (message, options, theme) => {
    const details = message.details as {
      answers?: { questionId: string; selectedOptions?: string[]; text?: string; skipped: boolean }[];
      durationMs?: number;
    } | undefined;
    const answers = (details?.answers ?? []).filter((a) => !a.skipped);
    const lines: string[] = [];

    if (answers.length === 0) {
      return new Text(theme.fg("dim", "(no selections)"), 0, 0);
    }

    // Compact: selections on one line, note below
    const selections: string[] = [];
    const noteLines: string[] = [];

    for (const a of answers) {
      if (a.selectedOptions?.length) {
        for (const opt of a.selectedOptions) {
          selections.push(opt);
        }
      }
      if (a.text) {
        noteLines.push(a.text);
      }
    }

    if (selections.length > 0) {
      lines.push(selections.map((s) => theme.fg("success", s)).join(theme.fg("dim", " + ")));
    }
    if (noteLines.length > 0) {
      lines.push(theme.fg("dim", noteLines.join(" ")));
    }

    return new Text(lines.join("\n"), 0, 0);
  });

  let config: QuizConfig = { ...DEFAULT_CONFIG };
  let ctx: ExtensionContext | undefined;
  let lastTurn: TurnContext | undefined;
  let ivActive = false;
  let epoch = 0;
  let state: QuizSessionState = emptyState();
  let projectSnapshot: ProjectSnapshot | undefined;
  let agentCtx: AgentContext | null = null;

  const modelClient = new QuizModelClient(
    { getContext: () => ctx },
    completeSimple
  );

  // ─── State Persistence ────────────────────────────────────────────────

  function persistState() {
    pi.appendEntry(CUSTOM_TYPE, { ...state });
  }

  function restoreState(entries: { type: string; customType?: string; data?: any }[]) {
    state = emptyState();
    for (const entry of entries) {
      if (entry.type === "custom" && entry.customType === CUSTOM_TYPE && entry.data) {
        if (entry.data.version === 1) {
          state = entry.data as QuizSessionState;
        }
      }
    }
  }

  function refreshUsageWidget() {
    if (!ctx?.hasUI) return;
    const status = formatUsageStatus(state);
    ctx.ui.setStatus("interview-usage", status);
  }

  // ─── Context Enrichment ────────────────────────────────────────────────

  async function ensureContexts() {
    const promises: Promise<void>[] = [];
    if (!projectSnapshot && ctx) {
      promises.push(
        buildProjectSnapshot(ctx.cwd)
          .then((s) => { projectSnapshot = s; })
          .catch(() => {})
      );
    }
    if (!agentCtx) {
      promises.push(
        buildAgentContext(ctx?.cwd)
          .then((a) => { agentCtx = a; })
          .catch(() => {})
      );
    }
    if (promises.length > 0) await Promise.all(promises);
  }

  // ─── Core Flow ────────────────────────────────────────────────────────

  async function runQuiz(
    turn: TurnContext,
    context: ExtensionContext,
    currentEpoch: number,
    manual: boolean = false
  ): Promise<void> {
    if (!context.hasUI || ivActive) return;
    if (currentEpoch !== epoch) return;

    // Don't re-interview the same turn
    if (!manual && state.lastQuizTurnId === turn.turnId) return;

    // Back-off after repeated skips/cancels (unless manual)
    if (!manual && shouldBackOff(state)) return;

    // Skip trivially short responses (unless manual)
    if (
      !manual &&
      config.skipOnSimpleResponse &&
      turn.assistantText.length < 100 &&
      turn.unresolvedQuestions.length === 0 &&
      turn.status === "success"
    ) {
      return;
    }

    ivActive = true;

    try {
      await ensureContexts();
      // Inject live session context
      if (context.sessionManager) {
        const entries = context.sessionManager.getEntries() as any[];
        if (agentCtx) {
          agentCtx.sessionDepth = extractSessionDepth(entries);
        }
        // Extract trajectory from full session branch
        const branch = context.sessionManager.getBranch() as any[];
        const { trajectory, sessionFiles } = extractTrajectory(branch);
        turn.trajectory = trajectory;
        turn.sessionFiles = sessionFiles;
      }
      const promptContext = buildQuizPromptContext(turn, config, projectSnapshot, agentCtx);

      context.ui.setWidget("interview-loading", [
        `  ${context.ui.theme.fg("dim", "✦ interview...")}`,
      ], { placement: "belowEditor" });

      const result = await modelClient.generateQuiz(promptContext, config);

      if (currentEpoch !== epoch) {
        context.ui.setWidget("interview-loading", undefined);
        return;
      }

      context.ui.setWidget("interview-loading", undefined);

      if (result.skipped || result.questions.length === 0) {
        state = recordQuizCall(state, result.usage, "skipped", turn.turnId);
        persistState();
        refreshUsageWidget();

        // Brief flash only on first few skips
        if (state.consecutiveSkips <= 2) {
          context.ui.setWidget("interview-loading", [
            `  ${context.ui.theme.fg("dim", `✦ —${result.skipReason ? ` ${result.skipReason}` : ""}`)}`,
          ], { placement: "belowEditor" });
          setTimeout(() => context.ui.setWidget("interview-loading", undefined), 1500);
        }
        return;
      }

      // Show usage inline
      if (result.usage) {
        const cost = result.usage.costTotal ? ` $${result.usage.costTotal.toFixed(4)}` : "";
        context.ui.setStatus("interview", `✦ ${result.usage.totalTokens} tok${cost}`);
      }

      const submission = await showInterviewUI(context, result.questions, config);

      context.ui.setStatus("interview", undefined);

      if (submission.cancelled) {
        state = recordQuizCall(state, result.usage, "cancelled", turn.turnId);
      } else {
        state = recordQuizCall(state, result.usage, "completed", turn.turnId);
        if (submission.composedPrompt) {
          // Small delay to let the custom component fully tear down
          await new Promise((r) => setTimeout(r, 50));
          // Send as a custom rendered message that triggers a turn
          // — NOT sendUserMessage which dumps raw text into the prompt bar
          pi.sendMessage({
            customType: "pi-interview-answer",
            content: submission.composedPrompt,
            display: true,
            details: {
              answers: submission.answers,
              durationMs: submission.durationMs,
            },
          }, { triggerTurn: true });
        }
      }

      persistState();
      refreshUsageWidget();
    } catch (error) {
      context.ui.setWidget("interview-loading", undefined);
      const msg = error instanceof Error ? error.message : String(error);
      context.ui.notify(`interview: ${msg.slice(0, 80)}`, "error");
    } finally {
      ivActive = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  function getTurnFromBranch(context: ExtensionContext): TurnContext | undefined {
    const branchEntries = context.sessionManager
      .getBranch()
      .filter((e): e is (typeof e) & { type: "message" } => e.type === "message");
    return buildTurnContextFromBranch(branchEntries as any[]) ?? undefined;
  }

  // ─── Events ───────────────────────────────────────────────────────────

  pi.on("session_start", async (_ev, c) => {
    ctx = c;
    epoch++;
    projectSnapshot = undefined; agentCtx = null;
    restoreState(c.sessionManager.getEntries() as any[]);
    refreshUsageWidget();
  });

  pi.on("session_switch", async (_ev, c) => {
    ctx = c;
    epoch++;
    ivActive = false;
    projectSnapshot = undefined; agentCtx = null;
    restoreState(c.sessionManager.getEntries() as any[]);
    refreshUsageWidget();
  });

  pi.on("session_fork", async (_ev, c) => {
    ctx = c;
    epoch++;
    ivActive = false;
    restoreState(c.sessionManager.getEntries() as any[]);
    refreshUsageWidget();
  });

  pi.on("agent_end", async (event, c) => {
    ctx = c;
    const e = ++epoch;

    if (config.mode !== "auto") return;

    const branchEntries = c.sessionManager.getBranch();
    const branchMessages = branchEntries
      .filter((entry): entry is (typeof branchEntries)[number] & { type: "message" } => entry.type === "message")
      .map((entry) => entry.message);
    const leafId = c.sessionManager.getLeafId() ?? `turn-${Date.now()}`;

    const turn = buildTurnContext({
      turnId: leafId,
      sourceLeafId: leafId,
      messagesFromPrompt: event.messages as any[],
      branchMessages: branchMessages as any[],
      occurredAt: new Date().toISOString(),
    });

    if (!turn) return;
    lastTurn = turn;
    await runQuiz(turn, c, e);
  });

  pi.on("input", async (_ev, c) => {
    ctx = c;
    epoch++;
    c.ui.setWidget("interview-loading", undefined);
    return { action: "continue" };
  });

  // ─── Commands ─────────────────────────────────────────────────────────

  pi.registerCommand("interview", {
    description: "interview: ask | settings | demo [scenario] | status | reset | config <key> <value>",
    handler: async (args, c) => {
      ctx = c;
      const [sub, ...rest] = args.trim().split(/\s+/);

      if (!sub || sub === "ask") {
        const turn = lastTurn ?? getTurnFromBranch(c);
        if (!turn) {
          c.ui.notify("No conversation context", "warning");
          return;
        }
        const e = ++epoch;
        await runQuiz(turn, c, e, true);
        return;
      }

      if (sub === "demo") {
        const scenario = rest[0];
        if (scenario === "list" || scenario === "help") {
          c.ui.notify(`scenarios: ${listDemoScenarios().join(", ")}`, "info");
          return;
        }
        const turn = getDemoTurn(scenario);
        const e = ++epoch;
        await runQuiz(turn, c, e, true);
        return;
      }

      if (sub === "settings") {
        const allModels = c.modelRegistry?.getAll?.() ?? [];
        const modelRefs = allModels.map((m: any) => `${m.provider}/${m.id}`);
        const result = await showSettingsUI(c, config, modelRefs);
        if (!result.cancelled && Object.keys(result.config).length > 0) {
          Object.assign(config, result.config);
          c.ui.notify(`interview: ${Object.keys(result.config).join(", ")} updated`, "info");
        }
        return;
      }

      if (sub === "status") {
        const usage = state.usage;
        const lines = [
          `✦ pi-interview`,
          `mode: ${config.mode} · model: ${config.model}`,
          `maxQ: ${config.maxQuestions} · maxOpts: ${config.maxOptions}`,
          `calls: ${usage.calls} (${usage.completions} used, ${usage.skips} skipped, ${usage.cancels} cancelled)`,
          `tokens: ↑${usage.totalInputTokens} ↓${usage.totalOutputTokens} $${usage.totalCost.toFixed(4)}`,
          `backoff: ${shouldBackOff(state) ? "active (3+ skips)" : "off"}`,
        ];
        if (projectSnapshot) {
          lines.push(`project: ${projectSnapshot.name}${projectSnapshot.branch ? ` (${projectSnapshot.branch})` : ""}`);
        }
        pi.sendMessage({
          customType: "interview-info",
          content: lines.join("\n"),
          display: true,
        }, { triggerTurn: false });
        return;
      }

      if (sub === "reset") {
        state = emptyState();
        persistState();
        refreshUsageWidget();
        c.ui.notify("interview state reset", "info");
        return;
      }

      if (sub === "config") {
        const key = rest[0];
        const val = rest.slice(1).join(" ");
        if (!key) { c.ui.notify("/quiz config <key> <value>", "info"); return; }

        switch (key) {
          case "mode":
            if (val === "auto" || val === "manual") { config.mode = val; c.ui.notify(`mode: ${val}`, "info"); }
            break;
          case "model":
            config.model = val || DEFAULT_CONFIG.model;
            c.ui.notify(`model: ${config.model}`, "info");
            break;
          case "maxQuestions":
            config.maxQuestions = Math.max(1, Math.min(5, parseInt(val) || 3));
            c.ui.notify(`maxQuestions: ${config.maxQuestions}`, "info");
            break;
          case "maxOptions":
            config.maxOptions = Math.max(2, Math.min(8, parseInt(val) || 5));
            c.ui.notify(`maxOptions: ${config.maxOptions}`, "info");
            break;
          case "skip":
            config.skipOnSimpleResponse = val !== "false";
            c.ui.notify(`skip: ${config.skipOnSimpleResponse}`, "info");
            break;
          case "instruction":
            config.customInstruction = val;
            c.ui.notify(val ? `instruction: "${val}"` : "instruction cleared", "info");
            break;
          default:
            c.ui.notify(`Unknown: ${key}`, "warning");
        }
        return;
      }

      c.ui.notify("/quiz [ask | status | reset | config <key> <value>]", "info");
    },
  });

  // ─── Shortcut ─────────────────────────────────────────────────────────

  pi.registerShortcut("ctrl+i", {
    description: "Trigger interview",
    handler: async (c) => {
      ctx = c;
      const turn = lastTurn ?? getTurnFromBranch(c);
      if (!turn) {
        c.ui.notify("No conversation context", "warning");
        return;
      }
      const e = ++epoch;
      await runQuiz(turn, c, e, true);
    },
  });
}
