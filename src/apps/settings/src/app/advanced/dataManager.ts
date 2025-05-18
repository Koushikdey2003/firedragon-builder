import { rpc } from "../../lib/rpc/rpc.ts";
import { type AdvancedFormData } from "../../types/pref.ts";

export async function saveAdvancedSettings(
    settings: AdvancedFormData,
): Promise<null | void> {
    await Promise.all([
        rpc.setBoolPref(
            'identity.fxaccounts.enabled',
            Boolean(settings.enableSync),
        ),
        rpc.setBoolPref(
            'toolkit.legacyUserProfileCustomizations.stylesheets',
            Boolean(settings.allowUserChromeCss),
        ),
        rpc.setBoolPref(
            'network.dns.disableIPv6',
            !Boolean(settings.enableIPv6)
        ),
    ]);
}

export async function getAdvancedSettings(): Promise<
    AdvancedFormData | null
> {
    const [
        enableSync,
        allowUserChromeCss,
        enableIPv6,
    ] = await Promise.all([
        rpc.getBoolPref('identity.fxaccounts.enabled'),
        rpc.getBoolPref('toolkit.legacyUserProfileCustomizations.stylesheets'),
        rpc.getBoolPref('network.dns.disableIPv6').then(value => !value),
    ]);

    return {
        enableSync,
        allowUserChromeCss,
    };
}
