const fs = require("fs");
const vm = require("vm");

global.window = {};

for (const file of [
  "frontend/views/places.js",
  "frontend/views/users.js"
]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const places = window.ClimaParcPlacesView.create({ getState: () => ({}) });
const users = window.ClimaParcUsersView.create({ getState: () => ({}) });

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

const index = fs.readFileSync("index.html", "utf8");
for (const script of [
  "frontend/views/places.js",
  "frontend/views/users.js",
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

console.log("frontend modules smoke: ok");
