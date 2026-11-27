/** Regressões estáticas da cascata e publicação PWA, sem simular navegador. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL(name,import.meta.url),"utf8");
const css=read("./styles.css"),workspace=read("./design-workspace.css");
assert.ok(css.indexOf("./layout.css")<css.indexOf("./design-mobile-premium.css"));
assert.ok(css.indexOf("./design-mobile-premium.css")<css.indexOf("./design-workspace.css"));
assert.match(workspace,/#professional-app \[hidden\]\{display:none!important\}/);
assert.match(workspace,/var\(--sp-action\)/);
assert.match(read("./views/booking.views.js"),/name="start" type="time"/);
assert.doesNotMatch(read("./views/booking.views.js"),/type="date"/);
assert.match(read("./sw.js"),/startsWith\("salao-profissional-shell-"\)/);
assert.doesNotMatch(read("./sw.js"),/addEventListener\("fetch"/);
assert.match(read("../vite.config.js"),/professionalPwaAssets/);
console.log("Contrato visual profissional: OK");
