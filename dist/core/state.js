/**
 * Session state for pi-quiz.
 *
 * Persisted via pi.appendEntry() so it survives session restores.
 * Tracks usage, skip patterns, and last quiz context.
 */
export function emptyState() {
    return {
        version: 1,
        usage: {
            calls: 0,
            skips: 0,
            cancels: 0,
            completions: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
        },
        lastQuizTurnId: undefined,
        consecutiveSkips: 0,
    };
}
export function recordQuizCall(state, usage, outcome, turnId) {
    const next = { ...state, usage: { ...state.usage } };
    next.usage.calls++;
    next.lastQuizTurnId = turnId;
    if (usage) {
        next.usage.totalInputTokens += usage.inputTokens;
        next.usage.totalOutputTokens += usage.outputTokens;
        next.usage.totalCost += usage.costTotal ?? 0;
    }
    switch (outcome) {
        case "skipped":
            next.usage.skips++;
            next.consecutiveSkips++;
            break;
        case "cancelled":
            next.usage.cancels++;
            next.consecutiveSkips++;
            break;
        case "completed":
            next.usage.completions++;
            next.consecutiveSkips = 0;
            break;
    }
    return next;
}
/**
 * Should we back off from auto-quizzing?
 * After 3+ consecutive skips/cancels, pause auto mode for this session.
 */
export function shouldBackOff(state) {
    return state.consecutiveSkips >= 3;
}
export function formatUsageStatus(state) {
    if (state.usage.calls === 0)
        return undefined;
    const cost = state.usage.totalCost > 0 ? ` $${state.usage.totalCost.toFixed(4)}` : "";
    const tokens = state.usage.totalInputTokens + state.usage.totalOutputTokens;
    return `✦ quiz: ${state.usage.completions}/${state.usage.calls} used · ${tokens} tok${cost}`;
}
//# sourceMappingURL=state.js.map