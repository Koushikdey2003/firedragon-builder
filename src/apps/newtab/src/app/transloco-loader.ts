import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import type { Translation, TranslocoLoader } from "@jsverse/transloco";
import { of } from "rxjs";

@Injectable({ providedIn: "root" })
export class TranslocoHttpLoader implements TranslocoLoader {
  // private http = inject(HttpClient);

  getTranslation(lang: string) {
    return of({});
    // return this.http.get<Translation>(`/src/public/i18n/${lang}.json`);
  }
}
