import { provideHttpClient, withFetch } from "@angular/common/http";
import {
    ApplicationConfig,
    //  provideBrowserGlobalErrorListeners,
    provideZoneChangeDetection,
} from "@angular/core";
import {
    provideClientHydration,
    withEventReplay,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
    providers: [
        //    provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideHttpClient(
            withFetch(),
        ),
        provideClientHydration(withEventReplay()),
    ],
};
