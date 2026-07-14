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

  async function requestForm(path, formData) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      body: formData
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
    deleteUser(userId) {
      return post("/api/user-delete", { userId });
    },
    saveBuilding(building) {
      return post("/api/building", { building });
    },
    saveApartment(apartment) {
      return post("/api/apartment", { apartment });
    },
    saveTicket(ticket) {
      return post("/api/ticket", { ticket });
    },
    saveWorkOrder(workOrder) {
      return post("/api/work-order", { workOrder });
    },
    saveIntervention(intervention) {
      return post("/api/intervention", { intervention });
    },
    saveFieldIntervention(apartment, equipment, intervention, workOrder, replacement) {
      return post("/api/field-intervention", { apartment: apartment || null, equipment, intervention, workOrder, replacement: replacement || null });
    },
    saveReminder(reminder) {
      return post("/api/reminder", { reminder });
    },
    saveReminders(reminders) {
      return post("/api/reminder", { reminders });
    },
    deleteReminder(reminderId) {
      return post("/api/reminder-delete", { reminderId });
    },
    saveSettingItem(collectionKey, item) {
      return post("/api/setting-item", { collectionKey, item });
    },
    deleteSettingItem(collectionKey, itemId) {
      return post("/api/setting-item-delete", { collectionKey, itemId });
    },
    getReportContext(filters) {
      return post("/api/report-context", { filters });
    },
    uploadFile(formData) {
      return requestForm("/api/file-upload", formData);
    },
    getFileUrl(fileId) {
      return post("/api/file-url", { fileId });
    },
    deleteFile(fileId) {
      return post("/api/file-delete", { fileId });
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
