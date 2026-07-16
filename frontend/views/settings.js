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

  window.ClimaParcSettingsView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        appShell, renderTopbar, escapeHtml, statusText, fieldTypeLabel,
        rightsCatalog, modalShell, uid, saveSettingCollectionItem
      } = context;

      function dataFieldGroups() {
        const groups = new Map();
        state.dataFields.forEach((field) => {
          const group = field.group || "Non groupé";
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push(field);
        });
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "fr"));
      }

      function dataFieldTypeLabel(type) {
        return {
          text: "Texte", long: "Texte long", single: "Option unique",
          multiple: "Options multiples", number: "Numérique", date: "Date",
          phone: "Téléphone"
        }[type] || type;
      }

      function settingsView() {
        const actions = `<button class="primary-button" data-action="open-modal" data-modal="dataField">Champ de données</button><button class="primary-button" data-action="open-modal" data-modal="serviceType">Type de demande</button><button class="ghost-button" data-action="open-modal" data-modal="interventionType">Type d'intervention</button><button class="ghost-button" data-action="open-modal" data-modal="formTemplate">Formulaire terrain</button><button class="ghost-button" data-action="open-modal" data-modal="storageLocation">Dépôt</button>`;
        return appShell(`${renderTopbar("Paramètres", "Types de demandes, checklists et droits d'accès.", actions)}
          <section class="grid"><div class="stack">
            <div class="panel"><div class="panel-header"><h2>Champs de données</h2></div><div class="panel-body cards-list">${dataFieldGroups().map(([group, fields]) => `<div class="data-field-group"><div class="data-field-group-title">${escapeHtml(group)} <span>${fields.length}</span></div>${fields.map((field) => `<article class="list-item data-field-item"><div><h3>${escapeHtml(field.name)}</h3><div class="meta">${dataFieldTypeLabel(field.type)} | ${field.options.length} option${field.options.length > 1 ? "s" : ""} | ${field.appliesTo.map((item) => item === "activity" ? "Activité" : "Machine").join(", ")}</div></div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="dataField" data-id="${field.id}">Modifier</button></div></article>`).join("")}</div>`).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Types de demandes clients</h2></div><div class="panel-body cards-list">${state.serviceTypes.map((type) => {
              const linked = state.interventionTypes.find((item) => item.id === type.linkedInterventionTypeId);
              return `<article class="list-item"><h3>${escapeHtml(type.name)}</h3><div class="meta">Priorité par défaut: ${statusText(type.defaultPriority)} | Checklist liée: ${escapeHtml(linked?.name || "-")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="serviceType" data-id="${type.id}">Modifier</button></div></article>`;
            }).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Types de checklist / intervention</h2></div><div class="panel-body cards-list">${state.interventionTypes.map((type) => `<article class="list-item"><h3>${escapeHtml(type.name)}</h3><div class="meta">Durée estimée: ${type.defaultDuration} min | ${type.checklist.length} étapes</div><div class="mini-list">${type.checklist.map((item) => `<div class="meta">- ${escapeHtml(item)}</div>`).join("")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="interventionType" data-id="${type.id}">Modifier</button></div></article>`).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Formulaires terrain</h2></div><div class="panel-body cards-list">${state.formTemplates.map((template) => { const linkedTypes = state.interventionTypes.filter((item) => item.defaultFormTemplateId === template.id); return `<article class="list-item"><h3>${escapeHtml(template.name)}</h3><div class="meta">${template.fields.length} question${template.fields.length > 1 ? "s" : ""} | Activités: ${escapeHtml(linkedTypes.map((item) => item.name).join(", ") || "Aucune")}</div><div class="mini-list">${template.fields.slice(0, 4).map((field) => `<div class="meta">- ${escapeHtml(field.label)} (${fieldTypeLabel(field.type)})</div>`).join("")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="formTemplate" data-id="${template.id}">Modifier</button><button class="ghost-button" data-action="duplicate-form-template" data-id="${template.id}">Dupliquer</button></div></article>`; }).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Dépôts</h2></div><div class="panel-body cards-list">${state.storageLocations.length ? state.storageLocations.map((storage) => { const building = state.buildings.find((item) => item.id === storage.buildingId); const scope = storage.scopeType === "company" ? "ClimaParc / atelier" : storage.scopeType === "building" ? `Lieu: ${building?.name || "-"}` : "Central du client"; return `<article class="list-item"><h3>${escapeHtml(storage.name)}</h3><div class="meta">${escapeHtml(scope)} | ${escapeHtml(state.clients.find((item) => item.id === storage.clientId)?.name || (storage.scopeType === "company" ? "ClimaParc" : "-"))} | ${escapeHtml(storage.address || "Adresse non précisée")} | ${storage.active === false ? "Inactif" : "Actif"}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="storageLocation" data-id="${escapeHtml(storage.id)}">Modifier</button></div></article>`; }).join("") : `<div class="empty">Aucun dépôt enregistré.</div>`}</div></div>
          </div><div class="panel"><div class="panel-header"><h2>Rôles et droits</h2></div><div class="panel-body cards-list">${state.roleDefinitions.map((role) => `<article class="list-item"><h3>${escapeHtml(role.name)}</h3><div class="meta">${role.rights.includes("all") ? "Tous les droits" : role.rights.map((right) => rightsCatalog().find((item) => item[0] === right)?.[1] || right).join(", ")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="role" data-id="${role.id}">Modifier</button></div></article>`).join("")}</div></div></section>`);
      }

      function dataFieldOptionLines(field) {
        return (field.options || []).map((option) => option.value && option.value !== option.label ? `${option.label} | ${option.value}` : option.label).join("\n");
      }

      function behaviorOptions(fieldId, selected) {
        const catalogs = {
          activity_status: [["completed", "Terminée"], ["partial", "Partielle"], ["not_completed", "Non effectuée"], ["return_required", "Retour nécessaire"]],
          equipment_status: [["operational", "Opérationnelle"], ["monitoring", "Surveillance"], ["repair_required", "Réparation nécessaire"], ["out_of_service", "Hors service"]],
          recommendation_type: [["informational", "Information"], ["diagnostic", "Diagnostic"], ["repair", "Réparation"], ["part", "Pièce"], ["replacement", "Remplacement d'une unité"]]
        };
        return (catalogs[fieldId] || [["", "Aucun comportement"]]).map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
      }

      function dataFieldOptionRow(fieldId, option = {}) {
        const existingCode = option.value || "";
        return `<div class="data-option-config" data-data-option-row>
          <input type="hidden" name="optionId" value="${escapeHtml(option.id || "")}">
          <input type="hidden" name="optionValue" value="${escapeHtml(existingCode)}">
          <span class="drag-handle" aria-hidden="true">≡</span>
          <input name="optionLabel" value="${escapeHtml(option.label || "")}" required placeholder="Libellé">
          <select name="optionBehavior" title="Comportement">${behaviorOptions(fieldId, option.behavior || "")}</select>
          <input name="optionColor" type="color" value="${escapeHtml(option.color || "#64748b")}" title="Couleur">
          <label class="option-active"><input type="checkbox" name="optionActive" ${option.active !== false ? "checked" : ""}> Actif</label>
          <button type="button" class="icon-button" data-action="move-data-option" data-direction="-1" title="Monter">↑</button>
          <button type="button" class="icon-button" data-action="move-data-option" data-direction="1" title="Descendre">↓</button>
          <button type="button" class="icon-button" data-action="deactivate-data-option" title="Désactiver ou retirer">×</button>
        </div>`;
      }

      function dataFieldModal(modal) {
        const field = state.dataFields.find((item) => item.id === modal.id) || { type: "single", group: "Machine", appliesTo: ["activity", "equipment"], options: [] };
        const managed = ["activity_status", "equipment_status", "recommendation_type"].includes(field.id);
        const optionsEditor = managed
          ? `<div class="field"><label>Options administrables</label><p class="meta">Le code interne reste stable. Modifiez le libellé, le comportement, la couleur, l'ordre ou désactivez l'option.</p><div class="data-options-editor" data-data-options-editor>${(field.options || []).map((option) => dataFieldOptionRow(field.id, option)).join("")}</div><button type="button" class="ghost-button" data-action="add-data-option">+ Ajouter une option</button></div>`
          : `<div class="field"><label>Options</label><p class="meta">Une option par ligne. Pour une valeur interne différente, utilisez: Étiquette | valeur</p><textarea name="options" rows="12" placeholder="Carrier&#10;Gree&#10;Actif | actif">${escapeHtml(dataFieldOptionLines(field))}</textarea></div>`;
        return modalShell(field.id ? "Modifier le champ de données" : "Nouveau champ de données", `<form class="form-grid" data-form="dataField">
          <input type="hidden" name="id" value="${escapeHtml(field.id || "")}"><div class="split"><div class="field"><label>Nom du champ</label><input name="name" value="${escapeHtml(field.name || "")}" required placeholder="Ex.: Marque"></div><div class="field"><label>Groupe de champs</label><input name="group" value="${escapeHtml(field.group || "Machine")}" required placeholder="Ex.: Machine"></div></div>
          <div class="split"><div class="field"><label>Type de champ</label><select name="type">${["text", "long", "single", "multiple", "number", "date", "phone"].map((type) => `<option value="${type}" ${field.type === type ? "selected" : ""}>${dataFieldTypeLabel(type)}</option>`).join("")}</select></div><div class="field"><label>Appliquer à</label><div class="choice-list"><label><input type="checkbox" name="appliesTo" value="activity" ${field.appliesTo?.includes("activity") ? "checked" : ""}> Activités terrain</label><label><input type="checkbox" name="appliesTo" value="equipment" ${field.appliesTo?.includes("equipment") ? "checked" : ""}> Dossier machine</label></div></div></div>
          ${optionsEditor}<button class="primary-button" type="submit">${field.id ? "Enregistrer" : "Créer le champ"}</button>
        </form>`);
      }

      function addDataFieldOption(form) {
        const fieldId = form?.querySelector('[name="id"]')?.value || "";
        form?.querySelector("[data-data-options-editor]")?.insertAdjacentHTML("beforeend", dataFieldOptionRow(fieldId));
      }

      function moveDataFieldOption(row, direction) {
        if (!row) return;
        const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        if (direction < 0) row.parentElement.insertBefore(row, sibling);
        else row.parentElement.insertBefore(sibling, row);
      }

      function deactivateDataFieldOption(row) {
        if (!row) return;
        const hasStableCode = Boolean(row.querySelector('[name="optionValue"]')?.value);
        if (!hasStableCode) {
          row.remove();
          return;
        }
        const active = row.querySelector('[name="optionActive"]');
        if (active) active.checked = false;
        row.classList.add("is-inactive");
      }

      function serviceTypeModal(modal) {
        const type = state.serviceTypes.find((item) => item.id === modal.id) || {};
        const options = state.interventionTypes.map((item) => `<option value="${item.id}" ${type.linkedInterventionTypeId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
        return modalShell(type.id ? "Modifier le type de demande" : "Nouveau type de demande", `<form class="form-grid" data-form="serviceType"><input type="hidden" name="id" value="${escapeHtml(type.id || "")}"><div class="field"><label>Nom du type de demande</label><input name="name" value="${escapeHtml(type.name || "")}" required></div><div class="split"><div class="field"><label>Priorité par défaut</label><select name="defaultPriority"><option value="basse" ${type.defaultPriority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${type.defaultPriority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${type.defaultPriority === "urgente" ? "selected" : ""}>Urgente</option></select></div><div class="field"><label>Checklist liée</label><select name="linkedInterventionTypeId">${options}</select></div></div><button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer le type"}</button></form>`);
      }

      function interventionTypeModal(modal) {
        const type = state.interventionTypes.find((item) => item.id === modal.id) || {};
        const forms = state.formTemplates.map((item) => `<option value="${escapeHtml(item.id)}" ${type.defaultFormTemplateId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
        return modalShell(type.id ? "Modifier le type d'intervention" : "Nouveau type d'intervention", `<form class="form-grid" data-form="interventionType"><input type="hidden" name="id" value="${escapeHtml(type.id || "")}"><div class="split"><div class="field"><label>Nom</label><input name="name" value="${escapeHtml(type.name || "")}" required></div><div class="field"><label>Durée estimée (minutes)</label><input name="defaultDuration" type="number" min="1" value="${escapeHtml(type.defaultDuration || 60)}" required></div></div><div class="split"><div class="field"><label>Formulaire terrain par défaut</label><select name="defaultFormTemplateId"><option value="">Aucun</option>${forms}</select></div><div class="field"><label>Comportement</label><select name="behavior"><option value="standard" ${type.behavior !== "replacement" ? "selected" : ""}>Intervention standard</option><option value="replacement" ${type.behavior === "replacement" ? "selected" : ""}>Remplacement d'une unité</option></select></div></div><div class="field"><label>Étapes de checklist</label><textarea name="checklist" required placeholder="Une étape par ligne">${escapeHtml((type.checklist || []).join("\n"))}</textarea></div><button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer le type"}</button></form>`);
      }

      function storageLocationModal(modal) {
        const storage = state.storageLocations.find((item) => item.id === modal.id) || { active: true, scopeType: "client" };
        const clients = state.clients.map((client) => `<option value="${escapeHtml(client.id)}" ${storage.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
        const buildings = state.buildings.map((building) => `<option value="${escapeHtml(building.id)}" ${storage.buildingId === building.id ? "selected" : ""}>${escapeHtml(state.clients.find((client) => client.id === building.clientId)?.name || "-")} | ${escapeHtml(building.name)}</option>`).join("");
        return modalShell(storage.id ? "Modifier le dépôt" : "Nouveau dépôt", `<form class="form-grid" data-form="storageLocation"><input type="hidden" name="id" value="${escapeHtml(storage.id || "")}"><div class="split"><div class="field"><label>Nom</label><input name="name" value="${escapeHtml(storage.name || "")}" required></div><div class="field"><label>Portée</label><select name="scopeType"><option value="client" ${(storage.scopeType || "client") === "client" ? "selected" : ""}>Central du client</option><option value="building" ${storage.scopeType === "building" ? "selected" : ""}>Associé à un lieu</option><option value="company" ${storage.scopeType === "company" ? "selected" : ""}>ClimaParc / atelier</option></select></div></div><div class="split"><div class="field"><label>Client</label><select name="clientId"><option value="">Sélectionner</option>${clients}</select></div><div class="field"><label>Lieu associé</label><select name="buildingId"><option value="">Aucun</option>${buildings}</select></div></div><div class="field"><label>Adresse ou description</label><input name="address" value="${escapeHtml(storage.address || "")}"></div><label class="check-row"><input type="checkbox" name="active" ${storage.active !== false ? "checked" : ""}><span><strong>Dépôt actif</strong></span></label><button class="primary-button" type="submit">Enregistrer</button></form>`);
      }

      function roleModal(modal) {
        const role = state.roleDefinitions.find((item) => item.id === modal.id) || {};
        const checks = rightsCatalog().map(([right, label]) => `<label class="check-row"><input type="checkbox" name="right-${right}" ${role.rights?.includes(right) ? "checked" : ""}><span><strong>${escapeHtml(label)}</strong><span>${escapeHtml(right)}</span></span></label>`).join("");
        return modalShell(role.id ? "Modifier le rôle" : "Nouveau rôle", `<form class="form-grid" data-form="role"><input type="hidden" name="id" value="${escapeHtml(role.id || "")}"><div class="split"><div class="field"><label>Identifiant du rôle</label><input name="roleId" value="${escapeHtml(role.id || "")}" ${role.id ? "readonly" : ""} required></div><div class="field"><label>Nom affiché</label><input name="name" value="${escapeHtml(role.name || "")}" required></div></div><div class="checklist">${checks}</div><button class="primary-button" type="submit">${role.id ? "Enregistrer" : "Créer le rôle"}</button></form>`);
      }

      function slugify(value) {
        return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || uid("q");
      }

      function parseDataFieldOptions(value) {
        return value.split(/\r?\n/).map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const [labelPart, valuePart] = trimmed.split("|").map((part) => part.trim());
          const label = labelPart || valuePart;
          const optionValue = valuePart || labelPart;
          return { id: slugify(optionValue || label), label, value: optionValue, active: true };
        }).filter(Boolean);
      }

      async function saveServiceType(values) {
        const payload = { id: values.id || uid("appel"), name: values.name, defaultPriority: values.defaultPriority, linkedInterventionTypeId: values.linkedInterventionTypeId };
        await saveSettingCollectionItem("serviceTypes", payload, state.serviceTypes.some((item) => item.id === payload.id) ? "Type de demande modifié." : "Type de demande créé.");
      }

      async function saveInterventionType(values) {
        const payload = { id: values.id || uid("check"), name: values.name, defaultDuration: Number(values.defaultDuration || 60), defaultFormTemplateId: values.defaultFormTemplateId || "", behavior: values.behavior || "standard", checklist: values.checklist.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) };
        await saveSettingCollectionItem("interventionTypes", payload, state.interventionTypes.some((item) => item.id === payload.id) ? "Checklist modifiée." : "Checklist créée.");
      }

      async function saveStorageLocation(form, values) {
        const payload = { id: values.id || uid("storage"), name: values.name, scopeType: values.scopeType || "client", clientId: values.clientId || "", buildingId: values.buildingId || "", address: values.address || "", active: Boolean(form.querySelector('[name="active"]')?.checked) };
        await saveSettingCollectionItem("storageLocations", payload, state.storageLocations.some((item) => item.id === payload.id) ? "Dépôt modifié." : "Dépôt créé.");
      }

      async function saveDataField(form, values) {
        const appliesTo = Array.from(form.querySelectorAll('[name="appliesTo"]:checked')).map((input) => input.value);
        const configuredOptions = Array.from(form.querySelectorAll("[data-data-option-row]")).map((row) => {
          const label = row.querySelector('[name="optionLabel"]')?.value?.trim() || "";
          const value = row.querySelector('[name="optionValue"]')?.value || slugify(label);
          return { id: row.querySelector('[name="optionId"]')?.value || slugify(value), label, value, behavior: row.querySelector('[name="optionBehavior"]')?.value || "", color: row.querySelector('[name="optionColor"]')?.value || "", active: Boolean(row.querySelector('[name="optionActive"]')?.checked) };
        }).filter((option) => option.label);
        const payload = { id: values.id || uid("datafield"), name: values.name.trim(), group: values.group.trim() || "Non groupé", type: values.type || "single", appliesTo: appliesTo.length ? appliesTo : ["activity"], options: configuredOptions.length ? configuredOptions : parseDataFieldOptions(values.options || "") };
        await saveSettingCollectionItem("dataFields", payload, state.dataFields.some((item) => item.id === payload.id) ? "Champ de données modifié." : "Champ de données créé.");
      }

      async function saveRole(form, values) {
        const roleId = values.id || values.roleId.trim().toLowerCase().replace(/\s+/g, "_");
        const rights = rightsCatalog().map(([right]) => right).filter((right) => form.querySelector(`[name="right-${right}"]`)?.checked);
        const payload = { id: roleId, name: values.name, rights };
        await saveSettingCollectionItem("roleDefinitions", payload, state.roleDefinitions.some((item) => item.id === roleId) ? "Rôle modifié." : "Rôle créé.");
      }

      return {
        addDataFieldOption, dataFieldGroups, dataFieldModal, dataFieldOptionLines, dataFieldTypeLabel, deactivateDataFieldOption,
        interventionTypeModal, parseDataFieldOptions, roleModal, saveDataField,
        moveDataFieldOption, saveInterventionType, saveRole, saveServiceType, serviceTypeModal,
        saveStorageLocation, settingsView, slugify, storageLocationModal
      };
    }
  };
})();
