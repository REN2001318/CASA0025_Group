/* ===================================================================
   Shorebird Habitat Assessment — Case Study Page Logic
   - Scroll-spy for sticky TOC
   - IntersectionObserver fade-ins
   - GEE iframe loaded-state
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------
     1. FADE-IN ON SCROLL
  ----------------------------------------------------------------- */
  const fadeEls = document.querySelectorAll(".fade-in");
  if ("IntersectionObserver" in window && fadeEls.length) {
    const fadeObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    fadeEls.forEach((el) => fadeObs.observe(el));
  } else {
    fadeEls.forEach((el) => el.classList.add("in-view"));
  }

  /* -----------------------------------------------------------------
     2. SCROLL-SPY FOR TOC
  ----------------------------------------------------------------- */
  const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));
  const sections = tocLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function setActive(id) {
    tocLinks.forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === "#" + id)
    );
  }

  if ("IntersectionObserver" in window && sections.length) {
    const visible = new Map();
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          visible.set(e.target.id, e.intersectionRatio);
        });
        let bestId = null;
        let bestRatio = 0;
        visible.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        if (bestId && bestRatio > 0) setActive(bestId);
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );
    sections.forEach((s) => spy.observe(s));
  }

  // Smooth-scroll click (offset for sticky topbar)
  tocLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });

  /* -----------------------------------------------------------------
     3. GEE IFRAME LOADED STATE
  ----------------------------------------------------------------- */
  const iframe = document.querySelector(".gee-frame iframe");
  const loading = document.getElementById("geeLoading");
  if (iframe && loading) {
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      loading.classList.add("hidden");
      setTimeout(() => {
        loading.style.display = "none";
      }, 600);
    };
    iframe.addEventListener("load", hide);
    // Fallback in case the cross-origin iframe never fires `load` reliably
    setTimeout(hide, 6000);
  }

  /* -----------------------------------------------------------------
     4. TOPBAR SHADOW ON SCROLL
  ----------------------------------------------------------------- */
  const topbar = document.getElementById("topbar");
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    if (topbar) {
      topbar.classList.toggle("scrolled", y > 24);
    }
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* -----------------------------------------------------------------
     5. APP-MODE: collapse TOC into a chip when #application is active
  ----------------------------------------------------------------- */
  const appSection = document.getElementById("application");
  const tocEl = document.getElementById("toc");
  const tocChipBtn = document.getElementById("tocChipBtn");

  // Measure where the figure sits in the article column and set a CSS var
  // so the in-app breakout is exactly 25px from each viewport edge.
  // The GEE figure is always full-bleed (1390 px wide on 1440 vp).
  // We measure the article column's left edge so the figure sits exactly 25 px
  // from each viewport edge, regardless of scroll position.
  // We bypass the CSS cascade by setting the transform directly via inline
  // style — that guarantees the breakout shift wins over any other rule.
  function updateBreakShift() {
    const article = document.querySelector(".article");
    const fig = document.querySelector(".gee-figure");
    if (!article || !fig) return;
    // On small screens, no breakout — let the figure follow the article column.
    if (window.matchMedia("(max-width: 980px)").matches) {
      fig.style.transform = "";
      fig.style.width = "";
      document.documentElement.style.setProperty("--break-shift", "0px");
      return;
    }
    const articleLeft = article.getBoundingClientRect().left;
    const shift = 25 - articleLeft;
    document.documentElement.style.setProperty("--break-shift", shift + "px");
    fig.style.transform = "translateX(" + shift + "px)";
    fig.style.width = "calc(100vw - 50px)";
  }
  // Compute once layout settles, and on every viewport resize.
  setTimeout(updateBreakShift, 100);
  setTimeout(updateBreakShift, 600);   // catch web-font / image reflow
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(updateBreakShift, 100);
  });

  // The TOC still collapses into a chip while the application section is
  // visible — that prevents the sidebar from overlapping the wide GEE figure.
  if (appSection && tocEl && "IntersectionObserver" in window) {
    const appObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            document.body.classList.add("in-app");
          } else {
            document.body.classList.remove("in-app");
            tocEl.classList.remove("expanded");
          }
        });
      },
      { threshold: 0 }
    );
    appObs.observe(appSection);
  }

  // Chip toggle
  if (tocChipBtn && tocEl) {
    tocChipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = tocEl.classList.toggle("expanded");
      tocChipBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!tocEl.contains(e.target)) {
        tocEl.classList.remove("expanded");
        tocChipBtn.setAttribute("aria-expanded", "false");
      }
    });
    // Collapse when a TOC link is clicked (only in chip mode)
    tocEl.querySelectorAll(".toc-list a").forEach((a) => {
      a.addEventListener("click", () => {
        if (document.body.classList.contains("in-app")) {
          tocEl.classList.remove("expanded");
          tocChipBtn.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /* -----------------------------------------------------------------
     6. COPY-TO-CLIPBOARD for code blocks
  ----------------------------------------------------------------- */
  document.querySelectorAll(".code-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const block = btn.closest(".code-block");
      const code = block?.querySelector("pre code");
      if (!code) return;
      const text = code.textContent;
      const label = btn.querySelector(".code-copy-label");
      const original = label ? label.textContent : "";
      const fallback = () => {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch (e) {
          return false;
        }
      };
      let success = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          success = true;
        } catch (err) {
          success = fallback();
        }
      } else {
        success = fallback();
      }
      if (success) {
        btn.classList.add("copied");
        if (label) label.textContent = "Copied";
      } else {
        if (label) label.textContent = "Failed";
      }
      setTimeout(() => {
        btn.classList.remove("copied");
        if (label) label.textContent = original;
      }, 1500);
    });
  });
})();
