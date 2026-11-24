/** Verifica documento opcional e os dois formatos fiscais aceitos nas configurações. */
import assert from "node:assert/strict";
import {validSettingsDocument} from "./settings-document.validation.js";

assert.equal(validSettingsDocument(""), true);
assert.equal(validSettingsDocument("529.982.247-25"), true);
assert.equal(validSettingsDocument("529.982.247-26"), false);
assert.equal(validSettingsDocument("11.222.333/0001-81"), true);
assert.equal(validSettingsDocument("12.ABC.345/01DE-35"), true);
assert.equal(validSettingsDocument("12.ABC.345/01DE-36"), false);
assert.equal(validSettingsDocument("qualquer coisa"), false);
console.log("Documentos de organização e unidade verificados.");
