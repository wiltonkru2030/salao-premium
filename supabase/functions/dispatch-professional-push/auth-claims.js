/** Autorização de escopo após validação criptográfica do JWT pelo emissor GitHub. */
export function allowedDispatchClaims(payload,mode,{qa=false}={}){
 return payload?.repository_id==="1455369730"&&payload.repository_owner_id==="353958630"&&
 payload.repository==="wiltonkru2030/salao-premium"&&payload.ref==="refs/heads/main"&&
 payload.workflow_ref==="wiltonkru2030/salao-premium/.github/workflows/professional-push-dispatch.yml@refs/heads/main"&&
 (mode==="check"?["push","workflow_dispatch","schedule"].includes(payload.event_name):
 mode==="send"&&(["workflow_dispatch","schedule"].includes(payload.event_name)||(qa===true&&payload.event_name==="push")));
}
