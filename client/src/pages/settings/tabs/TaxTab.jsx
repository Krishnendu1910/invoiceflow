import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

const DEFAULT_RATES = [
  { label: "GST 0%", rate: 0, isDefault: false },
  { label: "GST 5%", rate: 5, isDefault: false },
  { label: "GST 12%", rate: 12, isDefault: false },
  { label: "GST 18%", rate: 18, isDefault: true },
  { label: "GST 28%", rate: 28, isDefault: false },
];

function normalizeTax(tax) {
  return {
    registrationStatus: tax?.registrationStatus || "unregistered",
    gstin: tax?.gstin || "",
    pan: tax?.pan || "",
    defaultMode: tax?.defaultMode || "none",
    treatment: tax?.treatment || "cgst_sgst",
    pricingMode: tax?.pricingMode || "exclusive",
    rates: Array.isArray(tax?.rates) && tax.rates.length > 0 ? tax.rates : DEFAULT_RATES,
  };
}

export default function TaxTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeTax(settings?.tax));
  const [initialJson] = useState(() => JSON.stringify(normalizeTax(settings?.tax)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleRateChange(index, field, value) {
    setForm((prev) => {
      const nextRates = [...prev.rates];
      nextRates[index] = { ...nextRates[index], [field]: value };
      return { ...prev, rates: nextRates };
    });
  }

  function handleDefaultRateSelect(index) {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.map((r, i) => ({ ...r, isDefault: i === index })),
    }));
  }

  function handleAddRate() {
    setForm((prev) => ({
      ...prev,
      rates: [...prev.rates, { label: `GST ${prev.rates.length + 1}%`, rate: 0, isDefault: false }],
    }));
  }

  function handleRemoveRate(index) {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.tax.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.tax.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Registration Status & Statutory IDs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.tax.registrationStatus")}</h3>

        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="radio"
              name="registrationStatus"
              value="unregistered"
              checked={form.registrationStatus === "unregistered"}
              onChange={() => setField("registrationStatus", "unregistered")}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            {t("settings.tax.unregistered")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="radio"
              name="registrationStatus"
              value="registered"
              checked={form.registrationStatus === "registered"}
              onChange={() => setField("registrationStatus", "registered")}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            {t("settings.tax.registered")}
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FormField
              label={t("settings.tax.gstin")}
              value={form.gstin}
              onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="27AABCU9603R1ZM"
              error={fieldErrors["gstin"]}
              required={form.registrationStatus === "registered"}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.tax.gstinHelp")}</span>
          </div>

          <div>
            <FormField
              label={t("settings.tax.pan")}
              value={form.pan}
              onChange={(e) => setField("pan", e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="AABCU9603R"
              error={fieldErrors["pan"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.tax.panHelp")}</span>
          </div>
        </div>
      </div>

      {/* Tax Mode, Treatment & Pricing */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Tax Treatment & Calculation Rules</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label={t("settings.tax.defaultMode")}
            value={form.defaultMode}
            onChange={(e) => setField("defaultMode", e.target.value)}
            error={fieldErrors["defaultMode"]}
          >
            <option value="none">{t("settings.tax.defaultModeNone")}</option>
            <option value="gst">{t("settings.tax.defaultModeGst")}</option>
          </SelectField>

          <SelectField
            label={t("settings.tax.treatment")}
            value={form.treatment}
            onChange={(e) => setField("treatment", e.target.value)}
            error={fieldErrors["treatment"]}
          >
            <option value="cgst_sgst">{t("settings.tax.treatmentCgstSgst")}</option>
            <option value="igst">{t("settings.tax.treatmentIgst")}</option>
          </SelectField>

          <SelectField
            label={t("settings.tax.pricingMode")}
            value={form.pricingMode}
            onChange={(e) => setField("pricingMode", e.target.value)}
            error={fieldErrors["pricingMode"]}
          >
            <option value="exclusive">{t("settings.tax.pricingExclusive")}</option>
            <option value="inclusive">{t("settings.tax.pricingInclusive")}</option>
          </SelectField>
        </div>
      </div>

      {/* Configurable Tax Rates */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t("settings.tax.ratesSection")}</h3>
            <p className="text-xs text-slate-500">{t("settings.tax.ratesHelp")}</p>
          </div>
          <Button type="button" variant="secondary" onClick={handleAddRate} className="w-auto text-xs py-1.5 px-3">
            + {t("settings.tax.addRate")}
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th className="py-2 pr-3">{t("settings.tax.rateLabel")}</th>
                <th className="py-2 px-3 w-32">{t("settings.tax.ratePercentage")}</th>
                <th className="py-2 px-3 w-28 text-center">{t("settings.tax.isDefaultRate")}</th>
                <th className="py-2 pl-3 w-16 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.rates.map((rateItem, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={rateItem.label}
                      onChange={(e) => handleRateChange(index, "label", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={rateItem.rate}
                        onChange={(e) => handleRateChange(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 pr-6 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="radio"
                      name="defaultTaxRate"
                      checked={Boolean(rateItem.isDefault)}
                      onChange={() => handleDefaultRateSelect(index)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {form.rates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRate(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                        title={t("common.remove")}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
