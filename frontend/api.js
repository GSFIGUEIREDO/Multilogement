(function () {
  const JSON_HEADERS = { "Content-Type": "application/json" };

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? JSON_HEADERS : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Requete impossible (HTTP ${response.status}).`);
    }
    return payload;
  }

  function post(path, body) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(body || {})
    });
  }

  window.ClimaParcApi = {
    session() {
      return request("/api/session");
    },
    saveState(payload) {
      return post("/api/state", payload);
    },
    saveEquipment(equipment) {
      return post("/api/equipment", { equipment });
    },
    saveUser(user) {
      return post("/api/user", { user });
    },
    signup(seed, values) {
      return post("/api/signup", { seed, ...values });
    },
    requestPasswordReset(seed, values) {
      return post("/api/password-reset-request", { seed, ...values });
    },
    confirmPasswordReset(seed, values) {
      return post("/api/password-reset-confirm", { seed, ...values });
    },
    login(seed, values) {
      return post("/api/login", { seed, ...values });
    },
    logout() {
      return post("/api/logout", {}).catch(() => ({ ok: false }));
    }
  };
})();
