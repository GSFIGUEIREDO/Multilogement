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

  window.ClimaParcDashboard = {
    create(context) {
      const state = stateProxy(context.getState);
      const {
        appShell,
        renderTopbar,
        currentUser,
        scopedEquipment,
        scopedTickets,
        scopedWorkOrders,
        scopedReminders,
        scopedRecommendations,
        reminderIsDue,
        recommendationAttentionCount,
        can,
        canCreateWorkOrders,
        canManageReminders,
        today,
        monthStart,
        monthCalendarDays,
        workOrderContext,
        equipmentContext,
        formatDate,
        escapeHtml,
        iconSvg,
        setState,
        equipmentTable,
        ticketItem,
        workOrderItem
      } = context;

  function dashboard() {
    if (currentUser()?.role === "client") return clientDashboard();
    return internalDashboard();
  }

  function defaultDashboardWidgets() {
    return [
      { id: "calendar", size: "full" },
      { id: "demands", size: "half" },
      { id: "workorders", size: "half" },
      { id: "alerts", size: "half" },
      { id: "recommendations", size: "half" }
    ];
  }

  function dashboardLayoutForCurrentUser() {
    const userId = currentUser()?.id || "default";
    const saved = state.dashboardLayouts?.[userId] || [];
    const defaults = defaultDashboardWidgets();
    if (!saved.length) return defaults;
    if (!defaults.every((widget) => saved.some((item) => item.id === widget.id))) return defaults;
    if (dashboardUsesOldCompactDefault(saved)) return defaults;
    const defaultById = new Map(defaults.map((item) => [item.id, item]));
    const knownSaved = saved.filter((item) => defaultById.has(item.id)).map((item) => ({ ...defaultById.get(item.id), ...item, size: normalizeDashboardWidgetSize(item.size) }));
    const savedIds = new Set(knownSaved.map((item) => item.id));
    return [...knownSaved, ...defaults.filter((item) => !savedIds.has(item.id))];
  }

  function dashboardUsesOldCompactDefault(layout) {
    const metricIds = ["demands", "workorders", "alerts", "recommendations"];
    return metricIds.every((id) => {
      const widget = layout.find((item) => item.id === id);
      return normalizeDashboardWidgetSize(widget?.size) === "quarter";
    });
  }

  function normalizeDashboardWidgetSize(size) {
    return {
      small: "third",
      medium: "half",
      wide: "full"
    }[size] || size || "half";
  }

  function internalDashboard() {
    const layout = dashboardLayoutForCurrentUser();
    const editMode = Boolean(state.dashboardEditMode);
    const dueReminders = scopedReminders().filter((reminder) => reminder.status === "active" && !reminder.lastWorkOrderId).sort((a, b) => (a.nextDueDate || "").localeCompare(b.nextDueDate || ""));
    const notificationCount = dueReminders.filter((reminder) => reminderIsDue(reminder)).length + recommendationAttentionCount();
    const actions = `
      <button class="icon-button notification-button" data-action="view" data-view="alertes" title="Centre d'alertes" aria-label="Centre d'alertes">
        ${iconSvg("bell")}${notificationCount ? `<span class="alert-dot"></span>` : ""}
      </button>
      <button class="ghost-button" data-action="toggle-dashboard-edit">${editMode ? "Terminer" : "Modifier"}</button>
      ${canCreateWorkOrders() ? `<button class="primary-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : ""}
    `;

    return appShell(`
      ${renderTopbar("Tableau de bord", "Vue opérationnelle des RDV, demandes clients et travaux en cours.", actions)}
      <section class="dashboard-board ${editMode ? "is-editing" : ""}">
        ${layout.map((widget, index) => dashboardWidget(widget, index, editMode, layout.length)).join("")}
      </section>
    `);
  }

  function dashboardWidget(widget, index, editMode, total) {
    const title = {
      calendar: "Calendrier des RDV",
      demands: "Nouvelles demandes",
      workorders: "Bons de travail en cours",
      alerts: "Alertes à transformer en BT",
      recommendations: "Recommandations approuvées"
    }[widget.id] || widget.id;
    const body = {
      calendar: dashboardCalendarWidget,
      demands: dashboardDemandWidget,
      workorders: dashboardWorkOrderWidget,
      alerts: dashboardAlertWidget,
      recommendations: dashboardRecommendationWidget
    }[widget.id]?.() || "";
    const editControls = editMode ? `
      <div class="dashboard-edit-controls">
        <span class="drag-handle" title="Déplacer">⋮⋮</span>
        <select data-action="dashboard-widget-size" data-widget="${widget.id}">
          <option value="quarter" ${widget.size === "quarter" ? "selected" : ""}>25%</option>
          <option value="third" ${widget.size === "third" ? "selected" : ""}>33%</option>
          <option value="half" ${widget.size === "half" ? "selected" : ""}>50%</option>
          <option value="two-thirds" ${widget.size === "two-thirds" ? "selected" : ""}>66%</option>
          <option value="three-quarters" ${widget.size === "three-quarters" ? "selected" : ""}>75%</option>
          <option value="full" ${widget.size === "full" ? "selected" : ""}>100%</option>
        </select>
      </div>
    ` : "";
    const headerTools = widget.id === "calendar" ? `<div class="dashboard-header-tools">${dashboardCalendarControls()}${editControls}</div>` : editControls;
    return `
      <article class="panel dashboard-widget widget-${escapeHtml(widget.size || "half")}" data-dashboard-widget="${escapeHtml(widget.id)}" ${editMode ? `draggable="true"` : ""}>
        <div class="panel-header"><h2>${escapeHtml(title)}</h2>${headerTools}</div>
        <div class="panel-body">${body}</div>
      </article>
    `;
  }

  function dashboardCalendarControls() {
    const month = monthStart(state.dashboardCalendarDate || today());
    return `
      <div class="calendar-toolbar">
        <button class="icon-button" data-action="dashboard-calendar-month" data-direction="-1" aria-label="Mois précédent">${iconSvg("chevronLeft")}</button>
        <input type="month" data-action="dashboard-calendar-date" value="${escapeHtml(month.slice(0, 7))}" aria-label="Mois du calendrier">
        <button class="icon-button" data-action="dashboard-calendar-month" data-direction="1" aria-label="Mois suivant">${iconSvg("chevronRight")}</button>
      </div>
    `;
  }

  function dashboardCalendarWidget() {
    const month = monthStart(state.dashboardCalendarDate || today());
    const days = monthCalendarDays(month);
    const orders = scopedWorkOrders().filter((order) => order.scheduledDate >= days[0] && order.scheduledDate <= days[days.length - 1]).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const currentMonth = month.slice(0, 7);
    const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    return `
      <div class="dashboard-calendar">
        ${weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
        ${days.map((day) => {
          const dayOrders = orders.filter((order) => order.scheduledDate === day);
          return `
            <div class="calendar-day ${day === today() ? "today" : ""} ${day.slice(0, 7) !== currentMonth ? "outside-month" : ""}">
              <div class="calendar-day-number">${Number(day.slice(8, 10))}</div>
              <div class="calendar-events">
                ${dayOrders.slice(0, 3).map((order) => {
                  const context = workOrderContext(order);
                  return `<button class="calendar-event status-${escapeHtml(order.status || "planifie")}" data-action="dashboard-workorder" data-id="${escapeHtml(order.id)}">${escapeHtml(order.number)} · ${escapeHtml(context.building?.name || "-")}</button>`;
                }).join("")}
                ${dayOrders.length > 3 ? `<span class="calendar-more">+${dayOrders.length - 3} RDV</span>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function dashboardDemandWidget() {
    const tickets = scopedTickets().filter((ticket) => ticket.status !== "ferme").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
    const preview = tickets.slice(0, 2).map((ticket) => {
      const { equipment, apartment, building } = equipmentContext(ticket.equipmentId);
      return `<button class="mini-row" data-action="dashboard-ticket" data-id="${escapeHtml(ticket.id)}"><strong>${escapeHtml(ticket.number || ticket.id)}</strong><span>${escapeHtml(ticket.title)}</span><small>${escapeHtml(building?.name || "-")} | Apt ${escapeHtml(apartment?.number || "-")} | ${escapeHtml(equipment?.type || "-")}</small></button>`;
    }).join("");
    return dashboardMetricSummary("file", "Nouvelles demandes", tickets.length, "Nouveau", "blue", "appels") + (preview ? `<div class="dashboard-preview">${preview}</div>` : "");
  }

  function dashboardWorkOrderWidget() {
    const orders = scopedWorkOrders().filter((order) => order.status === "en_cours").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 6);
    const preview = orders.slice(0, 2).map((order) => {
      const { equipment, building } = workOrderContext(order);
      return `<button class="mini-row" data-action="dashboard-workorder" data-id="${escapeHtml(order.id)}"><strong>${escapeHtml(order.number)}</strong><span>RDV ${formatDate(order.scheduledDate)}</span><small>${escapeHtml(building?.name || "-")} | ${escapeHtml(equipment?.type || "Bloc complet")}</small></button>`;
    }).join("");
    return dashboardMetricSummary("wrench", "Bons de travail en cours", orders.length, "En cours", "orange", "bons") + (preview ? `<div class="dashboard-preview">${preview}</div>` : "");
  }

  function dashboardAlertWidget() {
    const reminders = scopedReminders().filter((reminder) => reminder.status === "active" && !reminder.lastWorkOrderId).sort((a, b) => (a.nextDueDate || "").localeCompare(b.nextDueDate || "")).slice(0, 6);
    const preview = reminders.slice(0, 1).map((reminder) => {
      const { equipment, apartment, building } = equipmentContext(reminder.equipmentId);
      return `
        <div class="mini-row">
          <strong>${escapeHtml(reminder.title)} - ${formatDate(reminder.nextDueDate)}</strong>
          <span>${escapeHtml(building?.name || "-")} | Apt ${escapeHtml(apartment?.number || "-")} | ${escapeHtml(equipment?.type || "-")}</span>
          ${canCreateWorkOrders() ? `<button class="ghost-button small-action-button" data-action="open-modal" data-modal="workorder" data-equipment="${escapeHtml(reminder.equipmentId)}" data-reminder="${escapeHtml(reminder.id)}">Créer BT</button>` : ""}
        </div>
      `;
    }).join("");
    return dashboardMetricSummary("alertTriangle", "Alertes à transformer en BT", reminders.length, "Action requise", "yellow", "alertes") + (preview ? `<div class="dashboard-preview">${preview}</div>` : "");
  }

  function dashboardRecommendationWidget() {
    const approved = scopedRecommendations().filter(({ recommendation }) => recommendation.status === "approuvee" && !recommendation.workOrderId).slice(0, 5);
    const preview = approved.slice(0, 2).map(({ intervention, recommendation }) => {
      const { equipment, apartment, building } = equipmentContext(intervention.equipmentId);
      return `<button class="mini-row" data-action="create-bt-from-recommendation" data-id="${escapeHtml(intervention.id)}"><strong>${escapeHtml(recommendation.type || "Travaux")}</strong><span>${escapeHtml(recommendation.priority || "À planifier")}</span><small>${escapeHtml(building?.name || "-")} | Apt ${escapeHtml(apartment?.number || "-")} | ${escapeHtml(equipment?.type || "-")}</small></button>`;
    }).join("");
    return dashboardMetricSummary("check", "Recommandations approuvées", approved.length, "Validé", "green", "recommandations") + (preview ? `<div class="dashboard-preview">${preview}</div>` : "");
  }

  function dashboardMetricSummary(icon, title, value, badge, tone, view) {
    return `
      <button class="dashboard-metric-summary tone-${escapeHtml(tone)}" data-action="view" data-view="${escapeHtml(view)}">
        <span class="metric-icon">${iconSvg(icon)}</span>
        <span class="metric-copy"><span>${escapeHtml(title)}</span><strong>${value}</strong></span>
        <span class="metric-badge">${escapeHtml(badge)}</span>
      </button>
    `;
  }

  function saveDashboardLayout(layout) {
    const userId = currentUser()?.id || "default";
    setState({ dashboardLayouts: { ...(state.dashboardLayouts || {}), [userId]: layout } });
  }

  function clientDashboard() {
    const equipment = scopedEquipment();
    const tickets = scopedTickets();
    const orders = scopedWorkOrders();
    const reminders = scopedReminders();
    const overdue = equipment.filter((item) => item.nextService <= today() && item.status !== "hors_service").length;
    const ongoing = tickets.filter((ticket) => ["ouvert", "en_cours"].includes(ticket.status)).length;
    const planned = orders.filter((order) => order.status === "planifie").length;
    const out = equipment.filter((item) => item.status === "hors_service").length;
    const dueReminders = reminders.filter((reminder) => reminderIsDue(reminder));
    const stats = [
      ["Équipements", equipment.length],
      ["À traiter", ongoing],
      ["BT planifiés", planned],
      ["Alertes", dueReminders.length],
      ["Hors service", out + overdue]
    ];

    const recentOrders = orders
      .slice()
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      .slice(0, 5)
      .map((order) => workOrderItem(order, false, true))
      .join("");

    const urgentTickets = tickets
      .filter((ticket) => ticket.status !== "ferme")
      .slice(0, 5)
      .map((ticket) => ticketItem(ticket, false, true))
      .join("");

    const actions = `
      ${can("tickets") ? `<button class="primary-button" data-action="open-modal" data-modal="ticket">Nouvelle demande</button>` : ""}
      ${canCreateWorkOrders() ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : ""}
    `;

    return appShell(`
      ${renderTopbar("Tableau de bord", "Vue opérationnelle du parc HVAC et des travaux en cours.", actions)}
      <section class="stats-grid">
        ${stats.map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("")}
      </section>
      <section class="grid">
        <div class="panel">
          <div class="panel-header"><h2>Équipements à surveiller</h2><button class="ghost-button" data-action="view" data-view="equipements">Voir tout</button></div>
          <div class="panel-body">${equipmentTable(equipment.filter((item) => item.status !== "actif" || item.nextService <= today()).slice(0, 6), false)}</div>
        </div>
        <div class="stack">
          ${can("tickets") ? `<button class="quick-action" data-action="open-modal" data-modal="ticket">Ouvrir une demande<span>Demande client, urgence ou suivi préventif.</span></button>` : ""}
          ${canCreateWorkOrders() ? `<button class="quick-action" data-action="open-modal" data-modal="workorder">Créer un bon de travail<span>Planifier une intervention et assigner un technicien.</span></button>` : ""}
        ${canManageReminders() ? `<button class="quick-action" data-action="view" data-view="alertes">Centre d'alertes<span>Consulter les rappels actifs, à venir ou inactifs.</span></button>` : ""}
          <div class="panel">
            <div class="panel-header"><h2>Demandes actives</h2></div>
            <div class="panel-body cards-list">${urgentTickets || `<div class="empty">Aucune demande active.</div>`}</div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Prochains bons</h2></div>
            <div class="panel-body cards-list">${recentOrders || `<div class="empty">Aucun bon de travail.</div>`}</div>
          </div>
        </div>
      </section>
    `);
  }



      return {
        dashboard,
        dashboardLayoutForCurrentUser,
        saveDashboardLayout
      };
    }
  };
})();
