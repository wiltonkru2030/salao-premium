/** Regressão do escopo OIDC; assinatura/issuer/aud são verificados pelo jose na função. */
import assert from "node:assert/strict";
import {allowedDispatchClaims} from "../../supabase/functions/dispatch-professional-push/auth-claims.js";
const base={repository_id:"1455369730",repository_owner_id:"353958630",repository:"wiltonkru2030/salao-premium",ref:"refs/heads/main",workflow_ref:"wiltonkru2030/salao-premium/.github/workflows/professional-push-dispatch.yml@refs/heads/main",event_name:"push"};
assert.equal(allowedDispatchClaims(base,"check"),true);
assert.equal(allowedDispatchClaims(base,"send"),false);
assert.equal(allowedDispatchClaims({...base,event_name:"schedule"},"send"),true);
assert.equal(allowedDispatchClaims({...base,event_name:"workflow_dispatch"},"send"),true);
for(const field of ["repository_id","repository_owner_id","repository","ref","workflow_ref","event_name"])assert.equal(allowedDispatchClaims({...base,[field]:"other"},"check"),false,field);
assert.equal(allowedDispatchClaims(base,"bad"),false);
console.log("Escopo OIDC profissional: OK");

// A promoção QA pode drenar a fila existente; produção não aceita push como autorização de envio.
assert.equal(allowedDispatchClaims(base,"send",{qa:true}),true);
assert.equal(allowedDispatchClaims(base,"send",{qa:false}),false);
assert.equal(allowedDispatchClaims({...base,ref:"refs/heads/develop"},"send",{qa:true}),false);
