import { NgClass, NgOptimizedImage } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  type OnInit,
  Renderer2,
  signal,
} from "@angular/core";
import { ScrollTop } from "primeng/scrolltop";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import { firstValueFrom } from "rxjs";
import { MessageToastService, ShellComponent } from "@garudalinux/core";
import { ConfigService } from "../config/config.service";
import { menubarItems } from "../config";
import type { MenuBarLink } from "./types";
import { Avatar } from "primeng/avatar";
import type { ToastMessageOptions } from "primeng/api";
import { HomeComponent } from "./home/home.component";
import { SettingsComponent } from "./settings/settings.component";
import {
  DialogService,
  DynamicDialogModule,
  DynamicDialogRef,
} from "primeng/dynamicdialog";

@Component({
  imports: [
    NgOptimizedImage,
    ScrollTop,
    DynamicDialogModule,
    ShellComponent,
    TranslocoDirective,
    Avatar,
    NgClass,
    HomeComponent,
    SettingsComponent,
  ],
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DialogService, MessageToastService],
})
export class AppComponent implements OnInit {
  ref: DynamicDialogRef | undefined;
  items = signal<MenuBarLink[]>(menubarItems);

  protected readonly configService = inject(ConfigService);

  logoLink = computed(() => {
    if (this.configService.settings().logo === "custom") {
      return this.configService.settings().logoUrl;
    }
    if (this.configService.settings().logo === "none") {
      return this.configService.settings().logo;
    }
    return "chrome://branding/content/about-logo.png";
  });

  private readonly dialogService = inject(DialogService);
  private readonly el = inject(ElementRef);
  private readonly messageToastService = inject(MessageToastService);
  private readonly renderer = inject(Renderer2);
  private readonly translocoService = inject(TranslocoService);

  welcomeText = computed<string>(() => {
    const user: string = this.configService.settings().username !== ""
      ? this.configService.settings().username
      : this.translocoService.translate("menu.defaultUser");
    if (this.configService.settings().welcomeText !== "") {
      return `${this.configService.settings().welcomeText} ${user}!`;
    }
    return this.translocoService.translate("menu.welcome", { user });
  });

  async ngOnInit(): Promise<void> {
    void this.setupLabels(this.translocoService.getActiveLang());

    this.translocoService.langChanges$.subscribe((lang) => {
      void this.setupLabels(lang);
    });

    while (!this.configService.initialized()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.configService.initConfig(this.renderer, this.el);
  }

  /**
   * Set up the labels for the menu bar items
   * @param lang The language to set the labels for
   */
  async setupLabels(lang: string): Promise<void> {
    const newItemPromises = [];
    for (const item of this.items()) {
      if (item.translocoKey) {
        newItemPromises.push(
          firstValueFrom(
            this.translocoService.selectTranslate(
              item["translocoKey"],
              {},
              lang,
            ),
          ),
        );
      } else {
        newItemPromises.push(
          firstValueFrom(
            this.translocoService.selectTranslate(item["label"], {}, lang),
          ),
        );
      }
    }

    const results: string[] = await Promise.all(newItemPromises);
    const newItems = [];

    for (const [index, item] of this.items().entries()) {
      newItems.push({ ...item, label: results[index] });
    }

    this.items.set(newItems);
  }

  /**
   * Display an easter egg message ;)
   */
  displayEasterEgg() {
    const oneToSix: number = Math.floor(Math.random() * 5) + 1;
    const oneToTwenty: number = Math.floor(Math.random() * 20) + 1;

    const title: string = this.translocoService.translate(
      `easterEggs.easterEgg${oneToTwenty}.title`,
    );
    const content: string = this.translocoService.translate(
      `easterEggs.easterEgg${oneToTwenty}.content`,
    );
    const options: ToastMessageOptions = {
      sticky: true,
      life: 10000,
      icon: "pi pi-spinner pi-spin",
    };

    switch (oneToSix) {
      case 1:
        this.messageToastService.info(title, content, "top-center", options);
        break;
      case 2:
        this.messageToastService.error(title, content, "top-center", options);
        break;
      case 3:
        this.messageToastService.success(title, content, "top-center", options);
        break;
      case 4:
        this.messageToastService.warn(title, content, "top-center", options);
        break;
      case 5:
        this.messageToastService.secondary(
          title,
          content,
          "top-center",
          options,
        );
        break;
    }
  }

  /**
   * Open the home component in a dialog
   */
  openSettings() {
    this.ref = this.dialogService.open(SettingsComponent, {
      header: this.translocoService.translate("menu.settings"),
      width: "90%",
      contentStyle: { overflow: "auto" },
      baseZIndex: 10000,
      maximizable: true,
      closeOnEscape: true,
      dismissableMask: true,
      closable: true,
      resizable: true,
      draggable: true,
    });
  }
}
