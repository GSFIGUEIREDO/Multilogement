const fs = require("fs");
const vm = require("vm");

global.window = {};
let activePosts = 0;
let maxActivePosts = 0;
const startedPaths = [];

global.fetch = async (path, options = {}) => {
  const isPost = options.method === "POST";
  if (isPost) {
    activePosts += 1;
    maxActivePosts = Math.max(maxActivePosts, activePosts);
    startedPaths.push(path);
    await new Promise((resolve) => setTimeout(resolve, path.includes("equipment") ? 25 : 5));
    activePosts -= 1;
  }
  if (path === "/api/failure") {
    return { ok: false, status: 409, json: async () => ({ detail: "Conflit de version" }) };
  }
  return { ok: true, status: 200, json: async () => ({ ok: true, state: {} }) };
};

vm.runInThisContext(fs.readFileSync("frontend/api.js", "utf8"), { filename: "frontend/api.js" });

async function run() {
  const api = window.ClimaParcApi;
  const first = api.saveEquipment({ id: "eq-a" });
  const second = api.saveTicket({ id: "ticket-a" });
  if (!api.hasPendingMutations()) throw new Error("La file doit signaler les mutations en attente.");
  await Promise.all([first, second]);
  if (maxActivePosts !== 1) throw new Error(`Mutations concurrentes dans le meme navigateur: ${maxActivePosts}`);
  if (startedPaths.join(",") !== "/api/equipment,/api/ticket") throw new Error("La file de mutations ne respecte pas l'ordre des actions.");
  if (api.hasPendingMutations()) throw new Error("La file reste marquee active apres les sauvegardes.");
  if (api.mutationGeneration() !== 2) throw new Error("Generation de synchronisation incorrecte.");

  const appSource = fs.readFileSync("app.js", "utf8");
  const refreshBlock = appSource.slice(
    appSource.indexOf("async function refreshStateFromServer"),
    appSource.indexOf("function startAutoRefresh")
  );
  if (!refreshBlock.includes("refreshUiRevision !== uiRevision")) throw new Error("Le rafraichissement ne protege pas la revision UI.");
  if (!refreshBlock.includes("api.hasPendingMutations")) throw new Error("Le rafraichissement ignore les sauvegardes en cours.");
  if (refreshBlock.includes("restoringSession = true")) throw new Error("Le rafraichissement ne doit pas bloquer les sauvegardes utilisateur.");

  const toastBlock = appSource.slice(
    appSource.indexOf("function scheduleToastClear"),
    appSource.indexOf("function showToastWithoutRender")
  );
  if (toastBlock.includes("render()")) throw new Error("La disparition d'un message ne doit pas reconstruire un formulaire en cours.");
  if (!appSource.includes('patch, "activeView") && patch.activeView !== previousView')) {
    throw new Error("Les modales ne doivent pas polluer l'historique de navigation.");
  }
  const acceptServerBlock = appSource.slice(
    appSource.indexOf("function captureMutationUiContext"),
    appSource.indexOf("function stableJson")
  );
  if (!acceptServerBlock.includes("mutationUiContextIsCurrent")) {
    throw new Error("Les reponses retardees ne protegent pas le contexte de navigation.");
  }
  if (!acceptServerBlock.includes("uiPatch.toast ? { toast: uiPatch.toast }")) {
    throw new Error("Une reponse retardee peut encore changer de page.");
  }
  const historyBlock = appSource.slice(
    appSource.indexOf("function applyBrowserHistoryState"),
    appSource.indexOf("function goBack")
  );
  if (!historyBlock.includes("lastNavigationAt = lastLocalChangeAt")) {
    throw new Error("Le retour du navigateur n'est pas protege contre les reponses retardees.");
  }

  console.log("frontend sync smoke: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
