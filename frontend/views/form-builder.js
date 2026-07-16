(function () {
  function stateProxy(getState) {
    return new Proxy({}, { get: (_target, prop) => getState()[prop] });
  }

  window.ClimaParcFormBuilder = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        escapeHtml, modalShell, normalizeActivityFields, uid, showToast,
        saveSettingCollectionItem
      } = context;

      function activityFieldCatalog() {
        return [["type", "Type"], ["location", "Localisation"], ["brand", "Marque"], ["model", "Modèle"], ["serial", "Numéro de série"], ["status", "Statut"], ["notes", "Notes machine"]];
      }

      function choiceFieldTypes() {
        return ["checkbox", "single", "multiple", "select"];
      }

      function questionTypeOptions(selected) {
        return [["text", "Réponse courte"], ["long", "Réponse longue"], ["checkbox", "Case à cocher"], ["single", "Choix unique"], ["multiple", "Choix multiples"], ["select", "Liste déroulante"], ["section", "Section"]]
          .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
      }

      function formBranchTargets(fields, currentId) {
        return fields.filter((item) => item.id !== currentId && item.label).map((item, index) => ({ id: item.id, label: `${index + 1}. ${item.label}` }));
      }

      function formOptionRow(option, field, targetOptions) {
        const defaults = Array.isArray(field.defaultValue) ? field.defaultValue : [field.defaultValue].filter(Boolean);
        const target = field.branchRules?.[option] || "";
        return `<div class="option-row" data-option-row><span class="option-drag-handle" draggable="true" title="Déplacer">☰</span><input name="q-option" value="${escapeHtml(option)}" placeholder="Option"><label class="inline-check"><input type="checkbox" name="q-option-default" ${defaults.includes(option) ? "checked" : ""}><span>Défaut</span></label><div class="field compact-field"><label>Aller à</label><select name="q-option-branch"><option value="">Suivant</option><option value="__end" ${target === "__end" ? "selected" : ""}>Fin du formulaire</option>${targetOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${target === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></div><button class="icon-button" type="button" data-action="remove-form-option" aria-label="Supprimer">X</button></div>`;
      }

      function normalizedUnitScopes(field = {}) {
        if (Array.isArray(field.unitScopes) && field.unitScopes.length) return field.unitScopes;
        return [field.unitScope || "all"];
      }

      function unitScopePicker(field = {}) {
        const selected = new Set(normalizedUnitScopes(field));
        const choices = [["all", "Toutes"], ["interieure", "Unité intérieure"], ["exterieure", "Unité extérieure"], ["monobloc", "Système unique"]];
        return `<div class="field"><label>Afficher pour</label><div class="choice-list unit-scope-picker">${choices.map(([value, label]) => `<label><input type="checkbox" name="q-unit-scope" value="${value}" ${selected.has(value) ? "checked" : ""}> ${label}</label>`).join("")}</div></div>`;
      }

      function systemTypePicker(field = {}) {
        const selected = new Set(field.systemTypeIds || []);
        return `<div class="field"><label>Types de système concernés</label><div class="choice-list">${state.hvacSystemTypes.filter((item) => item.active !== false || selected.has(item.id)).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((item) => `<label><input type="checkbox" name="q-system-type" value="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}> ${escapeHtml(item.name)}</label>`).join("")}</div><p class="meta">Laissez tout décoché pour appliquer à tous les types de système.</p></div>`;
      }

      function formBuilderSection(field, index) {
        return `<article class="question-card section-card" data-question data-field-id="${escapeHtml(field.id || "")}" draggable="true"><div class="question-card-head"><strong><span class="drag-handle">☰</span> Section ${index + 1}</strong><button class="icon-button" type="button" data-action="remove-form-question" aria-label="Supprimer">X</button></div><input type="hidden" name="q-type" value="section"><input type="hidden" name="q-layout" value="full"><div class="field"><label>Titre de section</label><input name="q-label" value="${escapeHtml(field.label || "")}" placeholder="Ex.: Unité intérieure 1 - Inspection" required></div>${unitScopePicker(field)}${systemTypePicker(field)}</article>`;
      }

      function formBuilderQuestion(field, index, allFields) {
        if (field.type === "section") return formBuilderSection(field, index);
        const targets = formBranchTargets(allFields, field.id);
        const choices = choiceFieldTypes().includes(field.type);
        return `<article class="question-card" data-question data-field-id="${escapeHtml(field.id || "")}" draggable="true">
          <div class="question-card-head"><strong><span class="drag-handle">☰</span> Question ${index + 1}</strong><div class="actions"><button class="icon-button" type="button" data-action="duplicate-form-question" aria-label="Dupliquer">+</button><button class="icon-button" type="button" data-action="remove-form-question" aria-label="Supprimer">X</button></div></div>
          <div class="field"><label>Question</label><input name="q-label" value="${escapeHtml(field.label || "")}" placeholder="Ex.: Etat general de l'unite" required></div><label class="inline-check"><input type="checkbox" name="q-required" ${field.required ? "checked" : ""}><span>Réponse obligatoire</span></label>
          <div class="split"><div class="field"><label>Type de réponse</label><select name="q-type">${questionTypeOptions(field.type)}</select></div><div class="field"><label>Disposition</label><select name="q-layout"><option value="full" ${field.layout !== "half" ? "selected" : ""}>Largeur complète</option><option value="half" ${field.layout === "half" ? "selected" : ""}>Demi-colonne</option></select></div></div>
          ${unitScopePicker(field)}${systemTypePicker(field)}
          <div class="field"><label>Réponse par défaut</label><input name="q-default" value="${escapeHtml(Array.isArray(field.defaultValue) ? field.defaultValue.join(", ") : field.defaultValue || "")}" placeholder="Option ou texte par défaut"></div>
          <div class="option-editor ${choices ? "" : "hidden"}" data-option-list>${(field.options?.length ? field.options : [""]).map((option) => formOptionRow(option, field, targets)).join("")}</div>
          <div class="actions option-actions ${choices ? "" : "hidden"}"><button class="link-button" type="button" data-action="add-form-option">+ Ajouter une option</button><button class="link-button" type="button" data-action="add-other-option">Ajouter une option « Autre »</button></div>
          <div class="branching-box"><div class="field"><label>Aller à après cette question</label><select name="q-next-branch"><option value="">Suivant</option><option value="__end" ${field.nextFieldId === "__end" ? "selected" : ""}>Fin du formulaire</option>${targets.map((item) => `<option value="${escapeHtml(item.id)}" ${field.nextFieldId === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></div><p class="meta">Pour les choix uniques, multiples ou listes, chaque option peut aussi avoir son propre Aller à.</p></div>
        </article>`;
      }

      function formActivityFieldRow(key, label, config = {}) {
        const supportsOptions = ["type", "location", "brand", "model", "status"].includes(key);
        const availableFields = state.dataFields.filter((field) => field.appliesTo.includes("activity"));
        const selectedField = config.dataFieldId ? state.dataFields.find((field) => field.id === config.dataFieldId) : null;
        return `<article class="activity-field-card" data-activity-field="${key}"><div class="activity-field-head"><strong>${escapeHtml(label)}</strong><label class="inline-check"><input type="checkbox" name="activity-required-${key}" ${config.required ? "checked" : ""}><span>Obligatoire</span></label></div>${supportsOptions ? `<div class="field"><label>Champ de données central</label><select name="activity-datafield-${key}"><option value="">Aucun champ central</option>${availableFields.map((field) => `<option value="${escapeHtml(field.id)}" ${selectedField?.id === field.id ? "selected" : ""}>${escapeHtml(field.group)} - ${escapeHtml(field.name)}</option>`).join("")}</select></div><div class="field data-option-picker"><label>Options visibles</label><div class="meta">Laissez tout décoché pour afficher toutes les options du champ.</div><div class="choice-list option-chip-list">${(selectedField?.options || []).map((option) => `<label><input type="checkbox" name="activity-option-${key}" value="${escapeHtml(option.id)}" ${(config.optionIds || []).includes(option.id) ? "checked" : ""}> ${escapeHtml(option.label)}</label>`).join("") || `<span class="meta">Aucune option dans ce champ.</span>`}</div></div><div class="field"><label>Options supplémentaires locales</label><textarea name="activity-options-${key}" placeholder="Une option par ligne">${escapeHtml((config.options || []).join("\n"))}</textarea></div>` : ""}</article>`;
      }

      function formTemplateModal(modal) {
        const template = state.formTemplates.find((item) => item.id === modal.id) || {};
        const fields = template.fields?.length ? template.fields : [{ id: "", label: "", type: "text", options: [], showWhen: null, layout: "full", defaultValue: "" }];
        const activityFields = normalizeActivityFields(template.activityFields);
        const associatedIds = new Set(state.interventionTypes.filter((item) => item.defaultFormTemplateId === template.id).map((item) => item.id));
        const activityLinks = state.interventionTypes.map((item) => `<label><input type="checkbox" name="associatedActivityTypeIds" value="${escapeHtml(item.id)}" ${associatedIds.has(item.id) ? "checked" : ""}> ${escapeHtml(item.name)}</label>`).join("");
        return modalShell(template.id ? "Modifier le formulaire terrain" : "Nouveau formulaire terrain", `<form class="form-grid" data-form="formTemplate"><input type="hidden" name="id" value="${escapeHtml(template.id || "")}"><div class="field"><label>Nom du formulaire</label><input name="name" value="${escapeHtml(template.name || "")}" required></div><div class="field"><label>Types d'activité associés</label><div class="choice-list">${activityLinks || `<span class="meta">Créez d'abord un type d'activité.</span>`}</div><p class="meta">Un même formulaire peut servir à plusieurs activités. Chaque activité conserve un seul formulaire terrain.</p></div><div class="form-section-title">Champs de l'activité</div><div class="forms-builder">${activityFieldCatalog().map(([key, label]) => formActivityFieldRow(key, label, activityFields[key])).join("")}</div><div class="form-section-title">Questions du formulaire</div><div class="forms-builder" data-question-list>${fields.map((field, index) => formBuilderQuestion(field, index, fields)).join("")}</div><button class="ghost-button" type="button" data-action="add-form-question">Ajouter une question</button><button class="ghost-button" type="button" data-action="add-form-section">Ajouter une section</button><button class="primary-button" type="submit">${template.id ? "Enregistrer" : "Créer le formulaire"}</button></form>`, "modal-card-wide form-template-modal");
      }

      function parseOptions(value) {
        return value.split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean);
      }

      function collectActivityFieldSettings(form) {
        return Object.fromEntries(activityFieldCatalog().map(([key, label]) => [key, {
          label,
          required: Boolean(form.querySelector(`[name="activity-required-${key}"]`)?.checked),
          dataFieldId: form.querySelector(`[name="activity-datafield-${key}"]`)?.value || "",
          optionIds: Array.from(form.querySelectorAll(`[name="activity-option-${key}"]:checked`)).map((input) => input.value),
          options: parseOptions(form.querySelector(`[name="activity-options-${key}"]`)?.value || "")
        }]));
      }

      async function saveFormTemplate(form, values) {
        const fields = Array.from(form.querySelectorAll("[data-question]")).map((card) => {
          const label = card.querySelector('[name="q-label"]')?.value.trim();
          if (!label) return null;
          const type = card.querySelector('[name="q-type"]')?.value || "text";
          const id = card.dataset.fieldId || uid(type === "section" ? "section" : "q");
          const checkedScopes = Array.from(card.querySelectorAll('[name="q-unit-scope"]:checked')).map((input) => input.value);
          const unitScopes = checkedScopes.includes("all") || !checkedScopes.length ? ["all"] : checkedScopes;
          const systemTypeIds = Array.from(card.querySelectorAll('[name="q-system-type"]:checked')).map((input) => input.value);
          if (type === "section") return { id, label, type, options: [], required: false, defaultValue: "", layout: "full", unitScope: unitScopes[0], unitScopes, systemTypeIds, branchRules: {}, nextFieldId: "", showWhen: null };
          const rows = Array.from(card.querySelectorAll("[data-option-row]"));
          const options = rows.map((row) => row.querySelector('[name="q-option"]')?.value.trim()).filter(Boolean);
          const defaults = rows.filter((row) => row.querySelector('[name="q-option-default"]')?.checked).map((row) => row.querySelector('[name="q-option"]')?.value.trim()).filter(Boolean);
          const branchRules = Object.fromEntries(rows.map((row) => {
            const option = row.querySelector('[name="q-option"]')?.value.trim();
            const target = row.querySelector('[name="q-option-branch"]')?.value || "";
            return option && target ? [option, target] : null;
          }).filter(Boolean));
          return { id, label, type, options, required: Boolean(card.querySelector('[name="q-required"]')?.checked), defaultValue: ["multiple", "checkbox"].includes(type) ? defaults : (defaults[0] || card.querySelector('[name="q-default"]')?.value.trim() || ""), layout: card.querySelector('[name="q-layout"]')?.value || "full", unitScope: unitScopes[0], unitScopes, systemTypeIds, branchRules, nextFieldId: card.querySelector('[name="q-next-branch"]')?.value || "", showWhen: null };
        }).filter(Boolean);
        if (!fields.length) return showToast("Ajoutez au moins une question.");
        const payload = { id: values.id || uid("form"), name: values.name, associatedActivityTypeIds: Array.from(form.querySelectorAll('[name="associatedActivityTypeIds"]:checked')).map((input) => input.value), activityFields: collectActivityFieldSettings(form), fields };
        await saveSettingCollectionItem("formTemplates", payload, state.formTemplates.some((item) => item.id === payload.id) ? "Formulaire modifié." : "Formulaire créé.");
      }

      function currentBuilderFields(form) {
        return Array.from(form.querySelectorAll("[data-question]")).map((card) => {
          if (!card.dataset.fieldId) card.dataset.fieldId = uid("q");
          return { id: card.dataset.fieldId, label: card.querySelector('[name="q-label"]')?.value.trim() || "Question sans titre" };
        });
      }

      function refreshFormBranching(form) {
        if (!form || form.dataset.form !== "formTemplate") return;
        const fields = currentBuilderFields(form);
        form.querySelectorAll("[data-question]").forEach((card) => {
          const options = fields.filter((field) => field.id !== card.dataset.fieldId).map((field, index) => `<option value="${escapeHtml(field.id)}">${index + 1}. ${escapeHtml(field.label)}</option>`).join("");
          [card.querySelector('[name="q-next-branch"]'), ...card.querySelectorAll('[name="q-option-branch"]')].filter(Boolean).forEach((select) => {
            const selected = select.value;
            select.innerHTML = `<option value="">Suivant</option><option value="__end">Fin du formulaire</option>${options}`;
            select.value = selected;
          });
        });
      }

      function addFormQuestion(form) {
        if (!form) return;
        const fields = currentBuilderFields(form);
        form.querySelector("[data-question-list]").insertAdjacentHTML("beforeend", formBuilderQuestion({ id: uid("q"), label: "", type: "select", options: [""], showWhen: null, layout: "full", defaultValue: "" }, fields.length, fields));
        refreshFormBranching(form);
      }

      function addFormSection(form) {
        if (!form) return;
        const fields = currentBuilderFields(form);
        form.querySelector("[data-question-list]").insertAdjacentHTML("beforeend", formBuilderQuestion({ id: uid("section"), label: "", type: "section", options: [], showWhen: null, layout: "full" }, fields.length, fields));
        refreshFormBranching(form);
      }

      function duplicateFormQuestion(card) {
        if (!card) return;
        const clone = card.cloneNode(true);
        clone.dataset.fieldId = uid("q");
        clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
        card.insertAdjacentElement("afterend", clone);
        refreshFormBranching(card.closest("form"));
      }

      function addFormOption(card, value = "") {
        if (!card) return;
        const fields = currentBuilderFields(card.closest("form"));
        card.querySelector("[data-option-list]").insertAdjacentHTML("beforeend", formOptionRow(value, { defaultValue: "", branchRules: {} }, formBranchTargets(fields, card.dataset.fieldId)));
      }

      function updateQuestionOptionEditor(card) {
        if (!card) return;
        const show = choiceFieldTypes().includes(card.querySelector('[name="q-type"]')?.value);
        const list = card.querySelector("[data-option-list]");
        list?.classList.toggle("hidden", !show);
        card.querySelector(".option-actions")?.classList.toggle("hidden", !show);
        if (show && list && !list.querySelector("[data-option-row]")) addFormOption(card);
      }

      function updateActivityOptionPicker(select) {
        const key = select.name.replace("activity-datafield-", "");
        const list = select.closest("[data-activity-field]")?.querySelector(".option-chip-list");
        const field = state.dataFields.find((item) => item.id === select.value);
        if (list) list.innerHTML = (field?.options || []).map((option) => `<label><input type="checkbox" name="activity-option-${key}" value="${escapeHtml(option.id)}"> ${escapeHtml(option.label)}</label>`).join("") || `<span class="meta">Aucune option dans ce champ.</span>`;
      }

      function updateUnitScopeSelection(input) {
        const card = input?.closest("[data-question]");
        if (!card || input.name !== "q-unit-scope") return;
        const all = card.querySelector('[name="q-unit-scope"][value="all"]');
        const specifics = Array.from(card.querySelectorAll('[name="q-unit-scope"]:not([value="all"])'));
        if (input.value === "all" && input.checked) specifics.forEach((item) => { item.checked = false; });
        if (input.value !== "all" && input.checked && all) all.checked = false;
        if (!card.querySelector('[name="q-unit-scope"]:checked') && all) all.checked = true;
      }

      function removeFormOption(row) {
        if (!row) return;
        const list = row.closest("[data-option-list]");
        if (list.querySelectorAll("[data-option-row]").length <= 1) row.querySelector('[name="q-option"]').value = "";
        else row.remove();
      }

      function removeFormQuestion(card) {
        if (!card) return;
        const form = card.closest("form");
        if (form.querySelectorAll("[data-question]").length <= 1) return showToast("Gardez au moins une question.");
        card.remove();
        refreshFormBranching(form);
      }

      async function duplicateFormTemplate(id) {
        const template = state.formTemplates.find((item) => item.id === id);
        if (!template) return;
        const copy = JSON.parse(JSON.stringify(template));
        const idMap = Object.fromEntries(copy.fields.map((field) => [field.id, uid(field.type === "section" ? "section" : "q")]));
        copy.id = uid("form");
        copy.name = `${template.name} - copie`;
        copy.associatedActivityTypeIds = [];
        copy.fields = copy.fields.map((field) => ({ ...field, id: idMap[field.id], showWhen: field.showWhen ? { ...field.showWhen, fieldId: idMap[field.showWhen.fieldId] || field.showWhen.fieldId } : null, nextFieldId: idMap[field.nextFieldId] || field.nextFieldId || "", branchRules: Object.fromEntries(Object.entries(field.branchRules || {}).map(([option, target]) => [option, idMap[target] || target])) }));
        await saveSettingCollectionItem("formTemplates", copy, "Formulaire dupliqué.", { modal: { type: "formTemplate", id: copy.id }, activeView: "parametres" });
      }

      return {
        activityFieldCatalog, addFormOption, addFormQuestion, addFormSection,
        choiceFieldTypes, collectActivityFieldSettings, currentBuilderFields,
        duplicateFormQuestion, duplicateFormTemplate, formActivityFieldRow,
        formBranchTargets, formBuilderQuestion, formBuilderSection, formOptionRow,
        formTemplateModal, parseOptions, questionTypeOptions, refreshFormBranching,
        removeFormOption, removeFormQuestion, saveFormTemplate,
        updateActivityOptionPicker, updateQuestionOptionEditor, updateUnitScopeSelection
      };
    }
  };
})();
