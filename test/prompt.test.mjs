import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuizPromptContext, renderQuizPrompt } from "../dist/prompts/interview-template.js";
import { getDemoTurn, listDemoScenarios } from "../dist/core/demo.js";

const defaultConfig = {
  model: "test",
  maxQuestions: 3,
  maxOptions: 5,
  maxPromptChars: 500,
  autoSubmitSingle: true,
  mode: /** @type {const} */ ("auto"),
  skipOnSimpleResponse: true,
  thinkingLevel: /** @type {const} */ ("off"),
  customInstruction: "",
};

describe("renderQuizPrompt", () => {
  it("includes tool signals in prompt", () => {
    const turn = getDemoTurn("build");
    const ctx = buildQuizPromptContext(turn, defaultConfig);
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("write(src/auth/jwt.ts)"));
    assert.ok(prompt.includes("bash(npm test)"));
  });

  it("includes touched files", () => {
    const turn = getDemoTurn("build");
    const ctx = buildQuizPromptContext(turn, defaultConfig);
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("src/auth/jwt.ts"));
    assert.ok(prompt.includes("src/middleware/auth.ts"));
  });

  it("includes unresolved questions", () => {
    const turn = getDemoTurn("questions");
    const ctx = buildQuizPromptContext(turn, defaultConfig);
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("Express or migrate to Hono"));
    assert.ok(prompt.includes("OpenAPI spec"));
  });

  it("includes abort context for aborted turns", () => {
    const turn = getDemoTurn("aborted");
    const ctx = buildQuizPromptContext(turn, defaultConfig);
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("AbortContext"));
    assert.ok(prompt.includes("interrupted"));
  });

  it("includes project context when provided", () => {
    const turn = getDemoTurn("build");
    const ctx = buildQuizPromptContext(turn, defaultConfig, {
      name: "my-app",
      description: "A great app",
      scripts: ["dev", "test"],
      branch: "feature/auth",
      dirty: true,
      recentCommits: ["abc feat: auth"],
    });
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("my-app"));
    assert.ok(prompt.includes("feature/auth"));
  });

  it("includes grounding rules", () => {
    const turn = getDemoTurn("build");
    const ctx = buildQuizPromptContext(turn, defaultConfig);
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("GROUNDING"));
    assert.ok(prompt.includes("MUST name a specific artifact"));
    assert.ok(prompt.includes("BANNED"));
  });

  it("includes custom instruction when set", () => {
    const turn = getDemoTurn("build");
    const ctx = buildQuizPromptContext(turn, {
      ...defaultConfig,
      customInstruction: "prefer short tactical questions",
    });
    const prompt = renderQuizPrompt(ctx);
    assert.ok(prompt.includes("prefer short tactical questions"));
  });
});

describe("demo turns", () => {
  it("has all expected scenarios", () => {
    const scenarios = listDemoScenarios();
    assert.ok(scenarios.includes("build"));
    assert.ok(scenarios.includes("error"));
    assert.ok(scenarios.includes("aborted"));
    assert.ok(scenarios.includes("questions"));
  });

  it("returns valid turn contexts", () => {
    for (const scenario of listDemoScenarios()) {
      const turn = getDemoTurn(scenario);
      assert.ok(turn.turnId, `${scenario}: has turnId`);
      assert.ok(turn.assistantText.length > 0, `${scenario}: has assistantText`);
      assert.ok(["success", "error", "aborted"].includes(turn.status), `${scenario}: valid status`);
      assert.ok(turn.toolSignals.length > 0, `${scenario}: has toolSignals`);
    }
  });
});
