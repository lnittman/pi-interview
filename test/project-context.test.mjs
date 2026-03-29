import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProjectSnapshot, formatProjectContext } from "../dist/core/project-context.js";

describe("buildProjectSnapshot", () => {
  it("scans pi-quiz repo", async () => {
    const snap = await buildProjectSnapshot("/Users/luke/Developer/packages/pi-quiz");
    assert.equal(snap.name, "pi-quiz");
    assert.ok(snap.branch, "should have a branch");
    assert.ok(snap.scripts.length > 0, "should have scripts");
    assert.ok(snap.recentCommits.length > 0, "should have commits");
  });

  it("handles non-git directory", async () => {
    const snap = await buildProjectSnapshot("/tmp");
    assert.equal(snap.branch, undefined);
    assert.deepEqual(snap.recentCommits, []);
  });
});

describe("formatProjectContext", () => {
  it("formats snapshot as string", () => {
    const text = formatProjectContext({
      name: "test-project",
      description: "A test",
      scripts: ["dev", "build", "test"],
      branch: "main",
      dirty: true,
      recentCommits: ["abc1234 feat: something"],
    });
    assert.ok(text.includes("test-project"));
    assert.ok(text.includes("A test"));
    assert.ok(text.includes("main (dirty)"));
    assert.ok(text.includes("dev, build, test"));
    assert.ok(text.includes("abc1234"));
  });
});
