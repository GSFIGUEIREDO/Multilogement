(function () {
  const STATUS_ORDER = {
    a_valider: 0,
    information_demandee: 1,
    envoyee: 2,
    approuvee: 3,
    refusee: 4
  };

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const first = STATUS_ORDER[a.recommendation.status] ?? 9;
      const second = STATUS_ORDER[b.recommendation.status] ?? 9;
      return first - second || (b.recommendation.createdAt || "").localeCompare(a.recommendation.createdAt || "");
    });
  }

  function canSeePrice(user, canPortal) {
    return user?.role !== "client" || canPortal("recommendation_prices");
  }

  function canApprove(user, canPortal) {
    return user?.role !== "client" || canPortal("recommendation_approve");
  }

  window.ClimaParcRecommendationsView = {
    sortItems,
    canSeePrice,
    canApprove
  };
})();
