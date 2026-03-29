/**
 * Demo turn contexts for testing pi-quiz without a real agent session.
 * Used by /quiz demo command.
 */
import type { TurnContext } from "./types.js";
export declare const DEMO_TURNS: Record<string, TurnContext>;
export declare function getDemoTurn(scenario?: string): TurnContext;
export declare function listDemoScenarios(): string[];
//# sourceMappingURL=demo.d.ts.map