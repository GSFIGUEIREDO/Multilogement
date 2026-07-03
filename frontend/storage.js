(function () {
  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (error) {
      localStorage.removeItem(key);
      return null;
    }
  }

  function write(key, state) {
    localStorage.setItem(key, JSON.stringify({ ...state, toast: "" }));
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  window.ClimaParcStorage = { read, write, remove };
})();
