import { DOMParser } from "linkedom";
import * as fs from "node:fs/promises";

export async function injectXHTML(binPath: string) {
  const path_browserxhtml =
    `${binPath}/browser/chrome/browser/content/browser/browser.xhtml`;
  {
    const document = new DOMParser().parseFromString(
      (await fs.readFile(path_browserxhtml)).toString(),
      "text/xml",
    );

    for (const elem of document.querySelectorAll("[data-geckomixin]")) {
      elem.remove();
    }

    const scriptConfigs = [
      {
        src: "chrome://noraneko-startup/content/chrome_root.js",
      },
    ];

    for (const config of scriptConfigs) {
      const script = document.createElement("script");
      script.setAttribute("type", "module");
      script.setAttribute("src", config.src);
      script.setAttribute("async", "async");
      script.dataset.geckomixin = "";

      document.querySelector("head").appendChild(script);
    }

    const meta = document.querySelector(
      "meta[http-equiv='Content-Security-Policy']",
    ) as HTMLMetaElement;
    meta?.setAttribute(
      "content",
      "script-src chrome: moz-src: resource: http://localhost:* 'report-sample'",
    );

    await fs.writeFile(path_browserxhtml, document.toString());
  }
}

export async function injectXHTMLDev(binPath: string) {
  const path_preferencesxhtml =
    `${binPath}/browser/chrome/browser/content/browser/preferences/preferences.xhtml`;
  {
    const document = new DOMParser().parseFromString(
      (await fs.readFile(path_preferencesxhtml)).toString(),
      "text/xml",
    );

    const meta = document.querySelector("meta") as HTMLMetaElement;
    meta.setAttribute(
      "content",
      `default-src chrome: http://localhost:* ws://localhost:*; img-src chrome: moz-icon: https: blob: data:; style-src chrome: data: 'unsafe-inline'; object-src 'none'`,
    );

    await fs.writeFile(path_preferencesxhtml, document.toString());
  }

  // const path_page_html_template = `${binPath}/browser/chrome/browser/res/activity-stream/data/content/abouthomecache/page.html.template`;
  // {
  //   const document = new DOMParser().parseFromString(
  //     (await fs.readFile(path_page_html_template)).toString(),
  //     "text/html",
  //   );

  //   const div = document.createElement("div", {}) as unknown as HTMLDivElement;
  //   div.textContent = "hello";
  //   (document.querySelector("body") as HTMLBodyElement).appendChild(div);

  //   await fs.writeFile(path_page_html_template, document.toString());
  // }
}
