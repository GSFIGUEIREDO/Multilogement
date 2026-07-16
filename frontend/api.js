(function () {
  const JSON_HEADERS = { "Content-Type": "application/json" };
  let mutationQueue = Promise.resolve();
  let pendingMutations = 0;
  let mutationGeneration = 0;

  function apiError(payload, response) {
    const error = new Error(payload.error || payload.detail || `Requete impossible (HTTP ${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    return error;
  }

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
      throw apiError(payload, response);
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
      throw apiError(payload, response);
    }
    return payload;
  }

  function enqueueMutation(operation) {
    pendingMutations += 1;
    const run = async () => {
      try {
        const payload = await operation();
        mutationGeneration += 1;
        return payload;
      } finally {
        pendingMutations = Math.max(0, pendingMutations - 1);
      }
    };
    const result = mutationQueue.then(run, run);
    mutationQueue = result.catch(() => undefined);
    return result;
  }

  function post(path, body) {
    return enqueueMutation(() => request(path, {
      method: "POST",
      body: JSON.stringify(body || {})
    }));
  }

  window.ClimaParcApi = {
    session() {
      return request("/api/session");
    },
    hasPendingMutations() {
      return pendingMutations > 0;
    },
    mutationGeneration() {
      return mutationGeneration;
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
    completeWorkOrderApartment(workOrderId, apartmentId) {
      return post("/api/work-order/complete-apartment", { workOrderId, apartmentId });
    },
    closeWorkOrder(workOrderId, reason) {
      return post("/api/work-order/close", { workOrderId, reason: reason || "" });
    },
    reopenWorkOrder(workOrderId, reason) {
      return post("/api/work-order/reopen", { workOrderId, reason: reason || "" });
    },
    createHvacSystem(system, workOrderId) {
      return post("/api/hvac-system", { system, workOrderId: workOrderId || "" });
    },
    routeRecommendation(interventionId, mode, workOrderId) {
      return post("/api/recommendation/route", { interventionId, mode, workOrderId: workOrderId || "" });
    },
    reviewRecommendation(interventionId, recommendation) {
      return post("/api/recommendation/review", { interventionId, recommendation });
    },
    respondRecommendation(interventionId, recommendation) {
      return post("/api/recommendation/client-response", { interventionId, recommendation });
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
      return enqueueMutation(() => requestForm("/api/file-upload", formData));
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
