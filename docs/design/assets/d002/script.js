const root = document.querySelector("#design-system");
const stage = document.querySelector(".viewport-stage");

function activate(button, selector) {
  document.querySelectorAll(selector).forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
}

document.querySelectorAll(".review-controls button").forEach((button) => {
  button.setAttribute(
    "aria-pressed",
    String(button.classList.contains("is-active")),
  );
});

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    root.classList.toggle(
      "de-theme-high-contrast",
      button.dataset.theme === "high-contrast",
    );
    root.classList.toggle(
      "de-theme-default",
      button.dataset.theme === "default",
    );
    activate(button, "[data-theme]");
  });
});

document.querySelectorAll("[data-text-scale]").forEach((button) => {
  button.addEventListener("click", () => {
    root.dataset.textScale = button.dataset.textScale;
    activate(button, "[data-text-scale]");
  });
});

document.querySelectorAll("[data-motion]").forEach((button) => {
  button.addEventListener("click", () => {
    root.classList.toggle(
      "de-motion-reduced",
      button.dataset.motion === "reduced",
    );
    activate(button, "[data-motion]");
  });
});

document.querySelectorAll("[data-viewport]").forEach((button) => {
  button.addEventListener("click", () => {
    stage.style.setProperty("--preview-width", `${button.dataset.viewport}px`);
    activate(button, "[data-viewport]");
  });
});
