import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composePrompt, buildSubmission } from "../dist/prompts/compose-template.js";

describe("composePrompt", () => {
  it("composes single selection", () => {
    const result = composePrompt(
      [{ id: "q1", text: "What next?", type: "single", options: [{ label: "Fix the 3 failing tests" }] }],
      [{ questionId: "q1", selectedOptions: ["Fix the 3 failing tests"], skipped: false }],
      500
    );
    assert.equal(result, "Fix the 3 failing tests");
  });

  it("composes multiple selections with 'then'", () => {
    const result = composePrompt(
      [{ id: "q1", text: "What next?", type: "multi", options: [] }],
      [{ questionId: "q1", selectedOptions: ["Fix linting", "Run tests"], skipped: false }],
      500
    );
    assert.equal(result, "Fix linting, then Run tests");
  });

  it("composes freeform text", () => {
    const result = composePrompt(
      [{ id: "q1", text: "Notes?", type: "single", options: [] }],
      [{ questionId: "q1", text: "Focus on the auth module only", skipped: false }],
      500
    );
    assert.equal(result, "Focus on the auth module only");
  });

  it("combines multi-question answers", () => {
    const result = composePrompt(
      [
        { id: "q1", text: "Direction?", type: "single", options: [] },
        { id: "q2", text: "Constraint?", type: "single", options: [] },
      ],
      [
        { questionId: "q1", selectedOptions: ["Fix the failing tests"], skipped: false },
        { questionId: "q2", selectedOptions: ["Keep it under 30 minutes"], skipped: false },
      ],
      500
    );
    assert.equal(result, "Fix the failing tests. Keep it under 30 minutes");
  });

  it("skips skipped answers", () => {
    const result = composePrompt(
      [
        { id: "q1", text: "A?", type: "single", options: [] },
        { id: "q2", text: "B?", type: "single", options: [] },
      ],
      [
        { questionId: "q1", selectedOptions: ["Do X"], skipped: false },
        { questionId: "q2", skipped: true },
      ],
      500
    );
    assert.equal(result, "Do X");
  });

  it("truncates at maxChars", () => {
    const result = composePrompt(
      [{ id: "q1", text: "?", type: "single", options: [] }],
      [{ questionId: "q1", selectedOptions: ["A very long option that exceeds the limit"], skipped: false }],
      20
    );
    assert.ok(result.length <= 20);
    assert.ok(result.endsWith("…"));
  });

  it("returns empty for all skipped", () => {
    const result = composePrompt(
      [{ id: "q1", text: "?", type: "single", options: [] }],
      [{ questionId: "q1", skipped: true }],
      500
    );
    assert.equal(result, "");
  });
});

describe("buildSubmission", () => {
  it("builds cancelled submission", () => {
    const sub = buildSubmission([], [], 500, Date.now() - 1000, true);
    assert.equal(sub.cancelled, true);
    assert.equal(sub.composedPrompt, "");
    assert.ok(sub.durationMs >= 0);
  });

  it("builds completed submission", () => {
    const questions = [{ id: "q1", text: "?", type: /** @type {const} */ ("single"), options: [{ label: "Go" }] }];
    const answers = [{ questionId: "q1", selectedOptions: ["Go"], skipped: false }];
    const sub = buildSubmission(questions, answers, 500, Date.now() - 500, false);
    assert.equal(sub.cancelled, false);
    assert.equal(sub.composedPrompt, "Go");
  });
});
