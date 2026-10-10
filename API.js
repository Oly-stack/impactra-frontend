/*IMPACTRA — API Client*/

const API = (() => {
  "use strict";

  /*CONFIG*/
  const BASE_URL = "https://impactra-api-dev.onrender.com/api/v1";
  const TOKEN_KEY = "impactra_token";
  const REFRESH_KEY = "impactra_refresh";

  /*TOKEN STORAGE*/
  const tokens = {
    get access() {
      return localStorage.getItem(TOKEN_KEY);
    },
    get refresh() {
      return localStorage.getItem(REFRESH_KEY);
    },
    set({ accessToken, refreshToken } = {}) {
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },
    get isAuthenticated() {
      return Boolean(localStorage.getItem(TOKEN_KEY));
    },
  };

  /*CORE REQUEST WRAPPER*/
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }

  async function request(path, options = {}) {
    const {
      method = "GET",
      body,
      query,
      headers = {},
      auth = true,
      raw = false,
    } = options;

    // Build URL with query params
    let url = `${BASE_URL}${path}`;
    if (query && typeof query === "object") {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    // Build headers
    const finalHeaders = { Accept: "application/json", ...headers };
    if (body && !(body instanceof FormData)) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (auth && tokens.access) {
      finalHeaders.Authorization = `Bearer ${tokens.access}`;
    }

    // Build init
    const init = {
      method,
      headers: finalHeaders,
    };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, init);
    } catch (networkErr) {
      throw new ApiError("Network error — please check your connection.", 0, {
        cause: networkErr,
      });
    }

    // Handle 204 No Content
    if (response.status === 204) return null;

    // Parse body
    const contentType = response.headers.get("content-type") || "";
    let payload;
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    } else if (raw) {
      payload = await response.blob();
    } else {
      payload = await response.text().catch(() => null);
    }

    // Handle errors
    if (!response.ok) {
      // Auto-clear tokens on 401
      if (response.status === 401) {
        tokens.clear();
        document.dispatchEvent(new CustomEvent("api:unauthorized"));
      }

      const message =
        payload?.message ||
        payload?.error ||
        payload?.detail ||
        `Request failed with status ${response.status}`;

      throw new ApiError(message, response.status, payload);
    }

    return payload;
  }

  /* Shorthand helpers */
  const get = (path, query, opts) =>
    request(path, { method: "GET", query, ...opts });
  const post = (path, body, opts) =>
    request(path, { method: "POST", body, ...opts });
  const put = (path, body, opts) =>
    request(path, { method: "PUT", body, ...opts });
  const patch = (path, body, opts) =>
    request(path, { method: "PATCH", body, ...opts });
  const del = (path, opts) => request(path, { method: "DELETE", ...opts });

  /*AUTH*/
  const auth = {
    /* POST /auth/login */
    async login(email, password) {
      const data = await post(
        "/auth/login",
        { email, password },
        { auth: false },
      );
      tokens.set({
        accessToken: data?.accessToken || data?.token,
        refreshToken: data?.refreshToken,
      });
      return data;
    },

    /* POST /auth/logout */
    async logout() {
      try {
        await post("/auth/logout", {});
      } finally {
        tokens.clear();
      }
    },

    /* POST /auth/refresh */
    async refresh() {
      if (!tokens.refresh) throw new ApiError("No refresh token", 401, null);
      const data = await post(
        "/auth/refresh",
        { refreshToken: tokens.refresh },
        { auth: false },
      );
      tokens.set({
        accessToken: data?.accessToken || data?.token,
        refreshToken: data?.refreshToken,
      });
      return data;
    },

    /* GET /auth/me */
    me: () => get("/auth/me"),

    /* POST /auth/register */
    register: (payload) => post("/auth/register", payload, { auth: false }),

    /* POST /auth/forgot-password */
    forgotPassword: (email) =>
      post("/auth/forgot-password", { email }, { auth: false }),

    /* POST /auth/reset-password */
    resetPassword: (token, password) =>
      post("/auth/reset-password", { token, password }, { auth: false }),
  };

  /*ACTIVITIES / CONTRIBUTIONS*/
  const activities = {
    /* GET /activities */
    list: (params = {}) => get("/activities", params),

    /* GET /activities/:id */
    get: (id) => get(`/activities/${id}`),

    /* GET /activities/metrics — counts for the bento strip */
    metrics: () => get("/activities/metrics"),

    /* POST /activities */
    create: (payload) => post("/activities", payload),

    /* PATCH /activities/:id */
    update: (id, payload) => patch(`/activities/${id}`, payload),

    /* DELETE /activities/:id */
    remove: (id) => del(`/activities/${id}`),

    /* Contributions (hours submissions) */
    contributions: {
      /* GET /activities/contributions */
      list: (params = {}) => get("/activities/contributions", params),

      /* GET /activities/contributions/:id */
      get: (id) => get(`/activities/contributions/${id}`),

      /* POST /activities/contributions/:id/verify */
      verify: (id, note) =>
        post(`/activities/contributions/${id}/verify`, { note }),

      /* POST /activities/contributions/:id/reject */
      reject: (id, reason, message) =>
        post(`/activities/contributions/${id}/reject`, { reason, message }),

      /* POST /activities/contributions/bulk-verify */
      bulkVerify: (ids) =>
        post("/activities/contributions/bulk-verify", { contributionIds: ids }),

      /* GET /activities/contributions/:id/audit-log */
      auditLog: (id) => get(`/activities/contributions/${id}/audit-log`),

      /* GET /activities/contributions/:id/evidence */
      evidence: (id) => get(`/activities/contributions/${id}/evidence`),
    },
  };

  /*VOLUNTEERS*/
  const volunteers = {
    /* GET /volunteers */
    list: (params = {}) => get("/volunteers", params),

    /* GET /volunteers/:id */
    get: (id) => get(`/volunteers/${id}`),

    /* PATCH /volunteers/:id */
    update: (id, payload) => patch(`/volunteers/${id}`, payload),

    /* DELETE /volunteers/:id */
    remove: (id) => del(`/volunteers/${id}`),

    /* GET /volunteers/:id/activities — full activity history */
    activityHistory: (id, params = {}) =>
      get(`/volunteers/${id}/activities`, params),

    /* GET /volunteers/:id/metrics — verified hours, missions, certificates */
    metrics: (id) => get(`/volunteers/${id}/metrics`),

    /* POST /volunteers/:id/message */
    message: (id, { subject, body }) =>
      post(`/volunteers/${id}/message`, { subject, body }),

    /* POST /volunteers/:id/question */
    askQuestion: (id, message) =>
      post(`/volunteers/${id}/question`, { message }),

    /* POST /volunteers/:id/approve */
    approve: (id, opportunityId) =>
      post(`/volunteers/${id}/approve`, { opportunityId }),

    /* POST /volunteers/:id/reject */
    reject: (id, reason, note) =>
      post(`/volunteers/${id}/reject`, { reason, note }),

    /* POST /volunteers/:id/avatar (multipart) */
    uploadAvatar: (id, file) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return post(`/volunteers/${id}/avatar`, fd);
    },

    /* DELETE /volunteers/:id/avatar */
    removeAvatar: (id) => del(`/volunteers/${id}/avatar`),

    /* GET /volunteers/:id/export — returns a blob */
    exportProfile: (id) => request(`/volunteers/${id}/export`, { raw: true }),

    /* POST /volunteers/:id/archive */
    archive: (id) => post(`/volunteers/${id}/archive`, {}),

    /* POST /volunteers/:id/assign */
    assignReviewer: (id, reviewerId) =>
      post(`/volunteers/${id}/assign`, { reviewerId }),

    /** POST /volunteers/:id/flag */
    flag: (id, reason) => post(`/volunteers/${id}/flag`, { reason }),
  };

  /*APPLICATIONS*/
  const applications = {
    /* GET /applications */
    list: (params = {}) => get("/applications", params),

    /* GET /applications/:id */
    get: (id) => get(`/applications/${id}`),

    /* GET /applications/stats — counts for status counter strip */
    stats: () => get("/applications/stats"),

    /* POST /applications/:id/approve */
    approve: (id, note) => post(`/applications/${id}/approve`, { note }),

    /* POST /applications/:id/reject */
    reject: (id, reason, note) =>
      post(`/applications/${id}/reject`, { reason, note }),

    /* POST /applications/bulk-approve */
    bulkApprove: (ids) =>
      post("/applications/bulk-approve", { applicationIds: ids }),

    /* POST /applications/bulk-reject */
    bulkReject: (ids, reason) =>
      post("/applications/bulk-reject", { applicationIds: ids, reason }),
  };

  /*OPPORTUNITIES*/
  const opportunities = {
    list: (params = {}) => get("/opportunities", params),
    get: (id) => get(`/opportunities/${id}`),
    create: (payload) => post("/opportunities", payload),
    update: (id, payload) => patch(`/opportunities/${id}`, payload),
    remove: (id) => del(`/opportunities/${id}`),
    applicants: (id, params = {}) =>
      get(`/opportunities/${id}/applicants`, params),
  };

  /*DASHBOARD*/
  const dashboard = {
    /* GET /dashboard/summary — top-level metrics */
    summary: () => get("/dashboard/summary"),

    /* GET /dashboard/recent — recent activity feed */
    recent: (limit = 10) => get("/dashboard/recent", { limit }),
  };

  /*IMPACT*/
  const impact = {
    /* GET /impact/summary */
    summary: (params = {}) => get("/impact/summary", params),

    /* GET /impact/verified-hours */
    verifiedHours: (params = {}) => get("/impact/verified-hours", params),

    /* GET /impact/certificates */
    certificates: (params = {}) => get("/impact/certificates", params),
  };

  /*SETTINGS — user profile & preferences*/
  const settings = {
    /* GET /settings/profile */
    getProfile: () => get("/settings/profile"),

    /* PATCH /settings/profile */
    updateProfile: (payload) => patch("/settings/profile", payload),

    /* POST /settings/profile/avatar (multipart) */
    uploadAvatar: (file) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return post("/settings/profile/avatar", fd);
    },

    /* DELETE /settings/profile/avatar */
    removeAvatar: () => del("/settings/profile/avatar"),

    /* GET /settings/notifications */
    getNotifications: () => get("/settings/notifications"),

    /* PATCH /settings/notifications */
    updateNotifications: (prefs) => patch("/settings/notifications", prefs),

    /* POST /settings/password */
    changePassword: ({ currentPassword, newPassword }) =>
      post("/settings/password", { currentPassword, newPassword }),

    /* POST /settings/2fa/enable */
    enable2FA: (code) => post("/settings/2fa/enable", { code }),

    /* POST /settings/2fa/disable */
    disable2FA: (code) => post("/settings/2fa/disable", { code }),

    /* POST /settings/2fa/setup — returns { qrCode, secret } */
    setup2FA: () => post("/settings/2fa/setup", {}),

    /* DELETE /settings/account */
    deleteAccount: (confirm) =>
      del("/settings/account", { query: { confirm } }),
  };

  /*NOTIFICATIONS*/
  const notifications = {
    /* GET /notifications */
    list: (params = {}) => get("/notifications", params),

    /* GET /notifications/unread-count */
    unreadCount: () => get("/notifications/unread-count"),

    /* POST /notifications/:id/read */
    markRead: (id) => post(`/notifications/${id}/read`, {}),

    /* POST /notifications/read-all */
    markAllRead: () => post("/notifications/read-all", {}),

    /* DELETE /notifications/:id */
    remove: (id) => del(`/notifications/${id}`),
  };

  /*MESSAGES*/
  const messages = {
    list: (params = {}) => get("/messages", params),
    get: (id) => get(`/messages/${id}`),
    send: (recipientId, { subject, body }) =>
      post("/messages", { recipientId, subject, body }),
    markRead: (id) => post(`/messages/${id}/read`, {}),
  };

  /*EXPORT */
  return {
    // config
    BASE_URL,

    // core
    request,
    get,
    post,
    put,
    patch,
    del,

    // token utilities
    tokens,

    // resources
    auth,
    activities,
    volunteers,
    applications,
    opportunities,
    dashboard,
    impact,
    settings,
    notifications,
    messages,

    // error type (so pages can catch/instanceof)
    ApiError,
  };
})();

// Expose globally for classic-script pages
window.API = API;
