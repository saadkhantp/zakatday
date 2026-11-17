
  /** Copy text with a clipboard fallback for non-secure contexts. */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        },
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function showToast(message, options) {
    var toast = $("saveToast");
    var text = $("saveToastText");
    var action = $("saveToastAction");
    if (!toast || !text) return;
    setText(text, message);
    var opts = options || {};
    undoAction = typeof opts.onAction === "function" ? opts.onAction : null;
    if (action) {
      action.hidden = !undoAction;
      setText(action, opts.actionLabel || "Undo");
    }
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
      undoAction = null;
    }, opts.duration || 4200);
  }
