/** Testa contrato do dry-run; não chama Google nem usa segredo real. */
import assert from "node:assert/strict";
import {validateFirebaseTransport} from "../../supabase/functions/dispatch-professional-push/validate-transport.js";
let count=0;
const fetchImpl=async(url,request)=>{
 count++;
 assert.equal(url,"https://fcm.googleapis.com/v1/projects/salao-premium/messages:send");
 assert.equal(request.method,"POST");
 const data=JSON.parse(request.body);
 assert.equal(data.validate_only,true);
 assert.equal(data.message.topic,"salao-premium-qa-validation-only");
 assert.equal(Object.hasOwn(data.message,"token"),false);
 assert.equal(Object.hasOwn(data.message,"notification"),false);
 return {ok:count===1,status:count===1?200:403};
};
const options={projectId:"salao-premium",bearer:"ficticio",fetchImpl};
assert.deepEqual(await validateFirebaseTransport(options),{validated:true,httpStatus:200});
assert.deepEqual(await validateFirebaseTransport(options),{validated:false,httpStatus:403});
await assert.rejects(()=>validateFirebaseTransport({...options,projectId:"https://outro.example"}));
assert.equal(count,2);
console.log("FCM validate_only: contrato aprovado.");
