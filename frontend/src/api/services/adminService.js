import { createHttpClient } from "../httpClient.js";

export function createAdminService(baseURL) {
  const http = createHttpClient(baseURL);

  return {
    getUsers: async ({ page = 1, limit = 10, search = "", role = "" } = {}) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      const res = await http.get(`/api/admin/users?${params.toString()}`);
      return res.data;
    },

    createUser: async (fd) => {
      const res = await http.post("/api/admin/users", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },

    updateRole: async (userId, role) => {
      const res = await http.put(`/api/admin/users/${userId}/role`, { role });
      return res.data.user;
    },

    updateSalary: async (userId, salary) => {
      const res = await http.put(`/api/admin/users/${userId}/salary`, { salary });
      return res.data.user;
    },

    updateUserDetails: async (userId, fd) => {
      const res = await http.put(`/api/admin/users/${userId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.user;
    },

    assignManager: async (userId, managerId) => {
      // backend expects `managerId: ""` to clear assignment (becomes null).
      const res = await http.put(`/api/admin/users/${userId}/manager`, {
        managerId: managerId || "",
      });
      return res.data.user;
    },

    deleteUser: async (userId) => {
      const res = await http.delete(`/api/admin/users/${userId}`);
      return res.data;
    },
  };
}

