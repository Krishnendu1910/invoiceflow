import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";
import { CURRENCIES, CURRENCY_MAP } from "../../../constants/currencies";

function normalizeDocuments(settings) {
  return {
    currency: {
      code: settings?.currency?.code || "INR",
      symbol: settings?.currency?.symbol || "₹",
    },
    discount: {
      type: settings?.documentDefaults?.discount?.type || "none",
      value: settings?.documentDefaults?.discount?.value ?? 0,
    },
    additionalCharges: Array.isArray(settings?.documentDefaults?.additionalCharges)
      ? settings.documentDefaults.additionalCharges
      : [],
    template: settings?.documentDefaults?.template || "standard",
    language: settings?.documentDefaults?.language || "en",
  };
}

export default function DocumentsTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeDocuments(settings));
  const [initialJson] = useState(() => JSON.stringify(normalizeDocuments(settings)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function handleCurrencyChange(code) {
    const found = CURRENCY_MAP.get(code);
    setForm((prev) => ({
      ...prev,
      currency: {
        code,
        symbol: found?.symbol || "₹",
      },
    }));
  }

  function handleDiscountChange(field, value) {
    setForm((prev) => ({
      ...prev,
      discount: {
        ...prev.discount,
        [field]: value,
      },
    }));
  }

  function handleAddCharge() {
    if (form.additionalCharges.length >= 10) return;
    setForm((prev) => ({
      ...prev,
      additionalCharges: [...prev.additionalCharges, { label: "Shipping", type: "fixed", value: 0 }],
    }));
  }

  function handleChargeChange(index, field, value) {
    setForm((prev) => {
      const nextCharges = [...prev.additionalCharges];
      nextCharges[index] = { ...nextCharges[index], [field]: value };
      return { ...prev, additionalCharges: nextCharges };
    });
  }

  function handleRemoveCharge(index) {
    setForm((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.documents.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.documents.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Currency & Language */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.documents.currencySection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label={t("settings.documents.currencySelect")}
            value={form.currency.code}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            error={fieldErrors["currency.code"]}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </SelectField>

          <FormField
            label={t("settings.documents.currencySymbol")}
            value={form.currency.symbol}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currency: { ...prev.currency, symbol: e.target.value } }))
            }
            error={fieldErrors["currency.symbol"]}
            maxLength={5}
            required
          />
        </div>
      </div>

      {/* Discount Defaults */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.documents.discountSection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label={t("settings.documents.discountType")}
            value={form.discount.type}
            onChange={(e) => handleDiscountChange("type", e.target.value)}
            error={fieldErrors["discount.type"]}
          >
            <option value="none">{t("settings.documents.discountNone")}</option>
            <option value="percentage">{t("settings.documents.discountPercentage")}</option>
            <option value="fixed">{t("settings.documents.discountFixed")}</option>
          </SelectField>

          {form.discount.type !== "none" && (
            <FormField
              label={t("settings.documents.discountValue")}
              type="number"
              min="0"
              max={form.discount.type === "percentage" ? "100" : undefined}
              step="0.01"
              value={form.discount.value}
              onChange={(e) => handleDiscountChange("value", parseFloat(e.target.value) || 0)}
              error={fieldErrors["discount.value"]}
            />
          )}
        </div>
      </div>

      {/* Additional Charges */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t("settings.documents.additionalChargesSection")}</h3>
            <p className="text-xs text-slate-500">{t("settings.documents.additionalChargesHelp")}</p>
          </div>
          {form.additionalCharges.length < 10 && (
            <Button type="button" variant="secondary" onClick={handleAddCharge} className="w-auto text-xs py-1.5 px-3">
              + {t("settings.documents.addCharge")}
            </Button>
          )}
        </div>

        {form.additionalCharges.length > 0 ? (
          <div className="mt-4 space-y-3">
            {form.additionalCharges.map((charge, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={charge.label}
                    onChange={(e) => handleChargeChange(index, "label", e.target.value)}
                    placeholder={t("settings.documents.chargeLabel")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="w-36">
                  <select
                    value={charge.type}
                    onChange={(e) => handleChargeChange(index, "type", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="fixed">{t("settings.documents.chargeTypeFixed")}</option>
                    <option value="percentage">{t("settings.documents.chargeTypePercentage")}</option>
                  </select>
                </div>

                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={charge.value}
                    onChange={(e) => handleChargeChange(index, "value", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCharge(index)}
                  className="rounded p-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                  title={t("common.remove")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400 italic">No standard surcharges configured.</p>
        )}
      </div>

      {/* Template & Document Language */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.documents.templateSection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label={t("settings.documents.template")}
            value={form.template}
            onChange={(e) => setForm((prev) => ({ ...prev, template: e.target.value }))}
            error={fieldErrors["template"]}
          >
            <option value="standard">{t("settings.documents.templateStandard")}</option>
            <option value="modern">{t("settings.documents.templateModern")}</option>
            <option value="minimal">{t("settings.documents.templateMinimal")}</option>
          </SelectField>

          <div>
            <SelectField
              label={t("settings.documents.language")}
              value={form.language}
              onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
              error={fieldErrors["language"]}
            >
              <option value="en">English (en)</option>
            </SelectField>
            <span className="mt-1 block text-xs text-slate-500">{t("settings.documents.languageHelp")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" loading={saving} className="w-auto px-6">
          {saving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
