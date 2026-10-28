(function () {
  "use strict";
  const amount = document.getElementById("founding-price");
  const context = document.getElementById("price-context");

  function showRegion(region) {
    const price = region === "ph" ? "₱599" : "US$12.99";
    amount.textContent = price;
    context.textContent = "one time";
    document.querySelectorAll("[data-local-price]").forEach(el => { el.textContent = price + " one time"; });
    const field = document.querySelector('[name="price_region"]');
    if (field) field.value = region;
    document.getElementById("price-question").hidden = false;
    document.getElementById("price-question-label").textContent =
      `At the founding price of ${price} as a one-time purchase, how does Journal by siFia feel to you?`;
    document.querySelectorAll('[name="price_reaction"]').forEach(input => { input.checked = false; });
  }

  function detectUserLocation() {
    fetch("/api/location-proxy.php")
      .then(response => {
        if (!response.ok) {
          throw new Error(`Location proxy failed: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const countryCode = data && data.country_code;
        showRegion(countryCode === "PH" ? "ph" : "international");
      })
      .catch(() => {
        showRegion("international");
      });
  }

  // Match siFia Launch: PHP is the initial currency, then location detection
  // switches non-PH visitors (or lookup failures) to USD.
  showRegion("ph");
  detectUserLocation();
})();
