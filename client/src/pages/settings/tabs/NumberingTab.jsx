import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

function normalizeNumbering(numbering) {
  return {
    invoice: {
      prefix: numbering?.invoice?.prefix ?? "INV-",
      startingNumber: numbering?.invoice?.startingNumber ?? 1,
      resetPolicy: numbering?.invoice?.resetPolicy ?? "financial_year",
    },
    quotation: {
      prefix: numbering?.quotation?.prefix ?? "QUO-",
      startingNumber: numbering?.quotation?.startingNumber ?? 1,
      resetPolicy: numbering?.quotation?.resetPolicy ?? "financial_year",
    },
  };
}

export default function NumberingTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeNumbering(settings?.numbering));
  const [initialJson] = useState(() => JSON.stringify(normalizeNumbering(settings?.numbering)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function setSeriesField(series, field, value) {
    setForm((prev) => ({
      ...prev,
      [series]: {
        ...prev[series],
        [field]: value,
      },
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  const invoicePreview = `${form.invoice.prefix || ""}${form.invoice.startingNumber || 1}`;
  const quotationPreview = `${form.quotation.prefix || ""}${form.quotation.startingNumber || 1}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.numbering.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.numbering.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Lock Notice Callout */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-800">
        <div className="flex items-start gap-2">
          <span className="text-base leading-none">ℹ️</span>
          <div>
            <span className="font-semibold">{t("settings.numbering.lockNoticeTitle")}:</span>{" "}
            {t("settings.numbering.lockNotice")}
          </div>
        </div>
      </div>

      {/* Invoice Series */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-800">{t("settings.numbering.invoiceSeries")}</h3>
          <span className="text-xs text-slate-500">
            {t("settings.numbering.nextNumberPreview")}{" "}
            <span className="font-mono font-semibold text-indigo-700">{invoicePreview}</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FormField
              label={t("settings.numbering.prefix")}
              value={form.invoice.prefix}
              onChange={(e) => setSeriesField("invoice", "prefix", e.target.value)}
              placeholder="INV-"
              maxLength={20}
              error={fieldErrors["invoice.prefix"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.numbering.prefixHelp")}</span>
          </div>

          <div>
            <FormField
              label={t("settings.numbering.startingNumber")}
              type="number"
              min="1"
              value={form.invoice.startingNumber}
              onChange={(e) => setSeriesField("invoice", "startingNumber", parseInt(e.target.value, 10) || 1)}
              error={fieldErrors["invoice.startingNumber"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.numbering.startingNumberHelp")}</span>
          </div>

          <div>
            <SelectField
              label={t("settings.numbering.resetPolicy")}
              value={form.invoice.resetPolicy}
              onChange={(e) => setSeriesField("invoice", "resetPolicy", e.target.value)}
              error={fieldErrors["invoice.resetPolicy"]}
            >
              <option value="financial_year">{t("settings.numbering.resetFinancialYear")}</option>
              <option value="calendar_year">{t("settings.numbering.resetCalendarYear")}</option>
              <option value="never">{t("settings.numbering.resetNever")}</option>
            </SelectField>
          </div>
        </div>
      </div>

      {/* Quotation Series */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-800">{t("settings.numbering.quotationSeries")}</h3>
          <span className="text-xs text-slate-500">
            {t("settings.numbering.nextNumberPreview")}{" "}
            <span className="font-mono font-semibold text-indigo-700">{quotationPreview}</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FormField
              label={t("settings.numbering.prefix")}
              value={form.quotation.prefix}
              onChange={(e) => setSeriesField("quotation", "prefix", e.target.value)}
              placeholder="QUO-"
              maxLength={20}
              error={fieldErrors["quotation.prefix"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.numbering.prefixHelp")}</span>
          </div>

          <div>
            <FormField
              label={t("settings.numbering.startingNumber")}
              type="number"
              min="1"
              value={form.quotation.startingNumber}
              onChange={(e) => setSeriesField("quotation", "startingNumber", parseInt(e.target.value, 10) || 1)}
              error={fieldErrors["quotation.startingNumber"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.numbering.startingNumberHelp")}</span>
          </div>

          <div>
            <SelectField
              label={t("settings.numbering.resetPolicy")}
              value={form.quotation.resetPolicy}
              onChange={(e) => setSeriesField("quotation", "resetPolicy", e.target.value)}
              error={fieldErrors["quotation.resetPolicy"]}
            >
              <option value="financial_year">{t("settings.numbering.resetFinancialYear")}</option>
              <option value="calendar_year">{t("settings.numbering.resetCalendarYear")}</option>
              <option value="never">{t("settings.numbering.resetNever")}</option>
            </SelectField>
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
