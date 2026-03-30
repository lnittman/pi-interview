/**
 * Model client for pi-interview.
 * Uses getApiKeyAndHeaders (correct pi API).
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
import type {
  QuizResult,
  QuizQuestion,
  QuizConfig,
  TokenUsage,
} from "../core/types.js";
import type { QuizPromptContext } from "../prompts/interview-template.js";
import { renderQuizPrompt } from "../prompts/interview-template.js";

type CompleteSimpleFn = typeof completeSimple;

interface RuntimeProvider {
  getContext(): ExtensionContext | undefined;
}

function resolveModel(
  ctx: ExtensionContext,
  configuredModelRef: string
): Model<any> | undefined {
  const allModels = ctx.modelRegistry.getAll();

  if (configuredModelRef && configuredModelRef !== "session-default") {
    const [provider, id] = configuredModelRef.split("/");
    const found = allModels.find(
      (m) => m.provider === provider && m.id === id
    );
    if (found) return found;
    const byId = allModels.find((m) => m.id === configuredModelRef);
    if (byId) return byId;
  }

  return ctx.model;
}

function parseQuizResponse(
  text: string,
  maxQuestions: number,
  maxOptions: number
): QuizResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { questions: [], skipped: true, skipReason: "Failed to parse response" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.skipped === true) {
      return {
        questions: [],
        skipped: true,
        skipReason: parsed.skipReason || "Model chose to skip",
      };
    }

    if (!Array.isArray(parsed.questions)) {
      return { questions: [], skipped: true, skipReason: "No questions array" };
    }

    const questions: QuizQuestion[] = parsed.questions
      .slice(0, maxQuestions)
      .map((q: any, i: number) => ({
        id: q.id || `q${i + 1}`,
        text: String(q.text || "").slice(0, 120),
        // Always multi — user picks one or more with checkboxes
        type: "multi" as const,
        options: Array.isArray(q.options)
          ? q.options.slice(0, maxOptions).map((o: any) => ({
              label: String(o.label || "").slice(0, 80),
              description: o.description
                ? String(o.description).slice(0, 100)
                : undefined,
            }))
          : [],
      }))
      .filter(
        (q: QuizQuestion) => q.text.length > 0 && q.options.length >= 2
      );

    return {
      questions,
      skipped: questions.length === 0,
      skipReason: questions.length === 0 ? "No valid questions generated" : undefined,
    };
  } catch {
    return { questions: [], skipped: true, skipReason: "JSON parse error" };
  }
}

export class QuizModelClient {
  private runtime: RuntimeProvider;
  private completeFn: CompleteSimpleFn;

  constructor(runtime: RuntimeProvider, completeFn: CompleteSimpleFn) {
    this.runtime = runtime;
    this.completeFn = completeFn;
  }

  async generateQuiz(
    promptContext: QuizPromptContext,
    config: QuizConfig
  ): Promise<QuizResult> {
    const ctx = this.runtime.getContext();
    if (!ctx?.model) {
      return { questions: [], skipped: true, skipReason: "No model available" };
    }

    const model = resolveModel(ctx, config.model);
    if (!model) {
      return { questions: [], skipped: true, skipReason: "Configured model not found" };
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) {
      return { questions: [], skipped: true, skipReason: `Auth failed: ${auth.error}` };
    }

    const prompt = renderQuizPrompt(promptContext);

    try {
      const response: AssistantMessage = await this.completeFn(
        model,
        {
          systemPrompt:
            "You generate multi-select interview questions for a coding agent session. The user sees checkboxes and can pick multiple options plus add notes. Return ONLY valid JSON. Ground every option in specific files, errors, tools, and skills from the context. Never generic.",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          reasoning:
            config.thinkingLevel === "off" ? undefined : config.thinkingLevel,
        }
      );

      const text = response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const usage: TokenUsage | undefined = response.usage
        ? {
            inputTokens: response.usage.input ?? 0,
            outputTokens: response.usage.output ?? 0,
            totalTokens: response.usage.totalTokens ?? 0,
            costTotal: response.usage.cost?.total ?? 0,
          }
        : undefined;

      const result = parseQuizResponse(text, config.maxQuestions, config.maxOptions);
      result.usage = usage;
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        questions: [],
        skipped: true,
        skipReason: `Generation failed: ${msg.slice(0, 100)}`,
      };
    }
  }
}
