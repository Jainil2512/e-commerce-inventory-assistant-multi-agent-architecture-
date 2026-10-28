import { ChatOpenAI } from "@langchain/openai";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Did you copy .env.example to .env?`
    );
  }
  return value;
}

/**
 * Builds the shared LLM client (OpenRouter, OpenAI-compatible).
 * Every agent imports this instead of constructing its own client,
 * so the model/provider can be swapped in one place.
 */
export function getModel() {
  const apiKey = getRequiredEnv("OPENROUTER_API_KEY");
  const baseURL = getRequiredEnv("OPENROUTER_BASE_URL");
  const model = getRequiredEnv("OPENROUTER_MODEL");

  return new ChatOpenAI({
    apiKey,
    model,
    configuration: { baseURL },
  });
}