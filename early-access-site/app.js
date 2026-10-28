(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const form = document.getElementById("early-access-form");
  const signupEndpoint = document.querySelector('meta[name="journal-signup-endpoint"]')?.content || "";
  const alertBox = document.getElementById("form-alert");
  const progress = document.querySelector(".form-progress");
  const progressSteps = document.querySelectorAll("[data-progress]");
  const steps = document.querySelectorAll("[data-step]");
  const surveyPanels = document.querySelectorAll("[data-survey-panel]");
  let signupToken = "";
  let submitting = false;
  let currentSurveyPanel = "intro";
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const tracked = new Set();
  function trackOnce(name, values) {
    if (tracked.has(name)) return;
    tracked.add(name);
    track(name, values);
  }
  trackOnce("early_access_page_view");
  const pricing = document.getElementById("pricing");
  if ("IntersectionObserver" in window) {
    const pricingObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        trackOnce("early_access_pricing_viewed");
        pricingObserver.disconnect();
      }
    }, { threshold: 0.25 });
    pricingObserver.observe(pricing);
  }
  form.addEventListener("focusin", (event) => {
    if (event.target.matches("input, select, textarea")) {
      trackOnce(event.target.closest("[data-step='2']") ? "early_access_survey_started" : "early_access_form_started");
    }
  });

  form.elements.tester_opt_in.addEventListener("change", () => {
    const checked = form.elements.tester_opt_in.checked;
    document.getElementById("testing-details").hidden = !checked;
    form.elements.tester_opt_in.setAttribute("aria-expanded", String(checked));
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const photoItems = document.querySelectorAll(".product-screenshot, .story-screenshot");
  if ("IntersectionObserver" in window) {
    const photoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-photo-visible");
            photoObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );
    photoItems.forEach((item) => photoObserver.observe(item));
  } else {
    photoItems.forEach((item) => item.classList.add("is-photo-visible"));
  }

  document.querySelectorAll("a[href='#early-access']").forEach((link) => {
    link.addEventListener("click", () => {
      if (link.closest(".hero")) track("early_access_hero_cta_clicked");
      if (link.closest("#pricing")) track("early_access_pricing_cta_clicked");
      window.setTimeout(() => {
        const target = form.querySelector(".form-step:not([hidden]) input, .form-step:not([hidden]) h3");
        if (target) target.focus({ preventScroll: true });
      }, motion === "auto" ? 0 : 600);
    });
  });

  document.querySelectorAll(".limited-group").forEach((group) => {
    const max = Number(group.dataset.max || 3);
    const inputs = Array.from(group.querySelectorAll("input[type='checkbox']"));
    const error = group.querySelector(".field-error");

    inputs.forEach((input) => {
      input.addEventListener("change", () => {
        const checked = inputs.filter((item) => item.checked);
        const atLimit = checked.length >= max;
        inputs.forEach((item) => {
          item.disabled = atLimit && !item.checked;
        });
        if (error) error.textContent = atLimit ? `You can choose up to ${max}.` : "";
      });
    });
  });

  form.addEventListener("input", (event) => {
    const name = event.target.name;
    if (name) clearFieldError(name);
    hideAlert();
  });

  form.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || submitting) return;

    if (button.dataset.action === "survey-start") {
      trackOnce("early_access_survey_started");
      showSurveyPanel("1");
    }

    if (button.dataset.action === "survey-next") {
      showSurveyPanel(String(Math.min(Number(currentSurveyPanel) + 1, 5)));
    }

    if (button.dataset.action === "survey-back") {
      const previous = Number(currentSurveyPanel) - 1;
      showSurveyPanel(previous < 1 ? "intro" : String(previous));
    }

    if (button.dataset.action === "skip") {
      track("early_access_survey_skipped");
      showSuccess(false);
    }

    if (button.dataset.action === "reset") {
      resetSignupForm();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    const submitter = event.submitter || form.querySelector(".form-step:not([hidden]) button[type=submit]");
    const action = submitter && submitter.dataset.action;

    if (action === "join") {
      if (!validateStepOne()) return;
      await startSignup(submitter);
      return;
    }

    if (action === "finish") {
      await finishSurvey(submitter);
    }
  });

  function validateStepOne() {
    let valid = true;
    const email = form.elements.email;
    const platform = form.querySelector("input[name='platform']:checked");
    const consent = form.elements.email_consent;

    clearAllErrors();

    if (!email.value.trim() || !email.validity.valid) {
      setFieldError("email", "Enter a valid email address.");
      email.classList.add("is-invalid");
      valid = false;
    }

    if (!platform) {
      setFieldError("platform", "Choose iPhone or Android.");
      valid = false;
    }

    if (!consent.checked) {
      setFieldError("email_consent", "Please confirm that we may email you.");
      valid = false;
    }

    if (!valid) {
      const firstError = form.querySelector("[aria-invalid=true]");
      if (firstError) firstError.focus();
    }
    return valid;
  }

  async function startSignup(button) {
    setLoading(button, true, "Joining…");
    hideAlert();

    const payload = {
      ...(window.journalAttribution || {}),
      action: "start",
      email: form.elements.email.value.trim(),
      platform: form.querySelector("input[name='platform']:checked").value,
      email_consent: form.elements.email_consent.checked,
      website: form.elements.website.value

    };

    try {
      const result = await postJson(signupEndpoint, payload);
      signupToken = result.signup_token || "";
      trackOnce("early_access_joined", { platform: payload.platform });
      showStep("2");
    } catch (error) {
      showAlert(error.message || "We could not save your signup. Please try again.");
    } finally {
      setLoading(button, false);
    }
  }

  async function finishSurvey(button) {
    if (!signupToken) {
      showStep("1");
      showAlert("Your signup session expired. Please return to step one and try again.");
      return;
    }

    setLoading(button, true, "Sending…");
    hideAlert();

    const payload = {
      action: "survey",
      signup_token: signupToken,
      current_journaling: valueOf("current_journaling"),
      feature_interests: checkedValues("feature_interests"),
      price_region: valueOf("price_region"),
      price_reaction: checkedRadio("price_reaction"),
      tester_opt_in: form.elements.tester_opt_in.checked,
      anything_else: valueOf("anything_else")
    };

    try {
      await postJson(signupEndpoint, payload);
      trackOnce("early_access_survey_completed", { tester: payload.tester_opt_in });
      if (payload.tester_opt_in) trackOnce("early_access_tester_volunteered");
      showSuccess(payload.tester_opt_in);
    } catch (error) {
      showAlert(error.message || "We could not save your answers. Please try again.");
    } finally {
      setLoading(button, false);
    }
  }

  async function postJson(url, payload) {
    if (!url) throw new Error("The signup service is not configured yet. Please try again shortly.");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(url, {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit"
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The request timed out. Please try again; your signup will not be duplicated.");
      throw error;
    } finally { window.clearTimeout(timeout); }

    let result;
    try {
      result = await response.json();
    } catch (_error) {
      throw new Error("The signup service is not available yet. Please try again shortly.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Something went wrong. Please try again.");
    }
    return result;
  }

  function showStep(step) {
    steps.forEach((panel) => {
      const active = panel.dataset.step === step;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });

    const stepTwo = step === "2";
    progress.hidden = step !== "1";
    progress.classList.toggle("step-two", stepTwo);
    progressSteps.forEach((item) => {
      const number = Number(item.dataset.progress);
      item.classList.toggle("is-active", number === Number(step));
      item.classList.toggle("is-complete", stepTwo && number === 1);
      if (stepTwo && number === 1) item.querySelector("span").textContent = "✓";
      if (!stepTwo && number === 1) item.querySelector("span").textContent = "1";
    });

    hideAlert();
    if (step === "2") showSurveyPanel("intro", false);
    const activePanel = form.querySelector(`[data-step='${step}']`);
    if (activePanel) {
      const focusTarget = activePanel.querySelector("h3, input, select, button");
      if (focusTarget && focusTarget.matches("h3")) focusTarget.setAttribute("tabindex", "-1");
      window.requestAnimationFrame(() => {
        activePanel.scrollIntoView({ behavior: motion, block: "center" });
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      });
    }
  }

  function showSurveyPanel(panel, shouldFocus = true) {
    currentSurveyPanel = panel;
    surveyPanels.forEach((item) => {
      const active = item.dataset.surveyPanel === panel;
      item.hidden = !active;
      item.classList.toggle("is-active", active);
    });

    if (!shouldFocus) return;
    const activePanel = form.querySelector(`[data-survey-panel='${panel}']`);
    if (!activePanel) return;
    const focusTarget = activePanel.querySelector("h3, legend, label, select, textarea, button");
    window.requestAnimationFrame(() => {
      activePanel.scrollIntoView({ behavior: motion, block: "center" });
      if (focusTarget) {
        if (!focusTarget.matches("select, textarea, button")) focusTarget.setAttribute("tabindex", "-1");
        focusTarget.focus({ preventScroll: true });
      }
    });
  }

  function showSuccess(isTester) {
    const message = document.getElementById("success-message");
    message.textContent = "We’ll email you when Journal by siFia is ready and before your founding-price offer ends." +
      (isTester ? " You also volunteered to test before launch." : "");
    showStep("success");
  }

  function resetSignupForm() {
    const priceRegion = valueOf("price_region");
    form.reset();
    if (form.elements.price_region) form.elements.price_region.value = priceRegion;
    form.querySelectorAll("[name='feature_interests']").forEach((input) => { input.disabled = false; });
    form.elements.tester_opt_in.setAttribute("aria-expanded", "false");
    document.getElementById("testing-details").hidden = true;
    signupToken = "";
    clearAllErrors();
    showStep("1");
  }

  function valueOf(name) {
    return form.elements[name] ? form.elements[name].value.trim() : "";
  }

  function checkedValues(name) {
    return Array.from(form.querySelectorAll(`input[name='${name}']:checked`)).map((item) => item.value);
  }

  function checkedRadio(name) {
    const checked = form.querySelector(`input[name='${name}']:checked`);
    return checked ? checked.value : "";
  }

  function setFieldError(name, message) {
    const element = document.querySelector(`[data-error-for='${name}']`);
    if (element) element.textContent = message;
    form.querySelectorAll(`[name="${name}"]`).forEach((control) => control.setAttribute("aria-invalid", message ? "true" : "false"));
  }

  function clearFieldError(name) {
    setFieldError(name, "");
    const control = form.elements[name];
    if (control && control.classList) control.classList.remove("is-invalid");
  }

  function clearAllErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((item) => item.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((item) => (item.textContent = ""));
    form.querySelectorAll(".is-invalid").forEach((item) => item.classList.remove("is-invalid"));
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: motion, block: "center" });
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }

  function setLoading(button, loading, label) {
    submitting = loading;
    form.setAttribute("aria-busy", String(loading));
    form.querySelectorAll("button").forEach((item) => { item.disabled = loading; });
    if (!button) return;
    if (loading) {
      button.dataset.originalHtml = button.innerHTML;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalHtml || button.innerHTML;
      button.disabled = false;
    }
  }

  function track(eventName, values) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...(values || {}) });
  }
})();
