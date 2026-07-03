(function () {
  function clientReportTypes() {
    return [
      ["parc_mensuel", "Rapport mensuel de parc HVAC"],
      ["maintenance_preventive", "Rapport de maintenance préventive"],
      ["appels_service", "Rapport des demandes clients"],
      ["hors_service", "Rapport des équipements hors service"],
      ["budget_annuel", "Rapport annuel pour budget"]
    ];
  }

  function internalReportTypes() {
    return [
      ["dashboard_operationnel", "Dashboard opérationnel interne"],
      ["productivite_techniciens", "Productivité des techniciens"],
      ["retard_backlog", "Retard / backlog"],
      ["qualite_service", "Qualité de service"],
      ["planification_preventive", "Planification préventive"],
      ["inventaire_parc", "Inventaire / parc machines"],
      ["commercial_rentabilite", "Commercial / rentabilité future"]
    ];
  }

  function technicianReportTypes() {
    return [
      ["tech_journalier", "Rapport journalier du technicien"],
      ["tech_checklist", "Rapport de checklist d'intervention"],
      ["tech_historique_machine", "Rapport d'historique machine"],
      ["tech_problemes_recurrents", "Rapport de problèmes récurrents"],
      ["tech_fin_journee", "Rapport de fin de journée"]
    ];
  }

  function allReportTypes() {
    return [...clientReportTypes(), ...internalReportTypes(), ...technicianReportTypes()].map(([id]) => id);
  }


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

  window.ClimaParcReports = {
    allReportTypes,
    create(context) {
      const state = stateProxy(context.getState);
      const {
        seed,
        appShell,
        renderTopbar,
        currentUser,
        scopedBuildings,
        scopedApartments,
        scopedEquipment,
        scopedTickets,
        scopedWorkOrders,
        scopedReminders,
        inPeriod,
        reminderIsDue,
        today,
        monthStart,
        addDateInterval,
        monthLabel,
        monthKey,
        equipmentContext,
        workOrderContext,
        workOrderProgress,
        formTemplateForOrder,
        formatDate,
        daysBetween,
        averageDays,
        statusText,
        escapeHtml,
        dataFieldOptionsForSelect,
        normalizeActivityFields,
        normalizeDataOptions
      } = context;

  function reportsView() {
    const context = reportContext();
    const meta = reportAudienceMeta();
    const exportActions = ["client", "technicien"].includes(currentUser()?.role)
      ? ""
      : `
        <button class="ghost-button" data-action="export" data-report="equipment">CSV inventaire</button>
        <button class="ghost-button" data-action="export" data-report="interventions">CSV interventions</button>
        <button class="ghost-button" data-action="export" data-report="operations">CSV opérations</button>
      `;
    return appShell(`
      ${renderTopbar(meta.title, meta.subtitle, exportActions)}
      ${reportControls()}
      ${selectedExecutiveReport(context)}
    `);
  }

  function reportControls() {
    const filters = state.reportFilters;
    const reports = availableReportTypes();
    const selectedType = effectiveReportType();
    const clientOptions = ["client", "technicien"].includes(currentUser().role)
      ? ""
      : `<div class="field"><label>Client / contrat</label><select data-action="report-filter" data-filter="clientId"><option value="all">Tous les clients</option>${state.clients.map((client) => `<option value="${client.id}" ${filters.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("")}</select></div>`;
    return `
      <section class="panel report-controls">
        <div class="panel-body filters">
          <div class="field">
            <label>Type de rapport</label>
            <select data-action="report-filter" data-filter="reportType">
              ${reports.map(([id, label]) => `<option value="${id}" ${selectedType === id ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
            </select>
          </div>
          ${clientOptions}
          <div class="field"><label>Début</label><input type="date" data-action="report-filter" data-filter="startDate" value="${escapeHtml(filters.startDate)}"></div>
          <div class="field"><label>Fin</label><input type="date" data-action="report-filter" data-filter="endDate" value="${escapeHtml(filters.endDate)}"></div>
          <div class="field"><label>Statut machine</label><select data-action="report-filter" data-filter="equipmentStatus"><option value="all">Tous</option>${equipmentStatusOptions().map((option) => `<option value="${escapeHtml(option.value)}" ${filters.equipmentStatus === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
          <div class="field"><label>Statut activité</label><select data-action="report-filter" data-filter="activityStatus"><option value="all">Tous</option>${activityStatusOptions().map((option) => `<option value="${escapeHtml(option.value)}" ${filters.activityStatus === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
        </div>
      </section>
    `;
  }

  function equipmentStatusOptions() {
    return dataFieldOptionsForSelect(normalizeActivityFields({}).status);
  }

  function activityStatusOptions() {
    return dataFieldOptionsById("activity_status");
  }

  function recommendationTypeOptions() {
    return dataFieldOptionsById("recommendation_type");
  }

  function dataFieldOptionsById(id) {
    const field = state.dataFields.find((item) => item.id === id);
    const fallback = seed.dataFields.find((item) => item.id === id);
    const options = (field?.options?.length ? field.options : normalizeDataOptions(fallback?.options || []));
    return options.filter((option) => option.active !== false).map((option) => ({
      value: option.value,
      label: option.label
    }));
  }

  function dataFieldLabelByValue(id, value) {
    if (!value) return "";
    const field = state.dataFields.find((item) => item.id === id);
    const option = field?.options?.find((item) => item.value === value);
    return option?.label || value;
  }

  function reportContext() {
    const filters = state.reportFilters;
    const clientId = currentUser().role === "client" ? currentUser().clientId : filters.clientId;
    const buildings = scopedBuildings().filter((building) => clientId === "all" || building.clientId === clientId);
    const buildingIds = buildings.map((building) => building.id);
    const apartments = scopedApartments().filter((apartment) => buildingIds.includes(apartment.buildingId));
    const apartmentIds = apartments.map((apartment) => apartment.id);
    const equipment = scopedEquipment()
      .filter((item) => apartmentIds.includes(item.apartmentId))
      .filter((item) => filters.equipmentStatus === "all" || item.status === filters.equipmentStatus);
    const equipmentIds = equipment.map((item) => item.id);
    const tickets = scopedTickets().filter((ticket) => equipmentIds.includes(ticket.equipmentId) || buildingIds.includes(ticket.buildingId));
    const workOrders = scopedWorkOrders().filter((order) => equipmentIds.includes(order.equipmentId) || buildingIds.includes(order.buildingId));
    const interventions = state.interventions
      .filter((item) => equipmentIds.includes(item.equipmentId))
      .filter((item) => inPeriod(item.date, filters.startDate, filters.endDate))
      .filter((item) => filters.activityStatus === "all" || (item.activityStatus || item.status) === filters.activityStatus)
      .filter((item) => filters.equipmentStatus === "all" || (item.machineStatus || state.equipment.find((eq) => eq.id === item.equipmentId)?.status) === filters.equipmentStatus);
    const reminders = scopedReminders().filter((reminder) => equipmentIds.includes(reminder.equipmentId));
    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
      buildings,
      apartments,
      equipment,
      tickets,
      workOrders,
      interventions,
      reminders
    };
  }

  function availableReportTypes() {
    if (currentUser()?.role === "client") return clientReportTypes();
    if (currentUser()?.role === "technicien") return technicianReportTypes();
    return internalReportTypes();
  }

  function effectiveReportType() {
    const allowed = availableReportTypes().map(([id]) => id);
    return allowed.includes(state.reportFilters.reportType) ? state.reportFilters.reportType : allowed[0];
  }

  function reportAudienceMeta() {
    if (currentUser()?.role === "client") {
      return {
        title: "Rapports client",
        subtitle: "Vue exécutive du parc HVAC, de la maintenance et des appels de service."
      };
    }
    if (currentUser()?.role === "technicien") {
      return {
        title: "Rapports technicien",
        subtitle: "Rappels pratiques pour la journée, les checklists, les machines et la fin de quart."
      };
    }
    return {
      title: "Rapports internes",
      subtitle: "Pilotage opérationnel, productivité, qualité, backlog et planification."
    };
  }

  function selectedExecutiveReport(context) {
    return {
      dashboard_operationnel: internalOperationsDashboard,
      productivite_techniciens: technicianProductivityReport,
      retard_backlog: backlogReport,
      qualite_service: serviceQualityReport,
      planification_preventive: preventivePlanningReport,
      inventaire_parc: inventoryParkReport,
      commercial_rentabilite: commercialFutureReport,
      tech_journalier: technicianDailyReport,
      tech_checklist: technicianChecklistReport,
      tech_historique_machine: technicianMachineHistoryReport,
      tech_problemes_recurrents: technicianRecurringProblemsReport,
      tech_fin_journee: technicianEndOfDayReport,
      parc_mensuel: monthlyParkReport,
      maintenance_preventive: preventiveMaintenanceReport,
      appels_service: serviceCallsReport,
      hors_service: outOfServiceReport,
      budget_annuel: annualBudgetReport
    }[effectiveReportType()]?.(context) || internalOperationsDashboard(context);
  }

  function internalOperationsDashboard(context) {
    const urgentTickets = context.tickets.filter((ticket) => ticket.priority === "urgente" && ticket.status !== "ferme");
    const overdueOrders = context.workOrders.filter((order) => order.status !== "termine" && order.scheduledDate < today());
    const ongoingOrders = context.workOrders.filter((order) => order.status === "en_cours");
    const technicians = state.users.filter((user) => user.role === "technicien");
    const monthInterventions = context.interventions.filter((item) => inPeriod(item.date, monthStart(today()), today()));
    const criticalEquipment = context.equipment.filter((item) => ["hors_service", "a_planifier", "surveillance"].includes(item.status));
    const dueReminders = context.reminders.filter((reminder) => reminderIsDue(reminder));
    const workload = technicians.map((tech) => [tech.name, context.workOrders.filter((order) => order.technicianId === tech.id && order.status !== "termine").length]);
    const callsEvolution = monthsBetween(context.startDate, context.endDate).map((month) => [monthLabel(month), context.tickets.filter((ticket) => monthKey(ticket.createdAt) === month).length]);
    const nextWeek = addDateInterval(today(), 7, "days");
    const upcoming = context.equipment.filter((item) => item.nextService && item.nextService >= today() && item.nextService <= nextWeek).sort((a, b) => a.nextService.localeCompare(b.nextService));
    return reportShell("Dashboard opérationnel interne", "Vue quotidienne pour prioriser l'équipe administrative.", `
      ${reportKpis([
        ["Appels ouverts", context.tickets.filter((ticket) => ticket.status === "ouvert").length],
        ["Urgents", urgentTickets.length],
        ["BT en cours", ongoingOrders.length],
        ["BT atrasados", overdueOrders.length],
        ["Techniciens", technicians.length],
        ["Rappels échus", dueReminders.length]
      ], urgentTickets.length || overdueOrders.length || dueReminders.length ? "danger" : "")}
      <section class="report-layout">
        ${barChart("Charge de travail par technicien", workload)}
        ${barChart("Évolution des appels", callsEvolution)}
      </section>
      <section class="report-layout">
        ${tablePanel("Prochains services de la semaine", ["Date", "Immeuble", "Appartement", "Équipement"], upcoming.slice(0, 10).map((item) => {
          const { apartment, building } = equipmentContext(item.id);
          return [formatDate(item.nextService), building?.name || "-", apartment?.number || "-", item.type];
        }))}
        ${summaryPanel("Signaux du jour", [
          `${monthInterventions.length} interventions conclues ce mois-ci.`,
          `${criticalEquipment.length} équipements critiques ou à surveiller.`,
          `${dueReminders.length} rappels vencidos ou à traiter.`
        ])}
      </section>
    `);
  }

  function technicianProductivityReport(context) {
    const technicians = state.users.filter((user) => user.role === "technicien");
    const rows = technicians.map((tech) => {
      const assigned = context.workOrders.filter((order) => order.technicianId === tech.id);
      const completed = assigned.filter((order) => order.status === "termine");
      const interventions = context.interventions.filter((item) => item.technicianId === tech.id && inPeriod(item.date, context.startDate, context.endDate));
      const apartmentsVisited = new Set(interventions.map((item) => item.apartmentId || equipmentContext(item.equipmentId).apartment?.id).filter(Boolean)).size;
      const attachments = interventions.reduce((sum, item) => sum + (item.attachments?.length || 0), 0);
      return { tech, assigned, completed, interventions, apartmentsVisited, attachments };
    });
    const completeChecklists = context.interventions.filter((item) => item.checklistDone?.length && item.checklistDone.every(Boolean)).length;
    const checklistRate = context.interventions.length ? Math.round((completeChecklists / context.interventions.length) * 100) : 0;
    return reportShell("Rapport de productivité des techniciens", "Indicateurs de gestion à lire avec le contexte de complexité terrain.", `
      ${reportKpis([
        ["BT attribués", rows.reduce((sum, row) => sum + row.assigned.length, 0)],
        ["BT conclus", rows.reduce((sum, row) => sum + row.completed.length, 0)],
        ["Interventions", rows.reduce((sum, row) => sum + row.interventions.length, 0)],
        ["Appartements visités", rows.reduce((sum, row) => sum + row.apartmentsVisited, 0)],
        ["Photos/documents", rows.reduce((sum, row) => sum + row.attachments, 0)],
        ["Checklists 100%", `${checklistRate}%`]
      ])}
      <section class="report-layout">
        ${barChart("BT conclus par technicien", rows.map((row) => [row.tech.name, row.completed.length]))}
        ${progressPanel("Checklists complètes", checklistRate, "Ce KPI mesure la complétude documentaire, pas la difficulté réelle de l'intervention.")}
      </section>
      ${tablePanel("Synthèse par technicien", ["Technicien", "BT attribués", "BT conclus", "Interventions", "Docs", "Appartements"], rows.map((row) => [row.tech.name, row.assigned.length, row.completed.length, row.interventions.length, row.attachments, row.apartmentsVisited]))}
    `);
  }

  function backlogReport(context) {
    const openTickets = context.tickets.filter((ticket) => ticket.status !== "ferme");
    const plannedNotDone = context.workOrders.filter((order) => order.status !== "termine" && order.scheduledDate <= today());
    const dueReminders = context.reminders.filter((reminder) => reminderIsDue(reminder));
    const noNextService = context.equipment.filter((item) => !item.nextService);
    const noRecentHistory = context.equipment.filter((item) => !item.lastService || daysBetween(item.lastService, today()) > 365);
    const buckets = [
      ["0-7 jours", openTickets.filter((ticket) => daysBetween(ticket.createdAt, today()) <= 7).length],
      ["8-15 jours", openTickets.filter((ticket) => daysBetween(ticket.createdAt, today()) >= 8 && daysBetween(ticket.createdAt, today()) <= 15).length],
      ["16-30 jours", openTickets.filter((ticket) => daysBetween(ticket.createdAt, today()) >= 16 && daysBetween(ticket.createdAt, today()) <= 30).length],
      ["30+ jours", openTickets.filter((ticket) => daysBetween(ticket.createdAt, today()) > 30).length]
    ];
    return reportShell("Rapport de retard / backlog", "Détecter les pendências avant perte de contrôle opérationnel.", `
      ${reportKpis([
        ["Appels ouverts", openTickets.length],
        ["BT non exécutés", plannedNotDone.length],
        ["Rappels vencidos", dueReminders.length],
        ["Sans prochain service", noNextService.length],
        ["Sans historique récent", noRecentHistory.length]
      ], openTickets.length || plannedNotDone.length || dueReminders.length ? "danger" : "")}
      <section class="report-layout">
        ${barChart("Pendências par ancienneté", buckets)}
        ${tablePanel("Appels urgents atrasados", ["Appel", "Âge", "Immeuble", "Équipement"], openTickets.filter((ticket) => ticket.priority === "urgente").map((ticket) => {
          const { building, equipment } = equipmentContext(ticket.equipmentId);
          return [ticket.number || ticket.id, `${daysBetween(ticket.createdAt, today())} j`, building?.name || "-", equipment?.type || "-"];
        }))}
      </section>
    `);
  }

  function serviceQualityReport(context) {
    const interventionsInPeriod = context.interventions.filter((item) => inPeriod(item.date, context.startDate, context.endDate));
    const incomplete = interventionsInPeriod.filter((item) => item.checklistDone?.length && !item.checklistDone.every(Boolean));
    const withoutPhoto = interventionsInPeriod.filter((item) => !(item.attachments?.length));
    const withoutObservation = interventionsInPeriod.filter((item) => !(item.summary || "").trim());
    const recurringEquipment = Object.entries(countBy([...context.tickets, ...context.interventions], (item) => item.equipmentId))
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([equipmentId, count]) => {
        const { building, apartment, equipment } = equipmentContext(equipmentId);
        return [`${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, count];
      });
    const byReason = state.serviceTypes.map((type) => [type.name, context.tickets.filter((ticket) => ticket.serviceTypeId === type.id).length]).filter(([, value]) => value);
    return reportShell("Rapport de qualité de service", "Contrôler documentation, récurrence et qualité d'exécution.", `
      ${reportKpis([
        ["Checklists incomplètes", incomplete.length],
        ["Sans photo/doc", withoutPhoto.length],
        ["Sans observation", withoutObservation.length],
        ["Machines récurrentes", recurringEquipment.length],
        ["Appels réouverts", 0]
      ], incomplete.length || withoutPhoto.length || withoutObservation.length ? "danger" : "")}
      <section class="report-layout">
        ${barChart("Machines avec visites/problèmes récurrents", recurringEquipment)}
        ${donutChart("Motifs des appels", byReason.map(([label, value], index) => [label, value, ["info", "warn", "danger", "neutral"][index % 4]]))}
      </section>
      ${barChart("Interventions sans documentation complète", [["Checklist incomplète", incomplete.length], ["Sans photo/document", withoutPhoto.length], ["Sans observation", withoutObservation.length]])}
    `);
  }

  function preventivePlanningReport(context) {
    const preventiveTypes = new Set(state.interventionTypes.filter((type) => /nettoyage|prevent|prévent|entretien/i.test(type.name)).map((type) => type.id));
    const preventiveOrders = context.workOrders.filter((order) => preventiveTypes.has(order.typeId) || /entretien|nettoyage/i.test(order.notes || ""));
    const monthOrders = preventiveOrders.filter((order) => inPeriod(order.scheduledDate, monthStart(today()), today()));
    const late = preventiveOrders.filter((order) => order.status !== "termine" && order.scheduledDate < today());
    const future = preventiveOrders.filter((order) => order.scheduledDate >= today());
    const noReminder = context.equipment.filter((item) => !context.reminders.some((reminder) => reminder.equipmentId === item.id && reminder.status === "active"));
    const byWeek = [1, 2, 3, 4, 5].map((week) => [`Semaine ${week}`, future.filter((order) => Math.ceil(Number(order.scheduledDate.slice(8, 10)) / 7) === week).length]);
    const byBuilding = context.buildings.map((building) => [building.name, future.filter((order) => order.buildingId === building.id || equipmentContext(order.equipmentId).building?.id === building.id).length]).filter(([, value]) => value);
    return reportShell("Rapport de planification préventive", "Préparer les contrats récurrents et lisser la charge de travail.", `
      ${reportKpis([
        ["Préventives du mois", monthOrders.length],
        ["Préventives atrasadas", late.length],
        ["Futures", future.length],
        ["Équipements sans rappel", noReminder.length]
      ], late.length || noReminder.length ? "danger" : "")}
      <section class="report-layout">
        ${barChart("Préventives par semaine", byWeek)}
        ${barChart("Volume futur par immeuble", byBuilding)}
      </section>
      ${donutChart("Statut des préventives", [["Planifié", preventiveOrders.filter((order) => order.status === "planifie").length, "info"], ["En cours", preventiveOrders.filter((order) => order.status === "en_cours").length, "warn"], ["Conclu", preventiveOrders.filter((order) => order.status === "termine").length, "ok"]])}
    `);
  }

  function inventoryParkReport(context) {
    const missingSerial = context.equipment.filter((item) => !item.serial);
    const missingInstall = context.equipment.filter((item) => !item.installDate);
    const missingLocation = context.equipment.filter((item) => !item.location);
    const byBrand = Object.entries(countBy(context.equipment, (item) => item.brand || "Sans marque")).sort((a, b) => b[1] - a[1]);
    const byType = Object.entries(countBy(context.equipment, (item) => item.type || "Sans type")).sort((a, b) => b[1] - a[1]);
    const byStatus = Object.entries(countBy(context.equipment, (item) => statusText(item.status))).map(([label, value], index) => [label, value, ["ok", "warn", "info", "danger", "neutral"][index % 5]]);
    return reportShell("Rapport inventaire / parc machines", "Qualité de données et répartition technique du parc.", `
      ${reportKpis([
        ["Équipements", context.equipment.length],
        ["Sans série", missingSerial.length],
        ["Sans installation", missingInstall.length],
        ["Sans localisation", missingLocation.length]
      ], missingSerial.length || missingInstall.length || missingLocation.length ? "danger" : "")}
      <section class="report-layout">
        ${barChart("Machines par marque", byBrand.slice(0, 10))}
        ${barChart("Machines par type", byType.slice(0, 10))}
      </section>
      <section class="report-layout">
        ${donutChart("Statut des équipements", byStatus)}
        ${tablePanel("Qualité des données", ["Champ manquant", "Quantité"], [["Numéro de série", missingSerial.length], ["Date d'installation", missingInstall.length], ["Localisation", missingLocation.length]])}
      </section>
    `);
  }

  function commercialFutureReport(context) {
    const byClient = state.clients.map((client) => {
      const buildings = context.buildings.filter((building) => building.clientId === client.id);
      const buildingIds = buildings.map((building) => building.id);
      const apartments = context.apartments.filter((apartment) => buildingIds.includes(apartment.buildingId));
      const apartmentIds = apartments.map((apartment) => apartment.id);
      const equipmentIds = context.equipment.filter((item) => apartmentIds.includes(item.apartmentId)).map((item) => item.id);
      return {
        client,
        visits: context.interventions.filter((item) => equipmentIds.includes(item.equipmentId)).length,
        tickets: context.tickets.filter((ticket) => equipmentIds.includes(ticket.equipmentId)).length,
        equipment: equipmentIds.length
      };
    }).filter((row) => row.equipment || row.tickets || row.visits);
    return reportShell("Rapport commercial / rentabilité future", "Base de pilotage commercial prête pour l'ajout futur des valeurs.", `
      ${reportKpis([
        ["Clients suivis", byClient.length],
        ["Visites", byClient.reduce((sum, row) => sum + row.visits, 0)],
        ["Appels", byClient.reduce((sum, row) => sum + row.tickets, 0)],
        ["Revenus", "À venir"]
      ])}
      <section class="report-layout">
        ${barChart("Visites par client", byClient.map((row) => [row.client.name, row.visits]))}
        ${barChart("Clients avec plus d'appels", byClient.map((row) => [row.client.name, row.tickets]))}
      </section>
      ${summaryPanel("Évolution prévue", [
        "Quand les valeurs seront ajoutées, ce rapport pourra afficher revenu par contrat, coût par client et rentabilité par intervention.",
        "Aujourd'hui, il sert déjà à repérer les clients avec volume élevé de visites ou d'appels.",
        "Les équipements avec interventions répétées peuvent alimenter des recommandations de remplacement."
      ])}
    `);
  }

  function technicianOrders(context) {
    const user = currentUser();
    return context.workOrders.filter((order) => !user || user.role !== "technicien" || order.technicianId === user.id);
  }

  function technicianEquipment(context) {
    const orderEquipmentIds = technicianOrders(context).map((order) => order.equipmentId).filter(Boolean);
    const interventionEquipmentIds = context.interventions
      .filter((item) => item.technicianId === currentUser()?.id)
      .map((item) => item.equipmentId);
    const ids = new Set([...orderEquipmentIds, ...interventionEquipmentIds]);
    return context.equipment.filter((item) => ids.has(item.id));
  }

  function technicianDailyReport(context) {
    const orders = technicianOrders(context)
      .filter((order) => order.scheduledDate === today())
      .sort((a, b) => {
        const aContext = workOrderContext(a);
        const bContext = workOrderContext(b);
        return `${aContext.building?.address || ""} ${aContext.apartment?.number || ""}`.localeCompare(`${bContext.building?.address || ""} ${bContext.apartment?.number || ""}`, "fr", { numeric: true });
      });
    return reportShell("Rapport journalier du technicien", "Roteiro pratique du jour, optimisé pour consultation mobile.", `
      ${reportKpis([
        ["BT du jour", orders.length],
        ["À faire", orders.filter((order) => order.status === "planifie").length],
        ["En cours", orders.filter((order) => order.status === "en_cours").length],
        ["Terminés", orders.filter((order) => order.status === "termine").length]
      ])}
      ${tablePanel("Roteiro du jour", ["Statut", "Adresse", "Apt", "Intervention", "Priorité", "Contact", "Checklist"], orders.map((order) => {
        const { equipment, apartment, building } = workOrderContext(order);
        const type = state.interventionTypes.find((item) => item.id === order.typeId);
        const ticket = state.tickets.find((item) => item.id === order.ticketId);
        return [
          statusText(order.status),
          building?.address || building?.name || "-",
          apartment?.number || (order.buildingId ? "Bloc" : "-"),
          `${type?.name || "-"} | ${equipment?.type || "Immeuble"}`,
          statusText(ticket?.priority || "normale"),
          building?.onsiteContactName ? `${building.onsiteContactName} ${building.onsiteContactPhone || ""}` : "-",
          `${type?.checklist?.length || 0} étapes`
        ];
      }))}
      ${summaryPanel("Actions terrain", [
        "Ouvrir le BT pour exécuter le formulaire et joindre les photos.",
        "L'option d'itinéraire pourra être branchée plus tard à l'adresse du lieu.",
        "Les observations importantes se trouvent dans les notes du BT et le dossier machine."
      ])}
    `);
  }

  function technicianChecklistReport(context) {
    const interventions = context.interventions
      .filter((item) => item.technicianId === currentUser()?.id && inPeriod(item.date, context.startDate, context.endDate))
      .sort((a, b) => b.date.localeCompare(a.date));
    const completedSteps = interventions.reduce((sum, item) => sum + (item.checklistDone || []).filter(Boolean).length, 0);
    const totalSteps = interventions.reduce((sum, item) => sum + (item.checklistDone || []).length, 0);
    const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const missingPhotos = interventions.filter((item) => !(item.attachments?.length));
    const missingNotes = interventions.filter((item) => !(item.summary || "").trim());
    return reportShell("Rapport de checklist d'intervention", "Contrôle rapide des étapes, lectures, photos et observations.", `
      ${reportKpis([
        ["Interventions", interventions.length],
        ["Étapes faites", completedSteps],
        ["Étapes pendantes", Math.max(0, totalSteps - completedSteps)],
        ["Sans photo", missingPhotos.length],
        ["Sans observation", missingNotes.length]
      ], missingPhotos.length || missingNotes.length ? "danger" : "")}
      <section class="report-layout">
        ${progressPanel("Progression checklist", progress, `${completedSteps}/${totalSteps || 0} étapes réalisées dans la période.`)}
        ${barChart("Documentation manquante", [["Sans photo/document", missingPhotos.length], ["Sans observation", missingNotes.length]])}
      </section>
      ${tablePanel("Dernières interventions", ["Date", "Machine", "Étapes", "Photos", "Résumé"], interventions.slice(0, 10).map((item) => {
        const { equipment, apartment } = equipmentContext(item.equipmentId);
        const done = (item.checklistDone || []).filter(Boolean).length;
        const total = (item.checklistDone || []).length;
        return [formatDate(item.date), `Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, `${done}/${total}`, item.attachments?.length || 0, item.summary || "-"];
      }))}
    `);
  }

  function technicianMachineHistoryReport(context) {
    const machines = technicianEquipment(context);
    const machineRows = machines.map((machine) => {
      const interventions = context.interventions.filter((item) => item.equipmentId === machine.id).sort((a, b) => b.date.localeCompare(a.date));
      const tickets = context.tickets.filter((ticket) => ticket.equipmentId === machine.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const { apartment, building } = equipmentContext(machine.id);
      return {
        machine,
        apartment,
        building,
        interventions,
        tickets,
        lastEventDate: [interventions[0]?.date, tickets[0]?.createdAt].filter(Boolean).sort().pop() || machine.lastService || ""
      };
    }).sort((a, b) => (b.lastEventDate || "").localeCompare(a.lastEventDate || ""));
    const recurring = machineRows.filter((row) => row.tickets.filter((ticket) => daysBetween(ticket.createdAt, today()) <= 365).length >= 2);
    return reportShell("Rapport d'historique machine", "Résumé terrain pour comprendre rapidement le contexte d'une machine.", `
      ${reportKpis([
        ["Machines liées", machineRows.length],
        ["Avec historique récent", machineRows.filter((row) => row.lastEventDate).length],
        ["Récurrentes", recurring.length],
        ["Hors service", machineRows.filter((row) => row.machine.status === "hors_service").length]
      ], recurring.length ? "danger" : "")}
      ${tablePanel("Historique rapide", ["Machine", "Statut", "Dernier service", "Prochain", "Interventions 12 mois", "Dernier appel"], machineRows.slice(0, 12).map((row) => [
        `${row.building?.name || "-"} | Apt ${row.apartment?.number || "-"} | ${row.machine.type}`,
        statusText(row.machine.status),
        formatDate(row.machine.lastService),
        formatDate(row.machine.nextService),
        row.interventions.filter((item) => daysBetween(item.date, today()) <= 365).length,
        row.tickets[0] ? `${row.tickets[0].number || row.tickets[0].id} - ${row.tickets[0].title}` : "-"
      ]))}
      ${timelinePanel("Derniers événements", machineRows.flatMap((row) => [
        ...row.interventions.slice(0, 2).map((item) => [item.date, `${row.machine.type} | Intervention | ${item.summary || "-"}`]),
        ...row.tickets.slice(0, 2).map((ticket) => [ticket.createdAt, `${row.machine.type} | Appel | ${ticket.title}`])
      ]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10))}
    `);
  }

  function technicianRecurringProblemsReport(context) {
    const since = addDateInterval(today(), -6, "months");
    const recentTickets = context.tickets.filter((ticket) => ticket.createdAt >= since);
    const byEquipment = Object.entries(countBy(recentTickets, (ticket) => ticket.equipmentId))
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
    const repeatedByType = [];
    byEquipment.forEach(([equipmentId]) => {
      state.serviceTypes.forEach((type) => {
        const count = recentTickets.filter((ticket) => ticket.equipmentId === equipmentId && ticket.serviceTypeId === type.id).length;
        if (count >= 2) {
          const { equipment, apartment, building } = equipmentContext(equipmentId);
          repeatedByType.push({ equipment, apartment, building, type, count });
        }
      });
    });
    return reportShell("Rapport de problèmes récurrents", "Alertes terrain pour éviter de traiter un problème récurrent comme isolé.", `
      ${reportKpis([
        ["Machines récurrentes", byEquipment.length],
        ["Problèmes répétés", repeatedByType.length],
        ["Période", "6 mois"]
      ], byEquipment.length ? "danger" : "")}
      ${tablePanel("Alertes récurrentes", ["Alerte", "Immeuble", "Apt", "Machine"], repeatedByType.map((row) => [
        `Attention: ${row.count} appels pour ${row.type.name}`,
        row.building?.name || "-",
        row.apartment?.number || "-",
        row.equipment?.type || "-"
      ]))}
      ${barChart("Machines avec le plus d'appels", byEquipment.slice(0, 8).map(([equipmentId, count]) => {
        const { equipment, apartment } = equipmentContext(equipmentId);
        return [`Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, count];
      }))}
    `);
  }

  function technicianEndOfDayReport(context) {
    const todayOrders = technicianOrders(context).filter((order) => order.scheduledDate === today());
    const completed = todayOrders.filter((order) => order.status === "termine");
    const notCompleted = todayOrders.filter((order) => order.status !== "termine");
    const todayInterventions = context.interventions.filter((item) => item.technicianId === currentUser()?.id && item.date === today());
    const missingPhotos = todayInterventions.filter((item) => !(item.attachments?.length));
    const missingNotes = todayInterventions.filter((item) => !(item.summary || "").trim());
    return reportShell("Rapport de fin de journée", "Synthèse pratique à valider avant de terminer le quart.", `
      ${reportKpis([
        ["BT conclus", completed.length],
        ["BT non conclus", notCompleted.length],
        ["Interventions", todayInterventions.length],
        ["Photos manquantes", missingPhotos.length],
        ["Notes pendantes", missingNotes.length]
      ], notCompleted.length || missingPhotos.length || missingNotes.length ? "danger" : "")}
      <section class="report-layout">
        ${tablePanel("BT non conclus", ["BT", "Adresse", "Apt", "Prochaine étape"], notCompleted.map((order) => {
          const { apartment, building, equipment } = workOrderContext(order);
          return [order.number, building?.address || building?.name || "-", apartment?.number || "-", order.notes || equipment?.notes || "-"];
        }))}
        ${tablePanel("Documentation à compléter", ["Machine", "Photo", "Observation"], todayInterventions.filter((item) => !(item.attachments?.length) || !(item.summary || "").trim()).map((item) => {
          const { equipment, apartment } = equipmentContext(item.equipmentId);
          return [`Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, item.attachments?.length ? "OK" : "Manquante", (item.summary || "").trim() ? "OK" : "Manquante"];
        }))}
      </section>
      ${summaryPanel("Prochaines étapes", [
        "Vérifier les BT non conclus et inscrire la raison dans les notes.",
        "Ajouter les photos manquantes avant fermeture du BT.",
        "Signaler les pièces nécessaires dans le résumé ou l'appel associé."
      ])}
    `);
  }

  function monthlyParkReport(context) {
    const equipment = context.equipment;
    const statusCounts = countBy(equipment, (item) => item.status || "actif");
    const openTickets = context.tickets.filter((ticket) => ticket.status !== "ferme");
    const closedTickets = context.tickets.filter((ticket) => ticket.status === "ferme" && inPeriod(ticket.closedAt || ticket.createdAt, context.startDate, context.endDate));
    const completedOrders = context.workOrders.filter((order) => order.status === "termine" && inPeriod(order.scheduledDate, context.startDate, context.endDate));
    const upcomingServices = equipment
      .filter((item) => item.nextService && item.nextService >= today())
      .sort((a, b) => a.nextService.localeCompare(b.nextService))
      .slice(0, 8);
    const byBuilding = context.buildings.map((building) => {
      const apartments = context.apartments.filter((apartment) => apartment.buildingId === building.id).map((apartment) => apartment.id);
      return [building.name, equipment.filter((item) => apartments.includes(item.apartmentId)).length];
    });
    return reportShell("Rapport mensuel de parc HVAC", "État général du parc et signaux à surveiller.", `
      ${reportKpis([
        ["Immeubles", context.buildings.length],
        ["Appartements", context.apartments.length],
        ["Équipements", equipment.length],
        ["Appels ouverts", openTickets.length],
        ["BT conclus", completedOrders.length],
        ["Alertes", context.reminders.filter((reminder) => reminderIsDue(reminder)).length]
      ])}
      <section class="report-layout">
        ${donutChart("Équipements par statut", [
          ["Actif", statusCounts.actif || 0, "ok"],
          ["Surveillance", statusCounts.surveillance || 0, "warn"],
          ["À planifier", statusCounts.a_planifier || 0, "info"],
          ["Hors service", statusCounts.hors_service || 0, "danger"]
        ])}
        ${barChart("Équipements par immeuble", byBuilding)}
      </section>
      <section class="report-layout">
        ${timelinePanel("Prochains services préventifs", upcomingServices.map((item) => {
          const { apartment, building } = equipmentContext(item.id);
          return [item.nextService, `${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${item.type}`];
        }))}
        ${summaryPanel("Synthèse client", [
          `${equipment.filter((item) => item.status === "actif").length} équipements actifs.`,
          `${equipment.filter((item) => item.status === "hors_service").length} équipements hors service.`,
          `${equipment.filter((item) => item.status === "a_planifier").length} équipements à planifier.`,
          `${closedTickets.length} appels fermés dans la période.`
        ])}
      </section>
    `);
  }

  function preventiveMaintenanceReport(context) {
    const preventiveTypes = new Set(state.interventionTypes.filter((type) => /nettoyage|prevent|prévent|entretien/i.test(type.name)).map((type) => type.id));
    const preventiveInterventions = context.interventions.filter((item) => inPeriod(item.date, context.startDate, context.endDate) && (preventiveTypes.has(item.typeId) || /nettoyage|prevent|prévent|entretien/i.test(item.summary || "")));
    const attendedEquipment = new Set(preventiveInterventions.map((item) => item.equipmentId));
    const pendingEquipment = context.equipment.filter((item) => item.status !== "hors_service" && !attendedEquipment.has(item.id));
    const completionRate = context.equipment.length ? Math.round((attendedEquipment.size / context.equipment.length) * 100) : 0;
    const byMonth = monthsBetween(context.startDate, context.endDate).map((month) => [monthLabel(month), preventiveInterventions.filter((item) => monthKey(item.date) === month).length]);
    return reportShell("Rapport de maintenance préventive", "Preuve d'exécution du plan préventif et unités à suivre.", `
      ${reportKpis([
        ["Préventives réalisées", preventiveInterventions.length],
        ["Équipements couverts", attendedEquipment.size],
        ["Taux à jour", `${completionRate}%`],
        ["Unités pendantes", pendingEquipment.length],
        ["Prochains rappels", context.reminders.filter((reminder) => reminder.status === "active").length]
      ])}
      <section class="report-layout">
        ${barChart("Préventives réalisées par mois", byMonth)}
        ${progressPanel("Taux de completion du plan", completionRate, `${completionRate}% des équipements avec maintenance préventive en période.`)}
      </section>
      <section class="report-layout">
        ${tablePanel("Services réalisés", ["Date", "Appartement", "Équipement", "Technicien"], preventiveInterventions.slice(0, 8).map((item) => {
          const { apartment, equipment } = equipmentContext(item.equipmentId);
          const tech = state.users.find((user) => user.id === item.technicianId);
          return [formatDate(item.date), apartment?.number || "-", equipment?.type || "-", tech?.name || "-"];
        }))}
        ${tablePanel("Unités pendantes", ["Appartement", "Équipement", "Prochain service"], pendingEquipment.slice(0, 8).map((item) => {
          const { apartment } = equipmentContext(item.id);
          return [apartment?.number || "-", item.type, formatDate(item.nextService)];
        }))}
      </section>
    `);
  }

  function serviceCallsReport(context) {
    const periodTickets = context.tickets.filter((ticket) => inPeriod(ticket.createdAt, context.startDate, context.endDate));
    const closedInPeriod = context.tickets.filter((ticket) => ticket.status === "ferme" && inPeriod(ticket.closedAt || ticket.createdAt, context.startDate, context.endDate));
    const averageResolutionDays = averageDays(closedInPeriod.map((ticket) => daysBetween(ticket.createdAt, ticket.closedAt || ticket.createdAt)));
    const byType = state.serviceTypes.map((type) => [type.name, periodTickets.filter((ticket) => ticket.serviceTypeId === type.id).length]).filter(([, value]) => value);
    const byPriority = ["urgente", "normale", "basse"].map((priority) => [statusText(priority), periodTickets.filter((ticket) => ticket.priority === priority).length]);
    const byBuilding = context.buildings.map((building) => [building.name, periodTickets.filter((ticket) => ticket.buildingId === building.id).length]).filter(([, value]) => value);
    const equipmentRanking = Object.entries(countBy(periodTickets, (ticket) => ticket.equipmentId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([equipmentId, count]) => {
        const { equipment, apartment, building } = equipmentContext(equipmentId);
        return [`${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, count];
      });
    return reportShell("Rapport des demandes clients", "Demandes ouvertes, priorités et récurrences opérationnelles.", `
      ${reportKpis([
        ["Ouverts", context.tickets.filter((ticket) => ticket.status === "ouvert").length],
        ["En cours", context.tickets.filter((ticket) => ticket.status === "en_cours").length],
        ["Fermés", closedInPeriod.length],
        ["Urgents", periodTickets.filter((ticket) => ticket.priority === "urgente").length],
        ["Délai moyen", closedInPeriod.length ? `${averageResolutionDays} j` : "N/D"],
        ["Total période", periodTickets.length]
      ])}
      <section class="report-layout">
        ${barChart("Appels par type", byType)}
        ${donutChart("Appels par priorité", [["Urgente", byPriority[0][1], "danger"], ["Normale", byPriority[1][1], "info"], ["Basse", byPriority[2][1], "neutral"]])}
      </section>
      <section class="report-layout">
        ${barChart("Appels par immeuble", byBuilding)}
        ${barChart("Équipements les plus sollicités", equipmentRanking)}
      </section>
    `);
  }

  function outOfServiceReport(context) {
    const out = context.equipment.filter((item) => item.status === "hors_service");
    const byBuilding = context.buildings.map((building) => {
      const apartments = context.apartments.filter((apartment) => apartment.buildingId === building.id).map((apartment) => apartment.id);
      return [building.name, out.filter((item) => apartments.includes(item.apartmentId)).length];
    }).filter(([, value]) => value);
    return reportShell("Rapport des équipements hors service", "Risques opérationnels, urgence et suivi de résolution.", `
      ${reportKpis([
        ["Hors service", out.length],
        ["Immeubles touchés", byBuilding.length],
        ["Demandes actives", context.tickets.filter((ticket) => ticket.status !== "ferme").length],
        ["BT planifiés", context.workOrders.filter((order) => order.status === "planifie").length]
      ], "danger")}
      <section class="report-layout">
        ${barChart("Hors service par immeuble", byBuilding)}
        ${summaryPanel("Lecture exécutive", [
          out.length ? "Des actions correctives doivent être suivies jusqu'à résolution." : "Aucun équipement hors service dans le périmètre.",
          "Les machines listées ci-dessous représentent le risque prioritaire.",
          "Les notes de machine servent de première base pour la cause ou l'action recommandée."
        ], "danger")}
      </section>
      ${tablePanel("Table critique", ["Immeuble", "Appartement", "Équipement", "Motif / note", "Prochain service"], out.map((item) => {
        const { apartment, building } = equipmentContext(item.id);
        return [building?.name || "-", apartment?.number || "-", `${item.type} ${item.brand || ""}`, item.notes || "-", formatDate(item.nextService)];
      }))}
    `);
  }

  function annualBudgetReport(context) {
    const yearStart = `${(context.endDate || today()).slice(0, 4)}-01-01`;
    const yearEnd = `${(context.endDate || today()).slice(0, 4)}-12-31`;
    const yearlyInterventions = context.interventions.filter((item) => inPeriod(item.date, yearStart, yearEnd));
    const correctiveTickets = context.tickets.filter((ticket) => inPeriod(ticket.createdAt, yearStart, yearEnd) && ticket.serviceTypeId !== "entretien");
    const olderEquipment = context.equipment.filter((item) => item.installDate && Number((context.endDate || today()).slice(0, 4)) - Number(item.installDate.slice(0, 4)) >= 8);
    const interventionRanking = Object.entries(countBy(yearlyInterventions, (item) => item.equipmentId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([equipmentId, count]) => {
        const { equipment, apartment, building } = equipmentContext(equipmentId);
        return [`${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`, count];
      });
    const callsByMonth = monthsBetween(yearStart, yearEnd).map((month) => [monthLabel(month), correctiveTickets.filter((ticket) => monthKey(ticket.createdAt) === month).length]);
    return reportShell("Rapport annuel pour budget", "Indicateurs pour prévoir investissements, contrats et remplacements.", `
      ${reportKpis([
        ["Maintenances", yearlyInterventions.length],
        ["Correctifs", correctiveTickets.length],
        ["Machines anciennes", olderEquipment.length],
        ["Hors service", context.equipment.filter((item) => item.status === "hors_service").length],
        ["À planifier", context.equipment.filter((item) => item.status === "a_planifier").length]
      ])}
      <section class="report-layout">
        ${barChart("Top machines avec interventions", interventionRanking)}
        ${barChart("Évolution mensuelle des correctifs", callsByMonth)}
      </section>
      ${tablePanel("Recommandations de remplacement à surveiller", ["Immeuble", "Appartement", "Équipement", "Installation", "Signal"], olderEquipment.slice(0, 10).map((item) => {
        const { apartment, building } = equipmentContext(item.id);
        const calls = context.tickets.filter((ticket) => ticket.equipmentId === item.id).length;
        return [building?.name || "-", apartment?.number || "-", `${item.type} ${item.brand || ""}`, formatDate(item.installDate), `${calls} appel(s)`];
      }))}
    `);
  }

  function reportShell(title, subtitle, content) {
    const badge = currentUser()?.role === "client" ? "Rapport client" : currentUser()?.role === "technicien" ? "Rapport technicien" : "Rapport interne";
    return `
      <section class="executive-report">
        <div class="report-cover">
          <div>
            <span class="badge neutral">${badge}</span>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="report-period">
            <span>Période</span>
            <strong>${formatDate(state.reportFilters.startDate)} - ${formatDate(state.reportFilters.endDate)}</strong>
          </div>
        </div>
        ${content}
      </section>
    `;
  }

  function reportKpis(items, tone = "") {
    return `
      <section class="report-kpi-grid ${tone ? `report-kpi-${tone}` : ""}">
        ${items.map(([label, value]) => `
          <article class="report-kpi">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </article>
        `).join("")}
      </section>
    `;
  }

  function donutChart(title, entries) {
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let angle = 0;
    const colors = { ok: "#2f7d4f", warn: "#d99a35", info: "#315f96", danger: "#b23b3b", neutral: "#8a989c" };
    const segments = entries.map(([, value, tone]) => {
      const start = angle;
      const degrees = total ? (value / total) * 360 : 0;
      angle += degrees;
      return `${colors[tone] || colors.neutral} ${start}deg ${angle}deg`;
    }).join(", ");
    return `
      <article class="report-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="donut-wrap">
          <div class="donut-chart" style="background: conic-gradient(${segments || "#edf3f4 0deg 360deg"});"><span>${total}</span></div>
          <div class="chart-legend">
            ${entries.map(([label, value, tone]) => `<div><i class="legend-${tone}"></i><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function barChart(title, entries) {
    const cleanEntries = entries.filter(([, value]) => value !== undefined && value !== null);
    const max = Math.max(1, ...cleanEntries.map(([, value]) => Number(value) || 0));
    return `
      <article class="report-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="bar-list">
          ${cleanEntries.length ? cleanEntries.map(([label, value]) => `
            <div class="bar-row">
              <div class="bar-row-head"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
              <div class="bar-track"><i style="width:${Math.max(4, Math.round((Number(value) || 0) / max * 100))}%"></i></div>
            </div>
          `).join("") : `<div class="empty compact-empty">Aucune donnée pour la période.</div>`}
        </div>
      </article>
    `;
  }

  function timelinePanel(title, entries) {
    return `
      <article class="report-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="report-timeline">
          ${entries.length ? entries.map(([date, label]) => `
            <div>
              <time>${formatDate(date)}</time>
              <span>${escapeHtml(label)}</span>
            </div>
          `).join("") : `<div class="empty compact-empty">Aucun service planifié.</div>`}
        </div>
      </article>
    `;
  }

  function summaryPanel(title, lines, tone = "") {
    return `
      <article class="report-card ${tone ? `report-card-${tone}` : ""}">
        <h3>${escapeHtml(title)}</h3>
        <div class="executive-summary">
          ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </div>
      </article>
    `;
  }

  function progressPanel(title, percent, note) {
    return `
      <article class="report-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="progress-report">
          <strong>${percent}%</strong>
          <div class="progress-track"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>
          <p>${escapeHtml(note)}</p>
        </div>
      </article>
    `;
  }

  function tablePanel(title, headers, rows) {
    return `
      <article class="report-card report-card-table">
        <h3>${escapeHtml(title)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Aucune donnée pour la période.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function countBy(items, keyFn) {
    return items.reduce((acc, item) => {
      const key = keyFn(item) || "Non défini";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function monthsBetween(startDate, endDate) {
    const start = new Date(`${monthStart(startDate || today())}T12:00:00`);
    const end = new Date(`${monthStart(endDate || today())}T12:00:00`);
    const months = [];
    for (let cursor = start; cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      months.push(cursor.toISOString().slice(0, 7));
    }
    return months;
  }

      return {
        reportsView,
        activityStatusOptions,
        recommendationTypeOptions,
        dataFieldOptionsById,
        dataFieldLabelByValue
      };
    }
  };
})();
