import type {
  MenuBarItems,
  ServiceLinks,
} from "../app/types";
import type { AvailableJokeSources } from "../app/jokes/jokes";
import type { AppTheme } from "../app/theme";

export interface AppSettings {
  activeJoke: AvailableJokeSources;
  activeTheme: AppTheme;
  avatarEnabled: boolean;
  avatarUrl: string;
  autoGridCols: boolean;
  blurBackground: boolean;
  blurStrength: 1 | 2 | 3 | 4;
  customLinks: ServiceLinks;
  customMenuLinks: MenuBarItems;
  customTitle: string;
  defaultLinks: boolean;
  darkMode: boolean;
  fitWallpaper: boolean;
  gridCols: number;
  jokesEnabled: boolean;
  language: string;
  languageChanged: boolean;
  logo: string;
  logoUrl: string;
  username: string;
  wallpaper: string;
  wallpaperUrl: string;
  welcomeText: string;

  [key: string]: any;
}
