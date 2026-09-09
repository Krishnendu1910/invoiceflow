import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBusiness } from "../../context/useBusiness";
import { businessSettingsApi } from "../../api/businessSettingsApi";
import { parseErrorMessage, parseFieldErrors } from "../../api/errors";
import FullPageSpinner from "../../components/FullPageSpinner";
import Alert from "../../components/Alert";
import ConfirmDialog from "../../components/ConfirmDialog";

import ProfileTab from "./tabs/ProfileTab";
import BrandingTab from "./tabs/BrandingTab";
import TaxTab from "./tabs/TaxTab";
import NumberingTab from "./tabs/NumberingTab";
import PaymentsTab from "./tabs/PaymentsTab";
import DocumentsTab from "./tabs/DocumentsTab";
import FiscalYearTab from "./tabs/FiscalYearTab";

const TABS = [
  { id: "profile", labelKey: "settings.tabs.profile", icon: "🏢" },
  { id: "branding", labelKey: "settings.tabs.branding", icon: "🎨" },
  { id: "tax", labelKey: "settings.tabs.tax", icon: "⚖️" },
  { id: "numbering", labelKey: "settings.tabs.numbering", icon: "🔢" },
  { id: "payments", labelKey: "settings.tabs.payments", icon: "💳" },
  { id: "documents", labelKey: "settings.tabs.documents", icon: "📄" },
  { id: "fiscalYear", labelKey: "settings.tabs.fiscalYear", icon: "📅" },
];

export default function Settings() {
  const { t } = useTranslation();
  const { businessId, refreshBusinesses } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "profile";

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [isTabDirty, setIsTabDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  // Load settings on mount or businessId change
  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;

    businessSettingsApi
      .get(businessId)
      .then((res) => {
        if (cancelled) return;
        setSettings(res.data.settings);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(parseErrorMessage(err, "Could not load business settings."));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  // Window beforeunload prompt when dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isTabDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isTabDirty]);

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  function handleTabClick(targetTabId) {
    if (targetTabId === activeTab) return;

    if (isTabDirty) {
      setPendingTab(targetTabId);
    } else {
      switchTab(targetTabId);
    }
  }

  function switchTab(tabId) {
    setSearchParams({ tab: tabId }, { replace: true });
    setIsTabDirty(false);
    setSaveError("");
    setFieldErrors({});
    setSuccessMessage("");
    setPendingTab(null);
  }

  function confirmDiscardTabSwitch() {
    if (pendingTab) {
      switchTab(pendingTab);
    }
  }

  function cancelTabSwitch() {
    setPendingTab(null);
  }

  const handleDirtyChange = useCallback((dirty) => {
    setIsTabDirty(dirty);
  }, []);

  async function executeSave(apiMethod, payload) {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    setSuccessMessage("");

    try {
      const res = await apiMethod(businessId, payload);
      setSettings(res.data.settings);
      setIsTabDirty(false);
      setSuccessMessage(t("settings.savedSuccess"));

      // Refresh cached business in context so AppShell header updates immediately
      if (typeof refreshBusinesses === "function") {
        refreshBusinesses();
      }
    } catch (err) {
      setSaveError(parseErrorMessage(err, "Failed to save settings."));
      setFieldErrors(parseFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSaveProfile(payload) {
    executeSave(businessSettingsApi.updateProfile, payload);
  }

  function handleSaveBranding(payload) {
    executeSave(businessSettingsApi.updateBranding, payload);
  }

  function handleSaveTax(payload) {
    executeSave(businessSettingsApi.updateTax, payload);
  }

  function handleSaveNumbering(payload) {
    executeSave(businessSettingsApi.updateNumbering, payload);
  }

  function handleSavePayments(payload) {
    executeSave(businessSettingsApi.updatePayments, payload);
  }

  function handleSaveDocuments(payload) {
    executeSave(businessSettingsApi.updateDocuments, payload);
  }

  function handleSaveFiscalYear(payload) {
    executeSave(businessSettingsApi.updateFiscalYear, payload);
  }

  if (loading) {
    return <FullPageSpinner />;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl py-6">
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>

      {/* Global alerts */}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto pb-1 sm:space-x-2" aria-label="Settings Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
                {isActive && isTabDirty && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
                    title="Unsaved changes"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Panel */}
      <div className="pt-2">
        {activeTab === "profile" && (
          <ProfileTab
            key={`profile-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveProfile}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "branding" && (
          <BrandingTab
            key={`branding-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveBranding}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "tax" && (
          <TaxTab
            key={`tax-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveTax}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "numbering" && (
          <NumberingTab
            key={`numbering-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveNumbering}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "payments" && (
          <PaymentsTab
            key={`payments-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSavePayments}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            key={`documents-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveDocuments}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === "fiscalYear" && (
          <FiscalYearTab
            key={`fiscalYear-${settings?.updatedAt || ""}`}
            settings={settings}
            onSave={handleSaveFiscalYear}
            saving={saving}
            saveError={saveError}
            fieldErrors={fieldErrors}
            onDirtyChange={handleDirtyChange}
          />
        )}
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(pendingTab)}
        title={t("settings.unsavedChanges.title")}
        message={t("settings.unsavedChanges.message")}
        confirmLabel={t("settings.unsavedChanges.discard")}
        onConfirm={confirmDiscardTabSwitch}
        onCancel={cancelTabSwitch}
      />
    </div>
  );
}
