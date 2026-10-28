(function () {
  "use strict";
  // First touch within this tab survives visits to Privacy / Terms and back.
  const key = "journal-early-access-attribution-v2";
  const params = new URLSearchParams(window.location.search);
  let attribution;
  try { attribution = JSON.parse(sessionStorage.getItem(key)); } catch (_) { /* Storage may be blocked. */ }
  if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
    let referrer = "";
    try { referrer = new URL(document.referrer).origin; } catch (_) { /* Direct visit. */ }
    attribution = {
      source: params.get("source") || "journal-early-access",
      landing_page: window.location.origin + window.location.pathname,
      referrer_domain: referrer
    };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((name) => {
      attribution[name] = (params.get(name) || "").slice(0, 160);
    });
    try { sessionStorage.setItem(key, JSON.stringify(attribution)); } catch (_) { /* In-memory fallback. */ }
  }
  window.journalAttribution = attribution;
})();
