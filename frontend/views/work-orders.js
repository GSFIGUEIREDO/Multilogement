(function () {
  function stateProxy(getState) {
    return new Proxy({}, {
      get: (_target, prop) => getState()[prop],
      set(_target, prop, value) {
        getState()[prop] = value;
        return true;
      }
    });
  }

  window.ClimaParcWorkOrdersView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        api, seed, appShell, renderTopbar, can, canCreateWorkOrders, currentUser,
        scopedWorkOrders, scopedBuildings, scopedEquipment, equipmentContext,
        workOrderContext, workOrderProgress, workOrderApartments, interventionsForOrder,
        formTemplateForOrder, equipmentForApartment, searchText, normalizeSearch,
        statusText, statusBadge, formatDate, escapeHtml, dataFieldLabelByValue,
        modalShell, today, uid, showToast, updateUiState, saveDomainItemNow,
        acceptServerState
      } = context;

      function filteredWorkOrders() {
        const filters = state.workOrderFilters || seed.workOrderFilters;
        return scopedWorkOrders().filter((order) => {
          const { equipment, apartment, building } = workOrderContext(order);
          const type = state.interventionTypes.find((item) => item.id === order.typeId);
          const assignedIds = new Set([order.technicianId, ...(order.assignedTechnicianIds || [])].filter(Boolean));
          const haystack = searchText(order.number, type?.name, order.status, statusText(order.status), order.notes, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, order.scheduledDate, formatDate(order.scheduledDate));
          return (
            (filters.buildingId === "all" || building?.id === filters.buildingId || order.buildingId === filters.buildingId) &&
            (filters.technicianId === "all" || assignedIds.has(filters.technicianId)) &&
            (filters.status === "all" || order.status === filters.status) &&
            (!filters.startDate || order.scheduledDate >= filters.startDate) &&
            (!filters.endDate || order.scheduledDate <= filters.endDate) &&
            (!filters.search || haystack.includes(normalizeSearch(filters.search)))
          );
        });
      }

      function workOrderFiltersBlock() {
        const filters = state.workOrderFilters || seed.workOrderFilters;
        return `<div class="filters">
          <div class="field"><label>Immeuble</label><select data-action="workorder-filter" data-filter="buildingId"><option value="all">Tous</option>${scopedBuildings().map((building) => `<option value="${building.id}" ${filters.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Technicien</label><select data-action="workorder-filter" data-filter="technicianId"><option value="all">Tous</option>${state.users.filter((user) => user.role === "technicien").map((user) => `<option value="${user.id}" ${filters.technicianId === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Statut</label><select data-action="workorder-filter" data-filter="status"><option value="all">Tous</option><option value="planifie" ${filters.status === "planifie" ? "selected" : ""}>Planifié</option><option value="en_cours" ${filters.status === "en_cours" ? "selected" : ""}>En cours</option><option value="termine" ${filters.status === "termine" ? "selected" : ""}>Terminé</option><option value="annule" ${filters.status === "annule" ? "selected" : ""}>Annulé</option></select></div>
          <div class="field"><label>Début</label><input type="date" data-action="workorder-filter" data-filter="startDate" value="${escapeHtml(filters.startDate || "")}"></div><div class="field"><label>Fin</label><input type="date" data-action="workorder-filter" data-filter="endDate" value="${escapeHtml(filters.endDate || "")}"></div><div class="field"><label>Recherche</label><input data-action="workorder-filter" data-filter="search" value="${escapeHtml(filters.search || "")}" placeholder="BT, machine, série, adresse"></div>
        </div>`;
      }

      function workOrderActionButtons(order, expanded) {
        if (!expanded) return "";
        if (currentUser()?.role === "client") return `<div class="actions"><button class="ghost-button" data-action="execute-workorder" data-id="${escapeHtml(order.id)}">Consulter</button></div>`;
        const canManageOrder = ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("workorders");
        return `<div class="actions"><button class="primary-button" data-action="execute-workorder" data-id="${escapeHtml(order.id)}">Exécuter</button>${order.equipmentId ? `<button class="ghost-button" data-action="open-checklist" data-id="${escapeHtml(order.id)}">Checklist</button>` : ""}${canManageOrder ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${escapeHtml(order.id)}">Modifier</button><button class="ghost-button" data-action="order-status" data-id="${escapeHtml(order.id)}" data-status="termine">Terminer</button>` : ""}</div>`;
      }

      function workOrderItem(order, expanded = false, dashboardLink = false) {
        const { equipment, apartment, building } = workOrderContext(order);
        const type = state.interventionTypes.find((item) => item.id === order.typeId);
        const assignedTechs = (order.assignedTechnicianIds || []).map((id) => state.users.find((user) => user.id === id)?.name).filter(Boolean).join(", ");
        const progress = workOrderProgress(order);
        const scopeLabel = order.buildingId ? "Bloc complet" : `Apt ${apartment?.number || "-"} - ${equipment?.type || "-"}`;
        return `<article class="list-item ${dashboardLink ? "clickable-card" : ""}" ${dashboardLink ? `data-action="dashboard-workorder" data-id="${escapeHtml(order.id)}"` : ""}>
          <div class="actions" style="justify-content:space-between"><h3>${escapeHtml(order.number)} - ${escapeHtml(type?.name || "")}</h3>${statusBadge(order.status)}</div>
          <div class="meta">RDV: ${formatDate(order.scheduledDate)}</div>${assignedTechs ? `<div class="meta">Techniciens assignés: ${escapeHtml(assignedTechs)}</div>` : ""}<div class="meta">${escapeHtml(building?.name || "-")} - ${escapeHtml(scopeLabel)}</div>
          <div class="progress-line"><span style="width:${progress.percent}%"></span></div><div class="meta">${progress.doneApartments}/${progress.totalApartments} appartement${progress.totalApartments > 1 ? "s" : ""} realisé${progress.doneApartments > 1 ? "s" : ""} | ${progress.machines} machine${progress.machines > 1 ? "s" : ""} analysée${progress.machines > 1 ? "s" : ""}</div><div class="meta">${escapeHtml(order.notes || "")}</div>${workOrderActionButtons(order, expanded)}
        </article>`;
      }

      function workOrdersView() {
        const orders = filteredWorkOrders();
        return appShell(`${renderTopbar("Bons de travail", "Planification, assignation technicien et exécution des checklists.", canCreateWorkOrders() ? `<button class="primary-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : "")}<section class="panel"><div class="panel-body">${workOrderFiltersBlock()}</div></section><section class="panel"><div class="panel-body cards-list">${orders.map((order) => workOrderItem(order, true)).join("") || `<div class="empty">Aucun bon de travail.</div>`}</div></section>`);
      }

      function executionApartmentButton(order, apartment, selectedId) {
        const interventions = interventionsForOrder(order.id).filter((item) => {
          const equipment = state.equipment.find((eq) => eq.id === item.equipmentId);
          return (item.apartmentId || equipment?.apartmentId) === apartment.id;
        });
        return `<button class="mini-row ${selectedId === apartment.id ? "active" : ""}" data-action="select-execution-apartment" data-id="${apartment.id}"><strong>Appartement ${escapeHtml(apartment.number)}</strong><span>${interventions.length ? `${interventions.length} machine(s) analysee(s)` : "A faire"}</span></button>`;
      }

      function fieldResponseCard(intervention) {
        const equipment = state.equipment.find((item) => item.id === intervention.equipmentId);
        const responses = Object.entries(intervention.formResponses || {}).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml((Array.isArray(value) ? value.join(", ") : value) || "-")}</strong></div>`).join("");
        return `<article class="list-item">
          <div class="actions" style="justify-content:space-between"><h3>${escapeHtml(equipment?.type || "Machine")}</h3><span>${statusBadge(intervention.activityStatus || intervention.status)} ${statusBadge(intervention.machineStatus || equipment?.status)}</span></div>
          <div class="meta">${intervention.unitKind === "exterieure" ? "Unité extérieure" : "Unité intérieure"} | Statut machine observé: ${statusText(intervention.machineStatus || equipment?.status)}</div><div class="definition compact">${responses || `<div><span>Formulaire</span><strong>Aucune reponse</strong></div>`}</div>
          ${intervention.recommendation?.type ? `<div class="definition compact"><div><span>Recommandation</span><strong>${escapeHtml(dataFieldLabelByValue("recommendation_type", intervention.recommendation.type))}</strong></div><div><span>Priorité</span><strong>${escapeHtml(statusText(intervention.recommendation.priority) || "-")}</strong></div><div><span>Pièce nécessaire</span><strong>${escapeHtml(intervention.recommendation.part || "-")}</strong></div><div><span>Temps prévu</span><strong>${escapeHtml(intervention.recommendation.time || "-")}</strong></div><div><span>Statut</span><strong>${escapeHtml(statusText(intervention.recommendation.status || "a_valider"))}</strong></div></div><div class="meta">${escapeHtml(intervention.recommendation.description || "")}</div>` : ""}
          ${intervention.attachments?.length ? `<div class="mini-list">${intervention.attachments.map((file) => `<div class="meta">Pièce jointe: ${escapeHtml(file.name)} | Origine: ${escapeHtml(state.workOrders.find((item) => item.id === file.workOrderId || item.id === intervention.workOrderId)?.number || "-")}</div>`).join("")}</div>` : ""}<div class="meta">${escapeHtml(intervention.summary || "")}</div>
        </article>`;
      }

      function workOrderExecutionView() {
        const order = state.workOrders.find((item) => item.id === state.selectedWorkOrderId);
        if (!order) return workOrdersView();
        const { building } = workOrderContext(order);
        const type = state.interventionTypes.find((item) => item.id === order.typeId);
        const template = formTemplateForOrder(order);
        const progress = workOrderProgress(order);
        const apartments = workOrderApartments(order);
        const selectedApartment = apartments.find((item) => item.id === state.selectedExecutionApartmentId) || apartments[0];
        const apartmentInterventions = interventionsForOrder(order.id).filter((item) => {
          const equipment = state.equipment.find((eq) => eq.id === item.equipmentId);
          return (item.apartmentId || equipment?.apartmentId) === selectedApartment?.id;
        });
        const machines = selectedApartment ? equipmentForApartment(selectedApartment.id) : [];
        const canPerformInterventions = currentUser()?.role !== "client" && (can("workorders") || can("interventions"));
        const canManageOrder = ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("workorders");
        const machineIds = new Set(machines.map((machine) => machine.id));
        const previousInterventions = state.interventions
          .filter((item) => machineIds.has(item.equipmentId) && item.workOrderId !== order.id)
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        return appShell(`${renderTopbar(`Execution ${order.number}`, `${building?.name || "-"} - ${type?.name || ""}`, `<button class="ghost-button" data-action="go-back" data-fallback-view="bons">Retour</button>${canManageOrder ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${order.id}">Changer le formulaire</button>` : ""}${canPerformInterventions ? `<button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button>` : ""}`)}
          <section class="stats-grid"><div class="stat"><span>RDV</span><strong>${formatDate(order.scheduledDate)}</strong></div><div class="stat"><span>Progression</span><strong>${progress.percent}%</strong></div><div class="stat"><span>Appartements realises</span><strong>${progress.doneApartments}/${progress.totalApartments}</strong></div><div class="stat"><span>Machines analysees</span><strong>${progress.machines}</strong></div>${canPerformInterventions ? `<div class="stat"><span>Formulaire</span><strong>${escapeHtml(template?.name || "-")}</strong></div>` : ""}</section>
          <section class="progress-panel"><div class="progress-line large"><span style="width:${progress.percent}%"></span></div></section>
          <section class="execution-layout"><div class="panel"><div class="panel-header"><h2>Appartements du bloc</h2></div><div class="panel-body cards-list">${apartments.map((item) => executionApartmentButton(order, item, selectedApartment?.id)).join("") || `<div class="empty">Aucun appartement dans ce BT.</div>`}</div></div>
          <div class="stack"><div class="panel"><div class="panel-header"><h2>Appartement ${escapeHtml(selectedApartment?.number || "-")}</h2>${canPerformInterventions ? `<div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-unit-kind="interieure">+ Unité intérieure</button><button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-unit-kind="exterieure">+ Unité extérieure</button><button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button></div>` : ""}</div>
          <div class="panel-body cards-list">${machines.map((machine) => {
            const intervention = apartmentInterventions.find((item) => item.equipmentId === machine.id);
            const formAction = !intervention && canPerformInterventions
              ? `<button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-equipment="${machine.id}">Remplir le formulaire</button>`
              : intervention && canManageOrder
                ? `<button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-equipment="${machine.id}">Modifier le formulaire</button>`
                : "";
            return `<article class="list-item"><div class="actions" style="justify-content:space-between"><h3>${escapeHtml(machine.type)}</h3>${intervention ? statusBadge("terminee") : statusBadge("planifie")}</div><div class="meta">${escapeHtml(machine.brand)} ${escapeHtml(machine.model)} - ${escapeHtml(machine.location || "-")}</div>${formAction ? `<div class="actions">${formAction}</div>` : ""}</article>`;
          }).join("") || `<div class="empty">Aucune machine encore cadastrée pour cet appartement.</div>`}</div></div><div class="panel"><div class="panel-header"><h2>Informations collectées</h2></div><div class="panel-body cards-list">${apartmentInterventions.map(fieldResponseCard).join("") || `<div class="empty">Aucune information saisie pour cet appartement.</div>`}</div></div><div class="panel"><div class="panel-header"><h2>Interventions précédentes</h2></div><div class="panel-body cards-list">${previousInterventions.map(fieldResponseCard).join("") || `<div class="empty">Aucune intervention antérieure pour les machines de cet appartement.</div>`}</div></div></div></section>`);
      }

      function workOrderModal(modal) {
        const order = state.workOrders.find((item) => item.id === modal.id) || {};
        const scope = order.scope || (order.buildingId || !modal.equipmentId ? "building" : "equipment");
        const buildingId = order.buildingId || equipmentContext(modal.equipmentId)?.building?.id || scopedBuildings()[0]?.id || "";
        const buildingOptions = scopedBuildings().map((item) => `<option value="${item.id}" ${buildingId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
        const selectedEquipmentId = order.equipmentId || modal.equipmentId;
        const equipmentOptions = scopedEquipment().map((item) => {
          const { apartment, building } = equipmentContext(item.id);
          return `<option value="${item.id}" ${selectedEquipmentId === item.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment?.number || "")} - ${escapeHtml(item.type)}</option>`;
        }).join("");
        const assigned = new Set([...(order.assignedTechnicianIds || []), order.technicianId].filter(Boolean));
        const techs = state.users.filter((user) => user.role === "technicien").map((user) => `<label><input type="checkbox" name="assignedTechnicianIds" value="${escapeHtml(user.id)}" ${assigned.has(user.id) ? "checked" : ""}> ${escapeHtml(user.name)}</label>`).join("") || `<span class="meta">Aucun technicien créé.</span>`;
        return modalShell(order.id ? "Modifier le bon de travail" : "Nouveau bon de travail", `<form class="form-grid" data-form="workorder">
          <input type="hidden" name="id" value="${escapeHtml(order.id || "")}"><input type="hidden" name="ticketId" value="${escapeHtml(modal.ticketId || order.ticketId || "")}"><input type="hidden" name="sourceReminderId" value="${escapeHtml(modal.reminderId || order.sourceReminderId || "")}">
          <div class="split"><div class="field"><label>Portee du BT</label><select name="scope"><option value="building" ${scope === "building" ? "selected" : ""}>Bloc complet / immeuble</option><option value="equipment" ${scope === "equipment" ? "selected" : ""}>Machine precise</option></select></div><div class="field"><label>Formulaire terrain</label><select name="formTemplateId">${state.formTemplates.map((item) => `<option value="${item.id}" ${order.formTemplateId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div></div>
          <div class="split"><div class="field"><label>Immeuble</label><select name="buildingId"><option value="">-</option>${buildingOptions}</select></div><div class="field"><label>Equipement</label><select name="equipmentId"><option value="">-</option>${equipmentOptions}</select></div></div>
          <div class="split"><div class="field"><label>Type d'intervention</label><select name="typeId">${state.interventionTypes.map((item) => `<option value="${item.id}" ${order.typeId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label>Techniciens assignés</label><div class="choice-list">${techs}</div></div></div>
          <div class="split"><div class="field"><label>Date du RDV</label><input name="scheduledDate" type="date" value="${escapeHtml(order.scheduledDate || today())}" required></div><div class="field"><label>Statut</label><select name="status"><option value="planifie" ${order.status === "planifie" ? "selected" : ""}>Planifié</option><option value="en_cours" ${order.status === "en_cours" ? "selected" : ""}>En cours</option><option value="termine" ${order.status === "termine" ? "selected" : ""}>Terminé</option><option value="annule" ${order.status === "annule" ? "selected" : ""}>Annulé</option></select></div></div>
          <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(order.notes || "")}</textarea></div><button class="primary-button" type="submit">${order.id ? "Enregistrer" : "Créer le BT"}</button>
        </form>`);
      }

      function markReminderWorkOrderOpened(reminderId, orderId) {
        const reminder = state.reminders.find((item) => item.id === reminderId);
        if (!reminder) return;
        reminder.lastWorkOrderId = orderId;
        reminder.lastOpenedAt = today();
        reminder.lastSeenDueDate = reminder.nextDueDate || reminder.lastSeenDueDate || "";
      }

      async function createWorkOrder(form, values) {
        const backups = {
          workOrders: JSON.parse(JSON.stringify(state.workOrders)),
          tickets: JSON.parse(JSON.stringify(state.tickets)),
          reminders: JSON.parse(JSON.stringify(state.reminders))
        };
        const scope = values.scope || "equipment";
        const assignedTechnicianIds = Array.from(form.querySelectorAll('[name="assignedTechnicianIds"]:checked')).map((input) => input.value);
        if (scope === "building" && !values.buildingId) return showToast("Choisissez un immeuble pour le BT de bloc.");
        if (scope === "equipment" && !values.equipmentId) return showToast("Choisissez un equipement pour le BT.");
        const existing = state.workOrders.find((item) => item.id === values.id);
        const payload = existing || { id: uid("wo"), number: `BT-${new Date().getFullYear()}-${String(state.workOrders.length + 1).padStart(3, "0")}` };
        Object.assign(payload, {
          ticketId: values.ticketId || payload.ticketId || null, scope,
          buildingId: scope === "building" ? values.buildingId : "",
          equipmentId: scope === "equipment" ? values.equipmentId : "",
          typeId: values.typeId, formTemplateId: values.formTemplateId || state.formTemplates[0]?.id || "",
          technicianId: values.technicianId || assignedTechnicianIds[0] || "",
          assignedTeam: "", assignedTechnicianIds, scheduledDate: values.scheduledDate,
          status: values.status, notes: values.notes,
          sourceReminderId: values.sourceReminderId || payload.sourceReminderId || ""
        });
        if (!existing) state.workOrders.unshift(payload);
        if (values.sourceReminderId) markReminderWorkOrderOpened(values.sourceReminderId, payload.id);
        const linkedTicket = values.ticketId ? state.tickets.find((item) => item.id === values.ticketId) : null;
        if (linkedTicket && !existing) linkedTicket.status = "en_cours";
        const uiPatch = { activeView: "bons" };
        const successToast = existing ? "Bon de travail modifié." : "Bon de travail créé.";
        updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde du bon de travail..." });
        try {
          await saveDomainItemNow(api.saveWorkOrder, payload, uiPatch, successToast);
          const reminder = values.sourceReminderId ? state.reminders.find((item) => item.id === values.sourceReminderId) : null;
          if (reminder) {
            const response = await api.saveReminder(reminder);
            if (response.state) acceptServerState(response.state, { ...uiPatch, modal: null, toast: successToast });
          }
          if (linkedTicket) {
            const response = await api.saveTicket(linkedTicket);
            if (response.state) acceptServerState(response.state, { ...uiPatch, modal: null, toast: successToast });
          }
        } catch (error) {
          state.workOrders = backups.workOrders;
          state.tickets = backups.tickets;
          state.reminders = backups.reminders;
          updateUiState({ modal: null, ...uiPatch, toast: error.message || "Bon de travail non sauvegardé." });
        }
      }

      return {
        createWorkOrder, executionApartmentButton, fieldResponseCard, filteredWorkOrders,
        markReminderWorkOrderOpened, workOrderActionButtons, workOrderExecutionView,
        workOrderFiltersBlock, workOrderItem, workOrderModal, workOrdersView
      };
    }
  };
})();
