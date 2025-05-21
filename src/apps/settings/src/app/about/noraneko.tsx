import { Button } from "@/components/common/button.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/common/card.tsx";
import { SiGitlab } from "@icons-pack/react-simple-icons";
import { ExternalLink, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { useConstantsData } from "./dataManager";
import { useTranslation } from "react-i18next";
import type { ConstantsData } from "@/types/pref";

export default function Page() {
  const { t } = useTranslation();
  const [constantsData, setConstantsData] = useState<ConstantsData | null>(
    null,
  );

  useEffect(() => {
    async function fetchConstantsData() {
      const data = await useConstantsData();
      setConstantsData(data);
    }
    fetchConstantsData();
  }, []);

  return (
    <div className="p-6 space-y-3">
      <div className="flex flex-col items-start pl-6">
        <h1 className="text-3xl font-bold mb-2">{t("about.aboutBrowser")}</h1>
        <p className="text-sm mb-8">{t("about.browserDescription")}</p>
      </div>

      <div className="flex flex-col gap-8 pl-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("about.versionInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <img
                src="chrome://branding/content/about-logo@2x.png"
                alt="Browser Logo"
                className="w-11 h-11"
              />
              <p className="text-xl">
                {t("about.browserVersion", {
                  browserVersion: constantsData?.MOZ_APP_VERSION_DISPLAY ?? "unknown",
                  firefoxVersion: constantsData?.MOZ_APP_VERSION ?? "unknown",
                })}
              </p>
            </div>
            <p>
              FireDragon is based on the excellent Floorp browser, featuring opinionated presets with a focus on privacy and speed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.license")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-base-content/90">
                {t("about.copyright")}
              </p>
              <p className="text-sm text-base-content/70">
                {t("about.openSourceLicense")}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start space-y-2">
            <Button asChild className="w-full">
              <a
                href="about:license"
                target="_blank"
                className="flex items-center gap-2"
                rel="noreferrer"
              >
                <Scale className="size-4" />
                {t("about.openSourceLicenseNotice")}
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button asChild className="w-full">
              <a
                href="https://gitlab.com/garuda-linux/firedragon/firedragon12"
                target="_blank"
                className="flex items-center gap-2"
                rel="noreferrer"
              >
                <SiGitlab className="size-4" />
                GitLab Repository: garuda-linux/firedragon/firedragon12
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
