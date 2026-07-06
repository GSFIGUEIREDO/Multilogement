(function () {
  const STORAGE_KEY = "climaparc_hvac_v2";
  const SERVER_ENABLED = typeof location !== "undefined" && (location.protocol === "http:" || location.protocol === "https:");
  const api = window.ClimaParcApi;
  const storage = window.ClimaParcStorage;
  const documentsModule = window.ClimaParcDocumentsView || {};
  const recommendationsModule = window.ClimaParcRecommendationsView || {};
  let saveTimer = null;
  let toastTimer = null;
  let refreshTimer = null;
  let restoringSession = false;
  let lastLocalChangeAt = 0;
  let lastNavigationAt = 0;
  let lastServerState = null;
  let applyingHistoryState = false;
  let browserHistoryReady = false;
  let lastReportServerContext = null;

  const SHARED_COLLECTION_KEYS = [
    "users",
    "clients",
    "buildings",
    "apartments",
    "equipment",
    "tickets",
    "workOrders",
    "interventions",
    "reminders",
    "clientDocuments",
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "passwordResetRequests"
  ];

  const seed = {
    sessionUserId: null,
    activeView: "tableau",
    selectedBuildingId: "b-verdun",
    selectedEquipmentId: "eq-101",
    selectedTicketId: null,
    selectedWorkOrderId: null,
    selectedExecutionApartmentId: null,
    modal: null,
    toast: "",
    resetToken: "",
    globalSearch: "",
    sidebarMode: "auto",
    mobileMenuOpen: false,
    navOrder: ["tableau", "lieux", "equipements", "alertes", "appels", "bons", "recommandations", "rapports", "utilisateurs", "parametres"],
    filters: {
      buildingId: "all",
      apartmentId: "all",
      status: "all",
      search: ""
    },
    workOrderFilters: {
      buildingId: "all",
      technicianId: "all",
      status: "all",
      startDate: "",
      endDate: "",
      search: ""
    },
    dashboardLayouts: {},
    dashboardEditMode: false,
    dashboardCalendarDate: "",
    reportFilters: {
      reportType: "dashboard_operationnel",
      clientId: "all",
      startDate: "",
      endDate: "",
      equipmentStatus: "all",
      activityStatus: "all"
    },
    passwordResetRequests: [],
    clientDocuments: [],
    users: [
      {
        id: "u-admin",
        name: "Claire Dubois",
        email: "admin@climaparc.ca",
        role: "administrateur",
        clientId: null
      },
      {
        id: "u-interne",
        name: "Marc Beaulieu",
        email: "operation@climaparc.ca",
        role: "equipe_interne",
        clientId: null
      },
      {
        id: "u-tech",
        name: "Nadia Tremblay",
        email: "tech@climaparc.ca",
        role: "technicien",
        clientId: null
      },
      {
        id: "u-client",
        name: "Sophie Martin",
        email: "client@gestionazur.ca",
        role: "client",
        clientId: "client-azur"
      }
    ],
    clients: [
      { id: "client-azur", name: "Gestion Azur", contact: "Sophie Martin", email: "client@gestionazur.ca" },
      { id: "client-nord", name: "Syndic Nord", contact: "Laurent Gagnon", email: "maintenance@syndicnord.ca" }
    ],
    buildings: [
      {
        id: "b-verdun",
        clientId: "client-azur",
        name: "Résidence Verdun",
        address: "1140 rue Wellington, Montréal",
        onsiteContactName: "André Roy",
        onsiteContactPhone: "514-555-0188",
        onsiteContactPoste: "",
        onsiteContactEmail: "concierge@verdun.ca",
        billingContactName: "Sophie Martin",
        billingContactPhone: "514-555-0112",
        billingContactPoste: "",
        billingContactEmail: "facturation@gestionazur.ca",
        notes: "Accès par l'entrée de service."
      },
      {
        id: "b-laval",
        clientId: "client-azur",
        name: "Tours Laval",
        address: "75 boulevard Cartier, Laval",
        onsiteContactName: "Mélanie Fortin",
        onsiteContactPhone: "450-555-0140",
        onsiteContactPoste: "",
        onsiteContactEmail: "surplace@tourslaval.ca",
        billingContactName: "Sophie Martin",
        billingContactPhone: "514-555-0112",
        billingContactPoste: "",
        billingContactEmail: "facturation@gestionazur.ca",
        notes: "Stationnement visiteur disponible."
      },
      {
        id: "b-nord",
        clientId: "client-nord",
        name: "Condo Rivière Nord",
        address: "425 rue Principale, Saint-Jérôme",
        onsiteContactName: "Daniel Leduc",
        onsiteContactPhone: "450-555-0199",
        onsiteContactPoste: "",
        onsiteContactEmail: "maintenance@rivieredunord.ca",
        billingContactName: "Laurent Gagnon",
        billingContactPhone: "450-555-0160",
        billingContactPoste: "",
        billingContactEmail: "comptes@syndicnord.ca",
        notes: "Appeler avant toute visite technique."
      }
    ],
    apartments: [
      { id: "apt-101", buildingId: "b-verdun", number: "101", occupant: "Mme Laurent" },
      { id: "apt-202", buildingId: "b-verdun", number: "202", occupant: "M. Pelletier" },
      { id: "apt-504", buildingId: "b-laval", number: "504", occupant: "Vacant" },
      { id: "apt-709", buildingId: "b-laval", number: "709", occupant: "Mme Bergeron" },
      { id: "apt-12", buildingId: "b-nord", number: "12", occupant: "M. Nguyen" }
    ],
    equipment: [
      {
        id: "eq-101",
        apartmentId: "apt-101",
        type: "Thermopompe murale",
        brand: "Mitsubishi",
        model: "MSZ-FS09",
        serial: "MT-101-9822",
        location: "Salon",
        installDate: "2022-05-12",
        lastService: "2026-05-18",
        nextService: "2026-11-18",
        status: "actif",
        notes: "Accès avec préavis de 24 h."
      },
      {
        id: "eq-202",
        apartmentId: "apt-202",
        type: "Fan coil",
        brand: "Carrier",
        model: "42C",
        serial: "CA-202-1180",
        location: "Chambre principale",
        installDate: "2019-09-03",
        lastService: "2026-03-08",
        nextService: "2026-09-08",
        status: "surveillance",
        notes: "Vibration légère à vitesse élevée."
      },
      {
        id: "eq-504",
        apartmentId: "apt-504",
        type: "Unité PTAC",
        brand: "Friedrich",
        model: "PZE12K",
        serial: "FR-504-4421",
        location: "Pièce principale",
        installDate: "2018-02-20",
        lastService: "2025-12-15",
        nextService: "2026-06-30",
        status: "a_planifier",
        notes: "Nettoyage annuel à compléter."
      },
      {
        id: "eq-709",
        apartmentId: "apt-709",
        type: "Thermopompe centrale",
        brand: "Daikin",
        model: "DZ14SA",
        serial: "DK-709-7711",
        location: "Salle mécanique",
        installDate: "2020-07-27",
        lastService: "2026-04-11",
        nextService: "2026-10-11",
        status: "actif",
        notes: "Filtre MERV 8."
      },
      {
        id: "eq-12",
        apartmentId: "apt-12",
        type: "Échangeur d'air",
        brand: "Venmar",
        model: "AVS N Series",
        serial: "VN-012-3388",
        location: "Placard technique",
        installDate: "2021-11-02",
        lastService: "2026-02-22",
        nextService: "2026-08-22",
        status: "hors_service",
        notes: "Moteur à remplacer."
      }
    ],
    serviceTypes: [
      { id: "plainte_bruit", name: "Plainte bruit / vibration", defaultPriority: "normale", linkedInterventionTypeId: "inspection" },
      { id: "panne", name: "Panne ou arrêt complet", defaultPriority: "urgente", linkedInterventionTypeId: "reparation" },
      { id: "entretien", name: "Demande d'entretien", defaultPriority: "normale", linkedInterventionTypeId: "nettoyage" }
    ],
    dataFields: [
      {
        id: "equipment_type",
        name: "Type",
        group: "Machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: ["Thermopompe murale", "Fan coil", "Unité PTAC", "Échangeur d'air"]
      },
      {
        id: "equipment_location",
        name: "Localisation",
        group: "Machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: ["Salon", "Chambre principale", "Pièce principale", "Salle mécanique", "Placard technique"]
      },
      {
        id: "equipment_brand",
        name: "Marque",
        group: "Machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: ["Carrier", "ADP", "Gree", "DirectAir", "Ecobee", "Sinopé", "Applied Comfort", "LG", "GE", "Payne", "Bosch", "Rheem", "Fujitsu", "Toshiba", "Mitsubishi", "Daikin", "Venmar"]
      },
      {
        id: "equipment_model",
        name: "Modèle",
        group: "Machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: ["MSZ-FS09", "42C", "PZE12K", "DZ14SA", "AVS N Series", "EAC15"]
      },
      {
        id: "equipment_status",
        name: "Statut",
        group: "Machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: [
          { id: "actif", label: "Actif", value: "actif" },
          { id: "ok", label: "OK", value: "ok" },
          { id: "surveillance", label: "Surveillance", value: "surveillance" },
          { id: "reparation_requise", label: "Réparation requise", value: "reparation_requise" },
          { id: "a_planifier", label: "À planifier", value: "a_planifier" },
          { id: "hors_service", label: "Hors service", value: "hors_service" }
        ]
      },
      {
        id: "activity_status",
        name: "Statut",
        group: "Activité",
        type: "single",
        appliesTo: ["activity"],
        options: [
          { id: "completee", label: "Complétée", value: "completee" },
          { id: "partielle", label: "Partielle", value: "partielle" },
          { id: "a_revoir", label: "À revoir", value: "a_revoir" },
          { id: "client_absent", label: "Client absent", value: "client_absent" },
          { id: "reparation_requise", label: "Réparation requise", value: "reparation_requise" }
        ]
      },
      {
        id: "recommendation_type",
        name: "Type de recommandation",
        group: "Recommandation",
        type: "single",
        appliesTo: ["activity"],
        options: [
          { id: "diagnostic", label: "Diagnostic à effectuer", value: "diagnostic" },
          { id: "atelier", label: "Apporter à l'atelier", value: "atelier" },
          { id: "remplacement", label: "Remplacement recommandé", value: "remplacement" },
          { id: "piece", label: "Remplacement de pièce", value: "piece" },
          { id: "reparation", label: "Réparation recommandée", value: "reparation" },
          { id: "autre", label: "Autre", value: "autre" }
        ]
      }
    ],
    reminders: [
      {
        id: "rem-101",
        equipmentId: "eq-101",
        title: "Entretien annuel",
        frequencyValue: 1,
        frequencyUnit: "years",
        startDate: "2026-05-18",
        nextDueDate: "2027-05-18",
        status: "active",
        notes: "Rappel d'entretien préventif annuel.",
        createdAt: "2026-06-25",
        lastSeenDueDate: ""
      },
      {
        id: "rem-504",
        equipmentId: "eq-504",
        title: "Nettoyage préventif",
        frequencyValue: 2,
        frequencyUnit: "years",
        startDate: "2024-06-30",
        nextDueDate: "2026-06-30",
        status: "active",
        notes: "Cycle de deux ans pour les unités PTAC.",
        createdAt: "2026-06-25",
        lastSeenDueDate: ""
      }
    ],
    formTemplates: [
      {
        id: "form-nettoyage-bloc",
        name: "Formulaire nettoyage bloc",
        activityFields: {
          type: { required: true, options: ["Thermopompe murale", "Fan coil", "Unité PTAC", "Échangeur d'air"] },
          location: { required: true, options: ["Salon", "Chambre principale", "Pièce principale", "Salle mécanique", "Placard technique"] },
          brand: { required: false, options: ["Mitsubishi", "Carrier", "Friedrich", "Daikin", "Venmar"] },
          model: { required: false, options: ["MSZ-FS09", "42C", "PZE12K", "DZ14SA", "AVS N Series"] },
          serial: { required: false, options: [] },
          status: { required: true, options: [] },
          notes: { required: false, options: [] }
        },
        fields: [
          { id: "etat_general", label: "Etat general de l'unite", type: "single", options: ["Bon", "A surveiller", "Reparation requise"] },
          { id: "acces", label: "Acces a l'appartement confirme", type: "checkbox", options: ["Oui"] },
          { id: "actions", label: "Actions effectuees", type: "multiple", options: ["Filtres nettoyes", "Drain nettoye", "Serpentin inspecte", "Test de fonctionnement"] },
          { id: "anomalie", label: "Description de l'anomalie", type: "long", showWhen: { fieldId: "etat_general", value: "Reparation requise" } },
          { id: "recommandation", label: "Recommandation au client", type: "long" }
        ]
      }
    ],
    interventionTypes: [
      {
        id: "nettoyage",
        name: "Nettoyage préventif",
        defaultDuration: 75,
        checklist: [
          "Couper l'alimentation et sécuriser la zone",
          "Nettoyer ou remplacer les filtres",
          "Nettoyer l'évaporateur et le drain",
          "Vérifier les serpentins et ailettes",
          "Mesurer la température de soufflage",
          "Remettre en marche et valider le fonctionnement"
        ]
      },
      {
        id: "reparation",
        name: "Réparation",
        defaultDuration: 120,
        checklist: [
          "Confirmer le symptôme avec le résident ou gestionnaire",
          "Diagnostiquer composantes électriques et mécaniques",
          "Identifier les pièces requises",
          "Effectuer la réparation approuvée",
          "Tester l'équipement en mode chaud et froid",
          "Documenter les mesures et recommandations"
        ]
      },
      {
        id: "inspection",
        name: "Inspection technique",
        defaultDuration: 45,
        checklist: [
          "Inspecter l'état général de l'unité",
          "Vérifier bruit, vibration et odeurs",
          "Contrôler pression, débit et température",
          "Photographier les anomalies",
          "Déterminer priorité de suivi"
        ]
      }
    ],
    interventions: [
      {
        id: "int-1",
        equipmentId: "eq-101",
        workOrderId: "wo-1",
        typeId: "nettoyage",
        date: "2026-05-18",
        technicianId: "u-tech",
        status: "terminee",
        summary: "Nettoyage complet, drain dégagé, fonctionnement normal.",
        readings: { soufflage: "10.8 C", retour: "23.4 C", pression: "OK" },
        checklistDone: [true, true, true, true, true, true]
      },
      {
        id: "int-2",
        equipmentId: "eq-202",
        workOrderId: "wo-2",
        typeId: "inspection",
        date: "2026-03-08",
        technicianId: "u-tech",
        status: "terminee",
        summary: "Vibration perceptible. Recommandation: vérifier support moteur au prochain passage.",
        readings: { soufflage: "12.2 C", retour: "22.9 C", pression: "À revoir" },
        checklistDone: [true, true, true, true, true]
      }
    ],
    tickets: [
      {
        id: "tk-1",
        number: "AS-2026-001",
        clientId: "client-azur",
        buildingId: "b-laval",
        apartmentId: "apt-504",
        equipmentId: "eq-504",
        title: "Entretien annuel à planifier",
        description: "Le gestionnaire souhaite regrouper l'entretien avec trois autres unités.",
        priority: "normale",
        status: "ouvert",
        createdAt: "2026-06-20",
        createdBy: "u-client"
      },
      {
        id: "tk-2",
        number: "AS-2026-002",
        clientId: "client-nord",
        buildingId: "b-nord",
        apartmentId: "apt-12",
        equipmentId: "eq-12",
        title: "Échangeur d'air hors service",
        description: "L'appareil ne démarre plus. Le panneau indique une erreur moteur.",
        priority: "urgente",
        status: "en_cours",
        createdAt: "2026-06-22",
        createdBy: "u-interne"
      }
    ],
    workOrders: [
      {
        id: "wo-1",
        number: "BT-2026-001",
        ticketId: null,
        equipmentId: "eq-101",
        typeId: "nettoyage",
        technicianId: "u-tech",
        scheduledDate: "2026-05-18",
        status: "termine",
        notes: "Contrat préventif semestriel."
      },
      {
        id: "wo-2",
        number: "BT-2026-002",
        ticketId: null,
        equipmentId: "eq-202",
        typeId: "inspection",
        technicianId: "u-tech",
        scheduledDate: "2026-03-08",
        status: "termine",
        notes: "Inspection après plainte de bruit."
      },
      {
        id: "wo-3",
        number: "BT-2026-003",
        ticketId: "tk-2",
        equipmentId: "eq-12",
        typeId: "reparation",
        technicianId: "u-tech",
        scheduledDate: "2026-06-25",
        status: "planifie",
        notes: "Prévoir moteur compatible Venmar."
      }
    ],
    roleDefinitions: [
      { id: "administrateur", name: "Administrateur", rights: ["all"] },
      { id: "equipe_interne", name: "Équipe interne", rights: ["lieux", "equipment", "alerts", "tickets", "workorders", "recommendations", "documents", "reports", "users", "settings"] },
      { id: "technicien", name: "Technicien", rights: ["lieux", "equipment", "alerts", "workorders", "interventions", "reports"] },
      { id: "client", name: "Client", rights: ["portal", "lieux", "alerts", "tickets", "recommendations", "documents", "reports"] }
    ]
  };

  function allReportTypes() {
    return window.ClimaParcReports.allReportTypes();
  }

  let state = loadState();
  const resetTokenFromUrl = new URLSearchParams(window.location.search).get("resetToken") || "";
  if (resetTokenFromUrl) {
    state.sessionUserId = null;
    state.resetToken = resetTokenFromUrl;
    state.modal = { type: "resetPassword" };
  }

  function loadState() {
    if (SERVER_ENABLED) {
      return normalizeState(JSON.parse(JSON.stringify(seed)));
    }
    try {
      const stored = storage.read(STORAGE_KEY);
      if (stored && stored.users && stored.equipment) {
        return normalizeState(stored);
      }
    } catch (error) {
      storage.remove(STORAGE_KEY);
    }
    return normalizeState(JSON.parse(JSON.stringify(seed)));
  }

  function normalizeState(data) {
    const next = { ...JSON.parse(JSON.stringify(seed)), ...data };
    next.filters = { ...seed.filters, ...(data.filters || {}) };
    next.workOrderFilters = { ...seed.workOrderFilters, ...(data.workOrderFilters || {}) };
    next.dashboardLayouts = data.dashboardLayouts || {};
    next.dashboardEditMode = false;
    next.dashboardCalendarDate = data.dashboardCalendarDate || today();
    next.reportFilters = {
      ...seed.reportFilters,
      ...(data.reportFilters || {}),
      startDate: data.reportFilters?.startDate || monthStart(today()),
      endDate: data.reportFilters?.endDate || today()
    };
    if (!allReportTypes().includes(next.reportFilters.reportType)) {
      next.reportFilters.reportType = seed.reportFilters.reportType;
    }
    next.sidebarMode = data.sidebarMode || seed.sidebarMode;
    next.mobileMenuOpen = false;
    next.navOrder = mergeNavOrder(data.navOrder);
    next.serviceTypes = data.serviceTypes || JSON.parse(JSON.stringify(seed.serviceTypes));
    next.dataFields = ensureCoreDataFields(normalizeDataFields(data.dataFields || seed.dataFields));
    next.formTemplates = (data.formTemplates || seed.formTemplates).map((template) => ({
      id: template.id,
      name: template.name,
      activityFields: normalizeActivityFields(template.activityFields),
      fields: (template.fields || []).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type || "text",
        options: field.options || [],
        required: Boolean(field.required),
        defaultValue: field.defaultValue ?? (field.type === "multiple" ? [] : ""),
        layout: field.layout || "full",
        unitScope: field.unitScope || "all",
        branchRules: field.branchRules || {},
        nextFieldId: field.nextFieldId || "",
        showWhen: field.showWhen || null
      }))
    }));
    next.roleDefinitions = data.roleDefinitions || JSON.parse(JSON.stringify(seed.roleDefinitions));
    next.roleDefinitions = next.roleDefinitions.map((role) => {
      if (role.id === "technicien" && !role.rights.includes("reports")) return { ...role, rights: [...role.rights, "reports"] };
      if (role.id === "equipe_interne") {
        const rights = new Set(role.rights);
        rights.add("recommendations");
        rights.add("documents");
        return { ...role, rights: Array.from(rights) };
      }
      if (role.id === "client") {
        const rights = new Set(role.rights);
        rights.add("reports");
        rights.add("recommendations");
        rights.add("documents");
        rights.add("users");
        return { ...role, rights: Array.from(rights) };
      }
      return role;
    });
    next.passwordResetRequests = data.passwordResetRequests || [];
    next.clientDocuments = (data.clientDocuments || []).map((doc) => ({
      id: doc.id || uid("doc"),
      clientId: doc.clientId || "",
      buildingId: doc.buildingId || "",
      apartmentId: doc.apartmentId || "",
      equipmentId: doc.equipmentId || "",
      type: doc.type || "Contrat",
      name: doc.name || "Document",
      notes: doc.notes || "",
      visibleToClient: doc.visibleToClient !== false,
      uploadedAt: doc.uploadedAt || today(),
      dataUrl: doc.dataUrl || "",
      fileName: doc.fileName || doc.name || "document",
      fileType: doc.fileType || "",
      fileSize: doc.fileSize || 0,
      storageBucket: doc.storageBucket || "",
      storagePath: doc.storagePath || "",
      uploadedBy: doc.uploadedBy || ""
    }));
    next.selectedBuildingId = data.selectedBuildingId || next.buildings[0]?.id || null;
    next.buildings = (data.buildings || seed.buildings).map((building) => ({
      onsiteContactName: "",
      onsiteContactPhone: "",
      onsiteContactPoste: "",
      onsiteContactEmail: "",
      billingContactName: "",
      billingContactPhone: "",
      billingContactPoste: "",
      billingContactEmail: "",
      notes: "",
      ...building
    }));
    next.tickets = (data.tickets || seed.tickets).map((ticket, index) => ({
      serviceTypeId: next.serviceTypes[0]?.id || "",
      closedAt: "",
      assignedTechnicianIds: [],
      assignedTeam: "",
      ...ticket,
      number: ticket.number || ticketNumberFromIndex(index + 1, ticket.createdAt)
    }));
    next.users = next.users.map((user) => ({
      clientAccessLevel: user.role === "client" ? "direction" : "",
      allowedBuildingIds: [],
      portalRights: [],
      parentUserId: "",
      ...user,
      portalRights: normalizePortalRights(user.portalRights || [])
    }));
    next.equipment = (data.equipment || seed.equipment).map((item) => ({
      attachments: [],
      unitKind: "interieure",
      ...item
    }));
    next.reminders = (Array.isArray(data.reminders) ? data.reminders : []).map((reminder) => ({
      id: reminder.id || uid("rem"),
      equipmentId: reminder.equipmentId || "",
      title: reminder.title || "Rappel",
      frequencyValue: Number(reminder.frequencyValue || 1),
      frequencyUnit: reminder.frequencyUnit || "years",
      startDate: reminder.startDate || today(),
      nextDueDate: reminder.nextDueDate || reminder.startDate || today(),
      status: reminder.status || "active",
      notes: reminder.notes || "",
      createdAt: reminder.createdAt || today(),
      lastSeenDueDate: reminder.lastSeenDueDate || "",
      lastWorkOrderId: reminder.lastWorkOrderId || "",
      lastOpenedAt: reminder.lastOpenedAt || ""
    }));
    next.workOrders = (data.workOrders || seed.workOrders).map((order) => ({
      scope: order.buildingId ? "building" : "equipment",
      buildingId: "",
      equipmentId: "",
      formTemplateId: next.formTemplates[0]?.id || "",
      assignedTeam: "",
      assignedTechnicianIds: order.technicianId ? [order.technicianId] : [],
      sourceReminderId: "",
      ...order
    }));
    next.interventions = (data.interventions || seed.interventions).map((intervention) => ({
      apartmentId: "",
      formTemplateId: "",
      formResponses: {},
      activityStatus: "completee",
      machineStatus: "",
      unitKind: "interieure",
      equipmentNotes: "",
      recommendation: null,
      ...intervention,
      recommendation: normalizeRecommendation(intervention.recommendation)
    }));
    migrateInterventionAttachments(next);
    return next;
  }

  function migrateInterventionAttachments(next) {
    next.interventions.forEach((intervention) => {
      if (!intervention.attachments?.length) return;
      const equipment = next.equipment.find((item) => item.id === intervention.equipmentId);
      if (!equipment) return;
      equipment.attachments = equipment.attachments || [];
      intervention.attachments.forEach((file) => {
        if (equipment.attachments.some((item) => item.id === file.id)) return;
        const apartmentId = file.sourceApartmentId || intervention.apartmentId || equipment.apartmentId;
        const apartment = next.apartments.find((item) => item.id === apartmentId);
        equipment.attachments.push({
          ...file,
          equipmentId: equipment.id,
          sourceEquipmentId: equipment.id,
          interventionId: intervention.id,
          workOrderId: file.workOrderId || intervention.workOrderId,
          sourceApartmentId: apartmentId,
          sourceBuildingId: file.sourceBuildingId || apartment?.buildingId || "",
          uploadedAt: file.uploadedAt || intervention.date || today()
        });
      });
    });
  }

  function normalizeActivityFields(config = {}) {
    const defaults = {
      type: { label: "Type", required: true, options: [], dataFieldId: "equipment_type", optionIds: [] },
      location: { label: "Localisation", required: true, options: [], dataFieldId: "equipment_location", optionIds: [] },
      brand: { label: "Marque", required: false, options: [], dataFieldId: "equipment_brand", optionIds: [] },
      model: { label: "Modèle", required: false, options: [], dataFieldId: "equipment_model", optionIds: [] },
      serial: { label: "Numéro de série", required: false, options: [] },
      status: { label: "Statut", required: true, options: [], dataFieldId: "equipment_status", optionIds: [] },
      notes: { label: "Notes machine", required: false, options: [] }
    };
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
      key,
      {
        ...value,
        ...(config[key] || {}),
        options: config[key]?.options || value.options,
        optionIds: config[key]?.optionIds || []
      }
    ]));
  }

  function normalizeDataFields(fields = []) {
    return fields.map((field) => ({
      id: field.id || uid("datafield"),
      name: field.name || field.label || "Champ",
      group: field.group || "Non groupé",
      type: field.type || "single",
      appliesTo: field.appliesTo?.length ? field.appliesTo : ["activity"],
      options: normalizeStatusDataOptions(field.id, normalizeDataOptions(field.options || []))
    }));
  }

  function normalizeStatusDataOptions(fieldId, options) {
    if (fieldId !== "equipment_status") return options;
    const required = [
      { id: "actif", label: "Actif", value: "actif", active: true },
      { id: "ok", label: "OK", value: "ok", active: true },
      { id: "surveillance", label: "Surveillance", value: "surveillance", active: true },
      { id: "reparation_requise", label: "Réparation requise", value: "reparation_requise", active: true },
      { id: "a_planifier", label: "À planifier", value: "a_planifier", active: true },
      { id: "hors_service", label: "Hors service", value: "hors_service", active: true }
    ];
    const existing = new Set(options.map((option) => option.value));
    return [...options, ...required.filter((option) => !existing.has(option.value))];
  }

  function normalizeRecommendation(recommendation) {
    if (!recommendation?.type) return null;
    const existingMessages = Array.isArray(recommendation.messages) ? recommendation.messages : [];
    const fallbackMessages = [
      recommendation.clientMessage ? {
        id: uid("msg"),
        authorRole: "interne",
        authorName: "ClimaParc",
        text: recommendation.clientMessage,
        createdAt: recommendation.sentAt || recommendation.createdAt || today()
      } : null,
      recommendation.clientComment ? {
        id: uid("msg"),
        authorRole: "client",
        authorName: "Client",
        text: recommendation.clientComment,
        createdAt: recommendation.decisionAt || today()
      } : null
    ].filter(Boolean);
    return {
      type: recommendation.type,
      description: recommendation.description || "",
      priority: recommendation.priority || "normale",
      part: recommendation.part || "",
      time: recommendation.time || "",
      status: recommendation.status || "a_valider",
      price: recommendation.price || "",
      delay: recommendation.delay || "",
      clientMessage: recommendation.clientMessage || "",
      internalNote: recommendation.internalNote || "",
      clientComment: recommendation.clientComment || "",
      createdAt: recommendation.createdAt || today(),
      sentAt: recommendation.sentAt || "",
      decisionAt: recommendation.decisionAt || "",
      reviewedBy: recommendation.reviewedBy || "",
      decidedBy: recommendation.decidedBy || "",
      workOrderId: recommendation.workOrderId || "",
      messages: (existingMessages.length ? existingMessages : fallbackMessages).map((message) => ({
        id: message.id || uid("msg"),
        authorRole: message.authorRole || "interne",
        authorName: message.authorName || "",
        text: message.text || "",
        createdAt: message.createdAt || today()
      })).filter((message) => message.text)
    };
  }

  function ensureCoreDataFields(fields) {
    const coreFields = normalizeDataFields(seed.dataFields.filter((field) => ["equipment_status", "activity_status", "recommendation_type"].includes(field.id)));
    const byId = new Map(fields.map((field) => [field.id, field]));
    coreFields.forEach((core) => {
      const existing = byId.get(core.id);
      if (!existing) {
        byId.set(core.id, core);
        return;
      }
      const existingValues = new Set((existing.options || []).map((option) => option.value));
      existing.options = [
        ...(existing.options || []),
        ...core.options.filter((option) => !existingValues.has(option.value))
      ];
    });
    return Array.from(byId.values());
  }

  function normalizeDataOptions(options = []) {
    return options.map((option) => {
      if (typeof option === "string") {
        return { id: slugify(option), label: option, value: option, active: true };
      }
      return {
        id: option.id || slugify(option.label || option.value),
        label: option.label || option.value || "",
        value: option.value || option.label || "",
        active: option.active !== false
      };
    }).filter((option) => option.label);
  }

  function mergeNavOrder(order = []) {
    const defaults = seed.navOrder;
    return [...order.filter((item) => defaults.includes(item)), ...defaults.filter((item) => !order.includes(item))];
  }

  function saveState() {
    if (!SERVER_ENABLED) {
      storage.write(STORAGE_KEY, state);
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    if (!canUseLegacyStateSave()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const changes = buildStateChanges();
      if (!changes) return;
      const saveStartedAt = Date.now();
      api.saveState(changes.fullState ? { state: changes.fullState } : { changes })
        .then((payload) => {
          if (!payload?.state) return;
          if (state.modal || lastLocalChangeAt > saveStartedAt) return;
          rememberServerState(payload.state);
          const uiState = currentUiState();
          state = {
            ...normalizeState(payload.state),
            ...uiState,
            sessionUserId: uiState.sessionUserId
          };
          render();
        })
        .catch(() => {
        state.toast = "Sauvegarde serveur indisponible.";
        render();
        scheduleToastClear();
      });
    }, 250);
  }

  async function saveStateNow() {
    if (!SERVER_ENABLED) {
      storage.write(STORAGE_KEY, state);
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    if (!canUseLegacyStateSave()) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const changes = buildStateChanges();
    if (!changes) return;
    const payload = await api.saveState(changes.fullState ? { state: changes.fullState } : { changes });
    if (payload.state) {
      rememberServerState(payload.state);
      const uiState = currentUiState();
      state = {
        ...normalizeState(payload.state),
        ...uiState,
        sessionUserId: uiState.sessionUserId
      };
    }
  }

  async function saveEquipmentNow(equipment, successToast) {
    if (!SERVER_ENABLED) {
      storage.write(STORAGE_KEY, state);
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const payload = await api.saveEquipment(equipment);
    if (payload.state) {
      rememberServerState(payload.state);
      const uiState = currentUiState();
      state = {
        ...normalizeState(payload.state),
        ...uiState,
        sessionUserId: uiState.sessionUserId,
        selectedEquipmentId: equipment.id,
        activeView: "detail",
        modal: null,
        toast: successToast
      };
      render();
      scheduleToastClear();
    }
  }

  async function saveUserNow(user, successToast) {
    if (!SERVER_ENABLED) {
      storage.write(STORAGE_KEY, state);
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const payload = await api.saveUser(user);
    if (payload.state) {
      rememberServerState(payload.state);
      const uiState = currentUiState();
      state = {
        ...normalizeState(payload.state),
        ...uiState,
        sessionUserId: uiState.sessionUserId,
        activeView: "utilisateurs",
        modal: null,
        toast: successToast
      };
      render();
      scheduleToastClear();
    }
  }

  async function saveDomainItemNow(apiCall, item, uiPatch, successToast) {
    if (!SERVER_ENABLED) {
      storage.write(STORAGE_KEY, state);
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const payload = await apiCall(item);
    if (payload.state) {
      rememberServerState(payload.state);
      const uiState = currentUiState();
      state = {
        ...normalizeState(payload.state),
        ...uiState,
        ...uiPatch,
        sessionUserId: uiState.sessionUserId,
        modal: null,
        toast: successToast
      };
      render();
      scheduleToastClear();
    }
  }

  async function saveSettingCollectionItem(collectionKey, item, successToast, uiPatch = { modal: null, activeView: "parametres" }) {
    const previousItems = JSON.parse(JSON.stringify(state[collectionKey] || []));
    const items = Array.isArray(state[collectionKey]) ? state[collectionKey] : [];
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    state[collectionKey] = items;

    if (!SERVER_ENABLED) {
      setState({ ...uiPatch, toast: successToast });
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    updateUiState({ ...uiPatch, toast: "Sauvegarde des paramètres..." });
    try {
      const payload = await api.saveSettingItem(collectionKey, item);
      if (payload.state) {
        rememberServerState(payload.state);
        const uiState = currentUiState();
        state = {
          ...normalizeState(payload.state),
          ...uiState,
          ...uiPatch,
          sessionUserId: uiState.sessionUserId,
          toast: successToast
        };
        render();
        scheduleToastClear();
      }
    } catch (error) {
      state[collectionKey] = previousItems;
      updateUiState({ ...uiPatch, toast: error.message || "Paramètres non sauvegardés." });
    }
  }

  async function saveActivityBundle(equipment, intervention, order, uiPatch, successToast) {
    if (!SERVER_ENABLED) {
      setState({ ...uiPatch, toast: successToast });
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      let payload = equipment ? await api.saveEquipment(equipment) : null;
      if (payload?.state) rememberServerState(payload.state);
      payload = await api.saveIntervention(intervention);
      if (payload.state) rememberServerState(payload.state);
      payload = await api.saveWorkOrder(order);
      if (payload.state) {
        rememberServerState(payload.state);
        const uiState = currentUiState();
        state = {
          ...normalizeState(payload.state),
          ...uiState,
          ...uiPatch,
          sessionUserId: uiState.sessionUserId,
          toast: successToast
        };
        render();
        scheduleToastClear();
      }
    } catch (error) {
      showToast(error.message || "Activité non sauvegardée.");
    }
  }

  function currentUiState() {
    return {
      sessionUserId: state.sessionUserId,
      activeView: state.activeView,
      selectedBuildingId: state.selectedBuildingId,
      selectedEquipmentId: state.selectedEquipmentId,
      selectedTicketId: state.selectedTicketId,
      selectedWorkOrderId: state.selectedWorkOrderId,
      selectedExecutionApartmentId: state.selectedExecutionApartmentId,
      filters: state.filters,
      workOrderFilters: state.workOrderFilters,
      reportFilters: state.reportFilters,
      globalSearch: state.globalSearch,
      sidebarMode: state.sidebarMode,
      mobileMenuOpen: state.mobileMenuOpen,
      dashboardLayouts: state.dashboardLayouts,
      dashboardEditMode: state.dashboardEditMode,
      dashboardCalendarDate: state.dashboardCalendarDate,
      toast: state.toast,
      modal: state.modal
    };
  }

  function historyUiState() {
    const ui = currentUiState();
    return {
      ...ui,
      toast: "",
      mobileMenuOpen: false
    };
  }

  function canUseBrowserHistory() {
    return typeof window !== "undefined" && window.history && currentUser();
  }

  function replaceBrowserHistoryState() {
    if (!canUseBrowserHistory()) return;
    window.history.replaceState({ climaparcUi: true, ui: historyUiState() }, document.title, window.location.pathname + window.location.search);
    browserHistoryReady = true;
  }

  function pushBrowserHistoryState() {
    if (!canUseBrowserHistory() || applyingHistoryState || restoringSession) return;
    if (!browserHistoryReady) replaceBrowserHistoryState();
    window.history.pushState({ climaparcUi: true, ui: historyUiState() }, document.title, window.location.pathname + window.location.search);
  }

  function ensureBrowserHistoryGuard() {
    if (!canUseBrowserHistory()) return;
    replaceBrowserHistoryState();
    window.history.pushState({ climaparcUi: true, ui: historyUiState() }, document.title, window.location.pathname + window.location.search);
  }

  function applyBrowserHistoryState(ui) {
    if (!ui || !currentUser()) return;
    applyingHistoryState = true;
    state = {
      ...state,
      ...ui,
      sessionUserId: state.sessionUserId,
      toast: "",
      mobileMenuOpen: false
    };
    render();
    applyingHistoryState = false;
  }

  function goBack(fallback = {}) {
    if (canUseBrowserHistory() && browserHistoryReady && window.history.length > 1) {
      window.history.back();
      return;
    }
    updateUiState({ modal: null, mobileMenuOpen: false, ...fallback });
  }

  function persistableState() {
    return {
      ...state,
      sessionUserId: null,
      modal: null,
      mobileMenuOpen: false,
      toast: "",
      resetToken: "",
      activeView: "tableau",
      selectedBuildingId: seed.selectedBuildingId,
      selectedEquipmentId: seed.selectedEquipmentId,
      selectedTicketId: null,
      selectedWorkOrderId: null,
      selectedExecutionApartmentId: null,
      globalSearch: "",
      filters: { ...seed.filters },
      workOrderFilters: { ...seed.workOrderFilters },
      dashboardEditMode: false,
      dashboardCalendarDate: state.dashboardCalendarDate || today()
    };
  }

  function sharedStateSnapshot(source = state) {
    return {
      ...JSON.parse(JSON.stringify(source || {})),
      sessionUserId: null,
      modal: null,
      mobileMenuOpen: false,
      toast: "",
      activeView: "tableau",
      globalSearch: "",
      filters: { ...seed.filters },
      workOrderFilters: { ...seed.workOrderFilters },
      dashboardEditMode: false
    };
  }

  function rememberServerState(serverState) {
    lastServerState = sharedStateSnapshot(normalizeState(serverState || seed));
  }

  function stableJson(value) {
    return JSON.stringify(value ?? null);
  }

  function buildStateChanges() {
    const current = sharedStateSnapshot(state);
    const base = lastServerState ? sharedStateSnapshot(lastServerState) : null;
    if (!base) return { fullState: current };
    const upserts = {};
    const deletes = {};
    SHARED_COLLECTION_KEYS.forEach((key) => {
      const currentItems = Array.isArray(current[key]) ? current[key] : [];
      const baseItems = Array.isArray(base[key]) ? base[key] : [];
      const currentById = new Map(currentItems.filter((item) => item?.id).map((item) => [item.id, item]));
      const baseById = new Map(baseItems.filter((item) => item?.id).map((item) => [item.id, item]));
      const changed = currentItems.filter((item) => item?.id && stableJson(item) !== stableJson(baseById.get(item.id)));
      const removed = baseItems.filter((item) => item?.id && !currentById.has(item.id)).map((item) => item.id);
      if (changed.length) upserts[key] = changed;
      if (removed.length) deletes[key] = removed;
    });
    const values = {};
    Object.keys(current).forEach((key) => {
      if (SHARED_COLLECTION_KEYS.includes(key)) return;
      if (stableJson(current[key]) !== stableJson(base[key])) values[key] = current[key];
    });
    if (!Object.keys(upserts).length && !Object.keys(deletes).length && !Object.keys(values).length) return null;
    return { upserts, deletes, values };
  }

  function canUseLegacyStateSave() {
    const user = state.users.find((item) => item.id === state.sessionUserId);
    return ["administrateur", "equipe_interne"].includes(user?.role);
  }

  function setState(patch) {
    state = { ...state, ...patch };
    lastLocalChangeAt = Date.now();
    const isNavigationPatch = Object.prototype.hasOwnProperty.call(patch, "activeView") || Object.prototype.hasOwnProperty.call(patch, "modal");
    if (isNavigationPatch) {
      lastNavigationAt = lastLocalChangeAt;
    }
    saveState();
    render();
    if (isNavigationPatch) pushBrowserHistoryState();
    if (Object.prototype.hasOwnProperty.call(patch, "toast")) scheduleToastClear();
  }

  function updateUiState(patch) {
    state = { ...state, ...patch };
    lastLocalChangeAt = Date.now();
    const isNavigationPatch = Object.prototype.hasOwnProperty.call(patch, "activeView") || Object.prototype.hasOwnProperty.call(patch, "modal");
    if (isNavigationPatch) {
      lastNavigationAt = lastLocalChangeAt;
    }
    render();
    if (isNavigationPatch) pushBrowserHistoryState();
    if (Object.prototype.hasOwnProperty.call(patch, "toast")) scheduleToastClear();
  }

  function updateGlobalSearch(input) {
    state = { ...state, globalSearch: input.value };
    lastLocalChangeAt = Date.now();
    render();
    const nextInput = document.querySelector("[data-action='global-search']");
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
    }
  }

  function openSearchResult(target) {
    const { type, id, equipment } = target.dataset;
    const patch = { globalSearch: "", modal: null, mobileMenuOpen: false };
    if (type === "building") Object.assign(patch, { selectedBuildingId: id, activeView: "lieu_detail" });
    else if (type === "apartment") {
      const apartment = state.apartments.find((item) => item.id === id);
      Object.assign(patch, { selectedBuildingId: apartment?.buildingId || state.selectedBuildingId, activeView: "lieu_detail" });
    } else if (type === "equipment") Object.assign(patch, { selectedEquipmentId: id, activeView: "detail" });
    else if (type === "ticket") Object.assign(patch, { activeView: "appels", modal: { type: "ticket", id } });
    else if (type === "workorder") Object.assign(patch, { activeView: "bons", modal: canCreateWorkOrders() ? { type: "workorder", id } : null });
    else if (type === "intervention") Object.assign(patch, { selectedEquipmentId: equipment, activeView: "detail" });
    else if (type === "reminder") Object.assign(patch, { activeView: "alertes", modal: { type: "reminder", id } });
    updateUiState(patch);
  }

  function scheduleToastClear() {
    clearTimeout(toastTimer);
    if (!state.toast) return;
    toastTimer = setTimeout(() => {
      state = { ...state, toast: "" };
      render();
    }, 2500);
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.sessionUserId);
  }

  function roleLabel(role) {
    return state.roleDefinitions?.find((item) => item.id === role)?.name || {
      administrateur: "Administrateur",
      equipe_interne: "Équipe interne",
      technicien: "Technicien",
      client: "Client"
    }[role] || role;
  }

  function can(action) {
    const user = currentUser();
    if (!user) return false;
    if (user.role === "client") {
      const rights = clientPortalRights(user);
      return rights.includes("all") || rights.includes(action);
    }
    const role = state.roleDefinitions?.find((item) => item.id === user.role);
    return role?.rights?.includes("all") || role?.rights?.includes(action);
  }

  function canCreateWorkOrders() {
    return currentUser()?.role !== "client" && can("workorders");
  }

  function portalRightsCatalog() {
    return [
      ["lieux", "Voir lieux et appartements"],
      ["equipment", "Voir équipements"],
      ["tickets", "Voir demandes clients"],
      ["workorders", "Voir bons de travail"],
      ["documents", "Voir documents"],
      ["reports", "Voir rapports"],
      ["recommendations", "Voir recommandations"],
      ["recommendation_prices", "Voir prix et délais"],
      ["recommendation_approve", "Approuver / refuser recommandations"],
      ["alerts", "Voir alertes"],
      ["users", "Créer et gérer utilisateurs client"]
    ];
  }

  function defaultPortalRights(level) {
    if (level === "maintenance") return ["portal", "lieux", "equipment", "tickets", "workorders", "documents"];
    return ["portal", ...portalRightsCatalog().map(([right]) => right)];
  }

  function normalizePortalRight(right) {
    return {
      prices: "recommendation_prices",
      approve_recommendations: "recommendation_approve"
    }[right] || right;
  }

  function normalizePortalRights(rights = []) {
    return Array.from(new Set(rights.map(normalizePortalRight).filter(Boolean)));
  }

  function clientPortalRights(user = currentUser()) {
    if (!user || user.role !== "client") return [];
    return normalizePortalRights(user.portalRights?.length ? ["portal", ...user.portalRights] : defaultPortalRights(user.clientAccessLevel || "direction"));
  }

  function canPortal(right) {
    const rights = clientPortalRights();
    return rights.includes("all") || rights.includes(normalizePortalRight(right));
  }

  function clientAllowedBuildingIds(user = currentUser()) {
    if (!user || user.role !== "client") return null;
    const clientBuildings = state.buildings.filter((building) => building.clientId === user.clientId).map((building) => building.id);
    const allowed = user.allowedBuildingIds || [];
    return allowed.length ? clientBuildings.filter((id) => allowed.includes(id)) : clientBuildings;
  }

  function clientScopeIds() {
    const user = currentUser();
    if (!user || user.role !== "client") return null;
    const buildingIds = clientAllowedBuildingIds(user);
    const apartmentIds = state.apartments.filter((apartment) => buildingIds.includes(apartment.buildingId)).map((apartment) => apartment.id);
    const equipmentIds = state.equipment.filter((item) => apartmentIds.includes(item.apartmentId)).map((item) => item.id);
    return { buildingIds, apartmentIds, equipmentIds };
  }

  function scopedBuildings() {
    const scope = clientScopeIds();
    return scope ? state.buildings.filter((building) => scope.buildingIds.includes(building.id)) : state.buildings;
  }

  function scopedApartments() {
    const scope = clientScopeIds();
    return scope ? state.apartments.filter((apartment) => scope.apartmentIds.includes(apartment.id)) : state.apartments;
  }

  function apartmentsForBuilding(buildingId) {
    return scopedApartments()
      .filter((apartment) => apartment.buildingId === buildingId)
      .sort((a, b) => a.number.localeCompare(b.number, "fr", { numeric: true }));
  }

  function equipmentForApartment(apartmentId) {
    return scopedEquipment().filter((item) => item.apartmentId === apartmentId);
  }

  function scopedEquipment() {
    const scope = clientScopeIds();
    return scope ? state.equipment.filter((item) => scope.equipmentIds.includes(item.id)) : state.equipment;
  }

  function scopedTickets() {
    const scope = clientScopeIds();
    return scope ? state.tickets.filter((ticket) => ticket.clientId === currentUser().clientId && (scope.equipmentIds.includes(ticket.equipmentId) || scope.buildingIds.includes(ticket.buildingId))) : state.tickets;
  }

  function scopedWorkOrders() {
    const equipmentIds = scopedEquipment().map((item) => item.id);
    const buildingIds = scopedBuildings().map((building) => building.id);
    if (currentUser()?.role === "technicien") {
      return state.workOrders.filter((order) => order.technicianId === currentUser().id || (order.assignedTechnicianIds || []).includes(currentUser().id));
    }
    return state.workOrders.filter((order) => equipmentIds.includes(order.equipmentId) || buildingIds.includes(order.buildingId));
  }

  function scopedReminders() {
    const equipmentIds = scopedEquipment().map((item) => item.id);
    return (state.reminders || []).filter((reminder) => equipmentIds.includes(reminder.equipmentId));
  }

  function scopedClientDocuments() {
    const user = currentUser();
    if (user?.role === "client") {
      const buildingIds = clientAllowedBuildingIds(user);
      const hasFullClientAccess = !(user.allowedBuildingIds || []).length;
      return (state.clientDocuments || []).filter((doc) => {
        if (doc.clientId !== user.clientId || doc.visibleToClient === false) return false;
        if (!doc.buildingId) return hasFullClientAccess;
        return buildingIds.includes(doc.buildingId);
      });
    }
    return state.clientDocuments || [];
  }

  function scopedRecommendations() {
    const equipmentIds = scopedEquipment().map((item) => item.id);
    return state.interventions
      .filter((intervention) => intervention.recommendation?.type && equipmentIds.includes(intervention.equipmentId))
      .map((intervention) => recommendationContext(intervention))
      .filter((item) => currentUser()?.role !== "client" || ["envoyee", "approuvee", "refusee", "information_demandee"].includes(item.recommendation.status));
  }

  function recommendationContext(intervention) {
    const { equipment, apartment, building, client } = equipmentContext(intervention.equipmentId);
    const order = state.workOrders.find((item) => item.id === intervention.workOrderId);
    const technician = state.users.find((user) => user.id === intervention.technicianId);
    return {
      intervention,
      recommendation: intervention.recommendation,
      equipment,
      apartment,
      building,
      client,
      order,
      technician
    };
  }

  function recommendationAttentionCount() {
    return scopedRecommendations().filter(({ recommendation }) => {
      if (currentUser()?.role === "client") return recommendation.status === "envoyee";
      return ["a_valider", "information_demandee"].includes(recommendation.status);
    }).length;
  }

  function reminderIsDue(reminder) {
    return reminder.status === "active" && reminder.nextDueDate && reminder.nextDueDate <= today();
  }

  function unseenReminderCount() {
    return scopedReminders().filter((reminder) => reminderIsDue(reminder) && reminder.lastSeenDueDate !== reminder.nextDueDate).length;
  }

  function reminderStatus(reminder) {
    if (reminder.status === "inactive") return "inactive";
    return reminderIsDue(reminder) ? "due" : "upcoming";
  }

  function reminderStatusBadge(reminder) {
    return statusBadge(reminderStatus(reminder));
  }

  function canManageReminders() {
    return can("alerts") || can("equipment") || can("portal");
  }

  function canEditReminders() {
    const user = currentUser();
    return ["administrateur", "equipe_interne"].includes(user?.role) && can("alerts");
  }

  function buildingForApartment(apartmentId) {
    const apartment = state.apartments.find((item) => item.id === apartmentId);
    return state.buildings.find((item) => item.id === apartment?.buildingId);
  }

  function clientForBuilding(buildingId) {
    const building = state.buildings.find((item) => item.id === buildingId);
    return state.clients.find((item) => item.id === building?.clientId);
  }

  function equipmentContext(equipmentId) {
    const equipment = state.equipment.find((item) => item.id === equipmentId);
    const apartment = state.apartments.find((item) => item.id === equipment?.apartmentId);
    const building = state.buildings.find((item) => item.id === apartment?.buildingId);
    const client = state.clients.find((item) => item.id === building?.clientId);
    return { equipment, apartment, building, client };
  }

  function workOrderContext(order) {
    if (!order) return {};
    if (order.buildingId) {
      const building = state.buildings.find((item) => item.id === order.buildingId);
      const client = state.clients.find((item) => item.id === building?.clientId);
      return { building, client, apartment: null, equipment: null };
    }
    return equipmentContext(order.equipmentId);
  }

  function workOrderApartments(order) {
    if (!order) return [];
    if (order.buildingId) return apartmentsForBuilding(order.buildingId);
    const { apartment } = equipmentContext(order.equipmentId);
    return apartment ? [apartment] : [];
  }

  function interventionsForOrder(orderId) {
    return state.interventions.filter((item) => item.workOrderId === orderId);
  }

  function workOrderProgress(order) {
    const apartments = workOrderApartments(order);
    const interventions = interventionsForOrder(order.id);
    const completedApartmentIds = new Set(interventions.map((item) => item.apartmentId || state.equipment.find((eq) => eq.id === item.equipmentId)?.apartmentId).filter(Boolean));
    const done = apartments.filter((apartment) => completedApartmentIds.has(apartment.id)).length;
    return {
      totalApartments: apartments.length,
      doneApartments: done,
      machines: interventions.length,
      percent: apartments.length ? Math.round((done / apartments.length) * 100) : 0
    };
  }

  function formTemplateForOrder(order) {
    return state.formTemplates.find((item) => item.id === order?.formTemplateId) || state.formTemplates[0];
  }

  function statusBadge(status) {
    const map = {
      actif: ["Actif", "ok"],
      ok: ["OK", "ok"],
      surveillance: ["Surveillance", "warn"],
      reparation_requise: ["Réparation requise", "danger"],
      a_planifier: ["À planifier", "info"],
      hors_service: ["Hors service", "danger"],
      completee: ["Complétée", "ok"],
      partielle: ["Partielle", "warn"],
      a_revoir: ["À revoir", "info"],
      client_absent: ["Client absent", "neutral"],
      ouvert: ["Ouvert", "info"],
      a_valider: ["À valider", "warn"],
      envoyee: ["Envoyée", "info"],
      approuvee: ["Approuvée", "ok"],
      refusee: ["Refusée", "danger"],
      information_demandee: ["Info demandée", "warn"],
      equipe_interne: ["Équipe interne", "neutral"],
      techniciens: ["Équipe techniciens", "neutral"],
      en_cours: ["En cours", "warn"],
      ferme: ["Fermé", "neutral"],
      planifie: ["Planifié", "info"],
      termine: ["Terminé", "ok"],
      annule: ["Annulé", "neutral"],
      terminee: ["Terminée", "ok"],
      urgente: ["Urgente", "danger"],
      normale: ["Normale", "info"],
      basse: ["Basse", "neutral"],
      active: ["Actif", "ok"],
      inactive: ["Inactif", "neutral"],
      due: ["À traiter", "danger"],
      upcoming: ["À venir", "info"]
    };
    const [label, tone] = map[status] || [status, "neutral"];
    return `<span class="badge ${tone}">${label}</span>`;
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(`${value}T12:00:00`));
  }

  function today() {
    return dateInputValue(new Date());
  }

  function dateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function monthStart(dateValue = today()) {
    return `${dateValue.slice(0, 7)}-01`;
  }

  function daysInMonth(dateValue = today()) {
    const [year, month] = monthStart(dateValue).split("-").map(Number);
    const total = new Date(year, month, 0).getDate();
    return Array.from({ length: total }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
  }

  function monthCalendarDays(dateValue = today()) {
    const monthDays = daysInMonth(dateValue);
    const first = new Date(`${monthDays[0]}T12:00:00`);
    const mondayOffset = (first.getDay() + 6) % 7;
    const leading = Array.from({ length: mondayOffset }, (_, index) => addDateInterval(monthDays[0], index - mondayOffset, "days"));
    const totalCells = Math.ceil((leading.length + monthDays.length) / 7) * 7;
    const trailing = Array.from({ length: totalCells - leading.length - monthDays.length }, (_, index) => addDateInterval(monthDays[monthDays.length - 1], index + 1, "days"));
    return [...leading, ...monthDays, ...trailing];
  }

  function monthKey(dateValue) {
    return dateValue ? dateValue.slice(0, 7) : "";
  }

  function monthLabel(month) {
    if (!month) return "-";
    return new Intl.DateTimeFormat("fr-CA", { month: "short", year: "numeric" }).format(new Date(`${month}-15T12:00:00`));
  }

  function inPeriod(dateValue, startDate, endDate) {
    if (!dateValue) return false;
    return (!startDate || dateValue >= startDate) && (!endDate || dateValue <= endDate);
  }

  function daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function averageDays(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    if (!clean.length) return 0;
    return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
  }

  function ticketNumberFromIndex(index, dateValue = today()) {
    const year = (dateValue || today()).slice(0, 4) || new Date().getFullYear();
    return `AS-${year}-${String(index).padStart(3, "0")}`;
  }

  function nextTicketNumber() {
    const year = today().slice(0, 4);
    const numbers = state.tickets
      .map((ticket) => ticket.number || "")
      .filter((number) => number.startsWith(`AS-${year}-`))
      .map((number) => Number(number.split("-").pop()))
      .filter(Number.isFinite);
    return `AS-${year}-${String((Math.max(0, ...numbers) || 0) + 1).padStart(3, "0")}`;
  }

  function addDateInterval(dateValue, amount, unit) {
    const date = new Date(`${dateValue || today()}T12:00:00`);
    if (unit === "days") date.setDate(date.getDate() + Number(amount || 1));
    else if (unit === "months") date.setMonth(date.getMonth() + Number(amount || 1));
    else date.setFullYear(date.getFullYear() + Number(amount || 1));
    return dateInputValue(date);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function normalizeSearch(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .toLowerCase()
      .trim();
  }

  function searchText(...values) {
    return normalizeSearch(values.flat().filter(Boolean).join(" "));
  }

  function dateSearchParts(...dates) {
    return dates.filter(Boolean).flatMap((date) => {
      const year = date.slice(0, 4);
      const month = date.slice(5, 7);
      const day = date.slice(8, 10);
      return [date, formatDate(date), year, `${year}-${month}`, `${day}/${month}/${year}`, `${day} ${month} ${year}`, `${month} ${year}`];
    });
  }

  function globalSearchResults() {
    const query = normalizeSearch(state.globalSearch);
    if (!query) return [];
    const rows = [];
    scopedBuildings().forEach((building) => {
      const client = state.clients.find((item) => item.id === building.clientId);
      rows.push({
        type: "building",
        id: building.id,
        label: "Lieu",
        title: building.name,
        detail: `${building.address} | ${client?.name || ""}`,
        text: searchText(building.name, building.address, building.onsiteContactName, building.onsiteContactPhone, building.onsiteContactPoste, building.onsiteContactEmail, building.billingContactName, building.billingContactPhone, building.billingContactPoste, building.billingContactEmail, building.notes, client?.name)
      });
    });
    scopedApartments().forEach((apartment) => {
      const building = buildingForApartment(apartment.id);
      rows.push({
        type: "apartment",
        id: apartment.id,
        label: "Appartement",
        title: `Appartement ${apartment.number}`,
        detail: `${building?.name || "-"} | ${apartment.occupant || ""}`,
        text: searchText(apartment.number, apartment.occupant, building?.name, building?.address)
      });
    });
    scopedEquipment().forEach((equipment) => {
      const { apartment, building } = equipmentContext(equipment.id);
      rows.push({
        type: "equipment",
        id: equipment.id,
        label: "Équipement",
        title: `${equipment.type} | ${equipment.serial || "-"}`,
        detail: `${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${equipment.brand || ""} ${equipment.model || ""}`,
        text: searchText(equipment.type, equipment.brand, equipment.model, equipment.serial, equipment.location, equipment.status, statusText(equipment.status), equipment.notes, building?.name, building?.address, apartment?.number, apartment?.occupant, dateSearchParts(equipment.installDate, equipment.lastService, equipment.nextService))
      });
    });
    scopedTickets().forEach((ticket) => {
      const { equipment, apartment, building } = equipmentContext(ticket.equipmentId);
      const serviceType = state.serviceTypes.find((item) => item.id === ticket.serviceTypeId);
      rows.push({
        type: "ticket",
        id: ticket.id,
        label: "Demande client",
        title: `${ticket.number || ticket.id} | ${ticket.title}`,
        detail: `${serviceType?.name || "-"} | ${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${statusText(ticket.status)}`,
        text: searchText(ticket.number, ticket.id, ticket.title, ticket.description, ticket.priority, statusText(ticket.priority), ticket.status, statusText(ticket.status), serviceType?.name, building?.name, building?.address, apartment?.number, apartment?.occupant, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, dateSearchParts(ticket.createdAt))
      });
    });
    scopedWorkOrders().forEach((order) => {
      const { equipment, apartment, building } = workOrderContext(order);
      const type = state.interventionTypes.find((item) => item.id === order.typeId);
      const tech = state.users.find((item) => item.id === order.technicianId);
      rows.push({
        type: "workorder",
        id: order.id,
        label: "Bon de travail",
        title: `${order.number} | ${type?.name || ""}`,
        detail: `${building?.name || "-"} ${apartment ? `| Apt ${apartment.number}` : "| Bloc complet"} | ${statusText(order.status)}`,
        text: searchText(order.number, order.id, type?.name, tech?.name, order.status, statusText(order.status), order.notes, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, dateSearchParts(order.scheduledDate))
      });
    });
    state.interventions
      .filter((intervention) => scopedEquipment().some((equipment) => equipment.id === intervention.equipmentId))
      .forEach((intervention) => {
        const { equipment, apartment, building } = equipmentContext(intervention.equipmentId);
        const type = state.interventionTypes.find((item) => item.id === intervention.typeId);
        const tech = state.users.find((item) => item.id === intervention.technicianId);
        rows.push({
          type: "intervention",
          id: intervention.id,
          equipmentId: intervention.equipmentId,
          label: "Intervention",
          title: `${type?.name || "Intervention"} | ${formatDate(intervention.date)}`,
          detail: `${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${equipment?.type || "-"}`,
          text: searchText(type?.name, intervention.status, statusText(intervention.status), intervention.activityStatus, statusText(intervention.activityStatus), intervention.machineStatus, statusText(intervention.machineStatus), intervention.unitKind, intervention.recommendation?.type, dataFieldLabelByValue("recommendation_type", intervention.recommendation?.type), intervention.recommendation?.description, intervention.recommendation?.part, intervention.recommendation?.time, intervention.summary, Object.entries(intervention.readings || {}).flat(), tech?.name, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, dateSearchParts(intervention.date))
        });
      });
    scopedReminders().forEach((reminder) => {
      const { equipment, apartment, building } = equipmentContext(reminder.equipmentId);
      rows.push({
        type: "reminder",
        id: reminder.id,
        label: "Rappel",
        title: reminder.title,
        detail: `${building?.name || "-"} | Apt ${apartment?.number || "-"} | ${formatDate(reminder.nextDueDate)} | ${statusText(reminderStatus(reminder))}`,
        text: searchText(reminder.title, reminder.status, statusText(reminderStatus(reminder)), reminder.notes, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, dateSearchParts(reminder.startDate, reminder.nextDueDate, reminder.createdAt))
      });
    });
    return rows.filter((row) => row.text.includes(query)).slice(0, 12);
  }

  function globalSearchBox() {
    const query = state.globalSearch || "";
    const results = globalSearchResults();
    return `
      <section class="global-search">
        <div class="global-search-input-wrap">
          <span class="search-icon" aria-hidden="true">${iconSvg("search")}</span>
          <input data-action="global-search" value="${escapeHtml(query)}" placeholder="Rechercher dans ClimaParc" autocomplete="off">
          ${query ? `<button class="icon-button search-clear" type="button" data-action="clear-global-search" aria-label="Effacer">X</button>` : ""}
        </div>
        ${query ? `
          <div class="global-search-results">
            ${results.map((result) => `
              <button class="search-result" type="button" data-action="open-search-result" data-type="${escapeHtml(result.type)}" data-id="${escapeHtml(result.id)}" data-equipment="${escapeHtml(result.equipmentId || "")}">
                <span>${escapeHtml(result.label)}</span>
                <strong>${escapeHtml(result.title)}</strong>
                <small>${escapeHtml(result.detail)}</small>
              </button>
            `).join("") || `<div class="empty search-empty">Aucun résultat trouvé.</div>`}
          </div>
        ` : ""}
      </section>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCanadianPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function phoneField(name, value) {
    return `<input name="${escapeHtml(name)}" value="${escapeHtml(formatCanadianPhone(value))}" inputmode="tel" autocomplete="tel" placeholder="(514) 555-0123" data-phone-input>`;
  }

  function displayPhone(phone, poste) {
    const formatted = formatCanadianPhone(phone);
    if (!formatted) return "-";
    return poste ? `${formatted} poste ${poste}` : formatted;
  }

  function unitKindLabel(value) {
    return value === "exterieure" ? "Unité extérieure" : "Unité intérieure";
  }

  function apartmentNumberValue(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function iconSvg(name) {
    const icons = {
      pin: '<path d="M15 4.5 19.5 9l-3.1 3.1.5 4.1-1.4 1.4-4.2-4.2L7 17.7 6.3 17l4.3-4.3-4.2-4.2 1.4-1.4 4.1.5L15 4.5Z"/><path d="m9.5 14.5-4 4"/>',
      pencil: '<path d="m14.6 4.4 3 3"/><path d="M5 16.9 6 13l8.7-8.7a2.1 2.1 0 0 1 3 3L9 16l-4 .9Z"/>',
      grip: '<path d="M8 6h8M8 10h8M8 14h8"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      chevronLeft: '<path d="m15 18-6-6 6-6"/>',
      chevronRight: '<path d="m9 18 6-6-6-6"/>',
      chevronUp: '<path d="m7 13 5-5 5 5"/>',
      chevronDown: '<path d="m7 11 5 5 5-5"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
      file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
      wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z"/>',
      alertTriangle: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      check: '<path d="m20 6-11 11-5-5"/>'
    };
    return `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:16px;height:16px;flex:0 0 16px">${icons[name] || ""}</svg>`;
  }

  function canPinSidebar() {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(min-width: 1101px) and (hover: hover) and (pointer: fine)").matches;
  }

  function appShell(content) {
    const user = currentUser();
    const nav = orderedNavItems().filter((item) => item[3]);
    const isPinned = state.sidebarMode === "fixed";
    const showSidebarPin = canPinSidebar();
    const isDashboardTemplate = state.activeView === "tableau" && user.role !== "client";

    return `
      <div class="app-shell sidebar-${state.sidebarMode} ${state.mobileMenuOpen ? "mobile-menu-open" : ""} ${isDashboardTemplate ? "dashboard-template" : ""}">
        <header class="mobile-appbar">
          <button class="mobile-brand-button brand-mark" type="button" data-action="toggle-mobile-menu" aria-expanded="${state.mobileMenuOpen}" aria-label="${state.mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}">
            <span class="logo">CP</span><span class="brand-name">ClimaParc</span>
          </button>
        </header>
        <button class="mobile-menu-backdrop" type="button" data-action="close-mobile-menu" aria-label="Fermer le menu"></button>
        <aside class="sidebar">
          ${showSidebarPin ? `<button class="sidebar-pin" type="button" data-action="toggle-sidebar-pin" aria-label="${isPinned ? "Replier le menu" : "Épingler le menu"}" aria-pressed="${isPinned}" title="${isPinned ? "Replier le menu" : "Épingler le menu"}">${iconSvg(isPinned ? "chevronLeft" : "chevronRight")}</button>` : ""}
          <div class="sidebar-header">
            <div class="brand-mark"><span class="logo">CP</span><span class="brand-name">ClimaParc</span></div>
          </div>
          <nav class="nav" data-nav-list>
            ${nav
              .map(([view, icon, label]) => `
                <button class="nav-link ${state.activeView === view ? "active" : ""}" type="button" data-action="view" data-view="${view}" title="${escapeHtml(label)}">
                  <span class="nav-icon">${icon}${view === "alertes" && unseenReminderCount() ? `<span class="alert-dot" aria-label="${unseenReminderCount()} nouveau rappel"></span>` : ""}${view === "recommandations" && recommendationAttentionCount() ? `<span class="alert-dot" aria-label="${recommendationAttentionCount()} recommandation en attente"></span>` : ""}</span>
                  <span class="nav-label">${label}</span>
                </button>
              `)
              .join("")}
          </nav>
          <div class="user-card">
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${roleLabel(user.role)}</span>
            </div>
            <button class="ghost-button" data-action="logout">Déconnexion</button>
          </div>
        </aside>
        <main class="main">${globalSearchBox()}${content}</main>
      </div>
      ${state.modal ? renderModal() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    `;
  }

  function baseNavItems() {
    return [
      ["tableau", "TB", "Tableau de bord", true],
      ["lieux", "LI", "Lieux", can("lieux")],
      ["equipements", "EQ", "Équipements", can("equipment")],
      ["alertes", "AL", "Alertes", canManageReminders()],
      ["appels", "DC", "Demandes des clients", can("tickets")],
      ["bons", "BT", "Bons de travail", can("workorders")],
      ["recommandations", "RC", "Recommandations", can("recommendations")],
      ["rapports", "RP", "Rapports", can("reports")],
      ["utilisateurs", "UT", "Utilisateurs", can("users")],
      ["parametres", "PR", "Paramètres", can("settings") && currentUser()?.role !== "client"]
    ];
  }

  function orderedNavItems() {
    const byId = Object.fromEntries(baseNavItems().map((item) => [item[0], item]));
    return mergeNavOrder(state.navOrder).map((id) => byId[id]).filter(Boolean);
  }

  function renderLogin() {
    return `
      <div class="login-shell">
        <section class="login-panel">
          <div class="brand-mark"><span class="logo">CP</span><span>ClimaParc</span></div>
          <h1>Gestion HVAC multi-immeubles</h1>
          <p>Inventaire des équipements, interventions, demandes clients, bons de travail, checklists techniques et accès client.</p>
          <form class="login-form" data-form="login">
            <div class="field">
              <label for="email">Courriel</label>
              <input id="email" name="email" type="email" autocomplete="username">
            </div>
            <div class="field">
              <label for="password">Mot de passe</label>
              <input id="password" name="password" type="password" autocomplete="current-password">
            </div>
            <button class="primary-button" type="submit">Connexion</button>
          </form>
          <div class="login-links">
            <button class="ghost-button" data-action="open-modal" data-modal="signup">Créer un compte</button>
            <button class="link-button" data-action="open-modal" data-modal="forgotPassword">Mot de passe oublié?</button>
          </div>
        </section>
        <section class="login-visual">
          <div class="visual-copy">
            <h2>Parc HVAC, appartements et travaux au même endroit.</h2>
            <p>Une vue claire pour l'équipe interne, les techniciens et les administrateurs de copropriétés.</p>
          </div>
        </section>
      </div>
      ${state.modal ? renderModal() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    `;
  }

  function renderTopbar(title, subtitle, actions = "") {
    return `
      <header class="topbar">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="actions">${actions}</div>
      </header>
    `;
  }

  function buildingsView() {
    const buildings = scopedBuildings().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const actions = currentUser().role !== "client" && can("lieux")
      ? `<button class="primary-button" data-action="open-modal" data-modal="building">Nouveau lieu</button>`
      : "";
    return appShell(`
      ${renderTopbar("Lieux", "Organisation par nom de bâtiment et adresse, puis appartements et machines.", actions)}
      <section class="cards-grid">
        ${buildings.map((building) => buildingCard(building)).join("") || `<div class="empty">Aucun lieu enregistré.</div>`}
      </section>
    `);
  }

  function buildingCard(building) {
    const client = state.clients.find((item) => item.id === building.clientId);
    const apartments = apartmentsForBuilding(building.id);
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
          ${currentUser().role !== "client" ? `<button class="ghost-button" data-action="open-modal" data-modal="building" data-id="${building.id}">Modifier</button>` : ""}
        </div>
      </article>
    `;
  }

  function buildingDetailView() {
    const building = scopedBuildings().find((item) => item.id === state.selectedBuildingId) || scopedBuildings()[0];
    if (!building) return buildingsView();
    const client = state.clients.find((item) => item.id === building.clientId);
    const apartments = apartmentsForBuilding(building.id);
    const actions = `
      <button class="ghost-button" data-action="go-back" data-fallback-view="lieux">Retour</button>
      ${can("documents") ? `<button class="ghost-button" data-action="open-modal" data-modal="buildingDocuments" data-building="${building.id}">Documents</button>` : ""}
      ${currentUser().role !== "client" ? `<button class="primary-button" data-action="open-modal" data-modal="apartment" data-building="${building.id}">Nouvel appartement</button>` : ""}
      ${currentUser().role !== "client" ? `<button class="ghost-button" data-action="open-modal" data-modal="building" data-id="${building.id}">Modifier le lieu</button>` : ""}
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
        ${currentUser().role !== "client" ? `
          <div class="actions">
            <button class="ghost-button" data-action="open-modal" data-modal="apartment" data-id="${apartment.id}" data-building="${apartment.buildingId}">Modifier l'appartement</button>
            <button class="primary-button" data-action="open-modal" data-modal="equipment" data-apartment="${apartment.id}">Ajouter une machine</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  const dashboardModule = window.ClimaParcDashboard.create({
    getState: () => state,
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
  });

  function dashboard() {
    return dashboardModule.dashboard();
  }

  function dashboardLayoutForCurrentUser() {
    return dashboardModule.dashboardLayoutForCurrentUser();
  }

  function saveDashboardLayout(layout) {
    return dashboardModule.saveDashboardLayout(layout);
  }

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

  function equipmentView() {
    const equipment = filteredEquipment();
    const actions = `${can("equipment") && currentUser().role !== "client" ? `<button class="primary-button" data-action="open-modal" data-modal="equipment">Nouvel équipement</button>` : ""}`;
    return appShell(`
      ${renderTopbar("Équipements", "Inventaire par immeuble, appartement et appareil.", actions)}
      <section class="panel">
        <div class="panel-body">
          ${filtersBlock()}
          ${equipmentTable(equipment, true)}
        </div>
      </section>
    `);
  }

  function filtersBlock() {
    const buildings = scopedBuildings();
    const apartments = scopedApartments().filter((apartment) => state.filters.buildingId === "all" || apartment.buildingId === state.filters.buildingId);
    return `
      <div class="filters">
        <div class="field">
          <label>Immeuble</label>
          <select data-action="filter" data-filter="buildingId">
            <option value="all">Tous</option>
            ${buildings.map((building) => `<option value="${building.id}" ${state.filters.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Appartement</label>
          <select data-action="filter" data-filter="apartmentId">
            <option value="all">Tous</option>
            ${apartments.map((apartment) => `<option value="${apartment.id}" ${state.filters.apartmentId === apartment.id ? "selected" : ""}>${escapeHtml(apartment.number)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Statut</label>
          <select data-action="filter" data-filter="status">
            <option value="all">Tous</option>
            <option value="actif" ${state.filters.status === "actif" ? "selected" : ""}>Actif</option>
            <option value="surveillance" ${state.filters.status === "surveillance" ? "selected" : ""}>Surveillance</option>
            <option value="a_planifier" ${state.filters.status === "a_planifier" ? "selected" : ""}>À planifier</option>
            <option value="hors_service" ${state.filters.status === "hors_service" ? "selected" : ""}>Hors service</option>
          </select>
        </div>
        <div class="field">
          <label>Recherche</label>
          <input data-action="filter" data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Modèle, série, lieu">
        </div>
      </div>
    `;
  }

  function equipmentTable(equipment, allowDetail) {
    if (!equipment.length) return `<div class="empty">Aucun équipement trouvé.</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Équipement</th>
              <th>Immeuble</th>
              <th>Appartement</th>
              <th>Dernier service</th>
              <th>Prochain service</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${equipment.map((item) => {
              const { apartment, building } = equipmentContext(item.id);
              return `
                <tr>
                  <td><strong>${escapeHtml(item.type)}</strong><br><span class="meta">${unitKindLabel(item.unitKind)} | ${escapeHtml(item.brand)} ${escapeHtml(item.model)} - ${escapeHtml(item.serial)}</span></td>
                  <td>${escapeHtml(building?.name || "-")}</td>
                  <td>${escapeHtml(apartment?.number || "-")}</td>
                  <td>${formatDate(item.lastService)}</td>
                  <td>${formatDate(item.nextService)}</td>
                  <td>${statusBadge(item.status)}</td>
                  <td>${allowDetail ? `
                    <button class="link-button" data-action="select-equipment" data-id="${item.id}">Dossier</button>
                    ${currentUser().role !== "client" ? `<br><button class="link-button" data-action="open-modal" data-modal="equipment" data-id="${item.id}">Modifier</button>` : ""}
                  ` : ""}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function equipmentDetailView() {
    const { equipment, apartment, building, client } = equipmentContext(state.selectedEquipmentId);
    if (!equipment) return equipmentView();
    const interventions = state.interventions
      .filter((item) => item.equipmentId === equipment.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const orders = state.workOrders.filter((item) => item.equipmentId === equipment.id);
    const tickets = state.tickets.filter((item) => item.equipmentId === equipment.id);
    const activeTickets = tickets.filter((item) => item.status !== "ferme");
    const activeOrders = orders.filter((item) => !["termine", "annule"].includes(item.status));
    const attachments = equipment.attachments || [];
    const reminders = scopedReminders().filter((item) => item.equipmentId === equipment.id);
    const actionButtons = `
      <button class="ghost-button" data-action="go-back" data-fallback-view="equipements">Retour</button>
      ${currentUser().role !== "client" ? `<button class="ghost-button" data-action="open-modal" data-modal="equipment" data-id="${equipment.id}">Modifier</button>` : ""}
      ${canEditReminders() ? `<button class="ghost-button" data-action="open-modal" data-modal="reminder" data-equipment="${equipment.id}">Nouveau rappel</button>` : ""}
      ${can("tickets") ? `<button class="primary-button" data-action="open-modal" data-modal="ticket" data-equipment="${equipment.id}">Nouvelle demande</button>` : ""}
      ${canCreateWorkOrders() ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-equipment="${equipment.id}">Nouveau BT</button>` : ""}
    `;
    return appShell(`
      ${renderTopbar("Dossier équipement", `${building?.name || ""} - Appartement ${apartment?.number || ""}`, actionButtons)}
      <section class="detail-layout">
        <div class="panel">
          <div class="panel-header"><h2>${escapeHtml(equipment.type)}</h2>${statusBadge(equipment.status)}</div>
          <div class="panel-body definition">
            <div><span>Client</span><strong>${escapeHtml(client?.name || "-")}</strong></div>
            <div><span>Immeuble</span><strong>${escapeHtml(building?.name || "-")}</strong></div>
            <div><span>Appartement</span><strong>${escapeHtml(apartment?.number || "-")}</strong></div>
            <div><span>Unité</span><strong>${unitKindLabel(equipment.unitKind)}</strong></div>
            <div><span>Marque / modèle</span><strong>${escapeHtml(equipment.brand)} ${escapeHtml(equipment.model)}</strong></div>
            <div><span>Numéro de série</span><strong>${escapeHtml(equipment.serial)}</strong></div>
            <div><span>Localisation</span><strong>${escapeHtml(equipment.location)}</strong></div>
            <div><span>Installation</span><strong>${formatDate(equipment.installDate)}</strong></div>
            <div><span>Note</span><strong>${escapeHtml(equipment.notes)}</strong></div>
          </div>
        </div>
        <div class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Historique des interventions</h2></div>
            <div class="panel-body timeline">
              ${interventions.map((item) => interventionItem(item)).join("") || `<div class="empty">Aucune intervention enregistrée.</div>`}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>En cours</h2></div>
            <div class="panel-body cards-list">
              ${[
                ...activeTickets.map((ticket) => ticketItem(ticket)),
                ...activeOrders.map((order) => workOrderItem(order))
              ].join("") || `<div class="empty">Aucune demande ou intervention en cours pour cette machine.</div>`}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header">
              <h2>Rappels</h2>
              ${canEditReminders() ? `<button class="ghost-button" data-action="open-modal" data-modal="reminder" data-equipment="${equipment.id}">Ajouter</button>` : ""}
            </div>
            <div class="panel-body cards-list">
              ${reminders.map((reminder) => reminderItem(reminder, true, false)).join("") || `<div class="empty">Aucun rappel pour cette machine.</div>`}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Photos et documents</h2></div>
            <div class="panel-body cards-list">
              ${attachments.map((file) => attachmentItem(file)).join("") || `<div class="empty">Aucune photo ou document dans ce dossier machine.</div>`}
            </div>
          </div>
        </div>
      </section>
    `);
  }

  const documentsViewModule = window.ClimaParcDocumentsView.create({
    getState: () => state,
    api,
    appShell,
    renderTopbar,
    modalShell,
    currentUser,
    can,
    scopedClientDocuments,
    scopedBuildings,
    formatDate,
    escapeHtml,
    statusBadge,
    updateUiState,
    showToast
  });

  function attachmentItem(file) {
    return documentsViewModule.attachmentItem(file);
  }

  function attachmentTypeLabel(file) {
    return documentsModule.attachmentTypeLabel(file);
  }

  function isOfficeFile(type, name) {
    return documentsModule.isOfficeFile(type, name);
  }

  function dataUrlMime(dataUrl) {
    return documentsModule.dataUrlMime(dataUrl);
  }

  function inferFileType(file) {
    return documentsModule.inferFileType(file);
  }

  function findAttachment(fileId) {
    return documentsViewModule.findAttachment(fileId);
  }

  function attachmentPreviewModal(fileId) {
    return documentsViewModule.attachmentPreviewModal(fileId);
  }

  async function openAttachmentPreview(fileId) {
    return documentsViewModule.openAttachmentPreview(fileId);
  }

  async function downloadAttachment(fileId) {
    return documentsViewModule.downloadAttachment(fileId);
  }

  function interventionItem(item) {
    const type = state.interventionTypes.find((typeItem) => typeItem.id === item.typeId);
    const technician = state.users.find((user) => user.id === item.technicianId);
    const readings = Object.entries(item.readings || {}).map(([key, value]) => `${key}: ${value}`).join(" | ");
    const clickable = Boolean(item.workOrderId);
    return `
      <div class="timeline-item ${clickable ? "clickable-card" : ""}" ${clickable ? `data-action="open-intervention-workorder" data-id="${escapeHtml(item.workOrderId)}"` : ""}>
        <strong>${escapeHtml(type?.name || item.typeId)} - ${formatDate(item.date)}</strong>
        <span class="meta">${escapeHtml(technician?.name || "-")} - ${statusBadge(item.status)}</span>
        <p class="meta">${escapeHtml(item.summary)}</p>
        ${readings ? `<p class="meta">${escapeHtml(readings)}</p>` : ""}
      </div>
    `;
  }

  function alertsView() {
    const reminders = scopedReminders()
      .slice()
      .sort((a, b) => {
        const statusOrder = { due: 0, upcoming: 1, inactive: 2 };
        return (statusOrder[reminderStatus(a)] ?? 9) - (statusOrder[reminderStatus(b)] ?? 9) || (a.nextDueDate || "").localeCompare(b.nextDueDate || "");
      });
    const due = reminders.filter((reminder) => reminderIsDue(reminder));
    const upcoming = reminders.filter((reminder) => reminder.status === "active" && !reminderIsDue(reminder));
    const inactive = reminders.filter((reminder) => reminder.status === "inactive");
    return appShell(`
      ${renderTopbar("Centre d'alertes", "Rappels personnalisés liés aux équipements.", `
        ${canEditReminders() ? `<button class="primary-button" data-action="open-modal" data-modal="reminder">Nouveau rappel</button>` : ""}
        ${canEditReminders() && due.length ? `<button class="ghost-button" data-action="mark-reminders-seen">Marquer comme vu</button>` : ""}
      `)}
      <section class="stats-grid">
        <div class="stat"><span>À traiter</span><strong>${due.length}</strong></div>
        <div class="stat"><span>À venir</span><strong>${upcoming.length}</strong></div>
        <div class="stat"><span>Inactifs</span><strong>${inactive.length}</strong></div>
      </section>
      <section class="panel">
        <div class="panel-body cards-list">
          ${reminders.map((reminder) => reminderItem(reminder, true)).join("") || `<div class="empty">Aucun rappel créé.</div>`}
        </div>
      </section>
    `);
  }

  function reminderItem(reminder, expanded = false, showEquipmentLink = true) {
    const { equipment, apartment, building } = equipmentContext(reminder.equipmentId);
    const frequency = `${reminder.frequencyValue} ${reminder.frequencyUnit === "years" ? "an(s)" : "mois"}`;
    const editable = canEditReminders();
    return `
      <article class="list-item reminder-item ${reminderIsDue(reminder) ? "is-due" : ""}">
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(reminder.title)}</h3>
          <span>${reminderStatusBadge(reminder)}</span>
        </div>
        <div class="meta">${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")} - ${escapeHtml(equipment?.type || "-")}</div>
        <div class="meta">Prochaine alerte: ${formatDate(reminder.nextDueDate)} | Fréquence: ${escapeHtml(frequency)}</div>
        ${reminder.notes ? `<div class="meta">${escapeHtml(reminder.notes)}</div>` : ""}
        ${expanded ? `
          <div class="actions">
            ${showEquipmentLink ? `<button class="link-button" data-action="select-equipment" data-id="${escapeHtml(reminder.equipmentId)}">Dossier machine</button>` : ""}
            ${canCreateWorkOrders() && reminder.status === "active" && !reminder.lastWorkOrderId ? `<button class="ghost-button small-action-button" data-action="open-modal" data-modal="workorder" data-equipment="${escapeHtml(reminder.equipmentId)}" data-reminder="${escapeHtml(reminder.id)}">Créer BT</button>` : ""}
            ${editable ? `<button class="ghost-button" data-action="open-modal" data-modal="reminder" data-id="${escapeHtml(reminder.id)}">Modifier</button>` : ""}
            ${editable ? `<button class="ghost-button" data-action="reminder-status" data-id="${escapeHtml(reminder.id)}" data-status="${reminder.status === "active" ? "inactive" : "active"}">${reminder.status === "active" ? "Inactiver" : "Activer"}</button>` : ""}
            ${editable && reminderIsDue(reminder) ? `<button class="ghost-button" data-action="mark-reminder-seen" data-id="${escapeHtml(reminder.id)}">Vu</button>` : ""}
            ${editable ? `<button class="link-button danger-link" data-action="delete-reminder" data-id="${escapeHtml(reminder.id)}">Supprimer</button>` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

  function recommendationsView() {
    const items = recommendationsModule.sortItems(scopedRecommendations());
    const pending = items.filter((item) => ["a_valider", "information_demandee", "envoyee"].includes(item.recommendation.status));
    const approved = items.filter((item) => item.recommendation.status === "approuvee");
    const refused = items.filter((item) => item.recommendation.status === "refusee");
    const title = currentUser()?.role === "client" ? "Recommandations à approuver" : "Recommandations client";
    const subtitle = currentUser()?.role === "client"
      ? "Demandes envoyées par ClimaParc pour approbation."
      : "Réviser, chiffrer et envoyer les recommandations issues des formulaires terrain.";
    return appShell(`
      ${renderTopbar(title, subtitle, "")}
      <section class="stats-grid">
        <div class="stat"><span>En attente</span><strong>${pending.length}</strong></div>
        <div class="stat"><span>Approuvées</span><strong>${approved.length}</strong></div>
        <div class="stat"><span>Refusées</span><strong>${refused.length}</strong></div>
      </section>
      <section class="panel">
        <div class="panel-body cards-list">
          ${items.map((item) => recommendationCard(item)).join("") || `<div class="empty">Aucune recommandation disponible.</div>`}
        </div>
      </section>
    `);
  }

  function recommendationCard(item) {
    const { recommendation, intervention, equipment, apartment, building, order, technician } = item;
    const isClient = currentUser()?.role === "client";
    const canSeePrice = recommendationsModule.canSeePrice(currentUser(), canPortal);
    const price = recommendation.price ? `${recommendation.price} $` : "-";
    const delay = recommendation.delay || "-";
    return `
      <article class="list-item recommendation-card">
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(dataFieldLabelByValue("recommendation_type", recommendation.type))}</h3>
          ${statusBadge(recommendation.status)}
        </div>
        <div class="meta">${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")} - ${escapeHtml(equipment?.type || "Machine")} ${equipment?.serial ? `| ${escapeHtml(equipment.serial)}` : ""}</div>
        <div class="definition compact">
          ${canSeePrice ? `<div><span>Prix</span><strong>${escapeHtml(price)}</strong></div><div><span>Délai</span><strong>${escapeHtml(delay)}</strong></div>` : ""}
          <div><span>Priorité</span><strong>${escapeHtml(statusText(recommendation.priority) || "-")}</strong></div>
          <div><span>Pièce</span><strong>${escapeHtml(recommendation.part || "-")}</strong></div>
          <div><span>Temps prévu</span><strong>${escapeHtml(recommendation.time || "-")}</strong></div>
          <div><span>Origine</span><strong>${escapeHtml(order?.number || "-")}</strong></div>
        </div>
        <div class="meta">${escapeHtml(recommendation.description || "")}</div>
        ${recommendationChat(recommendation)}
        ${!isClient ? `<div class="meta">Technicien: ${escapeHtml(technician?.name || "-")} | Intervention: ${formatDate(intervention.date)}</div>` : ""}
        <div class="actions">
          <button class="link-button" data-action="select-equipment" data-id="${escapeHtml(equipment?.id || "")}">Dossier machine</button>
          ${isClient ? clientRecommendationActions(intervention.id, recommendation.status) : internalRecommendationActions(intervention.id, recommendation)}
        </div>
      </article>
    `;
  }

  function recommendationChat(recommendation) {
    const messages = recommendation.messages || [];
    if (!messages.length) return "";
    return `
      <div class="recommendation-chat">
        <strong>Conversation</strong>
        ${messages.map((message) => `
          <div class="chat-message ${message.authorRole === "client" ? "client" : "internal"}">
            <div><span>${escapeHtml(message.authorName || (message.authorRole === "client" ? "Client" : "ClimaParc"))}</span><small>${formatDate(message.createdAt)}</small></div>
            <p>${escapeHtml(message.text)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function addRecommendationMessage(recommendation, authorRole, text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    recommendation.messages = recommendation.messages || [];
    const last = recommendation.messages[recommendation.messages.length - 1];
    if (last?.authorRole === authorRole && last?.text === clean) return;
    recommendation.messages.push({
      id: uid("msg"),
      authorRole,
      authorName: authorRole === "client" ? currentUser()?.name || "Client" : currentUser()?.name || "ClimaParc",
      text: clean,
      createdAt: today()
    });
  }

  async function saveInterventionChange(intervention, uiPatch, successToast) {
    try {
      await saveDomainItemNow(api.saveIntervention, intervention, uiPatch, successToast);
    } catch (error) {
      showToast(error.message || "Intervention non sauvegardée.");
    }
  }

  function internalRecommendationActions(interventionId, recommendation) {
    return `
      <button class="ghost-button" data-action="open-modal" data-modal="recommendationReview" data-id="${escapeHtml(interventionId)}">Réviser</button>
      ${recommendation.status === "information_demandee" ? `<button class="primary-button" data-action="open-modal" data-modal="recommendationReply" data-id="${escapeHtml(interventionId)}">Répondre au client</button>` : ""}
      ${["a_valider", "information_demandee"].includes(recommendation.status) ? `<button class="primary-button" data-action="send-recommendation" data-id="${escapeHtml(interventionId)}">Envoyer au client</button>` : ""}
      ${recommendation.status === "approuvee" && !recommendation.workOrderId ? `<button class="ghost-button" data-action="create-bt-from-recommendation" data-id="${escapeHtml(interventionId)}">Créer un BT</button>` : ""}
      ${recommendation.workOrderId ? `<span class="meta">BT créé</span>` : ""}
    `;
  }

  function clientRecommendationActions(interventionId, status) {
    if (status !== "envoyee") return "";
    if (!recommendationsModule.canApprove(currentUser(), canPortal)) return `<button class="ghost-button" data-action="open-modal" data-modal="clientRecommendationMessage" data-id="${escapeHtml(interventionId)}" data-status="information_demandee">Demander plus d'informations</button>`;
    return `
      <button class="primary-button" data-action="client-recommendation" data-status="approuvee" data-id="${escapeHtml(interventionId)}">Approuver</button>
      <button class="ghost-button" data-action="open-modal" data-modal="clientRecommendationMessage" data-id="${escapeHtml(interventionId)}" data-status="information_demandee">Demander plus d'informations</button>
      <button class="danger-button" data-action="open-modal" data-modal="clientRecommendationMessage" data-id="${escapeHtml(interventionId)}" data-status="refusee">Refuser</button>
    `;
  }

  function documentsView() {
    return documentsViewModule.documentsView();
  }

  function buildingDocumentsModal(buildingId) {
    return documentsViewModule.buildingDocumentsModal(buildingId);
  }

  function ticketsView() {
    const tickets = scopedTickets();
    return appShell(`
      ${renderTopbar("Demandes des clients", "Demandes clients, priorités et suivi opérationnel.", `<button class="primary-button" data-action="open-modal" data-modal="ticket">Nouvelle demande</button>`)}
      <section class="panel">
        <div class="panel-body cards-list">${tickets.map((ticket) => ticketItem(ticket, true)).join("") || `<div class="empty">Aucune demande client.</div>`}</div>
      </section>
    `);
  }

  function ticketItem(ticket, expanded = false, dashboardLink = false) {
    const { equipment, apartment, building } = equipmentContext(ticket.equipmentId);
    const serviceType = state.serviceTypes.find((item) => item.id === ticket.serviceTypeId);
    const attachments = equipment?.attachments || [];
    const actions = expanded && canCreateWorkOrders()
      ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-ticket="${ticket.id}" data-equipment="${ticket.equipmentId}">Créer BT</button>`
      : "";
    return `
      <article class="list-item ${dashboardLink ? "clickable-card" : ""}" ${dashboardLink ? `data-action="dashboard-ticket" data-id="${escapeHtml(ticket.id)}"` : ""}>
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(ticket.number || ticket.id)} - ${escapeHtml(ticket.title)}</h3>
          <span>${statusBadge(ticket.priority)} ${statusBadge(ticket.status)}</span>
        </div>
        <div class="meta">Type: ${escapeHtml(serviceType?.name || "-")}</div>
        <div class="meta">${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")} - ${escapeHtml(equipment?.type || "-")}</div>
        <div class="meta">${escapeHtml(ticket.description)}</div>
        ${expanded ? `
          <div class="mini-list">
            <strong>Photos et documents de la machine</strong>
            ${attachments.map((file) => compactAttachmentItem(file)).join("") || `<div class="meta">Aucun fichier lié à cette machine.</div>`}
          </div>
        ` : ""}
        <div class="actions">${expanded ? `<button class="ghost-button" data-action="open-modal" data-modal="ticket" data-id="${ticket.id}">Modifier</button>` : ""}${actions}${expanded ? ticketStatusButtons(ticket) : ""}</div>
      </article>
    `;
  }

  function compactAttachmentItem(file) {
    return documentsViewModule.compactAttachmentItem(file);
  }

  function ticketStatusButtons(ticket) {
    if (currentUser()?.role === "client") return "";
    return `
      <button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="en_cours">En cours</button>
      <button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="ferme">Fermer</button>
    `;
  }

  function workOrdersView() {
    const orders = filteredWorkOrders();
    return appShell(`
      ${renderTopbar("Bons de travail", "Planification, assignation technicien et exécution des checklists.", canCreateWorkOrders() ? `<button class="primary-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : "")}
      <section class="panel">
        <div class="panel-body">
          ${workOrderFiltersBlock()}
        </div>
      </section>
      <section class="panel">
        <div class="panel-body cards-list">${orders.map((order) => workOrderItem(order, true)).join("") || `<div class="empty">Aucun bon de travail.</div>`}</div>
      </section>
    `);
  }

  function filteredWorkOrders() {
    const filters = state.workOrderFilters || seed.workOrderFilters;
    return scopedWorkOrders().filter((order) => {
      const { equipment, apartment, building } = workOrderContext(order);
      const type = state.interventionTypes.find((item) => item.id === order.typeId);
      const assignedIds = new Set([order.technicianId, ...(order.assignedTechnicianIds || [])].filter(Boolean));
      const haystack = searchText(order.number, type?.name, order.status, statusText(order.status), order.notes, building?.name, building?.address, apartment?.number, equipment?.type, equipment?.brand, equipment?.model, equipment?.serial, order.scheduledDate, formatDate(order.scheduledDate));
      return (
        (filters.buildingId === "all" || building?.id === filters.buildingId || order.buildingId === filters.buildingId) &&
        (filters.technicianId === "all" || assignedIds.has(filters.technicianId)) &&
        (filters.status === "all" || order.status === filters.status) &&
        (!filters.startDate || order.scheduledDate >= filters.startDate) &&
        (!filters.endDate || order.scheduledDate <= filters.endDate) &&
        (!filters.search || haystack.includes(normalizeSearch(filters.search)))
      );
    });
  }

  function workOrderFiltersBlock() {
    const filters = state.workOrderFilters || seed.workOrderFilters;
    return `
      <div class="filters">
        <div class="field">
          <label>Immeuble</label>
          <select data-action="workorder-filter" data-filter="buildingId">
            <option value="all">Tous</option>
            ${scopedBuildings().map((building) => `<option value="${building.id}" ${filters.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Technicien</label>
          <select data-action="workorder-filter" data-filter="technicianId">
            <option value="all">Tous</option>
            ${state.users.filter((user) => user.role === "technicien").map((user) => `<option value="${user.id}" ${filters.technicianId === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Statut</label>
          <select data-action="workorder-filter" data-filter="status">
            <option value="all">Tous</option>
            <option value="planifie" ${filters.status === "planifie" ? "selected" : ""}>Planifié</option>
            <option value="en_cours" ${filters.status === "en_cours" ? "selected" : ""}>En cours</option>
            <option value="termine" ${filters.status === "termine" ? "selected" : ""}>Terminé</option>
            <option value="annule" ${filters.status === "annule" ? "selected" : ""}>Annulé</option>
          </select>
        </div>
        <div class="field"><label>Début</label><input type="date" data-action="workorder-filter" data-filter="startDate" value="${escapeHtml(filters.startDate || "")}"></div>
        <div class="field"><label>Fin</label><input type="date" data-action="workorder-filter" data-filter="endDate" value="${escapeHtml(filters.endDate || "")}"></div>
        <div class="field"><label>Recherche</label><input data-action="workorder-filter" data-filter="search" value="${escapeHtml(filters.search || "")}" placeholder="BT, machine, série, adresse"></div>
      </div>
    `;
  }

  function workOrderItem(order, expanded = false, dashboardLink = false) {
    const { equipment, apartment, building } = workOrderContext(order);
    const type = state.interventionTypes.find((item) => item.id === order.typeId);
    const assignedTechs = (order.assignedTechnicianIds || []).map((id) => state.users.find((user) => user.id === id)?.name).filter(Boolean).join(", ");
    const progress = workOrderProgress(order);
    const scopeLabel = order.buildingId ? "Bloc complet" : `Apt ${apartment?.number || "-"} - ${equipment?.type || "-"}`;
    const actionButtons = workOrderActionButtons(order, expanded);
    return `
      <article class="list-item ${dashboardLink ? "clickable-card" : ""}" ${dashboardLink ? `data-action="dashboard-workorder" data-id="${escapeHtml(order.id)}"` : ""}>
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(order.number)} - ${escapeHtml(type?.name || "")}</h3>
          ${statusBadge(order.status)}
        </div>
        <div class="meta">RDV: ${formatDate(order.scheduledDate)}</div>
        ${assignedTechs ? `<div class="meta">Techniciens assignés: ${escapeHtml(assignedTechs)}</div>` : ""}
        <div class="meta">${escapeHtml(building?.name || "-")} - ${escapeHtml(scopeLabel)}</div>
        <div class="progress-line"><span style="width:${progress.percent}%"></span></div>
        <div class="meta">${progress.doneApartments}/${progress.totalApartments} appartement${progress.totalApartments > 1 ? "s" : ""} realisé${progress.doneApartments > 1 ? "s" : ""} | ${progress.machines} machine${progress.machines > 1 ? "s" : ""} analysée${progress.machines > 1 ? "s" : ""}</div>
        <div class="meta">${escapeHtml(order.notes || "")}</div>
        ${actionButtons}
      </article>
    `;
  }

  function workOrderActionButtons(order, expanded) {
    if (!expanded) return "";
    if (currentUser()?.role === "client") {
      return `<div class="actions"><button class="ghost-button" data-action="execute-workorder" data-id="${escapeHtml(order.id)}">Consulter</button></div>`;
    }
    return `
      <div class="actions">
        <button class="primary-button" data-action="execute-workorder" data-id="${escapeHtml(order.id)}">Exécuter</button>
        ${order.equipmentId ? `<button class="ghost-button" data-action="open-checklist" data-id="${escapeHtml(order.id)}">Checklist</button>` : ""}
        ${can("workorders") ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${escapeHtml(order.id)}">Modifier</button><button class="ghost-button" data-action="order-status" data-id="${escapeHtml(order.id)}" data-status="termine">Terminer</button>` : ""}
      </div>
    `;
  }

  function workOrderExecutionView() {
    const order = state.workOrders.find((item) => item.id === state.selectedWorkOrderId);
    if (!order) return workOrdersView();
    const { building } = workOrderContext(order);
    const type = state.interventionTypes.find((item) => item.id === order.typeId);
    const template = formTemplateForOrder(order);
    const progress = workOrderProgress(order);
    const apartments = workOrderApartments(order);
    const selectedApartment = apartments.find((item) => item.id === state.selectedExecutionApartmentId) || apartments[0];
    const apartmentInterventions = interventionsForOrder(order.id).filter((item) => {
      const equipment = state.equipment.find((eq) => eq.id === item.equipmentId);
      return (item.apartmentId || equipment?.apartmentId) === selectedApartment?.id;
    });
    const apartmentMachines = selectedApartment ? equipmentForApartment(selectedApartment.id) : [];
    const canEditExecution = currentUser()?.role !== "client" && (can("workorders") || can("interventions"));
    return appShell(`
      ${renderTopbar(`Execution ${order.number}`, `${building?.name || "-"} - ${type?.name || ""}`, `
        <button class="ghost-button" data-action="go-back" data-fallback-view="bons">Retour</button>
        ${canEditExecution ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${order.id}">Changer le formulaire</button>` : ""}
        ${canEditExecution ? `<button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button>` : ""}
      `)}
      <section class="stats-grid">
        <div class="stat"><span>RDV</span><strong>${formatDate(order.scheduledDate)}</strong></div>
        <div class="stat"><span>Progression</span><strong>${progress.percent}%</strong></div>
        <div class="stat"><span>Appartements realises</span><strong>${progress.doneApartments}/${progress.totalApartments}</strong></div>
        <div class="stat"><span>Machines analysees</span><strong>${progress.machines}</strong></div>
        ${canEditExecution ? `<div class="stat"><span>Formulaire</span><strong>${escapeHtml(template?.name || "-")}</strong></div>` : ""}
      </section>
      <section class="progress-panel">
        <div class="progress-line large"><span style="width:${progress.percent}%"></span></div>
      </section>
      <section class="execution-layout">
        <div class="panel">
          <div class="panel-header"><h2>Appartements du bloc</h2></div>
          <div class="panel-body cards-list">
            ${apartments.map((apartment) => executionApartmentButton(order, apartment, selectedApartment?.id)).join("") || `<div class="empty">Aucun appartement dans ce BT.</div>`}
          </div>
        </div>
        <div class="stack">
          <div class="panel">
            <div class="panel-header">
              <h2>Appartement ${escapeHtml(selectedApartment?.number || "-")}</h2>
              ${canEditExecution ? `<div class="actions">
                <button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-unit-kind="interieure">+ Unité intérieure</button>
                <button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-unit-kind="exterieure">+ Unité extérieure</button>
                <button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button>
              </div>` : ""}
            </div>
            <div class="panel-body cards-list">
              ${apartmentMachines.map((machine) => {
                const intervention = apartmentInterventions.find((item) => item.equipmentId === machine.id);
                return `
                  <article class="list-item">
                    <div class="actions" style="justify-content:space-between">
                      <h3>${escapeHtml(machine.type)}</h3>
                      ${intervention ? statusBadge("terminee") : statusBadge("planifie")}
                    </div>
                    <div class="meta">${escapeHtml(machine.brand)} ${escapeHtml(machine.model)} - ${escapeHtml(machine.location || "-")}</div>
                    ${canEditExecution ? `<div class="actions">
                      ${canCreateWorkOrders() ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-equipment="${machine.id}">Nouveau BT</button>` : ""}
                      <button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-equipment="${machine.id}">${intervention ? "Modifier le formulaire" : "Remplir le formulaire"}</button>
                    </div>` : ""}
                  </article>
                `;
              }).join("") || `<div class="empty">Aucune machine encore cadastrée pour cet appartement.</div>`}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Informations collectées</h2></div>
            <div class="panel-body cards-list">
              ${apartmentInterventions.map((intervention) => fieldResponseCard(intervention)).join("") || `<div class="empty">Aucune information saisie pour cet appartement.</div>`}
            </div>
          </div>
        </div>
      </section>
    `);
  }

  function executionApartmentButton(order, apartment, selectedId) {
    const interventions = interventionsForOrder(order.id).filter((item) => {
      const equipment = state.equipment.find((eq) => eq.id === item.equipmentId);
      return (item.apartmentId || equipment?.apartmentId) === apartment.id;
    });
    return `
      <button class="mini-row ${selectedId === apartment.id ? "active" : ""}" data-action="select-execution-apartment" data-id="${apartment.id}">
        <strong>Appartement ${escapeHtml(apartment.number)}</strong>
        <span>${interventions.length ? `${interventions.length} machine(s) analysee(s)` : "A faire"}</span>
      </button>
    `;
  }

  function fieldResponseCard(intervention) {
    const equipment = state.equipment.find((item) => item.id === intervention.equipmentId);
    const responses = Object.entries(intervention.formResponses || {}).map(([key, value]) => {
      const display = Array.isArray(value) ? value.join(", ") : value;
      return `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(display || "-")}</strong></div>`;
    }).join("");
    return `
      <article class="list-item">
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(equipment?.type || "Machine")}</h3>
          <span>${statusBadge(intervention.activityStatus || intervention.status)} ${statusBadge(intervention.machineStatus || equipment?.status)}</span>
        </div>
        <div class="meta">${intervention.unitKind === "exterieure" ? "Unité extérieure" : "Unité intérieure"} | Statut machine observé: ${statusText(intervention.machineStatus || equipment?.status)}</div>
        <div class="definition compact">${responses || `<div><span>Formulaire</span><strong>Aucune reponse</strong></div>`}</div>
        ${intervention.recommendation?.type ? `
          <div class="definition compact">
            <div><span>Recommandation</span><strong>${escapeHtml(dataFieldLabelByValue("recommendation_type", intervention.recommendation.type))}</strong></div>
            <div><span>Priorité</span><strong>${escapeHtml(statusText(intervention.recommendation.priority) || "-")}</strong></div>
            <div><span>Pièce nécessaire</span><strong>${escapeHtml(intervention.recommendation.part || "-")}</strong></div>
            <div><span>Temps prévu</span><strong>${escapeHtml(intervention.recommendation.time || "-")}</strong></div>
            <div><span>Statut</span><strong>${escapeHtml(statusText(intervention.recommendation.status || "a_valider"))}</strong></div>
          </div>
          <div class="meta">${escapeHtml(intervention.recommendation.description || "")}</div>
        ` : ""}
        ${intervention.attachments?.length ? `<div class="mini-list">${intervention.attachments.map((file) => {
          const order = state.workOrders.find((item) => item.id === file.workOrderId || item.id === intervention.workOrderId);
          return `<div class="meta">Pièce jointe: ${escapeHtml(file.name)} | Origine: ${escapeHtml(order?.number || "-")}</div>`;
        }).join("")}</div>` : ""}
        <div class="meta">${escapeHtml(intervention.summary || "")}</div>
      </article>
    `;
  }

  const reportModule = window.ClimaParcReports.create({
    getState: () => state,
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
  });

  function reportsView() {
    return reportModule.reportsView();
  }

  function activityStatusOptions() {
    return reportModule.activityStatusOptions();
  }

  function recommendationTypeOptions() {
    return reportModule.recommendationTypeOptions();
  }

  function dataFieldOptionsById(id) {
    return reportModule.dataFieldOptionsById(id);
  }

  function dataFieldLabelByValue(id, value) {
    return reportModule.dataFieldLabelByValue(id, value);
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

  function settingsView() {
    return appShell(`
      ${renderTopbar("Paramètres", "Types de demandes, checklists et droits d'accès.", `
        <button class="primary-button" data-action="open-modal" data-modal="dataField">Champ de données</button>
        <button class="primary-button" data-action="open-modal" data-modal="serviceType">Type de demande</button>
        <button class="ghost-button" data-action="open-modal" data-modal="interventionType">Type de checklist</button>
        <button class="ghost-button" data-action="open-modal" data-modal="formTemplate">Formulaire terrain</button>
      `)}
      <section class="grid">
        <div class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Champs de données</h2></div>
            <div class="panel-body cards-list">
              ${dataFieldGroups().map(([group, fields]) => `
                <div class="data-field-group">
                  <div class="data-field-group-title">${escapeHtml(group)} <span>${fields.length}</span></div>
                  ${fields.map((field) => `
                    <article class="list-item data-field-item">
                      <div>
                        <h3>${escapeHtml(field.name)}</h3>
                        <div class="meta">${dataFieldTypeLabel(field.type)} | ${field.options.length} option${field.options.length > 1 ? "s" : ""} | ${field.appliesTo.map((item) => item === "activity" ? "Activité" : "Machine").join(", ")}</div>
                      </div>
                      <div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="dataField" data-id="${field.id}">Modifier</button></div>
                    </article>
                  `).join("")}
                </div>
              `).join("")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Types de demandes clients</h2></div>
            <div class="panel-body cards-list">
              ${state.serviceTypes.map((type) => {
                const linked = state.interventionTypes.find((item) => item.id === type.linkedInterventionTypeId);
                return `
                  <article class="list-item">
                    <h3>${escapeHtml(type.name)}</h3>
                    <div class="meta">Priorité par défaut: ${statusText(type.defaultPriority)} | Checklist liée: ${escapeHtml(linked?.name || "-")}</div>
                    <div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="serviceType" data-id="${type.id}">Modifier</button></div>
                  </article>
                `;
              }).join("")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Types de checklist / intervention</h2></div>
            <div class="panel-body cards-list">
              ${state.interventionTypes.map((type) => `
                <article class="list-item">
                  <h3>${escapeHtml(type.name)}</h3>
                  <div class="meta">Durée estimée: ${type.defaultDuration} min | ${type.checklist.length} étapes</div>
                  <div class="mini-list">${type.checklist.map((item) => `<div class="meta">- ${escapeHtml(item)}</div>`).join("")}</div>
                  <div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="interventionType" data-id="${type.id}">Modifier</button></div>
                </article>
              `).join("")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Formulaires terrain</h2></div>
            <div class="panel-body cards-list">
              ${state.formTemplates.map((template) => `
                <article class="list-item">
                  <h3>${escapeHtml(template.name)}</h3>
                  <div class="meta">${template.fields.length} question${template.fields.length > 1 ? "s" : ""}</div>
                  <div class="mini-list">${template.fields.slice(0, 4).map((field) => `<div class="meta">- ${escapeHtml(field.label)} (${fieldTypeLabel(field.type)})</div>`).join("")}</div>
                  <div class="actions">
                    <button class="ghost-button" data-action="open-modal" data-modal="formTemplate" data-id="${template.id}">Modifier</button>
                    <button class="ghost-button" data-action="duplicate-form-template" data-id="${template.id}">Dupliquer</button>
                  </div>
                </article>
              `).join("")}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Rôles et droits</h2></div>
          <div class="panel-body cards-list">
            ${state.roleDefinitions.map((role) => `
              <article class="list-item">
                <h3>${escapeHtml(role.name)}</h3>
                <div class="meta">${role.rights.includes("all") ? "Tous les droits" : role.rights.map((right) => rightsCatalog().find((item) => item[0] === right)?.[1] || right).join(", ")}</div>
                <div class="actions"><button class="ghost-button" data-action="open-modal" data-modal="role" data-id="${role.id}">Modifier</button></div>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
    `);
  }

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
      text: "Texte",
      long: "Texte long",
      single: "Option unique",
      multiple: "Options multiples",
      number: "Numérique",
      date: "Date",
      phone: "Téléphone"
    }[type] || type;
  }

  function renderModal() {
    const modal = state.modal;
    if (modal.type === "ticket") return ticketModal(modal);
    if (modal.type === "workorder") return workOrderModal(modal);
    if (modal.type === "building") return buildingModal(modal);
    if (modal.type === "apartment") return apartmentModal(modal);
    if (modal.type === "equipment") return equipmentModal(modal);
    if (modal.type === "reminder") return reminderModal(modal);
    if (modal.type === "user") return userModal(modal);
    if (modal.type === "serviceType") return serviceTypeModal(modal);
    if (modal.type === "dataField") return dataFieldModal(modal);
    if (modal.type === "interventionType") return interventionTypeModal(modal);
    if (modal.type === "formTemplate") return formTemplateModal(modal);
    if (modal.type === "role") return roleModal(modal);
    if (modal.type === "signup") return signupModal();
    if (modal.type === "forgotPassword") return forgotPasswordModal();
    if (modal.type === "resetPassword") return resetPasswordModal();
    if (modal.type === "checklist") return checklistModal(modal.orderId);
    if (modal.type === "fieldIntervention") return fieldInterventionModal(modal);
    if (modal.type === "recommendationReview") return recommendationReviewModal(modal.id);
    if (modal.type === "recommendationReply") return recommendationReplyModal(modal.id);
    if (modal.type === "clientRecommendationMessage") return clientRecommendationMessageModal(modal.id, modal.decisionStatus);
    if (modal.type === "buildingDocuments") return buildingDocumentsModal(modal.buildingId);
    if (modal.type === "clientDocument") return clientDocumentModal(modal.id, modal);
    if (modal.type === "attachmentPreview") return attachmentPreviewModal(modal.fileId);
    return "";
  }

  function modalShell(title, body, className = "") {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal-card ${className}" data-modal-card>
          <div class="panel-header">
            <h2>${title}</h2>
            <button class="icon-button" data-action="close-modal" aria-label="Fermer">X</button>
          </div>
          <div class="panel-body">${body}</div>
        </section>
      </div>
    `;
  }

  function signupModal() {
    return modalShell("Créer un compte", `
      <form class="form-grid" data-form="signup">
        <div class="field"><label>Entreprise / gestionnaire</label><input name="companyName" required autocomplete="organization"></div>
        <div class="split">
          <div class="field"><label>Nom complet</label><input name="name" required autocomplete="name"></div>
          <div class="field"><label>Téléphone</label>${phoneField("phone", "")}</div>
        </div>
        <div class="field"><label>Poste</label><input name="phonePoste" inputmode="numeric" placeholder="Ex.: 1234"></div>
        <div class="field"><label>Courriel</label><input name="email" type="email" required autocomplete="email"></div>
        <div class="split">
          <div class="field"><label>Mot de passe</label><input name="password" type="password" required autocomplete="new-password" minlength="8"></div>
          <div class="field"><label>Confirmer le mot de passe</label><input name="confirmPassword" type="password" required autocomplete="new-password" minlength="8"></div>
        </div>
        <button class="primary-button" type="submit">Créer mon compte</button>
      </form>
    `);
  }

  function forgotPasswordModal() {
    return modalShell("Mot de passe oublié", `
      <form class="form-grid" data-form="forgotPassword">
        <p class="meta">Entrez votre courriel. Si un compte existe, une demande de réinitialisation sera enregistrée.</p>
        <div class="field"><label>Courriel</label><input name="email" type="email" required autocomplete="email"></div>
        <button class="primary-button" type="submit">Envoyer la demande</button>
      </form>
    `);
  }

  function resetPasswordModal() {
    return modalShell("Nouveau mot de passe", `
      <form class="form-grid" data-form="resetPassword">
        <p class="meta">Choisissez un nouveau mot de passe pour votre compte.</p>
        <div class="field"><label>Nouveau mot de passe</label><input name="password" type="password" required autocomplete="new-password" minlength="8"></div>
        <div class="field"><label>Confirmer le mot de passe</label><input name="confirmPassword" type="password" required autocomplete="new-password" minlength="8"></div>
        <button class="primary-button" type="submit">Réinitialiser le mot de passe</button>
      </form>
    `);
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
          ${apartment.id && can("lieux") && currentUser().role !== "client" ? `<button class="danger-button" type="button" data-action="delete-apartment" data-id="${escapeHtml(apartment.id)}">Supprimer</button>` : ""}
        </div>
      </form>
    `);
  }

  function ticketModal(modal) {
    const ticket = state.tickets.find((item) => item.id === modal.id) || {};
    const equipmentOptions = scopedEquipment().map((item) => {
      const { apartment, building } = equipmentContext(item.id);
      const selectedEquipmentId = ticket.equipmentId || modal.equipmentId;
      return `<option value="${item.id}" ${selectedEquipmentId === item.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment?.number || "")} - ${escapeHtml(item.type)}</option>`;
    }).join("");
    const serviceOptions = state.serviceTypes.map((type) => `<option value="${type.id}" ${ticket.serviceTypeId === type.id ? "selected" : ""}>${escapeHtml(type.name)}</option>`).join("");
    return modalShell(ticket.id ? "Modifier la demande client" : "Nouvelle demande client", `
      <form class="form-grid" data-form="ticket">
        <input type="hidden" name="id" value="${escapeHtml(ticket.id || "")}">
        ${ticket.id ? `<div class="field"><label>Numéro de demande</label><input value="${escapeHtml(ticket.number || ticket.id)}" readonly></div>` : ""}
        <div class="field"><label>Équipement</label><select name="equipmentId" required>${equipmentOptions}</select></div>
        <div class="field"><label>Type de demande</label><select name="serviceTypeId">${serviceOptions}</select></div>
        <div class="split">
          <div class="field"><label>Titre</label><input name="title" value="${escapeHtml(ticket.title || "")}" required placeholder="Ex.: Bruit anormal"></div>
          <div class="field"><label>Priorité</label><select name="priority"><option value="normale" ${ticket.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${ticket.priority === "urgente" ? "selected" : ""}>Urgente</option><option value="basse" ${ticket.priority === "basse" ? "selected" : ""}>Basse</option></select></div>
        </div>
        <div class="field"><label>Statut</label><select name="status"><option value="ouvert" ${ticket.status === "ouvert" ? "selected" : ""}>Ouvert</option><option value="en_cours" ${ticket.status === "en_cours" ? "selected" : ""}>En cours</option><option value="ferme" ${ticket.status === "ferme" ? "selected" : ""}>Fermé</option></select></div>
        <div class="field"><label>Description</label><textarea name="description" required>${escapeHtml(ticket.description || "")}</textarea></div>
        <button class="primary-button" type="submit">${ticket.id ? "Enregistrer" : "Créer la demande"}</button>
      </form>
    `);
  }

  function workOrderModal(modal) {
    const order = state.workOrders.find((item) => item.id === modal.id) || {};
    const selectedScope = order.scope || (order.buildingId || !modal.equipmentId ? "building" : "equipment");
    const selectedBuildingId = order.buildingId || equipmentContext(modal.equipmentId)?.building?.id || scopedBuildings()[0]?.id || "";
    const buildingOptions = scopedBuildings().map((building) => `<option value="${building.id}" ${selectedBuildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("");
    const equipmentOptions = scopedEquipment().map((item) => {
      const { apartment, building } = equipmentContext(item.id);
      const selectedEquipmentId = order.equipmentId || modal.equipmentId;
      return `<option value="${item.id}" ${selectedEquipmentId === item.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment?.number || "")} - ${escapeHtml(item.type)}</option>`;
    }).join("");
    const typeOptions = state.interventionTypes.map((type) => `<option value="${type.id}" ${order.typeId === type.id ? "selected" : ""}>${escapeHtml(type.name)}</option>`).join("");
    const formOptions = state.formTemplates.map((template) => `<option value="${template.id}" ${order.formTemplateId === template.id ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join("");
    const assignedIds = new Set([...(order.assignedTechnicianIds || []), order.technicianId].filter(Boolean));
    const technicianChecks = state.users.filter((user) => user.role === "technicien").map((user) => `
      <label><input type="checkbox" name="assignedTechnicianIds" value="${escapeHtml(user.id)}" ${assignedIds.has(user.id) ? "checked" : ""}> ${escapeHtml(user.name)}</label>
    `).join("") || `<span class="meta">Aucun technicien créé.</span>`;
    return modalShell(order.id ? "Modifier le bon de travail" : "Nouveau bon de travail", `
      <form class="form-grid" data-form="workorder">
        <input type="hidden" name="id" value="${escapeHtml(order.id || "")}">
        <input type="hidden" name="ticketId" value="${escapeHtml(modal.ticketId || order.ticketId || "")}">
        <input type="hidden" name="sourceReminderId" value="${escapeHtml(modal.reminderId || order.sourceReminderId || "")}">
        <div class="split">
          <div class="field"><label>Portee du BT</label><select name="scope"><option value="building" ${selectedScope === "building" ? "selected" : ""}>Bloc complet / immeuble</option><option value="equipment" ${selectedScope === "equipment" ? "selected" : ""}>Machine precise</option></select></div>
          <div class="field"><label>Formulaire terrain</label><select name="formTemplateId">${formOptions}</select></div>
        </div>
        <div class="split">
          <div class="field"><label>Immeuble</label><select name="buildingId"><option value="">-</option>${buildingOptions}</select></div>
          <div class="field"><label>Equipement</label><select name="equipmentId"><option value="">-</option>${equipmentOptions}</select></div>
        </div>
        <div class="split">
          <div class="field"><label>Type d'intervention</label><select name="typeId">${typeOptions}</select></div>
          <div class="field"><label>Techniciens assignés</label><div class="choice-list">${technicianChecks}</div></div>
        </div>
        <div class="split">
          <div class="field"><label>Date du RDV</label><input name="scheduledDate" type="date" value="${escapeHtml(order.scheduledDate || today())}" required></div>
          <div class="field"><label>Statut</label><select name="status"><option value="planifie" ${order.status === "planifie" ? "selected" : ""}>Planifié</option><option value="en_cours" ${order.status === "en_cours" ? "selected" : ""}>En cours</option><option value="termine" ${order.status === "termine" ? "selected" : ""}>Terminé</option><option value="annule" ${order.status === "annule" ? "selected" : ""}>Annulé</option></select></div>
        </div>
        <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(order.notes || "")}</textarea></div>
        <button class="primary-button" type="submit">${order.id ? "Enregistrer" : "Créer le BT"}</button>
      </form>
    `);
  }

  function equipmentModal(modal) {
    const equipment = state.equipment.find((item) => item.id === modal.id) || { apartmentId: modal.apartmentId };
    const equipmentFields = normalizeActivityFields({});
    const statusOptions = dataFieldOptionsForSelect(equipmentFields.status);
    const apartmentOptions = scopedApartments().map((apartment) => {
      const building = buildingForApartment(apartment.id);
      return `<option value="${apartment.id}" ${equipment.apartmentId === apartment.id ? "selected" : ""}>${escapeHtml(building?.name || "")} - Apt ${escapeHtml(apartment.number)}</option>`;
    }).join("");
    return modalShell(equipment.id ? "Modifier la machine" : "Nouvel équipement", `
      <form class="form-grid" data-form="equipment">
        <input type="hidden" name="id" value="${escapeHtml(equipment.id || "")}">
        <div class="field"><label>Appartement</label><select name="apartmentId">${apartmentOptions}</select></div>
        <div class="split">
          <div class="field combo-field"><label>Type</label>${comboInput("type", equipment.type || "", activityOptions("type", equipmentFields.type), true)}</div>
          <div class="field combo-field"><label>Localisation</label>${comboInput("location", equipment.location || "", activityOptions("location", equipmentFields.location), true)}</div>
        </div>
        <div class="split">
          <div class="field combo-field"><label>Marque</label>${comboInput("brand", equipment.brand || "", activityOptions("brand", equipmentFields.brand), true)}</div>
          <div class="field combo-field"><label>Modèle</label>${comboInput("model", equipment.model || "", activityOptions("model", equipmentFields.model), true)}</div>
        </div>
        <div class="split">
          <div class="field"><label>Numéro de série</label><input name="serial" value="${escapeHtml(equipment.serial || "")}" required></div>
          <div class="field"><label>Date d'installation</label><input name="installDate" type="date" value="${escapeHtml(equipment.installDate || today())}"></div>
        </div>
        <div class="split">
          <div class="field"><label>Dernier service</label><input name="lastService" type="date" value="${escapeHtml(equipment.lastService || "")}"></div>
          <div class="field"><label>Prochain service</label><input name="nextService" type="date" value="${escapeHtml(equipment.nextService || "")}"></div>
        </div>
        <div class="field"><label>Statut</label><select name="status">${statusOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${equipment.status === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
        <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(equipment.notes || "")}</textarea></div>
        <button class="primary-button" type="submit">${equipment.id ? "Enregistrer" : "Ajouter l'équipement"}</button>
      </form>
    `);
  }

  function reminderModal(modal) {
    const reminder = state.reminders.find((item) => item.id === modal.id) || {
      equipmentId: modal.equipmentId || "",
      title: "Entretien préventif",
      frequencyValue: 1,
      frequencyUnit: "years",
      startDate: today(),
      nextDueDate: "",
      status: "active",
      notes: ""
    };
    const nextDueDate = reminder.nextDueDate || addDateInterval(reminder.startDate || today(), reminder.frequencyValue || 1, reminder.frequencyUnit || "years");
    const selectedEquipmentIds = new Set([reminder.equipmentId || modal.equipmentId].filter(Boolean));
    const buildingOptions = scopedBuildings().map((building) => `<option value="${building.id}" ${modal.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("");
    const equipmentRows = scopedEquipment().map((item) => {
      const { apartment, building } = equipmentContext(item.id);
      return `
        <label class="equipment-check-row">
          <input type="${reminder.id ? "radio" : "checkbox"}" name="equipmentIds" value="${escapeHtml(item.id)}" ${selectedEquipmentIds.has(item.id) ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")}</strong>
            <small>${escapeHtml(item.type)} | ${escapeHtml(item.brand)} ${escapeHtml(item.model)}</small>
          </span>
        </label>
      `;
    }).join("");
    return modalShell(reminder.id ? "Modifier le rappel" : "Nouveau rappel", `
      <form class="form-grid" data-form="reminder">
        <input type="hidden" name="id" value="${escapeHtml(reminder.id || "")}">
        <div class="field"><label>Titre</label><input name="title" value="${escapeHtml(reminder.title || "")}" required placeholder="Ex.: Entretien annuel"></div>
        ${!reminder.id ? `
          <div class="panel soft-panel">
            <div class="panel-body form-grid">
              <h3>Appliquer à une plage d'appartements</h3>
              <div class="field"><label>Lieu</label><select name="rangeBuildingId"><option value="">Choisir un lieu</option>${buildingOptions}</select></div>
              <div class="split">
                <div class="field"><label>Appartement de</label><input name="rangeFrom" inputmode="numeric" placeholder="Ex.: 100"></div>
                <div class="field"><label>Appartement à</label><input name="rangeTo" inputmode="numeric" placeholder="Ex.: 200"></div>
              </div>
              <p class="meta">Les machines des appartements compris dans cette plage seront ajoutées au rappel.</p>
            </div>
          </div>
        ` : ""}
        <div class="field">
          <label>Équipement${reminder.id ? "" : "s"}</label>
          <div class="equipment-check-list">${equipmentRows || `<div class="empty">Aucun équipement disponible.</div>`}</div>
        </div>
        <div class="split">
          <div class="field"><label>Début du rappel</label><input name="startDate" type="date" value="${escapeHtml(reminder.startDate || today())}" required></div>
          <div class="field"><label>Prochaine alerte</label><input name="nextDueDate" type="date" value="${escapeHtml(nextDueDate)}" required></div>
        </div>
        <div class="split">
          <div class="field"><label>Répéter chaque</label><input name="frequencyValue" type="number" min="1" value="${escapeHtml(reminder.frequencyValue || 1)}" required></div>
          <div class="field"><label>Période</label><select name="frequencyUnit"><option value="years" ${reminder.frequencyUnit === "years" ? "selected" : ""}>Année(s)</option><option value="months" ${reminder.frequencyUnit === "months" ? "selected" : ""}>Mois</option></select></div>
        </div>
        <div class="field"><label>Statut</label><select name="status"><option value="active" ${reminder.status !== "inactive" ? "selected" : ""}>Actif</option><option value="inactive" ${reminder.status === "inactive" ? "selected" : ""}>Inactif</option></select></div>
        <div class="field"><label>Notes</label><textarea name="notes" placeholder="Ex.: Étages 1 à 5, entretien annuel.">${escapeHtml(reminder.notes || "")}</textarea></div>
        <button class="primary-button" type="submit">${reminder.id ? "Enregistrer" : "Créer le rappel"}</button>
      </form>
    `, "modal-card-wide");
  }

  function userModal(modal) {
    const user = state.users.find((item) => item.id === modal.id) || {};
    const isClientManager = currentUser()?.role === "client";
    const isClientUserForm = isClientManager || user.role === "client" || Boolean(modal.clientId);
    const effectiveUser = {
      role: isClientUserForm ? "client" : user.role,
      clientId: isClientManager ? currentUser().clientId : user.clientId || modal.clientId || "",
      clientAccessLevel: user.clientAccessLevel || (isClientUserForm ? "gestionnaire" : ""),
      allowedBuildingIds: user.allowedBuildingIds || [],
      portalRights: user.portalRights || [],
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
    const clientBuildings = (isClientManager ? scopedBuildings() : state.buildings.filter((building) => building.clientId === effectiveUser.clientId || !effectiveUser.clientId))
      .map((building) => `
        <label><input type="checkbox" name="allowedBuildingIds" value="${escapeHtml(building.id)}" ${(effectiveUser.allowedBuildingIds || []).includes(building.id) ? "checked" : ""}> ${escapeHtml(building.name)}</label>
      `).join("") || `<span class="meta">Aucun lieu disponible.</span>`;
    const rights = clientPortalRights(effectiveUser);
    const portalChecks = portalRightsCatalog().map(([right, label]) => `
      <label><input type="checkbox" name="portalRights" value="${escapeHtml(right)}" ${rights.includes(right) ? "checked" : ""}> ${escapeHtml(label)}</label>
    `).join("");
    return modalShell(user.id ? "Modifier l'utilisateur" : "Nouvel utilisateur", `
      <form class="form-grid" data-form="user">
        <input type="hidden" name="id" value="${escapeHtml(user.id || "")}">
        ${isClientManager ? `<input type="hidden" name="clientId" value="${escapeHtml(currentUser().clientId || "")}">` : ""}
        ${isClientUserForm ? `<input type="hidden" name="role" value="client">` : ""}
        <div class="split">
          <div class="field"><label>Nom</label><input name="name" value="${escapeHtml(user.name || "")}" required></div>
          <div class="field"><label>Courriel</label><input name="email" type="email" value="${escapeHtml(user.email || "")}" required></div>
        </div>
        <div class="split">
          <div class="field"><label>Mot de passe</label><input name="password" ${user.id ? `value="" placeholder="Laisser vide pour conserver"` : `value="temp123" required`}></div>
          ${isClientUserForm
            ? `<div class="field"><label>Profil</label><input value="Client" readonly></div>`
            : `<div class="field"><label>Profil</label><select name="role">${roles}</select></div>`}
        </div>
        ${isClientUserForm ? `<div class="field"><label>Rôle</label><select name="clientAccessLevel">${clientRoleOptions}</select></div>` : ""}
        ${isClientManager ? "" : `<div class="field"><label>Client lié</label><select name="clientId"><option value="">Aucun</option>${clients}</select></div>`}
        ${isClientManager || effectiveUser.role === "client" ? `<div class="client-access-editor">
          <div class="split">
            <div class="field"><label>Accès aux lieux</label><div class="choice-list"><label><input type="checkbox" name="allBuildings" value="1" ${!(effectiveUser.allowedBuildingIds || []).length ? "checked" : ""}> Tous les lieux autorisés</label>${clientBuildings}</div></div>
          </div>
          <div class="field"><label>Informations partagées</label><div class="choice-list">${portalChecks}</div></div>
        </div>` : ""}
        <div class="actions form-actions">
          <button class="primary-button" type="submit">${user.id ? "Enregistrer" : "Créer l'utilisateur"}</button>
          ${canDeleteUser(effectiveUser) ? `<button class="danger-button" type="button" data-action="delete-user" data-id="${escapeHtml(effectiveUser.id)}">Supprimer</button>` : ""}
        </div>
      </form>
    `);
  }

  function dataFieldModal(modal) {
    const field = state.dataFields.find((item) => item.id === modal.id) || { type: "single", group: "Machine", appliesTo: ["activity", "equipment"], options: [] };
    return modalShell(field.id ? "Modifier le champ de données" : "Nouveau champ de données", `
      <form class="form-grid" data-form="dataField">
        <input type="hidden" name="id" value="${escapeHtml(field.id || "")}">
        <div class="split">
          <div class="field"><label>Nom du champ</label><input name="name" value="${escapeHtml(field.name || "")}" required placeholder="Ex.: Marque"></div>
          <div class="field"><label>Groupe de champs</label><input name="group" value="${escapeHtml(field.group || "Machine")}" required placeholder="Ex.: Machine"></div>
        </div>
        <div class="split">
          <div class="field">
            <label>Type de champ</label>
            <select name="type">
              ${["text", "long", "single", "multiple", "number", "date", "phone"].map((type) => `<option value="${type}" ${field.type === type ? "selected" : ""}>${dataFieldTypeLabel(type)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Appliquer à</label>
            <div class="choice-list">
              <label><input type="checkbox" name="appliesTo" value="activity" ${field.appliesTo?.includes("activity") ? "checked" : ""}> Activités terrain</label>
              <label><input type="checkbox" name="appliesTo" value="equipment" ${field.appliesTo?.includes("equipment") ? "checked" : ""}> Dossier machine</label>
            </div>
          </div>
        </div>
        <div class="field">
          <label>Options</label>
          <p class="meta">Une option par ligne. Pour une valeur interne différente, utilisez: Étiquette | valeur</p>
          <textarea name="options" rows="12" placeholder="Carrier&#10;Gree&#10;Actif | actif">${escapeHtml(dataFieldOptionLines(field))}</textarea>
        </div>
        <button class="primary-button" type="submit">${field.id ? "Enregistrer" : "Créer le champ"}</button>
      </form>
    `);
  }

  function dataFieldOptionLines(field) {
    return (field.options || []).map((option) => option.value && option.value !== option.label ? `${option.label} | ${option.value}` : option.label).join("\n");
  }

  function serviceTypeModal(modal) {
    const type = state.serviceTypes.find((item) => item.id === modal.id) || {};
    const checklistOptions = state.interventionTypes.map((item) => `<option value="${item.id}" ${type.linkedInterventionTypeId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    return modalShell(type.id ? "Modifier le type de demande" : "Nouveau type de demande", `
      <form class="form-grid" data-form="serviceType">
        <input type="hidden" name="id" value="${escapeHtml(type.id || "")}">
        <div class="field"><label>Nom du type de demande</label><input name="name" value="${escapeHtml(type.name || "")}" required></div>
        <div class="split">
          <div class="field"><label>Priorité par défaut</label><select name="defaultPriority"><option value="basse" ${type.defaultPriority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${type.defaultPriority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${type.defaultPriority === "urgente" ? "selected" : ""}>Urgente</option></select></div>
          <div class="field"><label>Checklist liée</label><select name="linkedInterventionTypeId">${checklistOptions}</select></div>
        </div>
        <button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer le type"}</button>
      </form>
    `);
  }

  function interventionTypeModal(modal) {
    const type = state.interventionTypes.find((item) => item.id === modal.id) || {};
    return modalShell(type.id ? "Modifier le type de checklist" : "Nouveau type de checklist", `
      <form class="form-grid" data-form="interventionType">
        <input type="hidden" name="id" value="${escapeHtml(type.id || "")}">
        <div class="split">
          <div class="field"><label>Nom</label><input name="name" value="${escapeHtml(type.name || "")}" required></div>
          <div class="field"><label>Durée estimée (minutes)</label><input name="defaultDuration" type="number" min="1" value="${escapeHtml(type.defaultDuration || 60)}" required></div>
        </div>
        <div class="field"><label>Étapes de checklist</label><textarea name="checklist" required placeholder="Une étape par ligne">${escapeHtml((type.checklist || []).join("\n"))}</textarea></div>
        <button class="primary-button" type="submit">${type.id ? "Enregistrer" : "Créer la checklist"}</button>
      </form>
    `);
  }

  function formTemplateModal(modal) {
    const template = state.formTemplates.find((item) => item.id === modal.id) || {};
    const fields = template.fields?.length ? template.fields : [{ id: "", label: "", type: "text", options: [], showWhen: null, layout: "full", defaultValue: "" }];
    const activityFields = normalizeActivityFields(template.activityFields);
    return modalShell(template.id ? "Modifier le formulaire terrain" : "Nouveau formulaire terrain", `
      <form class="form-grid" data-form="formTemplate">
        <input type="hidden" name="id" value="${escapeHtml(template.id || "")}">
        <div class="field"><label>Nom du formulaire</label><input name="name" value="${escapeHtml(template.name || "")}" required></div>
        <div class="form-section-title">Champs de l'activité</div>
        <div class="forms-builder">
          ${activityFieldCatalog().map(([key, label]) => formActivityFieldRow(key, label, activityFields[key])).join("")}
        </div>
        <div class="form-section-title">Questions du formulaire</div>
        <div class="forms-builder" data-question-list>
          ${fields.map((field, index) => formBuilderQuestion(field, index, fields)).join("")}
        </div>
        <button class="ghost-button" type="button" data-action="add-form-question">Ajouter une question</button>
        <button class="ghost-button" type="button" data-action="add-form-section">Ajouter une section</button>
        <button class="primary-button" type="submit">${template.id ? "Enregistrer" : "Créer le formulaire"}</button>
      </form>
    `, "modal-card-wide form-template-modal");
  }

  function activityFieldCatalog() {
    return [
      ["type", "Type"],
      ["location", "Localisation"],
      ["brand", "Marque"],
      ["model", "Modèle"],
      ["serial", "Numéro de série"],
      ["status", "Statut"],
      ["notes", "Notes machine"]
    ];
  }

  function formActivityFieldRow(key, label, config = {}) {
    const supportsOptions = ["type", "location", "brand", "model", "status"].includes(key);
    const availableFields = state.dataFields.filter((field) => field.appliesTo.includes("activity"));
    const selectedField = config.dataFieldId ? state.dataFields.find((field) => field.id === config.dataFieldId) : null;
    const selectedIds = config.optionIds || [];
    return `
      <article class="activity-field-card" data-activity-field="${key}">
        <div class="activity-field-head">
          <strong>${escapeHtml(label)}</strong>
          <label class="inline-check"><input type="checkbox" name="activity-required-${key}" ${config.required ? "checked" : ""}><span>Obligatoire</span></label>
        </div>
        ${supportsOptions ? `
          <div class="field">
            <label>Champ de données central</label>
            <select name="activity-datafield-${key}">
              <option value="">Aucun champ central</option>
              ${availableFields.map((field) => `<option value="${escapeHtml(field.id)}" ${selectedField?.id === field.id ? "selected" : ""}>${escapeHtml(field.group)} - ${escapeHtml(field.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field data-option-picker">
            <label>Options visibles</label>
            <div class="meta">Laissez tout décoché pour afficher toutes les options du champ.</div>
            <div class="choice-list option-chip-list">
              ${(selectedField?.options || []).map((option) => `
                <label><input type="checkbox" name="activity-option-${key}" value="${escapeHtml(option.id)}" ${selectedIds.includes(option.id) ? "checked" : ""}> ${escapeHtml(option.label)}</label>
              `).join("") || `<span class="meta">Aucune option dans ce champ.</span>`}
            </div>
          </div>
          <div class="field"><label>Options supplémentaires locales</label><textarea name="activity-options-${key}" placeholder="Une option par ligne">${escapeHtml((config.options || []).join("\n"))}</textarea></div>
        ` : ""}
      </article>
    `;
  }

  function formBuilderQuestion(field, index, allFields) {
    if (field.type === "section") return formBuilderSection(field, index);
    const targetOptions = formBranchTargets(allFields, field.id);
    return `
      <article class="question-card" data-question data-field-id="${escapeHtml(field.id || "")}" draggable="true">
        <div class="question-card-head">
          <strong><span class="drag-handle">☰</span> Question ${index + 1}</strong>
          <div class="actions">
            <button class="icon-button" type="button" data-action="duplicate-form-question" aria-label="Dupliquer">+</button>
            <button class="icon-button" type="button" data-action="remove-form-question" aria-label="Supprimer">X</button>
          </div>
        </div>
        <div class="field">
          <label>Question</label>
          <input name="q-label" value="${escapeHtml(field.label || "")}" placeholder="Ex.: Etat general de l'unite" required>
        </div>
        <label class="inline-check">
          <input type="checkbox" name="q-required" ${field.required ? "checked" : ""}>
          <span>Réponse obligatoire</span>
        </label>
        <div class="split">
          <div class="field">
            <label>Type de réponse</label>
            <select name="q-type">
              ${questionTypeOptions(field.type)}
            </select>
          </div>
          <div class="field">
            <label>Disposition</label>
            <select name="q-layout">
              <option value="full" ${field.layout !== "half" ? "selected" : ""}>Largeur complète</option>
              <option value="half" ${field.layout === "half" ? "selected" : ""}>Demi-colonne</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Afficher pour</label>
          <select name="q-unit-scope">
            <option value="all" ${field.unitScope !== "interieure" && field.unitScope !== "exterieure" ? "selected" : ""}>Toutes les unités</option>
            <option value="interieure" ${field.unitScope === "interieure" ? "selected" : ""}>Unités intérieures</option>
            <option value="exterieure" ${field.unitScope === "exterieure" ? "selected" : ""}>Unités extérieures</option>
          </select>
        </div>
        <div class="field">
          <label>Réponse par défaut</label>
          <input name="q-default" value="${escapeHtml(Array.isArray(field.defaultValue) ? field.defaultValue.join(", ") : field.defaultValue || "")}" placeholder="Option ou texte par défaut">
        </div>
        <div class="option-editor ${choiceFieldTypes().includes(field.type) ? "" : "hidden"}" data-option-list>
            ${(field.options?.length ? field.options : [""]).map((option) => formOptionRow(option, field, targetOptions)).join("")}
        </div>
        <div class="actions option-actions ${choiceFieldTypes().includes(field.type) ? "" : "hidden"}">
            <button class="link-button" type="button" data-action="add-form-option">+ Ajouter une option</button>
            <button class="link-button" type="button" data-action="add-other-option">Ajouter une option « Autre »</button>
        </div>
        <div class="branching-box">
          <div class="field">
            <label>Aller à après cette question</label>
            <select name="q-next-branch">
              <option value="">Suivant</option>
              <option value="__end" ${field.nextFieldId === "__end" ? "selected" : ""}>Fin du formulaire</option>
              ${targetOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${field.nextFieldId === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
            </select>
          </div>
          <p class="meta">Pour les choix uniques, multiples ou listes, chaque option peut aussi avoir son propre Aller à.</p>
        </div>
      </article>
    `;
  }

  function formBuilderSection(field, index) {
    return `
      <article class="question-card section-card" data-question data-field-id="${escapeHtml(field.id || "")}" draggable="true">
        <div class="question-card-head">
          <strong><span class="drag-handle">☰</span> Section ${index + 1}</strong>
          <button class="icon-button" type="button" data-action="remove-form-question" aria-label="Supprimer">X</button>
        </div>
        <input type="hidden" name="q-type" value="section">
        <input type="hidden" name="q-layout" value="full">
        <div class="field"><label>Titre de section</label><input name="q-label" value="${escapeHtml(field.label || "")}" placeholder="Ex.: Unité intérieure 1 - Inspection" required></div>
        <div class="field">
          <label>Afficher pour</label>
          <select name="q-unit-scope">
            <option value="all" ${field.unitScope !== "interieure" && field.unitScope !== "exterieure" ? "selected" : ""}>Toutes les unités</option>
            <option value="interieure" ${field.unitScope === "interieure" ? "selected" : ""}>Unités intérieures</option>
            <option value="exterieure" ${field.unitScope === "exterieure" ? "selected" : ""}>Unités extérieures</option>
          </select>
        </div>
      </article>
    `;
  }

  function formOptionRow(option, field, targetOptions) {
    const defaultValues = Array.isArray(field.defaultValue) ? field.defaultValue : [field.defaultValue].filter(Boolean);
    const target = field.branchRules?.[option] || "";
    return `
      <div class="option-row" data-option-row>
        <span class="option-drag-handle" draggable="true" title="Déplacer">☰</span>
        <input name="q-option" value="${escapeHtml(option)}" placeholder="Option">
        <label class="inline-check"><input type="checkbox" name="q-option-default" ${defaultValues.includes(option) ? "checked" : ""}><span>Défaut</span></label>
        <div class="field compact-field">
          <label>Aller à</label>
          <select name="q-option-branch">
            <option value="">Suivant</option>
            <option value="__end" ${target === "__end" ? "selected" : ""}>Fin du formulaire</option>
            ${targetOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${target === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </div>
        <button class="icon-button" type="button" data-action="remove-form-option" aria-label="Supprimer">X</button>
      </div>
    `;
  }

  function formBranchTargets(fields, currentId) {
    return fields
      .filter((item) => item.id !== currentId && item.label)
      .map((item, index) => ({ id: item.id, label: `${index + 1}. ${item.label}` }));
  }

  function choiceFieldTypes() {
    return ["checkbox", "single", "multiple", "select"];
  }

  function questionTypeOptions(selected) {
    return [
      ["text", "Réponse courte"],
      ["long", "Réponse longue"],
      ["checkbox", "Case à cocher"],
      ["single", "Choix unique"],
      ["multiple", "Choix multiples"],
      ["select", "Liste déroulante"],
      ["section", "Section"]
    ].map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
  }

  function roleModal(modal) {
    const role = state.roleDefinitions.find((item) => item.id === modal.id) || {};
    const checks = rightsCatalog().map(([right, label]) => `
      <label class="check-row">
        <input type="checkbox" name="right-${right}" ${role.rights?.includes(right) ? "checked" : ""}>
        <span><strong>${escapeHtml(label)}</strong><span>${escapeHtml(right)}</span></span>
      </label>
    `).join("");
    return modalShell(role.id ? "Modifier le rôle" : "Nouveau rôle", `
      <form class="form-grid" data-form="role">
        <input type="hidden" name="id" value="${escapeHtml(role.id || "")}">
        <div class="split">
          <div class="field"><label>Identifiant du rôle</label><input name="roleId" value="${escapeHtml(role.id || "")}" ${role.id ? "readonly" : ""} required></div>
          <div class="field"><label>Nom affiché</label><input name="name" value="${escapeHtml(role.name || "")}" required></div>
        </div>
        <div class="checklist">${checks}</div>
        <button class="primary-button" type="submit">${role.id ? "Enregistrer" : "Créer le rôle"}</button>
      </form>
    `);
  }

  function checklistModal(orderId) {
    const order = state.workOrders.find((item) => item.id === orderId);
    const type = state.interventionTypes.find((item) => item.id === order?.typeId);
    const existing = state.interventions.find((item) => item.workOrderId === orderId);
    const checks = type?.checklist || [];
    return modalShell(`Checklist - ${escapeHtml(order?.number || "")}`, `
      <form class="form-grid" data-form="checklist" data-order-id="${orderId}">
        <div class="checklist">
          ${checks.map((item, index) => `
            <label class="check-row">
              <input type="checkbox" name="check-${index}" ${existing?.checklistDone?.[index] ? "checked" : ""}>
              <span><strong>${escapeHtml(item)}</strong><span>Étape ${index + 1}</span></span>
            </label>
          `).join("")}
        </div>
        <div class="split">
          <div class="field"><label>Température de soufflage</label><input name="soufflage" value="${escapeHtml(existing?.readings?.soufflage || "")}" placeholder="Ex.: 11.2 C"></div>
          <div class="field"><label>Température de retour</label><input name="retour" value="${escapeHtml(existing?.readings?.retour || "")}" placeholder="Ex.: 23.0 C"></div>
        </div>
        <div class="field"><label>Pression / observation</label><input name="pression" value="${escapeHtml(existing?.readings?.pression || "")}"></div>
        <div class="field"><label>Résumé de l'intervention</label><textarea name="summary" required>${escapeHtml(existing?.summary || "")}</textarea></div>
        <button class="primary-button" type="submit">Enregistrer l'intervention</button>
      </form>
    `);
  }

  function fieldInterventionModal(modal) {
    const order = state.workOrders.find((item) => item.id === modal.orderId);
    const availableApartments = workOrderApartments(order);
    const selectedEquipment = state.equipment.find((item) => item.id === modal.equipmentId);
    const equipment = selectedEquipment || { apartmentId: modal.apartmentId, unitKind: modal.unitKind || "interieure" };
    const selectedApartmentId = equipment.apartmentId || modal.apartmentId || availableApartments[0]?.id || "__new";
    const apartment = state.apartments.find((item) => item.id === selectedApartmentId);
    const apartmentOptions = availableApartments.map((item) => `<option value="${item.id}" ${selectedApartmentId === item.id ? "selected" : ""}>Appartement ${escapeHtml(item.number)}${item.occupant ? ` - ${escapeHtml(item.occupant)}` : ""}</option>`).join("");
    const machinesForApartment = selectedApartmentId === "__new" ? [] : equipmentForApartment(selectedApartmentId);
    const selectedActivityEquipmentId = selectedEquipment?.id || "__new";
    const equipmentOptions = machinesForApartment.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedActivityEquipmentId === item.id ? "selected" : ""}>${escapeHtml(item.type)} - ${escapeHtml(item.brand || "-")} ${escapeHtml(item.model || "")} ${item.serial ? `(${escapeHtml(item.serial)})` : ""}</option>`).join("");
    const template = formTemplateForOrder(order);
    const activityFields = normalizeActivityFields(template?.activityFields);
    const statusOptions = dataFieldOptionsForSelect(activityFields.status);
    const activityStatuses = activityStatusOptions();
    const recommendationTypes = recommendationTypeOptions();
    const existing = state.interventions.find((item) => item.workOrderId === order?.id && item.equipmentId === equipment.id);
    const recommendation = existing?.recommendation || {};
    const hasRecommendation = Boolean(recommendation.type);
    return modalShell(`Nouvelle activité${apartment ? ` - Apt ${escapeHtml(apartment.number)}` : ""}`, `
      <form class="form-grid" data-form="fieldIntervention" data-order-id="${escapeHtml(order?.id || "")}" data-equipment-id="${escapeHtml(selectedEquipment?.id || "")}">
        <div class="form-section-title">Appartement</div>
        <div class="split">
          <div class="field"><label>Appartement</label><select name="apartmentId"><option value="__new" ${selectedApartmentId === "__new" ? "selected" : ""}>Nouvel appartement</option>${apartmentOptions}</select></div>
          <div class="field new-apartment-field"><label>Numéro du nouvel appartement</label><input name="newApartmentNumber" placeholder="Ex.: 1204"></div>
        </div>
        <div class="field new-apartment-field"><label>Occupant du nouvel appartement</label><input name="newApartmentOccupant" placeholder="Nom ou note d'accès"></div>
        <div class="form-section-title">Machine</div>
        <div class="split">
          <div class="field"><label>Machine</label><select name="activityEquipmentId" data-activity-equipment-select><option value="__new">Créer une nouvelle machine</option>${equipmentOptions}</select></div>
          <div class="field"><label>Type d'unité</label><select name="unitKind"><option value="interieure" ${equipment.unitKind !== "exterieure" ? "selected" : ""}>Unité intérieure</option><option value="exterieure" ${equipment.unitKind === "exterieure" ? "selected" : ""}>Unité extérieure</option></select></div>
        </div>
        <div class="split">
          ${activityTextInput("type", activityFields.type, equipment.type)}
          ${activityTextInput("location", activityFields.location, equipment.location)}
        </div>
        <div class="split">
          ${activityTextInput("brand", activityFields.brand, equipment.brand)}
          ${activityTextInput("model", activityFields.model, equipment.model)}
        </div>
        <div class="split">
          <div class="field"><label>${activityFields.serial.label}${activityFields.serial.required ? " *" : ""}</label><input name="serial" value="${escapeHtml(equipment.serial || "")}" ${activityFields.serial.required ? "required" : ""}></div>
          <div class="field"><label>Statut machine observé${activityFields.status.required ? " *" : ""}</label><select name="machineStatus" ${activityFields.status.required ? "required" : ""}><option value="">Sélectionner</option>${statusOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${existing?.machineStatus === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
        </div>
        <div class="split">
          <div class="field"><label>Statut de l'activité</label><select name="activityStatus">${activityStatuses.map((option) => `<option value="${escapeHtml(option.value)}" ${(existing?.activityStatus || "completee") === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
          <div class="field"><label>${activityFields.notes.label}${activityFields.notes.required ? " *" : ""}</label><textarea name="equipmentNotes" ${activityFields.notes.required ? "required" : ""}>${escapeHtml(existing?.equipmentNotes || "")}</textarea></div>
        </div>
        <div class="form-section-title">${escapeHtml(template?.name || "Formulaire")}</div>
        <div class="form-builder dynamic-form-grid">
          ${(template?.fields || []).map((field) => renderDynamicField(field, existing?.formResponses?.[field.label] ?? field.defaultValue)).join("")}
        </div>
        <div class="field">
          <label>Photos et documents</label>
          <input name="attachments" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx">
          <p class="meta">Maximum 3 fichiers, 10 MB par fichier. Les fichiers seront associés à l'appartement et à la machine de cette activité.</p>
        </div>
        ${existing?.attachments?.length ? `<div class="mini-list">${existing.attachments.map((file) => `<div class="meta">- ${escapeHtml(file.name)} (${escapeHtml(file.type || "fichier")})</div>`).join("")}</div>` : ""}
        <div class="form-section-title">Recommandation</div>
        <div class="field">
          <label>Recommandation au client</label>
          <select name="recommendationType" data-recommendation-select>
            <option value="">Aucune recommandation</option>
            ${recommendationTypes.map((option) => `<option value="${escapeHtml(option.value)}" ${recommendation.type === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </div>
        <div class="recommendation-details ${hasRecommendation ? "" : "hidden"}" data-recommendation-details>
          <div class="field"><label>Description</label><textarea name="recommendationDescription" placeholder="Décrire la recommandation pour validation interne">${escapeHtml(recommendation.description || "")}</textarea></div>
          <div class="split">
            <div class="field"><label>Priorité</label><select name="recommendationPriority"><option value="basse" ${recommendation.priority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${!recommendation.priority || recommendation.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${recommendation.priority === "urgente" ? "selected" : ""}>Urgente</option></select></div>
            <div class="field"><label>Temps prévu pour la réparation</label><input name="recommendationTime" value="${escapeHtml(recommendation.time || "")}" placeholder="Ex.: 2 h, 1 journée"></div>
          </div>
          <div class="field"><label>Pièce nécessaire</label><input name="recommendationPart" value="${escapeHtml(recommendation.part || "")}" placeholder="Ex.: moteur, carte électronique"></div>
        </div>
        <div class="field"><label>Resume de l'intervention</label><textarea name="summary" required>${escapeHtml(existing?.summary || "")}</textarea></div>
        <div class="actions field-intervention-actions">
          <button class="primary-button" type="submit">Enregistrer</button>
          <button class="ghost-button" type="submit" data-after-save="interieure">Enregistrer et ajouter unité intérieure</button>
          <button class="ghost-button" type="submit" data-after-save="exterieure">Enregistrer et ajouter unité extérieure</button>
        </div>
      </form>
    `);
  }

  function recommendationReviewModal(interventionId) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    if (!intervention?.recommendation) return modalShell("Recommandation", `<div class="empty">Recommandation introuvable.</div>`);
    const { equipment, apartment, building } = equipmentContext(intervention.equipmentId);
    const recommendation = intervention.recommendation;
    return modalShell("Réviser la recommandation", `
      <form class="form-grid" data-form="recommendationReview">
        <input type="hidden" name="interventionId" value="${escapeHtml(intervention.id)}">
        <div class="definition compact">
          <div><span>Lieu</span><strong>${escapeHtml(building?.name || "-")}</strong></div>
          <div><span>Appartement</span><strong>${escapeHtml(apartment?.number || "-")}</strong></div>
          <div><span>Machine</span><strong>${escapeHtml(equipment?.type || "-")}</strong></div>
          <div><span>Type</span><strong>${escapeHtml(dataFieldLabelByValue("recommendation_type", recommendation.type))}</strong></div>
        </div>
        ${recommendationChat(recommendation)}
        <div class="field"><label>Description technique</label><textarea name="description">${escapeHtml(recommendation.description || "")}</textarea></div>
        <div class="split">
          <div class="field"><label>Prix proposé</label><input name="price" value="${escapeHtml(recommendation.price || "")}" inputmode="decimal" placeholder="Ex.: 450.00"></div>
          <div class="field"><label>Délai proposé</label><input name="delay" value="${escapeHtml(recommendation.delay || "")}" placeholder="Ex.: 5 jours ouvrables"></div>
        </div>
        <div class="split">
          <div class="field"><label>Priorité</label><select name="priority"><option value="basse" ${recommendation.priority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${!recommendation.priority || recommendation.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${recommendation.priority === "urgente" ? "selected" : ""}>Urgente</option></select></div>
          <div class="field"><label>Pièce nécessaire</label><input name="part" value="${escapeHtml(recommendation.part || "")}"></div>
        </div>
        <div class="field"><label>Temps prévu pour la réparation</label><input name="time" value="${escapeHtml(recommendation.time || "")}" placeholder="Ex.: 2 h"></div>
        <div class="field"><label>Message visible par le client / réponse</label><textarea name="clientMessage" placeholder="Réponse ou texte commercial clair pour le client">${escapeHtml(recommendation.clientMessage || recommendation.description || "")}</textarea></div>
        <div class="field"><label>Note interne</label><textarea name="internalNote">${escapeHtml(recommendation.internalNote || "")}</textarea></div>
        <div class="field"><label>Statut</label><select name="status"><option value="a_valider" ${recommendation.status === "a_valider" ? "selected" : ""}>À valider</option><option value="envoyee" ${recommendation.status === "envoyee" ? "selected" : ""}>Envoyée au client</option><option value="information_demandee" ${recommendation.status === "information_demandee" ? "selected" : ""}>Information demandée</option><option value="approuvee" ${recommendation.status === "approuvee" ? "selected" : ""}>Approuvée</option><option value="refusee" ${recommendation.status === "refusee" ? "selected" : ""}>Refusée</option></select></div>
        <button class="primary-button" type="submit">Enregistrer la recommandation</button>
      </form>
    `, "modal-card-wide");
  }

  function recommendationReplyModal(interventionId) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    if (!intervention?.recommendation) return modalShell("Répondre au client", `<div class="empty">Recommandation introuvable.</div>`);
    const { equipment, apartment, building } = equipmentContext(intervention.equipmentId);
    const recommendation = intervention.recommendation;
    return modalShell("Répondre au client", `
      <form class="form-grid" data-form="recommendationReply">
        <input type="hidden" name="interventionId" value="${escapeHtml(intervention.id)}">
        <div class="definition compact">
          <div><span>Lieu</span><strong>${escapeHtml(building?.name || "-")}</strong></div>
          <div><span>Appartement</span><strong>${escapeHtml(apartment?.number || "-")}</strong></div>
          <div><span>Machine</span><strong>${escapeHtml(equipment?.type || "-")}</strong></div>
          <div><span>Statut</span><strong>${escapeHtml(statusText(recommendation.status))}</strong></div>
        </div>
        ${recommendationChat(recommendation)}
        <div class="field"><label>Réponse au client</label><textarea name="reply" required placeholder="Écrire la réponse qui sera visible dans le portail client"></textarea></div>
        <button class="primary-button" type="submit">Envoyer la réponse</button>
      </form>
    `, "modal-card-wide");
  }

  function clientRecommendationMessageModal(interventionId, status) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    if (!intervention?.recommendation) return modalShell("Message", `<div class="empty">Recommandation introuvable.</div>`);
    const isRefusal = status === "refusee";
    return modalShell(isRefusal ? "Refuser la recommandation" : "Demander plus d'informations", `
      <form class="form-grid" data-form="clientRecommendationMessage">
        <input type="hidden" name="interventionId" value="${escapeHtml(interventionId)}">
        <input type="hidden" name="status" value="${escapeHtml(status || "information_demandee")}">
        ${recommendationChat(intervention.recommendation)}
        <p class="meta">${isRefusal ? "Expliquez la raison du refus si vous le souhaitez." : "Écrivez votre question. L'équipe interne pourra vous répondre et renvoyer la recommandation."}</p>
        <div class="field"><label>${isRefusal ? "Raison du refus" : "Question / information demandée"}</label><textarea name="clientComment" required>${escapeHtml(intervention.recommendation.clientComment || "")}</textarea></div>
        <button class="${isRefusal ? "danger-button" : "primary-button"}" type="submit">${isRefusal ? "Refuser" : "Envoyer la demande"}</button>
      </form>
    `);
  }

  function clientDocumentModal(id, modal = {}) {
    const doc = state.clientDocuments.find((item) => item.id === id) || {
      visibleToClient: true,
      buildingId: modal.buildingId || "",
      clientId: modal.clientId || state.buildings.find((building) => building.id === modal.buildingId)?.clientId || ""
    };
    const clientOptions = state.clients.map((client) => `<option value="${client.id}" ${doc.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
    const buildingOptions = state.buildings.map((building) => `<option value="${building.id}" ${doc.buildingId === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("");
    const apartmentOptions = state.apartments.map((apartment) => {
      const building = state.buildings.find((item) => item.id === apartment.buildingId);
      return `<option value="${apartment.id}" ${doc.apartmentId === apartment.id ? "selected" : ""}>${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment.number)}</option>`;
    }).join("");
    const equipmentOptions = state.equipment.map((equipment) => {
      const { apartment, building } = equipmentContext(equipment.id);
      return `<option value="${equipment.id}" ${doc.equipmentId === equipment.id ? "selected" : ""}>${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")} - ${escapeHtml(equipment.type)}</option>`;
    }).join("");
    return modalShell(doc.id ? "Modifier le document" : "Nouveau document client", `
      <form class="form-grid" data-form="clientDocument">
        <input type="hidden" name="id" value="${escapeHtml(doc.id || "")}">
        <div class="split">
          <div class="field"><label>Nom du document</label><input name="name" value="${escapeHtml(doc.name || "")}" required placeholder="Ex.: Contrat signé"></div>
          <div class="field"><label>Type</label><input name="type" value="${escapeHtml(doc.type || "Contrat")}" required placeholder="Contrat, proposition, rapport"></div>
        </div>
        <div class="field"><label>Client</label><select name="clientId" required>${clientOptions}</select></div>
        <div class="split">
          <div class="field"><label>Immeuble optionnel</label><select name="buildingId"><option value="">Aucun</option>${buildingOptions}</select></div>
          <div class="field"><label>Appartement optionnel</label><select name="apartmentId"><option value="">Aucun</option>${apartmentOptions}</select></div>
        </div>
        <div class="field"><label>Machine optionnelle</label><select name="equipmentId"><option value="">Aucune</option>${equipmentOptions}</select></div>
        <label class="inline-check"><input type="checkbox" name="visibleToClient" ${doc.visibleToClient !== false ? "checked" : ""}><span>Visible dans le portail client</span></label>
        <div class="field"><label>Fichier${doc.id ? " (laisser vide pour conserver)" : ""}</label><input name="documentFile" type="file" ${doc.id ? "" : "required"} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"></div>
        <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(doc.notes || "")}</textarea></div>
        <button class="primary-button" type="submit">${doc.id ? "Enregistrer" : "Ajouter le document"}</button>
      </form>
    `, "modal-card-wide");
  }

  function activityTextInput(name, config, value) {
    const options = activityOptions(name, config);
    return `
      <div class="field combo-field">
        <label>${escapeHtml(config.label)}${config.required ? " *" : ""}</label>
        ${comboInput(name, value || "", options, config.required)}
      </div>
    `;
  }

  function activityOptions(name, config = {}) {
    const localOptions = config.options || [];
    if (config.dataFieldId) {
      const centralOptions = dataFieldOptionsForConfig(config).map((option) => option.value);
      return Array.from(new Set([...centralOptions, ...localOptions])).sort((a, b) => a.localeCompare(b, "fr"));
    }
    const fromInventory = state.equipment.map((item) => ({
      type: item.type,
      location: item.location,
      brand: item.brand,
      model: item.model
    }[name])).filter(Boolean);
    return Array.from(new Set([...localOptions, ...fromInventory])).sort((a, b) => a.localeCompare(b, "fr"));
  }

  function dataFieldOptionsForConfig(config = {}) {
    const dataField = state.dataFields.find((field) => field.id === config.dataFieldId);
    if (!dataField) return normalizeDataOptions(config.options || []);
    const selected = config.optionIds || [];
    return dataField.options.filter((option) => option.active !== false && (!selected.length || selected.includes(option.id)));
  }

  function dataFieldOptionsForSelect(config = {}) {
    return dataFieldOptionsForConfig(config).map((option) => ({
      value: option.value,
      label: option.label
    }));
  }

  function comboInput(name, value, options, required = false) {
    const uniqueOptions = Array.from(new Set(options || [])).filter(Boolean);
    return `
      <input name="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${required ? "required" : ""} placeholder="Tapez ou choisissez" autocomplete="off" data-combo-input>
      <div class="combo-options hidden" data-combo-options>
        ${uniqueOptions.map((option) => `<button type="button" data-action="combo-option" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("") || `<span>Aucune option</span>`}
      </div>
    `;
  }

  function renderDynamicField(field, value) {
    if (field.type === "section") {
      return `<div class="form-runtime-section dynamic-field" data-dynamic-field-id="${escapeHtml(field.id)}" data-unit-scope="${escapeHtml(field.unitScope || "all")}"><h3>${escapeHtml(field.label)}</h3></div>`;
    }
    const fieldMeta = `data-dynamic-field-id="${escapeHtml(field.id)}" data-unit-scope="${escapeHtml(field.unitScope || "all")}"`;
    const options = field.options?.length ? field.options : ["Oui"];
    const required = field.required ? "required" : "";
    const label = `${escapeHtml(field.label)}${field.required ? " *" : ""}`;
    const layoutClass = field.layout === "half" ? " half-field" : "";
    if (field.type === "long") {
      return `<div class="field dynamic-field${layoutClass}" ${fieldMeta}><label>${label}</label><textarea name="field-${field.id}" ${required}>${escapeHtml(value || "")}</textarea></div>`;
    }
    if (field.type === "checkbox") {
      const values = Array.isArray(value) ? value : [value].filter(Boolean);
      return `<div class="field dynamic-field${layoutClass}" ${fieldMeta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list checkbox-choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${values.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "single") {
      return `<div class="field dynamic-field${layoutClass}" ${fieldMeta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option, index) => `<label><input type="radio" name="field-${field.id}" value="${escapeHtml(option)}" ${value === option ? "checked" : ""} ${field.required && index === 0 ? "required" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "multiple") {
      return `<div class="field dynamic-field${layoutClass}" ${fieldMeta} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${Array.isArray(value) && value.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "select") {
      return `<div class="field combo-field dynamic-field${layoutClass}" ${fieldMeta}><label>${label}</label>${comboInput(`field-${field.id}`, value || "", options, field.required)}</div>`;
    }
    if (field.type === "phone") {
      return `<div class="field dynamic-field${layoutClass}" ${fieldMeta}><label>${label}</label><input name="field-${field.id}" value="${escapeHtml(formatCanadianPhone(value || ""))}" inputmode="tel" autocomplete="tel" placeholder="(514) 555-0123" data-phone-input ${required}></div>`;
    }
    return `<div class="field dynamic-field${layoutClass}" ${fieldMeta}><label>${label}</label><input name="field-${field.id}" value="${escapeHtml(value || "")}" ${required}></div>`;
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    if (event.submitter?.dataset.afterSave) values.afterSave = event.submitter.dataset.afterSave;
    const formType = form.dataset.form;
    if (formType === "login") login(values);
    if (formType === "signup") signup(values);
    if (formType === "forgotPassword") requestPasswordReset(values);
    if (formType === "resetPassword") resetPassword(values);
    if (formType === "building") await saveBuilding(values);
    if (formType === "apartment") await saveApartment(values);
    if (formType === "ticket") await createTicket(form, values);
    if (formType === "workorder") await createWorkOrder(form, values);
    if (formType === "equipment") await createEquipment(values);
    if (formType === "reminder") await saveReminder(form, values);
    if (formType === "user") await createUser(form, values);
    if (formType === "dataField") await saveDataField(form, values);
    if (formType === "serviceType") await saveServiceType(values);
    if (formType === "interventionType") await saveInterventionType(values);
    if (formType === "formTemplate") await saveFormTemplate(form, values);
    if (formType === "role") await saveRole(form, values);
    if (formType === "checklist") await saveChecklist(form, values);
    if (formType === "fieldIntervention") await saveFieldIntervention(form, values);
    if (formType === "recommendationReview") await saveRecommendationReview(values);
    if (formType === "recommendationReply") await saveRecommendationReply(values);
    if (formType === "clientRecommendationMessage") await saveClientRecommendationMessage(values);
    if (formType === "clientDocument") await saveClientDocument(form, values);
  }

  async function restoreSession() {
    if (!SERVER_ENABLED) return;
    if (state.resetToken) return;
    const restoreStartedAt = Date.now();
    const uiState = currentUiState();
    restoringSession = true;
    try {
      const payload = await api.session();
      rememberServerState(payload.state);
      state = {
        ...normalizeState(payload.state),
        ...(lastLocalChangeAt > restoreStartedAt ? uiState : {}),
        sessionUserId: payload.user.id,
        modal: lastLocalChangeAt > restoreStartedAt ? uiState.modal : null,
        toast: ""
      };
      state.activeView = state.activeView || "tableau";
      render();
      ensureBrowserHistoryGuard();
      startAutoRefresh();
    } catch (error) {
      // No active server session.
    } finally {
      restoringSession = false;
    }
  }

  async function refreshStateFromServer() {
    if (!SERVER_ENABLED || !state.sessionUserId || restoringSession || state.modal || saveTimer || Date.now() - lastLocalChangeAt < 10000 || Date.now() - lastNavigationAt < 30000) return;
    restoringSession = true;
    const uiState = currentUiState();
    try {
      const payload = await api.session();
      rememberServerState(payload.state);
      state = {
        ...normalizeState(payload.state),
        ...uiState,
        sessionUserId: payload.user.id,
        modal: uiState.modal
      };
      render();
      replaceBrowserHistoryState();
    } catch (error) {
      // Keep the current UI state if the refresh cannot reach the server.
    } finally {
      restoringSession = false;
    }
  }

  function startAutoRefresh() {
    if (!SERVER_ENABLED || refreshTimer) return;
    refreshTimer = setInterval(refreshStateFromServer, 8000);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshStateFromServer();
    });
    window.addEventListener("focus", refreshStateFromServer);
    window.addEventListener("popstate", (event) => {
      if (!currentUser()) return;
      if (event.state?.climaparcUi) {
        applyBrowserHistoryState(event.state.ui);
        return;
      }
      ensureBrowserHistoryGuard();
    });
  }

  async function signup(values) {
    if (values.password !== values.confirmPassword) {
      showToast("Les mots de passe ne correspondent pas.");
      return;
    }
    if (values.password.length < 8) {
      showToast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (state.users.some((user) => user.email.toLowerCase() === values.email.toLowerCase())) {
      showToast("Un compte existe déjà avec ce courriel.");
      return;
    }
    if (SERVER_ENABLED) {
      try {
        const payload = await api.signup(seed, values);
        rememberServerState(payload.state);
        state = normalizeState(payload.state);
        state.sessionUserId = payload.user.id;
        state.activeView = "tableau";
        state.modal = null;
        state.toast = "Compte créé.";
        render();
        ensureBrowserHistoryGuard();
        startAutoRefresh();
        scheduleToastClear();
      } catch (error) {
        showToast(error.message || "Serveur indisponible.");
      }
      return;
    }
    const client = {
      id: uid("client"),
      name: values.companyName,
      contact: values.name,
      email: values.email,
      phone: formatCanadianPhone(values.phone),
      phonePoste: values.phonePoste || ""
    };
    const user = {
      id: uid("u"),
      name: values.name,
      email: values.email,
      password: values.password,
      role: "client",
      clientId: client.id
    };
    state.clients.push(client);
    state.users.push(user);
    setState({ sessionUserId: user.id, activeView: "tableau", modal: null, toast: "Compte créé." });
  }

  async function requestPasswordReset(values) {
    if (SERVER_ENABLED) {
      try {
        await api.requestPasswordReset(seed, { email: values.email });
      } catch (error) {
        showToast(error.message || "Serveur indisponible.");
        return;
      }
    } else {
      state.passwordResetRequests.unshift({ id: uid("reset"), email: values.email, createdAt: today(), status: "nouvelle" });
      saveState();
    }
    setState({ modal: null, toast: "Si le compte existe, la demande a été enregistrée." });
  }

  async function resetPassword(values) {
    if (values.password !== values.confirmPassword) {
      showToast("Les mots de passe ne correspondent pas.");
      return;
    }
    if (values.password.length < 8) {
      showToast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!state.resetToken) {
      showToast("Lien de réinitialisation invalide.");
      return;
    }
    try {
      await api.confirmPasswordReset(seed, { token: state.resetToken, password: values.password, confirmPassword: values.confirmPassword });
      state.resetToken = "";
      window.history.replaceState({}, document.title, window.location.pathname);
      setState({ modal: null, toast: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
    } catch (error) {
      showToast(error.message || "Serveur indisponible.");
    }
  }

  async function login(values) {
    if (SERVER_ENABLED) {
      try {
        const payload = await api.login(seed, { email: values.email, password: values.password });
        rememberServerState(payload.state);
        state = normalizeState(payload.state);
        state.sessionUserId = payload.user.id;
        state.activeView = "tableau";
        state.modal = null;
        state.toast = "";
        render();
        ensureBrowserHistoryGuard();
        startAutoRefresh();
      } catch (error) {
        showToast(error.message || "Serveur indisponible.");
      }
      return;
    }
    const user = state.users.find((item) => item.email.toLowerCase() === values.email.toLowerCase() && item.password === values.password);
    if (!user) {
      showToast("Courriel ou mot de passe invalide.");
      return;
    }
    setState({ sessionUserId: user.id, activeView: "tableau", toast: "" });
  }

  async function logout() {
    if (SERVER_ENABLED) {
      await api.logout();
    }
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    lastServerState = null;
    browserHistoryReady = false;
    setState({ sessionUserId: null, activeView: "tableau", modal: null });
    if (typeof window !== "undefined" && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
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

  async function createTicket(form, values) {
    const previousTickets = JSON.parse(JSON.stringify(state.tickets));
    const { building, apartment } = equipmentContext(values.equipmentId);
    const serviceType = state.serviceTypes.find((item) => item.id === values.serviceTypeId) || state.serviceTypes[0];
    const existing = state.tickets.find((item) => item.id === values.id);
    let payload;
    let successToast;
    if (existing) {
      const closedAt = values.status === "ferme" ? existing.closedAt || today() : "";
      Object.assign(existing, {
        serviceTypeId: values.serviceTypeId,
        buildingId: building.id,
        apartmentId: apartment.id,
        equipmentId: values.equipmentId,
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        closedAt
      });
      payload = existing;
      successToast = "Demande client modifiée.";
    } else {
      payload = {
        id: uid("tk"),
        number: nextTicketNumber(),
        clientId: currentUser().role === "client" ? currentUser().clientId : clientForBuilding(building.id)?.id,
        buildingId: building.id,
        apartmentId: apartment.id,
        equipmentId: values.equipmentId,
        serviceTypeId: values.serviceTypeId || serviceType?.id || "",
        title: values.title,
        description: values.description,
        priority: values.priority || serviceType?.defaultPriority || "normale",
        status: values.status || "ouvert",
        createdAt: today(),
        closedAt: values.status === "ferme" ? today() : "",
        createdBy: currentUser().id
      };
      state.tickets.unshift(payload);
      successToast = "Demande client créée.";
    }
    const uiPatch = { activeView: "appels" };
    updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde de la demande..." });
    try {
      await saveDomainItemNow(api.saveTicket, payload, uiPatch, successToast);
    } catch (error) {
      state.tickets = previousTickets;
      updateUiState({ modal: null, ...uiPatch, toast: error.message || "Demande client non sauvegardée." });
    }
  }

  async function createWorkOrder(form, values) {
    const previousWorkOrders = JSON.parse(JSON.stringify(state.workOrders));
    const previousTickets = JSON.parse(JSON.stringify(state.tickets));
    const previousReminders = JSON.parse(JSON.stringify(state.reminders));
    const scope = values.scope || "equipment";
    const assignedTechnicianIds = Array.from(form.querySelectorAll('[name="assignedTechnicianIds"]:checked')).map((input) => input.value);
    const technicianId = values.technicianId || assignedTechnicianIds[0] || "";
    if (scope === "building" && !values.buildingId) {
      showToast("Choisissez un immeuble pour le BT de bloc.");
      return;
    }
    if (scope === "equipment" && !values.equipmentId) {
      showToast("Choisissez un equipement pour le BT.");
      return;
    }
    const existing = state.workOrders.find((item) => item.id === values.id);
    let payload;
    let successToast;
    let linkedTicket = null;
    if (existing) {
      Object.assign(existing, {
        scope,
        buildingId: scope === "building" ? values.buildingId : "",
        equipmentId: scope === "equipment" ? values.equipmentId : "",
        typeId: values.typeId,
        formTemplateId: values.formTemplateId || state.formTemplates[0]?.id || "",
        technicianId,
        assignedTeam: "",
        assignedTechnicianIds,
        scheduledDate: values.scheduledDate,
        status: values.status,
        notes: values.notes,
        ticketId: values.ticketId || existing.ticketId || null,
        sourceReminderId: values.sourceReminderId || existing.sourceReminderId || ""
      });
      if (values.sourceReminderId) markReminderWorkOrderOpened(values.sourceReminderId, existing.id);
      payload = existing;
      successToast = "Bon de travail modifié.";
    } else {
      const number = `BT-${new Date().getFullYear()}-${String(state.workOrders.length + 1).padStart(3, "0")}`;
      payload = {
        id: uid("wo"),
        number,
        ticketId: values.ticketId || null,
        scope,
        buildingId: scope === "building" ? values.buildingId : "",
        equipmentId: scope === "equipment" ? values.equipmentId : "",
        typeId: values.typeId,
        formTemplateId: values.formTemplateId || state.formTemplates[0]?.id || "",
        technicianId,
        assignedTeam: "",
        assignedTechnicianIds,
        scheduledDate: values.scheduledDate,
        status: values.status,
        notes: values.notes,
        sourceReminderId: values.sourceReminderId || ""
      };
      state.workOrders.unshift(payload);
      if (values.sourceReminderId) markReminderWorkOrderOpened(values.sourceReminderId, payload.id);
      if (values.ticketId) {
        linkedTicket = state.tickets.find((item) => item.id === values.ticketId);
        if (linkedTicket) linkedTicket.status = "en_cours";
      }
      successToast = "Bon de travail créé.";
    }
    const uiPatch = { activeView: "bons" };
    updateUiState({ modal: null, ...uiPatch, toast: "Sauvegarde du bon de travail..." });
    try {
      const reminderToSave = values.sourceReminderId
        ? JSON.parse(JSON.stringify(state.reminders.find((item) => item.id === values.sourceReminderId) || null))
        : null;
      await saveDomainItemNow(api.saveWorkOrder, payload, uiPatch, successToast);
      if (reminderToSave) {
        const reminderPayload = await api.saveReminder(reminderToSave);
        if (reminderPayload.state) {
          rememberServerState(reminderPayload.state);
          const uiState = currentUiState();
          state = {
            ...normalizeState(reminderPayload.state),
            ...uiState,
            ...uiPatch,
            sessionUserId: uiState.sessionUserId,
            modal: null,
            toast: successToast
          };
          render();
          scheduleToastClear();
        }
      }
      if (linkedTicket) {
        const ticketPayload = await api.saveTicket(linkedTicket);
        if (ticketPayload.state) {
          rememberServerState(ticketPayload.state);
          const uiState = currentUiState();
          state = {
            ...normalizeState(ticketPayload.state),
            ...uiState,
            ...uiPatch,
            sessionUserId: uiState.sessionUserId,
            modal: null,
            toast: successToast
          };
          render();
          scheduleToastClear();
        }
      }
    } catch (error) {
      state.workOrders = previousWorkOrders;
      state.tickets = previousTickets;
      state.reminders = previousReminders;
      updateUiState({ modal: null, ...uiPatch, toast: error.message || "Bon de travail non sauvegardé." });
    }
  }

  function markReminderWorkOrderOpened(reminderId, orderId) {
    const reminder = state.reminders.find((item) => item.id === reminderId);
    if (!reminder) return;
    reminder.lastWorkOrderId = orderId;
    reminder.lastOpenedAt = today();
    reminder.lastSeenDueDate = reminder.nextDueDate || reminder.lastSeenDueDate || "";
  }

  async function createEquipment(values) {
    const previousEquipment = JSON.parse(JSON.stringify(state.equipment));
    const previousSelectedEquipmentId = state.selectedEquipmentId;
    const previousView = state.activeView;
    const changedAt = new Date().toISOString();
    const existing = state.equipment.find((item) => item.id === values.id);
    if (existing) {
      Object.assign(existing, {
        apartmentId: values.apartmentId,
        type: values.type,
        brand: values.brand,
        model: values.model,
        serial: values.serial,
        location: values.location,
        installDate: values.installDate,
        lastService: values.lastService,
        nextService: values.nextService,
        status: values.status,
        notes: values.notes,
        updatedAt: changedAt
      });
      updateUiState({ modal: null, selectedEquipmentId: existing.id, activeView: "detail", toast: "Sauvegarde de la machine..." });
      try {
        await saveEquipmentNow(existing, "Machine modifiée.");
      } catch (error) {
        state.equipment = previousEquipment;
        state.selectedEquipmentId = previousSelectedEquipmentId;
        state.activeView = previousView;
        updateUiState({ modal: null, toast: error.message || "Machine non sauvegardée." });
      }
      return;
    }
    const equipment = {
      id: uid("eq"),
      apartmentId: values.apartmentId,
      type: values.type,
      brand: values.brand,
      model: values.model,
      serial: values.serial,
      location: values.location,
      installDate: values.installDate,
      lastService: values.lastService || "",
      nextService: values.nextService || "",
      status: values.status || "actif",
      notes: values.notes,
      updatedAt: changedAt
    };
    state.equipment.unshift(equipment);
    updateUiState({ modal: null, selectedEquipmentId: equipment.id, activeView: "detail", toast: "Sauvegarde de la machine..." });
    try {
      await saveEquipmentNow(equipment, "Équipement ajouté.");
    } catch (error) {
      state.equipment = previousEquipment;
      state.selectedEquipmentId = previousSelectedEquipmentId;
      state.activeView = previousView;
      updateUiState({ modal: null, toast: error.message || "Équipement non sauvegardé." });
    }
  }

  async function saveReminder(form, values) {
    const previousReminders = JSON.parse(JSON.stringify(state.reminders));
    const equipmentIds = new Set(Array.from(form.querySelectorAll("input[name='equipmentIds']:checked")).map((input) => input.value));
    if (!values.id && values.rangeBuildingId && (values.rangeFrom || values.rangeTo)) {
      const from = apartmentNumberValue(values.rangeFrom || "0");
      const to = apartmentNumberValue(values.rangeTo || values.rangeFrom || "999999");
      const min = Math.min(from, to);
      const max = Math.max(from, to);
      state.apartments
        .filter((apartment) => apartment.buildingId === values.rangeBuildingId)
        .filter((apartment) => {
          const number = apartmentNumberValue(apartment.number);
          return number >= min && number <= max;
        })
        .forEach((apartment) => {
          state.equipment.filter((item) => item.apartmentId === apartment.id).forEach((item) => equipmentIds.add(item.id));
        });
    }
    if (!equipmentIds.size) {
      showToast("Sélectionnez au moins un équipement.");
      return;
    }
    const payload = {
      title: values.title,
      frequencyValue: Math.max(1, Number(values.frequencyValue || 1)),
      frequencyUnit: values.frequencyUnit || "years",
      startDate: values.startDate || today(),
      nextDueDate: values.nextDueDate || addDateInterval(values.startDate || today(), values.frequencyValue || 1, values.frequencyUnit || "years"),
      status: values.status || "active",
      notes: values.notes || ""
    };
    const existing = state.reminders.find((item) => item.id === values.id);
    const selectedEquipmentIds = Array.from(equipmentIds);
    let payloads = [];
    let successToast = "";
    if (existing) {
      Object.assign(existing, {
        ...payload,
        equipmentId: selectedEquipmentIds[0],
        lastSeenDueDate: existing.nextDueDate === payload.nextDueDate ? existing.lastSeenDueDate : ""
      });
      payloads = [existing];
      successToast = "Rappel modifié.";
    } else {
      payloads = selectedEquipmentIds.map((equipmentId) => ({
        id: uid("rem"),
        equipmentId,
        ...payload,
        createdAt: today(),
        lastSeenDueDate: ""
      }));
      payloads.slice().reverse().forEach((item) => state.reminders.unshift(item));
      successToast = equipmentIds.size > 1 ? "Rappels créés." : "Rappel créé.";
    }
    if (!SERVER_ENABLED) {
      setState({ modal: null, activeView: "alertes", toast: successToast });
      return;
    }
    updateUiState({ modal: null, activeView: "alertes", toast: "Sauvegarde du rappel..." });
    try {
      const response = payloads.length > 1 ? await api.saveReminders(payloads) : await api.saveReminder(payloads[0]);
      if (response.state) {
        rememberServerState(response.state);
        const uiState = currentUiState();
        state = {
          ...normalizeState(response.state),
          ...uiState,
          activeView: "alertes",
          sessionUserId: uiState.sessionUserId,
          modal: null,
          toast: successToast
        };
        render();
        scheduleToastClear();
      }
    } catch (error) {
      state.reminders = previousReminders;
      updateUiState({ modal: null, activeView: "alertes", toast: error.message || "Rappel non sauvegardé." });
    }
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
      ? (selectedPortalRights.length ? selectedPortalRights : defaultPortalRights(values.clientAccessLevel || "gestionnaire").filter((right) => right !== "portal"))
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
        rememberServerState(payload.state);
        const uiState = currentUiState();
        state = {
          ...normalizeState(payload.state),
          ...uiState,
          activeView: "utilisateurs",
          sessionUserId: uiState.sessionUserId,
          modal: null,
          toast: "Utilisateur supprimé."
        };
        render();
        scheduleToastClear();
      }
    } catch (error) {
      state.users = previousUsers;
      updateUiState({ modal: null, activeView: "utilisateurs", toast: error.message || "Utilisateur non supprimé." });
    }
  }

  async function saveServiceType(values) {
    const payload = {
      id: values.id || uid("appel"),
      name: values.name,
      defaultPriority: values.defaultPriority,
      linkedInterventionTypeId: values.linkedInterventionTypeId
    };
    const index = state.serviceTypes.findIndex((item) => item.id === payload.id);
    await saveSettingCollectionItem("serviceTypes", payload, index >= 0 ? "Type de demande modifié." : "Type de demande créé.");
  }

  async function saveInterventionType(values) {
    const payload = {
      id: values.id || uid("check"),
      name: values.name,
      defaultDuration: Number(values.defaultDuration || 60),
      checklist: values.checklist.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    };
    const index = state.interventionTypes.findIndex((item) => item.id === payload.id);
    await saveSettingCollectionItem("interventionTypes", payload, index >= 0 ? "Checklist modifiée." : "Checklist créée.");
  }

  async function saveDataField(form, values) {
    const appliesTo = Array.from(form.querySelectorAll('[name="appliesTo"]:checked')).map((input) => input.value);
    const payload = {
      id: values.id || uid("datafield"),
      name: values.name.trim(),
      group: values.group.trim() || "Non groupé",
      type: values.type || "single",
      appliesTo: appliesTo.length ? appliesTo : ["activity"],
      options: parseDataFieldOptions(values.options || "")
    };
    const index = state.dataFields.findIndex((item) => item.id === payload.id);
    await saveSettingCollectionItem("dataFields", payload, index >= 0 ? "Champ de données modifié." : "Champ de données créé.");
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

  async function saveFormTemplate(form, values) {
    const fields = Array.from(form.querySelectorAll("[data-question]")).map((card) => {
      const label = card.querySelector('[name="q-label"]')?.value.trim();
      if (!label) return null;
      const existingId = card.dataset.fieldId;
      const type = card.querySelector('[name="q-type"]')?.value || "text";
      if (type === "section") {
        return {
          id: existingId || slugify(label),
          label,
          type: "section",
          options: [],
          required: false,
          defaultValue: "",
          layout: "full",
          unitScope: card.querySelector('[name="q-unit-scope"]')?.value || "all",
          branchRules: {},
          nextFieldId: "",
          showWhen: null
        };
      }
      const nextFieldId = card.querySelector('[name="q-next-branch"]')?.value || "";
      const options = Array.from(card.querySelectorAll('[name="q-option"]')).map((input) => input.value.trim()).filter(Boolean);
      const defaultFromOptions = Array.from(card.querySelectorAll("[data-option-row]"))
        .filter((row) => row.querySelector('[name="q-option-default"]')?.checked)
        .map((row) => row.querySelector('[name="q-option"]')?.value.trim())
        .filter(Boolean);
      const typedDefault = card.querySelector('[name="q-default"]')?.value.trim() || "";
      const branchRules = Object.fromEntries(Array.from(card.querySelectorAll("[data-option-row]")).map((row) => {
        const option = row.querySelector('[name="q-option"]')?.value.trim();
        const target = row.querySelector('[name="q-option-branch"]')?.value || "";
        return option && target ? [option, target] : null;
      }).filter(Boolean));
      return {
        id: existingId || slugify(label),
        label,
        type,
        options,
        required: Boolean(card.querySelector('[name="q-required"]')?.checked),
        defaultValue: ["multiple", "checkbox"].includes(type) ? defaultFromOptions : (defaultFromOptions[0] || typedDefault),
        layout: card.querySelector('[name="q-layout"]')?.value || "full",
        unitScope: card.querySelector('[name="q-unit-scope"]')?.value || "all",
        branchRules,
        nextFieldId,
        showWhen: null
      };
    }).filter(Boolean);
    if (!fields.length) {
      showToast("Ajoutez au moins une question.");
      return;
    }
    const payload = {
      id: values.id || uid("form"),
      name: values.name,
      activityFields: collectActivityFieldSettings(form),
      fields
    };
    const index = state.formTemplates.findIndex((item) => item.id === payload.id);
    await saveSettingCollectionItem("formTemplates", payload, index >= 0 ? "Formulaire modifié." : "Formulaire créé.");
  }

  function parseOptions(value) {
    return value.split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean);
  }

  function collectActivityFieldSettings(form) {
    return Object.fromEntries(activityFieldCatalog().map(([key, label]) => [
      key,
      {
        label,
        required: Boolean(form.querySelector(`[name="activity-required-${key}"]`)?.checked),
        dataFieldId: form.querySelector(`[name="activity-datafield-${key}"]`)?.value || "",
        optionIds: Array.from(form.querySelectorAll(`[name="activity-option-${key}"]:checked`)).map((input) => input.value),
        options: parseOptions(form.querySelector(`[name="activity-options-${key}"]`)?.value || "")
      }
    ]));
  }

  function parseFormField(line) {
    const parts = line.split("|").map((part) => part.trim());
    if (!parts[0]) return null;
    const label = parts[0];
    const type = ["text", "long", "checkbox", "single", "multiple", "select"].includes(parts[1]) ? parts[1] : "text";
    const options = (parts[2] || "").split(",").map((option) => option.trim()).filter(Boolean);
    const condition = parts.find((part) => part.startsWith("show:"));
    return {
      id: slugify(label),
      label,
      type,
      options,
      showWhen: condition ? parseShowWhen(condition) : null
    };
  }

  function parseShowWhen(value) {
    const expression = value.replace(/^show:/, "");
    const [fieldId, expected] = expression.split("=");
    if (!fieldId || !expected) return null;
    return { fieldId: slugify(fieldId), value: expected.trim() };
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || uid("q");
  }

  async function saveRole(form, values) {
    const roleId = values.id || values.roleId.trim().toLowerCase().replace(/\s+/g, "_");
    const rights = rightsCatalog()
      .map(([right]) => right)
      .filter((right) => form.querySelector(`[name="right-${right}"]`)?.checked);
    const payload = { id: roleId, name: values.name, rights };
    const index = state.roleDefinitions.findIndex((item) => item.id === roleId);
    await saveSettingCollectionItem("roleDefinitions", payload, index >= 0 ? "Rôle modifié." : "Rôle créé.");
  }

  async function saveChecklist(form, values) {
    const orderId = form.dataset.orderId;
    const order = state.workOrders.find((item) => item.id === orderId);
    const type = state.interventionTypes.find((item) => item.id === order.typeId);
    const done = type.checklist.map((_, index) => form.querySelector(`[name="check-${index}"]`).checked);
    const existing = state.interventions.find((item) => item.workOrderId === orderId);
    const intervention = existing || {
      id: uid("int"),
      equipmentId: order.equipmentId,
      workOrderId: order.id,
      typeId: order.typeId,
      date: today(),
      technicianId: currentUser().role === "technicien" ? currentUser().id : order.technicianId,
      status: "terminee",
      summary: "",
      readings: {},
      checklistDone: []
    };
    intervention.summary = values.summary;
    intervention.readings = { soufflage: values.soufflage, retour: values.retour, pression: values.pression };
    intervention.checklistDone = done;
    if (!existing) state.interventions.unshift(intervention);
    order.status = done.every(Boolean) ? "termine" : "en_cours";
    const equipment = state.equipment.find((item) => item.id === order.equipmentId);
    if (equipment && done.every(Boolean)) {
      equipment.lastService = today();
      equipment.status = "actif";
      const next = new Date();
      next.setMonth(next.getMonth() + 6);
      equipment.nextService = next.toISOString().slice(0, 10);
    }
    await saveActivityBundle(equipment, intervention, order, { modal: null, activeView: "bons" }, "Checklist enregistrée.");
  }

  async function saveFieldIntervention(form, values) {
    const orderId = form.dataset.orderId;
    const order = state.workOrders.find((item) => item.id === orderId);
    const template = formTemplateForOrder(order);
    updateDynamicVisibility(form);
    if (!validateRequiredResponses(form, template)) return;
    const apartmentId = resolveActivityApartment(order, values);
    if (!apartmentId) return;
    const requestedEquipmentId = values.activityEquipmentId && values.activityEquipmentId !== "__new" ? values.activityEquipmentId : form.dataset.equipmentId;
    let equipment = state.equipment.find((item) => item.id === requestedEquipmentId);
    if (!equipment) {
      equipment = {
        id: uid("eq"),
        apartmentId,
        unitKind: values.unitKind || "interieure",
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location,
        installDate: today(),
        lastService: "",
        nextService: "",
        status: values.machineStatus || "actif",
        notes: values.equipmentNotes || ""
      };
      state.equipment.unshift(equipment);
    } else {
      Object.assign(equipment, {
        apartmentId,
        unitKind: values.unitKind || equipment.unitKind || "interieure",
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location
      });
    }
    const responses = collectFormResponses(form, template);
    const existing = state.interventions.find((item) => item.workOrderId === orderId && item.equipmentId === equipment.id);
    const intervention = existing || {
      id: uid("int"),
      equipmentId: equipment.id,
      apartmentId,
      workOrderId: order.id,
      typeId: order.typeId,
      date: today(),
      technicianId: currentUser().role === "technicien" ? currentUser().id : order.technicianId,
      status: "terminee",
      readings: {},
      checklistDone: []
    };
    intervention.apartmentId = apartmentId;
    intervention.formTemplateId = template?.id || "";
    intervention.formResponses = responses;
    intervention.activityStatus = values.activityStatus || "completee";
    intervention.machineStatus = values.machineStatus || equipment.status || "actif";
    intervention.unitKind = values.unitKind || equipment.unitKind || "interieure";
    intervention.equipmentNotes = values.equipmentNotes || "";
    const existingRecommendation = existing?.recommendation || {};
    intervention.recommendation = values.recommendationType ? {
      ...existingRecommendation,
      type: values.recommendationType,
      description: values.recommendationDescription || "",
      priority: values.recommendationPriority || "normale",
      part: values.recommendationPart || "",
      time: values.recommendationTime || "",
      status: existingRecommendation.status || "a_valider",
      createdAt: existingRecommendation.createdAt || today()
    } : null;
    intervention.summary = values.summary;
    let pendingAttachments = [];
    try {
      pendingAttachments = await collectAttachments(form, apartmentId, equipment.id);
    } catch (error) {
      showToast("Impossible de lire les fichiers joints.");
      return;
    }
    if (pendingAttachments === null) return;
    if (!existing) state.interventions.unshift(intervention);
    if (pendingAttachments.length) {
      const completedAttachments = pendingAttachments.map((file) => ({
        ...file,
        interventionId: intervention.id,
        workOrderId: order.id,
        sourceApartmentId: apartmentId,
        sourceBuildingId: state.apartments.find((item) => item.id === apartmentId)?.buildingId || "",
        sourceEquipmentId: equipment.id
      }));
      equipment.attachments = [...(equipment.attachments || []), ...completedAttachments];
      intervention.attachmentIds = [...(intervention.attachmentIds || []), ...completedAttachments.map((file) => file.id)];
      intervention.attachments = [...(intervention.attachments || []), ...completedAttachments.map((file) => ({
        id: file.id,
        name: file.name,
        type: file.type || file.fileType || "",
        size: file.size || file.fileSize || 0,
        fileName: file.fileName || file.name,
        fileType: file.fileType || file.type || "",
        fileSize: file.fileSize || file.size || 0,
        storageBucket: file.storageBucket || "",
        storagePath: file.storagePath || "",
        equipmentId: equipment.id,
        apartmentId,
        uploadedAt: file.uploadedAt || today(),
        uploadedBy: file.uploadedBy || currentUser()?.id || "",
        workOrderId: file.workOrderId,
        sourceApartmentId: file.sourceApartmentId,
        sourceBuildingId: file.sourceBuildingId
      }))];
    }
    equipment.lastService = today();
    equipment.status = intervention.machineStatus;
    if (!equipment.notes && values.equipmentNotes) equipment.notes = values.equipmentNotes;
    if (!equipment.nextService) {
      const next = new Date();
      next.setMonth(next.getMonth() + 6);
      equipment.nextService = next.toISOString().slice(0, 10);
    }
    if (order.status === "planifie") order.status = "en_cours";
    const progress = workOrderProgress(order);
    if (progress.totalApartments && progress.doneApartments === progress.totalApartments) order.status = "termine";
    if (["interieure", "exterieure"].includes(values.afterSave)) {
      await saveActivityBundle(equipment, intervention, order, {
        activeView: "execution",
        selectedWorkOrderId: order.id,
        selectedExecutionApartmentId: apartmentId,
        modal: { type: "fieldIntervention", orderId: order.id, apartmentId, unitKind: values.afterSave }
      }, values.afterSave === "exterieure" ? "Activité enregistrée. Nouvelle unité extérieure prête." : "Activité enregistrée. Nouvelle unité intérieure prête.");
      return;
    }
    await saveActivityBundle(equipment, intervention, order, {
      modal: null,
      activeView: "execution",
      selectedWorkOrderId: order.id,
      selectedExecutionApartmentId: apartmentId
    }, "Formulaire terrain enregistre.");
  }

  async function saveRecommendationReview(values) {
    const intervention = state.interventions.find((item) => item.id === values.interventionId);
    if (!intervention?.recommendation) return;
    if (values.status === "envoyee" && (!values.price || !values.delay)) {
      showToast("Ajoutez un prix et un délai avant d'envoyer au client.");
      return;
    }
    const previousStatus = intervention.recommendation.status;
    const previousMessage = intervention.recommendation.clientMessage || "";
    Object.assign(intervention.recommendation, {
      description: values.description || "",
      priority: values.priority || "normale",
      part: values.part || "",
      time: values.time || "",
      price: values.price || "",
      delay: values.delay || "",
      clientMessage: values.clientMessage || "",
      internalNote: values.internalNote || "",
      status: values.status || "a_valider",
      reviewedBy: currentUser()?.id || intervention.recommendation.reviewedBy || ""
    });
    if (intervention.recommendation.status === "envoyee" && previousStatus !== "envoyee") {
      intervention.recommendation.sentAt = today();
    }
    if (values.clientMessage && (values.clientMessage !== previousMessage || intervention.recommendation.status === "envoyee")) {
      addRecommendationMessage(intervention.recommendation, "interne", values.clientMessage);
    }
    await saveInterventionChange(intervention, { activeView: "recommandations" }, "Recommandation enregistrée.");
  }

  async function sendRecommendationToClient(interventionId) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    const recommendation = intervention?.recommendation;
    if (!recommendation) return;
    if (!recommendation.price || !recommendation.delay) {
      showToast("Ajoutez un prix et un délai avant d'envoyer au client.");
      setState({ modal: { type: "recommendationReview", id: interventionId }, activeView: "recommandations" });
      return;
    }
    recommendation.status = "envoyee";
    recommendation.sentAt = today();
    recommendation.reviewedBy = currentUser()?.id || recommendation.reviewedBy || "";
    addRecommendationMessage(recommendation, "interne", recommendation.clientMessage || recommendation.description);
    await saveInterventionChange(intervention, { activeView: "recommandations" }, "Recommandation envoyée au client.");
  }

  async function saveRecommendationReply(values) {
    const intervention = state.interventions.find((item) => item.id === values.interventionId);
    const recommendation = intervention?.recommendation;
    if (!recommendation) return;
    recommendation.clientMessage = values.reply || recommendation.clientMessage || "";
    recommendation.status = "envoyee";
    recommendation.sentAt = today();
    recommendation.reviewedBy = currentUser()?.id || recommendation.reviewedBy || "";
    addRecommendationMessage(recommendation, "interne", values.reply);
    await saveInterventionChange(intervention, { activeView: "recommandations" }, "Réponse envoyée au client.");
  }

  async function clientRecommendationDecision(interventionId, status) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    const recommendation = intervention?.recommendation;
    if (!recommendation || recommendation.status !== "envoyee") return;
    if (status === "approuvee" && !confirm("Approuver cette recommandation?")) return;
    recommendation.status = status;
    recommendation.decisionAt = today();
    recommendation.decidedBy = currentUser()?.id || "";
    if (status === "approuvee") addRecommendationMessage(recommendation, "client", "Recommandation approuvée.");
    await saveInterventionChange(intervention, { activeView: "recommandations" }, status === "approuvee" ? "Recommandation approuvée." : status === "refusee" ? "Recommandation refusée." : "Demande d'information envoyée.");
  }

  async function saveClientRecommendationMessage(values) {
    const intervention = state.interventions.find((item) => item.id === values.interventionId);
    const recommendation = intervention?.recommendation;
    if (!recommendation || recommendation.status !== "envoyee") return;
    recommendation.status = values.status === "refusee" ? "refusee" : "information_demandee";
    recommendation.clientComment = values.clientComment || "";
    recommendation.decisionAt = today();
    recommendation.decidedBy = currentUser()?.id || "";
    addRecommendationMessage(recommendation, "client", values.clientComment);
    await saveInterventionChange(intervention, { activeView: "recommandations" }, recommendation.status === "refusee" ? "Recommandation refusée." : "Demande d'information envoyée.");
  }

  async function saveClientDocument(form, values) {
    const existing = state.clientDocuments.find((item) => item.id === values.id);
    const file = form.querySelector('[name="documentFile"]')?.files?.[0];
    if (!existing && !file) {
      showToast("Ajoutez un fichier.");
      return;
    }
    if (file && !SERVER_ENABLED) {
      showToast("L'envoi de documents exige le mode serveur.");
      return;
    }
    let fileData = {};
    if (file) {
      if (file.size > documentsModule.limits.documentMaxBytes) {
        showToast(`${file.name} dépasse 10 MB.`);
        return;
      }
      try {
        const formData = new FormData();
        formData.append("kind", "clientDocument");
        formData.append("id", existing?.id || uid("doc"));
        formData.append("clientId", values.clientId);
        formData.append("buildingId", values.buildingId || "");
        formData.append("apartmentId", values.apartmentId || "");
        formData.append("equipmentId", values.equipmentId || "");
        formData.append("type", values.type || "Document");
        formData.append("name", values.name);
        formData.append("notes", values.notes || "");
        formData.append("visibleToClient", Boolean(values.visibleToClient) ? "true" : "false");
        formData.append("file", file);
        const response = await api.uploadFile(formData);
        if (response.state) {
          rememberServerState(response.state);
          const uiState = currentUiState();
          state = {
            ...normalizeState(response.state),
            ...uiState,
            activeView: values.buildingId ? "lieu_detail" : "lieux",
            selectedBuildingId: values.buildingId || state.selectedBuildingId,
            modal: null,
            toast: existing ? "Document modifié." : "Document ajouté.",
            sessionUserId: uiState.sessionUserId
          };
          render();
          scheduleToastClear();
          return;
        }
        fileData = response.file || {};
      } catch (error) {
        showToast(error.message || "Document non envoyé.");
        return;
      }
    }
    const payload = {
      id: existing?.id || uid("doc"),
      clientId: values.clientId,
      buildingId: values.buildingId || "",
      apartmentId: values.apartmentId || "",
      equipmentId: values.equipmentId || "",
      type: values.type || "Document",
      name: values.name,
      notes: values.notes || "",
      visibleToClient: Boolean(values.visibleToClient),
      uploadedAt: existing?.uploadedAt || today(),
      uploadedBy: existing?.uploadedBy || currentUser()?.id || "",
      fileName: fileData.fileName || existing?.fileName || values.name,
      fileType: fileData.fileType || existing?.fileType || "",
      fileSize: fileData.fileSize || existing?.fileSize || 0,
      storageBucket: fileData.storageBucket || existing?.storageBucket || "",
      storagePath: fileData.storagePath || existing?.storagePath || "",
      dataUrl: existing?.dataUrl || ""
    };
    const index = state.clientDocuments.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.clientDocuments[index] = payload;
    else state.clientDocuments.unshift(payload);
    setState({
      modal: null,
      activeView: payload.buildingId ? "lieu_detail" : "lieux",
      selectedBuildingId: payload.buildingId || state.selectedBuildingId,
      toast: index >= 0 ? "Document modifié." : "Document ajouté."
    });
  }

  async function createWorkOrderFromRecommendation(interventionId) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    const recommendation = intervention?.recommendation;
    if (!intervention || recommendation?.status !== "approuvee") return;
    const previousWorkOrders = JSON.parse(JSON.stringify(state.workOrders));
    const previousInterventions = JSON.parse(JSON.stringify(state.interventions));
    const repairType = state.interventionTypes.find((item) => /réparation|reparation|diagnostic/i.test(item.name)) || state.interventionTypes[0];
    const technician = state.users.find((user) => user.role === "technicien");
    const number = `BT-${new Date().getFullYear()}-${String(state.workOrders.length + 1).padStart(3, "0")}`;
    const order = {
      id: uid("wo"),
      number,
      ticketId: null,
      scope: "equipment",
      buildingId: "",
      equipmentId: intervention.equipmentId,
      typeId: repairType?.id || "",
      formTemplateId: state.formTemplates[0]?.id || "",
      technicianId: technician?.id || "",
      scheduledDate: today(),
      status: "planifie",
      notes: `Recommandation approuvée: ${dataFieldLabelByValue("recommendation_type", recommendation.type)}. ${recommendation.clientMessage || recommendation.description || ""}`
    };
    state.workOrders.unshift(order);
    recommendation.workOrderId = order.id;
    const uiPatch = { activeView: "bons" };
    updateUiState({ ...uiPatch, toast: "Création du BT..." });
    try {
      await saveDomainItemNow(api.saveWorkOrder, order, uiPatch, `BT créé: ${order.number}`);
      const interventionPayload = await api.saveIntervention(intervention);
      if (interventionPayload.state) {
        rememberServerState(interventionPayload.state);
        const uiState = currentUiState();
        state = {
          ...normalizeState(interventionPayload.state),
          ...uiState,
          ...uiPatch,
          sessionUserId: uiState.sessionUserId,
          modal: null,
          toast: `BT créé: ${order.number}`
        };
        render();
        scheduleToastClear();
      }
    } catch (error) {
      state.workOrders = previousWorkOrders;
      state.interventions = previousInterventions;
      updateUiState({ ...uiPatch, toast: error.message || "BT non créé." });
    }
  }

  function resolveActivityApartment(order, values) {
    if (values.apartmentId && values.apartmentId !== "__new") return values.apartmentId;
    if (!values.newApartmentNumber?.trim()) {
      showToast("Entrez le numéro du nouvel appartement.");
      return null;
    }
    const context = workOrderContext(order);
    const buildingId = order.buildingId || context.building?.id || state.selectedBuildingId;
    if (!buildingId) {
      showToast("Aucun immeuble trouvé pour créer l'appartement.");
      return null;
    }
    const existing = state.apartments.find((item) => item.buildingId === buildingId && item.number.trim().toLowerCase() === values.newApartmentNumber.trim().toLowerCase());
    if (existing) return existing.id;
    const apartment = {
      id: uid("apt"),
      buildingId,
      number: values.newApartmentNumber.trim(),
      occupant: values.newApartmentOccupant || ""
    };
    state.apartments.push(apartment);
    return apartment.id;
  }

  function collectFormResponses(form, template) {
    const responses = {};
    (template?.fields || []).forEach((field) => {
      if (field.type === "section") return;
      const wrapper = form.querySelector(`[name="field-${field.id}"]`)?.closest(".dynamic-field, .check-row");
      if (wrapper?.classList.contains("hidden")) return;
      const inputs = Array.from(form.querySelectorAll(`[name="field-${field.id}"]`));
      if (!inputs.length) return;
      if (["checkbox", "multiple"].includes(field.type)) {
        responses[field.label] = inputs.filter((input) => input.checked).map((input) => input.value);
      } else if (field.type === "single") {
        responses[field.label] = inputs.find((input) => input.checked)?.value || "";
      } else {
        responses[field.label] = inputs[0].value || "";
      }
    });
    return responses;
  }

  async function collectAttachments(form, apartmentId, equipmentId) {
    const input = form.querySelector('[name="attachments"]');
    const files = Array.from(input?.files || []);
    if (files.length > 3) {
      showToast("Maximum 3 fichiers par activité.");
      return null;
    }
    const oversized = files.find((file) => file.size > documentsModule.limits.attachmentMaxBytes);
    if (oversized) {
      showToast(`${oversized.name} dépasse 15 MB.`);
      return null;
    }
    if (!SERVER_ENABLED) {
      showToast("L'envoi de fichiers exige le mode serveur.");
      return null;
    }
    try {
      const orderId = form.dataset.orderId || "";
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("kind", "interventionAttachment");
        formData.append("name", file.name);
        formData.append("apartmentId", apartmentId || "");
        formData.append("equipmentId", equipmentId || "");
        formData.append("workOrderId", orderId);
        formData.append("sourceApartmentId", apartmentId || "");
        formData.append("file", file);
        const response = await api.uploadFile(formData);
        uploaded.push(response.file);
      }
      return uploaded;
    } catch (error) {
      showToast(error.message || "Fichier non envoyé.");
      return null;
    }
  }

  function validateRequiredResponses(form, template) {
    const missing = (template?.fields || []).find((field) => {
      if (field.type === "section") return false;
      if (!field.required) return false;
      const wrapper = form.querySelector(`[name="field-${field.id}"]`)?.closest(".dynamic-field, .check-row");
      if (wrapper?.classList.contains("hidden")) return false;
      const inputs = Array.from(form.querySelectorAll(`[name="field-${field.id}"]`));
      if (!inputs.length) return true;
      if (["checkbox", "multiple"].includes(field.type)) return !inputs.some((input) => input.checked);
      if (field.type === "single") return !inputs.some((input) => input.checked);
      return !inputs[0].value.trim();
    });
    if (missing) {
      showToast(`Champ obligatoire: ${missing.label}`);
      return false;
    }
    return true;
  }

  function exportReport(type) {
    let rows = [];
    let filename = "";
    if (type === "equipment") {
      filename = "inventaire-hvac.csv";
      rows = scopedEquipment().map((item) => {
        const { apartment, building, client } = equipmentContext(item.id);
        return {
          client: client?.name,
          immeuble: building?.name,
          appartement: apartment?.number,
          equipement: item.type,
          marque: item.brand,
          modele: item.model,
          serie: item.serial,
          unite: item.unitKind === "exterieure" ? "Unité extérieure" : "Unité intérieure",
          statut: statusText(item.status),
          dernier_service: item.lastService,
          prochain_service: item.nextService
        };
      });
    }
    if (type === "interventions") {
      filename = "interventions-hvac.csv";
      const equipmentIds = scopedEquipment().map((item) => item.id);
      rows = state.interventions.filter((item) => equipmentIds.includes(item.equipmentId)).map((item) => {
        const { apartment, building } = equipmentContext(item.equipmentId);
        const tech = state.users.find((user) => user.id === item.technicianId);
        const interventionType = state.interventionTypes.find((entry) => entry.id === item.typeId);
        return {
          date: item.date,
          immeuble: building?.name,
          appartement: apartment?.number,
          type: interventionType?.name,
          technicien: tech?.name,
          unite: item.unitKind === "exterieure" ? "Unité extérieure" : "Unité intérieure",
          statut_activite: statusText(item.activityStatus || item.status),
          statut_machine: statusText(item.machineStatus),
          recommandation: dataFieldLabelByValue("recommendation_type", item.recommendation?.type),
          recommandation_priorite: statusText(item.recommendation?.priority),
          piece_necessaire: item.recommendation?.part,
          temps_prevu: item.recommendation?.time,
          recommandation_statut: statusText(item.recommendation?.status),
          resume: item.summary,
          mesures: Object.entries(item.readings || {}).map(([key, value]) => `${key}: ${value}`).join(" | "),
          formulaire: Object.entries(item.formResponses || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" | ")
        };
      });
    }
    if (type === "operations") {
      filename = "operations-hvac.csv";
      rows = [
        ...scopedTickets().map((ticket) => {
          const { apartment, building, equipment } = equipmentContext(ticket.equipmentId);
          return {
            nature: "Demande client",
            reference: ticket.number || ticket.id,
            date: ticket.createdAt,
            immeuble: building?.name,
            appartement: apartment?.number,
            equipement: equipment?.type,
            statut: statusText(ticket.status),
            detail: ticket.title
          };
        }),
        ...scopedWorkOrders().map((order) => {
          const { apartment, building, equipment } = workOrderContext(order);
          return {
            nature: "Bon de travail",
            reference: order.number,
            date: order.scheduledDate,
            immeuble: building?.name,
            appartement: apartment?.number || (order.buildingId ? "Bloc complet" : ""),
            equipement: equipment?.type || "",
            statut: statusText(order.status),
            detail: order.notes
          };
        })
      ];
    }
    downloadCsv(filename, rows);
    showToast("Rapport CSV téléchargé.");
  }

  function statusText(status) {
    if (!status) return "";
    const html = statusBadge(status);
    return html.replace(/<[^>]+>/g, "");
  }

  function fieldTypeLabel(type) {
    return {
      text: "champ ouvert",
      long: "texte long",
      checkbox: "case a cocher",
      single: "selection unique",
      multiple: "selection multiple",
      select: "liste déroulante",
      section: "section"
    }[type] || type;
  }

  function downloadCsv(filename, rows) {
    if (!rows.length) {
      showToast("Aucune donnée à exporter.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(";"),
      ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(";"))
    ].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function showToast(message) {
    updateUiState({ toast: message });
  }

  function bindEvents() {
    const app = document.getElementById("app");
    app.addEventListener("submit", handleSubmit);
    app.addEventListener("click", async (event) => {
      const modalCard = event.target.closest("[data-modal-card]");
      const target = event.target.closest("[data-action]");
      if (!event.target.closest(".combo-field")) hideComboOptions();
      if (!target) return;
      const action = target.dataset.action;
      if (action === "close-modal" && modalCard && target.classList.contains("modal-backdrop")) return;
      if (action === "logout") logout();
      if (action === "combo-option") {
        chooseComboOption(target);
        return;
      }
      if (action === "clear-global-search") {
        updateUiState({ globalSearch: "" });
        return;
      }
      if (action === "open-search-result") {
        openSearchResult(target);
        return;
      }
      if (action === "go-back") {
        goBack({ activeView: target.dataset.fallbackView || "tableau" });
        return;
      }
      if (action === "view") updateUiState({ activeView: target.dataset.view, modal: null, mobileMenuOpen: false });
      if (action === "toggle-mobile-menu") {
        updateUiState({ mobileMenuOpen: !state.mobileMenuOpen });
        return;
      }
      if (action === "close-mobile-menu") {
        updateUiState({ mobileMenuOpen: false });
        return;
      }
      if (action === "toggle-sidebar-pin") {
        setState({
          sidebarMode: state.sidebarMode === "fixed" ? "auto" : "fixed",
          toast: state.sidebarMode === "fixed" ? "Menu replié par défaut." : "Menu épinglé."
        });
        return;
      }
      if (action === "select-building") updateUiState({ selectedBuildingId: target.dataset.id, activeView: "lieu_detail" });
      if (action === "select-equipment") updateUiState({ selectedEquipmentId: target.dataset.id, activeView: "detail" });
      if (action === "dashboard-ticket") {
        updateUiState({ activeView: "appels", modal: currentUser()?.role === "client" ? null : { type: "ticket", id: target.dataset.id } });
        return;
      }
      if (action === "dashboard-workorder") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        if ((can("workorders") || currentUser()?.role === "technicien") && order) {
          const firstApartment = workOrderApartments(order)[0];
          updateUiState({ selectedWorkOrderId: order.id, selectedExecutionApartmentId: firstApartment?.id || null, activeView: "execution", modal: null });
          return;
        }
        updateUiState({ activeView: "bons", modal: null });
        return;
      }
      if (action === "open-intervention-workorder") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        if (order) {
          const firstApartment = workOrderApartments(order)[0];
          updateUiState({ selectedWorkOrderId: order.id, selectedExecutionApartmentId: firstApartment?.id || null, activeView: "execution", modal: null });
        }
        return;
      }
      if (action === "open-modal") {
        if (target.dataset.modal === "workorder" && !canCreateWorkOrders()) {
          updateUiState({ toast: "Accès réservé à l'équipe interne." });
          return;
        }
        updateUiState({ modal: {
          type: target.dataset.modal,
          id: target.dataset.id || null,
          equipmentId: target.dataset.equipment || null,
          ticketId: target.dataset.ticket || null,
          buildingId: target.dataset.building || null,
          clientId: target.dataset.client || null,
          apartmentId: target.dataset.apartment || null,
          unitKind: target.dataset.unitKind || null,
          decisionStatus: target.dataset.status || null,
          orderId: target.dataset.order || null,
          reminderId: target.dataset.reminder || null
        } });
      }
      if (action === "close-modal") {
        updateUiState({ modal: null });
        return;
      }
      if (action === "delete-apartment") {
        deleteApartment(target.dataset.id);
        return;
      }
      if (action === "delete-user") {
        deleteUser(target.dataset.id);
        return;
      }
      if (action === "open-checklist") updateUiState({ modal: { type: "checklist", orderId: target.dataset.id } });
      if (action === "execute-workorder") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        const firstApartment = workOrderApartments(order)[0];
        updateUiState({ selectedWorkOrderId: target.dataset.id, selectedExecutionApartmentId: firstApartment?.id || null, activeView: "execution", modal: null });
      }
      if (action === "select-execution-apartment") {
        updateUiState({ selectedExecutionApartmentId: target.dataset.id });
      }
      if (action === "preview-attachment") {
        openAttachmentPreview(target.dataset.id);
        return;
      }
      if (action === "download-attachment") {
        downloadAttachment(target.dataset.id);
        return;
      }
      if (action === "toggle-dashboard-edit") {
        updateUiState({ dashboardEditMode: !state.dashboardEditMode });
        return;
      }
      if (action === "dashboard-calendar-month") {
        updateUiState({ dashboardCalendarDate: monthStart(addDateInterval(state.dashboardCalendarDate || today(), Number(target.dataset.direction || 0), "months")) });
        return;
      }
      if (action === "add-form-question") {
        addFormQuestion(target.closest("form"));
        return;
      }
      if (action === "add-form-section") {
        addFormSection(target.closest("form"));
        return;
      }
      if (action === "duplicate-form-question") {
        duplicateFormQuestion(target.closest("[data-question]"));
        return;
      }
      if (action === "add-form-option") {
        addFormOption(target.closest("[data-question]"));
        return;
      }
      if (action === "add-other-option") {
        addFormOption(target.closest("[data-question]"), "Autre");
        return;
      }
      if (action === "remove-form-option") {
        if (!confirm("Supprimer cette option?")) return;
        removeFormOption(target.closest("[data-option-row]"));
        return;
      }
      if (action === "remove-form-question") {
        if (!confirm("Supprimer cette question?")) return;
        removeFormQuestion(target.closest("[data-question]"));
        return;
      }
      if (action === "duplicate-form-template") {
        await duplicateFormTemplate(target.dataset.id);
        return;
      }
      if (action === "ticket-status") {
        const ticket = state.tickets.find((item) => item.id === target.dataset.id);
        if (ticket) {
          ticket.status = target.dataset.status;
          ticket.closedAt = target.dataset.status === "ferme" ? ticket.closedAt || today() : "";
        }
        setState({ toast: "Statut de la demande mis à jour." });
      }
      if (action === "order-status") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        if (order) order.status = target.dataset.status;
        setState({ toast: "Statut du BT mis à jour." });
      }
      if (action === "reminder-status") {
        const reminder = state.reminders.find((item) => item.id === target.dataset.id);
        if (!reminder) return;
        const previousReminders = JSON.parse(JSON.stringify(state.reminders));
        reminder.status = target.dataset.status;
        if (!SERVER_ENABLED) {
          setState({ toast: "Statut du rappel mis à jour." });
          return;
        }
        updateUiState({ toast: "Sauvegarde du rappel..." });
        try {
          await saveDomainItemNow(api.saveReminder, reminder, { activeView: "alertes" }, "Statut du rappel mis à jour.");
        } catch (error) {
          state.reminders = previousReminders;
          updateUiState({ toast: error.message || "Statut du rappel non sauvegardé." });
        }
      }
      if (action === "mark-reminder-seen") {
        const reminder = state.reminders.find((item) => item.id === target.dataset.id);
        if (!reminder) return;
        const previousReminders = JSON.parse(JSON.stringify(state.reminders));
        reminder.lastSeenDueDate = reminder.nextDueDate;
        if (!SERVER_ENABLED) {
          setState({ toast: "Rappel marqué comme vu." });
          return;
        }
        updateUiState({ toast: "Sauvegarde du rappel..." });
        try {
          await saveDomainItemNow(api.saveReminder, reminder, { activeView: "alertes" }, "Rappel marqué comme vu.");
        } catch (error) {
          state.reminders = previousReminders;
          updateUiState({ toast: error.message || "Rappel non sauvegardé." });
        }
      }
      if (action === "mark-reminders-seen") {
        const previousReminders = JSON.parse(JSON.stringify(state.reminders));
        const updatedReminders = [];
        scopedReminders().forEach((reminder) => {
          if (reminderIsDue(reminder)) {
            reminder.lastSeenDueDate = reminder.nextDueDate;
            updatedReminders.push(reminder);
          }
        });
        if (!updatedReminders.length) return;
        if (!SERVER_ENABLED) {
          setState({ toast: "Alertes marquées comme vues." });
          return;
        }
        updateUiState({ toast: "Sauvegarde des alertes..." });
        try {
          const response = await api.saveReminders(updatedReminders);
          if (response.state) {
            rememberServerState(response.state);
            const uiState = currentUiState();
            state = {
              ...normalizeState(response.state),
              ...uiState,
              activeView: "alertes",
              sessionUserId: uiState.sessionUserId,
              toast: "Alertes marquées comme vues."
            };
            render();
            scheduleToastClear();
          }
        } catch (error) {
          state.reminders = previousReminders;
          updateUiState({ toast: error.message || "Alertes non sauvegardées." });
        }
      }
      if (action === "delete-reminder") {
        if (!confirm("Supprimer ce rappel?")) return;
        const previousReminders = JSON.parse(JSON.stringify(state.reminders));
        state.reminders = state.reminders.filter((item) => item.id !== target.dataset.id);
        if (!SERVER_ENABLED) {
          setState({ activeView: "alertes", toast: "Rappel supprimé." });
          return;
        }
        updateUiState({ activeView: "alertes", toast: "Suppression du rappel..." });
        try {
          const response = await api.deleteReminder(target.dataset.id);
          if (response.state) {
            rememberServerState(response.state);
            const uiState = currentUiState();
            state = {
              ...normalizeState(response.state),
              ...uiState,
              activeView: "alertes",
              sessionUserId: uiState.sessionUserId,
              toast: "Rappel supprimé."
            };
            render();
            scheduleToastClear();
          }
        } catch (error) {
          state.reminders = previousReminders;
          updateUiState({ activeView: "alertes", toast: error.message || "Rappel non supprimé." });
        }
      }
      if (action === "send-recommendation") {
        sendRecommendationToClient(target.dataset.id);
        return;
      }
      if (action === "client-recommendation") {
        clientRecommendationDecision(target.dataset.id, target.dataset.status);
        return;
      }
      if (action === "create-bt-from-recommendation") {
        createWorkOrderFromRecommendation(target.dataset.id);
        return;
      }
      if (action === "export") exportReport(target.dataset.report);
    });
    app.addEventListener("change", async (event) => {
      handleFilter(event);
      handleWorkOrderFilter(event);
      await handleReportFilter(event);
      handleDashboardWidgetSize(event);
      handleDashboardCalendarDate(event);
      updateDynamicVisibility(event.target.closest("form"));
      updateNewApartmentVisibility(event.target.closest("form"));
      updateRecommendationVisibility(event.target.closest("form"));
      if (event.target.matches("[data-activity-equipment-select]")) populateActivityEquipment(event.target);
      if (event.target.name === "q-type") updateQuestionOptionEditor(event.target.closest("[data-question]"));
      if (event.target.name?.startsWith("activity-datafield-")) updateActivityOptionPicker(event.target);
    });
    app.addEventListener("input", (event) => {
      if (event.target.dataset.action === "global-search") {
        updateGlobalSearch(event.target);
        return;
      }
      if (event.target.matches("[data-phone-input]")) {
        event.target.value = formatCanadianPhone(event.target.value);
      }
      updateDynamicVisibility(event.target.closest("form"));
      if (event.target.matches("[data-combo-input]")) updateComboOptions(event.target);
      if (event.target.name === "q-label") refreshFormBranching(event.target.closest("form"));
    });
    app.addEventListener("focusin", (event) => {
      if (event.target.matches("[data-combo-input]")) updateComboOptions(event.target);
    });
    app.addEventListener("dragstart", handleQuestionDragStart);
    app.addEventListener("dragover", handleQuestionDragOver);
    app.addEventListener("drop", handleQuestionDrop);
    app.addEventListener("dragend", () => {
      document.querySelectorAll("[data-dashboard-widget].dragging").forEach((card) => card.classList.remove("dragging"));
      draggedDashboardWidget = null;
      draggedQuestion = null;
      draggedOption = null;
    });
  }

  function updateNewApartmentVisibility(form) {
    if (!form || form.dataset.form !== "fieldIntervention") return;
    const isNew = form.querySelector('[name="apartmentId"]')?.value === "__new";
    form.querySelectorAll(".new-apartment-field").forEach((field) => {
      field.classList.toggle("hidden", !isNew);
      field.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !isNew;
        if (input.name === "newApartmentNumber") input.required = isNew;
      });
    });
  }

  function updateRecommendationVisibility(form) {
    if (!form || form.dataset.form !== "fieldIntervention") return;
    const hasRecommendation = Boolean(form.querySelector("[data-recommendation-select]")?.value);
    form.querySelectorAll("[data-recommendation-details]").forEach((section) => {
      section.classList.toggle("hidden", !hasRecommendation);
      section.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !hasRecommendation;
      });
    });
  }

  function populateActivityEquipment(select) {
    const form = select.closest("form");
    const equipment = state.equipment.find((item) => item.id === select.value);
    if (!form) return;
    form.dataset.equipmentId = equipment?.id || "";
    ["type", "location", "brand", "model", "serial"].forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.value = equipment ? equipment[name === "location" ? "location" : name] || "" : "";
    });
    const unitKind = form.querySelector('[name="unitKind"]');
    if (unitKind && equipment?.unitKind) unitKind.value = equipment.unitKind;
    const machineStatus = form.querySelector('[name="machineStatus"]');
    if (machineStatus) machineStatus.value = "";
    const notes = form.querySelector('[name="equipmentNotes"]');
    if (notes) notes.value = "";
    hideComboOptions();
  }

  function addFormQuestion(form) {
    if (!form) return;
    const list = form.querySelector("[data-question-list]");
    const fields = currentBuilderFields(form);
    list.insertAdjacentHTML("beforeend", formBuilderQuestion({ id: uid("q"), label: "", type: "select", options: [""], showWhen: null, layout: "full", defaultValue: "" }, fields.length, fields));
    refreshFormBranching(form);
  }

  function addFormSection(form) {
    if (!form) return;
    const list = form.querySelector("[data-question-list]");
    const fields = currentBuilderFields(form);
    list.insertAdjacentHTML("beforeend", formBuilderQuestion({ id: uid("section"), label: "", type: "section", options: [], showWhen: null, layout: "full" }, fields.length, fields));
    refreshFormBranching(form);
  }

  function duplicateFormQuestion(card) {
    if (!card) return;
    const form = card.closest("form");
    const clone = card.cloneNode(true);
    clone.dataset.fieldId = uid("q");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    card.insertAdjacentElement("afterend", clone);
    refreshFormBranching(form);
  }

  function addFormOption(card, value = "") {
    if (!card) return;
    const list = card.querySelector("[data-option-list]");
    const form = card.closest("form");
    const fields = currentBuilderFields(form);
    const targetOptions = formBranchTargets(fields, card.dataset.fieldId);
    list.insertAdjacentHTML("beforeend", formOptionRow(value, { defaultValue: "", branchRules: {} }, targetOptions));
  }

  function updateQuestionOptionEditor(card) {
    if (!card) return;
    const type = card.querySelector('[name="q-type"]')?.value;
    const show = choiceFieldTypes().includes(type);
    const list = card.querySelector("[data-option-list]");
    const actions = card.querySelector(".option-actions");
    list?.classList.toggle("hidden", !show);
    actions?.classList.toggle("hidden", !show);
    if (show && list && !list.querySelector("[data-option-row]")) {
      addFormOption(card);
    }
  }

  function updateActivityOptionPicker(select) {
    const key = select.name.replace("activity-datafield-", "");
    const card = select.closest("[data-activity-field]");
    const list = card?.querySelector(".option-chip-list");
    const field = state.dataFields.find((item) => item.id === select.value);
    if (!list) return;
    list.innerHTML = (field?.options || []).map((option) => `
      <label><input type="checkbox" name="activity-option-${key}" value="${escapeHtml(option.id)}"> ${escapeHtml(option.label)}</label>
    `).join("") || `<span class="meta">Aucune option dans ce champ.</span>`;
  }

  function removeFormOption(row) {
    if (!row) return;
    const list = row.closest("[data-option-list]");
    if (list.querySelectorAll("[data-option-row]").length <= 1) {
      row.querySelector('[name="q-option"]').value = "";
      return;
    }
    row.remove();
  }

  function removeFormQuestion(card) {
    if (!card) return;
    const form = card.closest("form");
    if (form.querySelectorAll("[data-question]").length <= 1) {
      showToast("Gardez au moins une question.");
      return;
    }
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
    copy.fields = copy.fields.map((field) => ({
      ...field,
      id: idMap[field.id],
      showWhen: field.showWhen ? { ...field.showWhen, fieldId: idMap[field.showWhen.fieldId] || field.showWhen.fieldId } : null,
      nextFieldId: idMap[field.nextFieldId] || field.nextFieldId || "",
      branchRules: Object.fromEntries(Object.entries(field.branchRules || {}).map(([option, target]) => [option, idMap[target] || target]))
    }));
    await saveSettingCollectionItem(
      "formTemplates",
      copy,
      "Formulaire dupliqué.",
      { modal: { type: "formTemplate", id: copy.id }, activeView: "parametres" }
    );
  }

  function currentBuilderFields(form) {
    return Array.from(form.querySelectorAll("[data-question]")).map((card) => {
      if (!card.dataset.fieldId) card.dataset.fieldId = uid("q");
      return {
        id: card.dataset.fieldId,
        label: card.querySelector('[name="q-label"]')?.value.trim() || "Question sans titre"
      };
    });
  }

  function refreshFormBranching(form) {
    if (!form || form.dataset.form !== "formTemplate") return;
    const fields = currentBuilderFields(form);
    form.querySelectorAll("[data-question]").forEach((card) => {
      const branchOptions = fields
        .filter((field) => field.id !== card.dataset.fieldId)
        .map((field, index) => `<option value="${escapeHtml(field.id)}">${index + 1}. ${escapeHtml(field.label)}</option>`)
        .join("");
      const nextSelect = card.querySelector('[name="q-next-branch"]');
      if (nextSelect) {
        const selected = nextSelect.value;
        nextSelect.innerHTML = `<option value="">Suivant</option><option value="__end">Fin du formulaire</option>${branchOptions}`;
        nextSelect.value = selected;
      }
      card.querySelectorAll('[name="q-option-branch"]').forEach((branchSelect) => {
        const selected = branchSelect.value;
        branchSelect.innerHTML = `<option value="">Suivant</option><option value="__end">Fin du formulaire</option>${branchOptions}`;
        branchSelect.value = selected;
      });
    });
  }

  function updateComboOptions(input) {
    const field = input.closest(".combo-field");
    const list = field?.querySelector("[data-combo-options]");
    if (!list) return;
    const query = input.value.trim().toLowerCase();
    const buttons = Array.from(list.querySelectorAll("button[data-value]"));
    let visibleCount = 0;
    buttons.forEach((button) => {
      const visible = !query || button.dataset.value.toLowerCase().includes(query);
      button.classList.toggle("hidden", !visible);
      if (visible) visibleCount += 1;
    });
    list.classList.toggle("hidden", visibleCount === 0);
  }

  function chooseComboOption(button) {
    const field = button.closest(".combo-field");
    const input = field?.querySelector("[data-combo-input]");
    if (!input) return;
    input.value = button.dataset.value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    field.querySelector("[data-combo-options]")?.classList.add("hidden");
    input.blur();
  }

  function hideComboOptions() {
    document.querySelectorAll("[data-combo-options]").forEach((list) => list.classList.add("hidden"));
  }

  let draggedQuestion = null;
  let draggedOption = null;
  let draggedDashboardWidget = null;

  function handleDashboardDragStart(event) {
    const card = event.target.closest("[data-dashboard-widget]");
    if (!card || !state.dashboardEditMode) return false;
    draggedDashboardWidget = card.dataset.dashboardWidget;
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    return true;
  }

  function handleDashboardDragOver(event) {
    const card = event.target.closest("[data-dashboard-widget]");
    if (!card || !draggedDashboardWidget || card.dataset.dashboardWidget === draggedDashboardWidget) return false;
    event.preventDefault();
    return true;
  }

  function handleDashboardDrop(event) {
    const card = event.target.closest("[data-dashboard-widget]");
    if (!card || !draggedDashboardWidget || card.dataset.dashboardWidget === draggedDashboardWidget) return false;
    event.preventDefault();
    const layout = dashboardLayoutForCurrentUser();
    const from = layout.findIndex((item) => item.id === draggedDashboardWidget);
    const to = layout.findIndex((item) => item.id === card.dataset.dashboardWidget);
    if (from >= 0 && to >= 0) {
      const [item] = layout.splice(from, 1);
      layout.splice(to, 0, item);
      saveDashboardLayout(layout);
    }
    draggedDashboardWidget = null;
    return true;
  }

  function handleQuestionDragStart(event) {
    if (handleDashboardDragStart(event)) return;
    const optionRow = event.target.closest("[data-option-row]");
    if (optionRow) {
      draggedOption = optionRow;
      event.dataTransfer.effectAllowed = "move";
      return;
    }
    const card = event.target.closest("[data-question]");
    if (!card) return;
    draggedQuestion = card;
    event.dataTransfer.effectAllowed = "move";
  }

  function handleQuestionDragOver(event) {
    if (handleDashboardDragOver(event)) return;
    const optionRow = event.target.closest("[data-option-row]");
    if (optionRow && draggedOption && optionRow !== draggedOption) {
      event.preventDefault();
      return;
    }
    const card = event.target.closest("[data-question]");
    if (!card || !draggedQuestion || card === draggedQuestion) return;
    event.preventDefault();
  }

  function handleQuestionDrop(event) {
    if (handleDashboardDrop(event)) return;
    const optionRow = event.target.closest("[data-option-row]");
    if (optionRow && draggedOption && optionRow !== draggedOption) {
      event.preventDefault();
      const rows = Array.from(optionRow.parentElement.querySelectorAll("[data-option-row]"));
      const from = rows.indexOf(draggedOption);
      const to = rows.indexOf(optionRow);
      if (from < to) optionRow.after(draggedOption);
      else optionRow.before(draggedOption);
      draggedOption = null;
      return;
    }
    const card = event.target.closest("[data-question]");
    if (!card || !draggedQuestion || card === draggedQuestion) return;
    event.preventDefault();
    const list = card.parentElement;
    const cards = Array.from(list.querySelectorAll("[data-question]"));
    const from = cards.indexOf(draggedQuestion);
    const to = cards.indexOf(card);
    if (from < to) card.after(draggedQuestion);
    else card.before(draggedQuestion);
    refreshFormBranching(card.closest("form"));
    draggedQuestion = null;
  }

  function updateDynamicVisibility(form) {
    if (!form || form.dataset.form !== "fieldIntervention") return;
    const order = state.workOrders.find((item) => item.id === form.dataset.orderId);
    const template = formTemplateForOrder(order);
    const fields = template?.fields || [];
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

  function fieldAppliesToCurrentUnit(form, field) {
    const scope = field.unitScope || "all";
    if (scope === "all") return true;
    const unitKind = form.querySelector('[name="unitKind"]')?.value || "interieure";
    return scope === unitKind;
  }

  function legacyShowWhenMatches(form, field) {
    if (!field.showWhen?.fieldId || !field.showWhen?.value) return true;
    const source = fieldsByRuntimeForm(form).find((item) => item.id === field.showWhen.fieldId);
    if (!source) return true;
    return runtimeFieldValues(form, source).includes(field.showWhen.value);
  }

  function fieldsByRuntimeForm(form) {
    const order = state.workOrders.find((item) => item.id === form.dataset.orderId);
    return formTemplateForOrder(order)?.fields || [];
  }

  function branchTargetForRuntimeField(form, field) {
    if (field.type === "section") return field.nextFieldId || "";
    const values = runtimeFieldValues(form, field);
    const branchRules = field.branchRules || {};
    const orderedValues = (field.options || []).filter((option) => values.includes(option));
    const matched = [...orderedValues, ...values].find((value) => branchRules[value]);
    return matched ? branchRules[matched] : field.nextFieldId || "";
  }

  function runtimeFieldValues(form, field) {
    const inputs = Array.from(form.querySelectorAll(`[name="field-${field.id}"]`));
    if (!inputs.length) return [];
    if (["checkbox", "multiple"].includes(field.type)) return inputs.filter((input) => input.checked).map((input) => input.value).filter(Boolean);
    if (field.type === "single") return [inputs.find((input) => input.checked)?.value].filter(Boolean);
    return [inputs[0].value].filter(Boolean);
  }

  function handleFilter(event) {
    const target = event.target.closest("[data-action='filter']");
    if (!target) return;
    const nextFilters = { ...state.filters, [target.dataset.filter]: target.value };
    if (target.dataset.filter === "buildingId") nextFilters.apartmentId = "all";
    updateUiState({ filters: nextFilters });
  }

  function handleWorkOrderFilter(event) {
    const target = event.target.closest("[data-action='workorder-filter']");
    if (!target) return;
    updateUiState({ workOrderFilters: { ...(state.workOrderFilters || seed.workOrderFilters), [target.dataset.filter]: target.value } });
  }

  function handleDashboardWidgetSize(event) {
    const target = event.target.closest("[data-action='dashboard-widget-size']");
    if (!target) return;
    const layout = dashboardLayoutForCurrentUser().map((item) => item.id === target.dataset.widget ? { ...item, size: target.value } : item);
    saveDashboardLayout(layout);
  }

  function handleDashboardCalendarDate(event) {
    const target = event.target.closest("[data-action='dashboard-calendar-date']");
    if (!target) return;
    updateUiState({ dashboardCalendarDate: target.value ? `${target.value}-01` : monthStart(today()) });
  }

  async function handleReportFilter(event) {
    const target = event.target.closest("[data-action='report-filter']");
    if (!target) return;
    const filters = { ...state.reportFilters, [target.dataset.filter]: target.value };
    updateUiState({ reportFilters: filters });
    await refreshReportContext(filters);
  }

  async function refreshReportContext(filters = state.reportFilters) {
    if (!SERVER_ENABLED || !state.sessionUserId || restoringSession || !api?.getReportContext) return;
    try {
      lastReportServerContext = await api.getReportContext(filters);
    } catch (error) {
      lastReportServerContext = null;
      showToast(error.message || "Rapport non disponible sur le serveur.");
    }
  }

  function render() {
    const app = document.getElementById("app");
    const user = currentUser();
    if (!user) {
      app.innerHTML = renderLogin();
      return;
    }
    if (state.activeView === "lieux") app.innerHTML = buildingsView();
    else if (state.activeView === "lieu_detail") app.innerHTML = buildingDetailView();
    else if (state.activeView === "equipements") app.innerHTML = equipmentView();
    else if (state.activeView === "detail") app.innerHTML = equipmentDetailView();
    else if (state.activeView === "alertes" && canManageReminders()) app.innerHTML = alertsView();
    else if (state.activeView === "appels") app.innerHTML = ticketsView();
    else if (state.activeView === "bons") app.innerHTML = workOrdersView();
    else if (state.activeView === "recommandations" && can("recommendations")) app.innerHTML = recommendationsView();
    else if (state.activeView === "documents" && can("documents")) app.innerHTML = documentsView();
    else if (state.activeView === "execution") app.innerHTML = workOrderExecutionView();
    else if (state.activeView === "rapports" && can("reports")) app.innerHTML = reportsView();
    else if (state.activeView === "utilisateurs" && can("users")) app.innerHTML = usersView();
    else if (state.activeView === "parametres" && (can("settings") || can("users"))) app.innerHTML = settingsView();
    else app.innerHTML = dashboard();
    updateDynamicVisibility(app.querySelector("form[data-form='fieldIntervention']"));
    updateNewApartmentVisibility(app.querySelector("form[data-form='fieldIntervention']"));
    updateRecommendationVisibility(app.querySelector("form[data-form='fieldIntervention']"));
  }

  bindEvents();
  render();
  restoreSession();
})();

