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

export function Security() {
    const { t } = useTranslation();
    const { getValues, setValue } = useFormContext<AdvancedFormData>();

    function getGoogleSafeBrowsingValues() {
        const {
            enableSafebrowsingMalware,
            enableSafebrowsingPhishing,
            enableSafebrowsingBlockedURIs,
            safebrowsingProviderGoogle4GethashURL,
            safebrowsingProviderGoogle4UpdateURL,
            safebrowsingProviderGoogleGethashURL,
            safebrowsingProviderGoogleUpdateURL,
        } = getValues();
        console.log({
            enableSafebrowsingMalware,
            enableSafebrowsingPhishing,
            enableSafebrowsingBlockedURIs,
            safebrowsingProviderGoogle4GethashURL,
            safebrowsingProviderGoogle4UpdateURL,
            safebrowsingProviderGoogleGethashURL,
            safebrowsingProviderGoogleUpdateURL,
        });
        return enableSafebrowsingMalware && enableSafebrowsingPhishing && enableSafebrowsingBlockedURIs
            && safebrowsingProviderGoogle4GethashURL === 'https://safebrowsing.googleapis.com/v4/fullHashes:find?$ct=application/x-protobuf&key=%GOOGLE_SAFEBROWSING_API_KEY%&$httpMethod=POST'
            && safebrowsingProviderGoogle4UpdateURL === 'https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch?$ct=application/x-protobuf&key=%GOOGLE_SAFEBROWSING_API_KEY%&$httpMethod=POST'
            && safebrowsingProviderGoogleGethashURL === 'https://safebrowsing.google.com/safebrowsing/gethash?client=SAFEBROWSING_ID&appver=%MAJOR_VERSION%&pver=2.2'
            && safebrowsingProviderGoogleUpdateURL === 'https://safebrowsing.google.com/safebrowsing/downloads?client=SAFEBROWSING_ID&appver=%MAJOR_VERSION%&pver=2.2&key=%GOOGLE_SAFEBROWSING_API_KEY%';
    }
    function setGoogleSafeBrowsingValues(checked: boolean) {
        setValue('enableSafebrowsingMalware', checked);
        setValue('enableSafebrowsingPhishing', checked);
        setValue('enableSafebrowsingBlockedURIs', checked);
        setValue('safebrowsingProviderGoogle4GethashURL', checked ? 'https://safebrowsing.googleapis.com/v4/fullHashes:find?$ct=application/x-protobuf&key=%GOOGLE_SAFEBROWSING_API_KEY%&$httpMethod=POST' : '')
        setValue('safebrowsingProviderGoogle4UpdateURL', checked ? 'https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch?$ct=application/x-protobuf&key=%GOOGLE_SAFEBROWSING_API_KEY%&$httpMethod=POST' : '')
        setValue('safebrowsingProviderGoogleGethashURL', checked ? 'https://safebrowsing.google.com/safebrowsing/gethash?client=SAFEBROWSING_ID&appver=%MAJOR_VERSION%&pver=2.2' : '')
        setValue('safebrowsingProviderGoogleUpdateURL', checked ? 'https://safebrowsing.google.com/safebrowsing/downloads?client=SAFEBROWSING_ID&appver=%MAJOR_VERSION%&pver=2.2&key=%GOOGLE_SAFEBROWSING_API_KEY%' : '')
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="size-5" />
                    {t('advanced.security.header')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="enforce-ocsp">
                            {t('advanced.security.enforceOCSP')}
                        </label>
                        <Switch
                            id="enforce-ocsp"
                            checked={getValues("enforceOCSP")}
                            onChange={(e) => {
                                setValue("enforceOCSP", e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.security.enforceOCSPDescription")}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="enable-google-safe-browsing">
                            {t('advanced.security.enableGoogleSafeBrowsing')}
                        </label>
                        <Switch
                            id="enable-google-safe-browsing"
                            checked={getGoogleSafeBrowsingValues()}
                            onChange={(e) => {
                                setGoogleSafeBrowsingValues(e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.security.enableGoogleSafeBrowsingDescription")}
                    </div>
                </div>
                <div className="space-y-1 ps-9">
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor="scan-downloads">
                            {t('advanced.security.enableSafebrowsingDownloads')}
                        </label>
                        <Switch
                            id="enable-safebrowsing-downloads"
                            checked={getValues("enableSafebrowsingDownloads")}
                            onChange={(e) => {
                                setValue("enableSafebrowsingDownloads", e.target.checked);
                            }}
                        />
                    </div>
                    <div className="text-sm text-base-content/70">
                        {t("advanced.security.enableSafebrowsingDownloadsDescription")}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
