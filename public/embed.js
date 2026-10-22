/*
 * Bistro de Borre — reservatiewidget.
 * Gebruik: <script src="https://bistrodeborre.vercel.app/embed.js"></script>
 * Optionele attributen op de script-tag:
 *   data-kleur="#8b8a69"          primaire kleur (hex)
 *   data-lettertype="Georgia, serif"
 *   data-target="#mijn-element"   plaats de widget in dit element (standaard: direct na de script-tag)
 *   data-modus="popup"            toon een knop die de widget in een popup opent
 *   data-knop-tekst="Reserveer een tafel"   tekst van die knop
 *   data-open=".mijn-knop"        gebruik eigen element(en) als knop i.p.v. de standaardknop (met data-modus="popup")
 * Ook beschikbaar: window.BistroDeBorre.open() en .close().
 */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;

  var origin = new URL(script.src).origin;
  var params = new URLSearchParams();
  if (script.dataset.kleur) params.set("kleur", script.dataset.kleur);
  if (script.dataset.lettertype) params.set("lettertype", script.dataset.lettertype);
  var query = params.toString();
  var src = origin + "/widget" + (query ? "?" + query : "");
  var kleur = /^#[0-9a-fA-F]{3,8}$/.test(script.dataset.kleur || "") ? script.dataset.kleur : "#8b8a69";

  var iframe = document.createElement("iframe");
  iframe.title = "Reserveren bij Bistro de Borre";
  iframe.setAttribute("scrolling", "no");

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (data && data.type === "bistro-widget-hoogte" && typeof data.hoogte === "number") {
      iframe.style.height = Math.ceil(data.hoogte) + "px";
    }
    if (data && data.type === "bistro-widget-sluit" && window.BistroDeBorre) window.BistroDeBorre.close();
  });

  if (script.dataset.modus !== "popup") {
    iframe.src = src;
    iframe.loading = "lazy";
    iframe.style.cssText = "width:100%;border:0;display:block;min-height:480px;overflow:hidden";
    var doel = script.dataset.target ? document.querySelector(script.dataset.target) : null;
    if (doel) doel.appendChild(iframe);
    else script.parentNode.insertBefore(iframe, script.nextSibling);
    return;
  }

  // Popup-modus
  var overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(0,0,0,.55);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;box-sizing:border-box";
  var dialoog = document.createElement("div");
  dialoog.setAttribute("role", "dialog");
  dialoog.setAttribute("aria-modal", "true");
  dialoog.setAttribute("aria-label", "Reserveren bij Bistro de Borre");
  dialoog.style.cssText =
    "position:relative;max-width:560px;margin:0 auto;background:#fff;border-radius:5px;padding:40px 16px 16px;box-sizing:border-box;box-shadow:0 10px 40px rgba(0,0,0,.35)";
  var sluit = document.createElement("button");
  sluit.type = "button";
  sluit.setAttribute("aria-label", "Sluiten");
  sluit.textContent = "×";
  sluit.style.cssText =
    "position:absolute;top:6px;right:8px;width:36px;height:36px;border:0;border-radius:5px;background:" +
    kleur + ";color:#000;font-size:24px;line-height:1;cursor:pointer";
  iframe.style.cssText = "width:100%;border:0;display:block;min-height:480px;overflow:hidden";
  dialoog.appendChild(sluit);
  dialoog.appendChild(iframe);
  overlay.appendChild(dialoog);
  document.body.appendChild(overlay);

  var vorigeFocus = null;
  var vorigeOverflow = "";

  function open() {
    if (!iframe.src) iframe.src = src;
    vorigeFocus = document.activeElement;
    vorigeOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlay.style.display = "block";
    sluit.focus();
  }
  function close() {
    overlay.style.display = "none";
    document.body.style.overflow = vorigeOverflow;
    if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus();
  }

  sluit.addEventListener("click", close);
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.style.display === "block") close();
  });

  window.BistroDeBorre = { open: open, close: close };

  var eigen = script.dataset.open ? document.querySelectorAll(script.dataset.open) : [];
  if (eigen.length) {
    Array.prototype.forEach.call(eigen, function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    });
  } else {
    var knop = document.createElement("button");
    knop.type = "button";
    knop.textContent = script.dataset.knopTekst || "Reserveer een tafel";
    knop.style.cssText =
      "display:inline-block;padding:12px 24px;border:0;border-radius:5px;background:" + kleur +
      ";color:#000;font:600 16px/1.1 'Open Sans',system-ui,sans-serif;cursor:pointer";
    knop.addEventListener("click", open);
    var plek = script.dataset.target ? document.querySelector(script.dataset.target) : null;
    if (plek) plek.appendChild(knop);
    else script.parentNode.insertBefore(knop, script.nextSibling);
  }
})();
