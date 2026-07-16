(function () {
  function stateProxy(getState) {
    return new Proxy({}, {
      get: (_target, prop) => getState()[prop],
      set(_target, prop, value) { getState()[prop] = value; return true; }
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

      function activityTypeForOrder(order) {
        return state.interventionTypes.find((item) => item.id === (order.defaultActivityTypeId || order.typeId));
      }

      function assignedToCurrentTechnician(order) {
        if (currentUser()?.role !== "technicien") return true;
        return new Set([order.technicianId, ...(order.assignedTechnicianIds || [])].filter(Boolean)).has(currentUser()?.id);
      }

      function filteredWorkOrders() {
        const filters = state.workOrderFilters || seed.workOrderFilters;
        return scopedWorkOrders().filter((order) => {
          const { equipment, apartment, building } = workOrderContext(order);
          const type = activityTypeForOrder(order);
          const assignedIds = new Set([order.technicianId, ...(order.assignedTechnicianIds || [])].filter(Boolean));
          const haystack = searchText(order.number, order.object, type?.name, order.status, statusText(order.status), order.notes, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, order.scheduledDate, formatDate(order.scheduledDate));
          return (filters.buildingId === "all" || building?.id === filters.buildingId || order.buildingId === filters.buildingId)
            && (filters.technicianId === "all" || assignedIds.has(filters.technicianId))
            && (filters.status === "all" || order.status === filters.status)
            && (!filters.startDate || order.scheduledDate >= filters.startDate)
            && (!filters.endDate || order.scheduledDate <= filters.endDate)
            && (!filters.search || haystack.includes(normalizeSearch(filters.search)));
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
        const canExecute = assignedToCurrentTechnician(order) && !["termine", "annule"].includes(order.status);
        const canManage = ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("workorders");
        const firstApartmentId = workOrderApartments(order)[0]?.id || order.apartmentId || "";
        const formButton = canExecute && firstApartmentId
          ? `<button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${escapeHtml(order.id)}" data-apartment="${escapeHtml(firstApartmentId)}" data-activity-type="${escapeHtml(order.defaultActivityTypeId || order.typeId || "")}">Remplir le formulaire</button>`
          : "";
        return `<div class="actions"><button class="${canExecute ? "primary-button" : "ghost-button"}" data-action="execute-workorder" data-id="${escapeHtml(order.id)}">${canExecute ? "Exécuter" : "Consulter"}</button>${formButton}${canManage ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${escapeHtml(order.id)}">Modifier</button>` : ""}</div>`;
      }

      function workOrderItem(order, expanded = false, dashboardLink = false) {
        const { equipment, apartment, building } = workOrderContext(order);
        const type = activityTypeForOrder(order);
        const assignedTechs = (order.assignedTechnicianIds || []).map((id) => state.users.find((user) => user.id === id)?.name).filter(Boolean).join(", ");
        const progress = workOrderProgress(order);
        const scopeLabel = order.buildingId ? "Bloc complet" : `Apt ${apartment?.number || "-"} - ${equipment?.type || "-"}`;
        return `<article class="list-item ${dashboardLink ? "clickable-card" : ""}" ${dashboardLink ? `data-action="dashboard-workorder" data-id="${escapeHtml(order.id)}"` : ""}>
          <div class="actions" style="justify-content:space-between"><h3>${escapeHtml(order.number)} - ${escapeHtml(order.object || type?.name || "")}</h3>${statusBadge(order.status)}</div>
          <div class="meta">RDV: ${formatDate(order.scheduledDate)}</div>${assignedTechs ? `<div class="meta">Techniciens assignés: ${escapeHtml(assignedTechs)}</div>` : ""}<div class="meta">${escapeHtml(building?.name || "-")} - ${escapeHtml(scopeLabel)}</div>
          <div class="progress-line"><span style="width:${progress.percent}%"></span></div><div class="meta">${progress.doneApartments}/${progress.totalApartments} appartement(s) | ${progress.machines} machine(s) | ${progress.activities || 0} activité(s)</div><div class="meta">Activité suggérée: ${escapeHtml(type?.name || "-")}</div>${workOrderActionButtons(order, expanded)}
        </article>`;
      }

      function workOrdersView() {
        const orders = filteredWorkOrders();
        return appShell(`${renderTopbar("Bons de travail", "Planification, assignation et exécution des activités.", canCreateWorkOrders() ? `<button class="primary-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : "")}<section class="panel"><div class="panel-body">${workOrderFiltersBlock()}</div></section><section class="panel"><div class="panel-body cards-list">${orders.map((order) => workOrderItem(order, true)).join("") || `<div class="empty">Aucun bon de travail.</div>`}</div></section>`);
      }

      function executionApartmentButton(order, apartment, selectedId) {
        const activities = interventionsForOrder(order.id).filter((item) => (item.apartmentId || state.equipment.find((eq) => eq.id === item.equipmentId)?.apartmentId) === apartment.id);
        const targets = state.workOrderTargets.filter((item) => item.workOrderId === order.id && item.apartmentId === apartment.id);
        const completed = targets.length > 0 && targets.every((item) => ["termine", "annule"].includes(item.status));
        return `<button class="mini-row ${selectedId === apartment.id ? "active" : ""}" data-action="select-execution-apartment" data-id="${apartment.id}"><strong>Appartement ${escapeHtml(apartment.number)}</strong><span>${completed ? "Terminé" : activities.length ? `${activities.length} activité(s)` : "À faire"}</span></button>`;
      }

      function fieldResponseCard(intervention, canCorrect = false) {
        const equipment = state.equipment.find((item) => item.id === intervention.equipmentId);
        const activityType = state.interventionTypes.find((item) => item.id === intervention.typeId);
        const responses = Object.entries(intervention.formResponses || {}).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml((Array.isArray(value) ? value.join(", ") : value) || "-")}</strong></div>`).join("");
        return `<article class="activity-detail"><div class="activity-detail-head"><div><strong>${escapeHtml(activityType?.name || "Activité")}</strong><span>${formatDate(intervention.date)}</span></div><span>${statusBadge(intervention.activityStatus || intervention.status)} ${statusBadge(intervention.machineStatus || equipment?.status)}</span></div><div class="definition compact">${responses || `<div><span>Formulaire</span><strong>Aucune réponse</strong></div>`}</div>${intervention.recommendation?.type ? `<div class="meta"><strong>Recommandation:</strong> ${escapeHtml(dataFieldLabelByValue("recommendation_type", intervention.recommendation.type))}</div>` : ""}${intervention.summary ? `<div class="legacy-summary-note"><strong>Note historique</strong><span>${escapeHtml(intervention.summary)}</span></div>` : ""}<div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${escapeHtml(intervention.workOrderId)}" data-apartment="${escapeHtml(intervention.apartmentId || equipment?.apartmentId || "")}" data-equipment="${escapeHtml(intervention.equipmentId || "")}" data-intervention="${escapeHtml(intervention.id)}" data-activity-type="${escapeHtml(intervention.typeId || "")}" data-read-only="${canCorrect ? "false" : "true"}">${canCorrect ? "Corriger" : "Consulter"}</button></div></article>`;
      }

      function unitPositionLabel(machine, topology) {
        if (topology === "monobloc" || machine.unitKind === "monobloc") return "Système unique";
        return machine.unitKind === "exterieure" ? "Unité extérieure" : "Unité intérieure";
      }

      function machineAccordion(order, machine, currentActivities, history, canExecute, system, topology) {
        const type = state.hvacSystemTypes.find((item) => item.id === system?.systemTypeId);
        const position = unitPositionLabel(machine, topology);
        return `<details class="machine-accordion"><summary><div class="machine-accordion-title"><strong>${escapeHtml(position)}</strong><span>${escapeHtml(machine.model || "Modèle non précisé")} | ${escapeHtml(machine.serial || "Sans numéro de série")} | ${escapeHtml(machine.location || "Localisation non précisée")}</span></div>${statusBadge(machine.status)}</summary><div class="machine-accordion-body"><div class="definition compact machine-identity"><div><span>Type de système</span><strong>${escapeHtml(type?.name || system?.name || machine.type || "-")}</strong></div><div><span>Marque</span><strong>${escapeHtml(system?.brand || machine.brand || "-")}</strong></div><div><span>Modèle</span><strong>${escapeHtml(machine.model || "-")}</strong></div><div><span>Numéro de série</span><strong>${escapeHtml(machine.serial || "-")}</strong></div><div><span>Localisation</span><strong>${escapeHtml(machine.location || "-")}</strong></div><div><span>Année / âge estimé</span><strong>${escapeHtml(machine.manufactureAgeInfo || "-")}</strong></div></div><div class="machine-activities"><h4>Activités de ce BT</h4>${currentActivities.map((activity) => fieldResponseCard(activity, canExecute)).join("") || `<div class="empty compact-empty">Aucune activité dans ce BT.</div>`}</div><details class="machine-history"><summary>Historique antérieur (${history.length})</summary><div class="machine-history-list">${history.map((activity) => fieldResponseCard(activity, false)).join("") || `<div class="empty compact-empty">Aucune intervention antérieure.</div>`}</div></details>${canExecute ? `<div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${escapeHtml(order.id)}" data-apartment="${escapeHtml(machine.apartmentId || "")}" data-equipment="${escapeHtml(machine.id)}" data-system="${escapeHtml(machine.systemId || "")}" data-activity-type="${escapeHtml(order.defaultActivityTypeId || order.typeId || "")}">Ajouter une activité</button></div>` : ""}</div></details>`;
      }

      function workOrderExecutionView() {
        const order = state.workOrders.find((item) => item.id === state.selectedWorkOrderId);
        if (!order) return workOrdersView();
        const { building } = workOrderContext(order);
        const suggestedType = activityTypeForOrder(order);
        const progress = workOrderProgress(order);
        const apartments = workOrderApartments(order);
        const selectedApartment = apartments.find((item) => item.id === state.selectedExecutionApartmentId) || apartments[0];
        const apartmentActivities = interventionsForOrder(order.id).filter((item) => (item.apartmentId || state.equipment.find((eq) => eq.id === item.equipmentId)?.apartmentId) === selectedApartment?.id);
        const machines = selectedApartment ? equipmentForApartment(selectedApartment.id) : [];
        const apartmentTargets = state.workOrderTargets.filter((item) => item.workOrderId === order.id && item.apartmentId === selectedApartment?.id);
        const targetExecutable = !apartmentTargets.some((item) => item.approvalStatus === "pending");
        const apartmentCompleted = apartmentTargets.length > 0 && apartmentTargets.every((item) => ["termine", "annule"].includes(item.status));
        const canExecute = currentUser()?.role !== "client"
          && assignedToCurrentTechnician(order)
          && !["termine", "annule"].includes(order.status)
          && targetExecutable;
        const canManage = ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("workorders");
        const systems = state.hvacSystems.filter((item) => item.apartmentId === selectedApartment?.id && item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
        const groups = [...systems.map((system) => ({ system, machines: machines.filter((machine) => machine.systemId === system.id) })), { system: null, machines: machines.filter((machine) => !machine.systemId || !systems.some((system) => system.id === machine.systemId)) }].filter((group) => group.machines.length || group.system);
        const lifecycle = canManage ? (order.status === "termine" ? `<button class="ghost-button" data-action="reopen-workorder" data-id="${order.id}">Réouvrir le BT</button>` : `<button class="ghost-button" data-action="close-workorder" data-id="${order.id}">Clôturer le BT</button>`) : "";
        const topActions = `<button class="ghost-button" data-action="go-back" data-fallback-view="bons">Retour</button>${!targetExecutable ? `<span class="badge warning">Approbation en attente</span>` : ""}${lifecycle}`;
        const groupHtml = groups.map((group) => {
          const systemType = state.hvacSystemTypes.find((item) => item.id === group.system?.systemTypeId);
          const topology = group.system?.topology || systemType?.topology || "split";
          const exterior = group.machines.filter((item) => item.unitKind === "exterieure");
          const interiors = group.machines.filter((item) => item.unitKind !== "exterieure");
          const unitButtons = canExecute && group.system && topology === "split" ? `<div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-system="${escapeHtml(group.system.id)}" data-unit-kind="interieure" data-activity-type="${escapeHtml(order.defaultActivityTypeId || order.typeId || "")}">+ Unité intérieure</button>${exterior.length ? "" : `<button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-system="${escapeHtml(group.system.id)}" data-unit-kind="exterieure" data-activity-type="${escapeHtml(order.defaultActivityTypeId || order.typeId || "")}">+ Unité extérieure</button>`}</div>` : "";
          const renderMachine = (machine) => machineAccordion(order, machine, apartmentActivities.filter((item) => item.equipmentId === machine.id), state.interventions.filter((item) => item.equipmentId === machine.id && item.workOrderId !== order.id).sort((a, b) => (b.date || "").localeCompare(a.date || "")), canExecute, group.system, topology);
          const systemBody = topology === "split" ? `<div class="split-system-visual"><div class="outdoor-unit-column">${exterior.map(renderMachine).join("") || `<div class="system-placeholder">Unité extérieure à ajouter</div>`}</div><div class="system-connection" aria-hidden="true"><span></span></div><div class="indoor-units-column">${interiors.map(renderMachine).join("") || `<div class="system-placeholder">Unité intérieure à ajouter</div>`}</div></div>` : `<div class="monobloc-system">${group.machines.map(renderMachine).join("")}</div>`;
          return `<section class="hvac-system-group"><div class="system-group-header"><div><strong>${escapeHtml(group.system?.name || "Système à confirmer")}</strong><span>${escapeHtml(systemType?.name || group.machines[0]?.type || "-")} | ${escapeHtml(group.system?.brand || group.machines[0]?.brand || "Marque à confirmer")}</span></div>${unitButtons}</div>${systemBody}</section>`;
        }).join("");
        return appShell(`${renderTopbar(`Exécution ${order.number}`, `${building?.name || "-"} - ${order.object || suggestedType?.name || ""}`, topActions)}<section class="stats-grid"><div class="stat"><span>RDV</span><strong>${formatDate(order.scheduledDate)}</strong></div><div class="stat"><span>Progression</span><strong>${progress.percent}%</strong></div><div class="stat"><span>Appartements</span><strong>${progress.doneApartments}/${progress.totalApartments}</strong></div><div class="stat"><span>Machines</span><strong>${progress.machines}</strong></div><div class="stat"><span>Activités</span><strong>${progress.activities || 0}</strong></div></section><section class="progress-panel"><div class="progress-line large"><span style="width:${progress.percent}%"></span></div></section><section class="execution-layout"><div class="panel"><div class="panel-header"><h2>Appartements du bloc</h2></div><div class="panel-body cards-list">${apartments.map((item) => executionApartmentButton(order, item, selectedApartment?.id)).join("") || `<div class="empty">Aucun appartement dans ce BT.</div>`}</div></div><div class="stack"><div class="panel"><div class="panel-header"><h2>Appartement ${escapeHtml(selectedApartment?.number || "-")}</h2>${canExecute ? `<div class="actions"><button class="ghost-button" data-action="new-hvac-system" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouveau système HVAC</button></div>` : ""}</div><div class="panel-body cards-list">${groupHtml || `<div class="empty">Aucune machine enregistrée pour cet appartement.</div>`}${canExecute && !apartmentCompleted ? `<div class="actions apartment-completion-action"><button class="primary-button" data-action="complete-workorder-apartment" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Terminer cet appartement</button></div>` : apartmentCompleted ? `<div class="success-summary"><strong>Appartement terminé</strong></div>` : ""}</div></div></div></section>`);
      }

      function workOrderModal(modal) {
        const order = state.workOrders.find((item) => item.id === modal.id) || {};
        const scope = order.scope || (order.buildingId || !modal.equipmentId ? "building" : "equipment");
        const buildingId = order.buildingId || equipmentContext(modal.equipmentId)?.building?.id || scopedBuildings()[0]?.id || "";
        const buildingOptions = scopedBuildings().map((item) => `<option value="${item.id}" ${buildingId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
        const selectedEquipmentId = order.equipmentId || modal.equipmentId;
        const equipmentOptions = scopedEquipment().map((item) => { const { apartment, building } = equipmentContext(item.id); return `<option value="${item.id}" ${selectedEquipmentId === item.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment?.number || "")} - ${escapeHtml(item.type)}</option>`; }).join("");
        const assigned = new Set([...(order.assignedTechnicianIds || []), order.technicianId].filter(Boolean));
        const techs = state.users.filter((user) => user.role === "technicien").map((user) => `<label><input type="checkbox" name="assignedTechnicianIds" value="${escapeHtml(user.id)}" ${assigned.has(user.id) ? "checked" : ""}> ${escapeHtml(user.name)}</label>`).join("") || `<span class="meta">Aucun technicien créé.</span>`;
        const selectedType = activityTypeForOrder(order) || state.interventionTypes[0];
        const selectedFormTemplateId = order.formTemplateId || selectedType?.defaultFormTemplateId || "";
        return modalShell(order.id ? "Modifier le bon de travail" : "Nouveau bon de travail", `<form class="form-grid" data-form="workorder"><input type="hidden" name="id" value="${escapeHtml(order.id || "")}"><input type="hidden" name="ticketId" value="${escapeHtml(modal.ticketId || order.ticketId || "")}"><input type="hidden" name="sourceReminderId" value="${escapeHtml(modal.reminderId || order.sourceReminderId || "")}"><div class="split"><div class="field"><label>Portée du BT</label><select name="scope"><option value="building" ${scope === "building" ? "selected" : ""}>Bloc complet / immeuble</option><option value="equipment" ${scope === "equipment" ? "selected" : ""}>Machine précise</option></select></div><div class="field"><label>Objet du BT</label><input name="object" value="${escapeHtml(order.object || "")}" required placeholder="Ex.: Entretien annuel du parc"></div></div><div class="split"><div class="field"><label>Immeuble</label><select name="buildingId"><option value="">-</option>${buildingOptions}</select></div><div class="field"><label>Équipement</label><select name="equipmentId"><option value="">-</option>${equipmentOptions}</select></div></div><div class="split"><div class="field"><label>Activité suggérée</label><select name="defaultActivityTypeId" data-workorder-type>${state.interventionTypes.filter((item) => item.active !== false).map((item) => `<option value="${item.id}" ${selectedType?.id === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select><input type="hidden" name="formTemplateId" data-workorder-form-template value="${escapeHtml(selectedFormTemplateId)}"></div><div class="field"><label>Techniciens assignés</label><div class="choice-list">${techs}</div></div></div><div class="split"><div class="field"><label>Date du RDV</label><input name="scheduledDate" type="date" value="${escapeHtml(order.scheduledDate || today())}" required></div><div class="field"><label>Statut</label><select name="status"><option value="brouillon" ${order.status === "brouillon" ? "selected" : ""}>Brouillon</option><option value="planifie" ${(!order.status || order.status === "planifie") ? "selected" : ""}>Planifié</option><option value="en_cours" ${order.status === "en_cours" ? "selected" : ""}>En cours</option><option value="termine" ${order.status === "termine" ? "selected" : ""}>Terminé</option><option value="annule" ${order.status === "annule" ? "selected" : ""}>Annulé</option></select></div></div><div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(order.notes || "")}</textarea></div><button class="primary-button" type="submit">${order.id ? "Enregistrer" : "Créer le BT"}</button></form>`);
      }

      function updateWorkOrderDefaultForm(select) {
        const form = select?.closest("form[data-form='workorder']");
        if (!form) return;
        const type = state.interventionTypes.find((item) => item.id === select.value);
        const input = form.querySelector("[data-workorder-form-template]");
        if (input) input.value = type?.defaultFormTemplateId || "";
      }

      function markReminderWorkOrderOpened(reminderId, orderId) {
        const reminder = state.reminders.find((item) => item.id === reminderId);
        if (!reminder) return;
        reminder.lastWorkOrderId = orderId;
        reminder.lastOpenedAt = today();
        reminder.lastSeenDueDate = reminder.nextDueDate || reminder.lastSeenDueDate || "";
      }

      async function createWorkOrder(form, values) {
        const backups = { workOrders: JSON.parse(JSON.stringify(state.workOrders)), tickets: JSON.parse(JSON.stringify(state.tickets)), reminders: JSON.parse(JSON.stringify(state.reminders)) };
        const scope = values.scope || "equipment";
        const assignedTechnicianIds = Array.from(form.querySelectorAll('[name="assignedTechnicianIds"]:checked')).map((input) => input.value);
        if (scope === "building" && !values.buildingId) return showToast("Choisissez un immeuble.");
        if (scope === "equipment" && !values.equipmentId) return showToast("Choisissez un équipement.");
        const existing = state.workOrders.find((item) => item.id === values.id);
        const payload = existing || { id: uid("wo"), number: `BT-${new Date().getFullYear()}-${String(state.workOrders.length + 1).padStart(3, "0")}` };
        Object.assign(payload, { ticketId: values.ticketId || payload.ticketId || null, scope, buildingId: scope === "building" ? values.buildingId : "", equipmentId: scope === "equipment" ? values.equipmentId : "", object: values.object || "", defaultActivityTypeId: values.defaultActivityTypeId || "", typeId: values.defaultActivityTypeId || "", formTemplateId: values.formTemplateId || state.interventionTypes.find((item) => item.id === values.defaultActivityTypeId)?.defaultFormTemplateId || "", technicianId: assignedTechnicianIds[0] || "", assignedTeam: "", assignedTechnicianIds, scheduledDate: values.scheduledDate, status: values.status, notes: values.notes, sourceReminderId: values.sourceReminderId || payload.sourceReminderId || "" });
        if (!existing) state.workOrders.unshift(payload);
        if (values.sourceReminderId) markReminderWorkOrderOpened(values.sourceReminderId, payload.id);
        const linkedTicket = values.ticketId ? state.tickets.find((item) => item.id === values.ticketId) : null;
        if (linkedTicket && !existing) linkedTicket.status = "en_cours";
        const uiPatch = { activeView: "bons" };
        try {
          await saveDomainItemNow(api.saveWorkOrder, payload, uiPatch, existing ? "Bon de travail modifié." : "Bon de travail créé.");
          if (values.sourceReminderId) await api.saveReminder(state.reminders.find((item) => item.id === values.sourceReminderId));
          if (linkedTicket) await api.saveTicket(linkedTicket);
        } catch (error) {
          state.workOrders = backups.workOrders; state.tickets = backups.tickets; state.reminders = backups.reminders;
          updateUiState({ modal: null, ...uiPatch, toast: error.message || "Bon de travail non sauvegardé." });
        }
      }

      return { createWorkOrder, executionApartmentButton, fieldResponseCard, filteredWorkOrders, markReminderWorkOrderOpened, workOrderActionButtons, workOrderExecutionView, updateWorkOrderDefaultForm, workOrderFiltersBlock, workOrderItem, workOrderModal, workOrdersView };
    }
  };
})();
