  /* ------------------------------------------------------------------ */
  /* Sheet / modal plumbing (AyahDay attachBottomSheetDrag pattern)      */
  /* ------------------------------------------------------------------ */

  var openSheet = null;

  function attachBottomSheetDrag(options) {
    var sheet = options.sheet;
    var panel = options.panel;
    var handle = options.handle || panel;
    var backdrop = options.backdrop;
    var close = options.close;
    var snap = options.snap || 0.25;
    var canStart = options.canStart;
    if (!sheet || !panel) return null;

    var dragY = 0;
    var startY = 0;
    var startedAt = 0;
    var dragging = false;

    function height() {
      return panel.getBoundingClientRect().height || 1;
    }

    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (canStart && !canStart(event)) return;
      dragging = true;
      startY = event.clientY;
      startedAt = Date.now();
      dragY = 0;
      panel.classList.add("more-sheet__panel--dragging");
      if (handle.setPointerCapture) {
        try {
          handle.setPointerCapture(event.pointerId);
        } catch (e) {
          /* ignore */
        }
      }
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!dragging) return;
      dragY = Math.max(0, event.clientY - startY);
      panel.style.transform = "translateY(" + dragY + "px)";
      if (backdrop) backdrop.style.opacity = String(Math.max(0.2, 1 - dragY / height()));
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      var elapsed = Math.max(1, Date.now() - startedAt);
      var velocity = dragY / elapsed;
      panel.classList.remove("more-sheet__panel--dragging");
      panel.style.transform = "";
      if (backdrop) backdrop.style.opacity = "";
      var closed = dragY > height() * snap || (dragY > 40 && velocity > 0.55);
      if (closed && close) close();
    }

    /* Listeners live on the grab handle only, so taps inside the sheet body are
       never interpreted as a drag gesture. */
    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }

  function openSheetEl(sheet, trigger, onOpened) {
    if (!sheet || openSheet === sheet) return;
    if (openSheet) closeSheetEl(openSheet);
    sheet.hidden = false;
    openSheet = sheet;
    document.body.style.overflow = "hidden";
    if (trigger) {
      sheet.dataset.triggerId = trigger.id;
      trigger.setAttribute("aria-expanded", "true");
    }
    requestAnimationFrame(function () {
      sheet.setAttribute("data-open", "true");
    });
    var panel = sheet.querySelector(".more-sheet__panel");
    if (!sheet.dataset.dragReady && panel) {
      sheet.dataset.dragReady = "1";
      attachBottomSheetDrag({
        sheet: sheet,
        panel: panel,
        handle: sheet.querySelector("[data-sheet-drag]") || panel,
        backdrop: sheet.querySelector(".more-sheet__backdrop"),
        close: function () {
          closeSheetEl(sheet);
        },
        canStart: function (event) {
          return !event.target.closest("input, select, textarea, a, button");
        },
      });
    }
    var focusTarget =
      sheet.querySelector("[data-sheet-autofocus]") || sheet.querySelector(".more-sheet__title");
    if (focusTarget) {
      if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
      setTimeout(function () {
        focusTarget.focus({ preventScroll: true });
      }, 60);
    }
    if (typeof onOpened === "function") onOpened();
  }

  function closeSheetEl(sheet) {
    if (!sheet || sheet.hidden) return;
    sheet.setAttribute("data-open", "false");
    var trigger = sheet.dataset.triggerId ? $(sheet.dataset.triggerId) : null;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      sheet.hidden = true;
      if (openSheet === sheet) {
        openSheet = null;
        document.body.style.overflow = "";
        if (trigger) trigger.focus({ preventScroll: true });
      }
    }, 300);
  }

  function openModal(modal) {
    if (!modal || !modal.hidden) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var focusTarget = modal.querySelector(".updates-modal__got-it");
    if (focusTarget) {
      setTimeout(function () {
        focusTarget.focus({ preventScroll: true });
      }, 40);
    }
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (!openSheet && !document.querySelector(".updates-modal:not([hidden])")) {
      document.body.style.overflow = "";
    }
  }
