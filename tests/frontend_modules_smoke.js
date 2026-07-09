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

console.log("frontend modules smoke: ok");
