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
    "hvacSystemTypes",
    "passwordResetRequests"
  ];

  const DEFAULT_HVAC_SYSTEM_TYPES = [
    { id: "system_type_ptac", name: "PTAC", topology: "monobloc", sortOrder: 10, active: true },
    { id: "system_type_ttw", name: "TTW", topology: "monobloc", sortOrder: 20, active: true },
    { id: "system_type_thermopompe_murale", name: "Thermopompe murale", topology: "split", sortOrder: 30, active: true },
    { id: "system_type_climatiseur_mural", name: "Air climatisé mural", topology: "split", sortOrder: 40, active: true },
    { id: "system_type_thermopompe_centrale", name: "Thermopompe centrale", topology: "split", sortOrder: 50, active: true },
    { id: "system_type_climatiseur_central", name: "Air climatisé central", topology: "split", sortOrder: 60, active: true }
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
    hvacSystemTypes: JSON.parse(JSON.stringify(DEFAULT_HVAC_SYSTEM_TYPES)),
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
        name: "État constaté de la machine",
        group: "États de machine",
        type: "single",
        appliesTo: ["activity", "equipment"],
        options: [
          { id: "actif", label: "Actif", value: "actif", behavior: "operational", color: "#15803d" },
          { id: "ok", label: "OK", value: "ok", behavior: "operational", color: "#15803d" },
          { id: "surveillance", label: "Surveillance", value: "surveillance", behavior: "monitoring", color: "#d97706" },
          { id: "reparation_requise", label: "Réparation requise", value: "reparation_requise", behavior: "repair_required", color: "#ea580c" },
          { id: "a_planifier", label: "À planifier", value: "a_planifier", behavior: "monitoring", color: "#315f96" },
          { id: "hors_service", label: "Hors service", value: "hors_service", behavior: "out_of_service", color: "#dc2626" }
        ]
      },
      {
        id: "activity_status",
        name: "Résultat de l'activité",
        group: "Résultats d'activité",
        type: "single",
        appliesTo: ["activity"],
        options: [
          { id: "completee", label: "Terminée", value: "completee", behavior: "completed", color: "#15803d" },
          { id: "partielle", label: "Partiellement terminée", value: "partielle", behavior: "partial", color: "#d97706" },
          { id: "a_revoir", label: "À reprendre", value: "a_revoir", behavior: "return_required", color: "#d97706" },
          { id: "client_absent", label: "Non effectuée - client absent", value: "client_absent", behavior: "not_completed", color: "#64748b" },
          { id: "acces_impossible", label: "Non effectuée - accès impossible", value: "acces_impossible", behavior: "not_completed", color: "#64748b" }
        ]
      },
      {
        id: "recommendation_type",
        name: "Type de recommandation",
        group: "Types de recommandation",
        type: "single",
        appliesTo: ["activity"],
        options: [
          { id: "diagnostic", label: "Diagnostic à effectuer", value: "diagnostic", behavior: "diagnostic", color: "#315f96" },
          { id: "atelier", label: "Apporter à l'atelier", value: "atelier", behavior: "diagnostic", color: "#315f96" },
          { id: "remplacement", label: "Remplacement de l'unité", value: "remplacement", behavior: "replacement", color: "#dc2626" },
          { id: "piece", label: "Remplacement de pièce", value: "piece", behavior: "part", color: "#d97706" },
          { id: "reparation", label: "Réparation recommandée", value: "reparation", behavior: "repair", color: "#ea580c" },
          { id: "autre", label: "Autre", value: "autre", behavior: "informational", color: "#64748b" }
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
      },
      {
        id: "form_remplacement_unite",
        name: "Remplacement d'une unité",
        activityFields: {},
        fields: [
          { id: "ancienne_unite_confirmee", label: "Unité à remplacer confirmée", type: "checkbox", required: true, options: ["Oui"] },
          { id: "essai_fonctionnement", label: "Essai de fonctionnement", type: "single", required: true, options: ["Conforme", "À surveiller", "Non conforme"] },
          { id: "observations_installation", label: "Observations d'installation", type: "long", required: false }
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
      },
      {
        id: "remplacement_unite",
        name: "Remplacement d'une unité",
        defaultDuration: 120,
        defaultFormTemplateId: "form_remplacement_unite",
        behavior: "replacement",
        checklist: [
          "Confirmer l'ancienne unité",
          "Installer la nouvelle unité",
          "Effectuer l'essai de fonctionnement",
          "Confirmer la destination de l'ancienne unité"
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
    next.interventionTypes = (data.interventionTypes || seed.interventionTypes).map((item) => ({ defaultFormTemplateId: "", behavior: "standard", ...item }));
    if (!next.interventionTypes.some((item) => item.behavior === "replacement" || item.id === "remplacement_unite")) {
      next.interventionTypes.push(JSON.parse(JSON.stringify(seed.interventionTypes.find((item) => item.id === "remplacement_unite"))));
    }
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
        unitScopes: Array.isArray(field.unitScopes) && field.unitScopes.length ? field.unitScopes : [field.unitScope || "all"],
        systemTypeIds: Array.isArray(field.systemTypeIds) ? field.systemTypeIds : [],
        branchRules: field.branchRules || {},
        nextFieldId: field.nextFieldId || "",
        showWhen: field.showWhen || null
      }))
    }));
    if (!next.formTemplates.some((item) => item.id === "form_remplacement_unite")) {
      next.formTemplates.push(JSON.parse(JSON.stringify(seed.formTemplates.find((item) => item.id === "form_remplacement_unite"))));
    }
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
      technicianPermissions: [],
      parentUserId: "",
      ...user,
      portalRights: normalizePortalRights(user.portalRights || []),
      technicianPermissions: Array.from(new Set((user.technicianPermissions || []).filter(Boolean)))
    }));
    next.equipment = (data.equipment || seed.equipment).map((item) => ({
      attachments: [],
      unitKind: "interieure",
      manufactureAgeInfo: "",
      manufactureYear: null,
      estimatedAgeYears: null,
      conditionStatus: item.status || "actif",
      lifecycleStatus: "installed",
      storageLocationId: "",
      homeBuildingId: "",
      systemId: "",
      disposedAt: "",
      ...item
    })).map((item) => {
      const apartment = next.apartments.find((entry) => entry.id === item.apartmentId);
      const building = next.buildings.find((entry) => entry.id === apartment?.buildingId);
      return { ...item, clientId: item.clientId || building?.clientId || "", homeBuildingId: item.homeBuildingId || building?.id || "" };
    });
    next.storageLocations = Array.isArray(data.storageLocations) ? data.storageLocations : [];
    next.equipmentMovements = Array.isArray(data.equipmentMovements) ? data.equipmentMovements : [];
    next.equipmentReplacements = Array.isArray(data.equipmentReplacements) ? data.equipmentReplacements : [];
    const receivedSystemTypes = Array.isArray(data.hvacSystemTypes) ? data.hvacSystemTypes : [];
    const systemTypesById = new Map([...DEFAULT_HVAC_SYSTEM_TYPES, ...receivedSystemTypes].map((item) => [item.id, { sortOrder: 0, active: true, topology: "split", ...item }]));
    next.hvacSystemTypes = Array.from(systemTypesById.values()).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    next.hvacSystems = (Array.isArray(data.hvacSystems) ? data.hvacSystems : []).map((system) => {
      const inferredType = next.hvacSystemTypes.find((type) => type.id === system.systemTypeId);
      return { topology: inferredType?.topology || "split", brand: "", sortOrder: 0, active: true, ...system };
    });
    next.workOrderTargets = Array.isArray(data.workOrderTargets) ? data.workOrderTargets : [];
    next.workOrderCompletionAudits = Array.isArray(data.workOrderCompletionAudits) ? data.workOrderCompletionAudits : [];
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
    })).map((order) => ({ ...order, defaultActivityTypeId: order.defaultActivityTypeId || order.typeId || "", object: order.object || order.notes || "" }));
    next.interventions = (data.interventions || seed.interventions).map((intervention) => ({
      apartmentId: "",
      formTemplateId: "",
      formResponses: {},
      activityStatus: "completee",
      machineStatus: "",
      unitKind: "interieure",
      equipmentNotes: "",
      recommendation: null,
      typeId: intervention.typeId || "",
      targetId: intervention.targetId || "",
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
    const managedGroups = {
      equipment_status: "États de machine",
      activity_status: "Résultats d'activité",
      recommendation_type: "Types de recommandation"
    };
    return fields.map((field) => ({
      id: field.id || uid("datafield"),
      name: field.name || field.label || "Champ",
      group: managedGroups[field.id] || field.group || "Non groupé",
      type: field.type || "single",
      appliesTo: field.appliesTo?.length ? field.appliesTo : ["activity"],
      options: normalizeStatusDataOptions(field.id, normalizeDataOptions(field.options || []))
    }));
  }

  function normalizeStatusDataOptions(fieldId, options) {
    const requiredByField = {
      equipment_status: [
        { id: "actif", label: "Opérationnelle", value: "actif", active: true, behavior: "operational", color: "#15803d" },
        { id: "surveillance", label: "À surveiller", value: "surveillance", active: true, behavior: "monitoring", color: "#d97706" },
        { id: "reparation_requise", label: "Réparation requise", value: "reparation_requise", active: true, behavior: "repair_required", color: "#ea580c" },
        { id: "hors_service", label: "Hors service", value: "hors_service", active: true, behavior: "out_of_service", color: "#dc2626" }
      ],
      activity_status: [
        { id: "completee", label: "Terminée", value: "completee", active: true, behavior: "completed", color: "#15803d" },
        { id: "partielle", label: "Partiellement terminée", value: "partielle", active: true, behavior: "partial", color: "#d97706" },
        { id: "a_revoir", label: "À reprendre", value: "a_revoir", active: true, behavior: "return_required", color: "#d97706" },
        { id: "client_absent", label: "Non effectuée - client absent", value: "client_absent", active: true, behavior: "not_completed", color: "#64748b" },
        { id: "acces_impossible", label: "Non effectuée - accès impossible", value: "acces_impossible", active: true, behavior: "not_completed", color: "#64748b" }
      ],
      recommendation_type: [
        { id: "remplacement", label: "Remplacement de l'unité", value: "remplacement", active: true, behavior: "replacement", color: "#dc2626" }
      ]
    };
    const required = requiredByField[fieldId] || [];
    if (!required.length) return options;
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
      existing.options = (existing.options || []).map((option) => {
        const coreOption = core.options.find((item) => item.value === option.value);
        return coreOption ? { ...coreOption, ...option, behavior: option.behavior || coreOption.behavior || "", color: option.color || coreOption.color || "" } : option;
      });
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
        active: option.active !== false,
        behavior: option.behavior || "",
        color: option.color || ""
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

  function acceptServerState(serverState, uiPatch = {}) {
    rememberServerState(serverState);
    const uiState = currentUiState();
    state = {
      ...normalizeState(serverState),
      ...uiState,
      ...uiPatch,
      sessionUserId: uiState.sessionUserId
    };
    render();
    scheduleToastClear();
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
    return ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("workorders");
  }

  function hasTechnicianPermission(permission, user = currentUser()) {
    return user?.role === "technicien" && (user.technicianPermissions || []).includes(permission);
  }

  function canManageBuildings() {
    return ["administrateur", "equipe_interne"].includes(currentUser()?.role) && can("lieux");
  }

  function canEditApartments() {
    const user = currentUser();
    if (user?.role === "technicien") return can("lieux") && hasTechnicianPermission("edit_apartments", user);
    return user?.role !== "client" && can("lieux");
  }

  function canEditEquipment() {
    const user = currentUser();
    if (user?.role === "technicien") return can("equipment") && hasTechnicianPermission("edit_equipment", user);
    return user?.role !== "client" && can("equipment");
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
      return state.workOrders;
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
    const building = state.buildings.find((item) => item.id === apartment?.buildingId) || state.buildings.find((item) => item.id === equipment?.homeBuildingId);
    const storage = state.storageLocations.find((item) => item.id === equipment?.storageLocationId);
    const clientId = building?.clientId || equipment?.clientId || storage?.clientId;
    const client = state.clients.find((item) => item.id === clientId);
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
    const targetApartmentIds = state.workOrderTargets.filter((item) => item.workOrderId === order.id && item.apartmentId).map((item) => item.apartmentId);
    if (targetApartmentIds.length) return state.apartments.filter((item) => targetApartmentIds.includes(item.id));
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
    const targets = state.workOrderTargets.filter((item) => item.workOrderId === order.id);
    const done = apartments.filter((apartment) => {
      const apartmentTargets = targets.filter((item) => item.apartmentId === apartment.id);
      return apartmentTargets.length > 0 && apartmentTargets.every((item) => ["termine", "annule"].includes(item.status));
    }).length;
    return {
      totalApartments: apartments.length,
      doneApartments: done,
      machines: new Set(interventions.map((item) => item.equipmentId).filter(Boolean)).size,
      activities: interventions.length,
      percent: apartments.length ? Math.round((done / apartments.length) * 100) : 0
    };
  }

  function formTemplateForOrder(order) {
    const activityType = state.interventionTypes.find((item) => item.id === (order?.defaultActivityTypeId || order?.typeId));
    return state.formTemplates.find((item) => item.id === order?.formTemplateId)
      || state.formTemplates.find((item) => item.id === activityType?.defaultFormTemplateId)
      || state.formTemplates[0];
  }

  function formTemplateForActivity(typeId, order) {
    const activityType = state.interventionTypes.find((item) => item.id === typeId);
    return state.formTemplates.find((item) => item.id === activityType?.defaultFormTemplateId)
      || formTemplateForOrder(order);
  }

  function statusBadge(status) {
    const configuredOption = state.dataFields
      .filter((field) => ["activity_status", "equipment_status", "recommendation_type"].includes(field.id))
      .flatMap((field) => field.options || [])
      .find((option) => option.value === status);
    if (configuredOption) {
      const toneByBehavior = {
        completed: "ok", operational: "ok", informational: "info", diagnostic: "info",
        partial: "warn", monitoring: "warn", return_required: "warn", repair: "warn", part: "warn",
        not_completed: "neutral", out_of_service: "danger", repair_required: "danger", replacement: "danger"
      };
      const color = /^#[0-9a-f]{6}$/i.test(configuredOption.color || "") ? configuredOption.color : "";
      const style = color ? ` style="border-color:${color};color:${color}"` : "";
      return `<span class="badge ${toneByBehavior[configuredOption.behavior] || "neutral"}"${style}>${escapeHtml(configuredOption.label || status)}</span>`;
    }
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
      brouillon: ["Brouillon", "neutral"],
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
      upcoming: ["À venir", "info"],
      installed: ["Installée", "ok"],
      stored: ["En dépôt", "info"],
      disposed: ["Mise au rebut", "neutral"]
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

  const placesViewModule = window.ClimaParcPlacesView.create({
    getState: () => state,
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
  });

  function buildingsView() {
    return placesViewModule.buildingsView();
  }

  function buildingCard(building) {
    return placesViewModule.buildingCard(building);
  }

  function buildingDetailView() {
    return placesViewModule.buildingDetailView();
  }

  function apartmentBlock(apartment) {
    return placesViewModule.apartmentBlock(apartment);
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

  const equipmentViewModule = window.ClimaParcEquipmentView.create({
    getState: () => state, api, appShell, renderTopbar, currentUser, can,
    canEditEquipment,
    canCreateWorkOrders, canEditReminders, scopedEquipment, scopedBuildings,
    scopedApartments, scopedReminders, equipmentContext, formatDate, escapeHtml,
    unitKindLabel, statusBadge, interventionItem, ticketItem, workOrderItem,
    reminderItem, attachmentItem, modalShell, normalizeActivityFields,
    dataFieldOptionsForSelect, buildingForApartment, comboInput, activityOptions,
    today, uid, updateUiState, saveEquipmentNow, documentsModule,
    acceptServerState, showToast
  });

  function filteredEquipment() { return equipmentViewModule.filteredEquipment(); }
  function equipmentView() { return equipmentViewModule.equipmentView(); }
  function filtersBlock() { return equipmentViewModule.filtersBlock(); }
  function equipmentTable(equipment, allowDetail) { return equipmentViewModule.equipmentTable(equipment, allowDetail); }
  function equipmentDetailView() { return equipmentViewModule.equipmentDetailView(); }

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

  async function openAttachmentPreview(fileId, allowDownload = true) {
    return documentsViewModule.openAttachmentPreview(fileId, allowDownload);
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
    const target = state.workOrderTargets.find((item) => item.sourceRecommendationId === interventionId);
    const linkedOrder = state.workOrders.find((item) => item.id === target?.workOrderId || item.id === recommendation.workOrderId);
    return `
      <button class="ghost-button" data-action="open-modal" data-modal="recommendationReview" data-id="${escapeHtml(interventionId)}">Réviser</button>
      ${recommendation.status === "information_demandee" ? `<button class="primary-button" data-action="open-modal" data-modal="recommendationReply" data-id="${escapeHtml(interventionId)}">Répondre au client</button>` : ""}
      ${["a_valider", "information_demandee"].includes(recommendation.status) ? `<button class="primary-button" data-action="send-recommendation" data-id="${escapeHtml(interventionId)}">Envoyer au client</button>` : ""}
      ${!target ? `<button class="ghost-button" data-action="route-recommendation" data-mode="new" data-id="${escapeHtml(interventionId)}">Créer un BT</button><button class="ghost-button" data-action="open-modal" data-modal="recommendationRoute" data-id="${escapeHtml(interventionId)}">Ajouter à un BT existant</button>` : ""}
      ${linkedOrder ? `<button class="text-button" data-action="dashboard-workorder" data-id="${escapeHtml(linkedOrder.id)}">${escapeHtml(linkedOrder.number || "Consulter le BT")}</button><span class="badge ${target?.approvalStatus === "pending" ? "warning" : target?.approvalStatus === "refused" ? "danger" : "success"}">${target?.approvalStatus === "pending" ? "Approbation en attente" : target?.approvalStatus === "refused" ? "Refusée" : "Exécutable"}</span>` : ""}
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

  const ticketsViewModule = window.ClimaParcTicketsView.create({
    getState: () => state, api, appShell, renderTopbar, scopedTickets,
    scopedEquipment, equipmentContext, escapeHtml, statusBadge,
    canCreateWorkOrders, currentUser, compactAttachmentItem, modalShell, uid,
    nextTicketNumber, clientForBuilding, today, updateUiState, saveDomainItemNow
  });

  function ticketsView() { return ticketsViewModule.ticketsView(); }
  function ticketItem(ticket, expanded = false, dashboardLink = false) { return ticketsViewModule.ticketItem(ticket, expanded, dashboardLink); }

  function compactAttachmentItem(file) {
    return documentsViewModule.compactAttachmentItem(file);
  }

  function ticketStatusButtons(ticket) {
    return ticketsViewModule.ticketStatusButtons(ticket);
  }

  const workOrdersViewModule = window.ClimaParcWorkOrdersView.create({
    getState: () => state, api, seed, appShell, renderTopbar, can,
    canCreateWorkOrders, currentUser, scopedWorkOrders, scopedBuildings,
    scopedEquipment, equipmentContext, workOrderContext, workOrderProgress,
    workOrderApartments, interventionsForOrder, formTemplateForOrder,
    equipmentForApartment, searchText, normalizeSearch, statusText, statusBadge,
    formatDate, escapeHtml, dataFieldLabelByValue, modalShell, today, uid,
    showToast, updateUiState, saveDomainItemNow, acceptServerState
  });

  function workOrdersView() {
    return workOrdersViewModule.workOrdersView();
  }

  function filteredWorkOrders() {
    return workOrdersViewModule.filteredWorkOrders();
  }

  function workOrderFiltersBlock() {
    return workOrdersViewModule.workOrderFiltersBlock();
  }

  function workOrderItem(order, expanded = false, dashboardLink = false) {
    return workOrdersViewModule.workOrderItem(order, expanded, dashboardLink);
  }

  function workOrderActionButtons(order, expanded) {
    return workOrdersViewModule.workOrderActionButtons(order, expanded);
  }

  function workOrderExecutionView() {
    return workOrdersViewModule.workOrderExecutionView();
  }

  function executionApartmentButton(order, apartment, selectedId) {
    return workOrdersViewModule.executionApartmentButton(order, apartment, selectedId);
  }

  function fieldResponseCard(intervention) {
    return workOrdersViewModule.fieldResponseCard(intervention);
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

  const usersViewModule = window.ClimaParcUsersView.create({
    getState: () => state,
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
  });

  function usersView() {
    return usersViewModule.usersView();
  }

  function clientAccessLabel(level) {
    return usersViewModule.clientAccessLabel(level);
  }

  function canDeleteUser(user) {
    return usersViewModule.canDeleteUser(user);
  }

  function userBuildingAccessLabel(user) {
    return usersViewModule.userBuildingAccessLabel(user);
  }

  function rightsCatalog() {
    return usersViewModule.rightsCatalog();
  }

  const settingsViewModule = window.ClimaParcSettingsView.create({
    getState: () => state, appShell, renderTopbar, escapeHtml, statusText,
    fieldTypeLabel, rightsCatalog, modalShell, uid, saveSettingCollectionItem
  });

  function settingsView() {
    return settingsViewModule.settingsView();
  }

  function dataFieldGroups() {
    return settingsViewModule.dataFieldGroups();
  }

  function dataFieldTypeLabel(type) {
    return settingsViewModule.dataFieldTypeLabel(type);
  }

  function renderModal() {
    const modal = state.modal;
    if (modal.type === "ticket") return ticketModal(modal);
    if (modal.type === "workorder") return workOrderModal(modal);
    if (modal.type === "building") return buildingModal(modal);
    if (modal.type === "apartment") return apartmentModal(modal);
    if (modal.type === "equipment") return equipmentModal(modal);
    if (modal.type === "equipmentAttachment") return equipmentViewModule.equipmentAttachmentModal(modal);
    if (modal.type === "reminder") return reminderModal(modal);
    if (modal.type === "user") return userModal(modal);
    if (modal.type === "serviceType") return serviceTypeModal(modal);
    if (modal.type === "dataField") return dataFieldModal(modal);
    if (modal.type === "interventionType") return interventionTypeModal(modal);
    if (modal.type === "storageLocation") return storageLocationModal(modal);
    if (modal.type === "hvacSystemType") return settingsViewModule.hvacSystemTypeModal(modal);
    if (modal.type === "formTemplate") return formTemplateModal(modal);
    if (modal.type === "role") return roleModal(modal);
    if (modal.type === "signup") return signupModal();
    if (modal.type === "forgotPassword") return forgotPasswordModal();
    if (modal.type === "resetPassword") return resetPasswordModal();
    if (modal.type === "checklist") return checklistModal(modal.orderId);
    if (modal.type === "fieldIntervention") return fieldInterventionModal(modal);
    if (modal.type === "hvacSystemSetup") return hvacSystemSetupModal(modal);
    if (modal.type === "recommendationReview") return recommendationReviewModal(modal.id);
    if (modal.type === "recommendationRoute") return recommendationRouteModal(modal.id);
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
    return placesViewModule.buildingModal(modal);
  }

  function apartmentModal(modal) {
    return placesViewModule.apartmentModal(modal);
  }

  function ticketModal(modal) {
    return ticketsViewModule.ticketModal(modal);
  }

  function workOrderModal(modal) {
    return workOrdersViewModule.workOrderModal(modal);
  }

  function equipmentModal(modal) {
    return equipmentViewModule.equipmentModal(modal);
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
    return usersViewModule.userModal(modal);
  }

  function dataFieldModal(modal) {
    return settingsViewModule.dataFieldModal(modal);
  }

  function dataFieldOptionLines(field) {
    return settingsViewModule.dataFieldOptionLines(field);
  }

  function serviceTypeModal(modal) {
    return settingsViewModule.serviceTypeModal(modal);
  }

  function interventionTypeModal(modal) {
    return settingsViewModule.interventionTypeModal(modal);
  }

  function storageLocationModal(modal) {
    return settingsViewModule.storageLocationModal(modal);
  }

  const formBuilderModule = window.ClimaParcFormBuilder.create({
    getState: () => state, escapeHtml, modalShell, normalizeActivityFields,
    uid, showToast, saveSettingCollectionItem
  });

  function formTemplateModal(modal) {
    return formBuilderModule.formTemplateModal(modal);
  }

  function activityFieldCatalog() {
    return formBuilderModule.activityFieldCatalog();
  }

  function formActivityFieldRow(key, label, config = {}) {
    return formBuilderModule.formActivityFieldRow(key, label, config);
  }

  function formBuilderQuestion(field, index, allFields) {
    return formBuilderModule.formBuilderQuestion(field, index, allFields);
  }

  function formBuilderSection(field, index) {
    return formBuilderModule.formBuilderSection(field, index);
  }

  function formOptionRow(option, field, targetOptions) {
    return formBuilderModule.formOptionRow(option, field, targetOptions);
  }

  function formBranchTargets(fields, currentId) {
    return formBuilderModule.formBranchTargets(fields, currentId);
  }

  function choiceFieldTypes() {
    return formBuilderModule.choiceFieldTypes();
  }

  function questionTypeOptions(selected) {
    return formBuilderModule.questionTypeOptions(selected);
  }

  function roleModal(modal) {
    return settingsViewModule.roleModal(modal);
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
        ${existing?.summary ? `<div class="legacy-summary-note"><strong>Note historique</strong><span>${escapeHtml(existing.summary)}</span></div>` : ""}
        <button class="primary-button" type="submit">Enregistrer l'intervention</button>
      </form>
    `);
  }

  function legacyFieldInterventionModal(modal) {
    const order = state.workOrders.find((item) => item.id === modal.orderId);
    const availableApartments = workOrderApartments(order);
    const selectedEquipment = state.equipment.find((item) => item.id === modal.equipmentId);
    const equipment = selectedEquipment || { apartmentId: modal.apartmentId, unitKind: modal.unitKind || "interieure" };
    const selectedApartmentId = equipment.apartmentId || modal.apartmentId || availableApartments[0]?.id || "__new";
    const apartment = state.apartments.find((item) => item.id === selectedApartmentId);
    const apartmentOptions = availableApartments.map((item) => `<option value="${item.id}" ${selectedApartmentId === item.id ? "selected" : ""}>Appartement ${escapeHtml(item.number)}</option>`).join("");
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
        ${existing?.summary ? `<div class="legacy-summary-note"><strong>Note historique</strong><span>${escapeHtml(existing.summary)}</span></div>` : ""}
        <div class="actions field-intervention-actions">
          <button class="primary-button" type="submit">Enregistrer</button>
          <button class="ghost-button" type="submit" data-after-save="interieure">Enregistrer et ajouter une unité intérieure</button>
          <button class="ghost-button" type="submit" data-after-save="exterieure">Enregistrer et ajouter une unité extérieure</button>
        </div>
      </form>
    `);
  }

  function dataFieldOptionBehavior(fieldId, value) {
    const field = state.dataFields.find((item) => item.id === fieldId);
    const option = field?.options?.find((item) => item.value === value);
    if (option?.behavior) return option.behavior;
    const fallbacks = { completee: "completed", partielle: "partial", a_revoir: "return_required", client_absent: "not_completed", acces_impossible: "not_completed", remplacement: "replacement" };
    return fallbacks[value] || "";
  }

  function isReplacementActivityType(typeId) {
    const type = state.interventionTypes.find((item) => item.id === typeId);
    return type?.behavior === "replacement" || type?.id === "remplacement_unite";
  }

  function hvacSystemSetupModal(modal) {
    const apartment = state.apartments.find((item) => item.id === modal.apartmentId);
    const types = state.hvacSystemTypes.filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const existingCount = state.hvacSystems.filter((item) => item.apartmentId === modal.apartmentId).length;
    return modalShell("Nouveau système HVAC", `<form class="form-grid" data-form="hvacSystemSetup" data-order-id="${escapeHtml(modal.orderId || "")}" data-apartment-id="${escapeHtml(modal.apartmentId || "")}"><div class="location-summary"><strong>Appartement ${escapeHtml(apartment?.number || "-")}</strong><span>Le type et la marque seront partagés par toutes les unités de ce système.</span></div><div class="field"><label>Nom du système</label><input name="name" value="Système ${existingCount + 1}" required></div><div class="split"><div class="field"><label>Type de système</label><select name="systemTypeId" required>${types.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} - ${item.topology === "monobloc" ? "système unique" : "intérieur + extérieur"}</option>`).join("")}</select></div><div class="field"><label>Marque</label><input name="brand" required placeholder="Ex.: Carrier"></div></div><button class="primary-button" type="submit">Créer et ajouter la première unité</button></form>`);
  }

  function fieldInterventionModal(modal) {
    const order = state.workOrders.find((item) => item.id === modal.orderId);
    const availableApartments = workOrderApartments(order);
    const selectedEquipment = state.equipment.find((item) => item.id === (modal.equipmentId || order?.equipmentId));
    const equipment = selectedEquipment || { apartmentId: modal.apartmentId, unitKind: modal.unitKind || "interieure" };
    const selectedApartmentId = equipment.apartmentId || modal.apartmentId || order?.apartmentId || availableApartments[0]?.id || "__new";
    const apartment = state.apartments.find((item) => item.id === selectedApartmentId);
    const building = state.buildings.find((item) => item.id === apartment?.buildingId || item.id === order?.buildingId);
    const apartmentOptions = availableApartments.map((item) => `<option value="${item.id}" ${selectedApartmentId === item.id ? "selected" : ""}>Appartement ${escapeHtml(item.number)}</option>`).join("");
    const machinesForApartment = selectedApartmentId === "__new" ? [] : equipmentForApartment(selectedApartmentId);
    const selectedActivityEquipmentId = selectedEquipment?.id || "__new";
    const equipmentOptions = machinesForApartment.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedActivityEquipmentId === item.id ? "selected" : ""}>${escapeHtml(item.type)} - ${escapeHtml(item.brand || "-")} ${escapeHtml(item.model || "")} ${item.serial ? `(${escapeHtml(item.serial)})` : ""}</option>`).join("");
    const existing = modal.interventionId ? state.interventions.find((item) => item.id === modal.interventionId) : null;
    const selectedActivityTypeId = modal.activityTypeId || existing?.typeId || order?.defaultActivityTypeId || order?.typeId || state.interventionTypes[0]?.id || "";
    const template = formTemplateForActivity(selectedActivityTypeId, order);
    const activityFields = normalizeActivityFields(template?.activityFields);
    const statusOptions = dataFieldOptionsForSelect(activityFields.status);
    const activityStatuses = activityStatusOptions();
    const recommendationTypes = recommendationTypeOptions();
    const recommendation = existing?.recommendation || {};
    const replacementActivity = isReplacementActivityType(selectedActivityTypeId);
    const existingReplacement = state.equipmentReplacements.find((item) => item.workOrderId === order?.id && item.oldEquipmentId === equipment.id);
    const installedReplacement = state.equipment.find((item) => item.id === existingReplacement?.newEquipmentId);
    const replacementCandidates = scopedEquipment().filter((item) => item.id !== equipment.id && item.lifecycleStatus !== "disposed");
    const replacementOptions = replacementCandidates.map((item) => {
      const context = equipmentContext(item.id);
      const place = item.lifecycleStatus === "stored" ? state.storageLocations.find((storage) => storage.id === item.storageLocationId)?.name : `${context.building?.name || "-"} - Apt ${context.apartment?.number || "-"}`;
      return `<option value="${escapeHtml(item.id)}" ${installedReplacement?.id === item.id ? "selected" : ""}>${escapeHtml(item.type || "Machine")} - ${escapeHtml(item.brand || "-")} ${escapeHtml(item.model || "")} | ${escapeHtml(place || "-")}</option>`;
    }).join("");
    const destinationApartments = state.apartments.map((item) => {
      const targetBuilding = state.buildings.find((entry) => entry.id === item.buildingId);
      const client = state.clients.find((entry) => entry.id === targetBuilding?.clientId);
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(client?.name || "-")} | ${escapeHtml(targetBuilding?.name || "-")} | Apt ${escapeHtml(item.number)}</option>`;
    }).join("");
    const storageOptions = state.storageLocations.filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(state.clients.find((client) => client.id === item.clientId)?.name || "-")} | ${escapeHtml(item.name)}</option>`).join("");
    const replacementUnit = installedReplacement || {};
    const identityLocked = Boolean(selectedEquipment && currentUser()?.role === "technicien" && !canEditEquipment());
    const readOnly = identityLocked ? "readonly" : "";
    const hasRecommendation = Boolean(recommendation.type);
    const assignedIds = new Set([order?.technicianId, ...(order?.assignedTechnicianIds || [])].filter(Boolean));
    const canEditActivity = ["administrateur", "equipe_interne"].includes(currentUser()?.role) || (currentUser()?.role === "technicien" && assignedIds.has(currentUser()?.id) && order?.status !== "termine");
    const readOnlyActivity = Boolean(modal.readOnly) || !canEditActivity;
    const systems = state.hvacSystems.filter((item) => item.apartmentId === selectedApartmentId && item.active !== false);
    const selectedSystemId = modal.systemId || equipment.systemId || systems[0]?.id || "";
    const systemOptions = systems.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedSystemId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    const selectedSystem = systems.find((item) => item.id === selectedSystemId);
    const selectedSystemType = state.hvacSystemTypes.find((item) => item.id === selectedSystem?.systemTypeId);
    const systemTopology = selectedSystem?.topology || selectedSystemType?.topology || "split";
    const canonicalType = selectedSystemType?.name || equipment.type || "Machine";
    const canonicalBrand = selectedSystem?.brand || equipment.brand || "";
    const activityTypeOptions = state.interventionTypes.filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}" ${selectedActivityTypeId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    return modalShell(`Activité${apartment ? ` - Apt ${escapeHtml(apartment.number)}` : ""}`, `
      <form class="form-grid technician-field-form" data-form="fieldIntervention" data-order-id="${escapeHtml(order?.id || "")}" data-equipment-id="${escapeHtml(selectedEquipment?.id || "")}" data-intervention-id="${escapeHtml(existing?.id || "")}" data-activity-type-id="${escapeHtml(selectedActivityTypeId)}" data-form-template-id="${escapeHtml(template?.id || "")}" data-replacement-activity="${replacementActivity ? "true" : "false"}" data-read-only="${readOnlyActivity ? "true" : "false"}">
        <details class="technician-form-section" open>
          <summary><span>1</span><strong>Informations de l'appartement</strong><small>${escapeHtml(building?.name || "")} ${apartment ? `| Apt ${escapeHtml(apartment.number)}` : ""}</small></summary>
          <div class="technician-form-section-body">
            <div class="location-summary"><strong>${escapeHtml(building?.name || "Lieu du bon de travail")}</strong><span>${escapeHtml(building?.address || "")}</span></div>
            <div class="split"><div class="field"><label>Appartement</label><select name="apartmentId"><option value="__new" ${selectedApartmentId === "__new" ? "selected" : ""}>Nouvel appartement</option>${apartmentOptions}</select></div><div class="field new-apartment-field"><label>Numéro du nouvel appartement</label><input name="newApartmentNumber" placeholder="Ex.: 1204"></div></div>
          </div>
        </details>
        <details class="technician-form-section" open>
          <summary><span>2</span><strong>Informations de l'unité</strong><small>${escapeHtml(equipment.type || "Nouvelle machine")}</small></summary>
          <div class="technician-form-section-body">
            <div class="split"><div class="field"><label>Machine</label><select name="activityEquipmentId" data-activity-equipment-select><option value="__new">Créer une nouvelle machine</option>${equipmentOptions}</select></div>${systemTopology === "monobloc" ? `<input type="hidden" name="unitKind" value="monobloc"><div class="field"><label>Configuration</label><input value="Système unique" readonly></div>` : `<div class="field"><label>Position de l'unité</label><select name="unitKind" ${identityLocked ? "aria-disabled=\"true\" class=\"select-readonly\"" : ""}><option value="interieure" ${equipment.unitKind !== "exterieure" ? "selected" : ""}>Unité intérieure</option><option value="exterieure" ${equipment.unitKind === "exterieure" ? "selected" : ""}>Unité extérieure</option></select></div>`}</div>
            <div class="field"><label>Système HVAC</label><select name="systemId" data-field-system-select required>${systemOptions}</select></div>
            <div class="system-identity-summary"><div><span>Type de système</span><strong>${escapeHtml(canonicalType)}</strong></div><div><span>Marque</span><strong>${escapeHtml(canonicalBrand || "À confirmer")}</strong></div></div>
            <input type="hidden" name="type" value="${escapeHtml(canonicalType)}"><input type="hidden" name="brand" value="${escapeHtml(canonicalBrand)}">
            <div class="split">${activityTextInput("location", activityFields.location, equipment.location)}${activityTextInput("model", activityFields.model, equipment.model)}</div>
            <div class="split"><div class="field"><label>${activityFields.serial.label}${activityFields.serial.required ? " *" : ""}</label><input name="serial" value="${escapeHtml(equipment.serial || "")}" ${readOnly} ${activityFields.serial.required ? "required" : ""}></div><div class="field"><label>Année de fabrication ou âge estimé</label><input name="manufactureAgeInfo" value="${escapeHtml(equipment.manufactureAgeInfo || "")}" ${readOnly} placeholder="Ex.: 2018, environ 8 ans"></div></div>
            ${identityLocked ? `<p class="meta">Les données d'identification sont en lecture seule selon vos autorisations.</p>` : ""}
          </div>
        </details>
        <details class="technician-form-section" open>
          <summary><span>3</span><strong>Activité et conclusion</strong><small data-activity-template-name>${escapeHtml(template?.name || "Formulaire terrain")}</small></summary>
          <div class="technician-form-section-body">
            <div class="field"><label>Type d'activité</label><select name="activityTypeId" data-field-activity-type required>${activityTypeOptions}</select></div>
            <div class="form-builder dynamic-form-grid" data-activity-form-fields>${(template?.fields || []).map((field) => renderDynamicField(field, existing?.formResponses?.[field.label] ?? field.defaultValue)).join("")}</div>
            <div class="form-subsection-title">Conclusion</div>
            <div class="split"><div class="field"><label>Résultat de l'activité</label><select name="activityStatus" data-activity-result>${activityStatuses.map((option) => `<option value="${escapeHtml(option.value)}" ${(existing?.activityStatus || "completee") === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div><div class="field"><label>État constaté de la machine${activityFields.status.required ? " *" : ""}</label><select name="machineStatus" ${activityFields.status.required ? "required" : ""}><option value="">Sélectionner</option>${statusOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${(existing?.machineStatus || equipment.conditionStatus || equipment.status) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div></div>
            <div class="field"><label>Recommandation</label><select name="recommendationType" data-recommendation-select><option value="">Aucune recommandation</option>${recommendationTypes.map((option) => `<option value="${escapeHtml(option.value)}" ${recommendation.type === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
            <div class="recommendation-details ${hasRecommendation ? "" : "hidden"}" data-recommendation-details><div class="field"><label>Description</label><textarea name="recommendationDescription">${escapeHtml(recommendation.description || "")}</textarea></div><div class="split"><div class="field"><label>Priorité</label><select name="recommendationPriority"><option value="basse" ${recommendation.priority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${!recommendation.priority || recommendation.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${recommendation.priority === "urgente" ? "selected" : ""}>Urgente</option></select></div><div class="field"><label>Temps prévu</label><input name="recommendationTime" value="${escapeHtml(recommendation.time || "")}"></div></div><div class="field"><label>Pièce nécessaire</label><input name="recommendationPart" value="${escapeHtml(recommendation.part || "")}"></div></div>
            <div class="field"><label>${activityFields.notes.label}</label><textarea name="equipmentNotes">${escapeHtml(existing?.equipmentNotes || "")}</textarea></div>
            ${existing?.summary ? `<div class="legacy-summary-note"><strong>Note historique</strong><span>${escapeHtml(existing.summary)}</span></div>` : ""}
            <div class="replacement-inline ${replacementActivity ? "" : "hidden"}" data-replacement-section>${existingReplacement ? `<div class="success-summary"><strong>Remplacement déjà enregistré</strong><span>Nouvelle unité: ${escapeHtml(installedReplacement?.type || installedReplacement?.serial || "-")}</span></div>` : `<div class="form-subsection-title">Remplacement de l'unité</div><div class="field"><label>Nouvelle unité</label><select name="replacementEquipmentId" data-replacement-equipment-select><option value="__new">Créer une nouvelle machine</option>${replacementOptions}</select></div><div class="split"><div class="field"><label>Position de la nouvelle unité</label><select name="replacementUnitKind"><option value="interieure" ${replacementUnit.unitKind !== "exterieure" ? "selected" : ""}>Unité intérieure</option><option value="exterieure" ${replacementUnit.unitKind === "exterieure" ? "selected" : ""}>Unité extérieure</option><option value="monobloc" ${replacementUnit.unitKind === "monobloc" ? "selected" : ""}>Système unique</option></select></div><div class="field"><label>Type de système</label><input name="replacementType" value="${escapeHtml(canonicalType)}" readonly></div></div><div class="split"><div class="field"><label>Localisation</label><input name="replacementLocation" value="${escapeHtml(replacementUnit.location || equipment.location || "")}"></div><div class="field"><label>Marque</label><input name="replacementBrand" value="${escapeHtml(canonicalBrand)}" readonly></div></div><div class="split"><div class="field"><label>Modèle</label><input name="replacementModel" value="${escapeHtml(replacementUnit.model || "")}"></div><div class="field"><label>Numéro de série</label><input name="replacementSerial" value="${escapeHtml(replacementUnit.serial || "")}"></div></div><div class="field"><label>Année de fabrication ou âge estimé</label><input name="replacementManufactureAgeInfo" value="${escapeHtml(replacementUnit.manufactureAgeInfo || "")}" placeholder="Ex.: 2024"></div><div class="field"><label>Destination de l'ancienne unité</label><select name="oldEquipmentDisposition" data-disposition-select><option value="">Sélectionner</option><option value="transfer_apartment">Transférer vers un autre appartement</option><option value="storage">Transférer vers un dépôt</option><option value="dispose">Mettre au rebut</option></select></div><div class="field disposition-destination hidden" data-disposition-apartment><label>Appartement de destination</label><select name="destinationApartmentId"><option value="">Sélectionner</option>${destinationApartments}</select></div><div class="field disposition-destination hidden" data-disposition-storage><label>Dépôt de destination</label><select name="destinationStorageLocationId"><option value="">Sélectionner</option>${storageOptions}</select></div><div class="field"><label>Motif ou précision</label><textarea name="replacementReason">Remplacement de l'unité</textarea></div><div class="confirmation-box"><strong>Confirmation requise</strong><span>La localisation de l'ancienne unité sera mise à jour seulement si l'activité est terminée.</span></div>`}</div>
            <div class="field"><label>Photos et documents</label><input name="attachments" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"><p class="meta">Maximum 3 fichiers, 10 MB par fichier.</p></div>
          </div>
        </details>
        ${readOnlyActivity ? `<div class="meta">Consultation en lecture seule.</div>` : `<div class="actions field-intervention-actions sticky-form-actions"><button class="primary-button" type="submit">Enregistrer</button>${systemTopology === "split" ? `<button class="ghost-button" type="submit" data-after-save="interieure">Enregistrer et ajouter une unité intérieure</button><button class="ghost-button" type="submit" data-after-save="exterieure">Enregistrer et ajouter une unité extérieure</button>` : ""}</div>`}
      </form>
    `, "modal-card-field");
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
        <label class="check-row"><input type="checkbox" name="requiresClientApproval" ${recommendation.requiresClientApproval !== false ? "checked" : ""}> Exiger l'approbation du client avant l'exécution</label>
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

  const interventionsViewModule = window.ClimaParcInterventionsView.create({
    getState: () => state, escapeHtml, formatCanadianPhone,
    normalizeDataOptions, formTemplateForOrder, formTemplateForActivity
  });

  function activityTextInput(name, config, value) {
    return interventionsViewModule.activityTextInput(name, config, value);
  }

  function recommendationRouteModal(interventionId) {
    const intervention = state.interventions.find((item) => item.id === interventionId);
    if (!intervention?.recommendation) return modalShell("Ajouter à un BT", `<div class="empty">Recommandation introuvable.</div>`);
    const { building } = equipmentContext(intervention.equipmentId);
    const orders = state.workOrders.filter((item) => {
      const context = workOrderContext(item);
      return context.building?.id === building?.id && !["termine", "annule"].includes(item.status);
    });
    return modalShell("Ajouter la recommandation à un BT", `
      <form class="form-grid" data-form="recommendationRoute">
        <input type="hidden" name="interventionId" value="${escapeHtml(interventionId)}">
        <p class="meta">Seuls les bons de travail du même lieu sont proposés.</p>
        <div class="field"><label>Bon de travail</label><select name="workOrderId" required><option value="">Sélectionner</option>${orders.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.number)} - ${escapeHtml(item.object || item.notes || "")}</option>`).join("")}</select></div>
        ${orders.length ? `<button class="primary-button" type="submit">Ajouter au BT</button>` : `<div class="empty">Aucun BT ouvert pour ce lieu.</div>`}
      </form>
    `);
  }

  function activityOptions(name, config = {}) {
    return interventionsViewModule.activityOptions(name, config);
  }

  function dataFieldOptionsForConfig(config = {}) {
    return interventionsViewModule.dataFieldOptionsForConfig(config);
  }

  function dataFieldOptionsForSelect(config = {}) {
    return interventionsViewModule.dataFieldOptionsForSelect(config);
  }

  function comboInput(name, value, options, required = false) {
    return interventionsViewModule.comboInput(name, value, options, required);
  }

  function renderDynamicField(field, value) {
    return interventionsViewModule.renderDynamicField(field, value);
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
    if (formType === "equipmentAttachment") await equipmentViewModule.uploadEquipmentAttachments(form);
    if (formType === "reminder") await saveReminder(form, values);
    if (formType === "user") await createUser(form, values);
    if (formType === "dataField") await saveDataField(form, values);
    if (formType === "serviceType") await saveServiceType(values);
    if (formType === "interventionType") await saveInterventionType(values);
    if (formType === "storageLocation") await settingsViewModule.saveStorageLocation(form, values);
    if (formType === "hvacSystemType") await settingsViewModule.saveHvacSystemType(form, values);
    if (formType === "formTemplate") await saveFormTemplate(form, values);
    if (formType === "role") await saveRole(form, values);
    if (formType === "checklist") await saveChecklist(form, values);
    if (formType === "fieldIntervention") await saveFieldIntervention(form, values);
    if (formType === "hvacSystemSetup") await saveHvacSystemSetup(form, values);
    if (formType === "recommendationReview") await saveRecommendationReview(values);
    if (formType === "recommendationRoute") await routeRecommendation(values.interventionId, "existing", values.workOrderId);
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
    return placesViewModule.saveBuilding(values);
  }

  async function saveApartment(values) {
    return placesViewModule.saveApartment(values);
  }

  function deleteApartment(id) {
    return placesViewModule.deleteApartment(id);
  }

  async function createTicket(form, values) {
    return ticketsViewModule.createTicket(form, values);
  }

  async function createWorkOrder(form, values) {
    return workOrdersViewModule.createWorkOrder(form, values);
  }

  function markReminderWorkOrderOpened(reminderId, orderId) {
    return workOrdersViewModule.markReminderWorkOrderOpened(reminderId, orderId);
  }

  async function createEquipment(values) {
    return equipmentViewModule.createEquipment(values);
  }

  async function createUser(form, values) {
    return usersViewModule.createUser(form, values);
  }

  async function deleteUser(userId) {
    return usersViewModule.deleteUser(userId);
  }

  async function saveServiceType(values) {
    return settingsViewModule.saveServiceType(values);
  }

  async function saveInterventionType(values) {
    return settingsViewModule.saveInterventionType(values);
  }

  async function saveDataField(form, values) {
    return settingsViewModule.saveDataField(form, values);
  }

  function parseDataFieldOptions(value) {
    return settingsViewModule.parseDataFieldOptions(value);
  }

  async function saveFormTemplate(form, values) {
    return formBuilderModule.saveFormTemplate(form, values);
  }

  function parseOptions(value) {
    return formBuilderModule.parseOptions(value);
  }

  function collectActivityFieldSettings(form) {
    return formBuilderModule.collectActivityFieldSettings(form);
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
    return settingsViewModule.saveRole(form, values);
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
      readings: {},
      checklistDone: []
    };
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
    const activityTypeId = values.activityTypeId || form.dataset.activityTypeId || order.defaultActivityTypeId || order.typeId;
    const template = formTemplateForActivity(activityTypeId, order);
    updateDynamicVisibility(form);
    if (!validateRequiredResponses(form, template)) return;
    const apartmentId = resolveActivityApartment(order, values);
    if (!apartmentId) return;
    const activityApartment = state.apartments.find((item) => item.id === apartmentId);
    const building = state.buildings.find((item) => item.id === activityApartment?.buildingId);
    const newApartmentPayload = values.apartmentId === "__new" ? state.apartments.find((item) => item.id === apartmentId) : null;
    const requestedEquipmentId = values.activityEquipmentId && values.activityEquipmentId !== "__new" ? values.activityEquipmentId : form.dataset.equipmentId;
    let equipment = state.equipment.find((item) => item.id === requestedEquipmentId);
    if (!equipment) {
      equipment = {
        id: uid("eq"),
        apartmentId,
        clientId: building?.clientId || "",
        homeBuildingId: building?.id || "",
        systemId: values.systemId || "",
        unitKind: values.unitKind || "interieure",
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location,
        manufactureAgeInfo: values.manufactureAgeInfo || "",
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
        clientId: equipment.clientId || building?.clientId || "",
        homeBuildingId: equipment.homeBuildingId || building?.id || "",
        systemId: values.systemId || equipment.systemId || "",
        unitKind: values.unitKind || equipment.unitKind || "interieure",
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location,
        manufactureAgeInfo: values.manufactureAgeInfo || equipment.manufactureAgeInfo || ""
      });
    }
    const responses = collectFormResponses(form, template);
    const existing = form.dataset.interventionId ? state.interventions.find((item) => item.id === form.dataset.interventionId) : null;
    const intervention = existing || {
      id: uid("int"),
      equipmentId: equipment.id,
      apartmentId,
      workOrderId: order.id,
      typeId: activityTypeId,
      date: today(),
      technicianId: currentUser().role === "technicien" ? currentUser().id : order.technicianId,
      status: "terminee",
      readings: {},
      checklistDone: []
    };
    intervention.apartmentId = apartmentId;
    intervention.typeId = activityTypeId;
    intervention.targetId = state.workOrderTargets.find((item) => item.workOrderId === order.id && item.apartmentId === apartmentId)?.id || "";
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
    if (existing?.summary) intervention.summary = existing.summary;
    else delete intervention.summary;
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
    if (["planifie", "brouillon"].includes(order.status)) order.status = "en_cours";
    const replacement = collectReplacementBundle(form, values, equipment, intervention, order);
    if (replacement === false) return;
    if (["interieure", "exterieure"].includes(values.afterSave)) {
      await persistFieldActivity(newApartmentPayload, equipment, intervention, order, replacement, {
        activeView: "execution",
        selectedWorkOrderId: order.id,
        selectedExecutionApartmentId: apartmentId,
        modal: { type: "fieldIntervention", orderId: order.id, apartmentId, unitKind: values.afterSave, systemId: equipment.systemId || "", activityTypeId }
      }, values.afterSave === "exterieure" ? "Activité enregistrée. Nouvelle unité extérieure prête." : "Activité enregistrée. Nouvelle unité intérieure prête.");
      return;
    }
    await persistFieldActivity(newApartmentPayload, equipment, intervention, order, replacement, {
      modal: null,
      activeView: "execution",
      selectedWorkOrderId: order.id,
      selectedExecutionApartmentId: apartmentId
    }, "Formulaire terrain enregistre.");
  }

  function applyOperationalResponse(response, patch, message) {
    if (!response?.state) return;
    acceptServerState(response.state, { ...patch, modal: null, toast: message });
  }

  async function createHvacSystemForApartment(workOrderId, apartmentId) {
    const apartment = state.apartments.find((item) => item.id === apartmentId);
    if (!apartment) return showToast("Appartement introuvable.");
    updateUiState({ modal: { type: "hvacSystemSetup", orderId: workOrderId, apartmentId } });
  }

  async function saveHvacSystemSetup(form, values) {
    const workOrderId = form.dataset.orderId;
    const apartmentId = form.dataset.apartmentId;
    const systemType = state.hvacSystemTypes.find((item) => item.id === values.systemTypeId && item.active !== false);
    if (!systemType) return showToast("Sélectionnez un type de système actif.");
    const system = { id: uid("system"), apartmentId, systemTypeId: systemType.id, topology: systemType.topology, brand: values.brand.trim(), name: values.name.trim(), sortOrder: state.hvacSystems.filter((item) => item.apartmentId === apartmentId).length * 10, active: true };
    updateUiState({ toast: "Création du système HVAC..." });
    try {
      const response = await api.createHvacSystem(system, workOrderId);
      if (!response?.state) return;
      acceptServerState(response.state, { activeView: "execution", selectedWorkOrderId: workOrderId, selectedExecutionApartmentId: apartmentId, modal: { type: "fieldIntervention", orderId: workOrderId, apartmentId, systemId: system.id, activityTypeId: state.workOrders.find((item) => item.id === workOrderId)?.defaultActivityTypeId || "" }, toast: "Système HVAC créé. Ajoutez sa première unité." });
    } catch (error) {
      showToast(error.message || "Système HVAC non créé.");
    }
  }

  async function completeWorkOrderApartment(workOrderId, apartmentId) {
    updateUiState({ toast: "Validation de l'appartement..." });
    try {
      const response = await api.completeWorkOrderApartment(workOrderId, apartmentId);
      applyOperationalResponse(response, { activeView: "execution", selectedWorkOrderId: workOrderId, selectedExecutionApartmentId: apartmentId }, "Appartement terminé.");
    } catch (error) {
      showToast(error.message || "Appartement non terminé.");
    }
  }

  async function closeWorkOrderNow(workOrderId) {
    const order = state.workOrders.find((item) => item.id === workOrderId);
    const progress = order ? workOrderProgress(order) : { doneApartments: 0, totalApartments: 0 };
    const reason = progress.doneApartments < progress.totalApartments ? prompt("Motif obligatoire pour clôturer un BT incomplet:") : "";
    if (progress.doneApartments < progress.totalApartments && !reason?.trim()) return;
    try {
      const response = await api.closeWorkOrder(workOrderId, reason || "");
      applyOperationalResponse(response, { activeView: "execution", selectedWorkOrderId: workOrderId }, "Bon de travail clôturé.");
    } catch (error) {
      showToast(error.message || "Bon de travail non clôturé.");
    }
  }

  async function reopenWorkOrderNow(workOrderId) {
    const reason = prompt("Motif de réouverture:");
    if (!reason?.trim()) return;
    try {
      const response = await api.reopenWorkOrder(workOrderId, reason);
      applyOperationalResponse(response, { activeView: "execution", selectedWorkOrderId: workOrderId }, "Bon de travail réouvert.");
    } catch (error) {
      showToast(error.message || "Bon de travail non réouvert.");
    }
  }

  function collectReplacementBundle(form, values, oldEquipment, intervention, order) {
    if (!isReplacementActivityType(intervention.typeId) || dataFieldOptionBehavior("activity_status", values.activityStatus || "completee") !== "completed") return null;
    if (state.equipmentReplacements.some((item) => item.workOrderId === order.id && item.oldEquipmentId === oldEquipment.id)) return null;
    const selectedId = values.replacementEquipmentId;
    let newEquipment = state.equipment.find((item) => item.id === selectedId);
    if (!newEquipment) {
      if (!values.replacementType?.trim()) {
        showToast("Entrez le type de la nouvelle unité.");
        return false;
      }
      newEquipment = {
        id: uid("eq"),
        apartmentId: oldEquipment.apartmentId,
        unitKind: values.replacementUnitKind || "interieure",
        systemId: oldEquipment.systemId || "",
        homeBuildingId: oldEquipment.homeBuildingId || "",
        type: values.replacementType.trim(),
        location: values.replacementLocation || oldEquipment.location || "",
        brand: values.replacementBrand || "",
        model: values.replacementModel || "",
        serial: values.replacementSerial || "",
        manufactureAgeInfo: values.replacementManufactureAgeInfo || "",
        installDate: today(),
        lastService: today(),
        nextService: "",
        status: "actif",
        conditionStatus: "actif",
        lifecycleStatus: "installed",
        attachments: [],
        notes: ""
      };
    } else {
      newEquipment = { ...newEquipment, unitKind: values.replacementUnitKind || newEquipment.unitKind, type: values.replacementType || newEquipment.type, location: values.replacementLocation || newEquipment.location, brand: values.replacementBrand || newEquipment.brand, model: values.replacementModel || newEquipment.model, serial: values.replacementSerial || newEquipment.serial, manufactureAgeInfo: values.replacementManufactureAgeInfo || newEquipment.manufactureAgeInfo || "" };
    }
    const action = values.oldEquipmentDisposition || "";
    if (!action) {
      showToast("Sélectionnez la destination de l'ancienne unité.");
      return false;
    }
    if (action === "transfer_apartment" && !values.destinationApartmentId) {
      showToast("Sélectionnez l'appartement de destination.");
      return false;
    }
    if (action === "storage" && !values.destinationStorageLocationId) {
      showToast("Sélectionnez le dépôt de destination.");
      return false;
    }
    if (action === "dispose" && !confirm("Confirmer la mise au rebut de cette unité? Son historique sera conservé.")) return false;
    return { action, newEquipment, destinationApartmentId: values.destinationApartmentId || "", destinationStorageLocationId: values.destinationStorageLocationId || "", reason: values.replacementReason || "Remplacement de l'unité", movementId: uid("move"), replacementId: uid("replace") };
  }

  async function persistFieldActivity(apartment, equipment, intervention, order, replacement, uiPatch, successToast) {
    if (!SERVER_ENABLED) {
      setState({ ...uiPatch, toast: successToast });
      return;
    }
    try {
      const payload = await api.saveFieldIntervention(apartment, equipment, intervention, order, replacement);
      if (!payload.state) return;
      rememberServerState(payload.state);
      const uiState = currentUiState();
      state = { ...normalizeState(payload.state), ...uiState, ...uiPatch, sessionUserId: uiState.sessionUserId, toast: successToast };
      render();
      scheduleToastClear();
    } catch (error) {
      showToast(error.message || "Activité non sauvegardée.");
    }
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
      requiresClientApproval: Boolean(values.requiresClientApproval),
      status: values.status || "a_valider",
      reviewedBy: currentUser()?.id || intervention.recommendation.reviewedBy || ""
    });
    if (intervention.recommendation.status === "envoyee" && previousStatus !== "envoyee") {
      intervention.recommendation.sentAt = today();
    }
    if (values.clientMessage && (values.clientMessage !== previousMessage || intervention.recommendation.status === "envoyee")) {
      addRecommendationMessage(intervention.recommendation, "interne", values.clientMessage);
    }
    try {
      const response = await api.reviewRecommendation(intervention.id, intervention.recommendation);
      applyOperationalResponse(response, { activeView: "recommandations" }, "Recommandation enregistrée.");
    } catch (error) {
      showToast(error.message || "Recommandation non enregistrée.");
    }
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
    if (recommendation.requiresClientApproval === undefined) recommendation.requiresClientApproval = true;
    addRecommendationMessage(recommendation, "interne", recommendation.clientMessage || recommendation.description);
    try {
      const response = await api.reviewRecommendation(intervention.id, recommendation);
      applyOperationalResponse(response, { activeView: "recommandations" }, "Recommandation envoyée au client.");
    } catch (error) {
      showToast(error.message || "Recommandation non envoyée.");
    }
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
    try {
      const response = await api.reviewRecommendation(intervention.id, recommendation);
      applyOperationalResponse(response, { activeView: "recommandations" }, "Réponse envoyée au client.");
    } catch (error) {
      showToast(error.message || "Réponse non envoyée.");
    }
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
    try {
      const response = await api.respondRecommendation(intervention.id, recommendation);
      applyOperationalResponse(response, { activeView: "recommandations" }, status === "approuvee" ? "Recommandation approuvée." : status === "refusee" ? "Recommandation refusée." : "Demande d'information envoyée.");
    } catch (error) {
      showToast(error.message || "Réponse non enregistrée.");
    }
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
    try {
      const response = await api.respondRecommendation(intervention.id, recommendation);
      applyOperationalResponse(response, { activeView: "recommandations" }, recommendation.status === "refusee" ? "Recommandation refusée." : "Demande d'information envoyée.");
    } catch (error) {
      showToast(error.message || "Message non envoyé.");
    }
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

  async function routeRecommendation(interventionId, mode, workOrderId = "") {
    updateUiState({ toast: mode === "new" ? "Création du BT..." : "Ajout au BT..." });
    try {
      const response = await api.routeRecommendation(interventionId, mode, workOrderId);
      applyOperationalResponse(response, { activeView: "recommandations" }, mode === "new" ? `BT créé: ${response.workOrder?.number || ""}` : "Recommandation ajoutée au BT.");
    } catch (error) {
      showToast(error.message || "Recommandation non ajoutée au BT.");
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
      occupant: ""
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
        formData.append("id", uid("file"));
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
      if (action === "select-building") {
        updateUiState({ selectedBuildingId: target.dataset.id, activeView: "lieu_detail" });
        return;
      }
      if (action === "select-equipment") {
        updateUiState({ selectedEquipmentId: target.dataset.id, activeView: "detail" });
        return;
      }
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
        if (target.dataset.modal === "building" && !canManageBuildings()) {
          updateUiState({ toast: "Droits insuffisants pour modifier ce lieu." });
          return;
        }
        if (target.dataset.modal === "apartment" && target.dataset.id && !canEditApartments()) {
          updateUiState({ toast: "Droits insuffisants pour modifier cet appartement." });
          return;
        }
        if (target.dataset.modal === "equipment" && target.dataset.id && !canEditEquipment()) {
          updateUiState({ toast: "Droits insuffisants pour modifier cet équipement." });
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
          systemId: target.dataset.system || null,
          activityTypeId: target.dataset.activityType || null,
          interventionId: target.dataset.intervention || null,
          readOnly: target.dataset.readOnly === "true",
          decisionStatus: target.dataset.status || null,
          orderId: target.dataset.order || null,
          reminderId: target.dataset.reminder || null
        } });
        return;
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
      if (action === "new-hvac-system") {
        await createHvacSystemForApartment(target.dataset.order, target.dataset.apartment);
        return;
      }
      if (action === "complete-workorder-apartment") {
        await completeWorkOrderApartment(target.dataset.order, target.dataset.apartment);
        return;
      }
      if (action === "close-workorder") {
        await closeWorkOrderNow(target.dataset.id);
        return;
      }
      if (action === "reopen-workorder") {
        await reopenWorkOrderNow(target.dataset.id);
        return;
      }
      if (action === "preview-attachment") {
        openAttachmentPreview(target.dataset.id, target.dataset.hideDownload !== "true");
        return;
      }
      if (action === "download-attachment") {
        downloadAttachment(target.dataset.id);
        return;
      }
      if (action === "toggle-dashboard-edit") {
        if (!["administrateur", "equipe_interne"].includes(currentUser()?.role)) return;
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
      if (action === "add-data-option") {
        settingsViewModule.addDataFieldOption(target.closest("form"));
        return;
      }
      if (action === "move-data-option") {
        settingsViewModule.moveDataFieldOption(target.closest("[data-data-option-row]"), Number(target.dataset.direction || 0));
        return;
      }
      if (action === "deactivate-data-option") {
        settingsViewModule.deactivateDataFieldOption(target.closest("[data-data-option-row]"));
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
      if (action === "route-recommendation") {
        routeRecommendation(target.dataset.id, target.dataset.mode || "new", target.dataset.workOrder || "");
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
      updateTechnicianPermissionsVisibility(event.target.closest("form"));
      updateUserAccessEditor(event.target.closest("form"), event.target.name === "clientId");
      if (event.target.matches("[data-activity-equipment-select]")) populateActivityEquipment(event.target);
      if (event.target.matches("[data-field-system-select]")) updateFieldSystemSelection(event.target);
      if (event.target.matches("[data-field-activity-type]")) updateFieldActivityType(event.target);
      if (event.target.matches("[data-replacement-equipment-select]")) populateReplacementEquipment(event.target);
      if (event.target.matches("[data-disposition-select]")) updateDispositionVisibility(event.target.closest("form"));
      if (event.target.matches("[data-activity-result]")) updateReplacementSectionVisibility(event.target.closest("form"));
      if (event.target.matches("[data-workorder-type]")) workOrdersViewModule.updateWorkOrderDefaultForm(event.target);
      if (event.target.name === "q-type") updateQuestionOptionEditor(event.target.closest("[data-question]"));
      if (event.target.name === "q-unit-scope") formBuilderModule.updateUnitScopeSelection(event.target);
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
    if (equipment && state.modal?.type === "fieldIntervention" && state.modal.equipmentId !== equipment.id) {
      updateUiState({ modal: { ...state.modal, equipmentId: equipment.id, systemId: equipment.systemId || "", unitKind: equipment.unitKind || "interieure" } });
      return;
    }
    form.dataset.equipmentId = equipment?.id || "";
    ["type", "location", "brand", "model", "serial", "manufactureAgeInfo"].forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.value = equipment ? equipment[name === "location" ? "location" : name] || "" : "";
    });
    const unitKind = form.querySelector('[name="unitKind"]');
    if (unitKind && equipment?.unitKind) unitKind.value = equipment.unitKind;
    const systemId = form.querySelector('[name="systemId"]');
    if (systemId && equipment?.systemId) systemId.value = equipment.systemId;
    const machineStatus = form.querySelector('[name="machineStatus"]');
    if (machineStatus) machineStatus.value = "";
    const notes = form.querySelector('[name="equipmentNotes"]');
    if (notes) notes.value = "";
    updateEquipmentIdentityAccess(form, equipment);
    hideComboOptions();
  }

  function updateFieldSystemSelection(select) {
    const system = state.hvacSystems.find((item) => item.id === select.value);
    if (!system || state.modal?.type !== "fieldIntervention" || state.modal.systemId === system.id) return;
    const systemType = state.hvacSystemTypes.find((item) => item.id === system.systemTypeId);
    updateUiState({
      modal: {
        ...state.modal,
        systemId: system.id,
        equipmentId: null,
        unitKind: (system.topology || systemType?.topology) === "monobloc" ? "monobloc" : (state.modal.unitKind || "interieure")
      }
    });
  }

  function updateEquipmentIdentityAccess(form, equipment) {
    if (!form) return;
    const locked = Boolean(equipment && currentUser()?.role === "technicien" && !canEditEquipment());
    ["unitKind", "type", "location", "brand", "model", "serial", "manufactureAgeInfo"].forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      if (input.tagName === "SELECT") {
        input.classList.toggle("select-readonly", locked);
        input.setAttribute("aria-disabled", locked ? "true" : "false");
      } else {
        input.readOnly = locked;
      }
    });
  }

  function populateReplacementEquipment(select) {
    const form = select.closest("form");
    const equipment = state.equipment.find((item) => item.id === select.value);
    if (!form) return;
    const mapping = {
      replacementUnitKind: "unitKind",
      replacementType: "type",
      replacementLocation: "location",
      replacementBrand: "brand",
      replacementModel: "model",
      replacementSerial: "serial",
      replacementManufactureAgeInfo: "manufactureAgeInfo"
    };
    Object.entries(mapping).forEach(([name, property]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.value = equipment?.[property] || (name === "replacementUnitKind" ? "interieure" : "");
    });
  }

  function updateDispositionVisibility(form) {
    if (!form || form.dataset.form !== "fieldIntervention") return;
    const action = form.querySelector("[data-disposition-select]")?.value || "";
    const sections = [
      ["[data-disposition-apartment]", action === "transfer_apartment"],
      ["[data-disposition-storage]", action === "storage"]
    ];
    sections.forEach(([selector, visible]) => {
      const section = form.querySelector(selector);
      if (!section) return;
      section.classList.toggle("hidden", !visible);
      section.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !visible;
        input.required = visible;
      });
    });
  }

  function updateReplacementSectionVisibility(form) {
    if (!form || form.dataset.form !== "fieldIntervention") return;
    const section = form.querySelector("[data-replacement-section]");
    if (!section) return;
    const visible = form.dataset.replacementActivity === "true";
    section.classList.toggle("hidden", !visible);
    section.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = !visible;
    });
    if (visible) {
      const systemId = form.querySelector('[name="systemId"]')?.value || "";
      const system = state.hvacSystems.find((item) => item.id === systemId);
      const systemType = state.hvacSystemTypes.find((item) => item.id === system?.systemTypeId);
      const monobloc = (system?.topology || systemType?.topology) === "monobloc";
      const positionSelect = section.querySelector('[name="replacementUnitKind"]');
      if (positionSelect) {
        if (monobloc) positionSelect.value = "monobloc";
        positionSelect.closest(".field")?.classList.toggle("hidden", monobloc);
      }
      updateDispositionVisibility(form);
    }
  }

  function updateFieldActivityType(select) {
    const form = select.closest("form[data-form='fieldIntervention']");
    if (!form) return;
    const order = state.workOrders.find((item) => item.id === form.dataset.orderId);
    const template = formTemplateForActivity(select.value, order);
    const fields = form.querySelector("[data-activity-form-fields]");
    if (fields) fields.innerHTML = (template?.fields || []).map((field) => renderDynamicField(field, field.defaultValue)).join("");
    form.dataset.activityTypeId = select.value;
    form.dataset.formTemplateId = template?.id || "";
    form.dataset.replacementActivity = isReplacementActivityType(select.value) ? "true" : "false";
    updateDynamicVisibility(form);
    updateReplacementSectionVisibility(form);
  }

  function addFormQuestion(form) {
    return formBuilderModule.addFormQuestion(form);
  }

  function addFormSection(form) {
    return formBuilderModule.addFormSection(form);
  }

  function duplicateFormQuestion(card) {
    return formBuilderModule.duplicateFormQuestion(card);
  }

  function addFormOption(card, value = "") {
    return formBuilderModule.addFormOption(card, value);
  }

  function updateQuestionOptionEditor(card) {
    return formBuilderModule.updateQuestionOptionEditor(card);
  }

  function updateActivityOptionPicker(select) {
    return formBuilderModule.updateActivityOptionPicker(select);
  }

  function removeFormOption(row) {
    return formBuilderModule.removeFormOption(row);
  }

  function removeFormQuestion(card) {
    return formBuilderModule.removeFormQuestion(card);
  }

  async function duplicateFormTemplate(id) {
    return formBuilderModule.duplicateFormTemplate(id);
  }

  function updateTechnicianPermissionsVisibility(form) {
    if (!form || form.dataset.form !== "user") return;
    const isTechnician = form.querySelector('[name="role"]')?.value === "technicien";
    form.querySelectorAll("[data-technician-permissions]").forEach((section) => {
      section.classList.toggle("hidden", !isTechnician);
      section.querySelectorAll("input").forEach((input) => {
        input.disabled = !isTechnician;
      });
    });
  }

  function updateUserAccessEditor(form, clientChanged = false) {
    if (!form || form.dataset.form !== "user") return;
    const role = form.querySelector('[name="role"]')?.value || "";
    const isClient = role === "client";
    const clientId = form.querySelector('[name="clientId"]')?.value || "";

    form.querySelectorAll("[data-client-role-section], [data-client-link-section], [data-client-access-section]").forEach((section) => {
      section.classList.toggle("hidden", !isClient);
      section.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !isClient;
      });
    });

    let visibleBuildings = 0;
    form.querySelectorAll("[data-user-building]").forEach((label) => {
      const visible = isClient && Boolean(clientId) && label.dataset.clientId === clientId;
      label.classList.toggle("hidden", !visible);
      const input = label.querySelector("input");
      if (input) {
        input.disabled = !visible;
        if (clientChanged && !visible) input.checked = false;
      }
      if (visible) visibleBuildings += 1;
    });
    const empty = form.querySelector("[data-no-user-buildings]");
    if (empty) {
      empty.textContent = clientId ? "Aucun lieu disponible pour ce client." : "Sélectionnez d'abord un client.";
      empty.classList.toggle("hidden", !isClient || visibleBuildings > 0);
    }
  }

  function currentBuilderFields(form) {
    return formBuilderModule.currentBuilderFields(form);
  }

  function refreshFormBranching(form) {
    return formBuilderModule.refreshFormBranching(form);
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
    return interventionsViewModule.updateDynamicVisibility(form);
  }

  function visibleFormFieldIds(form, fields) {
    return interventionsViewModule.visibleFormFieldIds(form, fields);
  }

  function fieldAppliesToCurrentUnit(form, field) {
    return interventionsViewModule.fieldAppliesToCurrentUnit(form, field);
  }

  function legacyShowWhenMatches(form, field) {
    return interventionsViewModule.legacyShowWhenMatches(form, field);
  }

  function fieldsByRuntimeForm(form) {
    return interventionsViewModule.fieldsByRuntimeForm(form);
  }

  function branchTargetForRuntimeField(form, field) {
    return interventionsViewModule.branchTargetForRuntimeField(form, field);
  }

  function runtimeFieldValues(form, field) {
    return interventionsViewModule.runtimeFieldValues(form, field);
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
    const fieldForm = app.querySelector("form[data-form='fieldIntervention']");
    if (fieldForm?.dataset.readOnly === "true") fieldForm.querySelectorAll("input, select, textarea, button[type='submit']").forEach((control) => { control.disabled = true; });
    updateEquipmentIdentityAccess(fieldForm, state.equipment.find((item) => item.id === fieldForm?.dataset.equipmentId));
    updateReplacementSectionVisibility(fieldForm);
  }

  bindEvents();
  render();
  restoreSession();
})();

