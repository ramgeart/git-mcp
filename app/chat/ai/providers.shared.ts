export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}

// Custom LLM Provider Configuration
export interface CustomProviderConfig {
  id: string; // Unique identifier for the provider
  name: string; // Display name
  baseURL: string; // Base URL for the OpenAI-compatible API
  apiKey: string; // API key for authentication
  models: CustomModelInfo[]; // Available models from this provider
  enabled: boolean; // Whether this provider is active
}

// Model information from custom provider
export interface CustomModelInfo {
  id: string; // Model ID as returned by the API
  name?: string; // Display name (optional, defaults to id)
  description?: string; // Model description
  capabilities?: string[]; // Model capabilities
}

export type StorageKey =
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "GROQ_API_KEY"
  | "XAI_API_KEY";

export type modelID =
  | "gpt-4.1-mini"
  | "claude-3-7-sonnet"
  | "qwen-qwq"
  | "grok-3-mini"
  | string; // Allow custom model IDs

export const builtInModelDetails: Record<string, ModelInfo> = {
  "gpt-4.1-mini": {
    provider: "OpenAI",
    name: "GPT-4.1 Mini",
    description:
      "Compact version of OpenAI's GPT-4.1 with good balance of capabilities, including vision.",
    apiVersion: "gpt-4.1-mini",
    capabilities: ["Balance", "Creative", "Vision"],
  },
  "claude-3-7-sonnet": {
    provider: "Anthropic",
    name: "Claude 3.7 Sonnet",
    description:
      "Latest version of Anthropic's Claude 3.7 Sonnet with strong reasoning and coding capabilities.",
    apiVersion: "claude-3-7-sonnet-20250219",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
  "qwen-qwq": {
    provider: "Groq",
    name: "Qwen QWQ",
    description:
      "Latest version of Alibaba's Qwen QWQ with strong reasoning and coding capabilities.",
    apiVersion: "qwen-qwq",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
  "grok-3-mini": {
    provider: "XAI",
    name: "Grok 3 Mini",
    description:
      "Latest version of XAI's Grok 3 Mini with strong reasoning and coding capabilities.",
    apiVersion: "grok-3-mini-latest",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
};

// Helper function to get all model details including custom providers
export function getAllModelDetails(
  customProviders: CustomProviderConfig[] = [],
): Record<string, ModelInfo> {
  const allModels = { ...builtInModelDetails };

  // Add models from enabled custom providers
  customProviders
    .filter((provider) => provider.enabled)
    .forEach((provider) => {
      provider.models.forEach((model) => {
        allModels[model.id] = {
          provider: provider.name,
          name: model.name || model.id,
          description: model.description || `Model from ${provider.name}`,
          apiVersion: model.id,
          capabilities: model.capabilities || ["Custom"],
        };
      });
    });

  return allModels;
}

// Get list of all model IDs
export function getAllModelIds(
  customProviders: CustomProviderConfig[] = [],
): string[] {
  const modelDetails = getAllModelDetails(customProviders);
  return Object.keys(modelDetails);
}

// Legacy exports for backward compatibility
export const modelDetails = builtInModelDetails;
export const MODELS = Object.keys(builtInModelDetails);

export const defaultModel: modelID = "qwen-qwq";
