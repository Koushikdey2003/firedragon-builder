import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { CommonModule, NgOptimizedImage } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslocoDirective } from "@jsverse/transloco";
import { ConfigService } from "../../config/config.service";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import {
  AutoComplete,
  type AutoCompleteCompleteEvent,
} from "primeng/autocomplete";
import type { SearchEngine, Suggestions } from "./interfaces";

@Component({
  selector: "app-search",
  imports: [
    CommonModule,
    FormsModule,
    NgOptimizedImage,
    TranslocoDirective,
    Button,
    AutoComplete,
  ],
  templateUrl: "./search.component.html",
  styleUrl: "./search.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  searchEngine = signal<SearchEngine | null>(null);
  searchTerm = signal<string>("");
  suggestions = signal<any[]>([]);

  protected readonly configService = inject(ConfigService);
  logoSource = computed(() => {
    if (this.configService.settings().logo === "custom") {
      return this.configService.settings().logoUrl;
    } else if (this.configService.settings().logo === "none") {
      return this.configService.settings().logo;
    } else {
      return "chrome://branding/content/about-logo.png";
    }
  });

  ngOnInit(): void {
    NRGetDefaultEngine((value) => {
      this.searchEngine.set(JSON.parse(value));
    });
  }

  /**
   * Open the search engine URL in a new tab with the search term.
   */
  search() {
    location.href = this.searchEngine()?.searchUrl +
      encodeURIComponent(this.searchTerm());

    this.searchTerm.set("");
    this.suggestions.set([]);
  }

  /**
   * Handle the autocomplete event and update the suggestions.
   * @param $event The autocomplete event.
   */
  autocomplete($event: AutoCompleteCompleteEvent) {
    const searchEngine = this.searchEngine();
    if (searchEngine) {
      NRGetSuggestions(this.searchTerm(), searchEngine.id, (value) => {
        const suggestions: Suggestions = JSON.parse(value);
        if (suggestions.success) {
          this.suggestions.set(suggestions.suggestions);
        } else {
          this.suggestions.set([]);
        }
      });
    } else {
      this.suggestions.set([]);
    }
  }
}
