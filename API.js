/* IMPACTRA — API Client */

const API = (() => {
  "use strict";

  /*  CONFIG  */
  const BASE_URL = "https://impactra-api-dev.onrender.com/api/v1";
  const TOKEN_KEY = "impactra_token";
  const REFRESH_KEY = "impactra_refresh";

  /*  TOKEN STORAGE  */
  const tokens = {
    get access() { return localStorage.getItem(TOKEN_KEY); },
    get refresh() { return localStorage.getItem(REFRESH_KEY); },
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

  /*  ERROR TYPE  */
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }

  /*  CORE REQUEST WRAPPER  */
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

    // Headers
    const finalHeaders = { Accept: "application/json", ...headers };
    if (body && !(body instanceof FormData)) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (auth && tokens.access) {
      finalHeaders.Authorization = `Bearer ${tokens.access}`;
    }

    const init = { method, headers: finalHeaders };
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

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    let payload;
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    } else if (raw) {
      payload = await response.blob();
    } else {
      payload = await response.text().catch(() => null);
    }

    if (!response.ok) {
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
  const get   = (path, query, opts) => request(path, { method: "GET", query, ...opts });
  const post  = (path, body, opts)  => request(path, { method: "POST", body, ...opts });
  const put   = (path, body, opts)  => request(path, { method: "PUT", body, ...opts });
  const patch = (path, body, opts)  => request(path, { method: "PATCH", body, ...opts });
  const del   = (path, opts)        => request(path, { method: "DELETE", ...opts });

  /* AUTH */
  const auth = {
    /* POST /auth/signup */
    register: (payload) => post("/auth/signup", payload, { auth: false }),

    /* POST /auth/verify-email — { email, code } */
    verifyEmail: (email, code) =>
      post("/auth/verify-email", { email, code }, { auth: false }),

    /* POST /auth/resend-email — { email, purpose } */
    resendEmail: (email, purpose) =>
      post("/auth/resend-email", { email, purpose }, { auth: false }),

    /* POST /auth/login — returns { requiresOTP: true } on first step */
    async login(email, password) {
      const data = await post(
        "/auth/login",
        { email, password },
        { auth: false }
      );
      return data;
    },

    /* POST /auth/verify-login — { email, code } → returns { token, user } */
    async verifyLogin(email, code) {
      const data = await post(
        "/auth/verify-login",
        { email, code },
        { auth: false }
      );
      if (data?.token) {
        tokens.set({ accessToken: data.token, refreshToken: data.refreshToken });
      }
      return data;
    },

    /* POST /auth/account-type — { accountType } */
    setAccountType: (accountType) =>
      post("/auth/account-type", { accountType }),

    /* POST /auth/forgot-password */
    forgotPassword: (email) =>
      post("/auth/forgot-password", { email }, { auth: false }),

    /* POST /auth/forgot-password/verify — { email, code } → { resetToken } */
    verifyForgotPassword: (email, code) =>
      post("/auth/forgot-password/verify", { email, code }, { auth: false }),

    /* POST /auth/reset-password — { resetToken, newPassword } */
    resetPassword: (resetToken, newPassword) =>
      post("/auth/reset-password", { resetToken, newPassword }, { auth: false }),

    /* POST /auth/logout */
    async logout() {
      try {
        await post("/auth/logout", {});
      } finally {
        tokens.clear();
      }
    },
  };

  /* ORGANIZATION (NGO Admin)*/

  /* Organization profile & setup */
  const organization = {
    /* POST /organization/profile-setup (multipart) */
    setupProfile: (formData) => post("/organization/profile-setup", formData),

    /* GET /organization/profile */
    getProfile: () => get("/organization/profile"),

    /* PATCH /organization/update-profile/:orgId (multipart) */
    updateProfile: (orgId, formData) =>
      patch(`/organization/update-profile/${orgId}`, formData),

    /* Dashboard */
    dashboard: {
      /* GET /organization/dashboard/overview */
      overview: (params = {}) => get("/organization/dashboard/overview", params),
    },

    /* Opportunities (NGO-created) */
    opportunities: {
      /* POST /organization/opportunity/create (multipart) */
      create: (formData) => post("/organization/opportunity/create", formData),

      /* GET /organization/opportunities */
      list: (params = {}) => get("/organization/opportunities", params),

      /* GET /organization/opportunities/:id */
      get: (id) => get(`/organization/opportunities/${id}`),

      /* PATCH /organization/opportunities/:id/update */
      update: (id, payload) =>
        patch(`/organization/opportunities/${id}/update`, payload),

      /* PATCH /organization/opportunities/:id/publish */
      publish: (id) => patch(`/organization/opportunities/${id}/publish`, {}),

      /* PATCH /organization/opportunities/:id/complete */
      complete: (id) => patch(`/organization/opportunities/${id}/complete`, {}),

      /* DELETE /organization/opportunities/:id/delete */
      remove: (id) => del(`/organization/opportunities/${id}/delete`),

      /* GET /organization/opportunities/stats */
      stats: () => get("/organization/opportunities/stats"),
    },

    /* Applications received by the org */
    applications: {
      /* GET /opportunities/:opportunityId/applications */
      listForOpportunity: (opportunityId, params = {}) =>
        get(`/opportunities/${opportunityId}/applications`, params),

      /* GET /organization/applications/stats */
      stats: () => get("/organization/applications/stats"),

      /* PATCH /organization/applications/:id/approve — { notes } */
      approve: (id, notes = "") =>
        patch(`/organization/applications/${id}/approve`, { notes }),

      /* PATCH /organization/applications/:id/reject — { notes } */
      reject: (id, notes = "") =>
        patch(`/organization/applications/${id}/reject`, { notes }),
    },

    /* Contributions reviewed by the org */
    contributions: {
      /* GET /organization/contributions */
      list: (params = {}) => get("/organization/contributions", params),

      /* GET /organization/contributions/stats */
      stats: () => get("/organization/contributions/stats"),

      /* PATCH /organization/contributions/:id/verify — { note } */
      verify: (id, note = "") =>
        patch(`/organization/contributions/${id}/verify`, { note }),

      /* PATCH /organization/contributions/:id/reject — { reason } */
      reject: (id, reason = "") =>
        patch(`/organization/contributions/${id}/reject`, { reason }),
    },
  };

  /* PLATFORM ADMIN*/
  const admin = {
    /* GET /admin/dashboard */
    dashboard: () => get("/admin/dashboard"),

    /* GET /admin/pending-organizations */
    pendingOrganizations: (params = {}) => get("/admin/pending-organizations", params),

    /* GET /admin/all-organizations */
    allOrganizations: (params = {}) => get("/admin/all-organizations", params),

    /* GET /admin/all-users */
    allUsers: (params = {}) => get("/admin/all-users", params),

    /* PATCH /admin/approve-organization/:orgId */
    approveOrganization: (orgId) =>
      patch(`/admin/approve-organization/${orgId}`, {}),

    /* PATCH /admin/reject-organization/:orgId — { reason } */
    rejectOrganization: (orgId, reason) =>
      patch(`/admin/reject-organization/${orgId}`, { reason }),
  };

  /* VOLUNTEER (for completeness — the volunteer mobile app)*/
  const volunteer = {
    /* Volunteer Profile */
    profile: {
      /* POST /volunteer/profile */
      create: (payload) => post("/volunteer/profile", payload),

      /* GET /volunteer/profile */
      get: () => get("/volunteer/profile"),

      /* PATCH /volunteer/profile (multipart) */
      update: (formData) => patch("/volunteer/profile", formData),
    },

    /* Browse opportunities */
    opportunities: {
      /* GET /volunteer/opportunities/browse */
      browse: (params = {}) => get("/volunteer/opportunities/browse", params),

      /* GET /volunteer/opportunities/browse/:id */
      get: (id) => get(`/volunteer/opportunities/browse/${id}`),
    },

    /* Applications */
    applications: {
      /* POST /volunteer/:opportunityId/application-submit */
      submit: (opportunityId, payload) =>
        post(`/volunteer/${opportunityId}/application-submit`, payload),

      /* GET /volunteer/:applicationId/application-view */
      view: (applicationId) =>
        get(`/volunteer/${applicationId}/application-view`),
    },

    /* Contributions */
    contributions: {
      /* GET /volunteer/contributions */
      list: (params = {}) => get("/volunteer/contributions", params),

      /* POST /volunteer/contributions/:applicationId/submit (multipart) */
      submit: (applicationId, formData) =>
        post(`/volunteer/contributions/${applicationId}/submit`, formData),

      /* PATCH /volunteer/contributions/:id/update (multipart) */
      update: (id, formData) =>
        patch(`/volunteer/contributions/${id}/update`, formData),
    },
  };

  /* APPLICATIONS (shared — visible to applicant or owning org)*/
  const applications = {
    /* GET /applications/:id */
    get: (id) => get(`/applications/${id}`),
  };

  /*  OPPORTUNITIES (generic router)*/
  const opportunities = {
    /* GET /opportunities?status=&category=&organization= */
    list: (params = {}) => get("/opportunities", params),

    /* GET /opportunities/:id */
    get: (id) => get(`/opportunities/${id}`),

    /* PATCH /opportunities/:id/status — { status } */
    updateStatus: (id, status) =>
      patch(`/opportunities/${id}/status`, { status }),
  };

  /* CERTIFICATES*/
  const certificates = {
    /* POST /certificates/template (multipart) */
    createTemplate: (formData) => post("/certificates/template", formData),

    /* POST /certificates/issue/:contributionId */
    issue: (contributionId) =>
      post(`/certificates/issue/${contributionId}`, {}),
  };

  /*  NOTIFICATIONS*/
  const notifications = {
    /* GET /notifications?page=&limit=&unread= */
    list: (params = {}) => get("/notifications", params),

    /* GET /notifications/unread-count */
    unreadCount: () => get("/notifications/unread-count"),

    /* PATCH /notifications/:id/read */
    markRead: (id) => patch(`/notifications/${id}/read`, {}),

    /* PATCH /notifications/read-all */
    markAllRead: () => patch("/notifications/read-all", {}),

    /* DELETE /notifications/:id */
    remove: (id) => del(`/notifications/${id}`),
  };

  /* EXPORT */
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

    // tokens
    tokens,

    // error type
    ApiError,

    // resources
    auth,
    organization,
    admin,
    volunteer,
    applications,
    opportunities,
    certificates,
    notifications,

    /*  LEGACY ALIASES — keep old call sites working */

    // Old: API.activities. → new: API.organization.contributions./ admin
    activities: {
      contributions: {
        listForOrganization: (params) =>
          organization.contributions.list(params),
        orgStats: () => organization.contributions.stats(),
        verify: (id, note) => organization.contributions.verify(id, note),
        reject: (id, reason) => organization.contributions.reject(id, reason),
      },
    },

    // Old: API.volunteers. → new: API.volunteer. (with reduced surface)
    volunteers: {
      get: () => volunteer.profile.get(),
      metrics: () => volunteer.profile.get(),
    },

    // Old: API.dashboard. → new: API.organization.dashboard.
    dashboard: {
      summary: () => organization.dashboard.overview(),
    },

    // Old: API.impact.* → no backend endpoint (return empty) — DEPRECATED
    impact: {
      summary: async () => ({}),
      verifiedHours: async () => ({}),
      certificates: async () => ({}),
    },
  };
})();

// Expose globally for classic-script pages
window.API = API;