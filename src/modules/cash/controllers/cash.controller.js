/**
 * Controlador do Caixa: filtros, troca de unidade e formulários de abertura e fechamento.
 */
import {openCashRegister,closeCashRegister} from "../services/cash-operations.js";
/**
 * Vincula eventos uma única vez e valida o contexto antes das operações financeiras.
 * @param {object} options Dependências do controlador.
 */
export function bindCashEvents({host,state,supabase,toast,reportError,refresh}){
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   const applyCashFilters=()=>{
    const term=String(host.querySelector("#cash-filter-search")?.value||"").trim().toLocaleLowerCase("pt-BR");
    const from=host.querySelector("#cash-filter-from")?.value||"",to=host.querySelector("#cash-filter-to")?.value||"",method=host.querySelector("#cash-filter-method")?.value||"";
    host.querySelectorAll(".cash-movement").forEach(row=>{row.hidden=Boolean((term&&!row.dataset.search.includes(term))||(from&&row.dataset.date<from)||(to&&row.dataset.date>to)||(method&&row.dataset.method!==method));});
   };
   host.addEventListener("input",event=>{if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();});
   host.addEventListener("change",async event=>{
    if(event.target.matches("#cash-branch-select")){
     host.dataset.branchId=String(event.target.value||"");
     await refresh();
     return;
    }
    if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();
   });
   host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#cash-open-form")&&!form.matches("#cash-close-form"))return;
    event.preventDefault();
    if(!["owner","admin","manager","receptionist","finance"].includes(state.membership?.role)){toast("Seu perfil não pode operar o caixa.");return;}
    const button=form.querySelector('[type="submit"]');
    const orgId=state.organization?.id;
    const context=host.dataset.context,request=host.dataset.request;
    const current=()=>host.isConnected&&host.dataset.request===request&&context===JSON.stringify([state.organization?.id,state.user?.id,state.branch?.id||null]);
    if(!orgId||host.dataset.loadedOrgId!==orgId||host.dataset.loadedBranchId!==host.dataset.branchId||!button||button.disabled||!current())return;
    button.disabled=true;button.textContent="Salvando…";
    try{
     const values=new FormData(form);
     if(form.matches("#cash-open-form")){
      const {error}=await openCashRegister({supabase,orgId,branchId:host.dataset.branchId||null,openingAmount:values.get("opening_amount")});
      if(error)throw error;
      if(!current())return;
      toast("Caixa aberto e registrado nesta unidade.");
     }else{
      const {data,error}=await closeCashRegister({supabase,cashRegisterId:host.dataset.activeRegisterId,closingAmount:values.get("closing_amount")});
      if(error)throw error;
      if(!current())return;
      toast("Caixa fechado. Diferença: "+Number(data?.difference||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+".");
     }
     await refresh();
    }catch(error){if(current())reportError(error,{context:"Caixa > operação"});}
    finally{if(button.isConnected){button.disabled=false;button.textContent=form.matches("#cash-open-form")?"Abrir caixa":"Conferir e fechar caixa";}}
   });
  }
}
