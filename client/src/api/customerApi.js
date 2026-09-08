import apiClient from "./client";
import { toQueryString } from "./queryString";

export const customerApi = {
  list: (params) => apiClient.get(`/customers?${toQueryString(params)}`).then((res) => res.data),
  create: (payload) => apiClient.post("/customers", payload).then((res) => res.data),
  get: (id) => apiClient.get(`/customers/${id}`).then((res) => res.data),
  update: (id, payload) => apiClient.patch(`/customers/${id}`, payload).then((res) => res.data),
  archive: (id) => apiClient.post(`/customers/${id}/archive`).then((res) => res.data),
  restore: (id) => apiClient.post(`/customers/${id}/restore`).then((res) => res.data),
};
