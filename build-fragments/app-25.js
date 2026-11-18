/* ------------------------------------------------------------------ */
  /* Motion + interaction polish                                        */
  /* Scroll reveal, value fades and the "Check your Zakat" hand-off.    */
  /* Everything here degrades to a static page without JS or motion.    */
  /* ------------------------------------------------------------------ */

  var motionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  /** True when animation is wanted: motion-in is set by theme-init.js. */
  function motionOn() {
    if (motionQuery && motionQuery.matches) return false;
    return document.documentElement.classList.contains("motion-in");
  }

  function scrollBehavior() {
    return motionOn() ? "smooth" : "auto";
  }

  /**
   * Staggered fade-up for items a user just asked for (modal bodies, toast
   * cards). Only elements carrying `data-reveal` are touched, so ordinary
   * content is never hidden.
   */
  function revealChildren(host, options) {
    if (!host) return;
    var opts = options || {};
    var step = opts.step === undefined ? 40 : opts.step;
    var nodes = host.querySelectorAll("[data-reveal]");
    Array.prototype.forEach.call(nodes, function (node) {
      node.removeAttribute("data-revealed");
      if (!motionOn()) {
        node.setAttribute("data-revealed", "true");
        return;
      }
      node.style.setProperty("--reveal-delay", (opts.index || 0) * step + "ms");
    });
    /* Force the pre-reveal frame, then flip the attribute so the CSS
       transition has a start value to animate from. */
    void host.offsetWidth;
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(nodes, function (node) {
        node.setAttribute("data-revealed", "true");
      });
    });
  }

  /** Fade a value that just changed (stat numbers, summary lines). */
  function flashText(node) {
    if (!node || !motionOn()) return;
    node.classList.remove("motion-fade");
    void node.offsetWidth;
    node.classList.add("motion-fade");
  }


  /** Reveal section cards as they enter the viewport, once each. */
  function revealOnScroll() {
    if (!motionOn()) return;
    var targets = document.querySelectorAll("main > section");
    if (!targets.length) return;

    var viewport = window.innerHeight || 0;
    var candidates = [];
    Array.prototype.forEach.call(targets, function (node, index) {
      /* Anything already on the first screen stays untouched, so the initial
         paint and largest-contentful-paint are unaffected. */
      if (node.getBoundingClientRect().top < viewport * 0.9) return;
      node.setAttribute("data-reveal", "");
      node.style.setProperty("--reveal-delay", Math.min(index, 4) * 30 + "ms");
      candidates.push(node);
    });
    if (!candidates.length) return;

    if (typeof window.IntersectionObserver !== "function") {
      candidates.forEach(function (node) {
        node.setAttribute("data-revealed", "true");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    candidates.forEach(function (node) {
      observer.observe(node);
    });
  }

  /** Smooth in-page jump used by "Check Your Due Zakat". */
  function scrollToNode(node, offset) {
    if (!node) return;
    var top = node.getBoundingClientRect().top + (window.pageYOffset || 0) - (offset || 12);
    window.scrollTo({ top: Math.max(0, top), behavior: scrollBehavior() });
  }

  /* ------------------------------------------------------------------ */
  /* About / How it works                                               */
  /* ------------------------------------------------------------------ */

  var aboutReturnFocus = null;

  function openAbout(returnFocus) {
    var modal = $("aboutModal");
    if (!modal) return;
    aboutReturnFocus = returnFocus || null;
    openModal(modal);
    var body = $("aboutModalBody");
    if (body) revealChildren(body, { step: 35 });
    var closeBtn = modal.querySelector(".header-icon-btn");
    if (closeBtn) {
      setTimeout(function () {
        closeBtn.focus({ preventScroll: true });
      }, 60);
    }
  }

  function bindAboutModal() {
    var trigger = $("aboutBtn");
    var modal = $("aboutModal");
    if (!modal) return;

    function close() {
      closeModal(modal);
      if (aboutReturnFocus && aboutReturnFocus.focus) {
        aboutReturnFocus.focus({ preventScroll: true });
      }
    }

    if (trigger) {
      trigger.addEventListener("click", function () {
        openAbout(trigger);
      });
    }

    each("[data-about-close]", function (node) {
      node.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* "Check Your Due Zakat"                                             */
  /* ------------------------------------------------------------------ */

  /**
   * The results card sits below the inputs, so the button stays disabled until
   * there is something to check, then hands the user straight to the result.
   */
  function bindCheckDue() {
    var btn = $("checkDueBtn");
    var card = $("zakatCard");
    if (!btn) return;

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      render();
      scrollToNode(card, 12);
      if (card) {
        card.classList.remove("is-flashing");
        void card.offsetWidth;
        card.classList.add("is-flashing");
        setTimeout(function () {
          card.classList.remove("is-flashing");
        }, 1000);
        if (card.hasAttribute("tabindex")) card.focus({ preventScroll: true });
      }
      flashText($("zakatAmount"));
      var hint = $("checkDueHint");
      if (hint) hint.hidden = true;
    });
  }

  /** Enable the check button as soon as any asset weighs in. */
  function syncCheckDue(summary) {
    var btn = $("checkDueBtn");
    var hint = $("checkDueHint");
    if (!btn) return;
    var ready = Boolean(summary) && summary.netAssets > 0;
    btn.disabled = !ready;
    if (hint) hint.hidden = ready;
  }

