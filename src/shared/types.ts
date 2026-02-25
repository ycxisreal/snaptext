export type ActionType = "summarize" | "comment" | "rebut" | "expand";

export interface AIRecord {
  id: string;
  action: ActionType;
  inputText: string;
  outputText: string;
  url: string;
  pageTitle: string;
  timestamp: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface RuntimeMessage {
  type:
    | "get-selection"
    | "selection-result"
    | "open-popup"
    | "records-updated"
    | "error";
  payload?: unknown;
}
