/**
 * Demo turn contexts for testing pi-quiz without a real agent session.
 * Used by /quiz demo command.
 */

import type { TurnContext } from "./types.js";

export const DEMO_TURNS: Record<string, TurnContext> = {
  /** Agent just built something and finished */
  build: {
    turnId: "demo-build",
    sourceLeafId: "demo-build",
    assistantText: `I've implemented the authentication module with JWT token refresh. Created src/auth/jwt.ts with token generation and validation, updated src/middleware/auth.ts to use the new JWT flow, and added tests in src/auth/__tests__/jwt.test.ts. All 12 existing tests pass, but the 3 new token refresh tests are failing because the mock Redis client doesn't support TTL operations. The linting also shows 2 warnings in auth.ts about unused imports from the old session-based auth that I didn't remove yet.`,
    status: "success",
    occurredAt: new Date().toISOString(),
    recentUserPrompts: [
      "implement JWT auth with token refresh",
      "yes, use the existing middleware pattern",
    ],
    toolSignals: [
      "write(src/auth/jwt.ts)",
      "edit(src/middleware/auth.ts)",
      "write(src/auth/__tests__/jwt.test.ts)",
      "bash(npm test)",
      "bash(npm run lint)",
    ],
    touchedFiles: [
      "src/auth/jwt.ts",
      "src/middleware/auth.ts",
      "src/auth/__tests__/jwt.test.ts",
    ],
    unresolvedQuestions: [],
  },

  /** Agent hit errors */
  error: {
    turnId: "demo-error",
    sourceLeafId: "demo-error",
    assistantText: `I tried to run the migration but hit an error. The database connection to the staging environment timed out after 30s. The migration file packages/db/migrations/003_add_user_roles.sql looks correct syntactically, but the connection string in .env.staging might be stale — the last successful connection was 3 days ago. I also noticed the docker-compose.staging.yml has the old port mapping (5432:5432) while the staging DB was moved to port 5433 last week.`,
    status: "error",
    occurredAt: new Date().toISOString(),
    recentUserPrompts: [
      "run the staging migration",
      "use the new roles table schema",
    ],
    toolSignals: [
      "read(packages/db/migrations/003_add_user_roles.sql)",
      "read(.env.staging)",
      "bash(npx knex migrate:latest --env staging):error",
      "read(docker-compose.staging.yml)",
    ],
    touchedFiles: [],
    unresolvedQuestions: [],
  },

  /** Agent was interrupted */
  aborted: {
    turnId: "demo-aborted",
    sourceLeafId: "demo-aborted",
    assistantText: `I was in the middle of refactoring the notification service. So far I've split src/services/notifications.ts into three files: src/services/notifications/email.ts, src/services/notifications/push.ts, and src/services/notifications/index.ts. The email module is complete but push notifications are half-done — I was updating the Firebase config when you interrupted. The old monolithic file still exists and the imports in src/api/routes/alerts.ts and src/workers/digest.ts still point to it.`,
    status: "aborted",
    occurredAt: new Date().toISOString(),
    recentUserPrompts: [
      "refactor the notification service into separate modules",
    ],
    toolSignals: [
      "write(src/services/notifications/email.ts)",
      "write(src/services/notifications/push.ts)",
      "write(src/services/notifications/index.ts)",
      "read(src/services/notifications.ts)",
      "edit(src/services/notifications/push.ts)",
    ],
    touchedFiles: [
      "src/services/notifications/email.ts",
      "src/services/notifications/push.ts",
      "src/services/notifications/index.ts",
    ],
    unresolvedQuestions: [],
    abortContextNote:
      "User interrupted mid-refactor. Push notification module is incomplete, old file still exists, imports not updated.",
  },

  /** Agent asked questions */
  questions: {
    turnId: "demo-questions",
    sourceLeafId: "demo-questions",
    assistantText: `I've analyzed the codebase and have a few questions before proceeding with the API redesign:

1. The current REST endpoints in src/api/v1/ use Express middleware chains. Should we keep Express or migrate to Hono for the v2 API?
2. The auth tokens are currently stored in Redis with a 24h TTL. Should v2 tokens use shorter TTLs with refresh, or keep the current approach?
3. There are 47 endpoints total. Should we migrate all at once, or start with the 12 high-traffic endpoints in src/api/v1/core/?
4. The OpenAPI spec in docs/api.yaml is 6 months stale. Should I regenerate it as part of this work?`,
    status: "success",
    occurredAt: new Date().toISOString(),
    recentUserPrompts: [
      "let's redesign the API for v2",
      "focus on performance and developer experience",
    ],
    toolSignals: [
      "bash(find src/api -name '*.ts' | wc -l)",
      "read(src/api/v1/core/users.ts)",
      "read(docs/api.yaml)",
      "outline(src/api/)",
    ],
    touchedFiles: [],
    unresolvedQuestions: [
      "Should we keep Express or migrate to Hono for the v2 API?",
      "Should v2 tokens use shorter TTLs with refresh, or keep the current approach?",
      "Should we migrate all at once, or start with the 12 high-traffic endpoints in src/api/v1/core/?",
      "Should I regenerate the OpenAPI spec in docs/api.yaml as part of this work?",
    ],
  },
};

export function getDemoTurn(scenario?: string): TurnContext {
  if (scenario && scenario in DEMO_TURNS) {
    return DEMO_TURNS[scenario];
  }
  // Random demo
  const keys = Object.keys(DEMO_TURNS);
  return DEMO_TURNS[keys[Math.floor(Math.random() * keys.length)]];
}

export function listDemoScenarios(): string[] {
  return Object.keys(DEMO_TURNS);
}
