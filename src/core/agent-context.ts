/**
 * Agent context enrichment — pulls from ~/.agents for richer interview questions.
 *
 * Reads:
 * - rules.index.json → rule names, summaries, and triggers
 * - skills.index.json → skill names, descriptions, and triggers
 * - projects.json → project names, teams, emoji, surfaces, frameworks
 * - roles.json → agent role assignments (THINK/BUILD/SCOUT)
 * - Active Linear issues if linear CLI is available
 *
 * All reads are fast (<100ms) and non-critical — failures are silent.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const AGENTS_DIR = join(homedir(), ".agents");

interface RuleEntry {
  file: string;
  triggers?: string[];
  summary?: string;
}

interface SkillEntry {
  name: string;
  description?: string;
  triggers?: string[];
  location?: string;
  lines?: number;
}

interface ProjectEntry {
  name: string;
  emoji?: string;
  linearTeam?: string;
  color?: string;
  surfaces?: string[];
  frameworks?: string[];
  path?: string;
}

interface RoleEntry {
  agent: string;
  model: string;
}

export interface AgentContext {
  /** Rule names with summaries — for suggesting which rules apply */
  rules: { name: string; summary: string; triggers: string[] }[];
  /** Skill names with descriptions — for suggesting skill invocation */
  skills: { name: string; description: string; triggers: string[] }[];
  /** Projects with rich metadata — for cross-project awareness */
  projects: {
    name: string;
    emoji?: string;
    team?: string;
    surfaces?: string[];
    frameworks?: string[];
  }[];
  /** Role→agent mapping — for suggesting delegation */
  roles: { role: string; agent: string; model: string }[];
  /** Current cwd project match (if any) */
  currentProject?: string;
}

async function tryReadJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Build agent context from ~/.agents. Fast and non-critical.
 */
export async function buildAgentContext(
  cwd?: string
): Promise<AgentContext | null> {
  const [rulesFile, skillsFile, projectsRaw, rolesRaw] = await Promise.all([
    tryReadJson<{ rules?: Record<string, RuleEntry> }>(
      join(AGENTS_DIR, "rules.index.json")
    ),
    tryReadJson<{ skills?: Record<string, SkillEntry> }>(
      join(AGENTS_DIR, "skills.index.json")
    ),
    tryReadJson<{ projects?: Record<string, ProjectEntry> }>(
      join(AGENTS_DIR, "projects.json")
    ),
    tryReadJson<Record<string, RoleEntry>>(join(AGENTS_DIR, "roles.json")),
  ]);

  if (!rulesFile && !skillsFile && !projectsRaw) return null;

  const rulesMap = rulesFile?.rules ?? {};
  const rules = Object.entries(rulesMap)
    .filter(([_, v]) => v.summary)
    .map(([k, v]) => ({
      name: k.replace(/\.md$/, ""),
      summary: (v.summary || "").slice(0, 100),
      triggers: v.triggers?.slice(0, 5) ?? [],
    }))
    .slice(0, 20);

  const skillsMap = skillsFile?.skills ?? {};
  const skills = Object.entries(skillsMap)
    .filter(([_, v]) => v.description)
    .map(([k, v]) => ({
      name: k,
      description: (v.description || "").slice(0, 100),
      triggers: v.triggers?.slice(0, 3) ?? [],
    }))
    .slice(0, 25);

  const projectsMap = projectsRaw?.projects ?? {};
  const projects = Object.values(projectsMap)
    .filter((p) => typeof p === "object" && p?.name)
    .map((p) => ({
      name: p.name,
      emoji: p.emoji,
      team: p.linearTeam,
      surfaces: p.surfaces?.slice(0, 5),
      frameworks: p.frameworks?.slice(0, 3),
    }))
    .slice(0, 12);

  // Parse roles
  const roles: AgentContext["roles"] = [];
  if (rolesRaw && typeof rolesRaw === "object") {
    for (const [role, entry] of Object.entries(rolesRaw)) {
      if (entry && typeof entry === "object" && "agent" in entry) {
        roles.push({
          role,
          agent: String(entry.agent),
          model: String(entry.model || ""),
        });
      }
    }
  }

  // Match cwd to a project
  let currentProject: string | undefined;
  if (cwd) {
    for (const p of Object.values(projectsMap)) {
      if (p.path && cwd.startsWith(p.path)) {
        currentProject = p.name;
        break;
      }
    }
  }

  return { rules, skills, projects, roles, currentProject };
}

/**
 * Format agent context for the prompt — structured for question generation.
 */
export function formatAgentContext(ctx: AgentContext): string {
  const lines: string[] = [];

  if (ctx.currentProject) {
    lines.push(`Current project: ${ctx.currentProject}`);
  }

  if (ctx.projects.length > 0) {
    const projectLines = ctx.projects.map((p) => {
      const parts = [`${p.emoji || ""} ${p.name}`];
      if (p.team) parts.push(`team:${p.team}`);
      if (p.surfaces?.length) parts.push(`surfaces:${p.surfaces.join(",")}`);
      if (p.frameworks?.length) parts.push(`stack:${p.frameworks.join(",")}`);
      return parts.join(" ");
    });
    lines.push(`Projects:\n${projectLines.map((l) => `  ${l}`).join("\n")}`);
  }

  if (ctx.skills.length > 0) {
    // Group by category for relevance
    const godSkills = ctx.skills.filter((s) => s.name.endsWith("-god"));
    const orchSkills = ctx.skills.filter((s) =>
      ["loop", "auto", "campaign", "pair", "council", "skill-compose"].includes(s.name)
    );
    const otherSkills = ctx.skills.filter(
      (s) => !godSkills.includes(s) && !orchSkills.includes(s)
    );

    if (orchSkills.length) {
      lines.push(
        `Orchestration skills: ${orchSkills.map((s) => s.name).join(", ")}`
      );
    }
    if (godSkills.length) {
      lines.push(
        `Domain skills: ${godSkills.map((s) => s.name).join(", ")}`
      );
    }
    if (otherSkills.length) {
      lines.push(
        `Other skills: ${otherSkills.map((s) => s.name).join(", ")}`
      );
    }
  }

  if (ctx.roles.length > 0) {
    lines.push(
      `Agent roles: ${ctx.roles.map((r) => `${r.role}→${r.agent}`).join(", ")}`
    );
  }

  return lines.join("\n");
}
