/*
 * Bistro de Borre — reservatiewidget.
 * Gebruik: <script src="https://bistrodeborre.vercel.app/embed.js"></script>
 * Optionele attributen op de script-tag:
 *   data-kleur="#8b8a69"          primaire kleur (hex)
 *   data-lettertype="Georgia, serif"
 *   data-target="#mijn-element"   plaats de widget in dit element (standaard: direct na de script-tag)
 */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;

  var origin = new URL(script.src).origin;
  var params = new URLSearchParams();
  if (script.dataset.kleur) params.set("kleur", script.dataset.kleur);
  if (script.dataset.lettertype) params.set("lettertype", script.dataset.lettertype);
  var query = params.toString();

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/widget" + (query ? "?" + query : "");
  iframe.title = "Reserveren bij Bistro de Borre";
  iframe.loading = "lazy";
  iframe.setAttribute("scrolling", "no");
  iframe.style.cssText = "width:100%;border:0;display:block;min-height:480px;overflow:hidden";

  var doel = script.dataset.target ? document.querySelector(script.dataset.target) : null;
  if (doel) doel.appendChild(iframe);
  else script.parentNode.insertBefore(iframe, script.nextSibling);

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (data && data.type === "bistro-widget-hoogte" && typeof data.hoogte === "number") {
      iframe.style.height = Math.ceil(data.hoogte) + "px";
    }
  });
})();
