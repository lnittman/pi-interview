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

  it("detects current project from cwd", async () => {
    const ctx = await buildAgentContext("/Users/luke/Developer/apps/arbor");
    assert.equal(ctx?.currentProject, "arbor");
  });

  it("returns roles", async () => {
    const ctx = await buildAgentContext();
    // roles.json may or may not exist — just validate structure
    assert.ok(Array.isArray(ctx.roles));
  });
});

describe("formatAgentContext", () => {
  it("formats context with categories", () => {
    const text = formatAgentContext({
      rules: [{ name: "core", summary: "Core rules", triggers: ["always"] }],
      skills: [
        { name: "loop", description: "Autonomous work", triggers: ["loop"] },
        { name: "convex-god", description: "Convex expertise", triggers: ["convex"] },
      ],
      projects: [{
        name: "arbor",
        emoji: "🍂",
        team: "ARBOR",
        surfaces: ["web", "apple"],
        frameworks: ["next.js", "convex"],
      }],
      roles: [{ role: "BUILD", agent: "codex", model: "gpt-5.4" }],
      currentProject: "arbor",
    });
    assert.ok(text.includes("Current project: arbor"));
    assert.ok(text.includes("arbor"));
    assert.ok(text.includes("Orchestration skills"));
    assert.ok(text.includes("Domain skills"));
    assert.ok(text.includes("BUILD"));
  });
});
