/** Controlador das regras e repasses de comissão; não gera marcação HTML. */
import {summarizeCommissionPayout} from "../commission-payout-summary.js";
import {createServiceCommissionRule,updateServiceCommissionRule,deleteServiceCommissionRule,saveProductCommissionSetting,payProfessionalCommissions} from "../commission-rules.service.js";
/** Vincula ações autorizadas ao contexto financeiro ativo. */
export function bindCommissionEvents({host,state,supabase,toast,reportError,canPay,canManageCommissionSettings,money,refresh,clearFilter}){
 const active=()=>host.isConnected&&host._commissionConfig?.context===JSON.stringify([state.organization?.id,state.user?.id,state.membership?.role]);
  if(host.dataset.settingsBound!=="true"){
   host.dataset.settingsBound="true";
   host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#product-commission-settings")&&!form.matches("#service-commission-rule-form")&&!form.matches("[data-update-commission-rule]"))return;
    event.preventDefault();
    if(!active())return;
    const current=host._commissionConfig||{},orgId=current.orgId,productSetting=current.productSetting,serviceRules=current.serviceRules||[];
    if(!canManageCommissionSettings()){toast("Somente proprietário ou administrador pode alterar regras de comissão.");return;}
    const button=form.querySelector('[type="submit"]');if(!button||button.disabled)return;
    if(form.matches("[data-update-commission-rule]")){
     const values=new FormData(form),professionalId=String(values.get("professional_id")||""),serviceId=String(values.get("service_id")||""),rate=Number(values.get("rate")),ruleId=form.dataset.updateCommissionRule;
     if(!professionalId||!serviceId||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira profissional, serviço e percentual.");return;}
     if(serviceRules.some(rule=>rule.id!==ruleId&&rule.professional_id===professionalId&&rule.service_id===serviceId)){toast("Já existe outra regra para este profissional e serviço.");return;}
     button.disabled=true;button.textContent="Salvando…";
     try{
      await updateServiceCommissionRule({client:supabase,orgId,ruleId,professionalId,serviceId,rate});
      toast("Regra atualizada.");await refresh();
     }catch(error){reportError(error,{context:"Comissões > editar regra por serviço"});}
     finally{if(button.isConnected){button.disabled=false;button.textContent="Salvar";}}
     return;
    }
    if(form.matches("#service-commission-rule-form")){
     const values=new FormData(form),professionalId=String(values.get("professional_id")||""),serviceId=String(values.get("service_id")||""),rate=Number(values.get("rate"));
     if(!professionalId||!serviceId||!Number.isFinite(rate)||rate<0||rate>100){toast("Selecione o profissional, o serviço e informe um percentual entre 0 e 100.");return;}
     if(serviceRules.some(rule=>rule.professional_id===professionalId&&rule.service_id===serviceId)){toast("Já existe uma regra para este profissional e serviço. Exclua a regra anterior antes de cadastrar outra.");return;}
     button.disabled=true;button.textContent="Salvando…";
     try{
      await createServiceCommissionRule({client:supabase,orgId,professionalId,serviceId,rate});
      toast("Regra de comissão salva.");
      await refresh();
     }catch(error){reportError(error,{context:"Comissões > cadastrar regra por serviço"});}
     finally{if(button.isConnected){button.disabled=false;button.textContent="Adicionar regra";}}
     return;
    }
    const values=new FormData(form),enabled=values.get("enabled")==="on",rate=Number(values.get("rate"));
    if(!Number.isFinite(rate)||rate<0||rate>100||(enabled&&rate<=0)){toast("Informe uma comissão entre 0,01% e 100% quando a regra estiver ativa.");return;}
    button.disabled=true;button.textContent="Salvando…";
    try{
     await saveProductCommissionSetting({
      client:supabase,orgId,settingId:productSetting?.id||null,
      userId:state.user?.id||null,enabled,rate
     });
     toast(enabled?"Comissão de produtos ativada.":"Comissão de produtos desativada.");
     await refresh();
    }catch(error){reportError(error,{context:"Comissões > configurar comissão de produtos"});}
    finally{if(button.isConnected){button.disabled=false;button.textContent="Salvar configuração";}}
   });
  }
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async event=>{
    if(!active())return;
    const current=host._commissionConfig||{},orgId=current.orgId,professionalMap=current.professionalMap||new Map(),visible=current.visible||[];
    if(event.target.closest("[data-clear-commission-filter]")){
     clearFilter();await refresh();return;
    }
    const deleteRule=event.target.closest("[data-delete-commission-rule]");
    if(deleteRule){
     if(deleteRule.disabled)return;
     if(!canManageCommissionSettings()){toast("Você não tem permissão para alterar regras.");return;}
     if(!window.confirm("Excluir esta regra específica? O sistema voltará a usar a comissão padrão do profissional."))return;
     deleteRule.disabled=true;
     try {
      await deleteServiceCommissionRule({client:supabase,orgId,ruleId:deleteRule.dataset.deleteCommissionRule});
      toast("Regra removida.");
      await refresh();
     } catch(error) {
      reportError(error,{context:"Comissões > excluir regra"});
     } finally {
      if(deleteRule.isConnected)deleteRule.disabled=false;
     }
     return;
    }
    const button=event.target.closest("[data-pay-commissions]");
    if(!button||button.disabled)return;
    if(!canPay()){toast("Seu perfil não pode efetuar pagamentos de comissão.");return;}
    const professionalId=button.dataset.payCommissions;
    const checked=[...host.querySelectorAll('[data-commission-select]:checked')].filter(input=>input.dataset.professionalId===professionalId);
    const ids=checked.map(input=>input.dataset.commissionSelect);
    if(!ids.length){toast("Selecione as comissões que deseja pagar.");return;}
    const method=host.querySelector('[data-payment-method="'+professionalId+

'"]')?.value||"pix";
    const name=professionalMap.get(professionalId)?.name||"profissional";
    let summary;
    try {
     summary=summarizeCommissionPayout({rows:visible,professionalId,selectedIds:ids});
    } catch(error) {
     reportError(error,{context:"Comissões > conferir repasse"});
     return;
    }
    if(summary.net<=0){toast("Saldo líquido insuficiente. Os débitos permanecem pendentes.");return;}
    const confirmation=summary.debit>0
      ? "Créditos: "+money(summary.credit)+"\nDébitos de estorno: "+money(summary.debit)+"\nRepasse líquido: "+money(summary.net)
      : "Repasse: "+money(summary.net);
    if(!window.confirm(confirmation+"\nConfirmar pagamento para "+name+"? O valor líquido será registrado como saída no Caixa."))return;
    button.disabled=true;button.textContent="Registrando…";
    let payment;
    try {
     payment={data:await payProfessionalCommissions({
      client:supabase,orgId,professionalId,commissionIds:ids,
      paymentMethod:method,notes:"Pagamento de comissões"
     })};
    } catch(error) {
     reportError(error,{context:"Comissões > registrar pagamento"});
     button.disabled=false;button.textContent="Pagar selecionadas";return;
    }
    toast(money(payment.data?.amount)+

" pago. Caixa e histórico atualizados.");await refresh();
   });
  }
}
