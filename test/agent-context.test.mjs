import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAgentContext, formatAgentContext } from "../dist/core/agent-context.js";

describe("buildAgentContext", () => {
  it("reads ~/.agents successfully", async () => {
    const ctx = await buildAgentContext();
    assert.ok(ctx, "should return context");
    assert.ok(ctx.rules.length > 0, "should have rules");
    assert.ok(ctx.skills.length > 0, "should have skills");
    assert.ok(ctx.projects.length > 0, "should have projects");
  });

  it("rules have name, summary, and triggers", async () => {
    const ctx = await buildAgentContext();
    for (const rule of ctx.rules) {
      assert.ok(rule.name, "rule should have name");
      assert.ok(rule.summary, "rule should have summary");
      assert.ok(Array.isArray(rule.triggers), "rule should have triggers array");
    }
  });

  it("skills have name, description, and triggers", async () => {
    const ctx = await buildAgentContext();
    for (const skill of ctx.skills) {
      assert.ok(skill.name, "skill should have name");
      assert.ok(skill.description, "skill should have description");
      assert.ok(Array.isArray(skill.triggers), "skill should have triggers array");
    }
  });

  it("projects have surfaces and frameworks", async () => {
    const ctx = await buildAgentContext();
    const withSurfaces = ctx.projects.filter((p) => p.surfaces?.length);
    assert.ok(withSurfaces.length > 0, "some projects should have surfaces");
  });

  it("returns roles", async () => {
    const ctx = await buildAgentContext();
    assert.ok(Array.isArray(ctx.roles));
  });
});

describe("formatAgentContext", () => {
  it("formats context with categories", () => {
    const text = formatAgentContext({
      rules: [{ name: "core", summary: "Core rules", triggers: ["always"] }],
      skills: [
        { name: "loop", description: "Autonomous work", triggers: ["loop"] },
        { name: "test-god", description: "Test expertise", triggers: ["test"] },
      ],
      projects: [{
        name: "my-app",
        emoji: "\ud83d\ude80",
        team: "APP",
        surfaces: ["web", "mobile"],
        frameworks: ["next.js"],
      }],
      roles: [{ role: "BUILD", agent: "codex", model: "gpt-5" }],
      currentProject: "my-app",
    });
    assert.ok(text.includes("Current project: my-app"));
    assert.ok(text.includes("my-app"));
    assert.ok(text.includes("Orchestration skills"));
    assert.ok(text.includes("Domain skills"));
    assert.ok(text.includes("BUILD"));
  });
});
