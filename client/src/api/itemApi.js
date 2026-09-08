import apiClient from "./client";
import { toQueryString } from "./queryString";

export const itemApi = {
  list: (params) => apiClient.get(`/items?${toQueryString(params)}`).then((res) => res.data),
  create: (payload) => apiClient.post("/items", payload).then((res) => res.data),
  get: (id) => apiClient.get(`/items/${id}`).then((res) => res.data),
  update: (id, payload) => apiClient.patch(`/items/${id}`, payload).then((res) => res.data),
  archive: (id) => apiClient.post(`/items/${id}/archive`).then((res) => res.data),
  restore: (id) => apiClient.post(`/items/${id}/restore`).then((res) => res.data),
};
