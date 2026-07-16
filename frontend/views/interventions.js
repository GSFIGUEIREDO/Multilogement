(function () {
  function stateProxy(getState) {
    return new Proxy({}, {
      get: (_target, prop) => getState()[prop]
    });
  }

  window.ClimaParcInterventionsView = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        escapeHtml, formatCanadianPhone, normalizeDataOptions,
        formTemplateForOrder, formTemplateForActivity
      } = context;

      function dataFieldOptionsForConfig(config = {}) {
        const dataField = state.dataFields.find((field) => field.id === config.dataFieldId);
        if (!dataField) return normalizeDataOptions(config.options || []);
        const selected = config.optionIds || [];
        return dataField.options.filter((option) => option.active !== false && (!selected.length || selected.includes(option.id)));
      }

      function dataFieldOptionsForSelect(config = {}) {
        return dataFieldOptionsForConfig(config).map((option) => ({ value: option.value, label: option.label }));
      }

      function activityOptions(name, config = {}) {
        const localOptions = config.options || [];
        if (config.dataFieldId) {
          const centralOptions = dataFieldOptionsForConfig(config).map((option) => option.value);
          return Array.from(new Set([...centralOptions, ...localOptions])).sort((a, b) => a.localeCompare(b, "fr"));
        }
        const inventory = state.equipment.map((item) => ({ type: item.type, location: item.location, brand: item.brand, model: item.model }[name])).filter(Boolean);
        return Array.from(new Set([...localOptions, ...inventory])).sort((a, b) => a.localeCompare(b, "fr"));
      }

      function comboInput(name, value, options, required = false) {
        const uniqueOptions = Array.from(new Set(options || [])).filter(Boolean);
        return `<input name="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${required ? "required" : ""} placeholder="Tapez ou choisissez" autocomplete="off" data-combo-input><div class="combo-options hidden" data-combo-options>${uniqueOptions.map((option) => `<button type="button" data-action="combo-option" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("") || `<span>Aucune option</span>`}</div>`;
      }

      function activityTextInput(name, config, value) {
        return `<div class="field combo-field"><label>${escapeHtml(config.label)}${config.required ? " *" : ""}</label>${comboInput(name, value || "", activityOptions(name, config), config.required)}</div>`;
      }

      function renderDynamicField(field, value) {
        const scopes = Array.isArray(field.unitScopes) && field.unitScopes.length ? field.unitScopes : [field.unitScope || "all"];
        const systemTypes = Array.isArray(field.systemTypeIds) ? field.systemTypeIds : [];
        if (field.type === "section") return `<div class="form-runtime-section dynamic-field" data-dynamic-field-id="${escapeHtml(field.id)}" data-unit-scopes="${escapeHtml(scopes.join(","))}" data-system-types="${escapeHtml(systemTypes.join(","))}"><h3>${escapeHtml(field.label)}</h3></div>`;
        const meta = `data-dynamic-field-id="${escapeHtml(field.id)}" data-unit-scopes="${escapeHtml(scopes.join(","))}" data-system-types="${escapeHtml(systemTypes.join(","))}"`;
        const options = field.options?.length ? field.options : ["Oui"];
        const required = field.required ? "required" : "";
        const label = `${escapeHtml(field.label)}${field.required ? " *" : ""}`;
        const layout = field.layout === "half" ? " half-field" : "";
        if (field.type === "long") return `<div class="field dynamic-field${layout}" ${meta}><label>${label}</label><textarea name="field-${field.id}" ${required}>${escapeHtml(value || "")}</textarea></div>`;
        if (field.type === "checkbox") {
          const values = Array.isArray(value) ? value : [value].filter(Boolean);
          return `<div class="field dynamic-field${layout}" ${meta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list checkbox-choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${values.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
        }
        if (field.type === "single") return `<div class="field dynamic-field${layout}" ${meta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option, index) => `<label><input type="radio" name="field-${field.id}" value="${escapeHtml(option)}" ${value === option ? "checked" : ""} ${field.required && index === 0 ? "required" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
        if (field.type === "multiple") return `<div class="field dynamic-field${layout}" ${meta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${Array.isArray(value) && value.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
        if (field.type === "select") return `<div class="field combo-field dynamic-field${layout}" ${meta}><label>${label}</label>${comboInput(`field-${field.id}`, value || "", options, field.required)}</div>`;
        if (field.type === "phone") return `<div class="field dynamic-field${layout}" ${meta}><label>${label}</label><input name="field-${field.id}" value="${escapeHtml(formatCanadianPhone(value || ""))}" inputmode="tel" autocomplete="tel" placeholder="(514) 555-0123" data-phone-input ${required}></div>`;
        return `<div class="field dynamic-field${layout}" ${meta}><label>${label}</label><input name="field-${field.id}" value="${escapeHtml(value || "")}" ${required}></div>`;
      }

      function fieldsByRuntimeForm(form) {
        const order = state.workOrders.find((item) => item.id === form.dataset.orderId);
        return formTemplateForActivity(form.dataset.activityTypeId, order)?.fields || [];
      }

      function runtimeFieldValues(form, field) {
        const inputs = Array.from(form.querySelectorAll(`[name="field-${field.id}"]`));
        if (!inputs.length) return [];
        if (["checkbox", "multiple"].includes(field.type)) return inputs.filter((input) => input.checked).map((input) => input.value).filter(Boolean);
        if (field.type === "single") return [inputs.find((input) => input.checked)?.value].filter(Boolean);
        return [inputs[0].value].filter(Boolean);
      }

      function fieldAppliesToCurrentUnit(form, field) {
        const scopes = Array.isArray(field.unitScopes) && field.unitScopes.length ? field.unitScopes : [field.unitScope || "all"];
        const selectedSystem = state.hvacSystems.find((item) => item.id === form.querySelector('[name="systemId"]')?.value);
        const topology = selectedSystem?.topology || state.hvacSystemTypes.find((item) => item.id === selectedSystem?.systemTypeId)?.topology || "split";
        const currentScope = topology === "monobloc" ? "monobloc" : (form.querySelector('[name="unitKind"]')?.value || "interieure");
        const scopeMatches = scopes.includes("all") || scopes.includes(currentScope);
        const typeFilters = Array.isArray(field.systemTypeIds) ? field.systemTypeIds : [];
        const typeMatches = !typeFilters.length || typeFilters.includes(selectedSystem?.systemTypeId);
        return scopeMatches && typeMatches;
      }

      function legacyShowWhenMatches(form, field) {
        if (!field.showWhen?.fieldId || !field.showWhen?.value) return true;
        const source = fieldsByRuntimeForm(form).find((item) => item.id === field.showWhen.fieldId);
        return !source || runtimeFieldValues(form, source).includes(field.showWhen.value);
      }

      function branchTargetForRuntimeField(form, field) {
        if (field.type === "section") return field.nextFieldId || "";
        const values = runtimeFieldValues(form, field);
        const rules = field.branchRules || {};
        const orderedValues = (field.options || []).filter((option) => values.includes(option));
        const matched = [...orderedValues, ...values].find((value) => rules[value]);
        return matched ? rules[matched] : field.nextFieldId || "";
      }

      function visibleFormFieldIds(form, fields) {
        const visible = new Set();
        const indexById = new Map(fields.map((field, index) => [field.id, index]));
        let index = 0;
        let guard = 0;
        while (index >= 0 && index < fields.length && guard < fields.length * 3) {
          guard += 1;
          const field = fields[index];
          if (!fieldAppliesToCurrentUnit(form, field) || !legacyShowWhenMatches(form, field)) {
            index += 1;
            continue;
          }
          visible.add(field.id);
          const target = branchTargetForRuntimeField(form, field);
          if (target === "__end") break;
          if (target && indexById.has(target)) {
            index = indexById.get(target);
            continue;
          }
          index += 1;
        }
        return visible;
      }

      function updateDynamicVisibility(form) {
        if (!form || form.dataset.form !== "fieldIntervention") return;
        const fields = fieldsByRuntimeForm(form);
        if (!fields.length) return;
        const visible = visibleFormFieldIds(form, fields);
        form.querySelectorAll("[data-dynamic-field-id]").forEach((wrapper) => {
          const hidden = !visible.has(wrapper.dataset.dynamicFieldId);
          wrapper.classList.toggle("hidden", hidden);
          wrapper.querySelectorAll("input, select, textarea").forEach((input) => {
            input.disabled = hidden;
          });
        });
      }

      return {
        activityOptions, activityTextInput, branchTargetForRuntimeField, comboInput,
        dataFieldOptionsForConfig, dataFieldOptionsForSelect, fieldAppliesToCurrentUnit,
        fieldsByRuntimeForm, legacyShowWhenMatches, renderDynamicField,
        runtimeFieldValues, updateDynamicVisibility, visibleFormFieldIds
      };
    }
  };
})();
