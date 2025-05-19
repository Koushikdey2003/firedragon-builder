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
import { useState } from "react";
import { RestartModal } from "@/components/common/restart-modal.tsx";

export function General() {
    const { t } = useTranslation();
    const { getValues, setValue } = useFormContext<AdvancedFormData>();
    const [showEnableSyncRestartModal, setShowEnableSyncRestartModal] = useState(false);

    return (
        <>
            {showEnableSyncRestartModal ? (
                <RestartModal
                    onClose={() => setShowEnableSyncRestartModal(false)}
                    label={t("advanced.general.enableSyncNeedsRestartDescription")}
                />
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="size-5" />
                        {t('advanced.general.header')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="enable-extension-update">
                                {t('advanced.general.enableExtensionUpdate')}
                            </label>
                            <Switch
                                id="enable-extension-update"
                                checked={getValues("enableExtensionUpdate")}
                                onChange={(e) => {
                                    setValue("enableExtensionUpdate", e.target.checked);
                                    setValue("enableExtensionAutoUpdate", e.target.checked);
                                }}
                            />
                        </div>
                        <div className="text-sm text-base-content/70">
                            {t("advanced.general.enableExtensionUpdateDescription")}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="enable-sync">
                                {t('advanced.general.enableSync')}
                            </label>
                            <Switch
                                id="enable-sync"
                                checked={getValues("enableSync")}
                                onChange={(e) => {
                                    setValue("enableSync", e.target.checked);
                                    setShowEnableSyncRestartModal(true);
                                }}
                            />
                        </div>
                        <div className="text-sm text-base-content/70">
                            {t("advanced.general.enableSyncDescription")}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="enable-middlemouse-paste">
                                {t('advanced.general.enableMiddlemousePaste')}
                            </label>
                            <Switch
                                id="enable-middlemouse-paste"
                                checked={getValues("enableMiddlemousePaste")}
                                onChange={(e) => {
                                    setValue("enableClipboardAutocopy", e.target.checked);
                                    setValue("enableMiddlemousePaste", e.target.checked);
                                }}
                            />
                        </div>
                        <div className="text-sm text-base-content/70">
                            {t("advanced.general.enableMiddlemousePasteDescription")}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="allow-user-chrome-css">
                                {t('advanced.general.allowUserChromeCss')}
                            </label>
                            <Switch
                                id="allow-user-chrome-css"
                                checked={getValues("allowUserChromeCss")}
                                onChange={(e) => {
                                    setValue("allowUserChromeCss", e.target.checked);
                                }}
                            />
                        </div>
                        <div className="text-sm text-base-content/70">
                            {t("advanced.general.allowUserChromeCssDescription")}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
