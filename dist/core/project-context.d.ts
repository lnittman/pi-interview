/**
 * Lightweight project context for pi-quiz.
 *
 * Instead of prompt-suggester's heavy agentic seeding loop,
 * we do a fast one-shot scan: package.json + git status + cwd name.
 * Gives the model just enough project awareness to generate grounded questions.
 */
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
/**
 * Build a fast project snapshot from cwd.
 * Designed to complete in <500ms.
 */
export declare function buildProjectSnapshot(cwd: string): Promise<ProjectSnapshot>;
/**
 * Format project snapshot as a compact string for the prompt.
 */
export declare function formatProjectContext(snapshot: ProjectSnapshot): string;
//# sourceMappingURL=project-context.d.ts.map