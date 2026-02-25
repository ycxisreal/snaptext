export type ActionType = "summarize" | "comment" | "rebut" | "expand";

export interface AIRecord {
  id: string;
  action: ActionType;
  inputText: string;
  outputText: string;
  url: string;
  pageTitle: string;
  timestamp: number;
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface RuntimeMessage {
  type:
    | "get-selection"
    | "selection-result"
    | "open-popup"
    | "records-updated";
  payload?: unknown;
}
