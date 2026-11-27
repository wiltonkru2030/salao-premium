/** Importa as views em ESM nativo: detecta exports removidos mesmo se o bundler elimina imports sem uso. */
import assert from "node:assert/strict";
import {ordersView,commissionsView,profileView,settingsView} from "./workspace.views.js";
for(const view of [ordersView,commissionsView,profileView,settingsView])assert.equal(typeof view,"function");
console.log("Importação nativa das views profissionais aprovada.");
