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

  window.ClimaParcUsersView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        api,
        appShell,
        renderTopbar,
        currentUser,
        roleLabel,
        escapeHtml,
        modalShell,
        scopedBuildings,
        clientPortalRights,
        portalRightsCatalog,
        clientAllowedBuildingIds,
        defaultPortalRights,
        uid,
        updateUiState,
        saveUserNow,
        showToast,
        acceptServerState
      } = context;

      function clientAccessLabel(level) {
        return {
          direction: "Direction",
          gestionnaire: "Gestionnaire de lieu",
          maintenance: "Maintenance client"
        }[level || "direction"] || level;
      }

      function canDeleteUser(user) {
        const actor = currentUser();
        if (!actor || !user || actor.id === user.id) return false;
        if (actor.role === "client") return user.role === "client" && user.clientId === actor.clientId;
        return ["administrateur", "equipe_interne"].includes(actor.role);
      }

      function userBuildingAccessLabel(user) {
        const ids = user.allowedBuildingIds || [];
        if (!ids.length) return "Tous les lieux";
        return ids.map((id) => state.buildings.find((building) => building.id === id)?.name).filter(Boolean).join(", ") || "-";
      }

      function rightsCatalog() {
        return [
          ["all", "Accès complet"],
          ["lieux", "Lieux et appartements"],
          ["equipment", "Équipements"],
          ["alerts", "Alertes et rappels"],
          ["tickets", "Demandes des clients"],
          ["workorders", "Bons de travail"],
          ["interventions", "Interventions"],
          ["recommendations", "Recommandations"],
          ["documents", "Documents client"],
          ["reports", "Rapports"],
          ["users", "Utilisateurs"],
          ["settings", "Paramètres"],
          ["portal", "Portail client"]
        ];
      }

      function usersView() {
        const roles = state.roleDefinitions.map((role) => role.id);
        const visibleUsers = currentUser()?.role === "client"
          ? state.users.filter((user) => user.clientId === currentUser().clientId)
          : state.users;
        const title = currentUser()?.role === "client" ? "Utilisateurs client" : "Utilisateurs et accès";
        const subtitle = currentUser()?.role === "client"
          ? "Créer des accès par lieu et choisir les informations partagées."
          : "Contrôle des rôles pour clients, techniciens, équipe interne et administrateurs.";
        return appShell(`
          ${renderTopbar(title, subtitle, `<button class="primary-button" data-action="open-modal" data-modal="user">Nouvel utilisateur</button>`)}
          <section class="panel">
            <div class="panel-body table-wrap">
              <table>
                <thead><tr><th>Nom</th><th>Courriel</th><th>Profil</th><th>Rôle</th><th>Client lié</th><th>Accès lieux</th><th></th></tr></thead>
                <tbody>
                  ${visibleUsers.map((user) => {
                    const client = state.clients.find((item) => item.id === user.clientId);
                    return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(roleLabel(user.role))}</td><td>${escapeHtml(user.role === "client" ? clientAccessLabel(user.clientAccessLevel) : "-")}</td><td>${escapeHtml(client?.name || "-")}</td><td>${escapeHtml(user.role === "client" ? userBuildingAccessLabel(user) : "-")}</td><td><button class="link-button" data-action="open-modal" data-modal="user" data-id="${user.id}">Modifier</button> ${canDeleteUser(user) ? `<button class="link-button danger-link" data-action="delete-user" data-id="${user.id}">Supprimer</button>` : ""}</td></tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </section>
          ${currentUser()?.role === "client" ? "" : `<section class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>Profils client par client</h2></div>
            <div class="panel-body cards-list">
              ${state.clients.map((client) => {
                const clientUsers = state.users.filter((user) => user.role === "client" && user.clientId === client.id);
                return `
                  <article class="list-item">
                    <div class="actions" style="justify-content:space-between">
                      <h3>${escapeHtml(client.name)}</h3>
                      <button class="ghost-button" data-action="open-modal" data-modal="user" data-client="${escapeHtml(client.id)}">Nouveau profil</button>
                    </div>
                    <div class="mini-list">
                      ${clientUsers.map((user) => `<div class="mini-row"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(clientAccessLabel(user.clientAccessLevel))} | ${escapeHtml(userBuildingAccessLabel(user))}</span></div>`).join("") || `<div class="meta">Aucun profil client créé.</div>`}
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>Matrice d'accès</h2></div>
            <div class="panel-body table-wrap">
              <table>
                <thead><tr><th>Profil</th><th>Inventaire</th><th>Appels</th><th>Bons</th><th>Rapports</th><th>Utilisateurs</th></tr></thead>
                <tbody>
                  ${roles.map((role) => `<tr><td>${roleLabel(role)}</td><td>${role === "client" ? "Lecture client" : "Oui"}</td><td>${["administrateur", "equipe_interne", "client"].includes(role) ? "Oui" : "Non"}</td><td>${role === "client" ? "Lecture" : role === "technicien" ? "Assignés" : "Oui"}</td><td>${role === "client" ? "Client" : role === "technicien" ? "Technicien" : ["administrateur", "equipe_interne"].includes(role) ? "Interne" : "Non"}</td><td>${["administrateur", "equipe_interne"].includes(role) ? "Oui" : "Non"}</td></tr>`).join("")}
                </tbody>
              </table>
            </div>
          </section>`}
        `);
      }

      function userModal(modal) {
        const user = state.users.find((item) => item.id === modal.id) || {};
        const isClientManager = currentUser()?.role === "client";
        const initialRole = isClientManager || user.role === "client" || Boolean(modal.clientId)
          ? "client"
          : user.role || "administrateur";
        const effectiveUser = {
          role: initialRole,
          clientId: isClientManager ? currentUser().clientId : user.clientId || modal.clientId || "",
          clientAccessLevel: user.clientAccessLevel || (initialRole === "client" ? "gestionnaire" : ""),
          allowedBuildingIds: user.allowedBuildingIds || [],
          portalRights: user.portalRights || [],
          technicianPermissions: user.technicianPermissions || [],
          ...user
        };
        const clients = state.clients.map((client) => `<option value="${client.id}" ${effectiveUser.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
        const roles = state.roleDefinitions
          .map((role) => `<option value="${role.id}" ${effectiveUser.role === role.id ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("");
        const clientRoleOptions = [
          ["direction", "Direction / headquarters"],
          ["gestionnaire", "Gestionnaire de lieu"],
          ["maintenance", "Maintenance client"]
        ].map(([value, label]) => `<option value="${value}" ${effectiveUser.clientAccessLevel === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
        const clientBuildings = (isClientManager ? scopedBuildings() : state.buildings)
          .map((building) => `
            <label data-user-building data-client-id="${escapeHtml(building.clientId || "")}" class="${building.clientId === effectiveUser.clientId ? "" : "hidden"}"><input type="checkbox" name="allowedBuildingIds" value="${escapeHtml(building.id)}" ${(effectiveUser.allowedBuildingIds || []).includes(building.id) ? "checked" : ""} ${building.clientId === effectiveUser.clientId ? "" : "disabled"}> ${escapeHtml(building.name)}</label>
          `).join("");
        const rights = clientPortalRights(effectiveUser);
        const portalChecks = portalRightsCatalog().map(([right, label]) => `
          <label><input type="checkbox" name="portalRights" value="${escapeHtml(right)}" ${rights.includes(right) ? "checked" : ""}> ${escapeHtml(label)}</label>
        `).join("");
        return modalShell(user.id ? "Modifier l'utilisateur" : "Nouvel utilisateur", `
          <form class="form-grid" data-form="user">
            <input type="hidden" name="id" value="${escapeHtml(user.id || "")}">
            ${isClientManager ? `<input type="hidden" name="clientId" value="${escapeHtml(currentUser().clientId || "")}">` : ""}
            ${isClientManager ? `<input type="hidden" name="role" value="client">` : ""}
            <div class="split">
              <div class="field"><label>Nom</label><input name="name" value="${escapeHtml(user.name || "")}" required></div>
              <div class="field"><label>Courriel</label><input name="email" type="email" value="${escapeHtml(user.email || "")}" required></div>
            </div>
            <div class="split">
              <div class="field"><label>Mot de passe</label><input name="password" ${user.id ? `value="" placeholder="Laisser vide pour conserver"` : `value="temp123" required`}></div>
              ${isClientManager
                ? `<div class="field"><label>Profil</label><input value="Client" readonly></div>`
                : `<div class="field"><label>Profil</label><select name="role" data-user-profile>${roles}</select></div>`}
            </div>
            <div class="field ${effectiveUser.role === "client" ? "" : "hidden"}" data-client-role-section><label>Rôle</label><select name="clientAccessLevel" ${effectiveUser.role === "client" ? "" : "disabled"}>${clientRoleOptions}</select></div>
            ${isClientManager ? "" : `<div class="field ${effectiveUser.role === "client" ? "" : "hidden"}" data-client-link-section><label>Client lié</label><select name="clientId" data-user-client ${effectiveUser.role === "client" ? "" : "disabled"}><option value="">Aucun</option>${clients}</select></div>`}
            ${isClientManager ? "" : `<div class="field ${effectiveUser.role === "technicien" ? "" : "hidden"}" data-technician-permissions>
              <label>Autorisations individuelles du technicien</label>
              <div class="choice-list">
                <label><input type="checkbox" name="technicianPermissions" value="edit_apartments" ${(effectiveUser.technicianPermissions || []).includes("edit_apartments") ? "checked" : ""} ${effectiveUser.role === "technicien" ? "" : "disabled"}> Modifier les appartements</label>
                <label><input type="checkbox" name="technicianPermissions" value="edit_equipment" ${(effectiveUser.technicianPermissions || []).includes("edit_equipment") ? "checked" : ""} ${effectiveUser.role === "technicien" ? "" : "disabled"}> Modifier les équipements</label>
              </div>
            </div>`}
            <div class="client-access-editor ${effectiveUser.role === "client" ? "" : "hidden"}" data-client-access-section>
              <div class="split">
                <div class="field"><label>Accès aux lieux</label><div class="choice-list"><label><input type="checkbox" name="allBuildings" value="1" ${!(effectiveUser.allowedBuildingIds || []).length ? "checked" : ""} ${effectiveUser.role === "client" ? "" : "disabled"}> Tous les lieux autorisés</label>${clientBuildings}<span class="meta ${effectiveUser.clientId ? "hidden" : ""}" data-no-user-buildings>Sélectionnez d'abord un client.</span></div></div>
              </div>
              <div class="field"><label>Informations partagées</label><div class="choice-list">${portalChecks}</div></div>
            </div>
            <div class="actions form-actions">
              <button class="primary-button" type="submit">${user.id ? "Enregistrer" : "Créer l'utilisateur"}</button>
              ${canDeleteUser(effectiveUser) ? `<button class="danger-button" type="button" data-action="delete-user" data-id="${escapeHtml(effectiveUser.id)}">Supprimer</button>` : ""}
            </div>
          </form>
        `);
      }

      async function createUser(form, values) {
        const creator = currentUser();
        const changedAt = new Date().toISOString();
        const isClientManager = creator?.role === "client";
        const role = isClientManager ? "client" : values.role;
        const clientId = isClientManager ? creator.clientId : values.clientId || null;
        const allowedByCreator = isClientManager ? clientAllowedBuildingIds(creator) : null;
        const creatorHasFullClientAccess = !isClientManager || !(creator.allowedBuildingIds || []).length;
        const selectedBuildingIds = Array.from(form.querySelectorAll('[name="allowedBuildingIds"]:checked')).map((input) => input.value);
        const allowedBuildingIds = values.allBuildings
          ? (creatorHasFullClientAccess ? [] : allowedByCreator)
          : (allowedByCreator ? selectedBuildingIds.filter((id) => allowedByCreator.includes(id)) : selectedBuildingIds);
        const selectedPortalRights = Array.from(form.querySelectorAll('[name="portalRights"]:checked')).map((input) => input.value);
        const portalRights = role === "client"
          ? Array.from(new Set(["portal", ...(selectedPortalRights.length ? selectedPortalRights : defaultPortalRights(values.clientAccessLevel || "gestionnaire"))]))
          : [];
        const technicianPermissions = role === "technicien"
          ? Array.from(form.querySelectorAll('[name="technicianPermissions"]:checked')).map((input) => input.value)
          : [];
        const previousUsers = JSON.parse(JSON.stringify(state.users));
        const existing = state.users.find((item) => item.id === values.id);
        if (existing) {
          if (isClientManager && existing.clientId !== creator.clientId) {
            showToast("Vous ne pouvez modifier que les utilisateurs de votre client.");
            return;
          }
          Object.assign(existing, {
            name: values.name,
            email: values.email,
            role,
            clientId,
            clientAccessLevel: role === "client" ? values.clientAccessLevel || "gestionnaire" : "",
            allowedBuildingIds: role === "client" ? allowedBuildingIds : [],
            portalRights,
            technicianPermissions,
            parentUserId: existing.parentUserId || (isClientManager ? creator.id : ""),
            updatedAt: changedAt
          });
          const userPayload = { ...existing, password: values.password || "" };
          updateUiState({ modal: null, activeView: "utilisateurs", toast: "Sauvegarde de l'utilisateur..." });
          try {
            await saveUserNow(userPayload, "Utilisateur modifié.");
          } catch (error) {
            state.users = previousUsers;
            updateUiState({ modal: null, activeView: "utilisateurs", toast: error.message || "Utilisateur non sauvegardé." });
          }
          return;
        }
        const newUser = {
          id: uid("u"),
          name: values.name,
          email: values.email,
          role,
          clientId,
          clientAccessLevel: role === "client" ? values.clientAccessLevel || "gestionnaire" : "",
          allowedBuildingIds: role === "client" ? allowedBuildingIds : [],
          portalRights,
          technicianPermissions,
          parentUserId: isClientManager ? creator.id : "",
          updatedAt: changedAt
        };
        const newUserPayload = { ...newUser, password: values.password };
        state.users.push(newUser);
        updateUiState({ modal: null, activeView: "utilisateurs", toast: "Sauvegarde de l'utilisateur..." });
        try {
          await saveUserNow(newUserPayload, "Utilisateur créé.");
        } catch (error) {
          state.users = previousUsers;
          updateUiState({ modal: null, activeView: "utilisateurs", toast: error.message || "Utilisateur non sauvegardé." });
        }
      }

      async function deleteUser(userId) {
        const user = state.users.find((item) => item.id === userId);
        if (!user) return;
        if (!canDeleteUser(user)) {
          showToast("Droits insuffisants pour supprimer cet utilisateur.");
          return;
        }
        if (!confirm(`Supprimer l'utilisateur ${user.name}? Cette action est définitive.`)) return;
        const previousUsers = JSON.parse(JSON.stringify(state.users));
        state.users = state.users.filter((item) => item.id !== userId);
        updateUiState({ modal: null, activeView: "utilisateurs", toast: "Suppression de l'utilisateur..." });
        try {
          const payload = await api.deleteUser(userId);
          if (payload.state) {
            acceptServerState(payload.state, {
              activeView: "utilisateurs",
              modal: null,
              toast: "Utilisateur supprimé."
            });
          }
        } catch (error) {
          state.users = previousUsers;
          updateUiState({ modal: null, activeView: "utilisateurs", toast: error.message || "Utilisateur non supprimé." });
        }
      }

      return {
        canDeleteUser,
        clientAccessLabel,
        createUser,
        deleteUser,
        rightsCatalog,
        userBuildingAccessLabel,
        userModal,
        usersView
      };
    }
  };
})();
