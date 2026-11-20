/** Testes HTML de escape, formulários em modais e estados da fila. */
import assert from "node:assert/strict";
import {renderAgendaOffers,renderPackageModal,renderPackageItemRows} from "./agenda-offers.view.js";
const name='<img src=x onerror=alert(1)>';
const id="11111111-1111-4111-8111-111111111111";
const service={id,name:"Corte <premium>"};
const base={tab:"waitlist",services:[service],professionals:[],date:"2026-11-25",timezone:"America/Sao_Paulo"};
const html=renderAgendaOffers({...base,waitlist:[{
 waitlist_id:id,customer_name:name,service_name:service.name,status:"waiting",
 preferred_from:"2026-11-25",preferred_until:"2026-11-26",time_from:"08:00:00",time_until:"19:00:00",notes:name
}],matches:[{customer_name:name,service_name:"Corte",professional_name:"Ana",starts_at:"2026-11-25T15:00:00Z"}],searched:true});
assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
assert.ok(!html.includes('<img src=x'));
assert.ok(html.includes("data-offer-action=\"preview-match\""));
assert.ok(html.includes('id="offer-waitlist-dialog"'));
assert.ok(html.includes('id="offer-book-dialog"'));
assert.ok(html.includes('id="offer-status-dialog"'));
assert.ok(html.includes("data-offer-action=\"contacted\""));
const packages=renderAgendaOffers({tab:"packages",packages:[{
 id,branch_id:id,name:"Combo",active:true,reference_price:130,
 items:[{service_id:id,quantity:1,pause_after_minutes:25}]
}],services:[{id,name:"Corte"}],isManager:true});
assert.ok(packages.includes("pausa 25 min"));
assert.ok(packages.includes("data-offer-action=\"edit-package\""));
assert.ok(packages.includes('id="offer-package-dialog"'));
assert.ok(packages.includes('id="offer-package-status-dialog"'));
const packageHtml=renderPackageModal({services:[service],items:[{service_id:id,quantity:2,pause_after_minutes:15}]});
assert.ok(packageHtml.includes("&lt;premium&gt;"));
assert.ok(packageHtml.includes('name="pause_0"'));
assert.equal((renderPackageItemRows({services:[service],items:[{service_id:id,quantity:1,pause_after_minutes:0}]}).match(/offer-package-entry/g)||[]).length,1);
console.log("Componentes de combos e espera: HTML seguro OK");
