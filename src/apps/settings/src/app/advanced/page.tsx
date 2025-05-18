import React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getAdvancedSettings, saveAdvancedSettings } from "./dataManager.ts";
import type { AdvancedFormData } from "@/types/pref.ts";
import { General } from './components/General.tsx';
import { Network } from './components/Network.tsx';


export default function Page() {
  const { t } = useTranslation();
  const methods = useForm<AdvancedFormData>({});

  const { control, setValue } = methods;
  const watchAll = useWatch({ control });

  React.useEffect(() => {
    const fetchDefaultValues = async () => {
      const values = await getAdvancedSettings();
      if (!values) return;

      for (const key in values) {
        setValue(key as keyof AdvancedFormData, values[key], {
          shouldValidate: true,
        });
      }
    };

    fetchDefaultValues();
    window.addEventListener("focus", fetchDefaultValues);
    return () => {
      window.removeEventListener("focus", fetchDefaultValues);
    };
  }, [setValue]);

  React.useEffect(() => {
    if (Object.keys(watchAll).length === 0) return;

    try {
      saveAdvancedSettings(watchAll);
    } catch (error) {
      globalThis.console?.error("Failed to save workspace settings:", error);
    }
  }, [watchAll]);

  return (
    <div className="p-6 space-y-3">
      <div className="flex flex-col items-start pl-6">
        <h1 className="text-3xl font-bold mb-2">
          {t('advanced.header')}
        </h1>
        <p className="text-sm mb-8">{t('advanced.description')}</p>
      </div>

      <FormProvider {...methods}>
        <form className="space-y-3 pl-6">
          <General />
          <Network />
        </form>
      </FormProvider>
    </div>
  );
}
