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

  window.ClimaParcPlacesView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        api,
        appShell,
        renderTopbar,
        currentUser,
        can,
        canManageBuildings,
        canEditApartments,
        scopedBuildings,
        apartmentsForBuilding,
        equipmentForApartment,
        escapeHtml,
        displayPhone,
        unitKindLabel,
        statusText,
        modalShell,
        phoneField,
        uid,
        formatCanadianPhone,
        updateUiState,
        saveDomainItemNow,
        showToast,
        setState
      } = context;

      function buildingsView() {
        const buildings = scopedBuildings().sort((a, b) => a.name.localeCompare(b.name, "fr"));
        const centralStorages = state.storageLocations.filter((item) => item.scopeType === "client" && item.active !== false);
        const actions = canManageBuildings()
          ? `<button class="primary-button" data-action="open-modal" data-modal="building">Nouveau lieu</button>`
          : "";
        return appShell(`
          ${renderTopbar("Lieux", "Organisation par nom de bâtiment et adresse, puis appartements et machines.", actions)}
          <section class="cards-grid">
            ${buildings.map((building) => buildingCard(building)).join("") || `<div class="empty">Aucun lieu enregistré.</div>`}
          </section>
          ${centralStorages.length ? `<section class="panel"><div class="panel-header"><h2>Entrepôts centraux</h2></div><div class="panel-body cards-list">${centralStorages.map((storage) => storageCard(storage)).join("")}</div></section>` : ""}
        `);
      }

      function storageCard(storage) {
        const inventory = state.equipment.filter((item) => item.storageLocationId === storage.id);
        return `<article class="list-item"><div class="actions" style="justify-content:space-between"><h3>${escapeHtml(storage.name)}</h3><span class="badge neutral">${inventory.length} machine${inventory.length === 1 ? "" : "s"}</span></div><div class="meta">${escapeHtml(storage.address || "Adresse non précisée")}</div><div class="mini-list">${inventory.map((item) => `<button class="mini-row" data-action="select-equipment" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.type || "Machine")}</strong><span>${escapeHtml(item.brand || "")} ${escapeHtml(item.model || "")} | ${escapeHtml(item.serial || "Sans série")}</span></button>`).join("") || `<span class="meta">Aucune machine visible dans cet entrepôt.</span>`}</div></article>`;
      }

      function buildingCard(building) {
        const client = state.clients.find((item) => item.id === building.clientId);
        const apartments = apartmentsForBuilding(building.id);
        const localStorages = state.storageLocations.filter((item) => item.scopeType === "building" && item.buildingId === building.id && item.active !== false);
        const equipmentCount = apartments.reduce((total, apartment) => total + equipmentForApartment(apartment.id).length, 0);
        return `
          <article class="place-card">
            <div class="place-card-main">
              <span class="badge neutral">${escapeHtml(client?.name || "Client")}</span>
              <h2>${escapeHtml(building.name)}</h2>
              <p>${escapeHtml(building.address)}</p>
            </div>
            <div class="place-metrics">
              <span><strong>${apartments.length}</strong> appartements</span>
              <span><strong>${equipmentCount}</strong> machines</span>
            </div>
            <div class="definition compact">
              <div><span>Ressource sur place</span><strong>${escapeHtml(building.onsiteContactName || "-")}</strong></div>
              <div><span>Facturation</span><strong>${escapeHtml(building.billingContactName || "-")}</strong></div>
            </div>
            <div class="actions">
              <button class="primary-button" data-action="select-building" data-id="${building.id}">Ouvrir</button>
              ${canManageBuildings() ? `<button class="ghost-button" data-action="open-modal" data-modal="building" data-id="${building.id}">Modifier</button>` : ""}
            </div>
          </article>
        `;
      }

      function buildingDetailView() {
        const building = scopedBuildings().find((item) => item.id === state.selectedBuildingId) || scopedBuildings()[0];
        if (!building) return buildingsView();
        const client = state.clients.find((item) => item.id === building.clientId);
        const apartments = apartmentsForBuilding(building.id);
        const localStorages = state.storageLocations.filter((item) => item.scopeType === "building" && item.buildingId === building.id && item.active !== false);
        const actions = `
          <button class="ghost-button" data-action="go-back" data-fallback-view="lieux">Retour</button>
          ${can("documents") ? `<button class="ghost-button" data-action="open-modal" data-modal="buildingDocuments" data-building="${building.id}">Documents</button>` : ""}
          ${currentUser().role !== "client" ? `<button class="primary-button" data-action="open-modal" data-modal="apartment" data-building="${building.id}">Nouvel appartement</button>` : ""}
          ${canManageBuildings() ? `<button class="ghost-button" data-action="open-modal" data-modal="building" data-id="${building.id}">Modifier le lieu</button>` : ""}
        `;
        return appShell(`
          ${renderTopbar(building.name, building.address, actions)}
          <section class="detail-layout">
            <div class="panel">
              <div class="panel-header"><h2>Informations du lieu</h2></div>
              <div class="panel-body definition">
                <div><span>Client</span><strong>${escapeHtml(client?.name || "-")}</strong></div>
                <div><span>Adresse</span><strong>${escapeHtml(building.address)}</strong></div>
                <div><span>Ressource sur place</span><strong>${escapeHtml(building.onsiteContactName || "-")}</strong></div>
                <div><span>Téléphone sur place</span><strong>${escapeHtml(displayPhone(building.onsiteContactPhone, building.onsiteContactPoste))}</strong></div>
                <div><span>Email sur place</span><strong>${escapeHtml(building.onsiteContactEmail || "-")}</strong></div>
                <div><span>Ressource facturation</span><strong>${escapeHtml(building.billingContactName || "-")}</strong></div>
                <div><span>Téléphone facturation</span><strong>${escapeHtml(displayPhone(building.billingContactPhone, building.billingContactPoste))}</strong></div>
                <div><span>Email facturation</span><strong>${escapeHtml(building.billingContactEmail || "-")}</strong></div>
                <div><span>Notes</span><strong>${escapeHtml(building.notes || "-")}</strong></div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-header"><h2>Appartements cadastrés</h2></div>
              <div class="panel-body cards-list">
                ${apartments.map((apartment) => apartmentBlock(apartment)).join("") || `<div class="empty">Aucun appartement dans ce lieu.</div>`}
              </div>
            </div>
            ${localStorages.length ? `<div class="panel"><div class="panel-header"><h2>Entrepôts du lieu</h2></div><div class="panel-body cards-list">${localStorages.map((storage) => storageCard(storage)).join("")}</div></div>` : ""}
          </section>
        `);
      }

      function apartmentBlock(apartment) {
        const machines = equipmentForApartment(apartment.id);
        return `
          <article class="list-item">
            <div class="actions" style="justify-content:space-between">
              <h3>Appartement ${escapeHtml(apartment.number)}</h3>
              <span class="badge neutral">${machines.length} machine${machines.length > 1 ? "s" : ""}</span>
            </div>
            <div class="mini-list">
              ${machines.map((item) => `
                <button class="mini-row" data-action="select-equipment" data-id="${item.id}">
                  <strong>${escapeHtml(item.type)}</strong>
                  <span>${unitKindLabel(item.unitKind)} | ${escapeHtml(item.brand)} ${escapeHtml(item.model)} - ${statusText(item.status)}</span>
                </button>
              `).join("") || `<div class="meta">Aucune machine enregistrée.</div>`}
            </div>
            ${currentUser().role !== "client" && (canEditApartments() || can("equipment")) ? `
              <div class="actions">
                ${canEditApartments() ? `<button class="ghost-button" data-action="open-modal" data-modal="apartment" data-id="${apartment.id}" data-building="${apartment.buildingId}">Modifier l'appartement</button>` : ""}
                ${can("equipment") ? `<button class="primary-button" data-action="open-modal" data-modal="equipment" data-apartment="${apartment.id}">Ajouter une machine</button>` : ""}
              </div>
            ` : ""}
          </article>
        `;
      }

      function buildingModal(modal) {
        const building = state.buildings.find((item) => item.id === modal.id) || {};
        const clientOptions = state.clients.map((client) => `<option value="${client.id}" ${building.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
        return modalShell(building.id ? "Modifier le lieu" : "Nouveau lieu", `
          <form class="form-grid" data-form="building">
            <input type="hidden" name="id" value="${escapeHtml(building.id || "")}">
            <div class="split">
              <div class="field"><label>Nom du bâtiment</label><input name="name" value="${escapeHtml(building.name || "")}" required></div>
              <div class="field"><label>Client / administrateur</label><select name="clientId" required>${clientOptions}</select></div>
            </div>
            <div class="field"><label>Adresse</label><input name="address" value="${escapeHtml(building.address || "")}" required></div>
            <div class="split">
              <div class="field"><label>Personne ressource sur place</label><input name="onsiteContactName" value="${escapeHtml(building.onsiteContactName || "")}"></div>
              <div class="field"><label>Téléphone sur place</label>${phoneField("onsiteContactPhone", building.onsiteContactPhone || "")}</div>
            </div>
            <div class="split">
              <div class="field"><label>Poste sur place</label><input name="onsiteContactPoste" value="${escapeHtml(building.onsiteContactPoste || "")}" inputmode="numeric" placeholder="Ex.: 1234"></div>
              <div class="field"><label>Email sur place</label><input name="onsiteContactEmail" type="email" value="${escapeHtml(building.onsiteContactEmail || "")}"></div>
            </div>
            <div class="split">
              <div class="field"><label>Personne ressource facturation</label><input name="billingContactName" value="${escapeHtml(building.billingContactName || "")}"></div>
              <div class="field"><label>Téléphone facturation</label>${phoneField("billingContactPhone", building.billingContactPhone || "")}</div>
            </div>
            <div class="split">
              <div class="field"><label>Poste facturation</label><input name="billingContactPoste" value="${escapeHtml(building.billingContactPoste || "")}" inputmode="numeric" placeholder="Ex.: 1234"></div>
              <div class="field"><label>Email facturation</label><input name="billingContactEmail" type="email" value="${escapeHtml(building.billingContactEmail || "")}"></div>
            </div>
            <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(building.notes || "")}</textarea></div>
            <button class="primary-button" type="submit">${building.id ? "Enregistrer" : "Créer le lieu"}</button>
          </form>
        `);
      }

      function apartmentModal(modal) {
        const apartment = state.apartments.find((item) => item.id === modal.id) || { buildingId: modal.buildingId || state.selectedBuildingId };
        const buildingOptions = scopedBuildings().map((building) => `<option value="${building.id}" ${apartment.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("");
        return modalShell(apartment.id ? "Modifier l'appartement" : "Nouvel appartement", `
          <form class="form-grid" data-form="apartment">
            <input type="hidden" name="id" value="${escapeHtml(apartment.id || "")}">
            <div class="field"><label>Lieu</label><select name="buildingId" required>${buildingOptions}</select></div>
            <div class="split">
              <div class="field"><label>Numéro d'appartement</label><input name="number" value="${escapeHtml(apartment.number || "")}" required></div>
              <div class="field"><label>Occupant</label><input name="occupant" value="${escapeHtml(apartment.occupant || "")}"></div>
            </div>
            <div class="actions form-actions">
              <button class="primary-button" type="submit">${apartment.id ? "Enregistrer" : "Créer l'appartement"}</button>
              ${apartment.id && canManageBuildings() ? `<button class="danger-button" type="button" data-action="delete-apartment" data-id="${escapeHtml(apartment.id)}">Supprimer</button>` : ""}
            </div>
          </form>
        `);
      }

      async function saveBuilding(values) {
        const previousBuildings = JSON.parse(JSON.stringify(state.buildings));
        const payload = {
          id: values.id || uid("b"),
          clientId: values.clientId,
          name: values.name,
          address: values.address,
          onsiteContactName: values.onsiteContactName,
          onsiteContactPhone: formatCanadianPhone(values.onsiteContactPhone),
          onsiteContactPoste: values.onsiteContactPoste,
          onsiteContactEmail: values.onsiteContactEmail,
          billingContactName: values.billingContactName,
          billingContactPhone: formatCanadianPhone(values.billingContactPhone),
          billingContactPoste: values.billingContactPoste,
          billingContactEmail: values.billingContactEmail,
          notes: values.notes
        };
        const index = state.buildings.findIndex((item) => item.id === payload.id);
        if (index >= 0) state.buildings[index] = payload;
        else state.buildings.unshift(payload);
        const uiPatch = { selectedBuildingId: payload.id, activeView: "lieu_detail" };
        updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde du lieu..." });
        try {
          await saveDomainItemNow(api.saveBuilding, payload, uiPatch, index >= 0 ? "Lieu modifié." : "Lieu créé.");
        } catch (error) {
          state.buildings = previousBuildings;
          updateUiState({ modal: null, ...uiPatch, toast: error.message || "Lieu non sauvegardé." });
        }
      }

      async function saveApartment(values) {
        const previousApartments = JSON.parse(JSON.stringify(state.apartments));
        const payload = {
          id: values.id || uid("apt"),
          buildingId: values.buildingId,
          number: values.number,
          occupant: values.occupant
        };
        const index = state.apartments.findIndex((item) => item.id === payload.id);
        if (index >= 0) state.apartments[index] = payload;
        else state.apartments.push(payload);
        const uiPatch = { selectedBuildingId: payload.buildingId, activeView: "lieu_detail" };
        updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde de l'appartement..." });
        try {
          await saveDomainItemNow(api.saveApartment, payload, uiPatch, index >= 0 ? "Appartement modifié." : "Appartement créé.");
        } catch (error) {
          state.apartments = previousApartments;
          updateUiState({ modal: null, ...uiPatch, toast: error.message || "Appartement non sauvegardé." });
        }
      }

      function deleteApartment(id) {
        const apartment = state.apartments.find((item) => item.id === id);
        if (!apartment) return;
        const linkedEquipment = equipmentForApartment(id);
        if (linkedEquipment.length) {
          showToast("Impossible de supprimer cet appartement: déplacez ou supprimez d'abord les machines associées.");
          return;
        }
        if (!confirm(`Supprimer l'appartement ${apartment.number}? Cette action est définitive.`)) return;
        state.apartments = state.apartments.filter((item) => item.id !== id);
        state.interventions = state.interventions.filter((item) => item.apartmentId !== id);
        setState({
          modal: null,
          selectedBuildingId: apartment.buildingId,
          selectedExecutionApartmentId: state.selectedExecutionApartmentId === id ? null : state.selectedExecutionApartmentId,
          activeView: "lieu_detail",
          toast: "Appartement supprimé."
        });
      }

      return {
        apartmentBlock,
        apartmentModal,
        buildingCard,
        buildingDetailView,
        buildingModal,
        buildingsView,
        deleteApartment,
        saveApartment,
        saveBuilding,
        storageCard
      };
    }
  };
})();
