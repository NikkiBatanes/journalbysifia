(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const form = document.getElementById("early-access-form");
  const alertBox = document.getElementById("form-alert");
  const progress = document.querySelector(".form-progress");
  const progressSteps = document.querySelectorAll("[data-progress]");
  const steps = document.querySelectorAll("[data-step]");
  const startedAt = Date.now();
  let signupToken = "";

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

  document.querySelectorAll("a[href='#early-access']").forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => document.getElementById("email").focus(), 600);
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
    if (!button) return;

    if (button.dataset.action === "back") {
      showStep("1");
    }

    if (button.dataset.action === "skip") {
      track("early_access_survey_skipped");
      showSuccess(false);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
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
      const firstError = form.querySelector(".field-error:not(:empty)");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  async function startSignup(button) {
    setLoading(button, true, "Joining…");
    hideAlert();

    const params = new URLSearchParams(window.location.search);
    const payload = {
      action: "start",
      email: form.elements.email.value.trim(),
      platform: form.querySelector("input[name='platform']:checked").value,
      email_consent: form.elements.email_consent.checked,
      website: form.elements.website.value,
      elapsed_ms: Date.now() - startedAt,
      source: params.get("source") || "journal-early-access",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || ""
    };

    try {
      const result = await postJson("api/early-access.php", payload);
      signupToken = result.signup_token || "";
      track("early_access_joined", { platform: payload.platform });
      showStep("2");
    } catch (error) {
      showAlert(error.message || "We could not save your signup. Please try again.");
    } finally {
      setLoading(button, false);
    }
  }

  async function finishSurvey(button) {
    if (!signupToken) {
      showAlert("Your signup session expired. Please return to step one and try again.");
      showStep("1");
      return;
    }

    setLoading(button, true, "Sending…");
    hideAlert();

    const payload = {
      action: "survey",
      signup_token: signupToken,
      current_journaling: valueOf("current_journaling"),
      consistency_challenges: checkedValues("consistency_challenges"),
      desired_outcomes: checkedValues("desired_outcomes"),
      feature_interests: checkedValues("feature_interests"),
      expected_price: valueOf("expected_price"),
      price_reaction: checkedRadio("price_reaction"),
      tester_opt_in: form.elements.tester_opt_in.checked,
      anything_else: valueOf("anything_else")
    };

    try {
      await postJson("api/early-access.php", payload);
      track("early_access_survey_completed", { tester: payload.tester_opt_in });
      showSuccess(payload.tester_opt_in);
    } catch (error) {
      showAlert(error.message || "We could not save your answers. Please try again.");
    } finally {
      setLoading(button, false);
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });

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
    progress.hidden = step === "success";
    progress.classList.toggle("step-two", stepTwo);
    progressSteps.forEach((item) => {
      const number = Number(item.dataset.progress);
      item.classList.toggle("is-active", number === Number(step));
      item.classList.toggle("is-complete", stepTwo && number === 1);
      if (stepTwo && number === 1) item.querySelector("span").textContent = "✓";
      if (!stepTwo && number === 1) item.querySelector("span").textContent = "1";
    });

    hideAlert();
    const activePanel = form.querySelector(`[data-step='${step}']`);
    if (activePanel) {
      const focusTarget = activePanel.querySelector("h3, input, select, button");
      if (focusTarget) focusTarget.setAttribute("tabindex", "-1");
      window.requestAnimationFrame(() => {
        activePanel.scrollIntoView({ behavior: "smooth", block: "center" });
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      });
    }
  }

  function showSuccess(isTester) {
    const message = document.getElementById("success-message");
    message.textContent = isTester
      ? "You're on the Early Access list and have volunteered to test Journal. We'll contact you if a testing place becomes available."
      : "We'll email you with early-access and launch updates. Thank you for helping shape Journal.";
    showStep("success");
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
  }

  function clearFieldError(name) {
    setFieldError(name, "");
    const control = form.elements[name];
    if (control && control.classList) control.classList.remove("is-invalid");
  }

  function clearAllErrors() {
    form.querySelectorAll(".field-error").forEach((item) => (item.textContent = ""));
    form.querySelectorAll(".is-invalid").forEach((item) => item.classList.remove("is-invalid"));
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }

  function setLoading(button, loading, label) {
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
