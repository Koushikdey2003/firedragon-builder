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

export function Network() {
    const { t } = useTranslation();
    const { getValues, setValue } = useFormContext();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="size-5" />
                    {t('advanced.network.header')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <label htmlFor="enable-ipv6">
                        {t('advanced.network.enableIPv6')}
                    </label>
                    <Switch
                        id="enable-ipv6"
                        checked={getValues("enableIPv6")}
                        onChange={(e) => {
                            setValue("enableIPv6", e.target.checked);
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
