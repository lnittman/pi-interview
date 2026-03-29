/**
 * Lightweight project context for pi-quiz.
 *
 * Instead of prompt-suggester's heavy agentic seeding loop,
 * we do a fast one-shot scan: package.json + git status + cwd name.
 * Gives the model just enough project awareness to generate grounded questions.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface ProjectSnapshot {
  /** Project name from package.json or directory */
  name: string;
  /** Brief description from package.json */
  description?: string;
  /** Key scripts available */
  scripts: string[];
  /** Current git branch */
  branch?: string;
  /** Whether there are uncommitted changes */
  dirty: boolean;
  /** Recent commit subjects (last 3) */
  recentCommits: string[];
}

async function tryExec(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string> {
  try {
    const { stdout } = await exec(cmd, args, {
      cwd,
      timeout: 3000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function tryReadJson(path: string): Promise<Record<string, any> | null> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Build a fast project snapshot from cwd.
 * Designed to complete in <500ms.
 */
export async function buildProjectSnapshot(
  cwd: string
): Promise<ProjectSnapshot> {
  // Run all lookups in parallel
  const [pkg, branch, status, log] = await Promise.all([
    tryReadJson(join(cwd, "package.json")),
    tryExec("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd),
    tryExec("git", ["status", "--porcelain", "--short"], cwd),
    tryExec("git", ["log", "--oneline", "-3", "--no-decorate"], cwd),
  ]);

  const name = pkg?.name ?? basename(cwd);
  const description = pkg?.description;

  // Extract key script names (not the commands themselves)
  const allScripts = Object.keys(pkg?.scripts ?? {});
  const keyScripts = allScripts.filter((s) =>
    /^(dev|build|test|lint|start|deploy|typecheck|verify)/.test(s)
  );
  const scripts = keyScripts.length > 0 ? keyScripts.slice(0, 8) : allScripts.slice(0, 5);

  return {
    name,
    description,
    scripts,
    branch: branch || undefined,
    dirty: status.length > 0,
    recentCommits: log ? log.split("\n").filter(Boolean).slice(0, 3) : [],
  };
}

/**
 * Format project snapshot as a compact string for the prompt.
 */
export function formatProjectContext(snapshot: ProjectSnapshot): string {
  const lines: string[] = [];
  lines.push(`Project: ${snapshot.name}${snapshot.description ? ` — ${snapshot.description}` : ""}`);
  if (snapshot.branch) {
    lines.push(`Branch: ${snapshot.branch}${snapshot.dirty ? " (dirty)" : ""}`);
  }
  if (snapshot.scripts.length > 0) {
    lines.push(`Scripts: ${snapshot.scripts.join(", ")}`);
  }
  if (snapshot.recentCommits.length > 0) {
    lines.push(`Recent commits:`);
    for (const c of snapshot.recentCommits) {
      lines.push(`  ${c}`);
    }
  }
  return lines.join("\n");
}
