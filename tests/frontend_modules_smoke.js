const fs = require("fs");
const vm = require("vm");

global.window = {};

for (const file of [
  "frontend/views/places.js",
  "frontend/views/users.js",
  "frontend/views/equipment.js",
  "frontend/views/tickets.js",
  "frontend/views/work-orders.js",
  "frontend/views/settings.js",
  "frontend/views/interventions.js",
  "frontend/views/form-builder.js"
]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const places = window.ClimaParcPlacesView.create({ getState: () => ({}) });
const users = window.ClimaParcUsersView.create({ getState: () => ({}) });
const equipment = window.ClimaParcEquipmentView.create({ getState: () => ({}) });
const tickets = window.ClimaParcTicketsView.create({ getState: () => ({}) });
const workOrders = window.ClimaParcWorkOrdersView.create({ getState: () => ({}) });
const settings = window.ClimaParcSettingsView.create({ getState: () => ({}) });
const interventions = window.ClimaParcInterventionsView.create({ getState: () => ({}) });
const formBuilder = window.ClimaParcFormBuilder.create({ getState: () => ({}) });
const escapeHtml = (value) => String(value ?? "");

for (const method of [
  "buildingsView",
  "buildingDetailView",
  "buildingModal",
  "apartmentModal",
  "saveBuilding",
  "saveApartment",
  "deleteApartment"
]) {
  if (typeof places[method] !== "function") {
    throw new Error(`ClimaParcPlacesView.${method} manquant.`);
  }
}

const placeFixtureState = {
  selectedBuildingId: "b-a",
  clients: [{ id: "client-a", name: "Client A" }],
  buildings: [{ id: "b-a", clientId: "client-a", name: "Lieu A", address: "1 rue Test" }],
  apartments: [{ id: "apt-a", buildingId: "b-a", number: "101" }],
  equipment: [{ id: "eq-a", apartmentId: "apt-a", type: "PTAC", brand: "Carrier", model: "42C", status: "actif", unitKind: "monobloc" }],
  storageLocations: [{ id: "storage-a", scopeType: "building", buildingId: "b-a", clientId: "client-a", name: "Dépôt local", active: true }]
};
const placeFixtureView = window.ClimaParcPlacesView.create({
  getState: () => placeFixtureState,
  appShell: (body) => body,
  renderTopbar: (title, subtitle, actions) => `${title}|${subtitle}|${actions}`,
  currentUser: () => ({ role: "administrateur" }),
  can: () => true,
  canManageBuildings: () => true,
  canEditApartments: () => true,
  scopedBuildings: () => placeFixtureState.buildings,
  apartmentsForBuilding: (id) => placeFixtureState.apartments.filter((item) => item.buildingId === id),
  equipmentForApartment: (id) => placeFixtureState.equipment.filter((item) => item.apartmentId === id),
  escapeHtml,
  displayPhone: () => "-",
  unitKindLabel: () => "Système unique",
  statusText: (value) => value,
  modalShell: (_title, body) => body,
  phoneField: (name) => `<input name="${name}">`
});
const buildingDetail = placeFixtureView.buildingDetailView();
if (!buildingDetail.includes("Entrepôts du lieu") || !buildingDetail.includes("Dépôt local")) {
  throw new Error("Le détail du lieu doit rendre les entrepôts locaux sans erreur de portée.");
}
if (!buildingDetail.includes('data-modal="building" data-id="b-a"')) {
  throw new Error("Le bouton Modifier du lieu doit cibler le bon modal.");
}
if (!placeFixtureView.buildingModal({ id: "b-a" }).includes('value="Lieu A"')) {
  throw new Error("Le modal Modifier doit charger les données du lieu sélectionné.");
}

const userFixtureState = {
  users: [{
    id: "u-client-a",
    name: "Client A",
    email: "client-a@test.local",
    role: "client",
    clientId: "client-a",
    clientAccessLevel: "gestionnaire",
    allowedBuildingIds: ["b-a"],
    portalRights: ["portal", "lieux"]
  }],
  clients: [
    { id: "client-a", name: "Client A" },
    { id: "client-b", name: "Client B" }
  ],
  buildings: [
    { id: "b-a", clientId: "client-a", name: "Lieu A" },
    { id: "b-b", clientId: "client-b", name: "Lieu B" }
  ],
  roleDefinitions: [
    { id: "administrateur", name: "Administrateur" },
    { id: "technicien", name: "Technicien" },
    { id: "client", name: "Client" }
  ]
};
const userFixtureView = window.ClimaParcUsersView.create({
  getState: () => userFixtureState,
  currentUser: () => ({ id: "u-admin", role: "administrateur" }),
  scopedBuildings: () => userFixtureState.buildings,
  clientPortalRights: (user) => user.portalRights || [],
  portalRightsCatalog: () => [["lieux", "Voir lieux"]],
  defaultPortalRights: () => ["portal", "lieux"],
  modalShell: (_title, body) => body,
  escapeHtml,
  roleLabel: (role) => role,
  uid: (prefix) => `${prefix}-test`,
  updateUiState: () => {},
  saveUserNow: async () => {},
  showToast: () => {},
  acceptServerState: () => {},
  api: {}
});
const existingClientModal = userFixtureView.userModal({ id: "u-client-a" });
if (!existingClientModal.includes('data-user-profile') || !existingClientModal.includes('data-client-access-section')) {
  throw new Error("L'éditeur utilisateur unifié doit contenir le profil et les accès client.");
}
if (!existingClientModal.includes('data-client-id="client-a" class=""><input type="checkbox" name="allowedBuildingIds" value="b-a" checked')) {
  throw new Error("Le lieu du client lié doit être visible et sélectionné.");
}
if (!existingClientModal.includes('data-client-id="client-b" class="hidden"><input type="checkbox" name="allowedBuildingIds" value="b-b"  disabled')) {
  throw new Error("Les lieux d'un autre client doivent être masqués et désactivés.");
}
const newClientBModal = userFixtureView.userModal({ clientId: "client-b" });
if (!newClientBModal.includes('data-client-id="client-b" class=""><input type="checkbox" name="allowedBuildingIds" value="b-b"')) {
  throw new Error("Changer le client lié doit préparer les lieux correspondants.");
}

for (const method of [
  "formTemplateModal",
  "saveFormTemplate",
  "addFormQuestion",
  "addFormSection",
  "duplicateFormTemplate",
  "refreshFormBranching"
]) {
  if (typeof formBuilder[method] !== "function") {
    throw new Error(`ClimaParcFormBuilder.${method} manquant.`);
  }
}

const interventionFixtureState = {
  dataFields: [],
  equipment: [],
  workOrders: [],
  hvacSystemTypes: [
    { id: "type-split", topology: "split" },
    { id: "type-mono", topology: "monobloc" }
  ],
  hvacSystems: [
    { id: "system-split", systemTypeId: "type-split", topology: "split" },
    { id: "system-mono", systemTypeId: "type-mono", topology: "monobloc" }
  ]
};
const interventionFixtureView = window.ClimaParcInterventionsView.create({
  getState: () => interventionFixtureState,
  escapeHtml,
  formatCanadianPhone: (value) => value,
  normalizeDataOptions: (value) => value,
  formTemplateForOrder: () => ({ fields: [] }),
  formTemplateForActivity: () => ({ fields: [] })
});
const runtimeForm = (systemId, unitKind) => ({
  querySelector(selector) {
    if (selector === '[name="systemId"]') return { value: systemId };
    if (selector === '[name="unitKind"]') return { value: unitKind };
    return null;
  }
});
const sharedQuestion = { unitScopes: ["interieure", "exterieure"], systemTypeIds: ["type-split"] };
if (!interventionFixtureView.fieldAppliesToCurrentUnit(runtimeForm("system-split", "interieure"), sharedQuestion)) {
  throw new Error("Une question multi-position doit apparaître pour l'unité intérieure sélectionnée.");
}
if (!interventionFixtureView.fieldAppliesToCurrentUnit(runtimeForm("system-split", "exterieure"), sharedQuestion)) {
  throw new Error("Une question multi-position doit apparaître pour l'unité extérieure sélectionnée.");
}
if (interventionFixtureView.fieldAppliesToCurrentUnit(runtimeForm("system-mono", "monobloc"), sharedQuestion)) {
  throw new Error("Le filtre de type de système doit exclure les systèmes uniques non sélectionnés.");
}

for (const method of [
  "usersView",
  "userModal",
  "createUser",
  "deleteUser",
  "canDeleteUser"
]) {
  if (typeof users[method] !== "function") {
    throw new Error(`ClimaParcUsersView.${method} manquant.`);
  }
}

for (const method of [
  "equipmentView",
  "equipmentDetailView",
  "equipmentModal",
  "createEquipment"
]) {
  if (typeof equipment[method] !== "function") {
    throw new Error(`ClimaParcEquipmentView.${method} manquant.`);
  }
}

for (const method of [
  "ticketsView",
  "ticketItem",
  "ticketModal",
  "createTicket"
]) {
  if (typeof tickets[method] !== "function") {
    throw new Error(`ClimaParcTicketsView.${method} manquant.`);
  }
}

for (const method of [
  "workOrdersView",
  "workOrderExecutionView",
  "workOrderModal",
  "createWorkOrder"
]) {
  if (typeof workOrders[method] !== "function") {
    throw new Error(`ClimaParcWorkOrdersView.${method} manquant.`);
  }
}

let workOrderUser = { id: "u-tech", role: "technicien" };
const workOrderFixtureView = window.ClimaParcWorkOrdersView.create({
  getState: () => ({ interventionTypes: [], users: [] }),
  currentUser: () => workOrderUser,
  workOrderApartments: () => [{ id: "apt-a" }],
  can: () => false,
  escapeHtml
});
const assignedOrder = { id: "wo-a", status: "en_cours", assignedTechnicianIds: ["u-tech"], defaultActivityTypeId: "inspection" };
const assignedActions = workOrderFixtureView.workOrderActionButtons(assignedOrder, true);
if (!assignedActions.includes("Exécuter") || !assignedActions.includes("Remplir le formulaire")) {
  throw new Error("Le technicien assigné doit pouvoir exécuter et remplir le formulaire.");
}
workOrderUser = { id: "u-tech-2", role: "technicien" };
const unassignedActions = workOrderFixtureView.workOrderActionButtons(assignedOrder, true);
if (!unassignedActions.includes("Consulter") || unassignedActions.includes("Remplir le formulaire")) {
  throw new Error("Le technicien non assigné doit seulement consulter le BT.");
}
workOrderUser = { id: "u-client", role: "client" };
const clientActions = workOrderFixtureView.workOrderActionButtons(assignedOrder, true);
if (!clientActions.includes("Consulter") || clientActions.includes("Exécuter") || clientActions.includes("Remplir le formulaire")) {
  throw new Error("Le client doit seulement consulter le BT.");
}

for (const method of [
  "settingsView",
  "dataFieldModal",
  "serviceTypeModal",
  "interventionTypeModal",
  "roleModal",
  "saveDataField"
]) {
  if (typeof settings[method] !== "function") {
    throw new Error(`ClimaParcSettingsView.${method} manquant.`);
  }
}

for (const method of [
  "activityTextInput",
  "renderDynamicField",
  "updateDynamicVisibility",
  "visibleFormFieldIds",
  "branchTargetForRuntimeField"
]) {
  if (typeof interventions[method] !== "function") {
    throw new Error(`ClimaParcInterventionsView.${method} manquant.`);
  }
}

const index = fs.readFileSync("index.html", "utf8");
const appSource = fs.readFileSync("app.js", "utf8");
const workOrdersSource = fs.readFileSync("frontend/views/work-orders.js", "utf8");
const settingsSource = fs.readFileSync("frontend/views/settings.js", "utf8");
const stylesSource = fs.readFileSync("styles.css", "utf8");
for (const script of [
  "frontend/views/places.js",
  "frontend/views/users.js",
  "frontend/views/equipment.js",
  "frontend/views/tickets.js",
  "frontend/views/work-orders.js",
  "frontend/views/settings.js",
  "frontend/views/interventions.js",
  "frontend/views/form-builder.js",
  "app.js"
]) {
  if (!index.includes(script)) {
    throw new Error(`${script} absent de index.html.`);
  }
}
if (index.indexOf("frontend/views/places.js") > index.indexOf("app.js")) {
  throw new Error("places.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/users.js") > index.indexOf("app.js")) {
  throw new Error("users.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/equipment.js") > index.indexOf("app.js")) {
  throw new Error("equipment.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/tickets.js") > index.indexOf("app.js")) {
  throw new Error("tickets.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/work-orders.js") > index.indexOf("app.js")) {
  throw new Error("work-orders.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/settings.js") > index.indexOf("app.js")) {
  throw new Error("settings.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/interventions.js") > index.indexOf("app.js")) {
  throw new Error("interventions.js doit etre charge avant app.js.");
}
if (index.indexOf("frontend/views/form-builder.js") > index.indexOf("app.js")) {
  throw new Error("form-builder.js doit etre charge avant app.js.");
}

const slugifyBody = appSource.match(/function slugify\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";
if (slugifyBody.includes("settingsViewModule")) {
  throw new Error("slugify ne peut pas dependre de settingsViewModule pendant le bootstrap.");
}
const bootstrapSource = appSource.slice(0, appSource.indexOf("const placesViewModule"));
if (/\b(?:settingsViewModule|interventionsViewModule|formBuilderModule|placesViewModule|usersViewModule|equipmentViewModule|ticketsViewModule|workOrdersViewModule)\b/.test(bootstrapSource)) {
  throw new Error("Le bootstrap ne peut pas dependre d'un module de vue initialise plus tard.");
}

if (!workOrdersSource.includes("system-machine-map") || !workOrdersSource.includes("system-action-menu")) {
  throw new Error("L'execution du BT doit utiliser la fiche systeme responsive et son menu d'ajout.");
}
if (!settingsSource.includes('data-collection-key="${escapeHtml(collectionKey)}"')) {
  throw new Error("Les elements administrables doivent exposer une action de suppression securisee.");
}
const fieldModalStart = appSource.indexOf("function fieldInterventionModal");
const fieldModalEnd = appSource.indexOf("function recommendationReviewModal", fieldModalStart);
const fieldModalSource = appSource.slice(fieldModalStart, fieldModalEnd);
if (!fieldModalSource.includes('comboInput("replacementLocation"') || !fieldModalSource.includes('comboInput("replacementModel"')) {
  throw new Error("Localisation et modele du remplacement doivent utiliser les listes filtrables.");
}
const replacementMarkupIndex = fieldModalSource.indexOf("replacementEditor}");
const conclusionMarkupIndex = fieldModalSource.indexOf('>Conclusion</div>');
if (replacementMarkupIndex < 0 || conclusionMarkupIndex < 0 || replacementMarkupIndex > conclusionMarkupIndex) {
  throw new Error("La conclusion doit etre rendue apres le bloc de remplacement.");
}
if (!stylesSource.includes(".system-machine-row") || !stylesSource.includes("grid-template-columns: 1fr;")) {
  throw new Error("Le plan des systemes doit disposer d'une adaptation mobile verticale.");
}

console.log("frontend modules smoke: ok");
