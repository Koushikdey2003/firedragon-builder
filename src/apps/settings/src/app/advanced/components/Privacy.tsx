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

export function Privacy() {
    const { t } = useTranslation();
    const { getValues, setValue } = useFormContext<AdvancedFormData>();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="size-5" />
                    {t('advanced.privacy.header')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="limit-cross-origin-referrers">
                            {t('advanced.privacy.limitCrossOriginReferrers')}
                        </label>
                        <Switch
                            id="limit-cross-origin-referrers"
                            checked={[1, 2].includes(getValues("xOriginPolicy"))}
                            onChange={(e) => {
                                setValue("xOriginPolicy", e.target.checked ? 2 : 0);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.privacy.limitCrossOriginReferrersDescription")}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
