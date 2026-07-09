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
        const actions = `<button class="primary-button" data-action="open-modal" data-modal="dataField">Champ de données</button><button class="primary-button" data-action="open-modal" data-modal="serviceType">Type de demande</button><button class="ghost-button" data-action="open-modal" data-modal="interventionType">Type de checklist</button><button class="ghost-button" data-action="open-modal" data-modal="formTemplate">Formulaire terrain</button>`;
        return appShell(`${renderTopbar("Paramètres", "Types de demandes, checklists et droits d'accès.", actions)}
          <section class="grid"><div class="stack">
            <div class="panel"><div class="panel-header"><h2>Champs de données</h2></div><div class="panel-body cards-list">${dataFieldGroups().map(([group, fields]) => `<div class="data-field-group"><div class="data-field-group-title">${escapeHtml(group)} <span>${fields.length}</span></div>${fields.map((field) => `<article class="list-item data-field-item"><div><h3>${escapeHtml(field.name)}</h3><div class="meta">${dataFieldTypeLabel(field.type)} | ${field.options.length} option${field.options.length > 1 ? "s" : ""} | ${field.appliesTo.map((item) => item === "activity" ? "Activité" : "Machine").join(", ")}</div></div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="dataField" data-id="${field.id}">Modifier</button></div></article>`).join("")}</div>`).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Types de demandes clients</h2></div><div class="panel-body cards-list">${state.serviceTypes.map((type) => {
              const linked = state.interventionTypes.find((item) => item.id === type.linkedInterventionTypeId);
              return `<article class="list-item"><h3>${escapeHtml(type.name)}</h3><div class="meta">Priorité par défaut: ${statusText(type.defaultPriority)} | Checklist liée: ${escapeHtml(linked?.name || "-")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="serviceType" data-id="${type.id}">Modifier</button></div></article>`;
            }).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Types de checklist / intervention</h2></div><div class="panel-body cards-list">${state.interventionTypes.map((type) => `<article class="list-item"><h3>${escapeHtml(type.name)}</h3><div class="meta">Durée estimée: ${type.defaultDuration} min | ${type.checklist.length} étapes</div><div class="mini-list">${type.checklist.map((item) => `<div class="meta">- ${escapeHtml(item)}</div>`).join("")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="interventionType" data-id="${type.id}">Modifier</button></div></article>`).join("")}</div></div>
            <div class="panel"><div class="panel-header"><h2>Formulaires terrain</h2></div><div class="panel-body cards-list">${state.formTemplates.map((template) => `<article class="list-item"><h3>${escapeHtml(template.name)}</h3><div class="meta">${template.fields.length} question${template.fields.length > 1 ? "s" : ""}</div><div class="mini-list">${template.fields.slice(0, 4).map((field) => `<div class="meta">- ${escapeHtml(field.label)} (${fieldTypeLabel(field.type)})</div>`).join("")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="formTemplate" data-id="${template.id}">Modifier</button><button class="ghost-button" data-action="duplicate-form-template" data-id="${template.id}">Dupliquer</button></div></article>`).join("")}</div></div>
          </div><div class="panel"><div class="panel-header"><h2>Rôles et droits</h2></div><div class="panel-body cards-list">${state.roleDefinitions.map((role) => `<article class="list-item"><h3>${escapeHtml(role.name)}</h3><div class="meta">${role.rights.includes("all") ? "Tous les droits" : role.rights.map((right) => rightsCatalog().find((item) => item[0] === right)?.[1] || right).join(", ")}</div><div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="role" data-id="${role.id}">Modifier</button></div></article>`).join("")}</div></div></section>`);
      }

      function dataFieldOptionLines(field) {
        return (field.options || []).map((option) => option.value && option.value !== option.label ? `${option.label} | ${option.value}` : option.label).join("\n");
      }

      function dataFieldModal(modal) {
        const field = state.dataFields.find((item) => item.id === modal.id) || { type: "single", group: "Machine", appliesTo: ["activity", "equipment"], options: [] };
        return modalShell(field.id ? "Modifier le champ de données" : "Nouveau champ de données", `<form class="form-grid" data-form="dataField">
          <input type="hidden" name="id" value="${escapeHtml(field.id || "")}"><div class="split"><div class="field"><label>Nom du champ</label><input name="name" value="${escapeHtml(field.name || "")}" required placeholder="Ex.: Marque"></div><div class="field"><label>Groupe de champs</label><input name="group" value="${escapeHtml(field.group || "Machine")}" required placeholder="Ex.: Machine"></div></div>
          <div class="split"><div class="field"><label>Type de champ</label><select name="type">${["text", "long", "single", "multiple", "number", "date", "phone"].map((type) => `<option value="${type}" ${field.type === type ? "selected" : ""}>${dataFieldTypeLabel(type)}</option>`).join("")}</select></div><div class="field"><label>Appliquer à</label><div class="choice-list"><label><input type="checkbox" name="appliesTo" value="activity" ${field.appliesTo?.includes("activity") ? "checked" : ""}> Activités terrain</label><label><input type="checkbox" name="appliesTo" value="equipment" ${field.appliesTo?.includes("equipment") ? "checked" : ""}> Dossier machine</label></div></div></div>
          <div class="field"><label>Options</label><p class="meta">Une option par ligne. Pour une valeur interne différente, utilisez: Étiquette | valeur</p><textarea name="options" rows="12" placeholder="Carrier&#10;Gree&#10;Actif | actif">${escapeHtml(dataFieldOptionLines(field))}</textarea></div><button class="primary-button" type="submit">${field.id ? "Enregistrer" : "Créer le champ"}</button>
        </form>`);
      }

      function serviceTypeModal(modal) {
        const type = state.serviceTypes.find((item) => item.id === modal.id) || {};
        const options = state.interventionTypes.map((item) => `<option value="${item.id}" ${type.linkedInterventionTypeId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
        return modalShell(type.id ? "Modifier le type de demande" : "Nouveau type de demande", `<form class="form-grid" data-form="serviceType"><input type="hidden" name="id" value="${escapeHtml(type.id || "")}"><div class="field"><label>Nom du type de demande</label><input name="name" value="${escapeHtml(type.name || "")}" required></div><div class="split"><div class="field"><label>Priorité par défaut</label><select name="defaultPriority"><option value="basse" ${type.defaultPriority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${type.defaultPriority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${type.defaultPriority === "urgente" ? "selected" : ""}>Urgente</option></select></div><div class="field"><label>Checklist liée</label><select name="linkedInterventionTypeId">${options}</select></div></div><button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer le type"}</button></form>`);
      }

      function interventionTypeModal(modal) {
        const type = state.interventionTypes.find((item) => item.id === modal.id) || {};
        return modalShell(type.id ? "Modifier le type de checklist" : "Nouveau type de checklist", `<form class="form-grid" data-form="interventionType"><input type="hidden" name="id" value="${escapeHtml(type.id || "")}"><div class="split"><div class="field"><label>Nom</label><input name="name" value="${escapeHtml(type.name || "")}" required></div><div class="field"><label>Durée estimée (minutes)</label><input name="defaultDuration" type="number" min="1" value="${escapeHtml(type.defaultDuration || 60)}" required></div></div><div class="field"><label>Étapes de checklist</label><textarea name="checklist" required placeholder="Une étape par ligne">${escapeHtml((type.checklist || []).join("\n"))}</textarea></div><button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer la checklist"}</button></form>`);
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
        const payload = { id: values.id || uid("check"), name: values.name, defaultDuration: Number(values.defaultDuration || 60), checklist: values.checklist.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) };
        await saveSettingCollectionItem("interventionTypes", payload, state.interventionTypes.some((item) => item.id === payload.id) ? "Checklist modifiée." : "Checklist créée.");
      }

      async function saveDataField(form, values) {
        const appliesTo = Array.from(form.querySelectorAll('[name="appliesTo"]:checked')).map((input) => input.value);
        const payload = { id: values.id || uid("datafield"), name: values.name.trim(), group: values.group.trim() || "Non groupé", type: values.type || "single", appliesTo: appliesTo.length ? appliesTo : ["activity"], options: parseDataFieldOptions(values.options || "") };
        await saveSettingCollectionItem("dataFields", payload, state.dataFields.some((item) => item.id === payload.id) ? "Champ de données modifié." : "Champ de données créé.");
      }

      async function saveRole(form, values) {
        const roleId = values.id || values.roleId.trim().toLowerCase().replace(/\s+/g, "_");
        const rights = rightsCatalog().map(([right]) => right).filter((right) => form.querySelector(`[name="right-${right}"]`)?.checked);
        const payload = { id: roleId, name: values.name, rights };
        await saveSettingCollectionItem("roleDefinitions", payload, state.roleDefinitions.some((item) => item.id === roleId) ? "Rôle modifié." : "Rôle créé.");
      }

      return {
        dataFieldGroups, dataFieldModal, dataFieldOptionLines, dataFieldTypeLabel,
        interventionTypeModal, parseDataFieldOptions, roleModal, saveDataField,
        saveInterventionType, saveRole, saveServiceType, serviceTypeModal,
        settingsView, slugify
      };
    }
  };
})();
