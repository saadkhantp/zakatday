
  /* ------------------------------------------------------------------ */
  /* Currency picker + favourites                                       */
  /* ------------------------------------------------------------------ */

  function renderFavPills() {
    /* Favourite pills were removed. Currency is chosen from the header. */
  }

  function renderCurrencyList(query) {
    var list = $("currencyList");
    if (!list) return;
    var matches = CS.searchCurrencies(query);
    var favorites = CS.getFavorites();
    list.textContent = "";

    if (!matches.length) {
      var empty = document.createElement("p");
      empty.className = "picker-empty";
      empty.textContent = "No currency matches “" + String(query).trim() + "”.";
      list.appendChild(empty);
      return;
    }

    var pinned = matches.filter(function (entry) {
      return favorites.indexOf(entry.code) !== -1;
    });
    var others = matches.filter(function (entry) {
      return favorites.indexOf(entry.code) === -1;
    });

    var addSection = function (label, entries) {
      if (!entries.length) return;
      var heading = document.createElement("p");
      heading.className = "picker-section-label";
      heading.textContent = label;
      list.appendChild(heading);
      entries.forEach(function (entry) {
        list.appendChild(currencyRow(entry));
      });
    };

    addSection("Pinned", pinned);
    addSection(query ? "Results" : "All currencies", others);
  }

  function currencyRow(entry) {
    var row = document.createElement("div");
    row.className = "currency-option";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", entry.code === state.currency ? "true" : "false");
    row.setAttribute("aria-checked", entry.code === state.currency ? "true" : "false");
    row.setAttribute("tabindex", "0");
    row.dataset.currency = entry.code;

    var flag = document.createElement("span");
    flag.className = "currency-option__flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = CS.flagFor(entry.country);

    var codeNode = document.createElement("span");
    codeNode.className = "currency-option__code";
    codeNode.textContent = entry.code;

    var nameNode = document.createElement("span");
    nameNode.className = "currency-option__name";
    nameNode.textContent = entry.name;

    var symbolNode = document.createElement("span");
    symbolNode.className = "currency-option__symbol";
    symbolNode.setAttribute("aria-hidden", "true");
    symbolNode.textContent = entry.symbol;

    var star = document.createElement("button");
    star.type = "button";
    star.className = "currency-option__star";
    star.setAttribute(
      "aria-pressed",
      CS.getFavorites().indexOf(entry.code) !== -1 ? "true" : "false",
    );
    star.setAttribute("aria-label", "Pin " + entry.code + " to favourites");
    var starIcon = document.createElement("span");
    starIcon.className = "material-symbols-outlined";
    starIcon.setAttribute("aria-hidden", "true");
    starIcon.textContent = "star";
    star.appendChild(starIcon);

    row.appendChild(flag);
    row.appendChild(codeNode);
    row.appendChild(nameNode);
    row.appendChild(symbolNode);
    row.appendChild(star);

    row.addEventListener("click", function (event) {
      if (event.target.closest(".currency-option__star")) return;
      changeCurrency(entry.code);
    });
    row.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        changeCurrency(entry.code);
      }
    });
    star.addEventListener("click", function (event) {
      event.stopPropagation();
      togglePin(entry.code, star);
    });

    return row;
  }

  function togglePin(code, star) {
    var result = CS.toggleFavorite(code);
    var pinnedNow = result.list.indexOf(code) !== -1;
    if (star) {
      star.setAttribute("aria-pressed", pinnedNow ? "true" : "false");
      flashClass(star, "animate-saved-menu-pulse");
    }
    refreshPickerViews();
    var evicted = result.evicted ? " (" + result.evicted + " unpinned)" : "";
    showToast(
      pinnedNow ? code + " pinned to your currencies" + evicted : code + " removed from favourites",
      {
        duration: 3200,
        onAction: function () {
          CS.toggleFavorite(code);
          if (result.evicted) CS.toggleFavorite(result.evicted);
          refreshPickerViews();
          render();
        },
      },
    );
  }

  function refreshPickerViews() {
    renderFavPills();
    var search = $("currencySearch");
    renderCurrencyList(search ? search.value : "");
    syncPinToggle();
  }

  function syncPinToggle() {
    var toggle = $("pinCurrentToggle");
    if (!toggle) return;
    toggle.checked = CS.getFavorites().indexOf(state.currency) !== -1;
  }
