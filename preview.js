(function () {
  const hasDOM = typeof document !== "undefined";
  const body = hasDOM ? document.body : { dataset: {} };
  const profileData = {
    interne: {
      label: "Équipe interne",
      name: "Gustavo Figueiredo",
      initials: "GF",
      subtitle: "Vue opérationnelle des rendez-vous et travaux en cours.",
      email: "admin@klimfax.ca",
      phone: "(514) 555-0148",
      position: "Administration"
    },
    client: {
      label: "Client gestionnaire",
      name: "Sophie Martin",
      initials: "SM",
      subtitle: "État de votre parc HVAC et suivi des travaux.",
      email: "client@gestionazur.ca",
      phone: "(514) 555-0162",
      position: "Direction"
    },
    technicien: {
      label: "Technicien",
      name: "Slimane Kadri",
      initials: "SK",
      subtitle: "Interventions assignées et priorités de la journée.",
      email: "tech@klimfax.ca",
      phone: "(514) 555-0194",
      position: "Technicien terrain"
    },
    conseiller: {
      label: "Conseiller",
      name: "Patrick Synnette",
      initials: "PS",
      subtitle: "Préparez vos soumissions et suivez vos opportunités commerciales.",
      email: "patrick.synnette@klimfax.ca",
      phone: "(514) 555-0176",
      position: "Conseiller multilogement"
    }
  };
  const clientScopeData = Object.freeze({
    group: Object.freeze({
      name: "Groupe Gestion Azur",
      description: "Siège social · Vue consolidée des 3 filiales",
      accessTitle: "Accès Headquarters",
      accessCopy: "Toutes les filiales et tous les immeubles",
      profileName: "Sophie Martin",
      profileInitials: "SM",
      profileLabel: "Headquarters · Groupe Gestion Azur",
      clients: 3,
      buildings: 4,
      equipment: 235,
      work: 5
    }),
    "tours-client": Object.freeze({
      name: "Gestion Tours Laval",
      description: "Filiale cliente · 2 immeubles autorisés",
      accessTitle: "Accès filiale",
      accessCopy: "Tours Laval et Complexe Saint-Martin",
      profileName: "Marie-Claude Roy",
      profileInitials: "MR",
      profileLabel: "Administratrice · Gestion Tours Laval",
      clients: 1,
      buildings: 2,
      equipment: 149,
      work: 2
    }),
    "verdun-client": Object.freeze({
      name: "Résidences Verdun",
      description: "Filiale cliente · 1 immeuble autorisé",
      accessTitle: "Accès filiale",
      accessCopy: "Résidence Verdun uniquement",
      profileName: "Émilie Gagnon",
      profileInitials: "ÉG",
      profileLabel: "Administratrice · Résidences Verdun",
      clients: 1,
      buildings: 1,
      equipment: 54,
      work: 2
    }),
    "riviere-client": Object.freeze({
      name: "Copropriété Rivière Nord",
      description: "Filiale cliente · 1 immeuble autorisé",
      accessTitle: "Accès filiale",
      accessCopy: "Condo Rivière Nord uniquement",
      profileName: "Alex Nguyen",
      profileInitials: "AN",
      profileLabel: "Administrateur · Copropriété Rivière Nord",
      clients: 1,
      buildings: 1,
      equipment: 32,
      work: 1
    })
  });
  const locationClientMap = Object.freeze({
    tours: "tours-client",
    saintmartin: "tours-client",
    verdun: "verdun-client",
    riviere: "riviere-client"
  });
  const placeDetailData = Object.freeze({
    tours: Object.freeze({ name: "Tours Laval", client: "Gestion Tours Laval", address: "1250, boulevard René-Lévesque · Laval", responsible: "Monica Soares", phone: "(514) 906-6460 · poste 204", equipment: "52 équipements", status: "50 actifs · 2 à surveiller" }),
    saintmartin: Object.freeze({ name: "Complexe Saint-Martin", client: "Gestion Tours Laval", address: "2555, boulevard Saint-Martin Ouest · Laval", responsible: "Karim Bouchard", phone: "(450) 555-0172 · poste 118", equipment: "97 équipements", status: "94 actifs · 3 à surveiller" }),
    verdun: Object.freeze({ name: "Résidence Verdun", client: "Résidences Verdun", address: "4300, rue Wellington · Montréal", responsible: "Émilie Gagnon", phone: "(514) 555-0124 · poste 301", equipment: "54 équipements", status: "51 actifs · 2 à surveiller · 1 en réparation" }),
    riviere: Object.freeze({ name: "Condo Rivière Nord", client: "Copropriété Rivière Nord", address: "780, chemin de la Rive · Laval", responsible: "Alex Nguyen", phone: "(514) 555-0166", equipment: "32 équipements", status: "30 actifs · 2 hors service" })
  });
  const placeResponsibleData = {
    tours: { name: "Monica Soares", phone: "(514) 906-6460 · poste 204", email: "monica.soares@gestiontours.ca" },
    saintmartin: { name: "Karim Bouchard", phone: "(450) 555-0172 · poste 118", email: "karim.bouchard@gestiontours.ca" },
    verdun: { name: "Émilie Gagnon", phone: "(514) 555-0124 · poste 301", email: "emilie.gagnon@residencesverdun.ca" },
    riviere: { name: "Alex Nguyen", phone: "(514) 555-0166", email: "alex.nguyen@coprorivierenord.ca" }
  };
  let activePlaceDetailKey = "tours";
  let currentClientScope = "group";
  let currentClientProfileScope = "group";
  const months = ["Juin 2026", "Juillet 2026", "Août 2026"];
  let monthIndex = 1;
  const requestTypeData = {
    service: { label: "Appel de service", price: 149, icon: "#icon-wrench" },
    inspection: { label: "Inspection", price: 95, icon: "#icon-eye" },
    maintenance: { label: "Entretien", price: 129, icon: "#icon-calendar" },
    replacement: { label: "Remplacement", price: 0, icon: "#icon-wrench", variablePrice: true }
  };
  const prototypeToday = new Date("2026-08-30T12:00:00");
  const recommendationDateFormatter = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  const recommendationRecords = [
    { id: "rec-replace-1104", systemId: "ptac-1104", title: "Remplacement du système recommandé", serviceType: "replacement", serviceLabel: "Remplacement", date: "2026-08-20", deadline: "late", workflow: "pending", description: "Le compresseur présente des arrêts intermittents et le système approche de sa durée de vie habituelle.", quoteNumber: "SO-2026-031" },
    { id: "rec-maint-ptac205", systemId: "ptac-205", title: "Entretien préventif recommandé", serviceType: "maintenance", serviceLabel: "Entretien", date: "2026-08-18", deadline: "late", workflow: "planned", description: "Un entretien plus fréquent est recommandé pour les systèmes situés aux étages inférieurs." },
    { id: "rec-inspect-central", systemId: "central-mech", title: "Inspection technique recommandée", serviceType: "inspection", serviceLabel: "Inspection", date: "2026-09-05", deadline: "due", workflow: "pending", description: "Une inspection complète aidera à confirmer la stabilité du système central avant la prochaine période de pointe." },
    { id: "rec-maint-204", systemId: "heatpump-204", title: "Prochain entretien recommandé", serviceType: "maintenance", serviceLabel: "Entretien", date: "2026-09-15", deadline: "due", workflow: "pending", description: "L’entretien du système complet est recommandé selon la fréquence applicable à l’immeuble." },
    { id: "rec-replace-central", systemId: "central-mech", title: "Évaluation de remplacement recommandée", serviceType: "replacement", serviceLabel: "Remplacement", date: "2026-09-25", deadline: "due", workflow: "pending", description: "Une évaluation permettra de comparer la fiabilité actuelle et le coût estimé d’un remplacement." },
    { id: "rec-inspect-502", systemId: "heatpump-502", title: "Inspection du niveau sonore", serviceType: "inspection", serviceLabel: "Inspection", date: "2026-10-12", deadline: "upcoming", workflow: "planned", description: "Le système reste opérationnel; une inspection est recommandée pour suivre l’évolution du bruit au démarrage." },
    { id: "rec-maint-101", systemId: "heatpump-101-saintmartin", title: "Prochain entretien recommandé", serviceType: "maintenance", serviceLabel: "Entretien", date: "2026-10-30", deadline: "upcoming", workflow: "pending", description: "Entretien saisonnier recommandé pour le système complet." }
  ];
  const scheduledSystemServices = Object.freeze({
    "ptac-308-verdun": Object.freeze({ label: "Réparation planifiée", date: "2026-09-08", copy: "Réparation · rendez-vous confirmé" })
  });
  const maintenanceHealthByScope = Object.freeze({
    group: Object.freeze({ current: 221, eligible: 235 }),
    "tours-client": Object.freeze({ current: 143, eligible: 149 }),
    "verdun-client": Object.freeze({ current: 48, eligible: 54 }),
    "riviere-client": Object.freeze({ current: 30, eligible: 32 })
  });
  let activeRecommendationPostponeId = "";
  let currentRecommendationDeadlineFilter = "all";
  let currentRequestRecordTab = "all";
  let apartmentPreviewReturnButton = null;
  const requestCart = new Map();
  const expandedRequestCartServices = new Set();
  let selectedRequestType = "service";
  let systemDetailReturnScreen = "equipment-inventory";
  let currentSystemDetailId = "";
  const currencyFormatter = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
  const warrantyDateFormatter = new Intl.DateTimeFormat("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
  const warrantyReferenceDate = new Date("2026-08-23T12:00:00");
  const pricingConfig = Object.freeze({
    general: Object.freeze({
      tps: 0.05,
      tvq: 0.09975,
      productiveHoursPerDay: 7,
      factorMin: 0.95,
      factorMax: 1.05,
      klimparcThreshold: 50,
      klimparcCostPerUnit: 5,
      volume: Object.freeze({ minimum: 8, maximum: 100, maximumDiscount: 0.10 }),
      commission: Object.freeze({ maximum: 0.15, minimum: 0.10 }),
      loyaltyDiscount: 0.02,
      attendanceDiscount: 0.02,
      asNeededFactor: 0.75
    }),
    murale: Object.freeze({
      hourlyRate: 116,
      travel: Object.freeze({ "Rive-Sud": 87, "Montréal/Laval": 139.20 }),
      minimumQuantities: Object.freeze({ inspection: 16, entretien: 8 }),
      times: Object.freeze({ inspection: 20, entretien: 10, coiljet: 15, condenser: 10, pressure: 10, admin: 3, balcony: 0, height: 15, roof: 15, stair: 15 }),
      products: Object.freeze({ inspection: 0, entretien: 5, coiljet: 8, condenser: 2, pressure: 0 })
    }),
    monobloc: Object.freeze({
      hourlyRates: Object.freeze({ oneTechnician: 123, twoTechnicians: 183 }),
      travel: Object.freeze({
        "Rive-Sud": Object.freeze({ oneTechnician: 92.25, twoTechnicians: 137.25 }),
        "Montréal/Laval": Object.freeze({ oneTechnician: 147.60, twoTechnicians: 219.60 })
      }),
      minimumQuantities: Object.freeze({ inspection: 16, entretien: 8 }),
      classTimes: Object.freeze([
        Object.freeze({ inspection: 27, comfort: 18, premium: 15 }),
        Object.freeze({ inspection: 27, comfort: 18, premium: 30 }),
        Object.freeze({ inspection: 27, comfort: 33, premium: 30 }),
        Object.freeze({ inspection: 27, comfort: 33, premium: 30 }),
        Object.freeze({ inspection: 27, comfort: 63, premium: 30 })
      ]),
      premiumDailyCapacity: Object.freeze([6, 5, 5, 4, 3]),
      products: Object.freeze({ inspection: 0, comfort: 40, premium: 35, admin: 0, removeMachine: 0 }),
      times: Object.freeze({ admin: 3, removeMachine: 15, klimparc: 0 })
    })
  });
  const quoteClients = Object.freeze({
    "tours-laval": Object.freeze({ name: "Tours Laval", contact: "Marie-Claude Roy", address: "810, rue Jean-Neveu, Longueuil, QC J4G 2M1", phone: "450 555-0188", email: "mc.roy@tourslaval.ca", parkQuantity: 149 }),
    "residence-verdun": Object.freeze({ name: "Résidence Verdun", contact: "Émilie Gagnon", address: "4020, rue Wellington, Montréal, QC H4G 1V3", phone: "514 555-0124", email: "egagnon@residenceverdun.ca", parkQuantity: 54 }),
    "condo-riviere": Object.freeze({ name: "Condo Rivière Nord", contact: "Alex Nguyen", address: "1250, boulevard René-Lévesque, Montréal, QC H3B 4W8", phone: "514 555-0166", email: "administration@crn.ca", parkQuantity: 32 })
  });
  const quoteState = {
    clientMode: "existing",
    clientId: "tours-laval",
    clientName: "Tours Laval",
    clientContact: "Marie-Claude Roy",
    clientAddress: "810, rue Jean-Neveu, Longueuil, QC J4G 2M1",
    clientPhone: "450 555-0188",
    clientEmail: "mc.roy@tourslaval.ca",
    parkQuantity: 149,
    quantity: 149,
    type: "monobloc",
    zone: "Rive-Sud",
    extraMinutes: 0,
    class1: 0,
    class2: 149,
    class3: 0,
    class4: 0,
    class5: 0,
    muraleBalcony: 149,
    muraleHeight: 0,
    muraleRoof: 0,
    muraleStair: 0,
    essentialPlan: "inspection",
    superiorPlan: "confort",
    essentialPlanMurale: "inspection",
    superiorPlanMurale: "entretien",
    essentialRemoveMachine: false,
    superiorRemoveMachine: true,
    essentialCoiljet: "",
    superiorCoiljet: "",
    essentialCoiljetMurale: "",
    superiorCoiljetMurale: "all",
    essentialPressure: false,
    essentialCondenser: false,
    superiorPressure: false,
    superiorCondenser: false,
    loyalty: false,
    attendance: false,
    attendanceQuantity: 0,
    factor: 1,
    machineSaleEnabled: false,
    machine1Name: "",
    machine1Description: "",
    machine1Price1: 0,
    machine1Price2: 0,
    machine1Price10: 0,
    machine1Grant: 0,
    machine2Name: "",
    machine2Description: "",
    machine2Price1: 0,
    machine2Price2: 0,
    machine2Price10: 0,
    machine2Grant: 0,
    machineLaborWarranty: "1 an",
    machinePartsWarranty: "Selon le fabricant"
  };

  function matchesRole(element, role) {
    return (element.dataset.visibleRoles || "").split(/\s+/).includes(role);
  }

  function closeNotifications() {
    const drawer = document.querySelector("[data-notification-drawer]");
    const backdrop = document.querySelector(".drawer-backdrop");
    drawer.hidden = true;
    backdrop.hidden = true;
  }

  function openRequestCart() {
    const drawer = document.querySelector("[data-request-cart-drawer]");
    const backdrop = document.querySelector(".request-cart-backdrop");
    if (!drawer || !backdrop) return;
    closeNotifications();
    closeAIChat();
    drawer.hidden = false;
    backdrop.hidden = false;
    body.classList.add("request-cart-open");
  }

  function closeRequestCart() {
    const drawer = document.querySelector("[data-request-cart-drawer]");
    const backdrop = document.querySelector(".request-cart-backdrop");
    if (!drawer || !backdrop) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    body.classList.remove("request-cart-open");
  }

  function closeAIChat() {
    const panel = document.querySelector("[data-ai-chat-panel]");
    const launcher = document.querySelector("[data-ai-chat-toggle]");
    if (!panel || !launcher) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    body.classList.remove("ai-chat-open");
  }

  function openAIChat() {
    const panel = document.querySelector("[data-ai-chat-panel]");
    const launcher = document.querySelector("[data-ai-chat-toggle]");
    const input = document.querySelector("[data-ai-chat-input]");
    if (!panel || !launcher) return;
    closeNotifications();
    closeRequestCart();
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    body.classList.add("ai-chat-open");
    window.setTimeout(() => input?.focus(), 0);
  }

  function toggleAIChat() {
    const panel = document.querySelector("[data-ai-chat-panel]");
    if (!panel) return;
    if (panel.hidden) openAIChat();
    else closeAIChat();
  }

  function resetAIChatForRole(profile) {
    const thread = document.querySelector("[data-ai-chat-thread]");
    const welcome = document.querySelector("[data-ai-chat-welcome]");
    if (!thread || !welcome) return;
    thread.querySelectorAll(".ai-chat-message:not(:first-child)").forEach((message) => message.remove());
    const firstName = profile.name.split(" ")[0];
    welcome.textContent = `Bonjour ${firstName}, je peux répondre à vos questions sur l’inventaire, les travaux, les coûts, les garanties et les entretiens de tout le parc KlimaParc.`;
  }

  function getAIChatResponse(question) {
    const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/fonctionn|equipement actif|appartement.*actif/.test(normalized)) {
      return "Dans l’inventaire présenté, les appartements 204, 502 et 1104 possèdent au moins un équipement actif. L’équipement de l’appartement 308 est actuellement à surveiller.";
    }
    if (/hors service|en panne|ne fonctionne/.test(normalized)) {
      return "Le rapport mensuel signale 2 équipements hors service dans le parc. Ils sont déjà suivis; vous pouvez ouvrir Équipements pour consulter leur dossier et les travaux associés.";
    }
    if (/travaux|bon de travail|\bbt\b|intervention/.test(normalized)) {
      return "Il y a 3 travaux en cours. Le BT-2026-014 concerne notamment l’entretien préventif de Tours Laval, avec un rendez-vous le 16 juillet à 08:00.";
    }
    if (/garantie|pieces|main.d.oeuvre/.test(normalized)) {
      return "Pour l’unité Carrier de l’appartement 204, la garantie de main-d’œuvre a expiré le 15 septembre 2023 et la garantie des pièces demeure valide jusqu’au 15 septembre 2031.";
    }
    if (/entretien|maintenance|echeance|prochain/.test(normalized)) {
      return "Les prochains entretiens présentés sont Tours Laval le 22 juillet, Résidence Verdun le 5 août et Condo Rivière Nord le 18 août. Le premier est planifié et le second reste à confirmer.";
    }
    if (/cout|depense|remplac/.test(normalized)) {
      return "L’unité Carrier de l’appartement 204 totalise 1 254,50 $ de coûts connus. Cela représente 39 % de sa valeur de remplacement estimée à 3 200,00 $.";
    }
    return "Je peux croiser les équipements, appartements, travaux, demandes, coûts, garanties et entretiens. Essayez par exemple : « Quels appartements ont un équipement actif? »";
  }

  function appendAIChatMessage(type, text) {
    const thread = document.querySelector("[data-ai-chat-thread]");
    if (!thread) return;
    const profile = profileData[body.dataset.role] || profileData.interne;
    const message = document.createElement("article");
    message.className = `ai-chat-message ${type}`;
    const avatar = document.createElement("span");
    const content = document.createElement("div");
    const author = document.createElement("strong");
    const paragraph = document.createElement("p");
    if (type === "assistant") {
      avatar.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#icon-ai-chat"></use></svg>';
      author.textContent = "Assistant KlimaParc";
    } else {
      avatar.textContent = profile.initials;
      author.textContent = profile.name;
    }
    paragraph.textContent = text;
    content.append(author, paragraph);
    message.append(avatar, content);
    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;
  }

  function sendAIChatQuestion(question) {
    const input = document.querySelector("[data-ai-chat-input]");
    const message = (question ?? input?.value ?? "").trim();
    if (!input || !message) {
      input?.focus();
      return;
    }
    appendAIChatMessage("user", message);
    input.value = "";
    appendAIChatMessage("assistant", getAIChatResponse(message));
    input.focus();
  }

  function inferClientKey(value = "") {
    const normalized = normalizeWorkOrderSearch(value);
    if (normalized.includes("saint martin") || normalized.includes("tours laval")) return "tours-client";
    if (normalized.includes("verdun")) return "verdun-client";
    if (normalized.includes("riviere nord")) return "riviere-client";
    return "";
  }

  function isAllowedForClientScope(element) {
    if (body.dataset.role !== "client" || currentClientScope === "group") return true;
    const scopedElement = element.closest("[data-client-key]");
    return !scopedElement || scopedElement.dataset.clientKey === currentClientScope;
  }

  function assignClientScopeMetadata() {
    document.querySelectorAll(".work-order-row, .request-row, .timeline-row, .decision-row, .list-row").forEach((item) => {
      if (!item.dataset.clientKey) item.dataset.clientKey = inferClientKey(item.textContent);
    });
    document.querySelectorAll("[data-place-row]").forEach((row) => { row.dataset.screen = "place-detail"; });
  }

  function getPlaceKeyFromRow(row) {
    const name = normalizeWorkOrderSearch(row?.querySelector(":scope > span:nth-child(2) > strong")?.textContent);
    return Object.entries(placeDetailData).find(([, place]) => normalizeWorkOrderSearch(place.name) === name)?.[0] || "tours";
  }

  function openPlaceDetail(row) {
    const locationKey = getPlaceKeyFromRow(row);
    const place = placeDetailData[locationKey] || placeDetailData.tours;
    activePlaceDetailKey = locationKey;
    const detail = document.querySelector('[data-screen-view="place-detail"]');
    if (!detail) return;
    const eyebrow = detail.querySelector(".page-heading .eyebrow");
    const address = detail.querySelector(".page-heading p");
    const overview = detail.querySelectorAll(".place-detail-overview > div");
    if (eyebrow) eyebrow.textContent = `${place.client} · ${place.name}`;
    if (address) address.textContent = place.address;
    renderPlaceResponsible();
    if (overview[1]) {
      overview[1].querySelector("strong").textContent = place.equipment;
      overview[1].querySelector("span").textContent = place.status;
    }
    buildPlaceEquipmentInventory(locationKey);
    updatePlaceInventoryFloorOptions();
    filterPlaceEquipmentInventory();
  }

  function renderPlaceResponsible() {
    const detail = document.querySelector('[data-screen-view="place-detail"]');
    const responsible = placeResponsibleData[activePlaceDetailKey];
    const summary = detail?.querySelector(".place-responsible-summary");
    const name = detail?.querySelector("[data-place-responsible-name]");
    const contact = detail?.querySelector("[data-place-responsible-contact]");
    const action = detail?.querySelector("[data-manage-place-responsible]");
    if (!summary || !name || !contact || !action) return;
    summary.classList.toggle("is-empty", !responsible);
    name.textContent = responsible?.name || "Aucun responsable assigné";
    contact.textContent = responsible ? [responsible.phone, responsible.email].filter(Boolean).join(" · ") || "Coordonnées à compléter" : "Ajoutez un contact pour faciliter l’accès sur place.";
    action.textContent = responsible ? "Modifier" : "Ajouter";
  }

  function openPlaceResponsibleModal() {
    const modal = document.querySelector("[data-place-responsible-modal]");
    const place = placeDetailData[activePlaceDetailKey] || placeDetailData.tours;
    const responsible = placeResponsibleData[activePlaceDetailKey];
    if (!modal) return;
    const building = modal.querySelector("[data-place-responsible-building]");
    if (building) building.textContent = place.name;
    ["name", "phone", "email"].forEach((field) => {
      const input = modal.querySelector(`[data-place-responsible-field="${field}"]`);
      if (input) input.value = responsible?.[field] || "";
    });
    const remove = modal.querySelector("[data-remove-place-responsible]");
    if (remove) remove.hidden = !responsible;
    modal.hidden = false;
    window.setTimeout(() => modal.querySelector('[data-place-responsible-field="name"]')?.focus(), 0);
  }

  function closePlaceResponsibleModal() {
    const modal = document.querySelector("[data-place-responsible-modal]");
    if (modal) modal.hidden = true;
  }

  function savePlaceResponsible() {
    const modal = document.querySelector("[data-place-responsible-modal]");
    if (!modal) return;
    const values = Object.fromEntries(["name", "phone", "email"].map((field) => [field, modal.querySelector(`[data-place-responsible-field="${field}"]`)?.value.trim() || ""]));
    if (!values.name) {
      modal.querySelector('[data-place-responsible-field="name"]')?.focus();
      showToast("Nom requis", "Indiquez le nom du responsable sur place avant d’enregistrer.");
      return;
    }
    placeResponsibleData[activePlaceDetailKey] = values;
    renderPlaceResponsible();
    closePlaceResponsibleModal();
    showToast("Responsable mis à jour", `${values.name} est maintenant le contact sur place pour cet immeuble.`);
  }

  function removePlaceResponsible() {
    const removed = placeResponsibleData[activePlaceDetailKey];
    delete placeResponsibleData[activePlaceDetailKey];
    renderPlaceResponsible();
    closePlaceResponsibleModal();
    showToast("Responsable retiré", `${removed?.name || "Le contact"} n’est plus associé à cet immeuble.`);
  }

  function getEffectiveClientFilter(selector) {
    if (body.dataset.role === "client" && currentClientScope !== "group") return currentClientScope;
    return document.querySelector(selector)?.value || "all";
  }

  function filterPlacesByScope() {
    const selectedClient = getEffectiveClientFilter("[data-place-client-filter]");
    let visibleCount = 0;
    document.querySelectorAll("[data-place-row]").forEach((row) => {
      row.hidden = selectedClient !== "all" && row.dataset.clientKey !== selectedClient;
      if (!row.hidden) visibleCount += 1;
    });
    const displayScope = selectedClient === "all" ? "group" : selectedClient;
    const scope = clientScopeData[displayScope] || clientScopeData.group;
    const title = document.querySelector("[data-places-title]");
    const subtitle = document.querySelector("[data-places-subtitle]");
    const directoryTitle = document.querySelector("[data-places-directory-title]");
    if (title) title.textContent = displayScope === "group" ? "Tous les immeubles du groupe" : `Immeubles de ${scope.name}`;
    if (subtitle) subtitle.textContent = displayScope === "group" ? "Vue consolidée des immeubles appartenant aux filiales de Groupe Gestion Azur." : `Périmètre limité aux immeubles rattachés à ${scope.name}.`;
    if (directoryTitle) directoryTitle.textContent = displayScope === "group" ? "Immeubles de toutes les filiales" : `Immeubles autorisés · ${scope.name}`;
    const clientsMetric = document.querySelector("[data-place-summary-clients]");
    const buildingsMetric = document.querySelector("[data-place-summary-buildings]");
    const equipmentMetric = document.querySelector("[data-place-summary-equipment]");
    const workMetric = document.querySelector("[data-place-summary-work]");
    if (clientsMetric) clientsMetric.textContent = scope.clients;
    if (buildingsMetric) buildingsMetric.textContent = scope.buildings;
    if (equipmentMetric) equipmentMetric.textContent = scope.equipment;
    if (workMetric) workMetric.textContent = scope.work;
    const empty = document.querySelector("[data-places-scope-empty]");
    if (empty) empty.hidden = visibleCount > 0;
  }

  function filterClientDashboardScope() {
    const dashboard = document.querySelector('[data-dashboard-role="client"]');
    if (!dashboard) return;
    dashboard.querySelectorAll(".timeline-row, .decision-row, .list-row").forEach((item) => {
      item.hidden = !isAllowedForClientScope(item);
    });
    const metricsByScope = {
      group: [235, 5, 7, 2],
      "tours-client": [149, 2, 3, 1],
      "verdun-client": [54, 2, 2, 0],
      "riviere-client": [32, 1, 2, 1]
    };
    const values = metricsByScope[currentClientScope] || metricsByScope.group;
    dashboard.querySelectorAll(".executive-kpis > div").forEach((metric, index) => {
      const value = metric.querySelector("strong");
      if (value && values[index] !== undefined) value.textContent = values[index];
    });
    const introTitle = dashboard.querySelector(".executive-intro h2");
    const introCopy = dashboard.querySelector(".executive-intro p");
    const scope = clientScopeData[currentClientScope];
    if (introTitle) introTitle.textContent = currentClientScope === "group" ? "Tous les parcs sont réunis dans une seule vue" : `Parc de ${scope.name}`;
    if (introCopy) introCopy.textContent = currentClientScope === "group" ? "Suivez les indicateurs des 3 filiales sans mélanger leurs comptes, contrats et commandes." : "Seuls les immeubles, systèmes et travaux autorisés pour cette filiale sont affichés.";
    updateDashboardRecommendationCounts();
    renderMaintenanceHealth();
  }

  function updateScopedOperationalSummaries() {
    const workOrderStats = {
      group: [4, 7, 3, 1, 1, 18],
      "tours-client": [2, 3, 1, 1, 1, 8],
      "verdun-client": [1, 3, 1, 0, 0, 6],
      "riviere-client": [1, 1, 1, 0, 0, 4]
    };
    const values = workOrderStats[currentClientScope] || workOrderStats.group;
    document.querySelectorAll(".work-order-summary > span, .work-order-summary > button").forEach((metric, index) => {
      const value = metric.querySelector("strong");
      if (value && values[index] !== undefined) value.textContent = values[index];
    });
  }

  function updateClientScopeControls() {
    const scope = clientScopeData[currentClientScope] || clientScopeData.group;
    const profileScope = clientScopeData[currentClientProfileScope] || clientScopeData.group;
    const hasHeadquartersAccess = currentClientProfileScope === "group";
    document.querySelectorAll("[data-client-scope-select]").forEach((select) => {
      Array.from(select.options).forEach((option) => {
        option.disabled = !hasHeadquartersAccess && option.value !== currentClientProfileScope;
      });
      select.value = currentClientScope;
    });
    document.querySelectorAll("[data-client-scope-name]").forEach((element) => { element.textContent = scope.name; });
    document.querySelectorAll("[data-client-scope-description]").forEach((element) => { element.textContent = scope.description; });
    document.querySelectorAll("[data-client-scope-access-title]").forEach((element) => { element.textContent = profileScope.accessTitle; });
    document.querySelectorAll("[data-client-scope-access-copy]").forEach((element) => { element.textContent = profileScope.accessCopy; });
    const subsidiaryOnly = currentClientScope !== "group";
    const organisationNavigation = document.querySelector('.sidebar-preview nav [data-screen="client-organisation"]');
    if (organisationNavigation) organisationNavigation.hidden = body.dataset.role !== "client" || !hasHeadquartersAccess;
    const multiClientNote = document.querySelector("[data-multi-client-order-note]");
    if (multiClientNote) multiClientNote.hidden = subsidiaryOnly;
    [
      ["[data-place-client-filter]", "[data-place-client-filter-wrap]"],
      ["[data-inventory-client]", "[data-inventory-client-filter-wrap]"],
      ["[data-request-client]", "[data-request-client-filter-wrap]"]
    ].forEach(([selectSelector, wrapperSelector]) => {
      const select = document.querySelector(selectSelector);
      const wrapper = document.querySelector(wrapperSelector);
      if (select) select.value = subsidiaryOnly ? currentClientScope : "all";
      if (wrapper) wrapper.hidden = body.dataset.role === "client" && subsidiaryOnly;
    });
    document.querySelectorAll("select[data-request-location], select[data-inventory-location]").forEach((select) => {
      Array.from(select.options).forEach((option) => {
        option.disabled = subsidiaryOnly && option.value !== "all" && locationClientMap[option.value] !== currentClientScope;
      });
      if (select.selectedOptions[0]?.disabled) select.value = "all";
    });
    if (body.dataset.role === "client") {
      document.querySelectorAll("[data-profile-name]").forEach((element) => { element.textContent = profileScope.profileName; });
      document.querySelectorAll("[data-profile-initials]").forEach((element) => { element.textContent = profileScope.profileInitials; });
      document.querySelectorAll("[data-profile-label]").forEach((element) => { element.textContent = profileScope.profileLabel; });
    }
  }

  function setClientScope(scopeKey) {
    const requestedScope = clientScopeData[scopeKey] ? scopeKey : "group";
    const nextScope = currentClientProfileScope === "group" ? requestedScope : currentClientProfileScope;
    if (nextScope !== currentClientScope && requestCart.size) {
      requestCart.clear();
      expandedRequestCartServices.clear();
      renderRequestCart();
      closeRequestCart();
    }
    currentClientScope = nextScope;
    body.dataset.clientScope = currentClientScope;
    body.dataset.clientProfileScope = currentClientProfileScope;
    updateClientScopeControls();
    const activeScreen = document.querySelector('[data-screen-view="client-organisation"]:not([hidden])');
    if (currentClientProfileScope !== "group" && activeScreen) showScreen("dashboard");
    filterPlacesByScope();
    filterClientDashboardScope();
    updateScopedOperationalSummaries();
    updateInventoryFloorOptions();
    filterEquipmentInventory();
    updateRequestFloorOptions();
    filterRequestEquipment();
    applyWorkOrderFilters();
    renderRecommendations();
    renderPlannedList();
    filterRequestRecords();
    refreshGenericDirectorySearches();
    const scope = clientScopeData[currentClientScope];
    const dashboardSubtitle = document.querySelector("[data-dashboard-subtitle]");
    if (dashboardSubtitle && body.dataset.role === "client") dashboardSubtitle.textContent = currentClientScope === "group" ? "Vue consolidée de toutes les filiales, immeubles et opérations." : `Vue limitée aux immeubles et opérations de ${scope.name}.`;
  }

  function setRole(role) {
    const profile = profileData[role] || profileData.interne;
    body.dataset.role = role;
    document.querySelectorAll(".prototype-toolbar button[data-role]").forEach((button) => button.classList.toggle("is-active", button.dataset.role === role));
    document.querySelectorAll("[data-profile-label]").forEach((element) => { element.textContent = profile.label; });
    document.querySelectorAll("[data-profile-name]").forEach((element) => { element.textContent = profile.name; });
    document.querySelectorAll("[data-profile-initials]").forEach((element) => { element.textContent = profile.initials; });
    document.querySelectorAll("[data-profile-field]").forEach((field) => { field.value = profile[field.dataset.profileField] || ""; });
    document.querySelectorAll("[data-work-orders-label]").forEach((element) => { element.textContent = role === "client" ? "Travaux" : "Bons de travail"; });
    const operationsSearchInput = document.querySelector("[data-operations-search-input]");
    if (operationsSearchInput) operationsSearchInput.placeholder = role === "client" ? "Numéro, immeuble ou équipement" : "Numéro, immeuble, équipement ou technicien";
    document.querySelector("[data-dashboard-subtitle]").textContent = profile.subtitle;
    document.querySelectorAll("[data-visible-roles]").forEach((element) => { element.hidden = !matchesRole(element, role); });
    document.querySelectorAll("[data-dashboard-role]").forEach((view) => { view.hidden = view.dataset.dashboardRole !== role; });
    document.querySelectorAll("[data-report-role]").forEach((view) => { view.hidden = view.dataset.reportRole !== role; });
    document.querySelectorAll("[data-notification-role]").forEach((view) => { view.hidden = view.dataset.notificationRole !== role; });
    closeNotifications();
    closeRequestCart();
    closeAIChat();
    resetAIChatForRole(profile);
    applyWorkOrderFilters();
    refreshGenericDirectorySearches();
    if (role === "client") setClientScope(currentClientScope);
    refreshRecommendationExperience();
    filterRequestRecords();
    const globalInput = document.querySelector("[data-global-search]");
    if (globalInput?.value) renderGlobalSearch(globalInput);
    window.requestAnimationFrame(updateWorkOrderScrollLimits);
    const activeScreen = document.querySelector("[data-screen-view]:not([hidden])");
    if (role !== "client" && activeScreen && ["client-organisation", "new-request", "request-checkout"].includes(activeScreen.dataset.screenView)) showScreen("dashboard");
    if (role !== "conseiller" && activeScreen && ["sales-clients", "quotes", "quote-detail", "quote-builder"].includes(activeScreen.dataset.screenView)) showScreen("dashboard");
  }

  function showScreen(screen) {
    if (screen === "recommendation-detail") screen = "recommendations";
    closeApartmentPreview();
    const navigationScreen = screen === "system-detail" ? "equipment-inventory" : screen === "request-checkout" ? "requests" : ["quote-detail", "quote-builder"].includes(screen) ? "quotes" : ["client-groups", "quote-pricing-settings", "replacement-estimates", "warranty-settings"].includes(screen) ? "settings" : screen;
    const targetNavigation = document.querySelector(`.sidebar-preview nav [data-screen="${navigationScreen}"]`);
    const internalOnlyScreens = ["alerts", "client-groups", "users", "user-detail", "forms", "form-editor", "activities", "activity-detail", "data-fields", "data-field-detail", "system-types", "system-type-detail", "request-types", "request-type-detail", "warehouses", "warehouse-detail", "reminder-rules", "reminder-rule-detail", "recommendation-types", "recommendation-type-detail", "quote-pricing-settings", "replacement-estimates", "warranty-settings"];
    const clientOnlyScreens = ["client-organisation", "new-request", "request-checkout"];
    const advisorOnlyScreens = ["sales-clients", "quotes", "quote-detail", "quote-builder"];
    if (screen !== "login" && ((targetNavigation && targetNavigation.hidden) || (internalOnlyScreens.includes(screen) && body.dataset.role !== "interne"))) screen = "dashboard";
    if (clientOnlyScreens.includes(screen) && body.dataset.role !== "client") screen = "dashboard";
    if (advisorOnlyScreens.includes(screen) && body.dataset.role !== "conseiller") screen = "dashboard";
    body.dataset.screen = screen;
    const appView = screen === "login" ? "login" : "dashboard";
    document.querySelectorAll("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== appView; });
    if (screen !== "login") {
      document.querySelectorAll("[data-screen-view]").forEach((view) => { view.hidden = view.dataset.screenView !== screen; });
      document.querySelectorAll(".sidebar-preview nav [data-screen]").forEach((button) => button.classList.toggle("is-active", button.dataset.screen === navigationScreen));
    }
    if (screen === "login") {
      document.querySelector(".prototype-toast").hidden = true;
      closeAIChat();
    }
    body.classList.remove("menu-open");
    closeNotifications();
    closeRequestCart();
    closePlannedList();
    closeRecommendationPostpone();
    if (screen !== "quote-builder") closeQuotePreview();
    if (screen === "recommendations") renderRecommendations();
    if (screen === "requests") filterRequestRecords();
  }

  function toggleSidebar() {
    const collapsed = body.classList.toggle("sidebar-collapsed");
    const button = document.querySelector("[data-sidebar-collapse]");
    if (!button) return;
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "Déployer le menu" : "Replier le menu");
    button.title = collapsed ? "Déployer le menu" : "Replier le menu";
  }

  function bindSidebarNavigation() {
    document.querySelectorAll(".sidebar-preview nav [data-screen], .sidebar-user[data-screen]").forEach((button) => {
      button.type = "button";
      if (button.dataset.sidebarNavigationBound === "true") return;
      button.dataset.sidebarNavigationBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!button.hidden) showScreen(button.dataset.screen);
      });
    });
  }

  function toggleWorkOrderType(button) {
    const section = button?.closest(".work-order-type-section");
    const list = section?.querySelector(".work-orders-list");
    if (!section || !list) return;
    const nextExpanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(nextExpanded));
    list.hidden = !nextExpanded;
    section.classList.toggle("is-collapsed", !nextExpanded);
    if (nextExpanded) window.requestAnimationFrame(updateWorkOrderScrollLimits);
  }

  function toggleWorkOrderDecisionFilter(button) {
    const forceActive = button?.dataset.workOrderDecisionFilter === "activate";
    const nextActive = forceActive || button?.getAttribute("aria-pressed") !== "true";
    document.querySelectorAll("[data-work-order-decision-filter]").forEach((control) => {
      control.setAttribute("aria-pressed", String(nextActive));
      control.classList.toggle("is-active", nextActive);
    });

    applyWorkOrderFilters();
    showToast(nextActive ? "Décisions requises" : "Tous les travaux", nextActive ? "Seuls les travaux en attente d’une décision sont affichés." : "Toutes les sections de travaux sont de nouveau visibles.");
  }

  function normalizeWorkOrderSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function matchesPrototypeSearch(value, query) {
    const tokens = normalizeWorkOrderSearch(query).split(" ").filter(Boolean);
    if (!tokens.length) return true;
    const haystack = normalizeWorkOrderSearch(value);
    return tokens.every((token) => haystack.includes(token));
  }

  const prototypeDirectorySearchConfigs = {
    recommendations: { input: ".recommendation-filter .filter-search input", items: ".recommendation-row", anchor: ".recommendations-list" },
    alerts: { input: ".alert-toolbar .filter-search input", items: ".alert-row", anchor: ".alerts-list", groupedAlerts: true },
    requests: { input: ".request-filter .filter-search input", items: ".request-row", anchor: ".requests-list" },
    documents: { input: ".document-library-tools .filter-search input", items: ".document-library-row", anchor: ".document-library" },
    help: { input: ".help-search input", items: ".help-topic-grid > button", anchor: ".help-topic-grid", roleGroups: true },
    users: { input: ".users-filter-bar .filter-search input", items: ".user-directory-row:not(.user-directory-head)", anchor: ".users-directory" },
    activities: { input: ".activity-filter-bar .filter-search input", items: ".activity-row", anchor: ".activity-directory" },
    "data-fields": { input: ".data-fields-tools .filter-search input", items: ".data-field-row", anchor: ".data-fields-directory" },
    "system-types": { input: ".system-types-tools .filter-search input", items: ".system-type-row", anchor: ".system-types-directory" },
    "request-types": { input: ".request-types-tools .filter-search input", items: ".request-type-row", anchor: ".request-types-directory" },
    warehouses: { input: ".warehouse-tools .filter-search input", items: ".warehouse-row", anchor: ".warehouse-directory" },
    "reminder-rules": { input: ".reminder-tools .filter-search input", items: ".reminder-rule-row", anchor: ".reminder-directory" },
    forms: { input: ".form-library-tools .filter-search input", items: ".form-library-row", anchor: ".form-library" }
  };

  function isSearchItemAllowedForRole(item, screen) {
    if (!isAllowedForClientScope(item)) return false;
    let current = item;
    while (current && current !== screen) {
      if (current.hasAttribute("data-visible-roles") && !matchesRole(current, body.dataset.role)) return false;
      current = current.parentElement;
    }
    return true;
  }

  function ensureLiveSearchEmpty(screen, screenName, config) {
    let empty = screen.querySelector(`[data-live-search-empty="${screenName}"]`);
    if (empty) return empty;
    const anchors = screen.querySelectorAll(config.anchor);
    const anchor = anchors[anchors.length - 1];
    if (!anchor) return null;
    empty = document.createElement("div");
    empty.className = "live-search-empty";
    empty.dataset.liveSearchEmpty = screenName;
    empty.hidden = true;
    empty.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-search"></use></svg><strong>Aucun résultat</strong><small>Essayez un autre mot-clé.</small>`;
    anchor.insertAdjacentElement("afterend", empty);
    return empty;
  }

  function filterGenericDirectory(input) {
    const screenName = input?.dataset.liveDirectorySearch;
    const config = prototypeDirectorySearchConfigs[screenName];
    const screen = input?.closest("[data-screen-view]");
    if (!screen || !config) return;
    const tokens = normalizeWorkOrderSearch(input.value).split(" ").filter(Boolean);
    let visibleCount = 0;

    screen.querySelectorAll(config.items).forEach((item) => {
      const roleAllowed = isSearchItemAllowedForRole(item, screen);
      const haystack = normalizeWorkOrderSearch(item.textContent);
      const matches = !tokens.length || tokens.every((token) => haystack.includes(token));
      item.hidden = !(roleAllowed && matches);
      if (!item.hidden) visibleCount += 1;
    });

    if (config.groupedAlerts) {
      screen.querySelectorAll(".alert-group-heading").forEach((heading) => {
        let sibling = heading.nextElementSibling;
        let hasVisibleRow = false;
        while (sibling && !sibling.classList.contains("alert-group-heading")) {
          if (sibling.classList.contains("alert-row") && !sibling.hidden) hasVisibleRow = true;
          sibling = sibling.nextElementSibling;
        }
        heading.hidden = !hasVisibleRow;
      });
    }

    if (config.roleGroups) {
      screen.querySelectorAll(".help-topic-grid").forEach((group) => {
        const roleAllowed = isSearchItemAllowedForRole(group, screen);
        const hasVisibleItem = Array.from(group.querySelectorAll(":scope > button")).some((item) => !item.hidden);
        group.hidden = !(roleAllowed && hasVisibleItem);
      });
    }

    const empty = ensureLiveSearchEmpty(screen, screenName, config);
    if (empty) {
      empty.hidden = !tokens.length || visibleCount > 0;
      const message = empty.querySelector("small");
      if (message && tokens.length) message.textContent = `Aucun résultat pour « ${input.value.trim()} »`;
    }
  }

  function refreshGenericDirectorySearches() {
    document.querySelectorAll("[data-live-directory-search]").forEach((input) => filterGenericDirectory(input));
  }

  function updateLiveSearchClearButton(input) {
    const parent = input?.parentElement;
    const button = parent?.querySelector("[data-live-search-clear], [data-clear-operations-search]");
    if (button) button.hidden = !input.value;
  }

  function ensureLiveSearchClearButton(input) {
    const parent = input?.parentElement;
    if (!parent || parent.querySelector("[data-live-search-clear], [data-clear-operations-search]")) return;
    parent.classList.add("has-live-search-clear");
    const button = document.createElement("button");
    button.className = "live-search-clear";
    button.type = "button";
    button.dataset.liveSearchClear = "";
    button.setAttribute("aria-label", "Effacer la recherche");
    button.textContent = "×";
    button.hidden = true;
    parent.appendChild(button);
  }

  function closeGlobalSearch() {
    const results = document.querySelector("[data-global-search-results]");
    if (results) results.hidden = true;
  }

  function renderGlobalSearch(input) {
    const results = document.querySelector("[data-global-search-results]");
    if (!input || !results) return;
    const tokens = normalizeWorkOrderSearch(input.value).split(" ").filter(Boolean);
    results.replaceChildren();
    if (!tokens.length) {
      results.hidden = true;
      return;
    }

    const navigationItems = Array.from(document.querySelectorAll(".sidebar-preview nav [data-screen]"))
      .filter((button) => !button.hidden)
      .map((button) => ({ screen: button.dataset.screen, label: button.textContent.trim(), meta: "Page KlimaParc" }));
    const contextualItems = [
      { screen: "work-order-detail", label: "BT-2026-014 · Entretien préventif", meta: "Travaux · Tours Laval · Appartements 201 à 204", clientKey: "tours-client", roles: ["interne", "client", "technicien"] },
      { screen: "request-detail", label: "AS-2026-041 · Bruit anormal", meta: "Requêtes · Condo Rivière Nord · Appartement 502", clientKey: "riviere-client", roles: ["interne", "client"] },
      { screen: "place-detail", label: "Tours Laval", meta: "Immeuble · 48 appartements", clientKey: "tours-client", roles: ["interne", "client", "technicien", "conseiller"] },
      { screen: "equipment-inventory", label: "Thermopompe murale · Carrier", meta: "Parc d’équipements · Appartement 204", clientKey: "tours-client", roles: ["interne", "client", "technicien", "conseiller"] }
    ].filter((item) => item.roles.includes(body.dataset.role) && (body.dataset.role !== "client" || currentClientScope === "group" || item.clientKey === currentClientScope));
    const seen = new Set();
    const matches = [...contextualItems, ...navigationItems].filter((item) => {
      const key = `${item.screen}|${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const haystack = normalizeWorkOrderSearch(`${item.label} ${item.meta}`);
      return tokens.every((token) => haystack.includes(token));
    }).slice(0, 8);

    if (!matches.length) {
      const empty = document.createElement("span");
      empty.className = "global-search-empty";
      empty.textContent = `Aucun résultat pour « ${input.value.trim()} »`;
      results.appendChild(empty);
    } else {
      matches.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.screen = item.screen;
        button.dataset.globalSearchResult = "";
        button.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-search"></use></svg><span><strong></strong><small></small></span>`;
        button.querySelector("strong").textContent = item.label;
        button.querySelector("small").textContent = item.meta;
        results.appendChild(button);
      });
    }
    results.hidden = false;
  }

  function initializePrototypeSearches() {
    const workOrderApartments = {
      "BT-2026-014": "Appartements 201 à 204",
      "BT-2026-018": "Appartement 502",
      "BT-2026-019": "Appartement 204",
      "BT-2026-011": "Appartement 1104",
      "BT-2026-024": "Appartement 308"
    };
    document.querySelectorAll(".work-orders-list > header > span:nth-child(2)").forEach((heading) => {
      heading.textContent = "Immeuble, appartement et rendez-vous";
    });
    document.querySelectorAll(".work-order-row").forEach((row) => {
      const identifier = row.querySelector(":scope > span:first-child strong")?.textContent.trim();
      const apartment = workOrderApartments[identifier];
      const locationColumn = row.querySelector(":scope > span:nth-child(2)");
      if (!apartment || !locationColumn || locationColumn.querySelector(".work-order-apartment")) return;
      locationColumn.dataset.label = "Immeuble, appartement et rendez-vous";
      const apartmentLabel = document.createElement("em");
      apartmentLabel.className = "work-order-apartment";
      apartmentLabel.textContent = apartment;
      const appointment = locationColumn.querySelector("small");
      locationColumn.insertBefore(apartmentLabel, appointment || null);
    });

    Object.entries(prototypeDirectorySearchConfigs).forEach(([screenName, config]) => {
      const screen = document.querySelector(`[data-screen-view="${screenName}"]`);
      const input = screen?.querySelector(config.input);
      if (input) {
        input.dataset.liveDirectorySearch = screenName;
        input.autocomplete = "off";
      }
    });

    const globalInput = document.querySelector(".preview-main > .search input");
    if (globalInput) {
      globalInput.dataset.globalSearch = "";
      globalInput.autocomplete = "off";
      const results = document.createElement("div");
      results.className = "global-search-results";
      results.dataset.globalSearchResults = "";
      results.hidden = true;
      globalInput.parentElement.appendChild(results);
    }

    document.querySelectorAll(".search input, .filter-search input, .help-search input, .request-search-field input, .inventory-search-field input, .operations-search input").forEach((input) => {
      input.autocomplete = "off";
      ensureLiveSearchClearButton(input);
      updateLiveSearchClearButton(input);
    });
  }

  function applyWorkOrderFilters() {
    const input = document.querySelector("[data-operations-search-input]");
    const clearButton = document.querySelector("[data-clear-operations-search]");
    const emptyState = document.querySelector("[data-work-orders-empty]");
    const tokens = normalizeWorkOrderSearch(input?.value).split(" ").filter(Boolean);
    const decisionOnly = document.querySelector(".work-order-summary-action")?.getAttribute("aria-pressed") === "true";
    let visibleRows = 0;

    document.querySelectorAll(".work-order-type-section").forEach((section) => {
      const type = section.querySelector(".work-order-type-copy strong")?.textContent || "";
      const rows = Array.from(section.querySelectorAll(".work-order-row"));
      rows.forEach((row) => {
        const visibleColumns = Array.from(row.querySelectorAll(":scope > span")).filter((column) => !column.hidden);
        const haystack = normalizeWorkOrderSearch(`${type} ${visibleColumns.map((column) => column.textContent).join(" ")}`);
        const matchesSearch = !tokens.length || tokens.every((token) => haystack.includes(token));
        const matchesDecision = !decisionOnly || row.dataset.workOrderDecision === "pending";
        const matchesClientScope = isAllowedForClientScope(row);
        row.hidden = !(matchesSearch && matchesDecision && matchesClientScope);
        if (!row.hidden) visibleRows += 1;
      });

      const hasVisibleRows = rows.some((row) => !row.hidden);
      const visibleSectionRows = rows.filter((row) => !row.hidden).length;
      const sectionCount = section.querySelector(".work-order-type-heading-actions em");
      if (sectionCount) sectionCount.textContent = `${visibleSectionRows} ${visibleSectionRows === 1 ? "travail" : "travaux"}`;
      section.hidden = !hasVisibleRows;
      if (tokens.length && hasVisibleRows) {
        const heading = section.querySelector("[data-work-order-type-toggle]");
        const list = section.querySelector(".work-orders-list");
        heading?.setAttribute("aria-expanded", "true");
        if (list) list.hidden = false;
        section.classList.remove("is-collapsed");
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleRows > 0;
      const query = input?.value.trim();
      const message = emptyState.querySelector("small");
      if (message) message.textContent = query ? `Aucun résultat pour « ${query} »` : "Aucun travail ne correspond aux filtres actifs.";
    }
    if (clearButton) clearButton.hidden = !input?.value;
    window.requestAnimationFrame(updateWorkOrderScrollLimits);
  }

  function updateWorkOrderScrollLimits() {
    document.querySelectorAll(".work-orders-list").forEach((list) => {
      if (list.hidden) return;
      const rows = Array.from(list.querySelectorAll(":scope > .work-order-row"));
      list.classList.remove("is-scroll-limited");
      list.style.removeProperty("--work-order-list-limit");
      if (rows.length <= 5) return;
      const header = list.querySelector(":scope > header");
      const headerHeight = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect().height : 0;
      const rowsHeight = rows.slice(0, 5).reduce((total, row) => total + row.getBoundingClientRect().height, 0);
      list.style.setProperty("--work-order-list-limit", `${Math.ceil(headerHeight + rowsHeight)}px`);
      list.classList.add("is-scroll-limited");
    });
  }

  function toggleNotifications() {
    const drawer = document.querySelector("[data-notification-drawer]");
    const backdrop = document.querySelector(".drawer-backdrop");
    const nextHidden = !drawer.hidden;
    if (!nextHidden) {
      closeRequestCart();
      closeAIChat();
    }
    drawer.hidden = nextHidden;
    backdrop.hidden = nextHidden;
  }

  function changeMonth(direction) {
    monthIndex = Math.max(0, Math.min(months.length - 1, monthIndex + Number(direction)));
    document.querySelectorAll("[data-month-label]").forEach((label) => { label.textContent = months[monthIndex]; });
  }

  function showToast(title, message) {
    const toast = document.querySelector(".prototype-toast");
    toast.querySelector("strong").textContent = title;
    toast.querySelector("span").textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function toggleStep(button) {
    const step = button.closest("[data-form-step]");
    const collapsed = step.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function selectUnit(button) {
    button.closest(".unit-selector").querySelectorAll("[data-unit]").forEach((unit) => {
      const selected = unit === button;
      unit.classList.toggle("is-selected", selected);
      unit.setAttribute("aria-selected", String(selected));
    });
    ["model", "serial", "location", "age"].forEach((field) => {
      document.querySelector(`[data-unit-field="${field}"]`).value = button.dataset[field] || "";
    });
    document.querySelector("[data-selected-unit-title]").textContent = `${button.dataset.position} · ${button.dataset.location}`;
    document.querySelector("[data-unit-details]").classList.remove("is-updating");
    window.requestAnimationFrame(() => document.querySelector("[data-unit-details]").classList.add("is-updating"));
  }

  function setActivity(type) {
    const replacement = document.querySelector("[data-replacement-preview]");
    const standard = document.querySelector("[data-standard-questions]");
    replacement.hidden = type !== "replacement";
    standard.hidden = type === "replacement";
  }

  function selectEquipmentTab(tabName) {
    document.querySelectorAll("[data-equipment-tab]").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.equipmentTab === tabName));
    document.querySelectorAll("[data-equipment-panel]").forEach((panel) => { panel.hidden = panel.dataset.equipmentPanel !== tabName; });
  }

  function getWarrantyTerms() {
    const laborYears = Number(document.querySelector("[data-warranty-labor-years]")?.value || 0);
    const partsYears = new Map();
    document.querySelectorAll("[data-warranty-parts-manufacturer]").forEach((input) => {
      partsYears.set(input.dataset.warrantyPartsManufacturer, Number(input.value || 0));
    });
    return { laborYears, partsYears };
  }

  function getWarrantyExpiry(installDate, durationYears) {
    const date = new Date(`${installDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setFullYear(date.getFullYear() + durationYears);
    return date;
  }

  function renderWarrantyTag(type, expiryDate) {
    const tag = document.createElement("span");
    const active = expiryDate && expiryDate >= warrantyReferenceDate;
    tag.className = `equipment-warranty-tag ${active ? "is-active" : "is-expired"}`;
    tag.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-shield"></use></svg><span><b></b><small></small></span>`;
    tag.querySelector("b").textContent = type === "labor" ? "Main-d’œuvre" : "Pièces";
    tag.querySelector("small").textContent = expiryDate ? `${active ? "Jusqu’au" : "Expirée le"} ${warrantyDateFormatter.format(expiryDate)}` : "Durée non configurée";
    return tag;
  }

  function updateWarrantyDisplays() {
    const { laborYears, partsYears } = getWarrantyTerms();
    document.querySelectorAll("[data-equipment-id][data-equipment-manufacturer]").forEach((card) => {
      if (card.querySelector(".request-card-warranties")) return;
      const container = document.createElement("div");
      container.className = "equipment-warranty-tags request-card-warranties";
      container.dataset.warrantyTags = "";
      container.dataset.warrantyManufacturer = card.dataset.equipmentManufacturer;
      container.dataset.warrantyInstallDate = card.dataset.equipmentInstallDate;
      card.querySelector(":scope > div")?.appendChild(container);
    });
    document.querySelectorAll("[data-warranty-tags]").forEach((container) => {
      const manufacturer = container.dataset.warrantyManufacturer;
      const installDate = container.dataset.warrantyInstallDate;
      container.replaceChildren(
        renderWarrantyTag("labor", getWarrantyExpiry(installDate, laborYears)),
        renderWarrantyTag("parts", getWarrantyExpiry(installDate, partsYears.get(manufacturer) || 0))
      );
    });
    const summary = document.querySelector("[data-warranty-labor-summary]");
    if (summary) summary.textContent = `${laborYears} an${laborYears === 1 ? "" : "s"}`;
  }

  function saveWarrantySettings() {
    const inputs = Array.from(document.querySelectorAll("[data-warranty-labor-years], [data-warranty-parts-manufacturer]"));
    const invalidInput = inputs.find((input) => input.value === "" || !Number.isFinite(Number(input.value)) || Number(input.value) < 0);
    if (invalidInput) {
      invalidInput.focus();
      showToast("Durée requise", "Saisissez une durée valide pour chaque garantie.");
      return;
    }
    updateWarrantyDisplays();
    showToast("Garanties enregistrées", "Les échéances ont été recalculées pour les équipements du parc.");
  }

  function updateEquipmentNoteCount() {
    const notes = document.querySelectorAll("[data-equipment-note-list] .equipment-note");
    const count = document.querySelector("[data-equipment-note-count]");
    if (count) count.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
  }

  function addEquipmentNote() {
    const input = document.querySelector("[data-equipment-note-input]");
    const list = document.querySelector("[data-equipment-note-list]");
    const message = input?.value.trim();
    if (!input || !list || !message) {
      input?.focus();
      showToast("Note requise", "Écrivez une observation avant de l’ajouter.");
      return;
    }

    const profile = profileData[body.dataset.role] || profileData.client;
    const note = document.createElement("article");
    note.className = "equipment-note is-new-note";
    note.innerHTML = `<span class="equipment-note-avatar"></span><div><header><strong></strong><time>À l’instant</time></header><p></p></div>`;
    note.querySelector(".equipment-note-avatar").textContent = profile.initials;
    note.querySelector("strong").textContent = profile.name;
    note.querySelector("p").textContent = message;
    list.prepend(note);
    input.value = "";
    updateEquipmentNoteCount();
    showToast("Note ajoutée", "La note est maintenant visible dans le dossier du système.");
  }

  function updateEquipmentCostSummary() {
    const events = Array.from(document.querySelectorAll("[data-equipment-cost]"));
    if (!events.length) return;
    const valuedEvents = events.filter((item) => item.dataset.equipmentCost !== "" && Number.isFinite(Number(item.dataset.equipmentCost)));
    const total = valuedEvents.reduce((sum, item) => sum + Number(item.dataset.equipmentCost), 0);
    const yearlyTotal = valuedEvents.filter((item) => item.dataset.equipmentCostWithinYear === "true").reduce((sum, item) => sum + Number(item.dataset.equipmentCost), 0);
    const missingCount = events.length - valuedEvents.length;
    const replacementCost = Number(document.querySelector("[data-equipment-replacement-cost]")?.dataset.equipmentReplacementCost || 0);
    const ratio = replacementCost > 0 ? Math.round((total / replacementCost) * 100) : 0;

    document.querySelectorAll("[data-equipment-cost-total], [data-equipment-history-total]").forEach((element) => { element.textContent = currencyFormatter.format(total); });
    document.querySelectorAll("[data-equipment-replacement-reference]").forEach((element) => { element.textContent = currencyFormatter.format(replacementCost); });
    const yearly = document.querySelector("[data-equipment-cost-year]");
    if (yearly) yearly.textContent = currencyFormatter.format(yearlyTotal);
    const coverage = document.querySelector("[data-equipment-cost-coverage]");
    if (coverage) coverage.textContent = `${valuedEvents.length} sur ${events.length}`;
    const ratioLabel = document.querySelector("[data-equipment-cost-ratio]");
    if (ratioLabel) ratioLabel.textContent = `${ratio} %`;
    const progress = document.querySelector("[data-equipment-cost-progress]");
    if (progress) progress.style.width = `${Math.min(ratio, 100)}%`;

    const missingLabel = document.querySelector("[data-equipment-cost-missing]");
    const missingBox = missingLabel?.closest(".equipment-cost-missing");
    if (missingLabel && missingBox) {
      missingLabel.textContent = missingCount ? `${missingCount} intervention${missingCount === 1 ? "" : "s"} sans montant` : "Tous les montants sont renseignés";
      missingBox.classList.toggle("is-complete", missingCount === 0);
      const description = missingBox.querySelector("small");
      if (description) description.textContent = missingCount ? "Complétez le coût dans l’historique pour obtenir un total plus fiable." : "Le total reflète maintenant toutes les interventions affichées.";
      const icon = missingBox.querySelector("use");
      if (icon) icon.setAttribute("href", missingCount ? "#icon-alert" : "#icon-check");
    }
  }

  function openInterventionCostEditor(button) {
    const eventRow = button.closest("[data-equipment-cost]");
    const editor = eventRow?.querySelector("[data-intervention-cost-editor]");
    if (!eventRow || !editor) return;
    button.hidden = true;
    editor.hidden = false;
    editor.querySelector("[data-intervention-cost-input]")?.focus();
  }

  function cancelInterventionCostEditor(button) {
    const eventRow = button.closest("[data-equipment-cost]");
    const editor = eventRow?.querySelector("[data-intervention-cost-editor]");
    if (!eventRow || !editor) return;
    editor.hidden = true;
    const openButton = eventRow.querySelector("[data-add-intervention-cost]");
    if (openButton) openButton.hidden = false;
  }

  function saveInterventionCost(button) {
    const eventRow = button.closest("[data-equipment-cost]");
    const editor = eventRow?.querySelector("[data-intervention-cost-editor]");
    const input = editor?.querySelector("[data-intervention-cost-input]");
    const amount = Number((input?.value || "").replace(",", "."));
    if (!eventRow || !editor || !input || !Number.isFinite(amount) || amount < 0 || input.value === "") {
      input?.focus();
      showToast("Montant requis", "Saisissez un montant valide pour cette intervention.");
      return;
    }

    const profile = profileData[body.dataset.role] || profileData.client;
    eventRow.dataset.equipmentCost = amount.toFixed(2);
    eventRow.classList.remove("is-missing-cost");
    eventRow.querySelector("[data-history-cost-value]").textContent = currencyFormatter.format(amount);
    eventRow.querySelector("[data-history-cost-state]").textContent = `Ajouté par ${profile.name}`;
    editor.hidden = true;
    input.value = "";
    const openButton = eventRow.querySelector("[data-add-intervention-cost]");
    if (openButton) openButton.hidden = true;
    updateEquipmentCostSummary();
    showToast("Montant enregistré", "Le total dépensé pour ce système a été recalculé.");
  }

  function saveReplacementEstimates() {
    const input = document.querySelector("[data-replacement-base-price]");
    const replacementCard = document.querySelector("[data-equipment-replacement-cost]");
    const amount = Number(input?.value || 0);
    if (!input || !replacementCard || !Number.isFinite(amount) || amount <= 0) {
      input?.focus();
      showToast("Estimation requise", "Saisissez un montant supérieur à zéro pour la règle appliquée.");
      return;
    }
    replacementCard.dataset.equipmentReplacementCost = amount.toFixed(2);
    updateEquipmentCostSummary();
    showToast("Estimations enregistrées", "La nouvelle valeur de référence est maintenant utilisée dans le dossier client.");
  }

  function updateRequestCatalog() {
    const service = requestTypeData[selectedRequestType];
    document.querySelectorAll("[data-catalog-price-label]").forEach((label) => { label.textContent = service.label; });
    document.querySelectorAll("[data-catalog-price]").forEach((price) => { price.textContent = currencyFormatter.format(service.price); });
    const scopeNote = document.querySelector("[data-request-system-scope-note]");
    if (scopeNote) {
      const title = scopeNote.querySelector("strong");
      const description = scopeNote.querySelector("small");
      const fullSystemService = ["inspection", "maintenance"].includes(selectedRequestType);
      if (title) title.textContent = fullSystemService ? `${service.label} appliqué au système complet` : "Sélectionnez le système concerné";
      if (description) description.textContent = fullSystemService
        ? "Toutes les unités intérieures et l’unité extérieure associée sont incluses automatiquement."
        : "Le diagnostic commence au niveau du système; l’équipement en cause pourra être précisé dans la requête.";
    }
  }

  function getRequestItemKey(systemId, type = selectedRequestType) {
    return `${systemId}::${type}`;
  }

  function getEquipmentComponentCards() {
    return Array.from(document.querySelectorAll("[data-equipment-component-source] [data-equipment-id]"));
  }

  function getSystemType(systemLabel = "") {
    if (/PTAC|TTW/i.test(systemLabel)) return "Monobloc";
    if (/central|VRV/i.test(systemLabel)) return "Central";
    return "Mural";
  }

  function getSystemDisplayType(systemLabel = "") {
    if (/PTAC/i.test(systemLabel)) return "PTAC";
    if (/TTW/i.test(systemLabel)) return "TTW";
    if (/central|VRV/i.test(systemLabel)) return "Central";
    return "Mural";
  }

  function getSystemRecords(cards = getEquipmentComponentCards()) {
    const systems = new Map();
    cards.forEach((card) => {
      const id = card.dataset.equipmentSystemKey || card.dataset.equipmentId;
      if (!systems.has(id)) {
        systems.set(id, {
          id,
          label: card.dataset.equipmentSystemLabel || card.dataset.equipmentName,
          location: card.dataset.equipmentLocation,
          locationKey: card.dataset.equipmentLocationKey,
          clientKey: card.dataset.clientKey || locationClientMap[card.dataset.equipmentLocationKey] || "",
          floor: card.dataset.equipmentFloor,
          floorLabel: card.dataset.equipmentFloorLabel,
          apartmentLabel: card.dataset.equipmentApartmentLabel,
          components: []
        });
      }
      systems.get(id).components.push(card);
    });
    return Array.from(systems.values()).map((system) => {
      system.type = getSystemType(system.label);
      system.displayType = getSystemDisplayType(system.label);
      const indoorCount = system.components.filter((card) => /intérieure/i.test(card.dataset.equipmentUnitLabel || "")).length;
      const outdoorCount = system.components.filter((card) => /extérieure/i.test(card.dataset.equipmentUnitLabel || "")).length;
      system.topology = system.type === "Monobloc"
        ? "Monobloc · 1 équipement"
        : `${outdoorCount} unité${outdoorCount === 1 ? "" : "s"} extérieure${outdoorCount === 1 ? "" : "s"} · ${indoorCount} unité${indoorCount === 1 ? "" : "s"} intérieure${indoorCount === 1 ? "" : "s"}`;
      return system;
    });
  }

  function getSystemRecord(systemId) {
    return getSystemRecords().find((system) => system.id === systemId);
  }

  function parsePrototypeDate(value) {
    return value ? new Date(`${value}T12:00:00`) : null;
  }

  function formatRecommendationDate(value) {
    const date = parsePrototypeDate(value);
    return date && !Number.isNaN(date.getTime()) ? recommendationDateFormatter.format(date) : "À définir";
  }

  function getSystemAge(system) {
    const dates = (system?.components || []).map((component) => parsePrototypeDate(component.dataset.equipmentInstallDate)).filter(Boolean);
    if (!dates.length) return null;
    const installed = new Date(Math.min(...dates.map((date) => date.getTime())));
    let years = prototypeToday.getFullYear() - installed.getFullYear();
    const beforeAnniversary = prototypeToday.getMonth() < installed.getMonth() || (prototypeToday.getMonth() === installed.getMonth() && prototypeToday.getDate() < installed.getDate());
    if (beforeAnniversary) years -= 1;
    return Math.max(0, years);
  }

  function getSystemServiceOverview(systemId) {
    const scheduled = scheduledSystemServices[systemId];
    if (scheduled) return { scheduled: true, label: scheduled.label, date: scheduled.date, copy: scheduled.copy };
    const recommendation = recommendationRecords
      .filter((record) => record.systemId === systemId && record.serviceType === "maintenance")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (recommendation) return { scheduled: false, label: "Prochain entretien recommandé", date: recommendation.date, copy: "Entretien préventif · système complet" };
    return { scheduled: false, label: "Entretien à définir", date: "", copy: "Aucune fréquence applicable n’est encore configurée" };
  }

  function getApartmentServiceEntries(systems = []) {
    const systemIds = new Set(systems.map((system) => system.id));
    const entries = [];
    systems.forEach((system) => {
      const scheduled = scheduledSystemServices[system.id];
      if (scheduled?.date) entries.push({ kind: "scheduled", date: scheduled.date, label: scheduled.label, systemId: system.id });
    });
    const recommendationLabels = {
      maintenance: "Entretien recommandé",
      inspection: "Inspection recommandée",
      replacement: "Remplacement recommandé"
    };
    recommendationRecords.forEach((record) => {
      if (!systemIds.has(record.systemId) || !record.date) return;
      entries.push({ kind: record.serviceType, date: record.date, label: recommendationLabels[record.serviceType] || record.serviceLabel, systemId: record.systemId });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  const recommendationDeadlineMeta = Object.freeze({
    late: Object.freeze({ label: "En retard", className: "late" }),
    due: Object.freeze({ label: "Dû", className: "warning" }),
    upcoming: Object.freeze({ label: "À venir", className: "progress" })
  });

  const recommendationWorkflowMeta = Object.freeze({
    pending: Object.freeze({ label: "À traiter", className: "planned" }),
    planned: Object.freeze({ label: "À prévoir", className: "progress" }),
    postponed: Object.freeze({ label: "Reportée", className: "warning" }),
    cart: Object.freeze({ label: "Au panier", className: "progress" }),
    ordered: Object.freeze({ label: "Commandée", className: "success" })
  });

  function getRecommendationRecord(id) {
    return recommendationRecords.find((record) => record.id === id);
  }

  function isRecommendationInCurrentScope(record) {
    if (body.dataset.role !== "client" || currentClientScope === "group") return true;
    return getSystemRecord(record.systemId)?.clientKey === currentClientScope;
  }

  function getRecommendationFloorBand(system) {
    if (system?.floor === "mechanical") return "mechanical";
    const floorNumber = Number(system?.floor);
    return Number.isFinite(floorNumber) && floorNumber <= 3 ? "low" : "upper";
  }

  function getRecommendationAgeBand(age) {
    if (age === null) return "all";
    if (age <= 5) return "0-5";
    if (age <= 10) return "6-10";
    return "11+";
  }

  function createRecommendationRow(record, compact = false) {
    const system = getSystemRecord(record.systemId);
    if (!system) return null;
    const deadline = recommendationDeadlineMeta[record.deadline] || recommendationDeadlineMeta.upcoming;
    const workflow = recommendationWorkflowMeta[record.workflow] || recommendationWorkflowMeta.pending;
    const age = getSystemAge(system);
    const statusKey = getSystemInventoryStatus(system);
    const status = inventoryStatusMeta[statusKey] || inventoryStatusMeta.active;
    const article = document.createElement("article");
    article.className = compact ? `system-recommendation-card is-${record.deadline}` : `recommendation-client-row is-${record.deadline}`;
    article.dataset.recommendationId = record.id;
    article.dataset.clientKey = system.clientKey;
    article.innerHTML = compact
      ? `<header><span><small></small><strong></strong></span><span class="status-pill"></span></header><p></p><div class="system-recommendation-meta"><span></span><em class="status"></em></div><footer></footer>`
      : `<header><span class="recommendation-type-icon"><svg class="ui-icon" aria-hidden="true"><use></use></svg></span><span class="recommendation-primary"><small></small><strong></strong><em></em></span><span class="recommendation-status-stack"><b class="status-pill"></b><em class="status-pill"></em></span></header><p class="recommendation-description"></p><div class="recommendation-meta-grid"><span><small>Date recommandée</small><strong></strong></span><span><small>Système</small><strong></strong></span><span><small>Âge du système</small><strong></strong></span><span><small>Statut technique</small><strong class="status"></strong></span></div><footer class="recommendation-actions"></footer>`;
    if (compact) {
      article.querySelector("header small").textContent = `${record.serviceLabel} · ${deadline.label}`;
      article.querySelector("header strong").textContent = record.title;
      const pill = article.querySelector("header .status-pill");
      pill.className = `status-pill ${workflow.className}`;
      pill.textContent = workflow.label;
      article.querySelector("p").textContent = record.description;
      article.querySelector(".system-recommendation-meta span").textContent = `Recommandé le ${formatRecommendationDate(record.date)}`;
      const technicalStatus = article.querySelector(".system-recommendation-meta .status");
      technicalStatus.className = `status ${status.className}`;
      technicalStatus.textContent = status.label;
    } else {
      article.querySelector(".recommendation-type-icon use").setAttribute("href", requestTypeData[record.serviceType]?.icon || "#icon-recommendation");
      article.querySelector(".recommendation-primary small").textContent = record.serviceLabel;
      article.querySelector(".recommendation-primary strong").textContent = record.title;
      article.querySelector(".recommendation-primary em").textContent = `${system.location} · ${system.apartmentLabel}`;
      const deadlinePill = article.querySelector(".recommendation-status-stack b");
      deadlinePill.className = `status-pill ${deadline.className}`;
      deadlinePill.textContent = deadline.label;
      const workflowPill = article.querySelector(".recommendation-status-stack em");
      workflowPill.className = `status-pill ${workflow.className}`;
      workflowPill.textContent = record.workflow === "postponed" && record.reappearDate ? `${workflow.label} au ${formatRecommendationDate(record.reappearDate)}` : workflow.label;
      article.querySelector(".recommendation-description").textContent = record.description;
      const values = article.querySelectorAll(".recommendation-meta-grid strong");
      values[0].textContent = formatRecommendationDate(record.date);
      values[1].textContent = `${system.label} · ${system.floorLabel}`;
      values[2].textContent = age === null ? "Non renseigné" : `${age} an${age === 1 ? "" : "s"}`;
      values[3].className = `status ${status.className}`;
      values[3].textContent = status.label;
      if (statusKey === "watch") values[3].title = "Système opérationnel présentant une anomalie ou une tendance qui demande un suivi. L’âge ou un entretien en retard ne déclenchent pas seuls ce statut.";
    }
    const footer = article.querySelector("footer");
    if (body.dataset.role === "client") {
      const cartDisabled = ["cart", "ordered"].includes(record.workflow);
      const plannedLabel = record.workflow === "planned" ? "Retirer de À prévoir" : "Mettre à prévoir";
      footer.insertAdjacentHTML("beforeend", `<button class="button primary compact" type="button" data-add-recommendation-cart="${record.id}" ${cartDisabled ? "disabled" : ""}><svg class="ui-icon" aria-hidden="true"><use href="${cartDisabled ? "#icon-check" : "#icon-cart"}"></use></svg>${record.workflow === "ordered" ? "Commandée" : record.workflow === "cart" ? "Au panier" : "Ajouter au panier"}</button><button class="button secondary compact" type="button" data-postpone-recommendation="${record.id}" ${record.workflow === "ordered" ? "disabled" : ""}>Reporter</button><button class="text-button" type="button" data-toggle-planned-recommendation="${record.id}" ${["cart", "ordered"].includes(record.workflow) ? "disabled" : ""}>${plannedLabel}</button>`);
    }
    footer.insertAdjacentHTML("beforeend", `<button class="text-button" type="button" data-open-recommendation-system="${record.systemId}">Voir le système</button>`);
    if (record.quoteNumber) footer.insertAdjacentHTML("beforeend", `<button class="text-button" type="button" data-linked-quote="${record.quoteNumber}">Voir la soumission associée</button>`);
    return article;
  }

  function getRecommendationFilterValues() {
    const selectedValues = (key) => Array.from(document.querySelectorAll(`[data-recommendation-filter-option="${key}"]:checked`)).map((input) => input.value);
    return {
      search: document.querySelector("[data-recommendation-search]")?.value || "",
      deadline: selectedValues("deadline"),
      decision: selectedValues("decision"),
      type: selectedValues("type"),
      building: document.querySelector("[data-recommendation-building-filter]")?.value || "all",
      floor: document.querySelector("[data-recommendation-floor-filter]")?.value || "all",
      systemType: document.querySelector("[data-recommendation-system-filter]")?.value || "all",
      age: document.querySelector("[data-recommendation-age-filter]")?.value || "all"
    };
  }

  function renderRecommendationAppliedFilters(values) {
    const container = document.querySelector("[data-recommendation-applied-filters]");
    if (!container) return;
    const filters = [];
    const multiLabels = {
      deadline: recommendationDeadlineMeta,
      decision: recommendationWorkflowMeta,
      type: {
        maintenance: { label: "Entretien" },
        inspection: { label: "Inspection" },
        replacement: { label: "Remplacement" }
      }
    };
    Object.entries(multiLabels).forEach(([key, metadata]) => {
      values[key].forEach((value) => filters.push({ key, value, label: metadata[value]?.label || value }));
    });
    const selectors = [
      ["building", "[data-recommendation-building-filter]"],
      ["floor", "[data-recommendation-floor-filter]"], ["systemType", "[data-recommendation-system-filter]"], ["age", "[data-recommendation-age-filter]"]
    ];
    selectors.forEach(([key, selector]) => {
      if (values[key] !== "all") filters.push({ key, value: values[key], label: document.querySelector(selector)?.selectedOptions[0]?.textContent || values[key] });
    });
    if (values.search.trim()) filters.push({ key: "search", value: values.search.trim(), label: `Recherche : ${values.search.trim()}` });
    container.replaceChildren();
    if (!filters.length) {
      const empty = document.createElement("span");
      empty.textContent = "Aucun filtre appliqué";
      container.appendChild(empty);
      return;
    }
    filters.forEach((filter) => {
      const chip = document.createElement("span");
      chip.className = "recommendation-filter-chip";
      const label = document.createElement("span");
      label.textContent = filter.label;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeRecommendationFilter = filter.key;
      remove.dataset.recommendationFilterValue = filter.value;
      remove.setAttribute("aria-label", `Retirer le filtre ${filter.label}`);
      remove.textContent = "×";
      chip.append(label, remove);
      container.appendChild(chip);
    });
  }

  function removeRecommendationFilter(key, value) {
    if (["deadline", "decision", "type"].includes(key)) {
      const input = Array.from(document.querySelectorAll(`[data-recommendation-filter-option="${key}"]`)).find((option) => option.value === value);
      if (input) input.checked = false;
    } else if (key === "search") {
      const input = document.querySelector("[data-recommendation-search]");
      if (input) input.value = "";
    } else {
      const selector = {
        building: "[data-recommendation-building-filter]",
        floor: "[data-recommendation-floor-filter]",
        systemType: "[data-recommendation-system-filter]",
        age: "[data-recommendation-age-filter]"
      }[key];
      const select = selector ? document.querySelector(selector) : null;
      if (select) select.value = "all";
    }
    renderRecommendations();
  }

  function createRecommendationGroup(type, records) {
    const metadata = {
      maintenance: { label: "Entretien", icon: "#icon-calendar" },
      inspection: { label: "Inspection", icon: "#icon-eye" },
      replacement: { label: "Remplacement", icon: "#icon-wrench" }
    }[type];
    if (!metadata || !records.length) return null;
    const section = document.createElement("section");
    section.className = `record-type-section recommendation-record-group ${type}`;
    section.dataset.recordGroup = "";
    section.dataset.recommendationRecordGroup = type;
    section.innerHTML = `<button class="record-type-heading" type="button" data-record-group-toggle aria-expanded="true"><span class="record-type-icon"><svg class="ui-icon" aria-hidden="true"><use href="${metadata.icon}"></use></svg></span><span class="record-type-copy"><span class="eyebrow">Type de recommandation</span><strong>${metadata.label}</strong></span><span class="record-type-heading-actions"><em>${records.length} recommandation${records.length === 1 ? "" : "s"}</em><svg class="ui-icon record-type-chevron" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></span></button><div class="record-type-content recommendation-record-content"></div>`;
    bindRecordGroupToggle(section.querySelector("[data-record-group-toggle]"));
    const content = section.querySelector(".recommendation-record-content");
    records.forEach((record) => {
      const row = createRecommendationRow(record);
      if (row) content.appendChild(row);
    });
    return section;
  }

  function renderRecommendations() {
    const list = document.querySelector("[data-recommendations-list]");
    if (!list) return;
    const values = getRecommendationFilterValues();
    currentRecommendationDeadlineFilter = values.deadline.length === 1 ? values.deadline[0] : "all";
    list.replaceChildren();
    const filtered = recommendationRecords.filter((record) => {
      const system = getSystemRecord(record.systemId);
      if (!system || !isRecommendationInCurrentScope(record)) return false;
      const age = getSystemAge(system);
      const searchable = `${record.title} ${record.serviceLabel} ${system.label} ${system.location} ${system.apartmentLabel} ${system.floorLabel}`;
      return matchesPrototypeSearch(searchable, values.search)
        && (!values.deadline.length || values.deadline.includes(record.deadline))
        && (!values.decision.length || values.decision.includes(record.workflow))
        && (!values.type.length || values.type.includes(record.serviceType))
        && (values.building === "all" || system.locationKey === values.building)
        && (values.floor === "all" || getRecommendationFloorBand(system) === values.floor)
        && (values.systemType === "all" || system.displayType === values.systemType)
        && (values.age === "all" || getRecommendationAgeBand(age) === values.age);
    });
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    ["maintenance", "inspection", "replacement"].forEach((type) => {
      const section = createRecommendationGroup(type, filtered.filter((record) => record.serviceType === type));
      if (section) list.appendChild(section);
    });
    const count = document.querySelector("[data-recommendation-visible-count]");
    if (count) count.textContent = `${filtered.length} recommandation${filtered.length === 1 ? "" : "s"}`;
    const empty = document.querySelector("[data-recommendation-empty]");
    if (empty) empty.hidden = filtered.length > 0;
    renderRecommendationAppliedFilters(values);
  }

  function updateDashboardRecommendationCounts() {
    Object.keys(recommendationDeadlineMeta).forEach((deadline) => {
      const count = recommendationRecords.filter((record) => record.deadline === deadline && isRecommendationInCurrentScope(record)).length;
      document.querySelectorAll(`[data-dashboard-recommendation-count="${deadline}"]`).forEach((element) => { element.textContent = count; });
    });
  }

  function setRecommendationDeadlineFilter(deadline = "all") {
    currentRecommendationDeadlineFilter = recommendationDeadlineMeta[deadline] ? deadline : "all";
    document.querySelectorAll('[data-recommendation-filter-option="deadline"]').forEach((input) => {
      input.checked = currentRecommendationDeadlineFilter !== "all" && input.value === currentRecommendationDeadlineFilter;
    });
    renderRecommendations();
  }

  function setRecommendationWorkflow(id, workflow, extra = {}) {
    const record = getRecommendationRecord(id);
    if (!record || !recommendationWorkflowMeta[workflow]) return;
    record.workflow = workflow;
    Object.assign(record, extra);
    refreshRecommendationExperience();
  }

  function addRecommendationToCart(id) {
    const record = getRecommendationRecord(id);
    if (!record || ["cart", "ordered"].includes(record.workflow)) return;
    const added = addSystemToRequest(record.systemId, record.serviceType);
    record.workflow = "cart";
    renderRequestCart();
    refreshRecommendationExperience();
    showToast(added ? "Recommandation ajoutée au panier" : "Service déjà dans le panier", `${record.serviceLabel} · ${getSystemRecord(record.systemId)?.label || "Système"}`);
  }

  function togglePlannedRecommendation(id) {
    const record = getRecommendationRecord(id);
    if (!record || ["cart", "ordered"].includes(record.workflow)) return;
    const next = record.workflow === "planned" ? "pending" : "planned";
    setRecommendationWorkflow(id, next, { reappearDate: "" });
    showToast(next === "planned" ? "Ajouté à À prévoir" : "Retiré de À prévoir", "Le panier n’a pas été modifié.");
  }

  function openRecommendationPostpone(id) {
    const record = getRecommendationRecord(id);
    const modal = document.querySelector("[data-recommendation-postpone-modal]");
    if (!record || !modal || record.workflow === "ordered") return;
    activeRecommendationPostponeId = id;
    const input = modal.querySelector("[data-postpone-date]");
    if (input) input.value = "";
    modal.hidden = false;
    body.classList.add("recommendation-postpone-is-open");
    modal.querySelector("[data-postpone-days]")?.focus();
  }

  function closeRecommendationPostpone() {
    const modal = document.querySelector("[data-recommendation-postpone-modal]");
    if (modal) modal.hidden = true;
    body.classList.remove("recommendation-postpone-is-open");
    activeRecommendationPostponeId = "";
  }

  function postponeRecommendationTo(value) {
    if (!activeRecommendationPostponeId || !value) return;
    const id = activeRecommendationPostponeId;
    setRecommendationWorkflow(id, "postponed", { reappearDate: value });
    closeRecommendationPostpone();
    showToast("Recommandation reportée", `Elle réapparaîtra le ${formatRecommendationDate(value)}; son échéance technique reste inchangée.`);
  }

  function postponeRecommendationByDays(days) {
    const date = new Date(prototypeToday);
    date.setDate(date.getDate() + Number(days || 0));
    postponeRecommendationTo(date.toISOString().slice(0, 10));
  }

  function renderSystemActiveRecommendations(systemId) {
    const container = document.querySelector("[data-system-active-recommendations]");
    if (!container) return;
    container.replaceChildren();
    const records = recommendationRecords.filter((record) => record.systemId === systemId);
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "system-recommendation-empty";
      empty.textContent = "Aucune recommandation active pour ce système.";
      container.appendChild(empty);
      return;
    }
    records.forEach((record) => {
      const row = createRecommendationRow(record, true);
      if (row) container.appendChild(row);
    });
  }

  function renderPlannedList() {
    const container = document.querySelector("[data-planned-list-content]");
    if (!container) return;
    const records = recommendationRecords.filter((record) => record.workflow === "planned" && isRecommendationInCurrentScope(record));
    const uniqueSystemCount = new Set(records.map((record) => record.systemId)).size;
    document.querySelectorAll("[data-planned-count], [data-planned-drawer-count]").forEach((element) => { element.textContent = `${uniqueSystemCount} système${uniqueSystemCount === 1 ? "" : "s"}`; });
    container.replaceChildren();
    records.forEach((record) => {
      const system = getSystemRecord(record.systemId);
      if (!system) return;
      const row = document.createElement("article");
      row.className = "planned-list-row";
      row.dataset.plannedRecommendationId = record.id;
      row.innerHTML = `<label><input type="checkbox" data-select-planned-item><span><strong></strong><small></small><em></em></span></label><span class="planned-row-deadline"><b class="status-pill"></b><small></small></span><div><button class="text-button" type="button" data-open-recommendation-system="${record.systemId}">Voir le système</button><button class="text-button" type="button" data-remove-planned-recommendation="${record.id}">Retirer</button></div>`;
      row.querySelector("label strong").textContent = `${system.location} · ${system.apartmentLabel}`;
      row.querySelector("label small").textContent = `${record.serviceLabel} · ${system.label}`;
      const age = getSystemAge(system);
      row.querySelector("label em").textContent = age === null ? "Âge non renseigné" : `Âge · ${age} an${age === 1 ? "" : "s"}`;
      const pill = row.querySelector(".status-pill");
      const deadline = recommendationDeadlineMeta[record.deadline];
      pill.className = `status-pill ${deadline.className}`;
      pill.textContent = deadline.label;
      row.querySelector(".planned-row-deadline small").textContent = formatRecommendationDate(record.date);
      container.appendChild(row);
    });
    const empty = document.querySelector("[data-planned-list-empty]");
    const footer = document.querySelector("[data-planned-list-footer]");
    if (empty) empty.hidden = records.length > 0;
    if (footer) footer.hidden = records.length === 0;
  }

  function openPlannedList() {
    renderPlannedList();
    const drawer = document.querySelector("[data-planned-list-drawer]");
    const backdrop = document.querySelector(".planned-list-backdrop");
    if (drawer) drawer.hidden = false;
    if (backdrop) backdrop.hidden = false;
    body.classList.add("planned-list-is-open");
    drawer?.querySelector("[data-close-planned-list]")?.focus();
  }

  function closePlannedList() {
    const drawer = document.querySelector("[data-planned-list-drawer]");
    const backdrop = document.querySelector(".planned-list-backdrop");
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
    body.classList.remove("planned-list-is-open");
  }

  function addSelectedPlannedToCart() {
    const selectAll = document.querySelector("[data-select-all-planned]")?.checked;
    const selected = Array.from(document.querySelectorAll(selectAll ? "[data-planned-recommendation-id] [data-select-planned-item]" : "[data-planned-recommendation-id] [data-select-planned-item]:checked"));
    if (!selected.length) {
      showToast("Aucun système sélectionné", "Sélectionnez au moins une recommandation à ajouter au panier.");
      return;
    }
    selected.forEach((checkbox) => {
      const record = getRecommendationRecord(checkbox.closest("[data-planned-recommendation-id]").dataset.plannedRecommendationId);
      if (!record) return;
      addSystemToRequest(record.systemId, record.serviceType);
      record.workflow = "cart";
    });
    renderRequestCart();
    refreshRecommendationExperience();
    closePlannedList();
    openRequestCart();
  }

  function renderMaintenanceHealth() {
    const metrics = maintenanceHealthByScope[currentClientScope] || maintenanceHealthByScope.group;
    const rate = Math.round((metrics.current / metrics.eligible) * 100);
    document.querySelectorAll("[data-maintenance-health-score]").forEach((element) => { element.textContent = `${rate}%`; });
    document.querySelectorAll("[data-maintenance-current-rate]").forEach((element) => { element.textContent = `${rate} %`; });
    document.querySelectorAll("[data-maintenance-health-detail]").forEach((element) => { element.textContent = `${metrics.current} sur ${metrics.eligible} systèmes admissibles`; });
  }

  function refreshRecommendationExperience() {
    updateDashboardRecommendationCounts();
    renderRecommendations();
    renderPlannedList();
    renderMaintenanceHealth();
    if (currentSystemDetailId) renderSystemActiveRecommendations(currentSystemDetailId);
  }

  function setRequestRecordTab(tab = "all", highlight = "") {
    currentRequestRecordTab = ["all", "service", "quotes"].includes(tab) ? tab : "all";
    document.querySelectorAll("[data-request-tab]").forEach((button) => {
      const selected = button.dataset.requestTab === currentRequestRecordTab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    filterRequestRecords();
    document.querySelectorAll("[data-quote-number]").forEach((row) => row.classList.remove("is-highlighted"));
    if (highlight) {
      const row = document.querySelector(`[data-quote-number="${highlight}"]`);
      if (row) {
        row.classList.add("is-highlighted");
        window.setTimeout(() => row.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      }
    }
  }

  function toggleRecordGroup(button) {
    const section = button?.closest("[data-record-group]");
    if (!section) return;
    const collapsed = section.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function bindRecordGroupToggle(button) {
    if (!button || button.dataset.recordGroupBound === "true") return;
    button.dataset.recordGroupBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleRecordGroup(button);
    });
  }

  function filterRequestRecords() {
    document.querySelectorAll("[data-request-record-group] [data-record-group-toggle]").forEach(bindRecordGroupToggle);
    const search = document.querySelector("[data-request-record-search]")?.value || "";
    const status = document.querySelector("[data-request-record-status]")?.value || "all";
    let visible = 0;
    document.querySelectorAll("[data-request-record-type]").forEach((record) => {
      const type = record.dataset.requestRecordType;
      const matchesType = currentRequestRecordTab === "all" || type === currentRequestRecordTab;
      const matchesStatus = status === "all" || record.dataset.requestRecordStatusValue === status;
      const inferredClient = record.dataset.clientKey || inferClientKey(record.textContent);
      const matchesScope = body.dataset.role !== "client" || currentClientScope === "group" || inferredClient === currentClientScope;
      record.hidden = !(matchesType && matchesStatus && matchesScope && matchesPrototypeSearch(record.textContent, search));
      if (!record.hidden) visible += 1;
    });
    document.querySelectorAll("[data-request-record-group]").forEach((section) => {
      const records = Array.from(section.querySelectorAll("[data-request-record-type]"));
      const groupVisible = records.filter((record) => !record.hidden).length;
      const type = section.dataset.requestRecordGroup;
      section.hidden = groupVisible === 0;
      const count = section.querySelector("[data-record-group-count]");
      if (count) {
        const noun = type === "quotes" ? "soumission" : "demande";
        count.textContent = `${groupVisible} ${noun}${groupVisible === 1 ? "" : "s"}`;
      }
    });
    const empty = document.querySelector("[data-request-record-empty]");
    if (empty) empty.hidden = visible > 0;
  }

  function addMaintenanceRule() {
    const table = document.querySelector("[data-maintenance-rule-table]");
    if (!table) return;
    const row = document.createElement("div");
    row.className = "maintenance-rule-row is-override is-new";
    row.dataset.maintenanceRule = "";
    row.dataset.dynamicMaintenanceRule = "";
    row.innerHTML = `<span><select data-rule-field="scope" aria-label="Portée de la règle"><option value="tours">Tours Laval</option><option value="saintmartin">Complexe Saint-Martin</option><option value="verdun">Résidence Verdun</option><option value="riviere">Condo Rivière Nord</option><option value="floor">Étage ou zone</option><option value="system">Exception du système</option></select><small>Règle personnalisée</small></span><span><select data-rule-field="system" aria-label="Type de système"><option value="all">Tous les systèmes</option><option value="PTAC">PTAC</option><option value="TTW">TTW</option><option value="Mural">Mural</option><option value="Central">Central</option></select></span><span><select data-rule-field="age" aria-label="Âge du système"><option value="all">Tous les âges</option><option value="0-10">0 à 10 ans</option><option value="11+">11 ans et plus</option></select></span><span><select data-rule-field="activity" aria-label="Activité"><option value="maintenance">Entretien</option><option value="inspection">Inspection</option><option value="replacement">Évaluation remplacement</option></select></span><span><input data-rule-field="frequency" type="number" min="1" value="12" aria-label="Fréquence en mois"> mois</span><span><input data-rule-field="notice" type="number" min="1" value="90" aria-label="Préavis en jours"> jours</span><span class="maintenance-rule-actions"><button class="button secondary compact" type="button" data-toggle-maintenance-rule>Désactiver</button><button class="icon-button compact" type="button" data-remove-maintenance-rule aria-label="Supprimer la règle">×</button></span>`;
    table.appendChild(row);
    row.querySelector('[data-rule-field="scope"]')?.focus();
    showToast("Nouvelle règle ajoutée", "Définissez sa portée; la règle la plus spécifique sera appliquée.");
  }

  function setMaintenanceRuleEnabled(row, enabled) {
    if (!row) return;
    row.classList.toggle("is-disabled", !enabled);
    row.dataset.ruleDisabled = String(!enabled);
    row.querySelectorAll("[data-rule-field]").forEach((field) => { field.disabled = !enabled; });
    const toggle = row.querySelector("[data-toggle-maintenance-rule]");
    if (toggle) {
      toggle.textContent = enabled ? "Désactiver" : "Activer";
      toggle.setAttribute("aria-pressed", String(!enabled));
    }
  }

  function toggleMaintenanceRule(button) {
    const row = button?.closest("[data-maintenance-rule]");
    if (!row) return;
    const enable = row.classList.contains("is-disabled");
    setMaintenanceRuleEnabled(row, enable);
    showToast(enable ? "Règle activée" : "Règle désactivée", enable ? "Elle sera utilisée dans le calcul des prochaines recommandations." : "Elle reste disponible et peut être réactivée à tout moment.");
  }

  function resetMaintenanceRules() {
    document.querySelectorAll("[data-dynamic-maintenance-rule]").forEach((row) => row.remove());
    document.querySelectorAll("[data-base-maintenance-rule]").forEach((row) => {
      ["scope", "system", "age", "activity", "frequency", "notice"].forEach((field) => {
        const control = row.querySelector(`[data-rule-field="${field}"]`);
        const defaultValue = row.dataset[`default${field.charAt(0).toUpperCase()}${field.slice(1)}`];
        if (control && defaultValue !== undefined) control.value = defaultValue;
      });
      setMaintenanceRuleEnabled(row, true);
    });
    showToast("Valeurs par défaut rétablies", "Les règles personnalisées ont été retirées et les règles de base ont repris leurs valeurs initiales.");
  }

  function updateNotificationPreferenceState() {
    const master = document.querySelector("[data-notifications-master]");
    const options = document.querySelector("[data-notification-options]");
    if (!master || !options) return;
    options.disabled = !master.checked;
    options.classList.toggle("is-disabled", !master.checked);
  }

  const inventoryStatusMeta = Object.freeze({
    active: { label: "Actif", floorLabel: "Actifs", className: "success" },
    watch: { label: "À surveiller", floorLabel: "À surveiller", className: "warning" },
    offline: { label: "Hors service", floorLabel: "Hors service", className: "danger" },
    repair: { label: "En réparation", floorLabel: "En réparation", className: "info" }
  });

  function resolveInventoryStatus(statuses) {
    if (statuses.includes("offline")) return "offline";
    if (statuses.includes("repair")) return "repair";
    if (statuses.includes("watch")) return "watch";
    return "active";
  }

  function getComponentInventoryStatus(component) {
    const status = component.querySelector(".status");
    const text = status?.textContent.trim().toLocaleLowerCase("fr") || "";
    if (status?.classList.contains("danger") || /hors service/.test(text)) return "offline";
    if (/réparation|reparation/.test(text)) return "repair";
    if (status?.classList.contains("warning") || /surveillance|surveiller/.test(text)) return "watch";
    return "active";
  }

  function getSystemInventoryStatus(system) {
    return resolveInventoryStatus(system.components.map((component) => getComponentInventoryStatus(component)));
  }

  function applyInventoryStatus(element, statusKey) {
    const meta = inventoryStatusMeta[statusKey] || inventoryStatusMeta.active;
    element.className = `status ${meta.className}`;
    element.textContent = meta.label;
  }

  function buildRequestSystemCatalog() {
    const sourceGrid = document.querySelector("[data-request-equipment-grid]");
    if (!sourceGrid || sourceGrid.dataset.systemCatalogBuilt === "true") return;
    const components = Array.from(sourceGrid.querySelectorAll(":scope > [data-equipment-id]"));
    const repository = document.createElement("div");
    repository.dataset.equipmentComponentSource = "";
    repository.hidden = true;
    components.forEach((card) => repository.appendChild(card));
    sourceGrid.insertAdjacentElement("afterend", repository);

    getSystemRecords(components).forEach((system) => {
      const card = document.createElement("article");
      const statusKey = getSystemInventoryStatus(system);
      const numberMatch = system.apartmentLabel.match(/^Appartement\s+(.+)$/i);
      const displayLabel = numberMatch ? `Appt ${numberMatch[1]}` : system.apartmentLabel;
      card.className = `request-apartment-card is-${statusKey}`;
      card.dataset.requestSystemId = system.id;
      card.dataset.equipmentLocation = system.location;
      card.dataset.equipmentLocationKey = system.locationKey;
      card.dataset.clientKey = system.clientKey;
      card.dataset.equipmentFloor = system.floor;
      card.dataset.equipmentFloorLabel = system.floorLabel;
      card.dataset.equipmentApartmentLabel = system.apartmentLabel;
      card.dataset.requestSystemType = system.type;
      card.dataset.requestStatus = statusKey;
      card.dataset.systemSearchText = [clientScopeData[system.clientKey]?.name, system.location, system.floorLabel, system.apartmentLabel, system.label, system.topology, ...system.components.map((component) => component.dataset.equipmentDetail)].join(" ").toLocaleLowerCase("fr");
      card.innerHTML = `<label class="request-equipment-select request-apartment-select" aria-label="Sélectionner ce système"><input type="checkbox" data-select-request-item><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-check"></use></svg></span></label><button class="request-apartment-preview" type="button" data-apartment-preview><span class="inventory-apartment-card-copy"><strong></strong><small></small><span class="inventory-apartment-types"><em></em></span></span><span class="status"></span><svg class="ui-icon inventory-apartment-arrow" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></button><footer><span><small data-catalog-price-label></small><strong data-catalog-price></strong></span><button class="button secondary compact" type="button" data-add-request-item><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"></use></svg><span>Ajouter</span></button></footer>`;
      const preview = card.querySelector("[data-apartment-preview]");
      preview.dataset.apartmentLabel = system.apartmentLabel;
      preview.dataset.apartmentDisplayLabel = displayLabel;
      preview.dataset.apartmentSystemIds = JSON.stringify([system.id]);
      preview.dataset.requestApartmentPreview = "";
      preview.querySelector(".inventory-apartment-card-copy > strong").textContent = displayLabel;
      preview.querySelector(".inventory-apartment-card-copy > small").textContent = `${system.components.length} équipement${system.components.length === 1 ? "" : "s"} · ${system.label}`;
      preview.querySelector(".inventory-apartment-types em").textContent = system.type === "Monobloc" ? "Monobloc / PTAC" : system.type;
      applyInventoryStatus(preview.querySelector(".status"), statusKey);
      sourceGrid.appendChild(card);
    });
    sourceGrid.dataset.systemCatalogBuilt = "true";
  }

  function groupEquipmentCards(cards) {
    const groups = new Map();
    cards.forEach((card) => {
      const key = `${card.dataset.equipmentLocationKey}::${card.dataset.equipmentFloor}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          locationKey: card.dataset.equipmentLocationKey,
          clientKey: card.dataset.clientKey || locationClientMap[card.dataset.equipmentLocationKey] || "",
          location: card.dataset.equipmentLocation,
          floor: card.dataset.equipmentFloor,
          floorLabel: card.dataset.equipmentFloorLabel,
          cards: []
        });
      }
      groups.get(key).cards.push(card);
    });
    return Array.from(groups.values()).sort((a, b) => {
      const locationOrder = a.location.localeCompare(b.location, "fr");
      return locationOrder || a.floorLabel.localeCompare(b.floorLabel, "fr", { numeric: true });
    });
  }

  function buildRequestFloorGroups() {
    const sourceGrid = document.querySelector("[data-request-equipment-grid]");
    if (!sourceGrid || sourceGrid.dataset.grouped === "true") return;
    const cards = Array.from(sourceGrid.querySelectorAll(":scope > [data-request-system-id]"));
    const container = document.createElement("div");
    container.className = "request-floor-groups";
    container.dataset.requestFloorGroups = "";

    groupEquipmentCards(cards).forEach((group) => {
      const section = document.createElement("section");
      section.className = "equipment-floor-section request-floor-section";
      section.dataset.equipmentFloorSection = "";
      section.dataset.requestFloorGroup = group.key;
      section.dataset.groupLocation = group.locationKey;
      section.dataset.clientKey = group.clientKey;
      section.dataset.groupFloor = group.floor;
      section.innerHTML = `<header class="equipment-floor-heading"><label class="floor-select-circle" aria-label="Sélectionner tous les systèmes de cet étage"><input type="checkbox" data-select-request-floor-group><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-check"></use></svg></span></label><button class="equipment-floor-title-button" type="button" data-equipment-floor-toggle aria-expanded="true"><span><small></small><strong></strong></span><svg class="ui-icon floor-chevron" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></button><div class="inventory-floor-statuses" data-request-floor-statuses></div><em data-request-floor-count></em></header><div class="equipment-floor-body"><div class="request-equipment-grid request-apartment-card-grid"></div></div>`;
      section.querySelector(".equipment-floor-heading small").textContent = `${clientScopeData[group.clientKey]?.name || "Client"} · ${group.location}`;
      section.querySelector(".equipment-floor-heading strong").textContent = group.floorLabel;
      section.querySelector("[data-request-floor-count]").textContent = `${group.cards.length} système${group.cards.length === 1 ? "" : "s"}`;
      const statusCounts = Object.fromEntries(Object.keys(inventoryStatusMeta).map((statusKey) => [statusKey, 0]));
      group.cards.forEach((card) => { statusCounts[card.dataset.requestStatus || "active"] += 1; });
      const floorStatuses = section.querySelector("[data-request-floor-statuses]");
      Object.entries(inventoryStatusMeta).forEach(([statusKey, meta]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `inventory-floor-status-chip is-${statusKey}`;
        chip.dataset.requestStatusChip = statusKey;
        chip.innerHTML = `<span></span><strong></strong>`;
        chip.querySelector("span").textContent = meta.floorLabel;
        chip.querySelector("strong").textContent = statusCounts[statusKey];
        chip.setAttribute("aria-label", `Filtrer par ${meta.label} : ${statusCounts[statusKey]} système${statusCounts[statusKey] === 1 ? "" : "s"}`);
        floorStatuses.appendChild(chip);
      });
      const grid = section.querySelector(".request-equipment-grid");
      group.cards.forEach((card) => grid.appendChild(card));
      container.appendChild(section);
    });
    sourceGrid.replaceWith(container);
  }

  function buildEquipmentInventory() {
    const container = document.querySelector("[data-equipment-inventory-groups]");
    if (!container || container.children.length) return;
    const cards = getEquipmentComponentCards();
    groupEquipmentCards(cards).forEach((group) => {
      const apartments = new Map();
      group.cards.forEach((card) => {
        const apartmentLabel = card.dataset.equipmentApartmentLabel || card.dataset.equipmentName;
        if (!apartments.has(apartmentLabel)) apartments.set(apartmentLabel, []);
        apartments.get(apartmentLabel).push(card);
      });

      const section = document.createElement("section");
      section.className = "equipment-floor-section inventory-floor-section";
      section.dataset.equipmentFloorSection = "";
      section.dataset.inventoryFloorSection = group.key;
      section.dataset.inventoryLocation = group.locationKey;
      section.dataset.clientKey = group.clientKey;
      section.dataset.inventoryFloor = group.floor;
      section.innerHTML = `<header class="equipment-floor-heading"><button class="equipment-floor-title-button" type="button" data-equipment-floor-toggle aria-expanded="true"><span><small></small><strong></strong></span><svg class="ui-icon floor-chevron" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></button><div class="inventory-floor-statuses" data-inventory-floor-statuses></div><em data-inventory-floor-count></em></header><div class="equipment-floor-body"><div class="inventory-apartment-list inventory-apartment-card-grid"></div></div>`;
      section.querySelector(".equipment-floor-heading small").textContent = `${clientScopeData[group.clientKey]?.name || "Client"} · ${group.location}`;
      section.querySelector(".equipment-floor-heading strong").textContent = group.floorLabel;
      const apartmentCount = apartments.size;
      section.querySelector("[data-inventory-floor-count]").textContent = `${apartmentCount} appartement${apartmentCount === 1 ? "" : "s"}`;
      const floorSystems = [...new Set(group.cards.map((card) => card.dataset.equipmentSystemKey || card.dataset.equipmentId))].map((systemKey) => getSystemRecord(systemKey)).filter(Boolean);
      const floorStatusCounts = Object.fromEntries(Object.keys(inventoryStatusMeta).map((statusKey) => [statusKey, 0]));
      floorSystems.forEach((system) => { floorStatusCounts[getSystemInventoryStatus(system)] += 1; });
      const floorStatuses = section.querySelector("[data-inventory-floor-statuses]");
      Object.entries(inventoryStatusMeta).forEach(([statusKey, meta]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `inventory-floor-status-chip is-${statusKey}`;
        chip.dataset.inventoryStatusChip = statusKey;
        chip.innerHTML = `<span></span><strong></strong>`;
        chip.querySelector("span").textContent = meta.floorLabel;
        chip.querySelector("strong").textContent = floorStatusCounts[statusKey];
        chip.setAttribute("aria-label", `Filtrer par ${meta.label} : ${floorStatusCounts[statusKey]} système${floorStatusCounts[statusKey] === 1 ? "" : "s"}`);
        floorStatuses.appendChild(chip);
      });
      const apartmentList = section.querySelector(".inventory-apartment-list");

      apartments.forEach((apartmentCards, apartmentLabel) => {
        const systems = new Map();
        apartmentCards.forEach((card) => {
          const systemKey = card.dataset.equipmentSystemKey || card.dataset.equipmentId;
          if (!systems.has(systemKey)) systems.set(systemKey, []);
          systems.get(systemKey).push(card);
        });

        const systemRecords = Array.from(systems.keys()).map((systemKey) => getSystemRecord(systemKey)).filter(Boolean);
        const systemTypes = [...new Set(systemRecords.map((system) => system.displayType))];
        const systemStatuses = systemRecords.map((system) => getSystemInventoryStatus(system));
        const apartmentStatus = resolveInventoryStatus(systemStatuses);
        const serviceEntries = getApartmentServiceEntries(systemRecords);
        const nextService = serviceEntries.find((entry) => entry.kind === "scheduled") || serviceEntries.find((entry) => entry.kind === "maintenance") || null;
        const numberMatch = apartmentLabel.match(/^Appartement\s+(.+)$/i);
        const displayLabel = numberMatch ? `Appt ${numberMatch[1]}` : apartmentLabel;
        const card = document.createElement("button");
        card.className = `inventory-apartment-card is-${apartmentStatus}`;
        card.type = "button";
        card.dataset.inventoryApartment = "";
        card.dataset.apartmentPreview = "";
        card.dataset.apartmentLabel = apartmentLabel;
        card.dataset.apartmentDisplayLabel = displayLabel;
        card.dataset.apartmentSystemIds = JSON.stringify(Array.from(systems.keys()));
        card.dataset.inventoryLocation = group.locationKey;
        card.dataset.clientKey = group.clientKey;
        card.dataset.inventoryFloor = group.floor;
        card.dataset.inventorySystemTypes = systemTypes.join("|");
        card.dataset.inventoryStatus = apartmentStatus;
        card.dataset.inventorySystemStatuses = [...new Set(systemStatuses)].join("|");
        card.dataset.inventoryServiceEntries = JSON.stringify(serviceEntries);
        card.dataset.inventorySearchText = [clientScopeData[group.clientKey]?.name, group.location, group.floorLabel, apartmentLabel, displayLabel, ...systemRecords.flatMap((system) => [system.label, system.displayType, system.topology, ...system.components.flatMap((component) => [component.dataset.equipmentDetail, component.dataset.equipmentUnitLabel, component.dataset.equipmentName])])].join(" ").toLocaleLowerCase("fr");
        card.innerHTML = `<span class="inventory-apartment-card-header"><strong></strong><i class="status"></i></span><span class="inventory-apartment-card-details"><span><small>Type de système</small><strong data-apartment-system-type></strong></span><span><small data-apartment-service-label></small><strong data-apartment-service-date></strong></span></span><span class="inventory-apartment-card-action"><span>Consulter l’appartement</span><svg class="ui-icon inventory-apartment-arrow" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></span>`;
        card.querySelector(".inventory-apartment-card-header > strong").textContent = displayLabel;
        card.querySelector("[data-apartment-system-type]").textContent = systemTypes.join(" · ");
        card.querySelector("[data-apartment-service-label]").textContent = nextService?.label || "Prochain service";
        card.querySelector("[data-apartment-service-date]").textContent = nextService ? formatRecommendationDate(nextService.date) : "À définir";
        const statusElement = card.querySelector(".status");
        applyInventoryStatus(statusElement, apartmentStatus);
        if (apartmentStatus === "watch") statusElement.title = "Système opérationnel présentant une anomalie ou une tendance qui demande un suivi. L’âge ou un entretien en retard ne déclenchent pas seuls ce statut.";
        apartmentList.appendChild(card);
      });
      container.appendChild(section);
    });
  }

  function buildPlaceEquipmentInventory(locationKey = "tours") {
    const target = document.querySelector("[data-place-inventory-groups]");
    if (!target) return;
    target.replaceChildren();
    document.querySelectorAll(`[data-inventory-floor-section][data-inventory-location="${locationKey}"]`).forEach((sourceSection) => {
      const section = sourceSection.cloneNode(true);
      const floorKey = section.dataset.inventoryFloor || "";
      section.removeAttribute("data-inventory-floor-section");
      section.removeAttribute("data-inventory-floor");
      section.removeAttribute("data-inventory-location");
      section.dataset.placeInventoryFloorSection = "";
      section.dataset.placeInventoryFloor = floorKey;
      section.querySelectorAll("[data-inventory-apartment]").forEach((card) => {
        card.removeAttribute("data-inventory-apartment");
        card.dataset.placeInventoryApartment = "";
      });
      section.querySelectorAll("[data-inventory-status-chip]").forEach((chip) => {
        const statusKey = chip.dataset.inventoryStatusChip;
        chip.removeAttribute("data-inventory-status-chip");
        chip.dataset.placeInventoryStatusChip = statusKey;
        chip.classList.remove("is-selected");
        chip.setAttribute("aria-pressed", "false");
      });
      target.appendChild(section);
    });
  }

  function getSystemComponentRoleRank(component) {
    const label = component.dataset.equipmentUnitLabel || "";
    if (/extérieure/i.test(label)) return 0;
    if (/intérieure/i.test(label)) return 1;
    return 0;
  }

  function createSystemComponentNode(component, relationClass) {
    const item = document.createElement("article");
    const componentStatus = component.querySelector(".status");
    const iconHref = component.querySelector(".equipment-product-icon use")?.getAttribute("href") || "#icon-equipment";
    const model = component.querySelector(".request-equipment-card > div > p")?.textContent.trim() || component.dataset.equipmentDetail;
    const detailValues = component.querySelectorAll(".request-equipment-card dd");
    const serial = detailValues[0]?.textContent.trim() || "";
    const lastService = detailValues[1]?.textContent.trim() || "Non renseigné";
    const unitLabel = component.dataset.equipmentUnitLabel || component.dataset.equipmentName;
    item.className = `system-equipment-node ${relationClass}`;
    item.dataset.systemEquipmentId = component.dataset.equipmentId;
    item.innerHTML = `<span class="system-equipment-node-icon"><svg class="ui-icon" aria-hidden="true"><use></use></svg></span><div class="system-equipment-node-copy"><div class="system-equipment-node-title"><h4></h4><span class="status"></span></div><p class="system-equipment-model"></p><dl><div><dt>Numéro de série</dt><dd></dd></div><div><dt>Dernier service</dt><dd></dd></div></dl><div class="equipment-warranty-tags system-node-warranties" data-warranty-tags></div></div>`;
    item.querySelector("use").setAttribute("href", iconHref);
    item.querySelector("h4").textContent = unitLabel;
    item.querySelector(".system-equipment-model").textContent = model;
    item.querySelector(".status").className = componentStatus?.className || "status success";
    item.querySelector(".status").textContent = componentStatus?.textContent || "Actif";
    const values = item.querySelectorAll("dd");
    values[0].textContent = serial;
    values[1].textContent = lastService;
    const warranties = item.querySelector("[data-warranty-tags]");
    warranties.dataset.warrantyManufacturer = component.dataset.equipmentManufacturer;
    warranties.dataset.warrantyInstallDate = component.dataset.equipmentInstallDate;
    return item;
  }

  function renderSystemComponentHierarchy(container, system) {
    if (!container || !system?.components.length) return;
    container.replaceChildren();
    const orderedComponents = [...system.components].sort((a, b) => getSystemComponentRoleRank(a) - getSystemComponentRoleRank(b));
    container.appendChild(createSystemComponentNode(orderedComponents[0], "is-primary"));
    if (orderedComponents.length > 1) {
      const children = document.createElement("div");
      children.className = "system-equipment-children";
      orderedComponents.slice(1).forEach((component) => children.appendChild(createSystemComponentNode(component, "is-child")));
      container.appendChild(children);
    }
  }

  function openApartmentPreview(button) {
    const modal = document.querySelector("[data-apartment-preview-modal]");
    const systemsContainer = document.querySelector("[data-apartment-preview-systems]");
    if (!modal || !systemsContainer || !button) return;
    apartmentPreviewReturnButton = button;
    if (modal.parentElement !== body) body.appendChild(modal);
    let systemIds = [];
    try { systemIds = JSON.parse(button.dataset.apartmentSystemIds || "[]"); } catch { systemIds = []; }
    const systems = systemIds.map((systemId) => getSystemRecord(systemId)).filter(Boolean);
    const componentCount = systems.reduce((total, system) => total + system.components.length, 0);
    const setText = (selector, value) => {
      const element = modal.querySelector(selector);
      if (element) element.textContent = value;
    };
    setText("[data-apartment-preview-context]", `${systems[0]?.location || "Immeuble"} · ${systems[0]?.floorLabel || "Étage"}`);
    setText("[data-apartment-preview-title]", button.dataset.apartmentDisplayLabel || button.dataset.apartmentLabel || "Aperçu de l’appartement");
    setText("[data-apartment-preview-summary]", `${systems.length} système${systems.length === 1 ? "" : "s"} · ${componentCount} équipement${componentCount === 1 ? "" : "s"}`);
    const requestContext = Boolean(button.closest('[data-screen-view="new-request"]'));
    modal.dataset.requestContext = requestContext ? "true" : "false";
    systemsContainer.replaceChildren();
    systems.forEach((system) => {
      const systemStatus = getSystemInventoryStatus(system);
      const article = document.createElement("article");
      article.className = "apartment-preview-system";
      article.innerHTML = `<header><div><span class="eyebrow"></span><h3></h3><p></p></div><div><span class="status"></span><button class="button secondary compact" type="button" data-add-request-preview-system hidden><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"></use></svg><span>Ajouter</span></button><button class="button primary compact" type="button" data-open-system>Voir détails</button></div></header><div class="system-equipment-hierarchy apartment-preview-equipment-list"></div>`;
      article.querySelector(".eyebrow").textContent = `Système ${system.type}`;
      article.querySelector("h3").textContent = system.label;
      article.querySelector("header p").textContent = system.topology;
      applyInventoryStatus(article.querySelector(".status"), systemStatus);
      article.querySelector("[data-open-system]").dataset.openSystem = system.id;
      const addButton = article.querySelector("[data-add-request-preview-system]");
      addButton.hidden = !requestContext;
      addButton.dataset.addRequestPreviewSystem = system.id;
      const alreadyAdded = requestCart.has(getRequestItemKey(system.id));
      addButton.classList.toggle("is-added", alreadyAdded);
      addButton.querySelector("use")?.setAttribute("href", alreadyAdded ? "#icon-check" : "#icon-plus");
      const addLabel = addButton.querySelector("span");
      if (addLabel) addLabel.textContent = alreadyAdded ? "Dans le panier" : "Ajouter";
      renderSystemComponentHierarchy(article.querySelector(".system-equipment-hierarchy"), system);
      systemsContainer.appendChild(article);
    });
    updateWarrantyDisplays();
    modal.hidden = false;
    body.classList.add("apartment-preview-is-open");
    modal.querySelector("[data-close-apartment-preview]")?.focus();
  }

  function closeApartmentPreview() {
    const modal = document.querySelector("[data-apartment-preview-modal]");
    if (modal) modal.hidden = true;
    body.classList.remove("apartment-preview-is-open");
    if (apartmentPreviewReturnButton?.isConnected) apartmentPreviewReturnButton.focus({ preventScroll: true });
    apartmentPreviewReturnButton = null;
  }

  function openSystemDetail(systemId) {
    const system = getSystemRecord(systemId);
    if (!system) return;
    currentSystemDetailId = systemId;
    closeApartmentPreview();
    if (body.dataset.screen !== "system-detail") systemDetailReturnScreen = body.dataset.screen || "equipment-inventory";
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    };
    const systemStatus = getSystemInventoryStatus(system);
    setText("[data-system-detail-context]", `${system.location} · ${system.apartmentLabel}`);
    setText("[data-system-detail-location]", `${system.label} · ${system.floorLabel}`);
    setText("[data-system-dossier-name]", system.label);
    setText("[data-system-dossier-topology]", `${system.type} · ${system.topology}`);
    const status = document.querySelector("[data-system-detail-status]");
    if (status) {
      applyInventoryStatus(status, systemStatus);
      status.title = systemStatus === "watch" ? "Système opérationnel présentant une anomalie ou une tendance qui demande un suivi. L’âge ou un entretien en retard ne déclenchent pas seuls ce statut." : "";
    }
    const age = getSystemAge(system);
    setText("[data-system-detail-age]", age === null ? "Âge non renseigné" : `Âge · ${age} an${age === 1 ? "" : "s"}`);
    const service = getSystemServiceOverview(systemId);
    setText("[data-system-detail-service-label]", service.label);
    setText("[data-system-detail-service-date]", service.date ? formatRecommendationDate(service.date) : "À définir");
    setText("[data-system-detail-service-copy]", service.copy);
    const dossierIcon = document.querySelector("[data-system-dossier-icon]");
    if (dossierIcon) dossierIcon.setAttribute("href", system.type === "Monobloc" ? "#icon-equipment" : "#icon-outdoor-unit");
    renderSystemComponentHierarchy(document.querySelector("[data-system-detail-components]"), system);
    renderSystemActiveRecommendations(systemId);
    updateWarrantyDisplays();
    selectEquipmentTab("overview");
    showScreen("system-detail");
  }

  function toggleEquipmentFloor(button) {
    const section = button.closest("[data-equipment-floor-section], [data-place-inventory-floor-section]");
    const body = section?.querySelector(".equipment-floor-body");
    if (!section || !body) return;
    const collapsed = section.classList.toggle("is-collapsed");
    body.hidden = collapsed;
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function selectRequestType(type) {
    if (!requestTypeData[type]) return;
    selectedRequestType = type;
    document.querySelectorAll("[data-request-type]").forEach((button) => {
      const selected = button.dataset.requestType === type;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
    });
    updateRequestCatalog();
    renderRequestCart();
    updateRequestSelectionBar();
  }

  function addCardToRequest(card, type = selectedRequestType) {
    if (!card) return false;
    return addSystemToRequest(card.dataset.requestSystemId, type);
  }

  function addSystemToRequest(systemId, type = selectedRequestType) {
    if (!systemId || !requestTypeData[type]) return false;
    const system = getSystemRecord(systemId);
    if (!system) return false;
    const key = getRequestItemKey(systemId, type);
    if (!requestCart.has(key)) {
      requestCart.set(key, {
        key,
        systemId,
        type,
        unitPrice: requestTypeData[type].price,
        variablePrice: Boolean(requestTypeData[type].variablePrice),
        name: system.label,
        detail: `${system.topology} · ${system.components.length} équipement${system.components.length === 1 ? "" : "s"}`,
        clientKey: system.clientKey,
        clientName: clientScopeData[system.clientKey]?.name || "Client",
        location: system.location,
        apartmentLabel: system.apartmentLabel,
        context: `${system.location} · ${system.apartmentLabel}`,
        quantity: 1
      });
      return true;
    }
    return false;
  }

  function addRequestItem(button) {
    const card = button.closest("[data-request-system-id]");
    if (!card) return;
    const added = addCardToRequest(card);
    renderRequestCart();
    const system = getSystemRecord(card.dataset.requestSystemId);
    showToast(added ? "Système ajouté au panier" : "Déjà dans le panier", `${requestTypeData[selectedRequestType].label} · ${system?.label || "Système HVAC"}`);
  }

  function addRequestPreviewSystem(button) {
    const systemId = button?.dataset.addRequestPreviewSystem;
    const system = getSystemRecord(systemId);
    const added = addSystemToRequest(systemId);
    renderRequestCart();
    if (button) {
      button.classList.toggle("is-added", requestCart.has(getRequestItemKey(systemId)));
      button.querySelector("use")?.setAttribute("href", added ? "#icon-check" : "#icon-cart");
      const label = button.querySelector("span");
      if (label) label.textContent = added ? "Dans le panier" : "Déjà ajouté";
    }
    showToast(added ? "Système ajouté au panier" : "Déjà dans le panier", `${requestTypeData[selectedRequestType].label} · ${system?.label || "Système HVAC"}`);
  }

  function clearRequestSelection() {
    document.querySelectorAll("[data-select-request-item]").forEach((checkbox) => { checkbox.checked = false; });
    updateRequestSelectionBar();
  }

  function updateRequestSelectionBar() {
    const selected = Array.from(document.querySelectorAll("[data-select-request-item]:checked"));
    const count = selected.length;
    const countLabel = document.querySelector("[data-request-selection-count]");
    const typeLabel = document.querySelector("[data-request-selection-type]");
    const addButton = document.querySelector("[data-add-request-selection]");
    const bar = document.querySelector("[data-request-selection-bar]");
    if (countLabel) countLabel.textContent = `${count} système${count === 1 ? "" : "s"} sélectionné${count === 1 ? "" : "s"}`;
    if (typeLabel) typeLabel.textContent = requestTypeData[selectedRequestType].label;
    if (addButton) addButton.disabled = count === 0;
    if (bar) bar.hidden = count === 0;
    document.querySelectorAll("[data-request-system-id]").forEach((card) => {
      card.classList.toggle("is-selected-for-batch", Boolean(card.querySelector("[data-select-request-item]")?.checked));
    });
    document.querySelectorAll("[data-request-floor-group]").forEach((section) => {
      const floorCheckbox = section.querySelector("[data-select-request-floor-group]");
      const itemCheckboxes = Array.from(section.querySelectorAll("[data-select-request-item]"));
      const selectedCount = itemCheckboxes.filter((checkbox) => checkbox.checked).length;
      if (!floorCheckbox) return;
      floorCheckbox.checked = itemCheckboxes.length > 0 && selectedCount === itemCheckboxes.length;
      floorCheckbox.indeterminate = selectedCount > 0 && selectedCount < itemCheckboxes.length;
    });
  }

  function addRequestSelection() {
    const selected = Array.from(document.querySelectorAll("[data-select-request-item]:checked"));
    let addedCount = 0;
    selected.forEach((checkbox) => {
      if (addCardToRequest(checkbox.closest("[data-request-system-id]"))) addedCount += 1;
    });
    const selectedCount = selected.length;
    clearRequestSelection();
    renderRequestCart();
    showToast(`${addedCount} ajout${addedCount === 1 ? "" : "s"} au panier`, `${selectedCount} système${selectedCount === 1 ? "" : "s"} traité${selectedCount === 1 ? "" : "s"} comme « ${requestTypeData[selectedRequestType].label} ».`);
  }

  function updateRequestFloorOptions() {
    const floorSelect = document.querySelector("[data-request-floor]");
    const location = document.querySelector("[data-request-location]")?.value || "all";
    const client = getEffectiveClientFilter("[data-request-client]");
    if (!floorSelect) return;
    const previousValue = floorSelect.value;
    const floors = new Map();
    document.querySelectorAll("[data-request-system-id]").forEach((card) => {
      const matchesClient = client === "all" || card.dataset.clientKey === client;
      if (matchesClient && (location === "all" || card.dataset.equipmentLocationKey === location)) floors.set(card.dataset.equipmentFloor, card.dataset.equipmentFloorLabel);
    });
    floorSelect.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous les étages";
    floorSelect.appendChild(allOption);
    Array.from(floors.entries()).sort((a, b) => a[1].localeCompare(b[1], "fr", { numeric: true })).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      floorSelect.appendChild(option);
    });
    floorSelect.value = floors.has(previousValue) ? previousValue : "all";
  }

  function selectRequestScope(scope) {
    const locationSelect = document.querySelector("[data-request-location]");
    const floorSelect = document.querySelector("[data-request-floor]");
    const location = locationSelect?.value || "all";
    const floor = floorSelect?.value || "all";
    if (location === "all") {
      locationSelect?.focus();
      showToast("Choisissez un immeuble", "Sélectionnez d’abord l’immeuble concerné.");
      return;
    }
    if (scope === "floor" && floor === "all") {
      floorSelect?.focus();
      showToast("Choisissez un étage", "Sélectionnez l’étage à ajouter.");
      return;
    }
    let selectedCount = 0;
    document.querySelectorAll("[data-request-system-id]").forEach((card) => {
      const matchesBuilding = card.dataset.equipmentLocationKey === location;
      const matchesFloor = scope === "building" || card.dataset.equipmentFloor === floor;
      if (matchesBuilding && matchesFloor) {
        const checkbox = card.querySelector("[data-select-request-item]");
        if (checkbox) checkbox.checked = true;
        selectedCount += 1;
      }
    });
    updateRequestSelectionBar();
    showToast(`${selectedCount} système${selectedCount === 1 ? "" : "s"} sélectionné${selectedCount === 1 ? "" : "s"}`, scope === "building" ? "Tous les systèmes de l’immeuble sont prêts à être ajoutés." : "Tous les systèmes de l’étage sont prêts à être ajoutés.");
  }

  function removeRequestItem(id) {
    const item = requestCart.get(id);
    requestCart.delete(id);
    renderRequestCart();
    if (item) {
      recommendationRecords.filter((record) => record.systemId === item.systemId && record.serviceType === item.type && record.workflow === "cart").forEach((record) => { record.workflow = "pending"; });
      refreshRecommendationExperience();
    }
  }

  function renderRequestCart() {
    const lines = document.querySelector("[data-request-cart-lines]");
    const empty = document.querySelector("[data-request-cart-empty]");
    const summary = document.querySelector("[data-request-cart-summary]");
    if (!lines || !empty || !summary) return;
    const items = Array.from(requestCart.values());
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const systemCount = new Set(items.map((item) => item.systemId)).size;
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * 0.14975;

    const serviceGroups = new Map();
    items.forEach((item) => {
      if (!serviceGroups.has(item.type)) serviceGroups.set(item.type, []);
      serviceGroups.get(item.type).push(item);
    });

    lines.replaceChildren();
    serviceGroups.forEach((groupItems, type) => {
      const service = requestTypeData[type];
      const groupQuantity = groupItems.reduce((sum, item) => sum + item.quantity, 0);
      const groupSystemCount = new Set(groupItems.map((item) => item.systemId)).size;
      const groupTotal = groupItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const groupHasVariablePrice = groupItems.some((item) => item.variablePrice);
      const group = document.createElement("article");
      group.className = "request-cart-service-group";
      group.dataset.requestCartService = type;
      group.innerHTML = `<div class="request-cart-service-summary"><span class="request-cart-service-icon"><svg class="ui-icon" aria-hidden="true"><use></use></svg></span><span class="request-cart-service-copy"><strong></strong><small></small></span><strong class="request-cart-service-total"></strong></div><button class="request-cart-details-toggle" type="button" data-request-cart-details-toggle aria-expanded="false"><svg class="ui-icon" aria-hidden="true"><use href="#icon-eye"></use></svg><span>Voir les détails</span><em></em><svg class="ui-icon request-cart-details-chevron" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></button><div class="request-cart-service-details" data-request-cart-service-details hidden></div>`;
      group.querySelector(".request-cart-service-icon use").setAttribute("href", service.icon);
      group.querySelector(".request-cart-service-copy strong").textContent = service.label;
      group.querySelector(".request-cart-service-copy small").textContent = `${groupSystemCount} système${groupSystemCount === 1 ? "" : "s"} inclus`;
      group.querySelector(".request-cart-service-total").textContent = groupHasVariablePrice ? "À confirmer" : currencyFormatter.format(groupTotal);
      group.querySelector(".request-cart-details-toggle em").textContent = `${groupQuantity} prestation${groupQuantity === 1 ? "" : "s"}`;
      const details = group.querySelector("[data-request-cart-service-details]");

      groupItems.forEach((item) => {
        const system = getSystemRecord(item.systemId);
        const displayApartment = (item.apartmentLabel || system?.apartmentLabel || "Système").replace(/^Appartement\s+/i, "Appt ");
        const detail = document.createElement("article");
        detail.className = "request-cart-detail-row";
        detail.dataset.requestCartItem = item.key;
        detail.innerHTML = `<span class="request-cart-detail-copy"><strong></strong><small></small><em></em></span><span class="request-cart-detail-price"><strong></strong><button class="request-cart-remove" type="button" data-remove-request-item><svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg></button></span>`;
        detail.querySelector(".request-cart-detail-copy strong").textContent = displayApartment;
        detail.querySelector(".request-cart-detail-copy small").textContent = `${item.clientName} · ${item.location}`;
        detail.querySelector(".request-cart-detail-copy em").textContent = item.name;
        detail.querySelector(".request-cart-detail-price strong").textContent = item.variablePrice ? "À confirmer" : currencyFormatter.format(item.quantity * item.unitPrice);
        const removeButton = detail.querySelector("[data-remove-request-item]");
        removeButton.setAttribute("aria-label", `Retirer ${displayApartment} de la commande`);
        removeButton.title = `Retirer ${displayApartment}`;
        details.appendChild(detail);
      });
      const expanded = expandedRequestCartServices.has(type);
      const toggle = group.querySelector("[data-request-cart-details-toggle]");
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.querySelector("span").textContent = expanded ? "Masquer les détails" : "Voir les détails";
      details.hidden = !expanded;
      group.classList.toggle("is-expanded", expanded);
      lines.appendChild(group);
    });

    const hasItems = items.length > 0;
    empty.hidden = hasItems;
    lines.hidden = !hasItems;
    summary.hidden = !hasItems;
    document.querySelectorAll("[data-request-cart-count]").forEach((count) => { count.textContent = totalQuantity; });
    document.querySelector("[data-request-cart-equipment-count]").textContent = `${systemCount} système${systemCount === 1 ? "" : "s"}`;
    document.querySelector("[data-request-cart-service-count]").textContent = `${serviceGroups.size} service${serviceGroups.size === 1 ? "" : "s"}`;
    document.querySelector("[data-request-subtotal]").textContent = currencyFormatter.format(subtotal);
    document.querySelector("[data-request-tax]").textContent = currencyFormatter.format(tax);
    document.querySelector("[data-request-total]").textContent = currencyFormatter.format(subtotal + tax);

    document.querySelectorAll("[data-request-system-id]").forEach((card) => {
      const added = requestCart.has(getRequestItemKey(card.dataset.requestSystemId));
      card.classList.toggle("is-added", added);
      const button = card.querySelector("[data-add-request-item]");
      if (!button) return;
      button.querySelector("span").textContent = added ? "Dans le panier" : "Ajouter";
      button.querySelector("use").setAttribute("href", added ? "#icon-check" : "#icon-plus");
    });
    renderRequestCheckout();
  }

  function toggleRequestCartDetails(button) {
    const group = button?.closest("[data-request-cart-service]");
    const details = group?.querySelector("[data-request-cart-service-details]");
    if (!details) return;
    const expanded = button.getAttribute("aria-expanded") !== "true";
    const type = group.dataset.requestCartService;
    if (expanded) expandedRequestCartServices.add(type);
    else expandedRequestCartServices.delete(type);
    button.setAttribute("aria-expanded", String(expanded));
    button.querySelector("span").textContent = expanded ? "Masquer les détails" : "Voir les détails";
    details.hidden = !expanded;
    group.classList.toggle("is-expanded", expanded);
  }

  function renderRequestCheckout() {
    const lines = document.querySelector("[data-checkout-order-lines]");
    if (!lines) return;
    const items = Array.from(requestCart.values());
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const systemCount = new Set(items.map((item) => item.systemId)).size;
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * 0.14975;
    const total = subtotal + tax;
    const clientKeys = new Set(items.map((item) => item.clientKey).filter(Boolean));
    const splitNotice = document.querySelector("[data-checkout-client-split]");
    const splitCopy = document.querySelector("[data-checkout-client-split-copy]");
    if (splitNotice) splitNotice.hidden = clientKeys.size < 2;
    if (splitCopy) splitCopy.textContent = `${clientKeys.size} filiales sont concernées. KlimaParc créera une commande indépendante pour chacune afin de préserver ses contrats, prix et PO.`;

    lines.replaceChildren();
    items.forEach((item) => {
      const line = document.createElement("article");
      line.className = "checkout-order-line";
      line.innerHTML = `<span class="checkout-service-icon"><svg class="ui-icon" aria-hidden="true"><use></use></svg></span><span class="checkout-order-copy"><strong></strong><small></small><em></em></span><span class="checkout-order-price"><small></small><strong></strong></span>`;
      line.querySelector("use").setAttribute("href", requestTypeData[item.type].icon);
      line.querySelector(".checkout-order-copy strong").textContent = requestTypeData[item.type].label;
      line.querySelector(".checkout-order-copy small").textContent = item.name;
      line.querySelector(".checkout-order-copy em").textContent = `${item.clientName} · ${item.context || item.location}`;
      line.querySelector(".checkout-order-price small").textContent = item.variablePrice ? "Prix confirmé après analyse" : `${item.quantity} × ${currencyFormatter.format(item.unitPrice)}`;
      line.querySelector(".checkout-order-price strong").textContent = item.variablePrice ? "À confirmer" : currencyFormatter.format(item.quantity * item.unitPrice);
      lines.appendChild(line);
    });

    const empty = document.querySelector("[data-checkout-order-empty]");
    if (empty) empty.hidden = items.length > 0;
    lines.hidden = items.length === 0;
    const systemLabel = document.querySelector("[data-checkout-system-count]");
    const serviceLabel = document.querySelector("[data-checkout-service-count]");
    if (systemLabel) systemLabel.textContent = `${systemCount} système${systemCount === 1 ? "" : "s"}`;
    if (serviceLabel) serviceLabel.textContent = `${totalQuantity} service${totalQuantity === 1 ? "" : "s"}`;
    const subtotalLabel = document.querySelector("[data-checkout-subtotal]");
    const taxLabel = document.querySelector("[data-checkout-tax]");
    const totalLabel = document.querySelector("[data-checkout-total]");
    if (subtotalLabel) subtotalLabel.textContent = currencyFormatter.format(subtotal);
    if (taxLabel) taxLabel.textContent = currencyFormatter.format(tax);
    if (totalLabel) totalLabel.textContent = currencyFormatter.format(total);
    const submit = document.querySelector("[data-confirm-request-order]");
    if (submit) submit.disabled = items.length === 0;
  }

  function selectCheckoutPayment(value) {
    document.querySelectorAll("[data-checkout-payment]").forEach((input) => {
      const selected = input.value === value;
      input.checked = selected;
      input.closest(".checkout-payment-option")?.classList.toggle("is-selected", selected);
    });
    document.querySelectorAll("[data-checkout-payment-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.checkoutPaymentPanel !== value;
    });
  }

  function confirmRequestOrder() {
    if (!requestCart.size) {
      showToast("Panier vide", "Ajoutez au moins un service avant de confirmer la demande.");
      showScreen("new-request");
      return;
    }
    const orderedItems = Array.from(requestCart.values());
    const payment = document.querySelector("[data-checkout-payment]:checked")?.value || "card";
    const clientCount = new Set(orderedItems.map((item) => item.clientKey).filter(Boolean)).size;
    const title = clientCount > 1 ? `${clientCount} commandes envoyées` : "Demande envoyée";
    const paymentCopy = payment === "po" ? "Le PO a été associé à la demande pour validation." : "Le paiement par carte a été sélectionné pour cette demande.";
    orderedItems.forEach((item) => {
      recommendationRecords.filter((record) => record.systemId === item.systemId && record.serviceType === item.type).forEach((record) => { record.workflow = "ordered"; });
    });
    requestCart.clear();
    expandedRequestCartServices.clear();
    renderRequestCart();
    refreshRecommendationExperience();
    showToast(title, clientCount > 1 ? `Une commande indépendante a été créée pour chaque filiale. ${paymentCopy}` : `${paymentCopy} Le rendez-vous sera établi après l’ouverture du bon de travail.`);
    showScreen("requests");
  }

  function filterRequestEquipment() {
    const search = document.querySelector("[data-request-equipment-search]")?.value || "";
    const client = getEffectiveClientFilter("[data-request-client]");
    const location = document.querySelector("[data-request-location]")?.value || "all";
    const floor = document.querySelector("[data-request-floor]")?.value || "all";
    const type = document.querySelector("[data-request-system-type]")?.value || "all";
    const status = document.querySelector("[data-request-status]")?.value || "all";
    let visibleCount = 0;
    document.querySelectorAll("[data-request-system-id]").forEach((card) => {
      const matchesSearch = matchesPrototypeSearch(card.dataset.systemSearchText || card.textContent, search);
      const matchesClient = client === "all" || card.dataset.clientKey === client;
      const matchesLocation = location === "all" || card.dataset.equipmentLocationKey === location;
      const matchesFloor = floor === "all" || card.dataset.equipmentFloor === floor;
      const matchesType = type === "all" || card.dataset.requestSystemType === type;
      const matchesStatus = status === "all" || card.dataset.requestStatus === status;
      card.hidden = !(matchesSearch && matchesClient && matchesLocation && matchesFloor && matchesType && matchesStatus);
      if (!card.hidden) visibleCount += 1;
    });
    document.querySelectorAll("[data-request-floor-group]").forEach((section) => {
      const visibleCards = Array.from(section.querySelectorAll("[data-request-system-id]")).filter((card) => !card.hidden);
      section.hidden = visibleCards.length === 0;
    });
    const count = document.querySelector(".catalog-count");
    if (count) count.textContent = `${visibleCount} système${visibleCount === 1 ? "" : "s"} disponible${visibleCount === 1 ? "" : "s"}`;
    const empty = document.querySelector("[data-request-catalog-empty]");
    if (empty) empty.hidden = visibleCount > 0;
    document.querySelectorAll("[data-request-status-chip]").forEach((chip) => {
      const selected = status !== "all" && chip.dataset.requestStatusChip === status;
      chip.classList.toggle("is-selected", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
    updateRequestSelectionBar();
  }

  function updateInventoryFloorOptions() {
    const floorSelect = document.querySelector("select[data-inventory-floor]");
    const location = document.querySelector("select[data-inventory-location]")?.value || "all";
    const client = getEffectiveClientFilter("[data-inventory-client]");
    if (!floorSelect) return;
    const previousValue = floorSelect.value;
    const floors = new Map();
    document.querySelectorAll("[data-inventory-floor-section]").forEach((section) => {
      const matchesClient = client === "all" || section.dataset.clientKey === client;
      if (matchesClient && (location === "all" || section.dataset.inventoryLocation === location)) {
        const label = section.querySelector(".equipment-floor-heading strong")?.textContent.trim() || section.dataset.inventoryFloor;
        floors.set(section.dataset.inventoryFloor, label);
      }
    });
    floorSelect.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous les étages";
    floorSelect.appendChild(allOption);
    Array.from(floors.entries()).sort((a, b) => a[1].localeCompare(b[1], "fr", { numeric: true })).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      floorSelect.appendChild(option);
    });
    floorSelect.value = floors.has(previousValue) ? previousValue : "all";
  }

  function updatePlaceInventoryFloorOptions() {
    const floorSelect = document.querySelector("[data-place-inventory-floor]");
    if (!floorSelect) return;
    const previousValue = floorSelect.value;
    const floors = new Map();
    document.querySelectorAll("[data-place-inventory-floor-section]").forEach((section) => {
      const label = section.querySelector(".equipment-floor-heading strong")?.textContent.trim() || section.dataset.placeInventoryFloor;
      floors.set(section.dataset.placeInventoryFloor, label);
    });
    floorSelect.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous les étages";
    floorSelect.appendChild(allOption);
    Array.from(floors.entries()).sort((a, b) => a[1].localeCompare(b[1], "fr", { numeric: true })).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      floorSelect.appendChild(option);
    });
    floorSelect.value = floors.has(previousValue) ? previousValue : "all";
  }

  function filterEquipmentInventory() {
    const search = document.querySelector("[data-inventory-search]")?.value || "";
    const client = getEffectiveClientFilter("[data-inventory-client]");
    const location = document.querySelector("select[data-inventory-location]")?.value || "all";
    const floor = document.querySelector("select[data-inventory-floor]")?.value || "all";
    const systemType = document.querySelector("[data-inventory-system-type]")?.value || "all";
    const inventoryStatus = document.querySelector("[data-inventory-status]")?.value || "all";
    const serviceKind = document.querySelector("[data-inventory-service-kind]")?.value || "all";
    const serviceFrom = document.querySelector("[data-inventory-service-from]")?.value || "";
    const serviceTo = document.querySelector("[data-inventory-service-to]")?.value || "";
    const hasServiceFilter = serviceKind !== "all" || serviceFrom || serviceTo;
    let visibleCount = 0;
    document.querySelectorAll("[data-inventory-apartment]").forEach((card) => {
      const searchableText = card.dataset.inventorySearchText || card.textContent;
      const matchesSearch = matchesPrototypeSearch(searchableText, search);
      const matchesClient = client === "all" || card.dataset.clientKey === client;
      const matchesLocation = location === "all" || card.dataset.inventoryLocation === location;
      const matchesFloor = floor === "all" || card.dataset.inventoryFloor === floor;
      const matchesType = systemType === "all" || (card.dataset.inventorySystemTypes || "").split("|").includes(systemType);
      const matchesStatus = inventoryStatus === "all" || (card.dataset.inventorySystemStatuses || "").split("|").includes(inventoryStatus);
      let serviceEntries = [];
      try { serviceEntries = JSON.parse(card.dataset.inventoryServiceEntries || "[]"); } catch (error) { serviceEntries = []; }
      const matchesService = !hasServiceFilter || serviceEntries.some((entry) => {
        const matchesKind = serviceKind === "all" || entry.kind === serviceKind;
        const matchesFrom = !serviceFrom || entry.date >= serviceFrom;
        const matchesTo = !serviceTo || entry.date <= serviceTo;
        return matchesKind && matchesFrom && matchesTo;
      });
      card.hidden = !(matchesSearch && matchesClient && matchesLocation && matchesFloor && matchesType && matchesStatus && matchesService);
      if (!card.hidden) visibleCount += 1;
    });
    document.querySelectorAll("[data-inventory-floor-section]").forEach((section) => {
      const visibleApartments = Array.from(section.querySelectorAll("[data-inventory-apartment]")).filter((card) => !card.hidden);
      section.hidden = visibleApartments.length === 0;
      const count = section.querySelector("[data-inventory-floor-count]");
      if (count) count.textContent = `${visibleApartments.length} appartement${visibleApartments.length === 1 ? "" : "s"}`;
    });
    document.querySelectorAll("[data-inventory-status-chip]").forEach((chip) => {
      const active = inventoryStatus !== "all" && chip.dataset.inventoryStatusChip === inventoryStatus;
      chip.classList.toggle("is-selected", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    const empty = document.querySelector("[data-equipment-inventory-empty]");
    if (empty) empty.hidden = visibleCount > 0;
    const visibleCards = Array.from(document.querySelectorAll("[data-inventory-apartment]")).filter((card) => !card.hidden);
    const visibleSystemIds = new Set();
    visibleCards.forEach((card) => {
      try { JSON.parse(card.dataset.apartmentSystemIds || "[]").forEach((id) => visibleSystemIds.add(id)); } catch (error) { /* Prototype data remains visible even if a card is incomplete. */ }
    });
    const visibleSystems = Array.from(visibleSystemIds).map((id) => getSystemRecord(id)).filter(Boolean);
    const visibleEquipment = visibleSystems.reduce((total, system) => total + system.components.length, 0);
    const attentionCount = visibleSystems.filter((system) => getSystemInventoryStatus(system) !== "active").length;
    const systemsMetric = document.querySelector("[data-inventory-summary-systems]");
    const equipmentMetric = document.querySelector("[data-inventory-summary-equipment]");
    const attentionMetric = document.querySelector("[data-inventory-summary-attention]");
    const scopeMetric = document.querySelector("[data-inventory-summary-scope]");
    if (systemsMetric) systemsMetric.textContent = visibleSystems.length;
    if (equipmentMetric) equipmentMetric.textContent = visibleEquipment;
    if (attentionMetric) attentionMetric.textContent = attentionCount;
    if (scopeMetric) scopeMetric.textContent = client === "all" ? "Toutes les filiales" : clientScopeData[client]?.name || "Périmètre autorisé";
  }

  function filterPlaceEquipmentInventory() {
    const search = document.querySelector("[data-place-inventory-search]")?.value || "";
    const floor = document.querySelector("[data-place-inventory-floor]")?.value || "all";
    const systemType = document.querySelector("[data-place-inventory-system-type]")?.value || "all";
    const inventoryStatus = document.querySelector("[data-place-inventory-status]")?.value || "all";
    let visibleCount = 0;
    document.querySelectorAll("[data-place-inventory-apartment]").forEach((card) => {
      const searchableText = card.dataset.inventorySearchText || card.textContent;
      const matchesSearch = matchesPrototypeSearch(searchableText, search);
      const matchesFloor = floor === "all" || card.dataset.inventoryFloor === floor;
      const matchesType = systemType === "all" || (card.dataset.inventorySystemTypes || "").split("|").includes(systemType);
      const matchesStatus = inventoryStatus === "all" || (card.dataset.inventorySystemStatuses || "").split("|").includes(inventoryStatus);
      card.hidden = !(matchesSearch && matchesFloor && matchesType && matchesStatus);
      if (!card.hidden) visibleCount += 1;
    });
    document.querySelectorAll("[data-place-inventory-floor-section]").forEach((section) => {
      const visibleApartments = Array.from(section.querySelectorAll("[data-place-inventory-apartment]")).filter((card) => !card.hidden);
      section.hidden = visibleApartments.length === 0;
      const count = section.querySelector("[data-inventory-floor-count]");
      if (count) count.textContent = `${visibleApartments.length} appartement${visibleApartments.length === 1 ? "" : "s"}`;
    });
    document.querySelectorAll("[data-place-inventory-status-chip]").forEach((chip) => {
      const active = inventoryStatus !== "all" && chip.dataset.placeInventoryStatusChip === inventoryStatus;
      chip.classList.toggle("is-selected", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    const empty = document.querySelector("[data-place-inventory-empty]");
    if (empty) empty.hidden = visibleCount > 0;
  }

  function sendClientReply() {
    const input = document.querySelector("[data-reply-input]");
    const thread = document.querySelector("[data-conversation-thread]");
    const message = input.value.trim();
    if (!message) {
      input.focus();
      showToast("Réponse requise", "Écrivez un message avant de l’envoyer.");
      return;
    }

    const item = document.createElement("div");
    item.className = "chat-message internal-message is-new-message";
    item.innerHTML = `<span class="chat-avatar">GF</span><div><header><strong>Gustavo Figueiredo · Équipe Klimfax</strong><time>À l'instant</time></header><p></p></div>`;
    item.querySelector("p").textContent = message;
    thread.appendChild(item);
    input.value = "";
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast("Réponse envoyée", "Le client verra ce message dans son portail KlimaParc.");
  }

  function sendRecommendationReply(trigger) {
    const scope = trigger?.closest("[data-screen-view]") || document;
    const input = scope.querySelector("[data-recommendation-reply]");
    const thread = scope.querySelector("[data-recommendation-thread]");
    if (!input || !thread) return;
    const message = input.value.trim();
    if (!message) {
      input.focus();
      showToast("Message requis", "Écrivez un message avant de l’envoyer.");
      return;
    }

    const isClient = body.dataset.role === "client";
    const item = document.createElement("div");
    item.className = `chat-message ${isClient ? "client-message" : "internal-message"} is-new-message`;
    item.innerHTML = `<span class="chat-avatar">${isClient ? "SM" : "GF"}</span><div><header><strong>${isClient ? "Sophie Martin" : "Gustavo Figueiredo · Équipe Klimfax"}</strong><time>À l'instant</time></header><p></p></div>`;
    item.querySelector("p").textContent = message;
    thread.appendChild(item);
    input.value = "";
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast("Message envoyé", "L’échange est maintenant ajouté au travail.");
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function ceilTo(value, increment) {
    if (value <= 0) return 0;
    return Math.ceil((value - Number.EPSILON) / increment) * increment;
  }

  function normalizeFactor(value, parameters = pricingConfig.general) {
    const candidate = value === "" || value === null || value === undefined ? 1 : toNumber(value, 1);
    return clamp(candidate, parameters.factorMin, parameters.factorMax);
  }

  function calculateVolumeDiscount(quantity, parameters = pricingConfig.general.volume) {
    const safeQuantity = Math.max(0, toNumber(quantity));
    let progress = 0;
    if (safeQuantity >= parameters.maximum) progress = 1;
    else if (safeQuantity > parameters.minimum) progress = (safeQuantity - parameters.minimum) / (parameters.maximum - parameters.minimum);
    return {
      progress,
      rate: clamp(progress * parameters.maximumDiscount, 0, parameters.maximumDiscount)
    };
  }

  function calculateCommission(quantity, manualFactor = 1, parameters = pricingConfig.general) {
    const volume = calculateVolumeDiscount(quantity, parameters.volume);
    const automatic = parameters.commission.maximum - volume.progress * (parameters.commission.maximum - parameters.commission.minimum);
    const factor = normalizeFactor(manualFactor, parameters);
    const final = clamp(automatic * factor, 0, 0.99);
    return { automatic, final, factor, multiplier: final ? 1 / (1 - final) : 1 };
  }

  function calculateTaxes(preTax, parameters = pricingConfig.general) {
    const safePreTax = Math.max(0, toNumber(preTax));
    const tps = roundMoney(safePreTax * parameters.tps);
    const tvq = roundMoney(safePreTax * parameters.tvq);
    return { tps, tvq, total: roundMoney(safePreTax + tps + tvq) };
  }

  function validateMuraleConfiguration(input) {
    const quantity = Math.max(0, toNumber(input.quantity));
    const exterior = [input.muraleBalcony, input.muraleHeight, input.muraleRoof].map((value) => Math.max(0, toNumber(value)));
    const exteriorTotal = exterior.reduce((sum, value) => sum + value, 0);
    const errors = [];
    if (quantity <= 0) errors.push("La quantité de la soumission doit être supérieure à zéro.");
    if (exteriorTotal !== quantity) errors.push(`La répartition extérieure totalise ${exteriorTotal} unité${exteriorTotal > 1 ? "s" : ""}; ${quantity} sont attendues.`);
    if (Math.max(0, toNumber(input.muraleStair)) > quantity) errors.push("La quantité intérieure en hauteur ne peut pas dépasser la quantité de la soumission.");
    return { valid: errors.length === 0, errors, exteriorTotal, quantity };
  }

  function validateMonoblocConfiguration(input) {
    const quantity = Math.max(0, toNumber(input.quantity));
    const classes = [input.class1, input.class2, input.class3, input.class4, input.class5].map((value) => Math.max(0, toNumber(value)));
    const classTotal = classes.reduce((sum, value) => sum + value, 0);
    const errors = [];
    if (quantity <= 0) errors.push("La quantité de la soumission doit être supérieure à zéro.");
    if (classTotal !== quantity) errors.push(`Les classes totalisent ${classTotal} unité${classTotal > 1 ? "s" : ""}; ${quantity} sont attendues.`);
    return { valid: errors.length === 0, errors, classTotal, classes, quantity };
  }

  function calculateCommercialScenarios(baseCost, attendanceEligibleBase, input, parameters = pricingConfig.general) {
    const quantity = Math.max(0, toNumber(input.quantity));
    const factor = normalizeFactor(input.factor, parameters);
    const volume = calculateVolumeDiscount(quantity, parameters.volume);
    const commission = calculateCommission(quantity, factor, parameters);
    const baseAfterVolume = Math.max(0, baseCost * (1 - volume.rate));
    const eligibleQuantity = clamp(toNumber(input.attendanceQuantity), 0, quantity);
    const attendancePotential = quantity > 0
      ? (attendanceEligibleBase / quantity) * eligibleQuantity * (1 - volume.rate) * parameters.attendanceDiscount
      : 0;
    const bases = {
      standard: baseAfterVolume,
      attendance: Math.max(0, baseAfterVolume - attendancePotential),
      loyalty: Math.max(0, baseAfterVolume * (1 - parameters.loyaltyDiscount)),
      combined: Math.max(0, (baseAfterVolume - attendancePotential) * (1 - parameters.loyaltyDiscount))
    };
    const scenarios = {};
    Object.entries(bases).forEach(([key, base]) => {
      const adjustedBase = base * factor;
      const preTax = adjustedBase / (1 - commission.final);
      scenarios[key] = {
        base,
        adjustedBase,
        preTax,
        unitPrice: quantity ? preTax / quantity : 0,
        commissionAmount: preTax - adjustedBase
      };
    });
    const selectedScenario = input.loyalty && input.attendance ? "combined" : input.loyalty ? "loyalty" : input.attendance ? "attendance" : "standard";
    const selected = scenarios[selectedScenario];
    return {
      volume,
      commission,
      factor,
      baseAfterVolume,
      volumeSavings: Math.max(0, baseCost - baseAfterVolume),
      attendancePotential,
      eligibleQuantity,
      scenarios,
      selectedScenario,
      selected,
      taxes: calculateTaxes(selected.preTax, parameters),
      savings: Math.max(0, scenarios.standard.preTax - selected.preTax)
    };
  }

  function calculateMuraleQuote(input, parameters = pricingConfig) {
    const general = parameters.general;
    const config = parameters.murale;
    const quantity = Math.max(0, toNumber(input.quantity));
    const validation = validateMuraleConfiguration(input);
    const zoneValid = Object.prototype.hasOwnProperty.call(config.travel, input.zone);
    const balcony = clamp(toNumber(input.muraleBalcony), 0, quantity);
    const height = clamp(toNumber(input.muraleHeight), 0, quantity);
    const roof = clamp(toNumber(input.muraleRoof), 0, quantity);
    const stair = clamp(toNumber(input.muraleStair), 0, quantity);
    const locationMinutes = balcony * config.times.balcony + height * config.times.height + roof * config.times.roof + stair * config.times.stair;
    const extraMinutes = Math.max(0, toNumber(input.extraMinutes));
    const costPerMinute = config.hourlyRate / 60;
    const exteriorAvailable = balcony + height + roof > 0;

    function calculatePlan(level, plan, coiljetMode, condenserRequested, pressureRequested) {
      const validPlan = ["inspection", "entretien"].includes(plan);
      if (!validPlan || quantity <= 0 || !zoneValid) return null;
      const coiljetFactor = coiljetMode === "all" ? 1 : coiljetMode === "needed" ? general.asNeededFactor : 0;
      const condenser = exteriorAvailable && Boolean(condenserRequested);
      const pressure = exteriorAvailable && Boolean(pressureRequested);
      const baseTimePerUnit = config.times.inspection + (plan === "entretien" ? config.times.entretien : 0);
      const coiljetTimePerUnit = config.times.coiljet * coiljetFactor;
      const coiljetProductPerUnit = config.products.coiljet * coiljetFactor;
      const baseMinutes = baseTimePerUnit * quantity;
      const coiljetMinutes = coiljetTimePerUnit * quantity;
      const condenserMinutes = condenser ? config.times.condenser * quantity : 0;
      const pressureMinutes = pressure ? config.times.pressure * quantity : 0;
      const operationalMinutes = baseMinutes + coiljetMinutes + condenserMinutes + pressureMinutes + locationMinutes + extraMinutes * quantity;
      const adminMinutes = config.times.admin * quantity;
      const hours = operationalMinutes / 60;
      const realDays = hours / general.productiveHoursPerDay;
      const plannedDays = ceilTo(realDays, 0.25);
      const trips = plannedDays ? Math.max(1, ceilTo(plannedDays, 0.5)) : 0;
      const travelCost = trips * config.travel[input.zone];
      const labourCost = (operationalMinutes + adminMinutes) * costPerMinute;
      const baseProductPerUnit = config.products.inspection + (plan === "entretien" ? config.products.entretien : 0);
      const productCost = quantity * (baseProductPerUnit + coiljetProductPerUnit + (condenser ? config.products.condenser : 0) + (pressure ? config.products.pressure : 0));
      const klimparcCost = general.klimparcCostPerUnit * quantity;
      const baseCost = labourCost + productCost + klimparcCost + travelCost;
      const attendanceEligibleUnit = coiljetTimePerUnit * costPerMinute + coiljetProductPerUnit + (condenser ? config.times.condenser * costPerMinute + config.products.condenser : 0);
      const commercial = calculateCommercialScenarios(baseCost, attendanceEligibleUnit * quantity, input, general);
      return {
        level,
        plan,
        valid: true,
        coiljetFactor,
        hours,
        realDays,
        plannedDays,
        trips,
        labourCost,
        productCost,
        klimparcCost,
        travelCost,
        baseCost,
        attendanceEligibleBase: attendanceEligibleUnit * quantity,
        minimumReference: config.minimumQuantities[plan],
        commercial
      };
    }

    return {
      type: "murale",
      validation,
      zoneValid,
      klimparcEligible: quantity >= general.klimparcThreshold,
      klimparcCostApplied: general.klimparcCostPerUnit * quantity,
      essential: calculatePlan("essential", input.essentialPlan, input.essentialCoiljet, input.essentialCondenser, input.essentialPressure),
      superior: calculatePlan("superior", input.superiorPlan, input.superiorCoiljet, input.superiorCondenser, input.superiorPressure)
    };
  }

  function calculateMonoblocQuote(input, parameters = pricingConfig) {
    const general = parameters.general;
    const config = parameters.monobloc;
    const validation = validateMonoblocConfiguration(input);
    const quantity = validation.quantity;
    const classes = validation.classes;
    const zoneValid = Object.prototype.hasOwnProperty.call(config.travel, input.zone);
    const extraMinutes = Math.max(0, toNumber(input.extraMinutes));

    function calculatePlan(level, plan, coiljetMode, removeMachineRequested) {
      const allowedPlans = level === "essential" ? ["inspection", "confort"] : ["inspection", "confort", "premium"];
      if (!allowedPlans.includes(plan) || !validation.valid || !zoneValid) return null;
      let coiljetFactor = coiljetMode === "all" ? 1 : coiljetMode === "needed" ? general.asNeededFactor : 0;
      if (level === "superior" && plan === "premium" && coiljetFactor === 0) coiljetFactor = 1;
      let classMinutes = 0;
      let classProducts = 0;
      let separateCoiljetMinutes = 0;
      let separateCoiljetProducts = 0;
      classes.forEach((classQuantity, index) => {
        const times = config.classTimes[index];
        let minutesPerUnit = times.inspection;
        let productsPerUnit = config.products.inspection;
        if (plan === "confort" || plan === "premium") {
          minutesPerUnit += times.comfort;
          productsPerUnit += config.products.comfort;
        }
        if (plan === "premium") {
          minutesPerUnit += times.premium * coiljetFactor;
          productsPerUnit += config.products.premium * coiljetFactor;
        } else if (coiljetFactor > 0) {
          separateCoiljetMinutes += classQuantity * times.premium * coiljetFactor;
          separateCoiljetProducts += classQuantity * config.products.premium * coiljetFactor;
        }
        classMinutes += classQuantity * minutesPerUnit;
        classProducts += classQuantity * productsPerUnit;
      });
      const removeMachineMinutes = plan === "inspection" && removeMachineRequested ? config.times.removeMachine * quantity : 0;
      const operationalMinutes = classMinutes + separateCoiljetMinutes + extraMinutes * quantity + removeMachineMinutes + config.times.klimparc * quantity;
      const adminMinutes = config.times.admin * quantity;
      const hours = operationalMinutes / 60;
      const realDays = hours / general.productiveHoursPerDay;
      const capacityDays = coiljetFactor > 0
        ? Math.max(...classes.map((classQuantity, index) => Math.ceil((classQuantity * coiljetFactor) / config.premiumDailyCapacity[index])))
        : 0;
      const plannedDays = Math.max(ceilTo(realDays, 0.25), capacityDays);
      const trips = plannedDays ? Math.max(1, ceilTo(plannedDays, 0.5)) : 0;
      const inspectionPlan = plan === "inspection";
      const rateKey = inspectionPlan ? "oneTechnician" : "twoTechnicians";
      const hourlyRate = config.hourlyRates[rateKey];
      const travelCost = trips * config.travel[input.zone][rateKey];
      const labourCost = ((operationalMinutes + adminMinutes) / 60) * hourlyRate;
      const klimparcCost = general.klimparcCostPerUnit * quantity;
      const productCost = classProducts + separateCoiljetProducts + klimparcCost;
      const baseCost = labourCost + productCost + travelCost;
      const attendanceEligibleBase = ((level === "essential" && plan === "confort") || (level === "superior" && ["confort", "premium"].includes(plan))) && coiljetFactor > 0
        ? coiljetFactor * classes.reduce((sum, classQuantity, index) => sum + classQuantity * (config.classTimes[index].premium / 60 * config.hourlyRates.twoTechnicians + config.products.premium), 0)
        : 0;
      const commercial = calculateCommercialScenarios(baseCost, attendanceEligibleBase, input, general);
      return {
        level,
        plan,
        valid: true,
        coiljetFactor,
        hours,
        realDays,
        capacityDays,
        plannedDays,
        trips,
        hourlyRate,
        labourCost,
        productCost,
        klimparcCost,
        travelCost,
        baseCost,
        attendanceEligibleBase,
        minimumReference: inspectionPlan ? config.minimumQuantities.inspection : config.minimumQuantities.entretien,
        commercial
      };
    }

    return {
      type: "monobloc",
      validation,
      zoneValid,
      klimparcEligible: quantity >= general.klimparcThreshold,
      klimparcCostApplied: general.klimparcCostPerUnit * quantity,
      essential: calculatePlan("essential", input.essentialPlan, input.essentialCoiljet, input.essentialRemoveMachine),
      superior: calculatePlan("superior", input.superiorPlan, input.superiorCoiljet, input.superiorRemoveMachine)
    };
  }

  const quoteTerms = Object.freeze([
    ["1. Description du Service", "Klimfax s’engage à fournir des services d’inspection et de nettoyage des appareils de climatisation et de chauffage. Les services inclus sont définis en fonction du plan choisi par le client, ainsi que les options supplémentaires."],
    ["2. Garantie des Services", "2.1 Les services exécutés sont garantis pour une période de 90 jours suivant leur réalisation.", "2.2 Cette garantie couvre uniquement les défauts directement attribuables aux travaux effectués par Klimfax.", "2.3 L’entretien ne constitue pas une garantie de fonctionnement, mais vise à prévenir les bris et à vérifier le bon état des appareils."],
    ["3. Engagement et responsabilités du client", "3.1 Le client doit garantir l’accès aux appareils à inspecter ou nettoyer et désigner un représentant unique pour coordonner les services avec Klimfax.", "3.1.1 Le représentant doit gérer les demandes de suivi en consolidant les informations avant leur transmission à Klimfax.", "3.2 Une personne ressource doit être désignée pour accompagner l’exécution des services sur place.", "3.3 Toute préparation préalable nécessaire (exemple : Libération des espaces où les services seront exécutés) relève de la responsabilité du client.", "3.4 Le client est responsable d’informer le technicien de tout défaut préexistant sur l’équipement avant l’exécution du service."],
    ["4. Modalités de Paiement", "4.1 Dans le cas d’une facture unique pour tous les services fournis à plusieurs unités au sein d’un même bâtiment, le représentant sera responsable de gérer le paiement de la facture.", "4.1.1 Les paiements doivent être effectués dans un délai de 15 jours suivant l’envoi de la facture.", "4.1.2 Un dépôt de 15% est requis pour les projets impliquant 30 unités ou plus.", "4.2 Dans le cas où la facturation des services est effectuée de façon individuelle, le paiement devra être fait à la fin de la visite, directement auprès du technicien, par chèque, carte de débit ou crédit (Visa ou Mastercard).", "4.3 Des frais administratifs de 24 % par année (2 % par mois) seront appliqués sur tout montant impayé.", "4.4 L’existence de demandes de suivi ou d’une visite supplémentaire ne suspend en aucun cas l’obligation de payer la totalité de la facture."],
    ["5. Temps de Déplacement", "5.1 Les allées et venues du personnel sont à la charge du client."],
    ["6. Modification et Résiliation", "6.1 Toute modification des services prévus peut entraîner des frais supplémentaires.", "6.2 En cas de résiliation après le début des travaux, le client devra payer les services rendus jusqu’à ce moment."],
    ["7. Exclusions", "7.1 Les travaux de diagnostic pour identifier les problèmes techniques ou les pannes des appareils, ainsi que les réparations ou les remplacements de pièces, ne font pas partie des services fournis.", "7.2 Le plan d’inspection n’inclut aucun entretien ; la vérification de l’écoulement d’eau du drain ne constitue pas un entretien ni un nettoyage de celui-ci.", "7.3 Les prix offerts pour le remplacement d'unités sont valables uniquement dans des conditions d'installation standard. Ils n'incluent pas le remplacement des lignes frigorifiques, du câblage électrique, du thermostat, ni le déplacement des unités. Des frais supplémentaires peuvent être facturés si des modifications à l'installation sont requises."],
    ["8. Consentement à la Signature Électronique", "En signant électroniquement ce document, les signataires confirment leur consentement à l’utilisation de la signature électronique, conformément aux lois applicables en matière de technologies de l’information dans la province de Québec."],
    ["9. Condition de Début des Travaux", "Les travaux ne commenceront qu’après la réception du contrat dûment signé par toutes les parties concernées."]
  ]);

  function getQuoteInput() {
    return {
      ...quoteState,
      quantity: Math.max(0, toNumber(quoteState.quantity)),
      parkQuantity: Math.max(0, toNumber(quoteState.parkQuantity)),
      extraMinutes: Math.max(0, toNumber(quoteState.extraMinutes)),
      attendanceQuantity: clamp(toNumber(quoteState.attendanceQuantity), 0, Math.max(0, toNumber(quoteState.quantity))),
      factor: normalizeFactor(quoteState.factor),
      essentialPlan: quoteState.type === "murale" ? quoteState.essentialPlanMurale : quoteState.essentialPlan,
      superiorPlan: quoteState.type === "murale" ? quoteState.superiorPlanMurale : quoteState.superiorPlan,
      essentialCoiljet: quoteState.type === "murale" ? quoteState.essentialCoiljetMurale : quoteState.essentialCoiljet,
      superiorCoiljet: quoteState.type === "murale" ? quoteState.superiorCoiljetMurale : quoteState.superiorCoiljet
    };
  }

  function calculateCurrentQuote() {
    const input = getQuoteInput();
    return input.type === "murale" ? calculateMuraleQuote(input) : calculateMonoblocQuote(input);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  }

  function formatMoney(value) {
    return currencyFormatter.format(toNumber(value));
  }

  function formatDecimal(value, digits = 2) {
    return new Intl.NumberFormat("fr-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(toNumber(value));
  }

  function getPlanLabel(result) {
    if (!result) return "Non proposé";
    const labels = { inspection: "Inspection", entretien: "Entretien", confort: "Entretien Confort", premium: "Entretien Premium" };
    return labels[result.plan] || result.plan;
  }

  function loadQuoteClient(clientId) {
    const client = quoteClients[clientId];
    if (!client) return;
    quoteState.clientName = client.name;
    quoteState.clientContact = client.contact;
    quoteState.clientAddress = client.address;
    quoteState.clientPhone = client.phone;
    quoteState.clientEmail = client.email;
    quoteState.parkQuantity = client.parkQuantity;
  }

  function applyQuoteBusinessRules(changedField) {
    quoteState.quantity = Math.max(0, toNumber(quoteState.quantity));
    quoteState.parkQuantity = Math.max(0, toNumber(quoteState.parkQuantity));
    quoteState.extraMinutes = Math.max(0, toNumber(quoteState.extraMinutes));
    quoteState.factor = normalizeFactor(quoteState.factor);
    quoteState.attendanceQuantity = clamp(toNumber(quoteState.attendanceQuantity), 0, quoteState.quantity);
    ["class1", "class2", "class3", "class4", "class5", "muraleBalcony", "muraleHeight", "muraleRoof", "muraleStair"].forEach((field) => { quoteState[field] = Math.max(0, toNumber(quoteState[field])); });
    if (changedField === "clientMode") {
      if (quoteState.clientMode === "new") {
        quoteState.clientName = "";
        quoteState.clientContact = "";
        quoteState.clientAddress = "";
        quoteState.clientPhone = "";
        quoteState.clientEmail = "";
        quoteState.parkQuantity = 0;
      } else {
        loadQuoteClient(quoteState.clientId);
      }
    }
    if (changedField === "clientId" && quoteState.clientMode === "existing") loadQuoteClient(quoteState.clientId);
    if (changedField === "type" && quoteState.type === "murale") {
      const exteriorTotal = quoteState.muraleBalcony + quoteState.muraleHeight + quoteState.muraleRoof;
      if (!exteriorTotal) quoteState.muraleBalcony = quoteState.quantity;
    }
    if (changedField === "quantity" && quoteState.type === "murale") {
      const exteriorTotal = quoteState.muraleBalcony + quoteState.muraleHeight + quoteState.muraleRoof;
      if (exteriorTotal === 0 || exteriorTotal === quoteState.quantity) quoteState.muraleBalcony = quoteState.quantity;
    }
    if (changedField === "essentialPlan") {
      quoteState.essentialRemoveMachine = quoteState.essentialPlan === "confort";
    }
    if (changedField === "superiorPlan") {
      quoteState.superiorRemoveMachine = ["confort", "premium"].includes(quoteState.superiorPlan);
      if (quoteState.superiorPlan === "premium" && !quoteState.superiorCoiljet) quoteState.superiorCoiljet = "all";
      if (quoteState.superiorPlan === "inspection") quoteState.superiorCoiljet = "";
    }
    if (changedField === "superiorCoiljet" && quoteState.superiorPlan === "premium" && !quoteState.superiorCoiljet) quoteState.superiorCoiljet = "all";
    if (changedField === "superiorPlanMurale") quoteState.superiorCoiljetMurale = quoteState.superiorPlanMurale === "entretien" ? "all" : "";
    if (changedField === "superiorCoiljetMurale" && quoteState.superiorPlanMurale === "entretien" && !quoteState.superiorCoiljetMurale) quoteState.superiorCoiljetMurale = "all";
    const exteriorQuantity = quoteState.muraleBalcony + quoteState.muraleHeight + quoteState.muraleRoof;
    if (!exteriorQuantity) {
      quoteState.essentialPressure = false;
      quoteState.essentialCondenser = false;
      quoteState.superiorPressure = false;
      quoteState.superiorCondenser = false;
    }
  }

  function syncQuoteControls() {
    document.querySelectorAll("[data-quote-field]").forEach((field) => {
      const key = field.dataset.quoteField;
      const value = quoteState[key];
      if (field.type === "radio") field.checked = field.value === value;
      else if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    });
    document.querySelectorAll("[data-quote-coiljet-checkbox]").forEach((field) => {
      const key = `${field.dataset.quoteCoiljetCheckbox}CoiljetMurale`;
      field.checked = quoteState[key] === field.value;
    });
    const client = quoteClients[quoteState.clientId];
    document.querySelectorAll("[data-quote-client-field]").forEach((field) => {
      const value = client?.[field.dataset.quoteClientField] || "";
      if ("value" in field) field.value = value;
      else field.textContent = value;
    });
  }

  function renderQuoteValidation(result) {
    ["murale", "monobloc"].forEach((type) => {
      const target = document.querySelector(`[data-quote-validation="${type}"]`);
      if (!target) return;
      const validation = type === result.type ? result.validation : type === "murale" ? validateMuraleConfiguration(getQuoteInput()) : validateMonoblocConfiguration(getQuoteInput());
      const total = type === "murale" ? validation.exteriorTotal : validation.classTotal;
      const count = document.querySelector(`[data-quote-distribution-total="${type}"]`);
      if (count) {
        count.textContent = `${total} / ${validation.quantity} unité${validation.quantity > 1 ? "s" : ""}${type === "murale" ? " extérieures" : ""}`;
        count.classList.toggle("is-valid", validation.valid);
        count.classList.toggle("is-error", !validation.valid);
      }
      target.hidden = validation.valid;
      target.classList.toggle("is-valid", validation.valid);
      target.classList.toggle("is-error", !validation.valid);
      target.innerHTML = validation.valid
        ? ""
        : `<svg class="ui-icon"><use href="#icon-alert"></use></svg><span>${escapeHtml(validation.errors.join(" "))}</span>`;
    });
  }

  function inclusionItems(type, level, plan) {
    if (!plan) return [];
    if (type === "murale") {
      if (plan === "inspection") return ["Prise de température", "Nettoyage du filtre"];
      return ["Inspection de base", "Nettoyage de la façade", "Nettoyant à serpentin autorinçant", "Nettoyage du drain de condensation"];
    }
    const inspection = ["Prise de température", "Nettoyage du filtre", "Vérification visuelle de l’appareil", "Contrôle du thermostat"];
    if (plan === "inspection") return inspection;
    const comfort = [...inspection, "Retrait de l’appareil du caisson", "Nettoyage du caisson", "Nettoyage de l’évaporateur", "Nettoyage du condenseur", "Nettoyage du bac de récupération", "Contrôle des branchements électriques"];
    if (plan === "confort") return comfort;
    return [...comfort, "Germicide biodégradable", "Nettoyage du drain", "Ventilateurs et hélices", "CoilJet obligatoire"];
  }

  function selectedPlanOptions(level, plan) {
    const prefix = level === "essential" ? "essential" : "superior";
    const items = [];
    if (quoteState.type === "murale") {
      const coiljetMode = quoteState[`${prefix}CoiljetMurale`];
      if (coiljetMode === "all") items.push("Unité intérieure — nettoyage à pression d’eau sur toutes les unités");
      if (coiljetMode === "needed") items.push("Unité intérieure — nettoyage à pression d’eau au besoin (facteur 75 %)");
      if (quoteState[`${prefix}Pressure`]) items.push("Unité extérieure — vérification des pressions");
      if (quoteState[`${prefix}Condenser`]) items.push("Unité extérieure — nettoyage du condenseur");
      return items;
    }
    if (plan === "inspection" && quoteState[`${prefix}RemoveMachine`]) items.push("Option — retrait de l’appareil de son caisson");
    const coiljetMode = quoteState[`${prefix}Coiljet`];
    if (coiljetMode === "all") items.push("Option — CoilJet sur toutes les unités");
    if (coiljetMode === "needed") items.push("Option — CoilJet au besoin (facteur 75 %)");
    return items;
  }

  function renderQuotePlanRules() {
    document.querySelectorAll("[data-quote-plan-panel]").forEach((panel) => { panel.hidden = panel.dataset.quotePlanPanel !== quoteState.type; });
    const activePanel = document.querySelector(`[data-quote-plan-panel="${quoteState.type}"]`);
    if (!activePanel) return;
    const essentialPlan = quoteState.type === "murale" ? quoteState.essentialPlanMurale : quoteState.essentialPlan;
    const superiorPlan = quoteState.type === "murale" ? quoteState.superiorPlanMurale : quoteState.superiorPlan;
    const planByLevel = { essential: essentialPlan, superior: superiorPlan };
    activePanel.querySelectorAll("[data-quote-inclusions]").forEach((container) => {
      const level = container.dataset.quoteInclusions;
      const items = inclusionItems(quoteState.type, level, planByLevel[level]);
      container.innerHTML = items.length
        ? items.map((item) => `<span><svg class="ui-icon"><use href="#icon-check"></use></svg>${escapeHtml(item)}</span>`).join("")
        : "<small>Sélectionnez un service pour afficher les inclusions.</small>";
      const count = activePanel.querySelector(`[data-quote-inclusion-count="${level}"]`);
      if (count) count.textContent = `${items.length} inclusion${items.length > 1 ? "s" : ""}`;
    });

    const toggleAutomaticOption = (level, option, automatic) => {
      const control = activePanel.querySelector(`[data-${option}-control="${level}"]`);
      const automaticMessage = activePanel.querySelector(`[data-auto-${option}="${level}"]`);
      if (control) control.hidden = automatic;
      if (automaticMessage) automaticMessage.hidden = !automatic;
    };

    if (quoteState.type === "monobloc") {
      ["essential", "superior"].forEach((level) => {
        const plan = planByLevel[level];
        const manualRemove = activePanel.querySelector(`[data-manual-remove="${level}"]`);
        const automaticRemove = activePanel.querySelector(`[data-auto-remove="${level}"]`);
        const removeIsAutomatic = Boolean(plan && plan !== "inspection");
        if (manualRemove) {
          manualRemove.hidden = removeIsAutomatic;
          manualRemove.querySelector("input").disabled = removeIsAutomatic;
        }
        if (automaticRemove) automaticRemove.hidden = !removeIsAutomatic;
      });
      toggleAutomaticOption("essential", "coiljet", false);
      toggleAutomaticOption("superior", "coiljet", quoteState.superiorPlan === "premium");
    } else {
      toggleAutomaticOption("essential", "coiljet", false);
      toggleAutomaticOption("superior", "coiljet", false);
      const exteriorAvailable = quoteState.muraleBalcony + quoteState.muraleHeight + quoteState.muraleRoof > 0;
      activePanel.querySelectorAll('[data-quote-field$="Pressure"], [data-quote-field$="Condenser"]').forEach((option) => {
        option.disabled = !exteriorAvailable;
        option.closest("label").title = exteriorAvailable ? "" : "Sélectionnez d’abord une localisation extérieure.";
      });
    }
  }

  function renderQuoteResultPlan(result, title) {
    if (!result) return `<article class="quote-result-card is-empty"><span class="eyebrow">${title}</span><h3>Non proposé</h3><p>Sélectionnez un service pour afficher son prix.</p></article>`;
    const commercial = result.commercial;
    const scenarioLabels = { standard: "Standard", loyalty: "Fidélité", attendance: "Assiduité", combined: "Fidélité + assiduité" };
    return `<article class="quote-result-card ${result.level === "superior" ? "featured" : ""}">
      <header><div><span class="eyebrow">${title}</span><h3>${escapeHtml(getPlanLabel(result))}</h3></div><span class="result-scenario">${scenarioLabels[commercial.selectedScenario]}</span></header>
      <div class="result-unit-price"><strong>${formatMoney(commercial.selected.unitPrice)}</strong><span>/ unité</span></div>
      <div class="result-pretax"><span>Avant taxes</span><strong>${formatMoney(commercial.selected.preTax)}</strong></div>
      <dl class="result-taxes"><div><dt>TPS</dt><dd>${formatMoney(commercial.taxes.tps)}</dd></div><div><dt>TVQ</dt><dd>${formatMoney(commercial.taxes.tvq)}</dd></div><div class="total"><dt>Total TTC</dt><dd>${formatMoney(commercial.taxes.total)}</dd></div></dl>
      <div class="result-duration"><span><svg class="ui-icon"><use href="#icon-calendar"></use></svg>${formatDecimal(result.hours)} h</span><span>${formatDecimal(result.plannedDays)} jours</span></div>
      <details class="price-scenarios"><summary>Voir les scénarios de prix <svg class="ui-icon"><use href="#icon-chevron-down"></use></svg></summary><table><thead><tr><th>Scénario</th><th>Prix/unité</th><th>Avant taxes</th></tr></thead><tbody>${Object.entries(commercial.scenarios).map(([key, scenario]) => `<tr class="${commercial.selectedScenario === key ? "is-selected" : ""}"><td>${scenarioLabels[key]}</td><td>${formatMoney(scenario.unitPrice)}</td><td>${formatMoney(scenario.preTax)}</td></tr>`).join("")}</tbody></table></details>
    </article>`;
  }

  function renderQuoteResults(result) {
    const target = document.querySelector("[data-quote-results]");
    const internal = document.querySelector("[data-quote-internal-results]");
    const status = document.querySelector("[data-quote-calculation-status]");
    if (!target || !internal) return;
    if (!result.validation.valid) {
      if (status) {
        status.className = "quote-calculation-status is-waiting";
        status.innerHTML = `<svg class="ui-icon"><use href="#icon-alert"></use></svg><span><strong>Calcul en attente</strong><small>Corrigez la répartition des unités.</small></span>`;
      }
      target.innerHTML = `<div class="quote-blocking-error"><svg class="ui-icon"><use href="#icon-alert"></use></svg><div><strong>Résultats indisponibles</strong><p>${escapeHtml(result.validation.errors.join(" "))}</p></div></div>`;
      internal.innerHTML = "";
      return;
    }
    if (status) {
      status.className = "quote-calculation-status is-ready";
      status.innerHTML = `<svg class="ui-icon"><use href="#icon-check"></use></svg><span><strong>Calcul à jour</strong><small>${result.validation.quantity}/${result.validation.quantity} unités réparties.</small></span>`;
    }
    target.innerHTML = renderQuoteResultPlan(result.essential, "Plan Essentiel") + renderQuoteResultPlan(result.superior, "Plan Supérieur");
    internal.innerHTML = [result.essential, result.superior].filter(Boolean).map((plan) => `<article><span>${plan.level === "essential" ? "Essentiel" : "Supérieur"}</span><strong>${formatDecimal(plan.commercial.commission.final * 100)} %</strong><small>Commission : ${formatMoney(plan.commercial.selected.commissionAmount)}</small><small>Facteur : ${formatDecimal(plan.commercial.factor)}</small><small>Coût de base : ${formatMoney(plan.baseCost)}</small><small>Économie volume : ${formatMoney(plan.commercial.volumeSavings)}</small></article>`).join("");
  }

  function renderQuotePreview(result) {
    const target = document.querySelector("[data-quote-preview]");
    if (!target) return;
    const client = {
      name: quoteState.clientName || "Nouveau client",
      contact: quoteState.clientContact,
      address: quoteState.clientAddress,
      phone: quoteState.clientPhone,
      email: quoteState.clientEmail
    };
    const plans = [result.essential, result.superior].filter(Boolean);
    const machineSection = quoteState.machineSaleEnabled ? `<section class="preview-machine-sale"><h3>Vente de machines</h3>${[1, 2].map((index) => quoteState[`machine${index}Name`] ? `<article><strong>${escapeHtml(quoteState[`machine${index}Name`])}</strong><p>${escapeHtml(quoteState[`machine${index}Description`])}</p><span>1 unité : ${formatMoney(quoteState[`machine${index}Price1`])} · 2–9 : ${formatMoney(quoteState[`machine${index}Price2`])} · 10+ : ${formatMoney(quoteState[`machine${index}Price10`])}</span><small>Subvention : ${formatMoney(quoteState[`machine${index}Grant`])}</small></article>` : "").join("")}<p>Garantie main-d’œuvre : ${escapeHtml(quoteState.machineLaborWarranty)} · Garantie pièces : ${escapeHtml(quoteState.machinePartsWarranty)}</p></section>` : "";
    target.innerHTML = `<header class="preview-quote-header"><div><span class="preview-brand">KlimaParc</span><small>Une solution Klimfax</small></div><div><span>Soumission</span><strong>SO-2026-032</strong><small>23 août 2026</small></div></header><section class="preview-client-block"><div><span class="eyebrow">Préparée pour</span><h3>${escapeHtml(client.name)}</h3><p>${escapeHtml(client.contact)}<br>${escapeHtml(client.address)}<br>${escapeHtml(client.email)} · ${escapeHtml(client.phone)}</p></div><div><span class="eyebrow">Projet</span><h3>${quoteState.type === "murale" ? "Unités murales" : "Unités Monobloc"}</h3><p>${quoteState.quantity} unités · ${escapeHtml(quoteState.zone)}<br>Conseiller : Patrick Synnette</p></div></section><section class="preview-plan-grid">${plans.length ? plans.map((plan) => `<article class="${plan.level === "superior" ? "featured" : ""}"><span class="eyebrow">Plan ${plan.level === "essential" ? "Essentiel" : "Supérieur"}</span><h3>${escapeHtml(getPlanLabel(plan))}</h3><div class="preview-inclusions">${[...inclusionItems(quoteState.type, plan.level, plan.plan), ...selectedPlanOptions(plan.level, plan.plan)].map((item) => `<span><svg class="ui-icon"><use href="#icon-check"></use></svg>${escapeHtml(item)}</span>`).join("")}</div><dl><div><dt>Prix unitaire</dt><dd>${formatMoney(plan.commercial.selected.unitPrice)}</dd></div><div><dt>Sous-total</dt><dd>${formatMoney(plan.commercial.selected.preTax)}</dd></div>${plan.commercial.savings ? `<div><dt>Économies</dt><dd>− ${formatMoney(plan.commercial.savings)}</dd></div>` : ""}<div><dt>TPS</dt><dd>${formatMoney(plan.commercial.taxes.tps)}</dd></div><div><dt>TVQ</dt><dd>${formatMoney(plan.commercial.taxes.tvq)}</dd></div><div class="total"><dt>Total TTC</dt><dd>${formatMoney(plan.commercial.taxes.total)}</dd></div></dl></article>`).join("") : '<p class="preview-empty">Aucun plan valide n’a encore été configuré.</p>'}</section>${machineSection}<section class="preview-validity"><svg class="ui-icon"><use href="#icon-calendar"></use></svg><div><strong>Proposition valide 30 jours</strong><span>Les prix de services incluent le déplacement selon la zone sélectionnée.</span></div></section><section class="preview-terms-page"><header><span>Termes et conditions</span><small>Annexe à la soumission SO-2026-032</small></header>${quoteTerms.map((section) => `<article><h4>${escapeHtml(section[0])}</h4>${section.slice(1).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</article>`).join("")}</section>`;
  }

  function renderQuoteBuilder() {
    const input = getQuoteInput();
    const result = calculateCurrentQuote();
    document.querySelectorAll("[data-quote-type-panel]").forEach((panel) => { panel.hidden = panel.dataset.quoteTypePanel !== quoteState.type; });
    renderQuoteValidation(result);
    renderQuotePlanRules();
    renderQuoteResults(result);
    renderQuotePreview(result);
    const headerClient = document.querySelector("[data-quote-header-client]");
    if (headerClient) headerClient.textContent = quoteState.clientName || "Nouveau client";
    const existingPicker = document.querySelector("[data-existing-client-picker]");
    const newClientNote = document.querySelector("[data-new-client-note]");
    if (existingPicker) existingPicker.hidden = quoteState.clientMode !== "existing";
    if (newClientNote) newClientNote.hidden = quoteState.clientMode !== "new";
    const klimaText = document.querySelector("[data-quote-klimaparc-text]");
    const klimaPanel = document.querySelector("[data-quote-klimaparc]");
    if (klimaText && klimaPanel) {
      klimaText.textContent = result.klimparcEligible ? "KlimaParc admissible" : "Seuil de 50 unités non atteint";
      klimaPanel.classList.toggle("is-eligible", result.klimparcEligible);
      klimaPanel.classList.toggle("is-ineligible", !result.klimparcEligible);
      klimaPanel.querySelector("em").textContent = result.klimparcEligible ? "✓" : `${pricingConfig.general.klimparcThreshold - input.quantity} manquantes`;
    }
    const discountLabels = [];
    if (quoteState.loyalty) discountLabels.push("fidélité");
    if (quoteState.attendance) discountLabels.push("assiduité");
    const conditionSummary = document.querySelector("[data-quote-condition-summary]");
    if (conditionSummary) conditionSummary.textContent = `Rabais : ${discountLabels.join(" + ") || "aucun"}`;
    const machineSummary = document.querySelector("[data-machine-sale-summary]");
    if (machineSummary) machineSummary.textContent = quoteState.machineSaleEnabled ? "Incluse" : "Non incluse";
    const attendanceField = document.querySelector('[data-quote-field="attendanceQuantity"]');
    if (attendanceField) attendanceField.disabled = !quoteState.attendance;
    document.querySelectorAll("[data-machine-sale-fields]").forEach((fields) => { fields.hidden = !quoteState.machineSaleEnabled; });
    const ready = result.validation.valid && Boolean(result.essential || result.superior) && Boolean(quoteState.clientName.trim());
    document.querySelectorAll("[data-quote-client-preview], [data-quote-generate]").forEach((button) => { button.disabled = !ready; });
  }

  let quotePreviewReturnPosition = 0;

  function openQuotePreview() {
    const result = calculateCurrentQuote();
    if (!result.validation.valid || (!result.essential && !result.superior)) return;
    renderQuotePreview(result);
    const modal = document.querySelector("[data-quote-preview-modal]");
    if (!modal) return;
    quotePreviewReturnPosition = window.scrollY;
    modal.hidden = false;
    body.classList.add("quote-preview-open");
    modal.querySelector(".quote-preview-scroll")?.scrollTo({ top: 0 });
  }

  function closeQuotePreview() {
    const modal = document.querySelector("[data-quote-preview-modal]");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    body.classList.remove("quote-preview-open");
    window.scrollTo({ top: quotePreviewReturnPosition });
  }

  function updateQuoteField(field) {
    const key = field.dataset.quoteField;
    if (!key) return;
    if (field.type === "radio" && !field.checked) return;
    quoteState[key] = field.type === "checkbox" ? field.checked : field.type === "number" ? toNumber(field.value) : field.value;
    applyQuoteBusinessRules(key);
    syncQuoteControls();
    renderQuoteBuilder();
  }

  function updateMuraleCoiljetCheckbox(field) {
    const level = field.dataset.quoteCoiljetCheckbox;
    if (!["essential", "superior"].includes(level)) return;
    const key = `${level}CoiljetMurale`;
    if (field.checked) quoteState[key] = field.value;
    else if (quoteState[key] === field.value) quoteState[key] = "";
    applyQuoteBusinessRules(key);
    syncQuoteControls();
    renderQuoteBuilder();
  }

  function filterQuotes() {
    const search = document.querySelector("[data-quote-search]")?.value || "";
    const status = document.querySelector("[data-quote-status-filter]")?.value || "";
    const type = document.querySelector("[data-quote-type-filter]")?.value || "";
    document.querySelectorAll("[data-quote-list] .quote-list-row").forEach((row) => {
      row.hidden = !(matchesPrototypeSearch(row.textContent, search) && (!status || row.dataset.quoteStatus === status) && (!type || row.dataset.quoteType === type));
    });
  }

  function filterSalesClients() {
    const search = document.querySelector("[data-sales-client-search]")?.value || "";
    document.querySelectorAll("[data-sales-client-card]").forEach((card) => { card.hidden = !matchesPrototypeSearch(card.textContent, search); });
  }

  function selectPricingSettingsTab(tab) {
    document.querySelectorAll("[data-pricing-settings-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.pricingSettingsTab === tab);
    });
    document.querySelectorAll("[data-pricing-settings-panel]").forEach((panel) => {
      const active = panel.dataset.pricingSettingsPanel === tab;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function runPricingRegressionTests() {
    const tests = [];
    const check = (name, condition, actual, expected) => tests.push({ name, passed: Boolean(condition), actual, expected });
    const fixture = {
      quantity: 149, zone: "Rive-Sud", extraMinutes: 0, class1: 0, class2: 149, class3: 0, class4: 0, class5: 0,
      essentialPlan: "inspection", superiorPlan: "confort", essentialRemoveMachine: false, superiorRemoveMachine: true,
      essentialCoiljet: "", superiorCoiljet: "", factor: 1, loyalty: false, attendance: false, attendanceQuantity: 0
    };
    const result = calculateMonoblocQuote(fixture);
    const near = (actual, expected, tolerance = 0.005) => Math.abs(actual - expected) <= tolerance;
    check("Monobloc 149 · prix unitaire Essentiel", near(result.essential.commercial.selected.unitPrice, 72.69127516778524, 1e-9), result.essential.commercial.selected.unitPrice, 72.69127516778524);
    check("Monobloc 149 · sous-total Essentiel", near(result.essential.commercial.selected.preTax, 10831), result.essential.commercial.selected.preTax, 10831);
    check("Monobloc 149 · taxes Essentiel", result.essential.commercial.taxes.tps === 541.55 && result.essential.commercial.taxes.tvq === 1080.39 && result.essential.commercial.taxes.total === 12452.94, result.essential.commercial.taxes, { tps: 541.55, tvq: 1080.39, total: 12452.94 });
    check("Monobloc 149 · heures/jours Essentiel", near(result.essential.hours, 67.05) && near(result.essential.plannedDays, 9.75), { hours: result.essential.hours, days: result.essential.plannedDays }, { hours: 67.05, days: 9.75 });
    check("Monobloc 149 · prix unitaire Supérieur", near(result.superior.commercial.selected.unitPrice, 206.13825503355707, 1e-9), result.superior.commercial.selected.unitPrice, 206.13825503355707);
    check("Monobloc 149 · sous-total Supérieur", near(result.superior.commercial.selected.preTax, 30714.60), result.superior.commercial.selected.preTax, 30714.60);
    check("Monobloc 149 · taxes Supérieur", result.superior.commercial.taxes.tps === 1535.73 && result.superior.commercial.taxes.tvq === 3063.78 && result.superior.commercial.taxes.total === 35314.11, result.superior.commercial.taxes, { tps: 1535.73, tvq: 3063.78, total: 35314.11 });
    check("Monobloc 149 · heures/jours Supérieur", near(result.superior.hours, 111.75) && near(result.superior.plannedDays, 16), { hours: result.superior.hours, days: result.superior.plannedDays }, { hours: 111.75, days: 16 });
    check("Classes Monobloc invalides", !validateMonoblocConfiguration({ ...fixture, class2: 148 }).valid, false, false);
    check("Localisations Murale invalides", !validateMuraleConfiguration({ quantity: 20, muraleBalcony: 10, muraleHeight: 5, muraleRoof: 0, muraleStair: 0 }).valid, false, false);
    check("Plan Essentiel mutuellement exclusif", calculateMonoblocQuote({ ...fixture, essentialPlan: "inspection+confort" }).essential === null, "rejeté", "rejeté");
    check("Plan Supérieur mutuellement exclusif", calculateMonoblocQuote({ ...fixture, superiorPlan: "inspection+confort" }).superior === null, "rejeté", "rejeté");
    check("Facteur minimum", normalizeFactor(0.8) === 0.95, normalizeFactor(0.8), 0.95);
    check("Facteur maximum", normalizeFactor(1.2) === 1.05, normalizeFactor(1.2), 1.05);
    check("Seuil KlimaParc 49/50", 49 < pricingConfig.general.klimparcThreshold && 50 >= pricingConfig.general.klimparcThreshold, [false, true], [false, true]);
    check("Rabais volume 8", calculateVolumeDiscount(8).rate === 0, calculateVolumeDiscount(8).rate, 0);
    check("Rabais volume 50", near(calculateVolumeDiscount(50).rate, (42 / 92) * 0.10, 1e-12), calculateVolumeDiscount(50).rate, (42 / 92) * 0.10);
    check("Rabais volume 100", calculateVolumeDiscount(100).rate === 0.10, calculateVolumeDiscount(100).rate, 0.10);
    const discountFixture = { ...fixture, quantity: 50, class2: 50, essentialPlan: "confort", superiorPlan: null, essentialCoiljet: "all", attendanceQuantity: 50 };
    const standard = calculateMonoblocQuote({ ...discountFixture, loyalty: false, attendance: false }).essential.commercial.selected.preTax;
    const loyalty = calculateMonoblocQuote({ ...discountFixture, loyalty: true, attendance: false }).essential.commercial.selected.preTax;
    const attendance = calculateMonoblocQuote({ ...discountFixture, loyalty: false, attendance: true }).essential.commercial.selected.preTax;
    const combined = calculateMonoblocQuote({ ...discountFixture, loyalty: true, attendance: true }).essential.commercial.selected.preTax;
    check("Rabais fidélité", loyalty < standard, loyalty, `< ${standard}`);
    check("Rabais assiduité", attendance < standard, attendance, `< ${standard}`);
    check("Deux rabais", combined < loyalty && combined < attendance, combined, `< ${Math.min(loyalty, attendance)}`);
    const premiumDefault = calculateMonoblocQuote({ ...discountFixture, essentialPlan: null, superiorPlan: "premium", superiorCoiljet: "" }).superior;
    check("CoilJet Premium obligatoire", premiumDefault.coiljetFactor === 1, premiumDefault.coiljetFactor, 1);
    const monoblocCoiljetAll = calculateMonoblocQuote({ ...discountFixture, essentialCoiljet: "all" }).essential;
    const monoblocCoiljetNeeded = calculateMonoblocQuote({ ...discountFixture, essentialCoiljet: "needed" }).essential;
    check("CoilJet Monobloc toutes unités", monoblocCoiljetAll.coiljetFactor === 1, monoblocCoiljetAll.coiljetFactor, 1);
    check("CoilJet Monobloc au besoin", monoblocCoiljetNeeded.coiljetFactor === 0.75 && monoblocCoiljetNeeded.baseCost < monoblocCoiljetAll.baseCost, { factor: monoblocCoiljetNeeded.coiljetFactor, baseCost: monoblocCoiljetNeeded.baseCost }, { factor: 0.75, baseCost: `< ${monoblocCoiljetAll.baseCost}` });
    const muraleFixture = { quantity: 50, zone: "Rive-Sud", muraleBalcony: 50, muraleHeight: 0, muraleRoof: 0, muraleStair: 0, extraMinutes: 0, essentialPlan: "entretien", superiorPlan: null, essentialCondenser: false, essentialPressure: false, factor: 1, loyalty: false, attendance: false, attendanceQuantity: 0 };
    const muraleCoiljetAll = calculateMuraleQuote({ ...muraleFixture, essentialCoiljet: "all" }).essential;
    const muraleCoiljetNeeded = calculateMuraleQuote({ ...muraleFixture, essentialCoiljet: "needed" }).essential;
    check("CoilJet Murale toutes unités", muraleCoiljetAll.coiljetFactor === 1, muraleCoiljetAll.coiljetFactor, 1);
    check("CoilJet Murale au besoin", muraleCoiljetNeeded.coiljetFactor === 0.75 && muraleCoiljetNeeded.baseCost < muraleCoiljetAll.baseCost, { factor: muraleCoiljetNeeded.coiljetFactor, baseCost: muraleCoiljetNeeded.baseCost }, { factor: 0.75, baseCost: `< ${muraleCoiljetAll.baseCost}` });
    const belowThreshold = calculateMonoblocQuote({ ...fixture, quantity: 49, class2: 49, superiorPlan: null }).essential;
    check("KlimaParc coût séparé de l’admissibilité", belowThreshold.klimparcCost === 245 && 49 < pricingConfig.general.klimparcThreshold, { eligible: false, cost: belowThreshold.klimparcCost }, { eligible: false, cost: 245 });
    return tests;
  }

  const KlimaParcPricing = {
    pricingConfig,
    calculateMuraleQuote,
    calculateMonoblocQuote,
    calculateVolumeDiscount,
    calculateCommission,
    calculateTaxes,
    validateMuraleConfiguration,
    validateMonoblocConfiguration,
    runPricingRegressionTests
  };
  if (typeof window !== "undefined") window.KlimaParcPricing = KlimaParcPricing;
  if (typeof module !== "undefined" && module.exports) module.exports = KlimaParcPricing;

  function setRecommendationDecision(decision, trigger) {
    const scope = trigger?.closest("[data-screen-view]") || document;
    const panel = scope.querySelector(".work-order-client-decision, .client-decision");
    const states = {
      approve: ["Recommandation approuvée", "L’équipe Klimfax peut maintenant planifier les travaux."],
      refuse: ["Recommandation refusée", "Votre décision est enregistrée et l’équipe Klimfax en sera informée."]
    };
    const state = states[decision];
    if (!state || !panel) return;

    let confirmation = panel.querySelector(".decision-confirmation");
    if (!confirmation) {
      confirmation = document.createElement("div");
      confirmation.className = "decision-confirmation";
      panel.appendChild(confirmation);
    }
    confirmation.className = `decision-confirmation ${decision}`;
    confirmation.innerHTML = "<strong></strong><span></span>";
    confirmation.querySelector("strong").textContent = state[0];
    confirmation.querySelector("span").textContent = state[1];
    showToast(state[0], state[1]);
  }

  function wirePrototypeControls() {
    const setScreen = (selector, screen) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element.hasAttribute("data-screen")) element.dataset.screen = screen;
      });
    };
    const setAction = (selector, action) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element.hasAttribute("data-prototype-action")) element.dataset.prototypeAction = action;
      });
    };
    const setRecord = (selector, type) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element.hasAttribute("data-screen")) element.dataset.prototypeRecord = type;
      });
    };
    const setTabs = (selector, title) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.dataset.prototypeTab = "true";
        element.dataset.prototypeTabTitle = title;
        element.setAttribute("aria-pressed", String(element.classList.contains("is-active")));
      });
    };

    setAction('.login-form-panel .button.secondary', "account-create");
    setAction('.login-form-panel .text-button', "password-reset");

    setAction('.dashboard-view > .page-heading .button.secondary[data-visible-roles="interne"]', "dashboard-edit");
    setScreen('[data-dashboard-role="interne"] .metric-grid button:nth-child(1)', "requests");
    setScreen('[data-dashboard-role="interne"] .metric-grid button:nth-child(2)', "work-orders");
    setScreen('[data-dashboard-role="interne"] .metric-grid button:nth-child(3)', "alerts");
    setScreen('[data-dashboard-role="interne"] .metric-grid button:nth-child(4)', "work-orders");
    setScreen('[data-dashboard-role="interne"] .dashboard-panel:first-child .section-heading .text-button', "requests");
    setScreen('[data-dashboard-role="interne"] .compact-row:first-of-type', "request-detail");
    setRecord('[data-dashboard-role="interne"] .compact-row:not([data-screen])', "Requête");
    setScreen('[data-dashboard-role="interne"] .dashboard-panel:last-child .section-heading .text-button', "reports");

    setScreen('[data-dashboard-role="client"] .status-overview .text-button', "reports");
    setScreen('[data-dashboard-role="client"] .client-columns:last-child .dashboard-panel:first-child .text-button', "work-orders");
    setScreen('[data-dashboard-role="client"] .client-columns:last-child .dashboard-panel:last-child .text-button', "reports");

    setRecord('[data-dashboard-role="technicien"] .agenda-row:not([data-screen])', "Bon de travail");
    setAction('[data-dashboard-role="technicien"] .next-job .button.secondary', "technician-route");
    setScreen('[data-dashboard-role="technicien"] .check-row', "field");

    setRecord('.recommendations-list .recommendation-row:not([data-screen])', "Recommandation");
    setTabs('.alert-tabs button', "Filtre d’alertes");
    setRecord('.alerts-list .alert-row .text-button', "Alerte");
    setAction('.affected-equipment .affected-more', "alert-equipment-list");

    setTabs('.report-tabs button', "Rapport");
    setScreen('[data-report-role="interne"] .weekly-planning .text-button', "dashboard");
    setScreen('[data-report-role="interne"] .critical-items > header .text-button', "work-orders");
    setRecord('[data-report-role="interne"] .critical-items > button', "Dossier critique");
    setScreen('[data-report-role="client"] .upcoming-maintenance .text-button', "dashboard");
    setRecord('[data-report-role="technicien"] .route-row', "Bon de travail");

    setAction('.requests-view .page-heading .button.secondary[data-visible-roles="interne"]', "requests-export");
    setRecord('.requests-list .request-row:not([data-screen])', "Requête");
    setAction('.work-orders-view .page-heading .button.primary[data-visible-roles="interne"]', "work-order-create");
    setAction('.operations-filter > .icon-button', "advanced-filters");
    setRecord('.work-orders-list .work-order-row:not([data-screen])', "Bon de travail");
    setAction('.work-order-detail-view .page-actions .button.secondary', "work-order-edit");
    setAction('.work-order-targets .section-heading .text-button', "work-order-target-add");
    setScreen('.work-order-targets .target-row:not([data-screen])', "field");
    setAction('.work-order-side .button.secondary', "assignment-edit");

    setScreen('.equipment-work-row', "work-order-detail");
    setAction('.recommendation-summary .button.secondary', "equipment-info");
    setAction('.recommendation-summary .button.primary', "equipment-approve");
    setRecord('.history-event-copy .text-button', "Historique");

    setTabs('.notification-tabs button', "Notifications");
    setAction('.notification-center-toolbar > .icon-button', "notification-filter");
    setTabs('.editor-section-list > button:not(.text-button)', "Section du formulaire");
    setAction('.data-field-options-card .option-list .icon-button', "data-option-edit");

    const notificationScreens = [
      "work-orders", "request-detail", "work-orders",
      "work-orders", "work-orders",
      "work-orders", "field",
      "quote-detail", "quotes", "quotes"
    ];
    document.querySelectorAll('.notification-drawer .notification-row').forEach((row, index) => {
      row.dataset.screen = notificationScreens[index] || "notifications";
    });
  }

  if (hasDOM) {
  document.querySelector("[data-request-cart-drawer]")?.addEventListener("click", (event) => {
    const detailsToggle = event.target.closest("[data-request-cart-details-toggle]");
    if (!detailsToggle) return;
    event.preventDefault();
    event.stopPropagation();
    toggleRequestCartDetails(detailsToggle);
  });

  document.addEventListener("click", (event) => {
    const role = event.target.closest(".prototype-toolbar button[data-role]");
    if (role) setRole(role.dataset.role);

    const clientScopeShortcut = event.target.closest("[data-client-scope-shortcut]");
    if (clientScopeShortcut) {
      setClientScope(clientScopeShortcut.dataset.clientScopeShortcut);
      showScreen("places");
    }

    const placeRow = event.target.closest("[data-place-row]");
    if (placeRow) openPlaceDetail(placeRow);

    if (event.target.closest("[data-manage-place-responsible]")) openPlaceResponsibleModal();
    if (event.target.closest("[data-close-place-responsible]")) closePlaceResponsibleModal();
    if (event.target.closest("[data-save-place-responsible]")) savePlaceResponsible();
    if (event.target.closest("[data-remove-place-responsible]")) removePlaceResponsible();

    const apartmentPreview = event.target.closest("[data-apartment-preview]");
    if (apartmentPreview) {
      event.preventDefault();
      event.stopPropagation();
      openApartmentPreview(apartmentPreview);
      return;
    }

    const screen = event.target.closest("[data-screen]");
    if (screen && screen !== body && !screen.hidden) showScreen(screen.dataset.screen);
    const requestTabTarget = event.target.closest("[data-request-tab-target]");
    if (requestTabTarget) setRequestRecordTab(requestTabTarget.dataset.requestTabTarget, requestTabTarget.dataset.requestHighlight || "");

    const dashboardRecommendationFilter = event.target.closest("[data-dashboard-recommendation-filter]");
    if (dashboardRecommendationFilter) {
      setRecommendationDeadlineFilter(dashboardRecommendationFilter.dataset.dashboardRecommendationFilter);
      showScreen("recommendations");
    }
    if (event.target.closest("[data-global-search-result]")) {
      const globalInput = document.querySelector("[data-global-search]");
      if (globalInput) globalInput.value = "";
      closeGlobalSearch();
      updateLiveSearchClearButton(globalInput);
    } else if (!event.target.closest(".search")) {
      closeGlobalSearch();
    }

    const workOrderTypeToggle = event.target.closest("[data-work-order-type-toggle]");
    if (workOrderTypeToggle) toggleWorkOrderType(workOrderTypeToggle);

    const workOrderDecisionFilter = event.target.closest("[data-work-order-decision-filter]");
    if (workOrderDecisionFilter) toggleWorkOrderDecisionFilter(workOrderDecisionFilter);

    if (event.target.closest("[data-clear-operations-search]")) {
      const input = document.querySelector("[data-operations-search-input]");
      if (input) {
        input.value = "";
        input.focus();
        applyWorkOrderFilters();
      }
    }

    const liveSearchClear = event.target.closest("[data-live-search-clear]");
    if (liveSearchClear) {
      const input = liveSearchClear.parentElement?.querySelector("input");
      if (input) {
        input.value = "";
        input.focus();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    const clientShortcut = event.target.closest("[data-quote-client-shortcut]");
    if (clientShortcut) {
      quoteState.clientMode = "existing";
      quoteState.clientId = clientShortcut.dataset.quoteClientShortcut;
      applyQuoteBusinessRules("clientId");
      syncQuoteControls();
      renderQuoteBuilder();
    }

    const pricingSettingsTab = event.target.closest("[data-pricing-settings-tab]");
    if (pricingSettingsTab) selectPricingSettingsTab(pricingSettingsTab.dataset.pricingSettingsTab);
    if (event.target.closest("[data-quote-client-preview], [data-open-quote-preview]")) openQuotePreview();
    if (event.target.closest("[data-quote-preview-close]")) closeQuotePreview();
    if (event.target.closest("[data-quote-save]")) showToast("Brouillon enregistré", "SO-2026-032 reste modifiable dans l’espace Soumissions.");
    if (event.target.closest("[data-quote-generate]")) {
      const safeClient = (quoteState.clientName || "Nouveau-client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      showToast("Soumission générée", `Soumission_2026-08-23_${safeClient}.pdf réunira la proposition et les termes.`);
    }

    const month = event.target.closest("[data-month]");
    if (month) changeMonth(month.dataset.month);

    if (event.target.closest("[data-notifications]")) toggleNotifications();
    if (event.target.closest("[data-close-notifications]")) closeNotifications();
    const notificationRow = event.target.closest(".notification-drawer .notification-row");
    if (notificationRow) {
      notificationRow.classList.remove("is-new");
      closeNotifications();
    }
    if (event.target.closest("[data-ai-chat-toggle]")) toggleAIChat();
    if (event.target.closest("[data-ai-chat-close]")) closeAIChat();
    if (event.target.closest("[data-ai-chat-send]")) sendAIChatQuestion();
    const aiSuggestion = event.target.closest("[data-ai-chat-suggestion]");
    if (aiSuggestion) sendAIChatQuestion(aiSuggestion.dataset.aiChatSuggestion);
    if (event.target.closest("[data-menu]")) body.classList.toggle("menu-open");
    if (event.target.closest("[data-menu-close]")) body.classList.remove("menu-open");
    if (event.target.closest("[data-sidebar-collapse]")) toggleSidebar();

    const stepToggle = event.target.closest("[data-step-toggle]");
    if (stepToggle) toggleStep(stepToggle);

    const unit = event.target.closest("[data-unit]");
    if (unit) selectUnit(unit);

    const equipmentTab = event.target.closest("[data-equipment-tab]");
    if (equipmentTab) selectEquipmentTab(equipmentTab.dataset.equipmentTab);

    const equipmentTabTarget = event.target.closest("[data-equipment-tab-target]");
    if (equipmentTabTarget) selectEquipmentTab(equipmentTabTarget.dataset.equipmentTabTarget);

    if (event.target.closest("[data-close-apartment-preview]")) closeApartmentPreview();

    const systemLink = event.target.closest("[data-open-system]");
    if (systemLink) openSystemDetail(systemLink.dataset.openSystem);
    if (event.target.closest("[data-system-detail-back]")) showScreen(systemDetailReturnScreen);

    if (event.target.closest("[data-add-equipment-note]")) addEquipmentNote();

    const addInterventionCost = event.target.closest("[data-add-intervention-cost]");
    if (addInterventionCost) openInterventionCostEditor(addInterventionCost);

    const cancelInterventionCost = event.target.closest("[data-cancel-intervention-cost]");
    if (cancelInterventionCost) cancelInterventionCostEditor(cancelInterventionCost);

    const saveInterventionCostButton = event.target.closest("[data-save-intervention-cost]");
    if (saveInterventionCostButton) saveInterventionCost(saveInterventionCostButton);

    if (event.target.closest("[data-save-replacement-estimates]")) saveReplacementEstimates();
    if (event.target.closest("[data-save-warranty-settings]")) saveWarrantySettings();

    const floorToggle = event.target.closest("[data-equipment-floor-toggle]");
    if (floorToggle) toggleEquipmentFloor(floorToggle);

    const inventoryStatusChip = event.target.closest("[data-inventory-status-chip]");
    if (inventoryStatusChip) {
      const statusSelect = document.querySelector("[data-inventory-status]");
      if (statusSelect) {
        statusSelect.value = statusSelect.value === inventoryStatusChip.dataset.inventoryStatusChip ? "all" : inventoryStatusChip.dataset.inventoryStatusChip;
        filterEquipmentInventory();
      }
    }

    const placeInventoryStatusChip = event.target.closest("[data-place-inventory-status-chip]");
    if (placeInventoryStatusChip) {
      const statusSelect = document.querySelector("[data-place-inventory-status]");
      if (statusSelect) {
        statusSelect.value = statusSelect.value === placeInventoryStatusChip.dataset.placeInventoryStatusChip ? "all" : placeInventoryStatusChip.dataset.placeInventoryStatusChip;
        filterPlaceEquipmentInventory();
      }
    }

    const requestStatusChip = event.target.closest("[data-request-status-chip]");
    if (requestStatusChip) {
      const statusSelect = document.querySelector("[data-request-status]");
      if (statusSelect) {
        statusSelect.value = statusSelect.value === requestStatusChip.dataset.requestStatusChip ? "all" : requestStatusChip.dataset.requestStatusChip;
        filterRequestEquipment();
      }
    }

    const requestType = event.target.closest("[data-request-type]");
    if (requestType) selectRequestType(requestType.dataset.requestType);

    if (event.target.closest("[data-request-cart]")) openRequestCart();
    if (event.target.closest("[data-close-request-cart]")) closeRequestCart();

    if (event.target.closest("[data-cancel-request-selection]")) clearRequestSelection();
    if (event.target.closest("[data-add-request-selection]")) addRequestSelection();
    if (event.target.closest("[data-select-request-floor]")) selectRequestScope("floor");
    if (event.target.closest("[data-select-request-building]")) selectRequestScope("building");

    const addRequestItemButton = event.target.closest("[data-add-request-item]");
    if (addRequestItemButton) addRequestItem(addRequestItemButton);

    const addRequestPreviewButton = event.target.closest("[data-add-request-preview-system]");
    if (addRequestPreviewButton) addRequestPreviewSystem(addRequestPreviewButton);

    const removeRequestItemButton = event.target.closest("[data-remove-request-item]");
    if (removeRequestItemButton) removeRequestItem(removeRequestItemButton.closest("[data-request-cart-item]").dataset.requestCartItem);

    if (event.target.closest("[data-submit-request-cart]")) {
      if (!requestCart.size) {
        showToast("Ajoutez un système", "Votre demande doit contenir au moins un système.");
      } else {
        closeRequestCart();
        renderRequestCheckout();
        showScreen("request-checkout");
      }
    }

    if (event.target.closest("[data-confirm-request-order]")) confirmRequestOrder();

    if (event.target.closest("[data-send-reply]")) sendClientReply();
    const recommendationReply = event.target.closest("[data-send-recommendation-reply]");
    if (recommendationReply) sendRecommendationReply(recommendationReply);

    const recommendationDecision = event.target.closest("[data-recommendation-decision]");
    if (recommendationDecision) setRecommendationDecision(recommendationDecision.dataset.recommendationDecision, recommendationDecision);

    const recommendationFilterToggle = event.target.closest("[data-toggle-recommendation-filters]");
    if (recommendationFilterToggle) {
      const panel = document.querySelector("[data-recommendation-advanced-filters]");
      const expanded = recommendationFilterToggle.getAttribute("aria-expanded") !== "true";
      recommendationFilterToggle.setAttribute("aria-expanded", String(expanded));
      if (panel) panel.hidden = !expanded;
    }
    if (event.target.closest("[data-clear-recommendation-filters]")) {
      document.querySelectorAll("[data-recommendation-advanced-filters] select").forEach((select) => { select.value = "all"; });
      document.querySelectorAll("[data-recommendation-filter-option]").forEach((input) => { input.checked = false; });
      const search = document.querySelector("[data-recommendation-search]");
      if (search) search.value = "";
      currentRecommendationDeadlineFilter = "all";
      renderRecommendations();
    }
    const removeRecommendationFilterChip = event.target.closest("[data-remove-recommendation-filter]");
    if (removeRecommendationFilterChip) removeRecommendationFilter(removeRecommendationFilterChip.dataset.removeRecommendationFilter, removeRecommendationFilterChip.dataset.recommendationFilterValue || "");

    const addRecommendationCart = event.target.closest("[data-add-recommendation-cart]");
    if (addRecommendationCart) addRecommendationToCart(addRecommendationCart.dataset.addRecommendationCart);
    const togglePlanned = event.target.closest("[data-toggle-planned-recommendation]");
    if (togglePlanned) togglePlannedRecommendation(togglePlanned.dataset.togglePlannedRecommendation);
    const postponeRecommendation = event.target.closest("[data-postpone-recommendation]");
    if (postponeRecommendation) openRecommendationPostpone(postponeRecommendation.dataset.postponeRecommendation);
    const postponeDays = event.target.closest("[data-postpone-days]");
    if (postponeDays) postponeRecommendationByDays(postponeDays.dataset.postponeDays);
    if (event.target.closest("[data-confirm-recommendation-postpone]")) postponeRecommendationTo(document.querySelector("[data-postpone-date]")?.value);
    if (event.target.closest("[data-close-recommendation-postpone]")) closeRecommendationPostpone();

    const recommendationSystem = event.target.closest("[data-open-recommendation-system]");
    if (recommendationSystem) openSystemDetail(recommendationSystem.dataset.openRecommendationSystem);
    const linkedQuote = event.target.closest("[data-linked-quote]");
    if (linkedQuote) {
      showScreen("requests");
      setRequestRecordTab("quotes", linkedQuote.dataset.linkedQuote);
    }
    const linkedRecommendation = event.target.closest("[data-linked-recommendation]");
    if (linkedRecommendation) {
      document.querySelectorAll("[data-recommendation-advanced-filters] select").forEach((select) => { select.value = "all"; });
      document.querySelectorAll("[data-recommendation-filter-option]").forEach((input) => { input.checked = false; });
      const search = document.querySelector("[data-recommendation-search]");
      const record = getRecommendationRecord(linkedRecommendation.dataset.linkedRecommendation);
      if (search) search.value = record?.title || "";
      showScreen("recommendations");
      renderRecommendations();
    }
    const quotePdf = event.target.closest("[data-quote-pdf]");
    if (quotePdf) showToast("Document PDF prêt", `${quotePdf.dataset.quotePdf}.pdf peut être consulté ou téléchargé.`);

    const requestTab = event.target.closest("[data-request-tab]");
    if (requestTab) setRequestRecordTab(requestTab.dataset.requestTab);

    if (event.target.closest("[data-clear-inventory-service-filters]")) {
      const kind = document.querySelector("[data-inventory-service-kind]");
      const from = document.querySelector("[data-inventory-service-from]");
      const to = document.querySelector("[data-inventory-service-to]");
      if (kind) kind.value = "all";
      if (from) from.value = "";
      if (to) to.value = "";
      filterEquipmentInventory();
    }

    if (event.target.closest("[data-open-planned-list]")) openPlannedList();
    if (event.target.closest("[data-close-planned-list]")) closePlannedList();
    const removePlanned = event.target.closest("[data-remove-planned-recommendation]");
    if (removePlanned) togglePlannedRecommendation(removePlanned.dataset.removePlannedRecommendation);
    if (event.target.closest("[data-add-selected-planned-to-cart]")) addSelectedPlannedToCart();
    if (event.target.closest("[data-select-all-planned]")) {
      const selectAll = event.target.closest("[data-select-all-planned]");
      window.setTimeout(() => document.querySelectorAll("[data-select-planned-item]").forEach((input) => { input.checked = selectAll.checked; }), 0);
    }

    if (event.target.closest("[data-add-maintenance-rule]")) addMaintenanceRule();
    if (event.target.closest("[data-reset-maintenance-rules]")) resetMaintenanceRules();
    const toggleMaintenanceRuleButton = event.target.closest("[data-toggle-maintenance-rule]");
    if (toggleMaintenanceRuleButton) toggleMaintenanceRule(toggleMaintenanceRuleButton);
    const removeMaintenanceRule = event.target.closest("[data-remove-maintenance-rule]");
    if (removeMaintenanceRule) {
      const row = removeMaintenanceRule.closest("[data-maintenance-rule]");
      if (row?.hasAttribute("data-dynamic-maintenance-rule")) {
        row.remove();
        showToast("Règle retirée", "La règle moins spécifique s’appliquera désormais à ce périmètre.");
      }
    }

    const prototypeTab = event.target.closest("[data-prototype-tab]");
    if (prototypeTab) {
      prototypeTab.parentElement.querySelectorAll("[data-prototype-tab]").forEach((tab) => {
        const active = tab === prototypeTab;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      showToast(`${prototypeTab.dataset.prototypeTabTitle} sélectionné`, prototypeTab.textContent.replace(/\s+/g, " ").trim());
    }

    const prototypeRecord = event.target.closest("[data-prototype-record]");
    if (prototypeRecord) {
      const label = prototypeRecord.querySelector("strong")?.textContent.trim() || prototypeRecord.dataset.prototypeRecord;
      showToast(`${prototypeRecord.dataset.prototypeRecord} sélectionné`, `${label} est prêt à être consulté dans le dossier complet.`);
    }

    const prototypeAction = event.target.closest("[data-prototype-action]");
    if (prototypeAction) {
      const messages = {
        save: ["Activité enregistrée", "Vous pouvez reprendre le formulaire à tout moment."],
        finish: ["Activité terminée", "Le dossier de la machine a été mis à jour."],
        photo: ["Fichier ajouté", "La photo est maintenant associée à cette machine."],
        unit: ["Nouvelle unité", "La fiche d'identification est prête à être complétée."],
        documents: ["Documents de l’immeuble", "Tous les documents autorisés sont disponibles dans cet espace."],
        document: ["Prévisualisation ouverte", "Le document reste associé à l’immeuble et à l'équipement."],
        "document-folder": ["Nouveau dossier", "Organisez les documents par immeuble, équipement ou bon de travail."],
        "document-upload": ["Ajouter un document", "Choisissez un fichier à associer à l’immeuble ou à un équipement."],
        "document-download": ["Téléchargement préparé", "Le fichier sera téléchargé sans dupliquer son contenu dans KlimaParc."],
        "document-open": ["Prévisualisation ouverte", "Le document est affiché dans un nouvel onglet sécurisé."],
        "document-delete": ["Suppression à confirmer", "Le fichier sera retiré de son immeuble, de sa machine et de son bon de travail."],
        "link-bt": ["Sélection du BT", "Choisissez le bon de travail auquel cette demande doit être ajoutée."],
        "create-bt": ["Nouveau bon de travail", "Les informations de la demande seront reprises automatiquement."],
        "new-recommendation": ["Nouvelle recommandation", "La fiche technique est prête à être complétée."],
        "report-pdf": ["Rapport préparé", "Le document PDF est prêt à être consulté."],
        "send-day-report": ["Rapport transmis", "L’équipe interne a reçu votre résumé de la journée."],
        "new-reminder": ["Nouveau rappel", "La configuration du rappel est prête à être complétée."],
        "mark-read": ["Alerte traitée", "L’alerte a été retirée de la liste des actions prioritaires."],
        "edit-reminder": ["Modification du rappel", "La fréquence et la portée peuvent maintenant être ajustées."],
        "settings-audit": ["Journal ouvert", "Les dernières modifications sont prêtes à être consultées."],
        "settings-create": ["Nouvel élément", "Choisissez le type de configuration à créer."],
        "settings-manage": ["Configuration ouverte", "Les options peuvent maintenant être consultées et modifiées."],
        "recommendation-settings-statuses": ["Statuts de recommandation", "Les libellés et leur ordre peuvent maintenant être configurés."],
        "recommendation-type-create": ["Nouveau type", "Définissez le parcours client, les conditions et l’activité suggérée."],
        "recommendation-type-disable": ["Désactivation à confirmer", "Les recommandations existantes et leur historique resteront accessibles."],
        "recommendation-type-save": ["Type enregistré", "Le parcours d’approbation sera appliqué aux prochaines recommandations."],
        "settings-users": ["Utilisateurs et accès", "Les profils et permissions sont prêts à être gérés."],
        "user-profiles": ["Profils client", "Les rôles et droits partagés peuvent maintenant être configurés."],
        "user-create": ["Nouvel utilisateur", "Les informations du nouvel accès peuvent maintenant être saisies."],
        "user-reset": ["Lien de réinitialisation préparé", "Un courriel sécurisé sera envoyé à l’utilisateur."],
        "user-save": ["Utilisateur enregistré", "Le profil et les permissions ont été mis à jour."],
        "user-deactivate": ["Désactivation à confirmer", "L’accès sera bloqué dès que la confirmation sera enregistrée."],
        "user-permissions": ["Permissions modifiables", "Sélectionnez les informations à partager avec ce profil."],
        "form-duplicate": ["Copie prête", "Le nouveau formulaire peut être renommé et adapté."],
        "form-create": ["Nouveau formulaire", "Commencez par définir les activités associées."],
        "form-preview": ["Aperçu terrain", "Le formulaire est affiché comme le verra le technicien."],
        "form-save": ["Formulaire enregistré", "Les modifications seront utilisées dans les prochains BT."],
        "form-section": ["Nouvelle section", "Donnez un titre à la section et ajoutez ses questions."],
        "form-question": ["Question prête à configurer", "Choisissez le type de réponse et les règles d’affichage."],
        "form-rule": ["Branchement de question", "Définissez les réponses qui affichent ou masquent la suite du formulaire."],
        "activity-order": ["Organisation des activités", "L’ordre présenté dans le formulaire peut maintenant être ajusté."],
        "activity-create": ["Nouvelle activité", "Définissez le formulaire terrain et les systèmes auxquels elle s’applique."],
        "activity-disable": ["Désactivation à confirmer", "Les activités déjà enregistrées garderont leur historique."],
        "activity-save": ["Activité enregistrée", "Le formulaire et les règles seront appliqués dans les prochains BT."],
        "activity-form": ["Choix du formulaire", "Sélectionnez le formulaire terrain qui sera proposé par défaut."],
        "data-fields-order": ["Organisation des champs", "L’ordre de présentation des champs peut maintenant être ajusté."],
        "data-field-create": ["Nouveau champ", "Définissez son type de réponse, ses options et son application."],
        "data-field-disable": ["Désactivation à confirmer", "Les valeurs déjà enregistrées conserveront leur historique."],
        "data-field-save": ["Champ enregistré", "Les listes mises à jour seront proposées dans les prochains formulaires."],
        "data-option-create": ["Nouvelle option", "Ajoutez une valeur puis placez-la dans l’ordre souhaité."],
        "data-options-all": ["Toutes les options", "La liste complète des marques est prête à être gérée."],
        "system-types-order": ["Organisation des systèmes", "L’ordre des types peut maintenant être ajusté."],
        "system-type-create": ["Nouveau type de système", "Choisissez la topologie et les données partagées."],
        "system-type-disable": ["Désactivation à confirmer", "Les systèmes existants conserveront leur historique."],
        "system-type-save": ["Type de système enregistré", "La topologie sera appliquée aux nouveaux systèmes HVAC."],
        "request-types-order": ["Organisation des demandes", "L’ordre affiché au client peut maintenant être ajusté."],
        "request-type-create": ["Nouveau type de demande", "Définissez l’urgence et le traitement initial."],
        "request-type-disable": ["Désactivation à confirmer", "Les demandes déjà créées conserveront leur type d’origine."],
        "request-type-save": ["Type de demande enregistré", "Les nouvelles demandes suivront maintenant ce parcours."],
        "warehouse-movements": ["Mouvements d’inventaire", "Les transferts et destinations sont prêts à être consultés."],
        "warehouse-create": ["Nouvel entrepôt", "Choisissez sa portée et les profils qui peuvent le consulter."],
        "warehouse-disable": ["Désactivation à confirmer", "Les mouvements et l’historique des équipements resteront disponibles."],
        "warehouse-save": ["Entrepôt enregistré", "Les règles de visibilité sont maintenant appliquées."],
        "warehouse-inventory": ["Inventaire ouvert", "Les équipements sont affichés selon le périmètre autorisé."],
        "reminder-rule-create": ["Nouveau rappel", "Définissez sa fréquence, sa portée et les alertes attendues."],
        "reminder-rule-disable": ["Désactivation à confirmer", "Les rappels déjà effectués resteront dans l’historique."],
        "reminder-rule-save": ["Rappel enregistré", "Les prochaines alertes seront calculées selon cette règle."],
        "profile-save": ["Profil enregistré", "Vos préférences ont été mises à jour."],
        "client-settings-save": ["Paramètres enregistrés", "Les règles d’entretien, zones et accès ont été mis à jour."],
        "maintenance-rule-edit": ["Règle modifiable", "Ajustez la fréquence et le préavis; la règle la plus spécifique restera prioritaire."],
        "client-zone-add": ["Nouvelle zone", "Définissez l’immeuble, les étages concernés et les règles particulières."],
        "client-zone-edit": ["Zone modifiable", "Les étages, accès et fréquences recommandées peuvent être ajustés."],
        "client-user-add": ["Invitation prête", "Choisissez les immeubles accessibles et le droit d’envoyer des commandes."],
        "client-user-edit": ["Accès modifiable", "Le profil, le périmètre et le droit d’envoyer des commandes peuvent être ajustés."],
        "profile-password": ["Mot de passe mis à jour", "Votre accès est maintenant sécurisé."],
        "notifications-read": ["Notifications mises à jour", "Les éléments visibles sont maintenant marqués comme lus."],
        "notifications-history": ["Historique ouvert", "Les notifications précédentes peuvent maintenant être consultées."],
        "support-request": ["Demande de soutien ouverte", "Décrivez la situation pour que l’équipe Klimfax puisse vous répondre."],
        "help-planning": ["Guide de planification", "Les étapes pour organiser un bon de travail sont prêtes à être consultées."],
        "help-forms": ["Guide des formulaires", "Les règles de questions et d’affichage sont expliquées dans ce guide."],
        "help-access": ["Guide des accès", "Les droits client peuvent être vérifiés par immeuble et par profil."],
        "help-appointments": ["Guide des rendez-vous", "Les entretiens et travaux planifiés sont affichés dans votre calendrier."],
        "help-recommendations": ["Guide des recommandations", "Vous pouvez approuver, refuser ou demander des précisions à l’équipe Klimfax."],
        "help-request": ["Guide des demandes", "Une demande permet de transmettre une situation à l’équipe Klimfax."],
        "help-execution": ["Guide d’exécution", "Sélectionnez une unité, remplissez l’activité et terminez le travail."],
        "help-photos": ["Guide des pièces jointes", "Les photos et documents restent liés à la machine et au bon de travail."],
        "help-replacement": ["Guide de remplacement", "La nouvelle unité et le devenir de l’ancienne sont enregistrés dans la même activité."],
        "equipment-replacement-review": ["Évaluation demandée", "L’équipe interne responsable de Tours Laval recevra la demande; aucun BT ne sera créé automatiquement."],
        "client-group-create": ["Nouveau groupe client", "La fiche de création du siège social et de ses règles d’accès est prête."],
        "client-group-link": ["Association d’une filiale", "Sélectionnez un client indépendant à rattacher au groupe."],
        "client-group-edit": ["Configuration de la filiale", "Les immeubles et utilisateurs autorisés peuvent maintenant être ajustés."],
        "client-group-save": ["Accès enregistrés", "Les droits Headquarters ont été appliqués sans modifier les accès propres aux filiales."],
        "replacement-rule-create": ["Nouvelle règle tarifaire", "Choisissez le type d’équipement, la capacité, l’installation et le montant de référence."],
        "replacement-exception-create": ["Nouvelle exception d’immeuble", "Sélectionnez l’immeuble concerné et définissez un prix fixe ou une majoration."],
        "warranty-manufacturer-add": ["Nouveau fabricant", "Ajoutez le fabricant et la durée de sa garantie des pièces."],
        "quote-pricing-save": ["Brouillon tarifaire enregistré", "Les valeurs restent internes et n’affectent pas encore les nouvelles soumissions."],
        "quote-pricing-publish": ["Paramètres tarifaires publiés", "La version v11.2 sera appliquée aux prochaines soumissions; les propositions existantes conservent leur version."],
        "account-create": ["Création de compte", "Le parcours d’inscription est prêt à recueillir les informations de l’organisation."],
        "password-reset": ["Réinitialisation demandée", "Un lien sécurisé sera envoyé au courriel associé au compte."],
        "dashboard-edit": ["Tableau de bord modifiable", "Les indicateurs et raccourcis peuvent maintenant être personnalisés."],
        "technician-route": ["Itinéraire préparé", "Le trajet vers Condo Rivière Nord est prêt à être ouvert dans l’application de navigation."],
        "alert-equipment-list": ["Liste étendue", "Les 12 équipements couverts par ce rappel sont prêts à être consultés."],
        "requests-export": ["Export préparé", "La vue filtrée des requêtes est prête à être téléchargée."],
        "work-order-create": ["Nouveau bon de travail", "La planification peut maintenant être complétée."],
        "advanced-filters": ["Filtres avancés", "Les critères de technicien, priorité et progression sont prêts à être ajustés."],
        "work-order-edit": ["Modification du BT", "Le rendez-vous, les cibles et les activités peuvent maintenant être ajustés."],
        "work-order-target-add": ["Nouvelle cible", "Ajoutez un appartement ou un équipement au bon de travail."],
        "assignment-edit": ["Assignation modifiable", "Les techniciens et le responsable principal peuvent maintenant être ajustés."],
        "equipment-info": ["Détails de la recommandation", "Le diagnostic et les conditions sont prêts à être consultés."],
        "equipment-approve": ["Recommandation approuvée", "La décision a été transmise à l’équipe Klimfax."],
        "notification-filter": ["Filtres de notifications", "Choisissez le type, la date ou le niveau d’action requis."],
        "data-option-edit": ["Option modifiable", "Le libellé, le statut et l’ordre de cette valeur peuvent maintenant être ajustés."]
      };
      const message = messages[prototypeAction.dataset.prototypeAction];
      if (message) showToast(message[0], message[1]);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-client-scope-select]")) setClientScope(event.target.value);
    if (event.target.matches("[data-place-client-filter]")) filterPlacesByScope();
    if (event.target.matches("[data-checkout-payment]")) selectCheckoutPayment(event.target.value);
    if (event.target.matches("[data-quote-field]")) updateQuoteField(event.target);
    if (event.target.matches("[data-quote-coiljet-checkbox]")) updateMuraleCoiljetCheckbox(event.target);
    if (event.target.matches("[data-quote-status-filter], [data-quote-type-filter]")) filterQuotes();
    if (event.target.matches("[data-activity-type]")) setActivity(event.target.value);
    if (event.target.matches("[data-request-client], [data-request-location]")) {
      updateRequestFloorOptions();
      filterRequestEquipment();
    }
    if (event.target.matches("[data-request-floor], [data-request-system-type], [data-request-status]")) filterRequestEquipment();
    if (event.target.matches("[data-select-request-item]")) updateRequestSelectionBar();
    if (event.target.matches("[data-select-request-floor-group]")) {
      const section = event.target.closest("[data-request-floor-group]");
      section.querySelectorAll("[data-select-request-item]").forEach((checkbox) => { checkbox.checked = event.target.checked; });
      updateRequestSelectionBar();
    }
    if (event.target.matches("[data-inventory-client], [data-inventory-location]")) {
      updateInventoryFloorOptions();
      filterEquipmentInventory();
    }
    if (event.target.matches("[data-inventory-floor], [data-inventory-system-type], [data-inventory-status], [data-inventory-service-kind], [data-inventory-service-from], [data-inventory-service-to]")) filterEquipmentInventory();
    if (event.target.matches("[data-place-inventory-floor], [data-place-inventory-system-type], [data-place-inventory-status]")) filterPlaceEquipmentInventory();
    if (event.target.matches("[data-recommendation-advanced-filters] select, [data-recommendation-filter-option]")) renderRecommendations();
    if (event.target.matches("[data-request-record-status]")) filterRequestRecords();
    if (event.target.matches("[data-notifications-master]")) updateNotificationPreferenceState();
    if (event.target.matches("[data-select-all-planned]")) document.querySelectorAll("[data-select-planned-item]").forEach((input) => { input.checked = event.target.checked; });
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-quote-field]") && event.target.type !== "radio" && event.target.type !== "checkbox" && event.target.tagName !== "SELECT") updateQuoteField(event.target);
    if (event.target.matches("[data-quote-search]")) filterQuotes();
    if (event.target.matches("[data-sales-client-search]")) filterSalesClients();
    if (event.target.matches("[data-request-equipment-search]")) filterRequestEquipment();
    if (event.target.matches("[data-inventory-search]")) filterEquipmentInventory();
    if (event.target.matches("[data-place-inventory-search]")) filterPlaceEquipmentInventory();
    if (event.target.matches("[data-operations-search-input]")) applyWorkOrderFilters();
    if (event.target.matches("[data-recommendation-search]")) renderRecommendations();
    if (event.target.matches("[data-request-record-search]")) filterRequestRecords();
    if (event.target.matches("[data-live-directory-search]")) filterGenericDirectory(event.target);
    if (event.target.matches("[data-global-search]")) renderGlobalSearch(event.target);
    if (event.target.matches(".search input, .filter-search input, .help-search input, .request-search-field input, .inventory-search-field input, .operations-search input")) updateLiveSearchClearButton(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("[data-ai-chat-input]") && event.key === "Enter") {
      event.preventDefault();
      sendAIChatQuestion();
      return;
    }
    if (event.target.matches("[data-global-search]") && event.key === "Enter") {
      const firstResult = document.querySelector("[data-global-search-results] [data-global-search-result]");
      if (firstResult) {
        event.preventDefault();
        firstResult.click();
      }
      return;
    }
    if (event.key === "Escape") {
      closeRequestCart();
      closeAIChat();
      closeQuotePreview();
      closeApartmentPreview();
      closeGlobalSearch();
      closePlannedList();
      closeRecommendationPostpone();
      closePlaceResponsibleModal();
    }
  });

  const urlParameters = new URLSearchParams(window.location.search);
  const initialScreen = urlParameters.get("screen");
  const initialRole = urlParameters.get("role");
  const initialClientScope = urlParameters.get("scope");
  const initialClientProfileScope = urlParameters.get("clientProfile");
  const initialBackground = urlParameters.get("background");
  if (clientScopeData[initialClientProfileScope]) currentClientProfileScope = initialClientProfileScope;
  if (clientScopeData[initialClientScope]) currentClientScope = initialClientScope;
  if (currentClientProfileScope !== "group") currentClientScope = currentClientProfileScope;
  document.body.classList.toggle("login-background-island", initialBackground === "island");
  document.body.classList.toggle("login-background-coast", initialBackground === "coast");
  bindSidebarNavigation();
  buildRequestSystemCatalog();
  buildRequestFloorGroups();
  buildEquipmentInventory();
  buildPlaceEquipmentInventory();
  assignClientScopeMetadata();
  wirePrototypeControls();
  updateInventoryFloorOptions();
  filterEquipmentInventory();
  updatePlaceInventoryFloorOptions();
  filterPlaceEquipmentInventory();
  document.querySelectorAll(".sidebar-preview nav [data-screen]").forEach((button) => {
    if (!button.title) button.title = button.textContent.trim();
  });
  initializePrototypeSearches();
  setRole(initialRole || (initialScreen === "field" ? "technicien" : "interne"));
  updateRequestCatalog();
  updateRequestFloorOptions();
  filterRequestEquipment();
  updateRequestSelectionBar();
  renderRequestCart();
  setRequestRecordTab("all");
  refreshRecommendationExperience();
  updateNotificationPreferenceState();
  updateEquipmentCostSummary();
  updateEquipmentNoteCount();
  updateWarrantyDisplays();
  applyQuoteBusinessRules();
  syncQuoteControls();
  renderQuoteBuilder();
  window.KlimaParcPricingTestResults = runPricingRegressionTests();
  showScreen(initialScreen || "dashboard");
  window.requestAnimationFrame(updateWorkOrderScrollLimits);
  window.addEventListener("resize", () => window.requestAnimationFrame(updateWorkOrderScrollLimits));
  window.setTimeout(() => { document.querySelector(".prototype-toast").hidden = true; }, 3600);
  }
})();
