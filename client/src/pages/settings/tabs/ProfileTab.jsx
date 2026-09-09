import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormField from "../../../components/FormField";
import SelectField from "../../../components/SelectField";
import TextareaField from "../../../components/TextareaField";
import AddressFields from "../../../components/AddressFields";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

const emptyAddress = { line1: "", line2: "", city: "", state: "", postalCode: "", country: "" };

function normalizeProfile(settings) {
  return {
    name: settings?.name || "",
    type: settings?.type || "Private Limited",
    country: settings?.country || "IN",
    identity: {
      legalName: settings?.identity?.legalName || "",
      registrationNumber: settings?.identity?.registrationNumber || "",
      tradeName: settings?.identity?.tradeName || "",
      description: settings?.identity?.description || "",
      industry: settings?.identity?.industry || "",
    },
    contact: {
      email: settings?.contact?.email || "",
      phone: settings?.contact?.phone || "",
      website: settings?.contact?.website || "",
      address: {
        ...emptyAddress,
        ...(settings?.contact?.address || {}),
      },
    },
  };
}

export default function ProfileTab({ settings, onSave, saving, saveError, fieldErrors, onDirtyChange }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => normalizeProfile(settings));
  const [initialJson] = useState(() => JSON.stringify(normalizeProfile(settings)));

  const isDirty = JSON.stringify(form) !== initialJson;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function setTop(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setIdentity(field, value) {
    setForm((prev) => ({
      ...prev,
      identity: { ...prev.identity, [field]: value },
    }));
  }

  function setContact(field, value) {
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  }

  function handleAddressChange(addressValue) {
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, address: addressValue },
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.profile.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.profile.description")}</p>
      </div>

      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* Core Identity */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">
          {t("settings.profile.displayName")} & {t("settings.profile.businessType")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t("settings.profile.displayName")}
            value={form.name}
            onChange={(e) => setTop("name", e.target.value)}
            error={fieldErrors["name"]}
            required
          />
          <FormField
            label={t("settings.profile.legalName")}
            value={form.identity.legalName}
            onChange={(e) => setIdentity("legalName", e.target.value)}
            error={fieldErrors["identity.legalName"]}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label={t("settings.profile.businessType")}
            value={form.type}
            onChange={(e) => setTop("type", e.target.value)}
            error={fieldErrors["type"]}
          >
            <option value="Freelancer">Freelancer / Consultant</option>
            <option value="Sole Proprietorship">Sole Proprietorship</option>
            <option value="Partnership">Partnership Firm</option>
            <option value="LLP">Limited Liability Partnership (LLP)</option>
            <option value="Private Limited">Private Limited Company</option>
            <option value="Public Limited">Public Limited Company</option>
            <option value="Agency">Agency / Studio</option>
            <option value="Other">Other Entity</option>
          </SelectField>

          <FormField
            label={t("settings.profile.country")}
            value={form.country}
            onChange={(e) => setTop("country", e.target.value.toUpperCase())}
            maxLength={2}
            error={fieldErrors["country"]}
            required
          />

          <FormField
            label={t("settings.profile.industry")}
            value={form.identity.industry}
            onChange={(e) => setIdentity("industry", e.target.value)}
            error={fieldErrors["identity.industry"]}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t("settings.profile.tradeName")}
            value={form.identity.tradeName}
            onChange={(e) => setIdentity("tradeName", e.target.value)}
            error={fieldErrors["identity.tradeName"]}
          />
          <FormField
            label={t("settings.profile.registrationNumber")}
            value={form.identity.registrationNumber}
            onChange={(e) => setIdentity("registrationNumber", e.target.value)}
            error={fieldErrors["identity.registrationNumber"]}
          />
        </div>

        <div className="mt-4">
          <TextareaField
            label={t("settings.profile.descriptionLabel")}
            rows={3}
            value={form.identity.description}
            onChange={(e) => setIdentity("description", e.target.value)}
            error={fieldErrors["identity.description"]}
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">
          {t("settings.profile.email")}, {t("settings.profile.phone")} & {t("settings.profile.website")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label={t("settings.profile.email")}
            type="email"
            value={form.contact.email}
            onChange={(e) => setContact("email", e.target.value)}
            error={fieldErrors["contact.email"]}
          />
          <FormField
            label={t("settings.profile.phone")}
            type="tel"
            value={form.contact.phone}
            onChange={(e) => setContact("phone", e.target.value)}
            error={fieldErrors["contact.phone"]}
          />
          <FormField
            label={t("settings.profile.website")}
            type="text"
            value={form.contact.website}
            onChange={(e) => setContact("website", e.target.value)}
            error={fieldErrors["contact.website"]}
            placeholder="https://example.com"
          />
        </div>
      </div>

      {/* Structured Address */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <AddressFields
          label={t("settings.profile.addressSection")}
          value={form.contact.address}
          onChange={handleAddressChange}
        />
      </div>

      {/* Language Notice */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p>{t("settings.profile.languageNotice")}</p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" loading={saving} className="w-auto px-6">
          {saving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
