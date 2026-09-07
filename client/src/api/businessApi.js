import apiClient from "./client";

export const businessApi = {
  list: () => apiClient.get("/businesses").then((res) => res.data),
  create: (payload) => apiClient.post("/businesses", payload).then((res) => res.data),
};
