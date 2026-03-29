/**
 * pi-quiz — Multiple-choice next-prompt quiz for pi.
 *
 * Every question is multiple choice. Grounded in specific files, errors, signals.
 * Ctrl+Q to trigger. /quiz for commands. Haiku by default.
 */
import { completeSimple } from "@mariozechner/pi-ai";
import { buildTurnContext, buildTurnContextFromBranch } from "./core/signals.js";
import { buildQuizPromptContext } from "./prompts/interview-template.js";
import { QuizModelClient } from "./adapters/model-client.js";
import { showQuizUI } from "./ui/interview-ui.js";
import { emptyState, recordQuizCall, shouldBackOff, formatUsageStatus, } from "./core/state.js";
import { buildProjectSnapshot, } from "./core/project-context.js";
import { DEFAULT_CONFIG } from "./core/types.js";
import { getDemoTurn, listDemoScenarios } from "./core/demo.js";
const CUSTOM_TYPE = "pi-quiz-state";
export default function quiz(pi) {
    let config = { ...DEFAULT_CONFIG };
    let ctx;
    let lastTurn;
    let quizActive = false;
    let epoch = 0;
    let state = emptyState();
    let projectSnapshot;
    const modelClient = new QuizModelClient({ getContext: () => ctx }, completeSimple);
    // ─── State Persistence ────────────────────────────────────────────────
    function persistState() {
        pi.appendEntry(CUSTOM_TYPE, { ...state });
    }
    function restoreState(entries) {
        state = emptyState();
        for (const entry of entries) {
            if (entry.type === "custom" && entry.customType === CUSTOM_TYPE && entry.data) {
                if (entry.data.version === 1) {
                    state = entry.data;
                }
            }
        }
    }
    function refreshUsageWidget() {
        if (!ctx?.hasUI)
            return;
        const status = formatUsageStatus(state);
        ctx.ui.setStatus("quiz-usage", status);
    }
    // ─── Project Context ──────────────────────────────────────────────────
    async function ensureProjectSnapshot() {
        if (!projectSnapshot && ctx) {
            try {
                projectSnapshot = await buildProjectSnapshot(ctx.cwd);
            }
            catch {
                // Non-critical — quiz works without it
            }
        }
    }
    // ─── Core Flow ────────────────────────────────────────────────────────
    async function runQuiz(turn, context, currentEpoch, manual = false) {
        if (!context.hasUI || quizActive)
            return;
        if (currentEpoch !== epoch)
            return;
        // Don't re-quiz the same turn
        if (!manual && state.lastQuizTurnId === turn.turnId)
            return;
        // Back-off after repeated skips/cancels (unless manual)
        if (!manual && shouldBackOff(state))
            return;
        // Skip trivially short responses (unless manual)
        if (!manual &&
            config.skipOnSimpleResponse &&
            turn.assistantText.length < 100 &&
            turn.unresolvedQuestions.length === 0 &&
            turn.status === "success") {
            return;
        }
        quizActive = true;
        try {
            await ensureProjectSnapshot();
            const promptContext = buildQuizPromptContext(turn, config, projectSnapshot);
            context.ui.setWidget("quiz-loading", [
                `  ${context.ui.theme.fg("dim", "✦ quiz...")}`,
            ], { placement: "belowEditor" });
            const result = await modelClient.generateQuiz(promptContext, config);
            if (currentEpoch !== epoch) {
                context.ui.setWidget("quiz-loading", undefined);
                return;
            }
            context.ui.setWidget("quiz-loading", undefined);
            if (result.skipped || result.questions.length === 0) {
                state = recordQuizCall(state, result.usage, "skipped", turn.turnId);
                persistState();
                refreshUsageWidget();
                // Brief flash only on first few skips
                if (state.consecutiveSkips <= 2) {
                    context.ui.setWidget("quiz-loading", [
                        `  ${context.ui.theme.fg("dim", `✦ —${result.skipReason ? ` ${result.skipReason}` : ""}`)}`,
                    ], { placement: "belowEditor" });
                    setTimeout(() => context.ui.setWidget("quiz-loading", undefined), 1500);
                }
                return;
            }
            // Show usage inline
            if (result.usage) {
                const cost = result.usage.costTotal ? ` $${result.usage.costTotal.toFixed(4)}` : "";
                context.ui.setStatus("quiz", `✦ ${result.usage.totalTokens} tok${cost}`);
            }
            const submission = await showQuizUI(context, result.questions, config);
            context.ui.setStatus("quiz", undefined);
            if (submission.cancelled) {
                state = recordQuizCall(state, result.usage, "cancelled", turn.turnId);
            }
            else {
                state = recordQuizCall(state, result.usage, "completed", turn.turnId);
                if (submission.composedPrompt) {
                    // Send directly as a user message — don't pollute the editor
                    pi.sendUserMessage(submission.composedPrompt);
                }
            }
            persistState();
            refreshUsageWidget();
        }
        catch (error) {
            context.ui.setWidget("quiz-loading", undefined);
            const msg = error instanceof Error ? error.message : String(error);
            context.ui.notify(`quiz: ${msg.slice(0, 80)}`, "error");
        }
        finally {
            quizActive = false;
        }
    }
    // ─── Helpers ──────────────────────────────────────────────────────────
    function getTurnFromBranch(context) {
        const branchEntries = context.sessionManager
            .getBranch()
            .filter((e) => e.type === "message");
        return buildTurnContextFromBranch(branchEntries) ?? undefined;
    }
    // ─── Events ───────────────────────────────────────────────────────────
    pi.on("session_start", async (_ev, c) => {
        ctx = c;
        epoch++;
        projectSnapshot = undefined;
        restoreState(c.sessionManager.getEntries());
        refreshUsageWidget();
    });
    pi.on("session_switch", async (_ev, c) => {
        ctx = c;
        epoch++;
        quizActive = false;
        projectSnapshot = undefined;
        restoreState(c.sessionManager.getEntries());
        refreshUsageWidget();
    });
    pi.on("session_fork", async (_ev, c) => {
        ctx = c;
        epoch++;
        quizActive = false;
        restoreState(c.sessionManager.getEntries());
        refreshUsageWidget();
    });
    pi.on("agent_end", async (event, c) => {
        ctx = c;
        const e = ++epoch;
        if (config.mode !== "auto")
            return;
        const branchEntries = c.sessionManager.getBranch();
        const branchMessages = branchEntries
            .filter((entry) => entry.type === "message")
            .map((entry) => entry.message);
        const leafId = c.sessionManager.getLeafId() ?? `turn-${Date.now()}`;
        const turn = buildTurnContext({
            turnId: leafId,
            sourceLeafId: leafId,
            messagesFromPrompt: event.messages,
            branchMessages: branchMessages,
            occurredAt: new Date().toISOString(),
        });
        if (!turn)
            return;
        lastTurn = turn;
        await runQuiz(turn, c, e);
    });
    pi.on("input", async (_ev, c) => {
        ctx = c;
        epoch++;
        c.ui.setWidget("quiz-loading", undefined);
        return { action: "continue" };
    });
    // ─── Commands ─────────────────────────────────────────────────────────
    pi.registerCommand("quiz", {
        description: "quiz: ask | demo [scenario] | status | reset | config <key> <value>",
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
            if (sub === "status") {
                const usage = state.usage;
                const lines = [
                    `✦ pi-quiz`,
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
                    customType: "quiz-info",
                    content: lines.join("\n"),
                    display: true,
                }, { triggerTurn: false });
                return;
            }
            if (sub === "reset") {
                state = emptyState();
                persistState();
                refreshUsageWidget();
                c.ui.notify("quiz state reset", "info");
                return;
            }
            if (sub === "config") {
                const key = rest[0];
                const val = rest.slice(1).join(" ");
                if (!key) {
                    c.ui.notify("/quiz config <key> <value>", "info");
                    return;
                }
                switch (key) {
                    case "mode":
                        if (val === "auto" || val === "manual") {
                            config.mode = val;
                            c.ui.notify(`mode: ${val}`, "info");
                        }
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
    pi.registerShortcut("ctrl+q", {
        description: "Trigger quiz",
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
//# sourceMappingURL=index.js.map