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
export interface AgentContext {
    /** Rule names with summaries — for suggesting which rules apply */
    rules: {
        name: string;
        summary: string;
        triggers: string[];
    }[];
    /** Skill names with descriptions — for suggesting skill invocation */
    skills: {
        name: string;
        description: string;
        triggers: string[];
    }[];
    /** Projects with rich metadata — for cross-project awareness */
    projects: {
        name: string;
        emoji?: string;
        team?: string;
        surfaces?: string[];
        frameworks?: string[];
    }[];
    /** Role→agent mapping — for suggesting delegation */
    roles: {
        role: string;
        agent: string;
        model: string;
    }[];
    /** Current cwd project match (if any) */
    currentProject?: string;
}
/**
 * Build agent context from ~/.agents. Fast and non-critical.
 */
export declare function buildAgentContext(cwd?: string): Promise<AgentContext | null>;
/**
 * Format agent context for the prompt — structured for question generation.
 */
export declare function formatAgentContext(ctx: AgentContext): string;
//# sourceMappingURL=agent-context.d.ts.map