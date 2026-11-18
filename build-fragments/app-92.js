
  /* ------------------------------------------------------------------ */
  /* WhatsApp receipt sharing                                           */
  /* ------------------------------------------------------------------ */

  /* Privacy choice lives in memory only (audit forbids new storage keys). */
  var shareMode = "itemized";
  var shareBusy = false;

  /** Format a category value for the receipt; em dash when nothing is entered. */
  function receiptMoney(value, summary) {
    if (!(value > 0)) return "-";
    return CS.formatMoney(value, state.currency, { decimals: summary.zakat >= 1000 ? 0 : 2 });
  }

  function receiptDate() {
    try {
      return new Date().toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "";
    }
  }

  /** Rebuild every field of the receipt. Pure DOM writes, no state changes. */
  function renderShareCard() {
    var summary = Engine.compute(state);
    var itemized = shareMode === "itemized";

    setText($("shareCardDate"), receiptDate());
    setText($("shareCardCurrency"), state.currency);
    setText($("shareCardStandard"), (summary.standard === "gold" ? "Gold" : "Silver") + " nisab");
    setText(
      $("shareCardNisabStandard"),
      summary.standard === "gold" ? "gold, 87.48 g" : "silver, 612.36 g",
    );

    var rows = $("shareCardBreakdown");
    if (rows) rows.hidden = !itemized;
    setText($("shareCardCash"), receiptMoney(summary.cash, summary));
    setText($("shareCardMetals"), receiptMoney(summary.metals, summary));
    setText($("shareCardInvestments"), receiptMoney(summary.investments, summary));
    setText($("shareCardBusiness"), receiptMoney(summary.business, summary));
    setText(
      $("shareCardDebts"),
      summary.debts > 0 ? "-" + CS.formatMoney(summary.debts, state.currency, { decimals: 0 }) : "-",
    );
    setText($("shareCardNet"), receiptMoney(summary.netAssets, summary));
    show($("shareCardTotalsNote"), !itemized);

    setText($("shareCardZakat"), summary.due ? CS.formatMoney(summary.zakat, state.currency) : "-");
    setText($("shareCardNisab"), summary.hasNisabPrice ? fmt(summary.nisabValue) : "-");

    var status;
    if (summary.netAssets <= 0) {
      status = "No assets entered yet";
    } else if (!summary.hasNisabPrice) {
      status = "Metal price missing, nisab not checked";
    } else if (summary.due) {
      status = "Above nisab · Zakat is due";
    } else {
      status = "Below nisab · no Zakat due";
    }
    setText($("shareCardStatus"), status);

    return summary;
  }

  function syncShareTrigger() {
    /* The receipt opens from the action-row icon, which stays available. */
  }

  function setShareStatus(message, isError) {
    var node = $("whatsappShareStatus");
    if (!node) return;
    node.textContent = message || "";
    if (isError) node.setAttribute("data-state", "error");
    else node.removeAttribute("data-state");
  }

  function setShareBusy(busy) {
    shareBusy = busy;
    var send = $("whatsappShareSend");
    if (send) send.disabled = busy;
    setText($("whatsappShareSendLabel"), busy ? "Preparing…" : "Generate & share");
  }

  /**
   * Text handed to WhatsApp. Mirrors summaryForShare() but honours the privacy
   * choice made in the preview: "totals" drops every asset figure.
   */
  function shareTextForMode() {
    if (shareMode !== "totals") return summaryForShare();
    var summary = Engine.compute(state);
    var due;
    if (summary.due) {
      due = "Zakat due (2.5%): " + fmt(summary.zakat);
    } else if (summary.netAssets > 0) {
      due = "Zakat due (2.5%): none, net wealth is below the nisab.";
    } else {
      due = "Zakat due (2.5%): none, no assets entered.";
    }
    return [
      "ZakatDay. Zakat summary",
      "",
      "Currency: " + state.currency,
      "Nisab standard: " + summary.standardLabel,
      "Nisab threshold: " +
        (summary.hasNisabPrice ? fmt(summary.nisabValue) : "metal price not set"),
      due,
      "",
      "Asset figures hidden by choice.",
      "Calculated at zakatday.cc. Estimate only, verify with a qualified scholar.",
    ].join("\n");
  }


  function fillShareTextarea(text) {
    var pre = $("summaryText");
    if (pre) pre.textContent = text;
  }

  /** Resolve html2canvas if the pinned CDN script loaded; otherwise re-load it. */
  function loadHtml2Canvas() {
    if (typeof window.html2canvas === "function") return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      var settled = false;
      var done = function (value) {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.crossOrigin = "anonymous";
      script.addEventListener("load", function () {
        done(typeof window.html2canvas === "function" ? window.html2canvas : null);
      });
      script.addEventListener("error", function () {
        done(null);
      });
      document.head.appendChild(script);
      setTimeout(function () {
        done(typeof window.html2canvas === "function" ? window.html2canvas : null);
      }, 7000);
    });
  }

  function captureReceipt() {
    var node = $("zakatShareCaptureRoot");
    if (!node) return Promise.resolve(null);
    return loadHtml2Canvas().then(function (h2c) {
      if (!h2c) return null;
      return h2c(node, {
        backgroundColor: readTokenColor("--white"),
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        logging: false,
        useCORS: true,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    });
  }

  function canvasToPngFile(canvas) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== "function") {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) {
          resolve(null);
          return;
        }
        var name = "zakatday-zakat-" + new Date().toISOString().slice(0, 10) + ".png";
        try {
          resolve(new File([blob], name, { type: "image/png" }));
        } catch (error) {
          resolve(null);
        }
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  /**
   * File sharing via the Web Share API; resolves "unsupported" when unavailable.
   * The caption is omitted on purpose: sharing a file together with text makes
   * macOS and Chrome copy the same PNG onto the clipboard twice.
   */
  function webShareFiles(file) {
    if (!navigator.share || !navigator.canShare) return Promise.resolve("unsupported");
    if (!navigator.canShare({ files: [file] })) return Promise.resolve("unsupported");
    return navigator
      .share({ files: [file] })
      .then(function () {
        return "shared";
      })
      .catch(function (error) {
        return error && error.name === "AbortError" ? "cancelled" : "failed";
      });
  }

  function openWhatsAppWith(text) {
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  }

  function closeShare() {
    closeModal($("whatsappShareModal"));
  }

  /**
   * Generate the PNG receipt, hand it to the OS share sheet (which lists
   * WhatsApp), then open WhatsApp with the text. Any failure degrades to text.
   */
  function runShare() {
    if (shareBusy) return;
    setShareBusy(true);
    setShareStatus("Building your receipt image…");

    var summary = renderShareCard();
    var text = shareTextForMode();

    var finish = function (message, isError) {
      syncShareTrigger(summary);
      setShareStatus(message, isError);
    };

    var goText = function (message) {
      setShareBusy(false);
      openWhatsAppWith(text);
      finish(message, false);
      setTimeout(closeShare, 500);
    };

    captureReceipt()
      .then(function (canvas) {
        if (!canvas) return "no-capture";
        return canvasToPngFile(canvas).then(function (file) {
          if (!file) return "no-file";
          return webShareFiles(file).then(function (outcome) {
            if (outcome === "shared" || outcome === "cancelled") return outcome;
            downloadBlob(file, file.name);
            return "downloaded";
          });
        });
      })
      .then(function (outcome) {
        if (outcome === "shared") {
          setShareBusy(false);
          finish("Receipt image handed to WhatsApp.", false);
          setTimeout(closeShare, 500);
        } else if (outcome === "cancelled") {
          setShareBusy(false);
          finish("Share cancelled. Nothing was sent.", false);
        } else if (outcome === "downloaded") {
          goText("Receipt PNG saved to your device. Attach it in WhatsApp, then send the text.");
        } else if (outcome === "no-file") {
          goText("Could not encode the image. Sent the text summary instead.");
        } else {
          goText("Image generator unavailable. Sent the text summary instead.");
        }
      })
      .catch(function () {
        goText("Could not build the image. Sent the text summary instead.");
      });
  }

  function openWhatsAppShare() {
    var modal = $("whatsappShareModal");
    if (!modal) return;
    var itemized = $("shareModeItemized");
    if (itemized) itemized.checked = shareMode !== "totals";
    syncShareTrigger(Engine.compute(state));
    renderShareCard();
    setShareStatus("");
    openModal(modal);
  }

  function bindWhatsAppShare() {
    var trigger = $("whatsappBtn");
    if (trigger) {
      trigger.addEventListener("click", function () {
        openWhatsAppShare();
      });
    }

    each("[data-whatsapp-share-close]", function (node) {
      node.addEventListener("click", function () {
        var modal = $("whatsappShareModal");
        if (modal) closeModal(modal);
      });
    });

    each('input[name="sharePrivacy"]', function (node) {
      node.addEventListener("change", function () {
        shareMode = node.value === "totals" ? "totals" : "itemized";
        renderShareCard();
      });
    });

    var send = $("whatsappShareSend");
    if (send) {
      send.addEventListener("click", function () {
        runShare();
      });
    }
  }
