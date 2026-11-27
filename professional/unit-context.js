/** Seleção operacional do App Profissional; autorização definitiva permanece no banco. */
/** Preserva contratos legados de unidade fixa e só amplia operações quando o novo contrato está habilitado. */
export function canUseSelectedUnit(state){
 if(state.role!=="professional"||!state.professional?.id)return false;
 if(!state.explicitBranchEnabled)return !!state.professional.branch_id&&(!state.branchId||state.branchId===state.professional.branch_id);
 return !!state.branchId&&state.branches.some(row=>row.id===state.branchId)&&(!state.professional.branch_id||state.professional.branch_id===state.branchId);
}
/** Passa unidade explicitamente apenas quando o servidor correspondente foi homologado. */
export function selectedUnitArgs(state){
 return state.explicitBranchEnabled?{branchId:state.branchId}:{}; 
}
/** Encaminha chamada ao contrato certo sem fallback em erro. */
export function unitRpc(name,args,branchId=null){
 if(branchId===null||branchId===undefined)return {name,args};
 if(typeof branchId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId))throw new Error("Unidade inválida.");
 return {name:name+"_at_branch",args:{...args,target_unit:branchId}};
}
