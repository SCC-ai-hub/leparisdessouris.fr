(function () {
  var LANGS = [
    { code: "fr", label: "Français" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "ru", label: "Русский" }
  ];

  var LANG_STORAGE_KEY = "parisMiceLang";
  var FONT_SCALE_KEY = "parisMiceFontScale";
  // If a language is already saved, skip the full-screen picker on later pages.
  var ALWAYS_SHOW_LANG_PICKER = false;

  var FADE_MS = 280;
  var FONT_SCALE_MIN = 0.75;
  var FONT_SCALE_MAX = 2.25;
  var FONT_SCALE_STEP = 0.12;

  var FONT_HINTS = {
    ru: "Размер текста",
    en: "Text size",
    fr: "Taille du texte",
    es: "Tamaño del texto"
  };

  var FLAG_SVG = {
    ru:
      '<svg viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="20" y="0" fill="#fff"/><rect width="60" height="20" y="20" fill="#0039A6"/><rect width="60" height="20" y="40" fill="#D52B1E"/></svg>',
    en:
      '<svg viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" fill="#012169"/><path d="M0 0L60 60M60 0L0 60" stroke="#fff" stroke-width="10"/><path d="M0 0L60 60M60 0L0 60" stroke="#C8102E" stroke-width="6"/><path d="M30 0V60M0 30H60" stroke="#fff" stroke-width="16"/><path d="M30 0V60M0 30H60" stroke="#C8102E" stroke-width="10"/></svg>',
    fr:
      '<svg viewBox="0 0 60 60" aria-hidden="true"><rect width="20" height="60" x="0" fill="#002395"/><rect width="20" height="60" x="20" fill="#fff"/><rect width="20" height="60" x="40" fill="#ED2939"/></svg>',
    es:
      '<svg viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" fill="#AA151B"/><rect width="60" height="24" y="18" fill="#F1BF00"/></svg>'
  };

  function flagMarkup(code) {
    return FLAG_SVG[code];
  }

  function paragraphs(text) {
    return (text || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        return "<p>" + escapeHtml(line) + "</p>";
      })
      .join("");
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function isValidLang(code) {
    return LANGS.some(function (l) {
      return l.code === code;
    });
  }

  function getSavedLang() {
    try {
      var code = localStorage.getItem(LANG_STORAGE_KEY);
      return isValidLang(code) ? code : null;
    } catch (e) {
      return null;
    }
  }

  function saveLang(code) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch (e) {
      /* ignore */
    }
  }

  function getSavedFontScale() {
    try {
      var n = parseFloat(localStorage.getItem(FONT_SCALE_KEY));
      if (!isFinite(n)) return 1;
      return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));
    } catch (e) {
      return 1;
    }
  }

  function saveFontScale(scale) {
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(scale));
    } catch (e) {
      /* ignore */
    }
  }

  function touchDistance(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  var VIEWPORT_CONTENT =
    "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

  function resetBrowserZoom() {
    var vv = window.visualViewport;
    if (!vv || Math.abs(vv.scale - 1) < 0.02) return;
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    // Known mobile hack: briefly bump max-scale to force the browser back to 1
    meta.setAttribute("content", VIEWPORT_CONTENT.replace("maximum-scale=1", "maximum-scale=1.01"));
    window.setTimeout(function () {
      meta.setAttribute("content", VIEWPORT_CONTENT);
    }, 30);
  }

  function initPinchFontScale(onChange) {
    var scale = getSavedFontScale();
    var pinchStartDist = 0;
    var pinchStartScale = scale;
    var pinching = false;
    var usingGestureApi = false;
    var lastTouchEnd = 0;

    function applyScale(next, persist) {
      scale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next));
      document.documentElement.style.setProperty("--text-scale", String(scale));
      if (persist) saveFontScale(scale);
      if (onChange) onChange(scale);
    }

    // Apply saved scale without onChange — caller may not be ready yet
    document.documentElement.style.setProperty("--text-scale", String(scale));

    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", VIEWPORT_CONTENT);

    // Block multi-touch browser zoom as early as possible (must be non-passive)
    document.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length >= 2) {
          e.preventDefault();
          pinching = true;
          usingGestureApi = false;
          pinchStartDist = touchDistance(e.touches);
          pinchStartScale = scale;
        }
      },
      { passive: false, capture: true }
    );

    document.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length < 2) return;
        e.preventDefault();
        if (usingGestureApi) return; // iOS gesture* already drives font scale
        if (!pinching || pinchStartDist <= 0) {
          pinching = true;
          pinchStartDist = touchDistance(e.touches);
          pinchStartScale = scale;
          return;
        }
        var ratio = touchDistance(e.touches) / pinchStartDist;
        applyScale(pinchStartScale * ratio, false);
      },
      { passive: false, capture: true }
    );

    function endPinch() {
      if (pinching) {
        saveFontScale(scale);
        pinching = false;
        pinchStartDist = 0;
        usingGestureApi = false;
      }
      resetBrowserZoom();
    }

    document.addEventListener("touchend", endPinch, { passive: true, capture: true });
    document.addEventListener("touchcancel", endPinch, { passive: true, capture: true });

    // Block double-tap page zoom (keep quick taps on buttons working)
    document.addEventListener(
      "touchend",
      function (e) {
        var now = Date.now();
        if (now - lastTouchEnd <= 280) {
          var interactive =
            e.target &&
            e.target.closest &&
            e.target.closest("button, a, input, label, .flag-btn, .flag-choice");
          if (!interactive) e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );

    // Safari / iOS gesture API
    document.addEventListener(
      "gesturestart",
      function (e) {
        e.preventDefault();
        usingGestureApi = true;
        pinching = true;
        pinchStartScale = scale;
      },
      { passive: false, capture: true }
    );

    document.addEventListener(
      "gesturechange",
      function (e) {
        e.preventDefault();
        usingGestureApi = true;
        var g = typeof e.scale === "number" ? e.scale : 1;
        applyScale(pinchStartScale * g, false);
      },
      { passive: false, capture: true }
    );

    document.addEventListener(
      "gestureend",
      function (e) {
        e.preventDefault();
        saveFontScale(scale);
        pinching = false;
        usingGestureApi = false;
        resetBrowserZoom();
      },
      { passive: false, capture: true }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resetBrowserZoom);
      window.visualViewport.addEventListener("scroll", resetBrowserZoom);
    }
    window.addEventListener("resize", resetBrowserZoom);

    return {
      getScale: function () {
        return scale;
      },
      stepBy: function (delta) {
        applyScale(scale + delta, true);
      }
    };
  }

  function assetRoot() {
    var base = document.querySelector('script[src*="qr-text.js"]');
    return base ? base.getAttribute("src").replace(/js\/qr-text\.js.*$/, "") : "../../";
  }

  function initScroll(textSection) {
    var scrollTrack = qs(".scroll-track");
    var scrollThumb = qs(".scroll-thumb");
    var btnUp = qs("[data-scroll-up]");
    var btnDown = qs("[data-scroll-down]");
    if (!textSection || !scrollTrack || !scrollThumb) return { reset: function () {}, update: function () {} };

    function maxScroll() {
      return Math.max(0, textSection.scrollHeight - textSection.clientHeight);
    }

    function updateScrollArrows() {
      if (!btnUp || !btnDown) return;
      var top = textSection.scrollTop;
      var max = maxScroll();
      var atTop = top <= 1;
      var atBottom = max <= 0 || top >= max - 1;
      btnUp.classList.toggle("scroll-btn--inactive", atTop);
      btnDown.classList.toggle("scroll-btn--inactive", atBottom);
      btnUp.disabled = atTop;
      btnDown.disabled = atBottom;
    }

    function updateScrollbar() {
      var scrollHeight = textSection.scrollHeight;
      var clientHeight = textSection.clientHeight;
      var max = maxScroll();
      if (max <= 0) {
        scrollTrack.style.visibility = "hidden";
      } else {
        scrollTrack.style.visibility = "visible";
        var trackHeight = scrollTrack.clientHeight;
        var ratio = clientHeight / scrollHeight;
        var thumbHeight = Math.max(ratio * trackHeight * 0.5, trackHeight * 0.08);
        var maxThumbTop = trackHeight - thumbHeight;
        var thumbTop = max > 0 ? (textSection.scrollTop / max) * maxThumbTop : 0;
        scrollThumb.style.height = thumbHeight + "px";
        scrollThumb.style.transform = "translateY(" + thumbTop + "px)";
      }
      updateScrollArrows();
    }

    var scrollAnimating = false;
    var burstCount = 0;
    var lastDir = 0;
    var pendingDir = 0;
    var idleTimer = null;
    var IDLE_RESET_MS = 900;

    function scrollStep() {
      return Math.max(120, textSection.clientHeight * 0.28);
    }

    function armIdleReset() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        burstCount = 0;
        lastDir = 0;
        pendingDir = 0;
      }, IDLE_RESET_MS);
    }

    function canScroll(direction) {
      if (direction < 0) {
        return btnUp && !btnUp.classList.contains("scroll-btn--inactive");
      }
      return btnDown && !btnDown.classList.contains("scroll-btn--inactive");
    }

    function animatedScrollBy(pixels, onDone) {
      var start = textSection.scrollTop;
      var end = Math.max(0, Math.min(start + pixels, maxScroll()));
      var total = end - start;
      if (total === 0) {
        if (onDone) onDone();
        return;
      }
      scrollAnimating = true;
      var duration = 550;
      var startTime = null;

      function step(ts) {
        if (!startTime) startTime = ts;
        var t = (ts - startTime) / duration;
        if (t >= 1) {
          textSection.scrollTop = end;
          scrollAnimating = false;
          if (onDone) onDone();
          return;
        }
        var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        textSection.scrollTop = start + total * ease;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function finishScrollCycle() {
      updateScrollArrows();
      if (pendingDir && canScroll(pendingDir)) {
        var dir = pendingDir;
        pendingDir = 0;
        startScroll(dir, false);
        return;
      }
      pendingDir = 0;
      armIdleReset();
    }

    function startScroll(direction, countTap) {
      if (countTap) {
        if (direction !== lastDir) {
          burstCount = 0;
          lastDir = direction;
        }
        burstCount += 1;
        clearTimeout(idleTimer);
      }
      if (!canScroll(direction)) {
        burstCount = 0;
        pendingDir = 0;
        updateScrollArrows();
        return;
      }
      var mult = burstCount >= 3 ? 2 : 1;
      animatedScrollBy(direction * scrollStep() * mult, finishScrollCycle);
    }

    function onArrowClick(direction) {
      if (!canScroll(direction)) return;
      if (scrollAnimating) {
        if (direction !== lastDir) {
          burstCount = 0;
          lastDir = direction;
        }
        burstCount += 1;
        pendingDir = direction;
        clearTimeout(idleTimer);
        return;
      }
      startScroll(direction, true);
    }

    function resetScroll() {
      textSection.scrollTop = 0;
      burstCount = 0;
      lastDir = 0;
      pendingDir = 0;
      clearTimeout(idleTimer);
      updateScrollbar();
    }

    if (btnUp) btnUp.addEventListener("click", function () { onArrowClick(-1); });
    if (btnDown) btnDown.addEventListener("click", function () { onArrowClick(1); });
    textSection.addEventListener("scroll", updateScrollbar, { passive: true });
    window.addEventListener("resize", updateScrollbar);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(updateScrollbar).observe(textSection);
    }
    updateScrollbar();
    return { reset: resetScroll, update: updateScrollbar };
  }

  function buildFlags(container, sizeClass, withLabels, onPick) {
    container.innerHTML = "";
    LANGS.forEach(function (lang) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = sizeClass || "flag-btn";
      btn.dataset.lang = lang.code;
      btn.setAttribute("aria-label", lang.label);
      btn.innerHTML = flagMarkup(lang.code);

      if (withLabels) {
        var wrap = document.createElement("button");
        wrap.type = "button";
        wrap.className = "flag-choice";
        wrap.setAttribute("aria-label", lang.label);
        btn.tabIndex = -1;
        btn.setAttribute("aria-hidden", "true");
        wrap.appendChild(btn);
        var lab = document.createElement("span");
        lab.className = "flag-label";
        lab.textContent = lang.label;
        wrap.appendChild(lab);
        wrap.addEventListener("click", function () {
          onPick(lang.code);
        });
        container.appendChild(wrap);
      } else {
        btn.addEventListener("click", function () {
          onPick(lang.code);
        });
        container.appendChild(btn);
      }
    });
  }

  function boot(entry) {
    var textBody = qs("[data-text-body]");
    var textCode = qs("[data-text-code]");
    var overlay = qs("[data-lang-overlay]");
    var overlayFlags = qs("[data-overlay-flags]");
    var barFlags = qs("[data-bar-flags]");
    var textSection = qs(".text-section");
    var btnFontMinus = qs("[data-font-minus]");
    var btnFontPlus = qs("[data-font-plus]");
    var fontHint = qs("[data-font-hint]");
    var scrollApi = initScroll(textSection);
    var currentLang = null;
    var fading = false;

    if (textCode) textCode.textContent = entry.id;

    function markActiveFlags(code) {
      qsa(".flag-btn", barFlags).forEach(function (b) {
        b.classList.toggle("is-active", b.dataset.lang === code);
      });
    }

    function updateFontHint(code) {
      if (!fontHint) return;
      fontHint.textContent = FONT_HINTS[code] || FONT_HINTS.en;
    }

    function applyText(code) {
      textBody.innerHTML = paragraphs(entry.texts[code] || "");
      scrollApi.reset();
      requestAnimationFrame(function () {
        scrollApi.update();
      });
    }

    function setLang(code, opts) {
      opts = opts || {};
      var fromOverlay = !!opts.fromOverlay;
      var animate = opts.animate !== false && currentLang && currentLang !== code;

      if (!isValidLang(code)) return;
      if (fading) return;
      if (currentLang === code && !fromOverlay) return;

      saveLang(code);
      document.body.classList.add("has-lang");
      document.documentElement.lang = code;
      markActiveFlags(code);
      updateFontHint(code);

      if (fromOverlay && overlay) {
        overlay.classList.add("is-hidden");
      }

      if (!animate) {
        currentLang = code;
        applyText(code);
        textBody.classList.remove("is-fading");
        return;
      }

      fading = true;
      textBody.classList.add("is-fading");
      window.setTimeout(function () {
        currentLang = code;
        applyText(code);
        void textBody.offsetWidth;
        textBody.classList.remove("is-fading");
        fading = false;
      }, FADE_MS);
    }

    buildFlags(overlayFlags, "flag-btn", true, function (code) {
      setLang(code, { fromOverlay: true, animate: false });
    });

    buildFlags(barFlags, "flag-btn", false, function (code) {
      setLang(code, { fromOverlay: false, animate: true });
    });

    var fontApi = initPinchFontScale(function () {
      updateFontButtons();
      requestAnimationFrame(function () {
        scrollApi.update();
      });
    });

    function updateFontButtons() {
      var s = fontApi.getScale();
      if (btnFontMinus) {
        btnFontMinus.disabled = s <= FONT_SCALE_MIN + 0.001;
        btnFontMinus.classList.toggle("is-disabled", btnFontMinus.disabled);
      }
      if (btnFontPlus) {
        btnFontPlus.disabled = s >= FONT_SCALE_MAX - 0.001;
        btnFontPlus.classList.toggle("is-disabled", btnFontPlus.disabled);
      }
    }

    if (btnFontMinus) {
      btnFontMinus.addEventListener("click", function () {
        fontApi.stepBy(-FONT_SCALE_STEP);
      });
    }
    if (btnFontPlus) {
      btnFontPlus.addEventListener("click", function () {
        fontApi.stepBy(FONT_SCALE_STEP);
      });
    }
    updateFontButtons();

    var saved = getSavedLang();
    if (saved && !ALWAYS_SHOW_LANG_PICKER) {
      setLang(saved, { fromOverlay: true, animate: false });
    } else if (saved) {
      markActiveFlags(saved);
      updateFontHint(saved);
    } else {
      updateFontHint("fr");
    }
  }

  window.QRTextApp = {
    boot: boot,
    load: function (textId) {
      var root = assetRoot();
      return fetch(root + "data/texts.json")
        .then(function (r) {
          return r.json();
        })
        .then(function (list) {
          var entry = list.find(function (x) {
            return x.id === textId || x.slug === textId;
          });
          if (!entry) throw new Error("Text not found: " + textId);
          boot(entry);
        });
    }
  };
})();
