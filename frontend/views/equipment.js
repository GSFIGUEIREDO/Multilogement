(function () {
  function stateProxy(getState) {
    return new Proxy({}, {
      get(_target, prop) {
        return getState()[prop];
      },
      set(_target, prop, value) {
        getState()[prop] = value;
        return true;
      }
    });
  }

  window.ClimaParcEquipmentView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        appShell, renderTopbar, currentUser, can, canCreateWorkOrders,
        canEditReminders, scopedEquipment, scopedBuildings, scopedApartments,
        scopedReminders, equipmentContext, formatDate, escapeHtml, unitKindLabel,
        statusBadge, interventionItem, ticketItem, workOrderItem, reminderItem,
        attachmentItem, modalShell, normalizeActivityFields, dataFieldOptionsForSelect,
        buildingForApartment, comboInput, activityOptions, today, uid,
        updateUiState, saveEquipmentNow
      } = context;

      function filteredEquipment() {
        const filters = state.filters;
        return scopedEquipment().filter((item) => {
          const { apartment, building } = equipmentContext(item.id);
          const search = `${item.type} ${item.brand} ${item.model} ${item.serial} ${building?.name} ${apartment?.number}`.toLowerCase();
          return (
            (filters.buildingId === "all" || building?.id === filters.buildingId) &&
            (filters.apartmentId === "all" || apartment?.id === filters.apartmentId) &&
            (filters.status === "all" || item.status === filters.status) &&
            (!filters.search || search.includes(filters.search.toLowerCase()))
          );
        });
      }

      function filtersBlock() {
        const buildings = scopedBuildings();
        const apartments = scopedApartments().filter((apartment) => state.filters.buildingId === "all" || apartment.buildingId === state.filters.buildingId);
        return `
          <div class="filters">
            <div class="field"><label>Immeuble</label><select data-action="filter" data-filter="buildingId"><option value="all">Tous</option>${buildings.map((building) => `<option value="${building.id}" ${state.filters.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}</select></div>
            <div class="field"><label>Appartement</label><select data-action="filter" data-filter="apartmentId"><option value="all">Tous</option>${apartments.map((apartment) => `<option value="${apartment.id}" ${state.filters.apartmentId === apartment.id ? "selected" : ""}>${escapeHtml(apartment.number)}</option>`).join("")}</select></div>
            <div class="field"><label>Statut</label><select data-action="filter" data-filter="status"><option value="all">Tous</option><option value="actif" ${state.filters.status === "actif" ? "selected" : ""}>Actif</option><option value="surveillance" ${state.filters.status === "surveillance" ? "selected" : ""}>Surveillance</option><option value="a_planifier" ${state.filters.status === "a_planifier" ? "selected" : ""}>À planifier</option><option value="hors_service" ${state.filters.status === "hors_service" ? "selected" : ""}>Hors service</option></select></div>
            <div class="field"><label>Recherche</label><input data-action="filter" data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Modèle, série, lieu"></div>
          </div>
        `;
      }

      function equipmentTable(equipment, allowDetail) {
        if (!equipment.length) return `<div class="empty">Aucun équipement trouvé.</div>`;
        return `<div class="table-wrap"><table><thead><tr><th>Équipement</th><th>Immeuble</th><th>Appartement</th><th>Dernier service</th><th>Prochain service</th><th>Statut</th><th></th></tr></thead><tbody>
          ${equipment.map((item) => {
            const { apartment, building } = equipmentContext(item.id);
            return `<tr>
              <td><strong>${escapeHtml(item.type)}</strong><br><span class="meta">${unitKindLabel(item.unitKind)} | ${escapeHtml(item.brand)} ${escapeHtml(item.model)} - ${escapeHtml(item.serial)}</span></td>
              <td>${escapeHtml(building?.name || "-")}</td><td>${escapeHtml(apartment?.number || "-")}</td><td>${formatDate(item.lastService)}</td><td>${formatDate(item.nextService)}</td><td>${statusBadge(item.status)}</td>
              <td>${allowDetail ? `<button class="link-button" data-action="select-equipment" data-id="${item.id}">Dossier</button>${currentUser().role !== "client" ? `<br><button class="link-button" data-action="open-modal" data-modal="equipment" data-id="${item.id}">Modifier</button>` : ""}` : ""}</td>
            </tr>`;
          }).join("")}
        </tbody></table></div>`;
      }

      function equipmentView() {
        const equipment = filteredEquipment();
        const actions = can("equipment") && currentUser().role !== "client" ? `<button class="primary-button" data-action="open-modal" data-modal="equipment">Nouvel équipement</button>` : "";
        return appShell(`${renderTopbar("Équipements", "Inventaire par immeuble, appartement et appareil.", actions)}<section class="panel"><div class="panel-body">${filtersBlock()}${equipmentTable(equipment, true)}</div></section>`);
      }

      function equipmentDetailView() {
        const { equipment, apartment, building, client } = equipmentContext(state.selectedEquipmentId);
        if (!equipment) return equipmentView();
        const interventions = state.interventions.filter((item) => item.equipmentId === equipment.id).sort((a, b) => b.date.localeCompare(a.date));
        const activeOrders = state.workOrders.filter((item) => item.equipmentId === equipment.id && !["termine", "annule"].includes(item.status));
        const activeTickets = state.tickets.filter((item) => item.equipmentId === equipment.id && item.status !== "ferme");
        const reminders = scopedReminders().filter((item) => item.equipmentId === equipment.id);
        const actionButtons = `
          <button class="ghost-button" data-action="go-back" data-fallback-view="equipements">Retour</button>
          ${currentUser().role !== "client" ? `<button class="ghost-button" data-action="open-modal" data-modal="equipment" data-id="${equipment.id}">Modifier</button>` : ""}
          ${canEditReminders() ? `<button class="ghost-button" data-action="open-modal" data-modal="reminder" data-equipment="${equipment.id}">Nouveau rappel</button>` : ""}
          ${can("tickets") ? `<button class="primary-button" data-action="open-modal" data-modal="ticket" data-equipment="${equipment.id}">Nouvelle demande</button>` : ""}
          ${canCreateWorkOrders() ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-equipment="${equipment.id}">Nouveau BT</button>` : ""}`;
        return appShell(`
          ${renderTopbar("Dossier équipement", `${building?.name || ""} - Appartement ${apartment?.number || ""}`, actionButtons)}
          <section class="detail-layout">
            <div class="panel"><div class="panel-header"><h2>${escapeHtml(equipment.type)}</h2>${statusBadge(equipment.status)}</div><div class="panel-body definition">
              <div><span>Client</span><strong>${escapeHtml(client?.name || "-")}</strong></div><div><span>Immeuble</span><strong>${escapeHtml(building?.name || "-")}</strong></div><div><span>Appartement</span><strong>${escapeHtml(apartment?.number || "-")}</strong></div><div><span>Unité</span><strong>${unitKindLabel(equipment.unitKind)}</strong></div>
              <div><span>Marque / modèle</span><strong>${escapeHtml(equipment.brand)} ${escapeHtml(equipment.model)}</strong></div><div><span>Numéro de série</span><strong>${escapeHtml(equipment.serial)}</strong></div><div><span>Localisation</span><strong>${escapeHtml(equipment.location)}</strong></div><div><span>Installation</span><strong>${formatDate(equipment.installDate)}</strong></div><div><span>Note</span><strong>${escapeHtml(equipment.notes)}</strong></div>
            </div></div>
            <div class="stack">
              <div class="panel"><div class="panel-header"><h2>Historique des interventions</h2></div><div class="panel-body timeline">${interventions.map((item) => interventionItem(item)).join("") || `<div class="empty">Aucune intervention enregistrée.</div>`}</div></div>
              <div class="panel"><div class="panel-header"><h2>En cours</h2></div><div class="panel-body cards-list">${[...activeTickets.map((item) => ticketItem(item)), ...activeOrders.map((item) => workOrderItem(item))].join("") || `<div class="empty">Aucune demande ou intervention en cours pour cette machine.</div>`}</div></div>
              <div class="panel"><div class="panel-header"><h2>Rappels</h2>${canEditReminders() ? `<button class="ghost-button" data-action="open-modal" data-modal="reminder" data-equipment="${equipment.id}">Ajouter</button>` : ""}</div><div class="panel-body cards-list">${reminders.map((item) => reminderItem(item, true, false)).join("") || `<div class="empty">Aucun rappel pour cette machine.</div>`}</div></div>
              <div class="panel"><div class="panel-header"><h2>Photos et documents</h2></div><div class="panel-body cards-list">${(equipment.attachments || []).map((file) => attachmentItem(file)).join("") || `<div class="empty">Aucune photo ou document dans ce dossier machine.</div>`}</div></div>
            </div>
          </section>`);
      }

      function equipmentModal(modal) {
        const equipment = state.equipment.find((item) => item.id === modal.id) || { apartmentId: modal.apartmentId };
        const fields = normalizeActivityFields({});
        const apartmentOptions = scopedApartments().map((apartment) => `<option value="${apartment.id}" ${equipment.apartmentId === apartment.id ? "selected" : ""}>${escapeHtml(buildingForApartment(apartment.id)?.name || "")} - Apt ${escapeHtml(apartment.number)}</option>`).join("");
        const statusOptions = dataFieldOptionsForSelect(fields.status);
        return modalShell(equipment.id ? "Modifier la machine" : "Nouvel équipement", `
          <form class="form-grid" data-form="equipment"><input type="hidden" name="id" value="${escapeHtml(equipment.id || "")}">
            <div class="field"><label>Appartement</label><select name="apartmentId">${apartmentOptions}</select></div>
            <div class="split"><div class="field combo-field"><label>Type</label>${comboInput("type", equipment.type || "", activityOptions("type", fields.type), true)}</div><div class="field combo-field"><label>Localisation</label>${comboInput("location", equipment.location || "", activityOptions("location", fields.location), true)}</div></div>
            <div class="split"><div class="field combo-field"><label>Marque</label>${comboInput("brand", equipment.brand || "", activityOptions("brand", fields.brand), true)}</div><div class="field combo-field"><label>Modèle</label>${comboInput("model", equipment.model || "", activityOptions("model", fields.model), true)}</div></div>
            <div class="split"><div class="field"><label>Numéro de série</label><input name="serial" value="${escapeHtml(equipment.serial || "")}" required></div><div class="field"><label>Date d'installation</label><input name="installDate" type="date" value="${escapeHtml(equipment.installDate || today())}"></div></div>
            <div class="split"><div class="field"><label>Dernier service</label><input name="lastService" type="date" value="${escapeHtml(equipment.lastService || "")}"></div><div class="field"><label>Prochain service</label><input name="nextService" type="date" value="${escapeHtml(equipment.nextService || "")}"></div></div>
            <div class="field"><label>Statut</label><select name="status">${statusOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${equipment.status === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
            <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(equipment.notes || "")}</textarea></div><button class="primary-button" type="submit">${equipment.id ? "Enregistrer" : "Ajouter l'équipement"}</button>
          </form>`);
      }

      async function createEquipment(values) {
        const previousEquipment = JSON.parse(JSON.stringify(state.equipment));
        const previousSelectedEquipmentId = state.selectedEquipmentId;
        const previousView = state.activeView;
        const changedAt = new Date().toISOString();
        const existing = state.equipment.find((item) => item.id === values.id);
        const payload = existing || { id: uid("eq") };
        Object.assign(payload, {
          apartmentId: values.apartmentId, type: values.type, brand: values.brand,
          model: values.model, serial: values.serial, location: values.location,
          installDate: values.installDate, lastService: values.lastService || "",
          nextService: values.nextService || "", status: values.status || "actif",
          notes: values.notes, updatedAt: changedAt
        });
        if (!existing) state.equipment.unshift(payload);
        updateUiState({ modal: null, selectedEquipmentId: payload.id, activeView: "detail", toast: "Sauvegarde de la machine..." });
        try {
          await saveEquipmentNow(payload, existing ? "Machine modifiée." : "Équipement ajouté.");
        } catch (error) {
          state.equipment = previousEquipment;
          state.selectedEquipmentId = previousSelectedEquipmentId;
          state.activeView = previousView;
          updateUiState({ modal: null, toast: error.message || "Machine non sauvegardée." });
        }
      }

      return { createEquipment, equipmentDetailView, equipmentModal, equipmentTable, equipmentView, filteredEquipment, filtersBlock };
    }
  };
})();
