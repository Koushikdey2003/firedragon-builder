declare global {
  export function NRGetCurrentTopSites(callback: (value: string) => void): void;
}

export interface TopPage {
  bookmarkGuid: string | null;
  frecency: number;
  guid: string;
  hostname: string;
  lastVisitDate: number;
  screenshot: string;
  title: string;
  type: "history" | "bookmark";
  typedBonus: boolean;
  url: string;
}
