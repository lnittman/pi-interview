/**
 * Session state for pi-quiz.
 *
 * Persisted via pi.appendEntry() so it survives session restores.
 * Tracks usage, skip patterns, and last quiz context.
 */
import type { TokenUsage } from "./types.js";
export interface QuizUsageStats {
    calls: number;
    skips: number;
    cancels: number;
    completions: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
}
export interface QuizSessionState {
    version: 1;
    usage: QuizUsageStats;
    /** Last quiz turn ID to avoid re-triggering */
    lastQuizTurnId?: string;
    /** Consecutive skips — if too many, back off */
    consecutiveSkips: number;
}
export declare function emptyState(): QuizSessionState;
export declare function recordQuizCall(state: QuizSessionState, usage: TokenUsage | undefined, outcome: "skipped" | "cancelled" | "completed", turnId: string): QuizSessionState;
/**
 * Should we back off from auto-quizzing?
 * After 3+ consecutive skips/cancels, pause auto mode for this session.
 */
export declare function shouldBackOff(state: QuizSessionState): boolean;
export declare function formatUsageStatus(state: QuizSessionState): string | undefined;
//# sourceMappingURL=state.d.ts.map