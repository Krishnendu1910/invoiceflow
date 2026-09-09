import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import TextareaField from "../../../components/TextareaField";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

const PRESET_COLORS = [
  { label: "Slate", hex: "#1F2937" },
  { label: "Indigo", hex: "#4F46E5" },
  { label: "Blue", hex: "#2563EB" },
  { label: "Emerald", hex: "#059669" },
  { label: "Violet", hex: "#7C3AED" },
  { label: "Rose", hex: "#E11D48" },
  { label: "Amber", hex: "#D97706" },
];

function normalizeBranding(branding) {
  return {
    logo: {
      provider: branding?.logo?.provider || "none",
      url: branding?.logo?.url || "",
    },
    color: branding?.color || "#1F2937",
    headerText: branding?.headerText || "",
    footerText: branding?.footerText || "",
    paymentTermsText: branding?.paymentTermsText || "",
    notesText: branding?.notesText || "",
  };
}

export default function BrandingTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeBranding(settings?.branding));
  const [initialJson] = useState(() => JSON.stringify(normalizeBranding(settings?.branding)));
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setLogo(field, value) {
    setForm((prev) => ({
      ...prev,
      logo: { ...prev.logo, [field]: value },
    }));
    if (field === "url") {
      setLogoPreviewError(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.branding.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.branding.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Brand Logo */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("settings.branding.logoSection")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label={t("settings.branding.logoProvider")}
            value={form.logo.provider}
            onChange={(e) => setLogo("provider", e.target.value)}
            error={fieldErrors["logo.provider"]}
          >
            <option value="none">{t("settings.branding.logoProviderNone")}</option>
            <option value="url">{t("settings.branding.logoProviderUrl")}</option>
          </SelectField>

          {form.logo.provider === "url" && (
            <div className="sm:col-span-2">
              <FormField
                label={t("settings.branding.logoUrl")}
                value={form.logo.url}
                onChange={(e) => setLogo("url", e.target.value)}
                placeholder="https://example.com/logo.png"
                error={fieldErrors["logo.url"]}
              />
              <span className="mt-1 block text-xs text-slate-500">{t("settings.branding.logoUrlHelp")}</span>
            </div>
          )}
        </div>

        {form.logo.provider === "url" && form.logo.url && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs font-medium text-slate-600">{t("common.preview")}:</span>
            {!logoPreviewError ? (
              <img
                src={form.logo.url}
                alt="Logo preview"
                onError={() => setLogoPreviewError(true)}
                className="h-10 max-w-[160px] object-contain rounded border border-slate-300 bg-white p-1"
              />
            ) : (
              <span className="text-xs text-amber-600">Could not load preview from this URL.</span>
            )}
          </div>
        )}
      </div>

      {/* Brand Color */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{t("settings.branding.brandColor")}</h3>
        <p className="mb-4 text-xs text-slate-500">{t("settings.branding.brandColorHelp")}</p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color || "#1F2937"}
              onChange={(e) => setField("color", e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
            />
            <input
              type="text"
              value={form.color}
              onChange={(e) => setField("color", e.target.value)}
              maxLength={7}
              placeholder="#1F2937"
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase font-mono text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setField("color", preset.hex)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  form.color.toLowerCase() === preset.hex.toLowerCase()
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/30"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: preset.hex }} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        {fieldErrors["color"] && <span className="mt-2 block text-xs text-red-600">{fieldErrors["color"]}</span>}
      </div>

      {/* Header & Footer Copy */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Standard Document Messaging</h3>
        <div className="space-y-4">
          <TextareaField
            label={t("settings.branding.headerText")}
            rows={2}
            value={form.headerText}
            onChange={(e) => setField("headerText", e.target.value)}
            placeholder={t("settings.branding.headerTextPlaceholder")}
            error={fieldErrors["headerText"]}
          />

          <TextareaField
            label={t("settings.branding.footerText")}
            rows={2}
            value={form.footerText}
            onChange={(e) => setField("footerText", e.target.value)}
            placeholder={t("settings.branding.footerTextPlaceholder")}
            error={fieldErrors["footerText"]}
          />

          <TextareaField
            label={t("settings.branding.paymentTermsText")}
            rows={3}
            value={form.paymentTermsText}
            onChange={(e) => setField("paymentTermsText", e.target.value)}
            placeholder={t("settings.branding.paymentTermsPlaceholder")}
            error={fieldErrors["paymentTermsText"]}
          />

          <TextareaField
            label={t("settings.branding.notesText")}
            rows={3}
            value={form.notesText}
            onChange={(e) => setField("notesText", e.target.value)}
            placeholder={t("settings.branding.notesPlaceholder")}
            error={fieldErrors["notesText"]}
          />
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
