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

  window.ClimaParcTicketsView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        api, appShell, renderTopbar, scopedTickets, scopedEquipment, equipmentContext,
        escapeHtml, statusBadge, canCreateWorkOrders, currentUser, compactAttachmentItem,
        modalShell, uid, nextTicketNumber, clientForBuilding, today, updateUiState,
        saveDomainItemNow
      } = context;

      function ticketStatusButtons(ticket) {
        if (currentUser()?.role === "client") return "";
        return `<button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="en_cours">En cours</button><button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="ferme">Fermer</button>`;
      }

      function ticketItem(ticket, expanded = false, dashboardLink = false) {
        const { equipment, apartment, building } = equipmentContext(ticket.equipmentId);
        const serviceType = state.serviceTypes.find((item) => item.id === ticket.serviceTypeId);
        const actions = expanded && canCreateWorkOrders() ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-ticket="${ticket.id}" data-equipment="${ticket.equipmentId}">Créer BT</button>` : "";
        return `<article class="list-item ${dashboardLink ? "clickable-card" : ""}" ${dashboardLink ? `data-action="dashboard-ticket" data-id="${escapeHtml(ticket.id)}"` : ""}>
          <div class="actions" style="justify-content:space-between"><h3>${escapeHtml(ticket.number || ticket.id)} - ${escapeHtml(ticket.title)}</h3><span>${statusBadge(ticket.priority)} ${statusBadge(ticket.status)}</span></div>
          <div class="meta">Type: ${escapeHtml(serviceType?.name || "-")}</div><div class="meta">${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")} - ${escapeHtml(equipment?.type || "-")}</div><div class="meta">${escapeHtml(ticket.description)}</div>
          ${expanded ? `<div class="mini-list"><strong>Photos et documents de la machine</strong>${(equipment?.attachments || []).map((file) => compactAttachmentItem(file)).join("") || `<div class="meta">Aucun fichier lié à cette machine.</div>`}</div>` : ""}
          <div class="actions">${expanded ? `<button class="ghost-button" data-action="open-modal" data-modal="ticket" data-id="${ticket.id}">Modifier</button>` : ""}${actions}${expanded ? ticketStatusButtons(ticket) : ""}</div>
        </article>`;
      }

      function ticketsView() {
        const tickets = scopedTickets();
        return appShell(`${renderTopbar("Demandes des clients", "Demandes clients, priorités et suivi opérationnel.", `<button class="primary-button" data-action="open-modal" data-modal="ticket">Nouvelle demande</button>`)}<section class="panel"><div class="panel-body cards-list">${tickets.map((ticket) => ticketItem(ticket, true)).join("") || `<div class="empty">Aucune demande client.</div>`}</div></section>`);
      }

      function ticketModal(modal) {
        const ticket = state.tickets.find((item) => item.id === modal.id) || {};
        const selectedEquipmentId = ticket.equipmentId || modal.equipmentId;
        const equipmentOptions = scopedEquipment().map((item) => {
          const { apartment, building } = equipmentContext(item.id);
          return `<option value="${item.id}" ${selectedEquipmentId === item.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment?.number || "")} - ${escapeHtml(item.type)}</option>`;
        }).join("");
        const serviceOptions = state.serviceTypes.map((type) => `<option value="${type.id}" ${ticket.serviceTypeId === type.id ? "selected" : ""}>${escapeHtml(type.name)}</option>`).join("");
        return modalShell(ticket.id ? "Modifier la demande client" : "Nouvelle demande client", `<form class="form-grid" data-form="ticket">
          <input type="hidden" name="id" value="${escapeHtml(ticket.id || "")}">${ticket.id ? `<div class="field"><label>Numéro de demande</label><input value="${escapeHtml(ticket.number || ticket.id)}" readonly></div>` : ""}
          <div class="field"><label>Équipement</label><select name="equipmentId" required>${equipmentOptions}</select></div><div class="field"><label>Type de demande</label><select name="serviceTypeId">${serviceOptions}</select></div>
          <div class="split"><div class="field"><label>Titre</label><input name="title" value="${escapeHtml(ticket.title || "")}" required placeholder="Ex.: Bruit anormal"></div><div class="field"><label>Priorité</label><select name="priority"><option value="normale" ${ticket.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${ticket.priority === "urgente" ? "selected" : ""}>Urgente</option><option value="basse" ${ticket.priority === "basse" ? "selected" : ""}>Basse</option></select></div></div>
          <div class="field"><label>Statut</label><select name="status"><option value="ouvert" ${ticket.status === "ouvert" ? "selected" : ""}>Ouvert</option><option value="en_cours" ${ticket.status === "en_cours" ? "selected" : ""}>En cours</option><option value="ferme" ${ticket.status === "ferme" ? "selected" : ""}>Fermé</option></select></div>
          <div class="field"><label>Description</label><textarea name="description" required>${escapeHtml(ticket.description || "")}</textarea></div><button class="primary-button" type="submit">${ticket.id ? "Enregistrer" : "Créer la demande"}</button>
        </form>`);
      }

      async function createTicket(_form, values) {
        const previousTickets = JSON.parse(JSON.stringify(state.tickets));
        const { building, apartment } = equipmentContext(values.equipmentId);
        const serviceType = state.serviceTypes.find((item) => item.id === values.serviceTypeId) || state.serviceTypes[0];
        const existing = state.tickets.find((item) => item.id === values.id);
        const payload = existing || {
          id: uid("tk"), number: nextTicketNumber(),
          clientId: currentUser().role === "client" ? currentUser().clientId : clientForBuilding(building.id)?.id,
          createdAt: today(), createdBy: currentUser().id
        };
        Object.assign(payload, {
          buildingId: building.id, apartmentId: apartment.id, equipmentId: values.equipmentId,
          serviceTypeId: values.serviceTypeId || serviceType?.id || "", title: values.title,
          description: values.description, priority: values.priority || serviceType?.defaultPriority || "normale",
          status: values.status || "ouvert", closedAt: values.status === "ferme" ? payload.closedAt || today() : ""
        });
        if (!existing) state.tickets.unshift(payload);
        const uiPatch = { activeView: "appels" };
        updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde de la demande..." });
        try {
          await saveDomainItemNow(api.saveTicket, payload, uiPatch, existing ? "Demande client modifiée." : "Demande client créée.");
        } catch (error) {
          state.tickets = previousTickets;
          updateUiState({ modal: null, ...uiPatch, toast: error.message || "Demande client non sauvegardée." });
        }
      }

      return { createTicket, ticketItem, ticketModal, ticketStatusButtons, ticketsView };
    }
  };
})();
