import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectField from "../../../components/SelectField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April (India Standard Financial Year)" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function normalizeFiscalYear(fiscalYear) {
  return {
    startMonth: Number(fiscalYear?.startMonth) || 4,
  };
}

export default function FiscalYearTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeFiscalYear(settings?.fiscalYear));
  const [initialJson] = useState(() => JSON.stringify(normalizeFiscalYear(settings?.fiscalYear)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function handleMonthChange(val) {
    setForm({ startMonth: parseInt(val, 10) });
  }

  function handlePreset(month) {
    setForm({ startMonth: month });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  const startMonthName = MONTHS.find((m) => m.value === form.startMonth)?.label.split(" ")[0] || "April";
  const endMonthValue = form.startMonth === 1 ? 12 : form.startMonth - 1;
  const endMonthName = MONTHS.find((m) => m.value === endMonthValue)?.label.split(" ")[0] || "March";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.fiscalYear.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.fiscalYear.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Info Callout */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs text-indigo-900">
        <div className="flex items-start gap-2">
          <span className="text-base leading-none">📅</span>
          <div>
            <span className="font-semibold">{t("settings.fiscalYear.currentYearInfo")}:</span>{" "}
            {t("settings.fiscalYear.currentYearHelp")}
            <div className="mt-2 font-medium">
              Current cycle runs from <span className="underline font-semibold">{startMonthName} 1</span> to{" "}
              <span className="underline font-semibold">{endMonthName} {endMonthValue === 2 ? "28/29" : [4,6,9,11].includes(endMonthValue) ? "30" : "31"}</span>.
            </div>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("settings.fiscalYear.presetLabel")}</h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handlePreset(4)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              form.startMonth === 4
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/30"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            🇮🇳 {t("settings.fiscalYear.presetIndia")}
          </button>
          <button
            type="button"
            onClick={() => handlePreset(1)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              form.startMonth === 1
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/30"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            🌍 {t("settings.fiscalYear.presetCalendar")}
          </button>
        </div>

        <div className="mt-6 max-w-sm">
          <SelectField
            label={t("settings.fiscalYear.startMonth")}
            value={form.startMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            error={fieldErrors["startMonth"]}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>
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
