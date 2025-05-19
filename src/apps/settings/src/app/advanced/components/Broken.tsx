import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/common/card.tsx";
import { Switch } from "@/components/common/switch.tsx";
import { useFormContext } from "react-hook-form";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdvancedFormData } from "@/types/pref.ts";

export function Broken() {
    const { t } = useTranslation();
    const { getValues, setValue } = useFormContext<AdvancedFormData>();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="size-5" />
                    {t('advanced.broken.header')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="enable-rfp">
                            {t('advanced.broken.enableRFP')}
                        </label>
                        <Switch
                            id="enable-rfp"
                            checked={getValues("enableRFP")}
                            onChange={(e) => {
                                setValue("enableRFP", e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.broken.enableRFPDescription")}
                    </div>
                </div>
                <div className="space-y-1 ps-9">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="enable-letterboxing">
                            {t('advanced.broken.enableLetterboxing')}
                        </label>
                        <Switch
                            id="enable-letterboxing"
                            checked={getValues("enableLetterboxing")}
                            onChange={(e) => {
                                setValue("enableLetterboxing", e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.broken.enableLetterboxingDescription")}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="enable-webgl">
                            {t('advanced.broken.enableWebGL')}
                        </label>
                        <Switch
                            id="enable-webgl"
                            checked={!getValues("disableWebGL")}
                            onChange={(e) => {
                                setValue("disableWebGL", !e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.broken.enableWebGLDescription")}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
