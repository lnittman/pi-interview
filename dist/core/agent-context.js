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
async function tryReadJson(path) {
    try {
        return JSON.parse(await readFile(path, "utf8"));
    }
    catch {
        return null;
    }
}
/**
 * Build agent context from ~/.agents. Fast and non-critical.
 */
export async function buildAgentContext(cwd) {
    const [rulesFile, skillsFile, projectsRaw, rolesRaw] = await Promise.all([
        tryReadJson(join(AGENTS_DIR, "rules.index.json")),
        tryReadJson(join(AGENTS_DIR, "skills.index.json")),
        tryReadJson(join(AGENTS_DIR, "projects.json")),
        tryReadJson(join(AGENTS_DIR, "roles.json")),
    ]);
    if (!rulesFile && !skillsFile && !projectsRaw)
        return null;
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
    const roles = [];
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
    let currentProject;
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
 * Extract session depth from pi's session manager.
 * Call this from the extension where ctx.sessionManager is available.
 */
export function extractSessionDepth(entries) {
    let messageCount = 0;
    let turnCount = 0;
    let hasCompaction = false;
    for (const e of entries) {
        if (e.type === "message")
            messageCount++;
        if (e.type === "message" && e.message?.role === "user")
            turnCount++;
        if (e.type === "compaction")
            hasCompaction = true;
    }
    return { messageCount, turnCount, hasCompaction };
}
/**
 * Format agent context for the prompt — structured for question generation.
 */
export function formatAgentContext(ctx) {
    const lines = [];
    if (ctx.currentProject) {
        lines.push(`Current project: ${ctx.currentProject}`);
    }
    if (ctx.projects.length > 0) {
        const projectLines = ctx.projects.map((p) => {
            const parts = [`${p.emoji || ""} ${p.name}`];
            if (p.team)
                parts.push(`team:${p.team}`);
            if (p.surfaces?.length)
                parts.push(`surfaces:${p.surfaces.join(",")}`);
            if (p.frameworks?.length)
                parts.push(`stack:${p.frameworks.join(",")}`);
            return parts.join(" ");
        });
        lines.push(`Projects:\n${projectLines.map((l) => `  ${l}`).join("\n")}`);
    }
    if (ctx.skills.length > 0) {
        // Group by category for relevance
        const godSkills = ctx.skills.filter((s) => s.name.endsWith("-god"));
        const orchSkills = ctx.skills.filter((s) => ["loop", "auto", "campaign", "pair", "council", "skill-compose"].includes(s.name));
        const otherSkills = ctx.skills.filter((s) => !godSkills.includes(s) && !orchSkills.includes(s));
        if (orchSkills.length) {
            lines.push(`Orchestration skills: ${orchSkills.map((s) => s.name).join(", ")}`);
        }
        if (godSkills.length) {
            lines.push(`Domain skills: ${godSkills.map((s) => s.name).join(", ")}`);
        }
        if (otherSkills.length) {
            lines.push(`Other skills: ${otherSkills.map((s) => s.name).join(", ")}`);
        }
    }
    if (ctx.roles.length > 0) {
        lines.push(`Agent roles: ${ctx.roles.map((r) => `${r.role}→${r.agent}`).join(", ")}`);
    }
    if (ctx.sessionDepth) {
        const d = ctx.sessionDepth;
        const depth = d.turnCount <= 2 ? "early" : d.turnCount <= 8 ? "mid" : "deep";
        lines.push(`Session: ${depth} (${d.turnCount} turns, ${d.messageCount} msgs${d.hasCompaction ? ", compacted" : ""})`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=agent-context.js.map