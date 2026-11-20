/** Módulo Profissionais: cadastro, dados fiscais, serviços habilitados e permissões vinculados ao tenant ativo. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast } from "../utils.js";
import { onlyDigits, validCpf, validCnpj } from "../modules/professionals/professionals.validation.js";
import { renderProfessionalsView } from "../modules/professionals/professionals.view.js";
import { reportError } from "../utils/errors.js";
import { fetchProfessionalWorkspace, setProfessionalActive, setTeamProfessionalAppAccess, revokeProfessionalAppAccess, createProfessionalWithServices } from "../modules/professionals/professionals.service.js";

/** Módulo Profissionais: cadastro fiscal, vínculo de serviços e controle de acesso ao App Profissional. */

const initialPasswords=new Map();
/** Escrita em profissionais, vínculos e gestão de acesso exige owner/admin no banco. */
const canManageProfessionals=()=>["owner","admin"].includes(state.membership?.role);
/** Renderiza a página de Profissionais e o acesso ao cadastro e permissões. */
export function professionalsPage(){
 return head("Profissionais","Cadastre profissionais e gerencie o acesso individual por CPF ao App Profissional.")+
  '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>'+
  '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
/** Consulta profissionais e serviços habilitados da organização ativa. */
export async function loadProfessionalsPage(){
 const host=document.querySelector("#professionals-access");
 if(!host||!state.organization?.id)return;
 let workspace;
 try {
  workspace=await fetchProfessionalWorkspace({
   client:supabase,orgId:state.organization.id,currentUserId:state.user?.id
  });
 } catch(error) {
  reportError(error,{context:"Profissionais > carregar cadastros"});
  host.innerHTML='<div class="empty-state">Não foi possível carregar os dados da equipe. Atualize a página e tente novamente.</div>';
  return;
 }
 host.innerHTML=renderProfessionalsView(workspace,{currentUserId:state.user?.id,canManage:canManageProfessionals(),initialPasswords});
 if(host.dataset.bound==="true")return;
 host.dataset.bound="true";
 host.addEventListener("click",async event=>{
  if(event.target.closest("[data-open-professional-modal]") && canManageProfessionals()){const modal=host.querySelector("#professional-create-modal");if(modal&&!modal.open){modal.showModal();modal.querySelector('[name="name"]')?.focus();}return;}
  if(event.target===host.querySelector("#professional-create-modal")||event.target.closest("[data-close-professional-modal]")){host.querySelector("#professional-create-modal")?.close();return;}
  const activeToggle=event.target.closest("[data-toggle-professional-active]");
  if(activeToggle) {
   if(!canManageProfessionals()){toast("Somente proprietário ou administrador pode alterar profissionais.");return;}
   if(activeToggle.disabled){toast("Revogue o acesso ao App Profissional antes de inativar este cadastro.");return;}
   const nextActive=activeToggle.dataset.active!=="true";
   if(!window.confirm(nextActive?"Reativar este profissional?":"Inativar este profissional? O histórico será preservado."))return;
   activeToggle.disabled=true;
   try {
    await setProfessionalActive({client:supabase,orgId:state.organization.id,professionalId:activeToggle.dataset.toggleProfessionalActive,active:nextActive});
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
    await setTeamProfessionalAppAccess({client:supabase,orgId:state.organization.id,userId,role,enabled});
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
    await revokeProfessionalAppAccess({client:supabase,orgId:state.organization.id,professionalId:id});
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
  let button;
  try{
  const form=event.target;button=form.querySelector('[type="submit"]');const v=new FormData(form);
  const name=String(v.get("name")||"").trim(),cpf=onlyDigits(v.get("cpf")),phone=String(v.get("phone")||"").trim(),email=String(v.get("email")||"").trim(),rate=Number(v.get("commission_rate")||0),taxRegime=String(v.get("tax_regime")||"individual"),cnpj=onlyDigits(v.get("cnpj"));
  const serviceIds=[...form.querySelectorAll('input[name="service_ids"]:checked')].map(input=>input.value);
  if(!name||!validCpf(cpf)||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira nome, CPF e comissão.");return;}
  if(taxRegime==="mei"&&(!validCnpj(cnpj)||!String(v.get("legal_name")||"").trim())){toast("Para MEI, informe CNPJ válido e razão social.");return;}
  if(!serviceIds.length){toast("Selecione ao menos um serviço que o profissional atende.");return;}
  button.disabled=true;button.textContent="Salvando…";
   const professionalId=await createProfessionalWithServices({
    client:supabase,orgId:state.organization.id,branchId:state.branch?.id||null,name,phone,email,
    commissionRate:rate,taxRegime,cnpj,
    legalName:v.get("legal_name"),tradeName:v.get("trade_name"),
    specialty:v.get("specialty"),serviceIds
   });
   const enableApp=v.get("enable_app")==="on";
  let appNotice="";
  if(enableApp){
   const {data:access,error:accessError}=await supabase.functions.invoke("manage-professional-access",{body:{action:"create",org_id:state.organization.id,professional_id:professionalId,cpf}});
   if(accessError||!access?.success){
    if(accessError)reportError(accessError,{context:"Profissionais > liberar App durante cadastro"});
    appNotice=access?.error||"Cadastro salvo, mas não foi possível liberar o App. Você pode liberar depois no cartão do profissional.";
   }else if(access.temporary_password){
    initialPasswords.set(professionalId,access.temporary_password);
    window.alert("Senha temporária de "+(access.professional_name||name)+":\\n"+access.temporary_password+"\\n\\nEntregue ao profissional por um canal seguro. Ela será solicitada apenas neste primeiro acesso.");
   }
  }
  form.reset();
  const meiFields=host.querySelector("#professional-mei-fields");if(meiFields){meiFields.hidden=true;meiFields.querySelector('[name="cnpj"]').required=false;meiFields.querySelector('[name="legal_name"]').required=false;}
  host.querySelector("#professional-service-filter").value="";
  host.querySelector("#professional-create-modal")?.close();button.disabled=false;button.textContent="Salvar profissional";
  toast(appNotice||"Profissional cadastrado e serviços vinculados.");await loadProfessionalsPage();
  }catch(error){reportError(error,{context:"Profissionais > salvar cadastro"});if(button){button.disabled=false;button.textContent="Salvar profissional";}}
 });
 async function provision(button,action){
  const id=button.dataset.professionalReset||button.dataset.professionalToggle;
  const card=host.querySelector('[data-professional-card="'+id+'"]');
  const cpf=onlyDigits(card?.querySelector('[data-professional-cpf="'+id+'"]')?.value);
  if(!validCpf(cpf)){toast("Informe um CPF válido do profissional.");return false;}
  button.disabled=true;
  try {
   const {data,error}=await supabase.functions.invoke("manage-professional-access",{body:{action,org_id:state.organization.id,professional_id:id,cpf}});
   if(error||!data?.success){toast(data?.error||"Não foi possível criar o acesso.");return false;}
   if(data.temporary_password)initialPasswords.set(id,data.temporary_password);
   toast(action==="reset"?"Senha temporária redefinida.":"Acesso ao App Profissional liberado.");
   await loadProfessionalsPage();
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
