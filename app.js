(function () {
  const STORAGE_KEY = "climaparc_hvac_v2";
  const SERVER_ENABLED = typeof location !== "undefined" && (location.protocol === "http:" || location.protocol === "https:");
  let saveTimer = null;
  let toastTimer = null;
  let restoringSession = false;

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
    sidebarMode: "auto",
    mobileMenuOpen: false,
    navOrder: ["tableau", "lieux", "equipements", "appels", "bons", "rapports", "utilisateurs", "parametres"],
    filters: {
      buildingId: "all",
      apartmentId: "all",
      status: "all",
      search: ""
    },
    passwordResetRequests: [],
    users: [
      {
        id: "u-admin",
        name: "Claire Dubois",
        email: "admin@climaparc.ca",
        password: "admin123",
        role: "administrateur",
        clientId: null
      },
      {
        id: "u-interne",
        name: "Marc Beaulieu",
        email: "operation@climaparc.ca",
        password: "interne123",
        role: "equipe_interne",
        clientId: null
      },
      {
        id: "u-tech",
        name: "Nadia Tremblay",
        email: "tech@climaparc.ca",
        password: "tech123",
        role: "technicien",
        clientId: null
      },
      {
        id: "u-client",
        name: "Sophie Martin",
        email: "client@gestionazur.ca",
        password: "client123",
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
        onsiteContactEmail: "concierge@verdun.ca",
        billingContactName: "Sophie Martin",
        billingContactPhone: "514-555-0112",
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
        onsiteContactEmail: "surplace@tourslaval.ca",
        billingContactName: "Sophie Martin",
        billingContactPhone: "514-555-0112",
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
        onsiteContactEmail: "maintenance@rivieredunord.ca",
        billingContactName: "Laurent Gagnon",
        billingContactPhone: "450-555-0160",
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
          { id: "surveillance", label: "Surveillance", value: "surveillance" },
          { id: "a_planifier", label: "À planifier", value: "a_planifier" },
          { id: "hors_service", label: "Hors service", value: "hors_service" }
        ]
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
      { id: "equipe_interne", name: "Équipe interne", rights: ["lieux", "equipment", "tickets", "workorders", "reports", "users", "settings"] },
      { id: "technicien", name: "Technicien", rights: ["lieux", "equipment", "workorders", "interventions"] },
      { id: "client", name: "Client", rights: ["portal", "lieux", "tickets", "reports"] }
    ]
  };

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
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.users && stored.equipment) {
        return normalizeState(stored);
      }
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return normalizeState(JSON.parse(JSON.stringify(seed)));
  }

  function normalizeState(data) {
    const next = { ...JSON.parse(JSON.stringify(seed)), ...data };
    next.filters = { ...seed.filters, ...(data.filters || {}) };
    next.sidebarMode = data.sidebarMode || seed.sidebarMode;
    next.mobileMenuOpen = false;
    next.navOrder = mergeNavOrder(data.navOrder);
    next.serviceTypes = data.serviceTypes || JSON.parse(JSON.stringify(seed.serviceTypes));
    next.dataFields = normalizeDataFields(data.dataFields || seed.dataFields);
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
        branchRules: field.branchRules || {},
        showWhen: field.showWhen || null
      }))
    }));
    next.roleDefinitions = data.roleDefinitions || JSON.parse(JSON.stringify(seed.roleDefinitions));
    next.passwordResetRequests = data.passwordResetRequests || [];
    next.selectedBuildingId = data.selectedBuildingId || next.buildings[0]?.id || null;
    next.buildings = (data.buildings || seed.buildings).map((building) => ({
      onsiteContactName: "",
      onsiteContactPhone: "",
      onsiteContactEmail: "",
      billingContactName: "",
      billingContactPhone: "",
      billingContactEmail: "",
      notes: "",
      ...building
    }));
    next.tickets = (data.tickets || seed.tickets).map((ticket) => ({
      serviceTypeId: next.serviceTypes[0]?.id || "",
      ...ticket
    }));
    next.equipment = (data.equipment || seed.equipment).map((item) => ({
      attachments: [],
      ...item
    }));
    next.workOrders = (data.workOrders || seed.workOrders).map((order) => ({
      scope: order.buildingId ? "building" : "equipment",
      buildingId: "",
      equipmentId: "",
      formTemplateId: next.formTemplates[0]?.id || "",
      ...order
    }));
    next.interventions = (data.interventions || seed.interventions).map((intervention) => ({
      apartmentId: "",
      formTemplateId: "",
      formResponses: {},
      ...intervention
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
      options: normalizeDataOptions(field.options || [])
    }));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, toast: "" }));
      return;
    }
    if (!state.sessionUserId || restoringSession) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ state: persistableState() })
      }).catch(() => {
        state.toast = "Sauvegarde serveur indisponible.";
        render();
        scheduleToastClear();
      });
    }, 250);
  }

  function persistableState() {
    return {
      ...state,
      sessionUserId: null,
      modal: null,
      mobileMenuOpen: false,
      toast: "",
      activeView: "tableau",
      filters: { ...seed.filters }
    };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    saveState();
    render();
    if (Object.prototype.hasOwnProperty.call(patch, "toast")) scheduleToastClear();
  }

  function scheduleToastClear() {
    clearTimeout(toastTimer);
    if (!state.toast) return;
    toastTimer = setTimeout(() => {
      state = { ...state, toast: "" };
      saveState();
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
    const role = state.roleDefinitions?.find((item) => item.id === user.role);
    return role?.rights?.includes("all") || role?.rights?.includes(action);
  }

  function clientScopeIds() {
    const user = currentUser();
    if (!user || user.role !== "client") return null;
    const buildingIds = state.buildings.filter((building) => building.clientId === user.clientId).map((building) => building.id);
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
    return scope ? state.tickets.filter((ticket) => ticket.clientId === currentUser().clientId) : state.tickets;
  }

  function scopedWorkOrders() {
    const equipmentIds = scopedEquipment().map((item) => item.id);
    const buildingIds = scopedBuildings().map((building) => building.id);
    if (currentUser()?.role === "technicien") {
      return state.workOrders.filter((order) => order.technicianId === currentUser().id);
    }
    return state.workOrders.filter((order) => equipmentIds.includes(order.equipmentId) || buildingIds.includes(order.buildingId));
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
      surveillance: ["Surveillance", "warn"],
      a_planifier: ["À planifier", "info"],
      hors_service: ["Hors service", "danger"],
      ouvert: ["Ouvert", "info"],
      en_cours: ["En cours", "warn"],
      ferme: ["Fermé", "neutral"],
      planifie: ["Planifié", "info"],
      termine: ["Terminé", "ok"],
      annule: ["Annulé", "neutral"],
      terminee: ["Terminée", "ok"],
      urgente: ["Urgente", "danger"],
      normale: ["Normale", "info"],
      basse: ["Basse", "neutral"]
    };
    const [label, tone] = map[status] || [status, "neutral"];
    return `<span class="badge ${tone}">${label}</span>`;
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(`${value}T12:00:00`));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function iconSvg(name) {
    const icons = {
      pin: '<path d="M15 4.5 19.5 9l-3.1 3.1.5 4.1-1.4 1.4-4.2-4.2L7 17.7 6.3 17l4.3-4.3-4.2-4.2 1.4-1.4 4.1.5L15 4.5Z"/><path d="m9.5 14.5-4 4"/>',
      pencil: '<path d="m14.6 4.4 3 3"/><path d="M5 16.9 6 13l8.7-8.7a2.1 2.1 0 0 1 3 3L9 16l-4 .9Z"/>',
      grip: '<path d="M8 6h8M8 10h8M8 14h8"/>',
      chevronLeft: '<path d="m15 18-6-6 6-6"/>',
      chevronRight: '<path d="m9 18 6-6-6-6"/>',
      chevronUp: '<path d="m7 13 5-5 5 5"/>',
      chevronDown: '<path d="m7 11 5 5 5-5"/>'
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

    return `
      <div class="app-shell sidebar-${state.sidebarMode} ${state.mobileMenuOpen ? "mobile-menu-open" : ""}">
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
                  <span class="nav-icon">${icon}</span>
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
        <main class="main">${content}</main>
      </div>
      ${state.modal ? renderModal() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    `;
  }

  function baseNavItems() {
    return [
      ["tableau", "TB", "Tableau de bord", true],
      ["lieux", "LI", "Lieux", can("lieux") || can("portal")],
      ["equipements", "EQ", "Équipements", can("equipment") || can("portal")],
      ["appels", "CH", "Appels de service", can("tickets")],
      ["bons", "BT", "Bons de travail", can("workorders") || can("portal")],
      ["rapports", "RP", "Rapports", can("reports")],
      ["utilisateurs", "UT", "Utilisateurs", can("users")],
      ["parametres", "PR", "Paramètres", can("settings") || can("users")]
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
          <p>Inventaire des équipements, interventions, appels de service, bons de travail, checklists techniques et accès client.</p>
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
      <button class="ghost-button" data-action="view" data-view="lieux">Retour</button>
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
            <div><span>Téléphone sur place</span><strong>${escapeHtml(building.onsiteContactPhone || "-")}</strong></div>
            <div><span>Email sur place</span><strong>${escapeHtml(building.onsiteContactEmail || "-")}</strong></div>
            <div><span>Ressource facturation</span><strong>${escapeHtml(building.billingContactName || "-")}</strong></div>
            <div><span>Téléphone facturation</span><strong>${escapeHtml(building.billingContactPhone || "-")}</strong></div>
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
        <div class="meta">Occupant: ${escapeHtml(apartment.occupant || "-")}</div>
        <div class="mini-list">
          ${machines.map((item) => `
            <button class="mini-row" data-action="select-equipment" data-id="${item.id}">
              <strong>${escapeHtml(item.type)}</strong>
              <span>${escapeHtml(item.brand)} ${escapeHtml(item.model)} - ${statusText(item.status)}</span>
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

  function dashboard() {
    const equipment = scopedEquipment();
    const tickets = scopedTickets();
    const orders = scopedWorkOrders();
    const overdue = equipment.filter((item) => item.nextService <= today() && item.status !== "hors_service").length;
    const ongoing = tickets.filter((ticket) => ["ouvert", "en_cours"].includes(ticket.status)).length;
    const planned = orders.filter((order) => order.status === "planifie").length;
    const out = equipment.filter((item) => item.status === "hors_service").length;
    const stats = [
      ["Équipements", equipment.length],
      ["À traiter", ongoing],
      ["BT planifiés", planned],
      ["Hors service", out + overdue]
    ];

    const recentOrders = orders
      .slice()
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      .slice(0, 5)
      .map((order) => workOrderItem(order))
      .join("");

    const urgentTickets = tickets
      .filter((ticket) => ticket.status !== "ferme")
      .slice(0, 5)
      .map((ticket) => ticketItem(ticket))
      .join("");

    const actions = `
      ${can("tickets") ? `<button class="primary-button" data-action="open-modal" data-modal="ticket">Nouvel appel</button>` : ""}
      ${can("workorders") ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : ""}
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
          <button class="quick-action" data-action="open-modal" data-modal="ticket">Ouvrir un appel de service<span>Demande client, urgence ou suivi préventif.</span></button>
          ${can("workorders") ? `<button class="quick-action" data-action="open-modal" data-modal="workorder">Créer un bon de travail<span>Planifier une intervention et assigner un technicien.</span></button>` : ""}
          <div class="panel">
            <div class="panel-header"><h2>Appels actifs</h2></div>
            <div class="panel-body cards-list">${urgentTickets || `<div class="empty">Aucun appel actif.</div>`}</div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Prochains bons</h2></div>
            <div class="panel-body cards-list">${recentOrders || `<div class="empty">Aucun bon de travail.</div>`}</div>
          </div>
        </div>
      </section>
    `);
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
                  <td><strong>${escapeHtml(item.type)}</strong><br><span class="meta">${escapeHtml(item.brand)} ${escapeHtml(item.model)} - ${escapeHtml(item.serial)}</span></td>
                  <td>${escapeHtml(building?.name || "-")}</td>
                  <td>${escapeHtml(apartment?.number || "-")}<br><span class="meta">${escapeHtml(apartment?.occupant || "")}</span></td>
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
    const attachments = equipment.attachments || [];
    const actionButtons = `
      <button class="ghost-button" data-action="view" data-view="equipements">Retour</button>
      ${currentUser().role !== "client" ? `<button class="ghost-button" data-action="open-modal" data-modal="equipment" data-id="${equipment.id}">Modifier</button>` : ""}
      ${can("tickets") ? `<button class="primary-button" data-action="open-modal" data-modal="ticket" data-equipment="${equipment.id}">Nouvel appel</button>` : ""}
      ${can("workorders") ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-equipment="${equipment.id}">Nouveau BT</button>` : ""}
    `;
    return appShell(`
      ${renderTopbar("Dossier équipement", `${building?.name || ""} - Appartement ${apartment?.number || ""}`, actionButtons)}
      <section class="detail-layout">
        <div class="panel">
          <div class="panel-header"><h2>${escapeHtml(equipment.type)}</h2>${statusBadge(equipment.status)}</div>
          <div class="panel-body definition">
            <div><span>Client</span><strong>${escapeHtml(client?.name || "-")}</strong></div>
            <div><span>Immeuble</span><strong>${escapeHtml(building?.name || "-")}</strong></div>
            <div><span>Appartement</span><strong>${escapeHtml(apartment?.number || "-")} - ${escapeHtml(apartment?.occupant || "")}</strong></div>
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
          <div class="split">
            <div class="panel">
              <div class="panel-header"><h2>Appels liés</h2></div>
              <div class="panel-body cards-list">${tickets.map((ticket) => ticketItem(ticket)).join("") || `<div class="empty">Aucun appel.</div>`}</div>
            </div>
            <div class="panel">
              <div class="panel-header"><h2>Bons liés</h2></div>
              <div class="panel-body cards-list">${orders.map((order) => workOrderItem(order)).join("") || `<div class="empty">Aucun bon.</div>`}</div>
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

  function attachmentItem(file) {
    const order = state.workOrders.find((item) => item.id === file.workOrderId);
    const apartment = state.apartments.find((item) => item.id === file.sourceApartmentId || item.id === file.apartmentId);
    const building = state.buildings.find((item) => item.id === file.sourceBuildingId || item.id === apartment?.buildingId);
    const canPreview = Boolean(file.dataUrl);
    return `
      <article class="list-item">
        <div class="actions" style="justify-content:space-between">
          <button class="attachment-open" ${canPreview ? `data-action="preview-attachment" data-id="${file.id}"` : ""}>
            <strong>${escapeHtml(file.name)}</strong>
            <span>${attachmentTypeLabel(file)}</span>
          </button>
          <div class="actions">
            ${canPreview ? `<button class="ghost-button" data-action="preview-attachment" data-id="${file.id}">Ouvrir</button>` : ""}
            ${file.dataUrl ? `<a class="ghost-button" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name)}">Télécharger</a>` : ""}
          </div>
        </div>
        <div class="meta">Origine: ${escapeHtml(order?.number || "-")} | ${formatDate(file.uploadedAt)}</div>
        <div class="meta">Appartement source: ${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")}</div>
      </article>
    `;
  }

  function attachmentTypeLabel(file) {
    if (file.type?.startsWith("image/")) return "Image";
    if (file.type === "application/pdf") return "PDF";
    if (file.type?.startsWith("video/")) return "Vidéo";
    if (file.type?.startsWith("audio/")) return "Audio";
    return file.type || "Fichier";
  }

  function findAttachment(fileId) {
    return state.equipment.flatMap((item) => item.attachments || []).find((file) => file.id === fileId);
  }

  function attachmentPreviewModal(fileId) {
    const file = findAttachment(fileId);
    if (!file) return "";
    const order = state.workOrders.find((item) => item.id === file.workOrderId);
    const preview = file.type?.startsWith("image/")
      ? `<img class="attachment-preview-image" src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.name)}">`
      : file.type === "application/pdf"
        ? `<iframe class="attachment-preview-frame" src="${escapeHtml(file.dataUrl)}" title="${escapeHtml(file.name)}"></iframe>`
        : file.type?.startsWith("video/")
          ? `<video class="attachment-preview-video" controls src="${escapeHtml(file.dataUrl)}"></video>`
          : file.type?.startsWith("audio/")
            ? `<audio controls src="${escapeHtml(file.dataUrl)}"></audio>`
            : `<div class="empty">Prévisualisation non disponible pour ce type de fichier.</div>`;
    return modalShell(file.name, `
      <div class="stack">
        <div class="meta">Origine: ${escapeHtml(order?.number || "-")} | ${formatDate(file.uploadedAt)}</div>
        <div class="attachment-preview">${preview}</div>
        <div class="actions">
          <a class="primary-button" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name)}">Télécharger</a>
        </div>
      </div>
    `, "modal-card-wide attachment-preview-modal");
  }

  function interventionItem(item) {
    const type = state.interventionTypes.find((typeItem) => typeItem.id === item.typeId);
    const technician = state.users.find((user) => user.id === item.technicianId);
    const readings = Object.entries(item.readings || {}).map(([key, value]) => `${key}: ${value}`).join(" | ");
    return `
      <div class="timeline-item">
        <strong>${escapeHtml(type?.name || item.typeId)} - ${formatDate(item.date)}</strong>
        <span class="meta">${escapeHtml(technician?.name || "-")} - ${statusBadge(item.status)}</span>
        <p class="meta">${escapeHtml(item.summary)}</p>
        ${readings ? `<p class="meta">${escapeHtml(readings)}</p>` : ""}
      </div>
    `;
  }

  function ticketsView() {
    const tickets = scopedTickets();
    return appShell(`
      ${renderTopbar("Appels de service", "Demandes clients, priorités et suivi opérationnel.", `<button class="primary-button" data-action="open-modal" data-modal="ticket">Nouvel appel</button>`)}
      <section class="panel">
        <div class="panel-body cards-list">${tickets.map((ticket) => ticketItem(ticket, true)).join("") || `<div class="empty">Aucun appel de service.</div>`}</div>
      </section>
    `);
  }

  function ticketItem(ticket, expanded = false) {
    const { equipment, apartment, building } = equipmentContext(ticket.equipmentId);
    const serviceType = state.serviceTypes.find((item) => item.id === ticket.serviceTypeId);
    const attachments = equipment?.attachments || [];
    const actions = expanded && can("workorders")
      ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-ticket="${ticket.id}" data-equipment="${ticket.equipmentId}">Créer BT</button>`
      : "";
    return `
      <article class="list-item">
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(ticket.title)}</h3>
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
    return `
      <div class="mini-row attachment-mini-row" data-action="preview-attachment" data-id="${file.id}">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${attachmentTypeLabel(file)} | ${formatDate(file.uploadedAt)}</span>
      </div>
    `;
  }

  function ticketStatusButtons(ticket) {
    if (currentUser()?.role === "client") return "";
    return `
      <button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="en_cours">En cours</button>
      <button class="ghost-button" data-action="ticket-status" data-id="${ticket.id}" data-status="ferme">Fermer</button>
    `;
  }

  function workOrdersView() {
    const orders = scopedWorkOrders();
    return appShell(`
      ${renderTopbar("Bons de travail", "Planification, assignation technicien et exécution des checklists.", can("workorders") ? `<button class="primary-button" data-action="open-modal" data-modal="workorder">Nouveau BT</button>` : "")}
      <section class="panel">
        <div class="panel-body cards-list">${orders.map((order) => workOrderItem(order, true)).join("") || `<div class="empty">Aucun bon de travail.</div>`}</div>
      </section>
    `);
  }

  function workOrderItem(order, expanded = false) {
    const { equipment, apartment, building } = workOrderContext(order);
    const type = state.interventionTypes.find((item) => item.id === order.typeId);
    const tech = state.users.find((item) => item.id === order.technicianId);
    const progress = workOrderProgress(order);
    const scopeLabel = order.buildingId ? "Bloc complet" : `Apt ${apartment?.number || "-"} - ${equipment?.type || "-"}`;
    return `
      <article class="list-item">
        <div class="actions" style="justify-content:space-between">
          <h3>${escapeHtml(order.number)} - ${escapeHtml(type?.name || "")}</h3>
          ${statusBadge(order.status)}
        </div>
        <div class="meta">${formatDate(order.scheduledDate)} - ${escapeHtml(tech?.name || "Non assigné")}</div>
        <div class="meta">${escapeHtml(building?.name || "-")} - ${escapeHtml(scopeLabel)}</div>
        <div class="progress-line"><span style="width:${progress.percent}%"></span></div>
        <div class="meta">${progress.doneApartments}/${progress.totalApartments} appartement${progress.totalApartments > 1 ? "s" : ""} realisé${progress.doneApartments > 1 ? "s" : ""} | ${progress.machines} machine${progress.machines > 1 ? "s" : ""} analysée${progress.machines > 1 ? "s" : ""}</div>
        <div class="meta">${escapeHtml(order.notes || "")}</div>
        ${expanded ? `<div class="actions"><button class="primary-button" data-action="execute-workorder" data-id="${order.id}">Exécuter</button>${order.equipmentId ? `<button class="ghost-button" data-action="open-checklist" data-id="${order.id}">Checklist</button>` : ""}${can("workorders") ? `<button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${order.id}">Modifier</button><button class="ghost-button" data-action="order-status" data-id="${order.id}" data-status="termine">Terminer</button>` : ""}</div>` : ""}
      </article>
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
    return appShell(`
      ${renderTopbar(`Execution ${order.number}`, `${building?.name || "-"} - ${type?.name || ""}`, `
        <button class="ghost-button" data-action="view" data-view="bons">Retour</button>
        <button class="ghost-button" data-action="open-modal" data-modal="workorder" data-id="${order.id}">Changer le formulaire</button>
        <button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button>
      `)}
      <section class="stats-grid">
        <div class="stat"><span>Progression</span><strong>${progress.percent}%</strong></div>
        <div class="stat"><span>Appartements realises</span><strong>${progress.doneApartments}/${progress.totalApartments}</strong></div>
        <div class="stat"><span>Machines analysees</span><strong>${progress.machines}</strong></div>
        <div class="stat"><span>Formulaire</span><strong>${escapeHtml(template?.name || "-")}</strong></div>
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
              <button class="primary-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}">Nouvelle activité</button>
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
                    <div class="actions">
                      <button class="ghost-button" data-action="open-modal" data-modal="fieldIntervention" data-order="${order.id}" data-apartment="${selectedApartment?.id || ""}" data-equipment="${machine.id}">${intervention ? "Modifier le formulaire" : "Remplir le formulaire"}</button>
                    </div>
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
        <h3>${escapeHtml(equipment?.type || "Machine")}</h3>
        <div class="definition compact">${responses || `<div><span>Formulaire</span><strong>Aucune reponse</strong></div>`}</div>
        ${intervention.attachments?.length ? `<div class="mini-list">${intervention.attachments.map((file) => {
          const order = state.workOrders.find((item) => item.id === file.workOrderId || item.id === intervention.workOrderId);
          return `<div class="meta">Pièce jointe: ${escapeHtml(file.name)} | Origine: ${escapeHtml(order?.number || "-")}</div>`;
        }).join("")}</div>` : ""}
        <div class="meta">${escapeHtml(intervention.summary || "")}</div>
      </article>
    `;
  }

  function reportsView() {
    return appShell(`
      ${renderTopbar("Rapports", "Exports CSV pour suivi client, opérations et historique technique.")}
      <section class="report-grid">
        <article class="report-tile">
          <h3>Inventaire HVAC</h3>
          <p>Liste des équipements avec client, immeuble, appartement, statut et prochaines maintenances.</p>
          <button class="primary-button" data-action="export" data-report="equipment">Exporter CSV</button>
        </article>
        <article class="report-tile">
          <h3>Historique des interventions</h3>
          <p>Interventions terminées, technicien, type de travail, lectures et résumé.</p>
          <button class="primary-button" data-action="export" data-report="interventions">Exporter CSV</button>
        </article>
        <article class="report-tile">
          <h3>Appels et bons de travail</h3>
          <p>Demandes ouvertes, priorités, bons planifiés et statut d'exécution.</p>
          <button class="primary-button" data-action="export" data-report="operations">Exporter CSV</button>
        </article>
      </section>
    `);
  }

  function usersView() {
    const roles = state.roleDefinitions.map((role) => role.id);
    return appShell(`
      ${renderTopbar("Utilisateurs et accès", "Contrôle des rôles pour clients, techniciens, équipe interne et administrateurs.", `<button class="primary-button" data-action="open-modal" data-modal="user">Nouvel utilisateur</button>`)}
      <section class="panel">
        <div class="panel-body table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Courriel</th><th>Rôle</th><th>Client lié</th><th></th></tr></thead>
            <tbody>
              ${state.users.map((user) => {
                const client = state.clients.find((item) => item.id === user.clientId);
                return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(roleLabel(user.role))}</td><td>${escapeHtml(client?.name || "-")}</td><td><button class="link-button" data-action="open-modal" data-modal="user" data-id="${user.id}">Modifier</button></td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="panel-header"><h2>Matrice d'accès</h2></div>
        <div class="panel-body table-wrap">
          <table>
            <thead><tr><th>Rôle</th><th>Inventaire</th><th>Appels</th><th>Bons</th><th>Rapports</th><th>Utilisateurs</th></tr></thead>
            <tbody>
              ${roles.map((role) => `<tr><td>${roleLabel(role)}</td><td>${role === "client" ? "Lecture client" : "Oui"}</td><td>${["administrateur", "equipe_interne", "client"].includes(role) ? "Oui" : "Non"}</td><td>${role === "client" ? "Lecture" : role === "technicien" ? "Assignés" : "Oui"}</td><td>${["administrateur", "equipe_interne", "client"].includes(role) ? "Oui" : "Non"}</td><td>${["administrateur", "equipe_interne"].includes(role) ? "Oui" : "Non"}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `);
  }

  function rightsCatalog() {
    return [
      ["all", "Accès complet"],
      ["lieux", "Lieux et appartements"],
      ["equipment", "Équipements"],
      ["tickets", "Appels de service"],
      ["workorders", "Bons de travail"],
      ["interventions", "Interventions"],
      ["reports", "Rapports"],
      ["users", "Utilisateurs"],
      ["settings", "Paramètres"],
      ["portal", "Portail client"]
    ];
  }

  function settingsView() {
    return appShell(`
      ${renderTopbar("Paramètres", "Types d'appels, checklists et droits d'accès.", `
        <button class="primary-button" data-action="open-modal" data-modal="dataField">Champ de données</button>
        <button class="primary-button" data-action="open-modal" data-modal="serviceType">Type d'appel</button>
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
            <div class="panel-header"><h2>Types d'appel de service</h2></div>
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
          <div class="field"><label>Téléphone</label><input name="phone" autocomplete="tel"></div>
        </div>
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
          <div class="field"><label>Téléphone sur place</label><input name="onsiteContactPhone" value="${escapeHtml(building.onsiteContactPhone || "")}"></div>
        </div>
        <div class="field"><label>Email sur place</label><input name="onsiteContactEmail" type="email" value="${escapeHtml(building.onsiteContactEmail || "")}"></div>
        <div class="split">
          <div class="field"><label>Personne ressource facturation</label><input name="billingContactName" value="${escapeHtml(building.billingContactName || "")}"></div>
          <div class="field"><label>Téléphone facturation</label><input name="billingContactPhone" value="${escapeHtml(building.billingContactPhone || "")}"></div>
        </div>
        <div class="field"><label>Email facturation</label><input name="billingContactEmail" type="email" value="${escapeHtml(building.billingContactEmail || "")}"></div>
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
        <button class="primary-button" type="submit">${apartment.id ? "Enregistrer" : "Créer l'appartement"}</button>
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
    return modalShell(ticket.id ? "Modifier l'appel de service" : "Nouvel appel de service", `
      <form class="form-grid" data-form="ticket">
        <input type="hidden" name="id" value="${escapeHtml(ticket.id || "")}">
        <div class="field"><label>Équipement</label><select name="equipmentId" required>${equipmentOptions}</select></div>
        <div class="field"><label>Type d'appel</label><select name="serviceTypeId">${serviceOptions}</select></div>
        <div class="split">
          <div class="field"><label>Titre</label><input name="title" value="${escapeHtml(ticket.title || "")}" required placeholder="Ex.: Bruit anormal"></div>
          <div class="field"><label>Priorité</label><select name="priority"><option value="normale" ${ticket.priority === "normale" ? "selected" : ""}>Normale</option><option value="urgente" ${ticket.priority === "urgente" ? "selected" : ""}>Urgente</option><option value="basse" ${ticket.priority === "basse" ? "selected" : ""}>Basse</option></select></div>
        </div>
        <div class="field"><label>Statut</label><select name="status"><option value="ouvert" ${ticket.status === "ouvert" ? "selected" : ""}>Ouvert</option><option value="en_cours" ${ticket.status === "en_cours" ? "selected" : ""}>En cours</option><option value="ferme" ${ticket.status === "ferme" ? "selected" : ""}>Fermé</option></select></div>
        <div class="field"><label>Description</label><textarea name="description" required>${escapeHtml(ticket.description || "")}</textarea></div>
        <button class="primary-button" type="submit">${ticket.id ? "Enregistrer" : "Créer l'appel"}</button>
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
    const techOptions = state.users.filter((user) => user.role === "technicien").map((user) => `<option value="${user.id}" ${order.technicianId === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("");
    return modalShell(order.id ? "Modifier le bon de travail" : "Nouveau bon de travail", `
      <form class="form-grid" data-form="workorder">
        <input type="hidden" name="id" value="${escapeHtml(order.id || "")}">
        <input type="hidden" name="ticketId" value="${escapeHtml(modal.ticketId || "")}">
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
          <div class="field"><label>Technicien</label><select name="technicianId">${techOptions}</select></div>
        </div>
        <div class="split">
          <div class="field"><label>Date prévue</label><input name="scheduledDate" type="date" value="${escapeHtml(order.scheduledDate || today())}" required></div>
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

  function userModal(modal) {
    const user = state.users.find((item) => item.id === modal.id) || {};
    const clients = state.clients.map((client) => `<option value="${client.id}" ${user.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
    const roles = state.roleDefinitions.map((role) => `<option value="${role.id}" ${user.role === role.id ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("");
    return modalShell(user.id ? "Modifier l'utilisateur" : "Nouvel utilisateur", `
      <form class="form-grid" data-form="user">
        <input type="hidden" name="id" value="${escapeHtml(user.id || "")}">
        <div class="split">
          <div class="field"><label>Nom</label><input name="name" value="${escapeHtml(user.name || "")}" required></div>
          <div class="field"><label>Courriel</label><input name="email" type="email" value="${escapeHtml(user.email || "")}" required></div>
        </div>
        <div class="split">
          <div class="field"><label>Mot de passe</label><input name="password" value="${escapeHtml(user.password || "temp123")}" required></div>
          <div class="field"><label>Rôle</label><select name="role">${roles}</select></div>
        </div>
        <div class="field"><label>Client lié</label><select name="clientId"><option value="">Aucun</option>${clients}</select></div>
        <button class="primary-button" type="submit">${user.id ? "Enregistrer" : "Créer l'utilisateur"}</button>
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
    return modalShell(type.id ? "Modifier le type d'appel" : "Nouveau type d'appel", `
      <form class="form-grid" data-form="serviceType">
        <input type="hidden" name="id" value="${escapeHtml(type.id || "")}">
        <div class="field"><label>Nom du type d'appel</label><input name="name" value="${escapeHtml(type.name || "")}" required></div>
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
    const sourceOptions = allFields
      .filter((item) => item.id !== field.id && item.label)
      .map((item) => `<option value="${escapeHtml(item.id)}" ${field.showWhen?.fieldId === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
      .join("");
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
            <label>Afficher seulement si</label>
            <select name="q-show-field">
              <option value="">Toujours afficher</option>
              ${sourceOptions}
            </select>
          </div>
          <div class="field">
            <label>Réponse égale à</label>
            <input name="q-show-value" value="${escapeHtml(field.showWhen?.value || "")}" placeholder="Ex.: Reparation requise">
          </div>
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
    const equipment = state.equipment.find((item) => item.id === modal.equipmentId) || { apartmentId: modal.apartmentId, status: "actif" };
    const selectedApartmentId = equipment.apartmentId || modal.apartmentId || availableApartments[0]?.id || "__new";
    const apartment = state.apartments.find((item) => item.id === selectedApartmentId);
    const apartmentOptions = availableApartments.map((item) => `<option value="${item.id}" ${selectedApartmentId === item.id ? "selected" : ""}>Appartement ${escapeHtml(item.number)}${item.occupant ? ` - ${escapeHtml(item.occupant)}` : ""}</option>`).join("");
    const template = formTemplateForOrder(order);
    const activityFields = normalizeActivityFields(template?.activityFields);
    const statusOptions = dataFieldOptionsForSelect(activityFields.status);
    const existing = state.interventions.find((item) => item.workOrderId === order?.id && item.equipmentId === equipment.id);
    return modalShell(`Nouvelle activité${apartment ? ` - Apt ${escapeHtml(apartment.number)}` : ""}`, `
      <form class="form-grid" data-form="fieldIntervention" data-order-id="${escapeHtml(order?.id || "")}" data-equipment-id="${escapeHtml(equipment.id || "")}">
        <div class="form-section-title">Appartement</div>
        <div class="split">
          <div class="field"><label>Appartement</label><select name="apartmentId"><option value="__new" ${selectedApartmentId === "__new" ? "selected" : ""}>Nouvel appartement</option>${apartmentOptions}</select></div>
          <div class="field new-apartment-field"><label>Numéro du nouvel appartement</label><input name="newApartmentNumber" placeholder="Ex.: 1204"></div>
        </div>
        <div class="field new-apartment-field"><label>Occupant du nouvel appartement</label><input name="newApartmentOccupant" placeholder="Nom ou note d'accès"></div>
        <div class="form-section-title">Machine</div>
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
          <div class="field"><label>${activityFields.status.label}${activityFields.status.required ? " *" : ""}</label><select name="status" ${activityFields.status.required ? "required" : ""}>${statusOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${equipment.status === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>${activityFields.notes.label}${activityFields.notes.required ? " *" : ""}</label><textarea name="equipmentNotes" ${activityFields.notes.required ? "required" : ""}>${escapeHtml(equipment.notes || "")}</textarea></div>
        <div class="form-section-title">${escapeHtml(template?.name || "Formulaire")}</div>
        <div class="form-builder dynamic-form-grid">
          ${(template?.fields || []).map((field) => renderDynamicField(field, existing?.formResponses?.[field.label] ?? field.defaultValue)).join("")}
        </div>
        <div class="field">
          <label>Photos et documents</label>
          <input name="attachments" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,video/*,audio/*">
          <p class="meta">Maximum 3 fichiers, 10 MB par fichier. Les fichiers seront associés à l'appartement et à la machine de cette activité.</p>
        </div>
        ${existing?.attachments?.length ? `<div class="mini-list">${existing.attachments.map((file) => `<div class="meta">- ${escapeHtml(file.name)} (${escapeHtml(file.type || "fichier")})</div>`).join("")}</div>` : ""}
        <div class="field"><label>Resume de l'intervention</label><textarea name="summary" required>${escapeHtml(existing?.summary || "")}</textarea></div>
        <button class="primary-button" type="submit">Enregistrer appartement</button>
      </form>
    `);
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
      return `<div class="form-runtime-section"><h3>${escapeHtml(field.label)}</h3></div>`;
    }
    const depends = field.showWhen ? `data-visible-field="${escapeHtml(field.showWhen.fieldId)}" data-visible-value="${escapeHtml(field.showWhen.value)}"` : "";
    const options = field.options?.length ? field.options : ["Oui"];
    const required = field.required ? "required" : "";
    const label = `${escapeHtml(field.label)}${field.required ? " *" : ""}`;
    const layoutClass = field.layout === "half" ? " half-field" : "";
    if (field.type === "long") {
      return `<div class="field dynamic-field${layoutClass}" ${depends}><label>${label}</label><textarea name="field-${field.id}" ${required}>${escapeHtml(value || "")}</textarea></div>`;
    }
    if (field.type === "checkbox") {
      const values = Array.isArray(value) ? value : [value].filter(Boolean);
      return `<div class="field dynamic-field${layoutClass}" ${depends} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list checkbox-choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${values.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "single") {
      return `<div class="field dynamic-field${layoutClass}" ${depends} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option, index) => `<label><input type="radio" name="field-${field.id}" value="${escapeHtml(option)}" ${value === option ? "checked" : ""} ${field.required && index === 0 ? "required" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "multiple") {
      return `<div class="field dynamic-field${layoutClass}" ${depends} data-required="${field.required ? "true" : "false"}"><label>${label}</label><div class="choice-list">${options.map((option) => `<label><input type="checkbox" name="field-${field.id}" value="${escapeHtml(option)}" ${Array.isArray(value) && value.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></div>`;
    }
    if (field.type === "select") {
      return `<div class="field combo-field dynamic-field${layoutClass}" ${depends}><label>${label}</label>${comboInput(`field-${field.id}`, value || "", options, field.required)}</div>`;
    }
    return `<div class="field dynamic-field${layoutClass}" ${depends}><label>${label}</label><input name="field-${field.id}" value="${escapeHtml(value || "")}" ${required}></div>`;
  }

  function handleSubmit(event) {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const formType = form.dataset.form;
    if (formType === "login") login(values);
    if (formType === "signup") signup(values);
    if (formType === "forgotPassword") requestPasswordReset(values);
    if (formType === "resetPassword") resetPassword(values);
    if (formType === "building") saveBuilding(values);
    if (formType === "apartment") saveApartment(values);
    if (formType === "ticket") createTicket(values);
    if (formType === "workorder") createWorkOrder(values);
    if (formType === "equipment") createEquipment(values);
    if (formType === "user") createUser(values);
    if (formType === "dataField") saveDataField(form, values);
    if (formType === "serviceType") saveServiceType(values);
    if (formType === "interventionType") saveInterventionType(values);
    if (formType === "formTemplate") saveFormTemplate(form, values);
    if (formType === "role") saveRole(form, values);
    if (formType === "checklist") saveChecklist(form, values);
    if (formType === "fieldIntervention") saveFieldIntervention(form, values);
  }

  async function restoreSession() {
    if (!SERVER_ENABLED) return;
    if (state.resetToken) return;
    restoringSession = true;
    try {
      const response = await fetch("/api/session", { credentials: "same-origin" });
      if (response.ok) {
        const payload = await response.json();
        state = normalizeState(payload.state);
        state.sessionUserId = payload.user.id;
        state.activeView = state.activeView || "tableau";
        state.modal = null;
        state.toast = "";
        render();
      }
    } finally {
      restoringSession = false;
    }
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
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...values, seed })
        });
        const payload = await response.json();
        if (!response.ok) {
          showToast(payload.error || "Création du compte impossible.");
          return;
        }
        state = normalizeState(payload.state);
        state.sessionUserId = payload.user.id;
        state.activeView = "tableau";
        state.modal = null;
        state.toast = "Compte créé.";
        saveState();
        render();
        scheduleToastClear();
      } catch (error) {
        showToast("Serveur indisponible.");
      }
      return;
    }
    const client = {
      id: uid("client"),
      name: values.companyName,
      contact: values.name,
      email: values.email,
      phone: values.phone || ""
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
        const response = await fetch("/api/password-reset-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: values.email, seed })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          showToast(payload.error || "Demande impossible.");
          return;
        }
      } catch (error) {
        showToast("Serveur indisponible.");
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
      const response = await fetch("/api/password-reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: state.resetToken, password: values.password, confirmPassword: values.confirmPassword, seed })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(payload.error || "Réinitialisation impossible.");
        return;
      }
      state.resetToken = "";
      window.history.replaceState({}, document.title, window.location.pathname);
      setState({ modal: null, toast: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
    } catch (error) {
      showToast("Serveur indisponible.");
    }
  }

  async function login(values) {
    if (SERVER_ENABLED) {
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: values.email, password: values.password, seed })
        });
        const payload = await response.json();
        if (!response.ok) {
          showToast(payload.error || "Connexion impossible.");
          return;
        }
        state = normalizeState(payload.state);
        state.sessionUserId = payload.user.id;
        state.activeView = "tableau";
        state.modal = null;
        state.toast = "";
        saveState();
        render();
      } catch (error) {
        showToast("Serveur indisponible.");
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
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    }
    setState({ sessionUserId: null, activeView: "tableau", modal: null });
  }

  function saveBuilding(values) {
    const payload = {
      id: values.id || uid("b"),
      clientId: values.clientId,
      name: values.name,
      address: values.address,
      onsiteContactName: values.onsiteContactName,
      onsiteContactPhone: values.onsiteContactPhone,
      onsiteContactEmail: values.onsiteContactEmail,
      billingContactName: values.billingContactName,
      billingContactPhone: values.billingContactPhone,
      billingContactEmail: values.billingContactEmail,
      notes: values.notes
    };
    const index = state.buildings.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.buildings[index] = payload;
    else state.buildings.unshift(payload);
    setState({ modal: null, selectedBuildingId: payload.id, activeView: "lieu_detail", toast: index >= 0 ? "Lieu modifié." : "Lieu créé." });
  }

  function saveApartment(values) {
    const payload = {
      id: values.id || uid("apt"),
      buildingId: values.buildingId,
      number: values.number,
      occupant: values.occupant
    };
    const index = state.apartments.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.apartments[index] = payload;
    else state.apartments.push(payload);
    setState({ modal: null, selectedBuildingId: payload.buildingId, activeView: "lieu_detail", toast: index >= 0 ? "Appartement modifié." : "Appartement créé." });
  }

  function createTicket(values) {
    const { building, apartment } = equipmentContext(values.equipmentId);
    const serviceType = state.serviceTypes.find((item) => item.id === values.serviceTypeId) || state.serviceTypes[0];
    const existing = state.tickets.find((item) => item.id === values.id);
    if (existing) {
      Object.assign(existing, {
        serviceTypeId: values.serviceTypeId,
        buildingId: building.id,
        apartmentId: apartment.id,
        equipmentId: values.equipmentId,
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status
      });
      setState({ modal: null, activeView: "appels", toast: "Appel de service modifié." });
      return;
    }
    const ticket = {
      id: uid("tk"),
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
      createdBy: currentUser().id
    };
    state.tickets.unshift(ticket);
    setState({ modal: null, activeView: "appels", toast: "Appel de service créé." });
  }

  function createWorkOrder(values) {
    const scope = values.scope || "equipment";
    if (scope === "building" && !values.buildingId) {
      showToast("Choisissez un immeuble pour le BT de bloc.");
      return;
    }
    if (scope === "equipment" && !values.equipmentId) {
      showToast("Choisissez un equipement pour le BT.");
      return;
    }
    const existing = state.workOrders.find((item) => item.id === values.id);
    if (existing) {
      Object.assign(existing, {
        scope,
        buildingId: scope === "building" ? values.buildingId : "",
        equipmentId: scope === "equipment" ? values.equipmentId : "",
        typeId: values.typeId,
        formTemplateId: values.formTemplateId || state.formTemplates[0]?.id || "",
        technicianId: values.technicianId,
        scheduledDate: values.scheduledDate,
        status: values.status,
        notes: values.notes
      });
      setState({ modal: null, activeView: "bons", toast: "Bon de travail modifié." });
      return;
    }
    const number = `BT-${new Date().getFullYear()}-${String(state.workOrders.length + 1).padStart(3, "0")}`;
    const order = {
      id: uid("wo"),
      number,
      ticketId: values.ticketId || null,
      scope,
      buildingId: scope === "building" ? values.buildingId : "",
      equipmentId: scope === "equipment" ? values.equipmentId : "",
      typeId: values.typeId,
      formTemplateId: values.formTemplateId || state.formTemplates[0]?.id || "",
      technicianId: values.technicianId,
      scheduledDate: values.scheduledDate,
      status: values.status,
      notes: values.notes
    };
    state.workOrders.unshift(order);
    if (values.ticketId) {
      const ticket = state.tickets.find((item) => item.id === values.ticketId);
      if (ticket) ticket.status = "en_cours";
    }
    setState({ modal: null, activeView: "bons", toast: "Bon de travail créé." });
  }

  function createEquipment(values) {
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
        notes: values.notes
      });
      setState({ modal: null, selectedEquipmentId: existing.id, activeView: "detail", toast: "Machine modifiée." });
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
      notes: values.notes
    };
    state.equipment.unshift(equipment);
    setState({ modal: null, selectedEquipmentId: equipment.id, activeView: "detail", toast: "Équipement ajouté." });
  }

  function createUser(values) {
    const existing = state.users.find((item) => item.id === values.id);
    if (existing) {
      Object.assign(existing, {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        clientId: values.clientId || null
      });
      setState({ modal: null, activeView: "utilisateurs", toast: "Utilisateur modifié." });
      return;
    }
    state.users.push({
      id: uid("u"),
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      clientId: values.clientId || null
    });
    setState({ modal: null, activeView: "utilisateurs", toast: "Utilisateur créé." });
  }

  function saveServiceType(values) {
    const payload = {
      id: values.id || uid("appel"),
      name: values.name,
      defaultPriority: values.defaultPriority,
      linkedInterventionTypeId: values.linkedInterventionTypeId
    };
    const index = state.serviceTypes.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.serviceTypes[index] = payload;
    else state.serviceTypes.push(payload);
    setState({ modal: null, activeView: "parametres", toast: index >= 0 ? "Type d'appel modifié." : "Type d'appel créé." });
  }

  function saveInterventionType(values) {
    const payload = {
      id: values.id || uid("check"),
      name: values.name,
      defaultDuration: Number(values.defaultDuration || 60),
      checklist: values.checklist.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    };
    const index = state.interventionTypes.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.interventionTypes[index] = payload;
    else state.interventionTypes.push(payload);
    setState({ modal: null, activeView: "parametres", toast: index >= 0 ? "Checklist modifiée." : "Checklist créée." });
  }

  function saveDataField(form, values) {
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
    if (index >= 0) state.dataFields[index] = payload;
    else state.dataFields.push(payload);
    setState({ modal: null, activeView: "parametres", toast: index >= 0 ? "Champ de données modifié." : "Champ de données créé." });
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

  function saveFormTemplate(form, values) {
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
          branchRules: {},
          showWhen: null
        };
      }
      const showField = card.querySelector('[name="q-show-field"]')?.value || "";
      const showValue = card.querySelector('[name="q-show-value"]')?.value.trim() || "";
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
        branchRules,
        showWhen: showField && showValue ? { fieldId: showField, value: showValue } : null
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
    if (index >= 0) state.formTemplates[index] = payload;
    else state.formTemplates.push(payload);
    setState({ modal: null, activeView: "parametres", toast: index >= 0 ? "Formulaire modifié." : "Formulaire créé." });
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

  function saveRole(form, values) {
    const roleId = values.id || values.roleId.trim().toLowerCase().replace(/\s+/g, "_");
    const rights = rightsCatalog()
      .map(([right]) => right)
      .filter((right) => form.querySelector(`[name="right-${right}"]`)?.checked);
    const payload = { id: roleId, name: values.name, rights };
    const index = state.roleDefinitions.findIndex((item) => item.id === roleId);
    if (index >= 0) state.roleDefinitions[index] = payload;
    else state.roleDefinitions.push(payload);
    setState({ modal: null, activeView: "parametres", toast: index >= 0 ? "Rôle modifié." : "Rôle créé." });
  }

  function saveChecklist(form, values) {
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
    setState({ modal: null, activeView: "bons", toast: "Checklist enregistrée." });
  }

  async function saveFieldIntervention(form, values) {
    const orderId = form.dataset.orderId;
    const order = state.workOrders.find((item) => item.id === orderId);
    const template = formTemplateForOrder(order);
    if (!validateRequiredResponses(form, template)) return;
    const apartmentId = resolveActivityApartment(order, values);
    if (!apartmentId) return;
    let equipment = state.equipment.find((item) => item.id === form.dataset.equipmentId);
    if (!equipment) {
      equipment = {
        id: uid("eq"),
        apartmentId,
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location,
        installDate: today(),
        lastService: "",
        nextService: "",
        status: values.status || "actif",
        notes: values.equipmentNotes || ""
      };
      state.equipment.unshift(equipment);
    } else {
      Object.assign(equipment, {
        type: values.type,
        brand: values.brand || "",
        model: values.model || "",
        serial: values.serial || "",
        location: values.location,
        status: values.status || "actif",
        notes: values.equipmentNotes || ""
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
        type: file.type,
        size: file.size,
        workOrderId: file.workOrderId,
        sourceApartmentId: file.sourceApartmentId,
        sourceBuildingId: file.sourceBuildingId
      }))];
    }
    equipment.lastService = today();
    if (!equipment.nextService) {
      const next = new Date();
      next.setMonth(next.getMonth() + 6);
      equipment.nextService = next.toISOString().slice(0, 10);
    }
    if (order.status === "planifie") order.status = "en_cours";
    const progress = workOrderProgress(order);
    if (progress.totalApartments && progress.doneApartments === progress.totalApartments) order.status = "termine";
    setState({ modal: null, activeView: "execution", selectedWorkOrderId: order.id, selectedExecutionApartmentId: apartmentId, toast: "Formulaire terrain enregistre." });
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
    const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      showToast(`${oversized.name} dépasse 10 MB.`);
      return null;
    }
    return Promise.all(files.map((file) => readAttachment(file, apartmentId, equipmentId)));
  }

  function readAttachment(file, apartmentId, equipmentId) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: uid("file"),
        name: file.name,
        type: file.type,
        size: file.size,
        apartmentId,
        equipmentId,
        uploadedAt: today(),
        dataUrl: reader.result
      });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
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
          statut: statusText(item.status),
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
            nature: "Appel de service",
            reference: ticket.id,
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
    setState({ toast: message });
  }

  function bindEvents() {
    const app = document.getElementById("app");
    app.addEventListener("submit", handleSubmit);
    app.addEventListener("click", (event) => {
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
      if (action === "view") setState({ activeView: target.dataset.view, modal: null, mobileMenuOpen: false });
      if (action === "toggle-mobile-menu") {
        setState({ mobileMenuOpen: !state.mobileMenuOpen });
        return;
      }
      if (action === "close-mobile-menu") {
        setState({ mobileMenuOpen: false });
        return;
      }
      if (action === "toggle-sidebar-pin") {
        setState({
          sidebarMode: state.sidebarMode === "fixed" ? "auto" : "fixed",
          toast: state.sidebarMode === "fixed" ? "Menu replié par défaut." : "Menu épinglé."
        });
        return;
      }
      if (action === "select-building") setState({ selectedBuildingId: target.dataset.id, activeView: "lieu_detail" });
      if (action === "select-equipment") setState({ selectedEquipmentId: target.dataset.id, activeView: "detail" });
      if (action === "open-modal") {
        setState({ modal: {
          type: target.dataset.modal,
          id: target.dataset.id || null,
          equipmentId: target.dataset.equipment || null,
          ticketId: target.dataset.ticket || null,
          buildingId: target.dataset.building || null,
          apartmentId: target.dataset.apartment || null,
          orderId: target.dataset.order || null
        } });
      }
      if (action === "close-modal") {
        setState({ modal: null });
        return;
      }
      if (action === "open-checklist") setState({ modal: { type: "checklist", orderId: target.dataset.id } });
      if (action === "execute-workorder") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        const firstApartment = workOrderApartments(order)[0];
        setState({ selectedWorkOrderId: target.dataset.id, selectedExecutionApartmentId: firstApartment?.id || null, activeView: "execution", modal: null });
      }
      if (action === "select-execution-apartment") {
        setState({ selectedExecutionApartmentId: target.dataset.id });
      }
      if (action === "preview-attachment") {
        setState({ modal: { type: "attachmentPreview", fileId: target.dataset.id } });
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
        removeFormOption(target.closest("[data-option-row]"));
        return;
      }
      if (action === "remove-form-question") {
        removeFormQuestion(target.closest("[data-question]"));
        return;
      }
      if (action === "duplicate-form-template") {
        duplicateFormTemplate(target.dataset.id);
        return;
      }
      if (action === "ticket-status") {
        const ticket = state.tickets.find((item) => item.id === target.dataset.id);
        if (ticket) ticket.status = target.dataset.status;
        setState({ toast: "Statut de l'appel mis à jour." });
      }
      if (action === "order-status") {
        const order = state.workOrders.find((item) => item.id === target.dataset.id);
        if (order) order.status = target.dataset.status;
        setState({ toast: "Statut du BT mis à jour." });
      }
      if (action === "export") exportReport(target.dataset.report);
    });
    app.addEventListener("change", (event) => {
      handleFilter(event);
      updateDynamicVisibility(event.target.closest("form"));
      updateNewApartmentVisibility(event.target.closest("form"));
      if (event.target.name === "q-type") updateQuestionOptionEditor(event.target.closest("[data-question]"));
      if (event.target.name?.startsWith("activity-datafield-")) updateActivityOptionPicker(event.target);
    });
    app.addEventListener("input", (event) => {
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

  function duplicateFormTemplate(id) {
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
      branchRules: Object.fromEntries(Object.entries(field.branchRules || {}).map(([option, target]) => [option, idMap[target] || target]))
    }));
    state.formTemplates.push(copy);
    setState({ modal: { type: "formTemplate", id: copy.id }, activeView: "parametres", toast: "Formulaire dupliqué." });
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
      const select = card.querySelector('[name="q-show-field"]');
      if (!select) return;
      const current = select.value;
      const options = fields
        .filter((field) => field.id !== card.dataset.fieldId)
        .map((field) => `<option value="${escapeHtml(field.id)}" ${current === field.id ? "selected" : ""}>${escapeHtml(field.label)}</option>`)
        .join("");
      select.innerHTML = `<option value="">Toujours afficher</option>${options}`;
      select.value = fields.some((field) => field.id === current && field.id !== card.dataset.fieldId) ? current : "";
      const branchOptions = fields
        .filter((field) => field.id !== card.dataset.fieldId)
        .map((field, index) => `<option value="${escapeHtml(field.id)}">${index + 1}. ${escapeHtml(field.label)}</option>`)
        .join("");
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
    field.querySelector("[data-combo-options]")?.classList.add("hidden");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function hideComboOptions() {
    document.querySelectorAll("[data-combo-options]").forEach((list) => list.classList.add("hidden"));
  }

  let draggedQuestion = null;
  let draggedOption = null;

  function handleQuestionDragStart(event) {
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
    form.querySelectorAll("[data-visible-field]").forEach((field) => {
      const sourceName = `field-${field.dataset.visibleField}`;
      const sourceInputs = Array.from(form.querySelectorAll(`[name="${sourceName}"]`));
      const values = sourceInputs
        .filter((input) => input.type !== "checkbox" && input.type !== "radio" || input.checked)
        .map((input) => input.value);
      const hidden = !values.includes(field.dataset.visibleValue);
      field.classList.toggle("hidden", hidden);
      field.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = hidden;
      });
    });
  }

  function handleFilter(event) {
    const target = event.target.closest("[data-action='filter']");
    if (!target) return;
    const nextFilters = { ...state.filters, [target.dataset.filter]: target.value };
    if (target.dataset.filter === "buildingId") nextFilters.apartmentId = "all";
    state.filters = nextFilters;
    saveState();
    render();
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
    else if (state.activeView === "appels") app.innerHTML = ticketsView();
    else if (state.activeView === "bons") app.innerHTML = workOrdersView();
    else if (state.activeView === "execution") app.innerHTML = workOrderExecutionView();
    else if (state.activeView === "rapports") app.innerHTML = reportsView();
    else if (state.activeView === "utilisateurs" && can("users")) app.innerHTML = usersView();
    else if (state.activeView === "parametres" && (can("settings") || can("users"))) app.innerHTML = settingsView();
    else app.innerHTML = dashboard();
    updateDynamicVisibility(app.querySelector("form[data-form='fieldIntervention']"));
    updateNewApartmentVisibility(app.querySelector("form[data-form='fieldIntervention']"));
  }

  bindEvents();
  render();
  restoreSession();
})();

