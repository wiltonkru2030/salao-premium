/**
 * Controlador da equipe: eventos, cadastro e permissões.
 * Recebe contexto e serviços da página, sem gerar marcação.
 */
import {requestProfessionalAccess} from "./professional-access.service.js";
import {onlyDigits,validCpf,validCnpj} from "./professionals.validation.js";
/**
 * Instala eventos delegados uma vez por montagem.
 * @param {object} options Contexto e dependências da equipe.
 * @returns {void}
 */
export function bindProfessionalEvents({host,client,state,initialPasswords,canManageProfessionals,toast,reportError,setProfessionalActive,setTeamProfessionalAppAccess,revokeProfessionalAppAccess,createProfessionalWithServices,updateProfessionalProfile,workspace,loadProfessionalsPage}) {
 // Atualiza os dados a cada recarga: eventos delegados permanecem instalados no host.
 // Sem isso, Editar cadastro reutilizava uma lista antiga após salvar ou trocar de filial.
 host._professionalWorkspace=workspace;
 if(host.dataset.bound==="true")return;
 host.dataset.bound="true";
 host.addEventListener("click",async event=>{
  // Reutiliza o modal para edição sem alterar CPF de acesso nem vínculos históricos.
  const edit=event.target.closest("[data-edit-professional]");
  if(edit){
   if(!canManageProfessionals())return toast("Você não tem permissão para editar profissionais.");
   const p=host._professionalWorkspace?.professionals?.find(item=>item.id===edit.dataset.editProfessional);
   const dialog=host.querySelector("#professional-create-modal"),form=dialog?.querySelector("#professional-create-form");
   if(!p||!form)return toast("Profissional não encontrado. Atualize os dados.");
   form.reset();
   for(const [field,value] of Object.entries({professional_id:p.id,name:p.name,phone:p.phone,email:p.email,specialty:p.specialty,commission_rate:p.commission_rate,tax_regime:p.tax_regime,cnpj:p.cnpj,legal_name:p.legal_name,trade_name:p.trade_name})){
    if(form.elements[field])form.elements[field].value=value??"";
   }
   const mei=p.tax_regime==="mei",meiFields=form.querySelector("#professional-mei-fields");
   if(meiFields){meiFields.hidden=!mei;meiFields.querySelector("[name=cnpj]").required=mei;meiFields.querySelector("[name=legal_name]").required=mei;}
   // CPF é credencial de acesso; a edição cadastral não o altera.
   form.elements.cpf.required=false;form.elements.cpf.closest("label").hidden=true;
   form.elements.enable_app.checked=false;
   form.elements.enable_app.closest("label").hidden=true;
   // Edição cadastral não altera vínculos até existir RPC transacional.
   form.querySelector("#professional-edit-services-notice").hidden=false;
   form.querySelector("#professional-new-services-help").hidden=true;
   form.querySelector("#professional-service-filter").hidden=true;
   form.querySelector("#professional-service-choices").hidden=true;
   form.querySelector("#professional-app-access-heading").hidden=true;
   form.querySelector("#professional-modal-title").textContent="Editar profissional";
   form.querySelector("[type=submit]").textContent="Salvar alterações";
   dialog.showModal();return;
  }
  if(event.target.closest("[data-open-professional-modal]") && canManageProfessionals()){const modal=host.querySelector("#professional-create-modal");if(modal&&!modal.open){const form=modal.querySelector("#professional-create-form");form.reset();form.elements.cpf.required=true;form.elements.cpf.closest("label").hidden=false;form.elements.enable_app.closest("label").hidden=false;form.querySelector("#professional-edit-services-notice").hidden=true;form.querySelector("#professional-new-services-help").hidden=false;form.querySelector("#professional-service-filter").hidden=false;form.querySelector("#professional-service-choices").hidden=false;form.querySelector("#professional-app-access-heading").hidden=false;form.querySelector("#professional-modal-title").textContent="Novo profissional";form.querySelector("[type=submit]").textContent="Salvar profissional";modal.showModal();modal.querySelector('[name="name"]')?.focus();}return;}
  if(event.target===host.querySelector("#professional-create-modal")||event.target.closest("[data-close-professional-modal]")){host.querySelector("#professional-create-modal")?.close();return;}
  const activeToggle=event.target.closest("[data-toggle-professional-active]");
  if(activeToggle) {
   if(!canManageProfessionals()){toast("Somente proprietário ou administrador pode alterar profissionais.");return;}
   if(activeToggle.disabled){toast("Revogue o acesso ao App Profissional antes de inativar este cadastro.");return;}
   const nextActive=activeToggle.dataset.active!=="true";
   if(!window.confirm(nextActive?"Reativar este profissional?":"Inativar este profissional? O histórico será preservado."))return;
   activeToggle.disabled=true;
   try {
    await setProfessionalActive({client,orgId:state.organization.id,branchId:state.branch?.id||null,professionalId:activeToggle.dataset.toggleProfessionalActive,active:nextActive});
    toast(nextActive?"Profissional reativado.":"Profissional inativado.");
    await loadProfessionalsPage();
   } catch(error) {
    reportError(error,{context:"Profissionais > alterar situação"});
   } finally {
    if(activeToggle.isConnected)activeToggle.disabled=false;
   }
   return;
  }
  const reset=event.target.closest("[data-professional-reset]");
  if((reset||event.target.closest("[data-professional-copy]"))&&!canManageProfessionals()){toast("Somente proprietário ou administrador pode gerenciar acessos.");return;}
  if(reset){if(!window.confirm("Gerar uma nova senha temporária para este profissional?"))return;await provision(reset,"reset");return;}
  const copy=event.target.closest("[data-professional-copy]");
  if(copy){
   const id=copy.dataset.professionalCopy,password=initialPasswords.get(id);
   if(!password)return;
   try {
    await navigator.clipboard.writeText(password);
    toast("Senha inicial copiada.");
   } catch(error) {
    reportError(error,{context:"Profissionais > copiar senha temporária"});
    toast("Não foi possível copiar. Selecione e copie a senha manualmente.");
   }
  }
 });
 host.addEventListener("input",event=>{
  if(event.target.id==="professional-service-filter"){
   const term=event.target.value.trim().toLocaleLowerCase("pt-BR");
   host.querySelectorAll(".professional-service-group").forEach(group=>{
    let visible=0;group.querySelectorAll("label").forEach(label=>{const show=label.textContent.toLocaleLowerCase("pt-BR").includes(term);label.hidden=!show;if(show)visible++;});group.hidden=visible===0;
   });
  }
 });
 host.addEventListener("change",async event=>{
  if(event.target.name==="tax_regime"){const mei=event.target.value==="mei",fields=host.querySelector("#professional-mei-fields");if(fields){fields.hidden=!mei;fields.querySelector('[name="cnpj"]').required=mei;fields.querySelector('[name="legal_name"]').required=mei;}return;}
  if(!canManageProfessionals()&&(event.target.closest("[data-staff-app-toggle]")||event.target.closest("[data-professional-toggle]"))){toast("Somente proprietário ou administrador pode alterar acessos.");await loadProfessionalsPage();return;}
  const staffToggle=event.target.closest("[data-staff-app-toggle]");
  if(staffToggle){
   const userId=staffToggle.dataset.staffAppToggle,role=staffToggle.dataset.staffRole,enabled=staffToggle.checked;
   staffToggle.disabled=true;
   try {
    await setTeamProfessionalAppAccess({client,orgId:state.organization.id,userId,role,enabled});
    toast(enabled?"Acesso ao App liberado.":"Acesso ao App revogado.");
    await loadProfessionalsPage();
   } catch(error) {
    reportError(error,{context:"Profissionais > alterar acesso da equipe"});
    staffToggle.checked=!enabled;
   } finally {
    if(staffToggle.isConnected)staffToggle.disabled=false;
   }
   return;
  }
  const toggle=event.target.closest("[data-professional-toggle]");if(!toggle)return;
  const id=toggle.dataset.professionalToggle;
  if(toggle.checked){const ok=await provision(toggle,"create");if(!ok)toggle.checked=false;}
  else{
   toggle.disabled=true;
   try {
    await revokeProfessionalAppAccess({client,orgId:state.organization.id,professionalId:id});
    initialPasswords.delete(id);
    toast("Acesso ao App Profissional revogado.");
    await loadProfessionalsPage();
   } catch(error) {
    reportError(error,{context:"Profissionais > revogar acesso ao App"});
    toggle.checked=true;
   } finally {
    if(toggle.isConnected)toggle.disabled=false;
   }
  }
 });
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#professional-create-form"))return;
  event.preventDefault();
  if(!canManageProfessionals()){toast("Somente proprietário ou administrador pode cadastrar profissionais.");return;}
  const orgId=state.organization?.id;
  const userId=state.user?.id;
  let button;
  try{
  const form=event.target;button=form.querySelector('[type="submit"]');if(!button||button.disabled)return;const v=new FormData(form);
  const name=String(v.get("name")||"").trim(),cpf=onlyDigits(v.get("cpf")),phone=String(v.get("phone")||"").trim(),email=String(v.get("email")||"").trim(),rate=Number(v.get("commission_rate")||0),taxRegime=String(v.get("tax_regime")||"individual"),cnpj=onlyDigits(v.get("cnpj"));
  const serviceIds=[...form.querySelectorAll('input[name="service_ids"]:checked')].map(input=>input.value);
  const editingId=String(v.get("professional_id")||"").trim();
  if(!name||(!editingId&&!validCpf(cpf))||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira nome, CPF e comissão.");return;}
  if(taxRegime==="mei"&&(!validCnpj(cnpj)||!String(v.get("legal_name")||"").trim())){toast("Para MEI, informe CNPJ válido e razão social.");return;}
  if(!editingId&&!serviceIds.length){toast("Selecione ao menos um serviço que o profissional atende.");return;}
  button.disabled=true;button.textContent="Salvando…";
   const professionalId=editingId ? (await updateProfessionalProfile({client,orgId,branchId:state.branch?.id||null,professionalId:editingId,name,phone,email,commissionRate:rate,taxRegime,cnpj,legalName:v.get("legal_name"),tradeName:v.get("trade_name"),specialty:v.get("specialty")}),editingId) : await createProfessionalWithServices({
    client,orgId,branchId:state.branch?.id||null,name,phone,email,
    commissionRate:rate,taxRegime,cnpj,
    legalName:v.get("legal_name"),tradeName:v.get("trade_name"),
    specialty:v.get("specialty"),serviceIds
   });
   if(!host.isConnected||state.organization?.id!==orgId||state.user?.id!==userId||!canManageProfessionals())return;
   const enableApp=v.get("enable_app")==="on";
  let appNotice="";
  // Na edição, credenciais e acesso ao App não são modificados.
  if(enableApp&&!editingId){
   const {data:access,error:accessError}=await requestProfessionalAccess({client,action:"create",orgId,professionalId,cpf});
   if(!host.isConnected||state.organization?.id!==orgId||state.user?.id!==userId||!canManageProfessionals())return;
   if(accessError||!access?.success){
    if(accessError)reportError(accessError,{context:"Profissionais > liberar App durante cadastro"});
    appNotice="Cadastro salvo, mas não foi possível liberar o App. Você pode liberar depois no cartão do profissional.";
   }else if(access.temporary_password){
    initialPasswords.set(professionalId,access.temporary_password);
    window.alert("Senha temporária de "+(access.professional_name||name)+":\\n"+access.temporary_password+"\\n\\nEntregue ao profissional por um canal seguro. Ela será solicitada apenas neste primeiro acesso.");
   }
  }
  form.reset();
  const meiFields=host.querySelector("#professional-mei-fields");if(meiFields){meiFields.hidden=true;meiFields.querySelector('[name="cnpj"]').required=false;meiFields.querySelector('[name="legal_name"]').required=false;}
  host.querySelector("#professional-service-filter").value="";
  host.querySelector("#professional-create-modal")?.close();button.disabled=false;button.textContent="Salvar profissional";
  toast(appNotice||(editingId?"Profissional atualizado. Serviços vinculados preservados.":"Profissional cadastrado e serviços vinculados."));await loadProfessionalsPage();
  }catch(error){reportError(error,{context:"Profissionais > salvar cadastro"});}finally{if(button?.isConnected){button.disabled=false;button.textContent="Salvar profissional";}}
 });
 /** Provisiona acesso e descarta respostas de contexto antigo. */
 async function provision(button,action){
  const orgId=state.organization?.id,userId=state.user?.id;
  const id=button.dataset.professionalReset||button.dataset.professionalToggle;
  const card=host.querySelector('[data-professional-card="'+id+'"]');
  const cpf=onlyDigits(card?.querySelector('[data-professional-cpf="'+id+'"]')?.value);
  if(!validCpf(cpf)){toast("Informe um CPF válido do profissional.");return false;}
  button.disabled=true;
  try {
   const {data,error}=await requestProfessionalAccess({client,action,orgId,professionalId:id,cpf});
   if(!host.isConnected||state.organization?.id!==orgId||state.user?.id!==userId||!canManageProfessionals())return false;
   if(error||!data?.success){toast("Não foi possível criar o acesso.");return false;}
   if(data.temporary_password)initialPasswords.set(id,data.temporary_password);
   toast(action==="reset"?"Senha temporária redefinida.":"Acesso ao App Profissional liberado.");
   await loadProfessionalsPage();
   if(!host.isConnected||state.organization?.id!==orgId||state.user?.id!==userId||!canManageProfessionals())return true;
   const target=host.querySelector('[data-professional-card="'+id+'"]');
   if(target&&data.temporary_password){const pass=target.querySelector('[data-initial-password="'+id+'"]');if(pass)pass.value=data.temporary_password;const copy=target.querySelector('[data-professional-copy="'+id+'"]');if(copy)copy.disabled=false;window.alert("Senha temporária de "+data.professional_name+":\\n"+data.temporary_password+"\\n\\nEntregue ao profissional por um canal seguro.");}
   return true;
  } catch(error) {
   reportError(error,{context:"Profissionais > provisionar acesso ao App"});
   toast("Não foi possível concluir a operação de acesso. Tente novamente.");
   return false;
  } finally {
   if(button.isConnected)button.disabled=false;
  }
 }
}
