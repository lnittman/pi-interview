import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  recordQuizCall,
  shouldBackOff,
  formatUsageStatus,
} from "../dist/core/state.js";

describe("state", () => {
  it("starts empty", () => {
    const s = emptyState();
    assert.equal(s.usage.calls, 0);
    assert.equal(s.consecutiveSkips, 0);
    assert.equal(shouldBackOff(s), false);
    assert.equal(formatUsageStatus(s), undefined);
  });

  it("tracks completed quiz", () => {
    let s = emptyState();
    s = recordQuizCall(
      s,
      { inputTokens: 500, outputTokens: 100, totalTokens: 600, costTotal: 0.001 },
      "completed",
      "turn-1"
    );
    assert.equal(s.usage.calls, 1);
    assert.equal(s.usage.completions, 1);
    assert.equal(s.usage.totalInputTokens, 500);
    assert.equal(s.usage.totalCost, 0.001);
    assert.equal(s.consecutiveSkips, 0);
    assert.equal(s.lastQuizTurnId, "turn-1");
  });

  it("tracks skips and triggers back-off at 3", () => {
    let s = emptyState();
    s = recordQuizCall(s, undefined, "skipped", "t1");
    assert.equal(shouldBackOff(s), false);
    s = recordQuizCall(s, undefined, "skipped", "t2");
    assert.equal(shouldBackOff(s), false);
    s = recordQuizCall(s, undefined, "cancelled", "t3");
    assert.equal(shouldBackOff(s), true);
    assert.equal(s.consecutiveSkips, 3);
  });

  it("resets consecutive skips on completion", () => {
    let s = emptyState();
    s = recordQuizCall(s, undefined, "skipped", "t1");
    s = recordQuizCall(s, undefined, "skipped", "t2");
    s = recordQuizCall(s, { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, "completed", "t3");
    assert.equal(s.consecutiveSkips, 0);
    assert.equal(shouldBackOff(s), false);
    assert.equal(s.usage.calls, 3);
  });

  it("formats usage status", () => {
    let s = emptyState();
    s = recordQuizCall(s, { inputTokens: 1000, outputTokens: 200, totalTokens: 1200, costTotal: 0.005 }, "completed", "t1");
    s = recordQuizCall(s, undefined, "skipped", "t2");
    const status = formatUsageStatus(s);
    assert.ok(status?.includes("1/2 used"));
    assert.ok(status?.includes("1200 tok"));
    assert.ok(status?.includes("$0.0050"));
  });
});
