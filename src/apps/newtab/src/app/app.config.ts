import { provideHttpClient } from "@angular/common/http";
import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideExperimentalZonelessChangeDetection,
} from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideGarudaNG } from "@garudalinux/core";
import { APP_CONFIG } from "../environments/app-config.token";
import { environment } from "../environments/environment.dev";
import { TranslocoHttpLoader } from "./transloco-loader";
import { provideTransloco, provideTranslocoLoader } from "@jsverse/transloco";
import { ConfigService } from "../config/config.service";

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    provideGarudaNG(
      { font: "InterVariable" },
      {
        theme: {
          options: {
            darkModeSelector: ".p-dark",
          },
        },
        ripple: true,
        inputStyle: "outlined",
      },
    ),
    provideExperimentalZonelessChangeDetection(),
    provideHttpClient(),
    provideAppInitializer(async () => {
      const configService = inject(ConfigService);
      while (!configService.initialized()) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 0);
        });
      }
    }),
    provideTransloco({
      config: {
        availableLangs: environment.availableLanguages,
        defaultLang: environment.defaultLanguage,
        fallbackLang: environment.defaultLanguage,
        missingHandler: {
          useFallbackTranslation: true,
        },
        prodMode: !isDevMode(),
        reRenderOnLangChange: true,
      },
    }),
    provideTranslocoLoader(TranslocoHttpLoader),
    { provide: APP_CONFIG, useValue: environment },
  ],
};
