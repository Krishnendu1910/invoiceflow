import apiClient from "./client";

// One focused endpoint per settings section/tab, matching the backend's
// businessSettings routes — each tab only ever submits its own section.
export const businessSettingsApi = {
  get: (businessId) => apiClient.get(`/businesses/${businessId}/settings`).then((res) => res.data),
  updateProfile: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/profile`, payload).then((res) => res.data),
  updateBranding: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/branding`, payload).then((res) => res.data),
  updateTax: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/tax`, payload).then((res) => res.data),
  updateNumbering: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/numbering`, payload).then((res) => res.data),
  updatePayments: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/payments`, payload).then((res) => res.data),
  updateFiscalYear: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/fiscal-year`, payload).then((res) => res.data),
  updateDocuments: (businessId, payload) =>
    apiClient.patch(`/businesses/${businessId}/settings/documents`, payload).then((res) => res.data),
};
