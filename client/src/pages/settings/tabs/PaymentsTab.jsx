import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import TextareaField from "../../../components/TextareaField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

const ALL_PAYMENT_METHODS = [
  { id: "cash", labelKey: "settings.payments.methodCash" },
  { id: "bank_transfer", labelKey: "settings.payments.methodBankTransfer" },
  { id: "upi", labelKey: "settings.payments.methodUpi" },
  { id: "card", labelKey: "settings.payments.methodCard" },
  { id: "cheque", labelKey: "settings.payments.methodCheque" },
  { id: "other", labelKey: "settings.payments.methodOther" },
];

function normalizePayments(payments) {
  return {
    acceptedMethods: Array.isArray(payments?.acceptedMethods)
      ? payments.acceptedMethods
      : ["cash", "bank_transfer", "upi"],
    upi: {
      id: payments?.upi?.id || "",
    },
    bank: {
      accountHolder: payments?.bank?.accountHolder || "",
      bankName: payments?.bank?.bankName || "",
      accountNumber: payments?.bank?.accountNumber || "",
      ifsc: payments?.bank?.ifsc || "",
    },
    instructions: payments?.instructions || "",
    defaultTerms: {
      type: payments?.defaultTerms?.type || "due_on_receipt",
      customDays: payments?.defaultTerms?.customDays || 30,
    },
  };
}

export default function PaymentsTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizePayments(settings?.payments));
  const [initialJson] = useState(() => JSON.stringify(normalizePayments(settings?.payments)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function toggleMethod(methodId) {
    setForm((prev) => {
      const exists = prev.acceptedMethods.includes(methodId);
      const nextMethods = exists
        ? prev.acceptedMethods.filter((m) => m !== methodId)
        : [...prev.acceptedMethods, methodId];
      return { ...prev, acceptedMethods: nextMethods };
    });
  }

  function setBankField(field, value) {
    setForm((prev) => ({
      ...prev,
      bank: { ...prev.bank, [field]: value },
    }));
  }

  function setTermsField(field, value) {
    setForm((prev) => ({
      ...prev,
      defaultTerms: { ...prev.defaultTerms, [field]: value },
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Clean up payload
    const payload = {
      acceptedMethods: form.acceptedMethods,
      upi: { id: form.upi.id || undefined },
      bank: {
        accountHolder: form.bank.accountHolder || undefined,
        bankName: form.bank.bankName || undefined,
        accountNumber: form.bank.accountNumber || undefined,
        ifsc: form.bank.ifsc || undefined,
      },
      instructions: form.instructions || undefined,
      defaultTerms: {
        type: form.defaultTerms.type,
        customDays: form.defaultTerms.type === "custom" ? Number(form.defaultTerms.customDays) : undefined,
      },
    };
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.payments.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.payments.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Accepted Payment Methods */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-800">{t("settings.payments.methodsSection")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("settings.payments.methodsHelp")}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ALL_PAYMENT_METHODS.map((method) => {
            const checked = form.acceptedMethods.includes(method.id);
            return (
              <label
                key={method.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition ${
                  checked
                    ? "border-indigo-600 bg-indigo-50/40 text-indigo-900 font-medium"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMethod(method.id)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>{t(method.labelKey)}</span>
              </label>
            );
          })}
        </div>
        {fieldErrors["acceptedMethods"] && (
          <span className="mt-2 block text-xs text-red-600">{fieldErrors["acceptedMethods"]}</span>
        )}
      </div>

      {/* UPI Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.payments.upiSection")}</h3>
        <FormField
          label={t("settings.payments.upiId")}
          value={form.upi.id}
          onChange={(e) => setForm((prev) => ({ ...prev, upi: { id: e.target.value } }))}
          placeholder={t("settings.payments.upiIdPlaceholder")}
          error={fieldErrors["upi.id"]}
        />
      </div>

      {/* Bank Account Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.payments.bankSection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t("settings.payments.bankAccountHolder")}
            value={form.bank.accountHolder}
            onChange={(e) => setBankField("accountHolder", e.target.value)}
            error={fieldErrors["bank.accountHolder"]}
          />
          <FormField
            label={t("settings.payments.bankName")}
            value={form.bank.bankName}
            onChange={(e) => setBankField("bankName", e.target.value)}
            error={fieldErrors["bank.bankName"]}
          />
          <FormField
            label={t("settings.payments.bankAccountNumber")}
            value={form.bank.accountNumber}
            onChange={(e) => setBankField("accountNumber", e.target.value)}
            error={fieldErrors["bank.accountNumber"]}
          />
          <div>
            <FormField
              label={t("settings.payments.bankIfsc")}
              value={form.bank.ifsc}
              onChange={(e) => setBankField("ifsc", e.target.value.toUpperCase())}
              placeholder="HDFC0001234"
              maxLength={11}
              error={fieldErrors["bank.ifsc"]}
            />
            <span className="mt-1 block text-xs text-slate-500">{t("settings.payments.bankIfscHelp")}</span>
          </div>
        </div>
      </div>

      {/* Default Payment Terms */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.payments.termsSection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label={t("settings.payments.termsType")}
            value={form.defaultTerms.type}
            onChange={(e) => setTermsField("type", e.target.value)}
            error={fieldErrors["defaultTerms.type"]}
          >
            <option value="due_on_receipt">{t("settings.payments.termsDueOnReceipt")}</option>
            <option value="7_days">{t("settings.payments.terms7Days")}</option>
            <option value="15_days">{t("settings.payments.terms15Days")}</option>
            <option value="30_days">{t("settings.payments.terms30Days")}</option>
            <option value="45_days">{t("settings.payments.terms45Days")}</option>
            <option value="custom">{t("settings.payments.termsCustom")}</option>
          </SelectField>

          {form.defaultTerms.type === "custom" && (
            <FormField
              label={t("settings.payments.customDays")}
              type="number"
              min="1"
              value={form.defaultTerms.customDays}
              onChange={(e) => setTermsField("customDays", parseInt(e.target.value, 10) || 1)}
              error={fieldErrors["defaultTerms.customDays"]}
              required
            />
          )}
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.payments.instructionsSection")}</h3>
        <TextareaField
          label={t("settings.payments.instructions")}
          rows={3}
          value={form.instructions}
          onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
          placeholder={t("settings.payments.instructionsPlaceholder")}
          error={fieldErrors["instructions"]}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" loading={saving} className="w-auto px-6">
          {saving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
