/** Regressões estáticas da cascata e publicação PWA, sem simular navegador. */
import assert from "node:assert/strict";
import {professionalGreeting} from "./utils/header-preferences.js";
import {renderProfessionalCustomers} from "./views/customers.views.js";
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

const tz="America/Campo_Grande";
assert.equal(professionalGreeting(new Date("2026-11-27T15:59:00Z"),tz),"Bom dia");
assert.equal(professionalGreeting(new Date("2026-11-27T16:00:00Z"),tz),"Boa tarde");
assert.equal(professionalGreeting(new Date("2026-11-27T22:00:00Z"),tz),"Boa noite");
const headerState={professional:{name:"Profissional Exemplo",branch_id:"b"},branches:[{id:"b",name:"Matriz"}],branchId:"b",organization:{timezone:tz},page:"Agenda",notificationsUnread:0};
const header=read("./views/shell.views.js");
assert.match(header,/data-professional-greeting/);assert.match(header,/escapeHtml\(name\)/);assert.match(header,/renderPlatformThemeToggle\(\)/);assert.doesNotMatch(header,/professional-profile-menu/);assert.match(header,/page==="Perfil"/);assert.match(header,/data-action="logout"/);
const customerCard=renderProfessionalCustomers({...headerState,selectedCustomer:{name:"Cliente QA",branch_id:"b",phone:"67999991234"},canManageCustomers:true,customerHistory:[],customerHistoryStatus:"ready"});
assert.match(customerCard,/professional-card-actions professional-customer-actions/);assert.match(customerCard,/href="tel:67999991234"/);assert.match(customerCard,/Editar cadastro/);

assert.match(css,/control-spacing\.css/);
const spacing=read("./control-spacing.css");
assert.match(spacing,/--professional-control-gap:12px/);
assert.match(spacing,/professional-control-stack/);
assert.match(read("./views/notifications.views.js"),/professional-notification-controls/);
assert.match(read("./views/profile.views.js"),/professional-control-stack/);
