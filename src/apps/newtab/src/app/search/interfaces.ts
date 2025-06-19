export interface SearchEngine {
  aliases: string[];
  iconURL?: string | null;
  id: string;
  isDefault: boolean;
  name: string;
  searchUrl: string;
}

export interface SuggestionsSuccess {
  success: true;
  suggestions: string[];
}

export interface SuggestionsError {
  success: false;
  error: string;
}

export type Suggestions = SuggestionsSuccess | SuggestionsError;

declare global {
  export function NRGetDefaultEngine(callback: (value: string) => void): void;
  export function NRGetSuggestions(
    query: string,
    engineId: string,
    callback: (value: string) => void,
  ): void;
}
