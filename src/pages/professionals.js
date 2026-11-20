/** Módulo Profissionais: cadastro, dados fiscais, serviços habilitados e permissões vinculados ao tenant ativo. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, esc } from "../utils.js";
import { onlyDigits, validCpf, validCnpj } from "../modules/professionals/professionals.validation.js";
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
 const {professionals:data,services,members,assignments,profiles}=workspace;
 const serviceNames=new Map((services||[]).map(service=>[service.id,service.name]));
 const assignedNames=new Map();
 (assignments||[]).forEach(link=>{
  if(!assignedNames.has(link.professional_id))assignedNames.set(link.professional_id,[]);
  const name=serviceNames.get(link.service_id);
  if(name)assignedNames.get(link.professional_id).push(name);
 });
 const targets=(members||[]).filter(member=>member.role==="receptionist"||member.user_id===state.user?.id);
 const profileNames=new Map((profiles||[]).map(profile=>[profile.id,profile.full_name]));
 const groups=new Map();
 (services||[]).forEach(s=>{const category=s.category||"Outros";if(!groups.has(category))groups.set(category,[]);groups.get(category).push(s);});
 const serviceChoices=[...groups.entries()].map(([category,items])=>'<section class="professional-service-group"><b>'+esc(category)+'</b><div class="professional-service-options">'+items.map(s=>'<label><input type="checkbox" name="service_ids" value="'+s.id+'"><span>'+esc(s.name)+'</span></label>').join("")+'</div></section>').join("");
 host.innerHTML=`
 <div class="professional-page-toolbar">
  <div><span class="professional-kicker">GESTÃO DA EQUIPE</span><h2>Sua equipe</h2><p>Organize especialidades, serviços e acessos em um só lugar.</p></div>
  <button class="btn primary professional-add-button" type="button" data-open-professional-modal style="${canManageProfessionals()?"":"display:none"}"><span>＋</span> Novo profissional</button>
 </div>
 <div class="professional-roster-heading"><div><b>Sua equipe</b><small>Profissionais cadastrados no salão</small></div><span class="professional-count">${data?.length||0} <small>PROFISSIONAIS</small></span></div>
 <div class="professional-roster">${(data||[]).map(p=>`
 <article class="professional-person-card" data-professional-card="${p.id}">
  <div class="professional-person-top">
   <div class="professional-avatar">${esc((p.name||"P").trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase())}</div>
   <div class="professional-person-identity"><h3>${esc(p.name)}</h3><p>${esc(p.specialty||"Profissional")} <span>·</span> ${p.tax_regime==="mei"?"MEI":"Pessoa física"}</p></div>
   <span class="professional-status ${p.active?"is-active":"is-inactive"}"><i></i>${p.active?"Ativo":"Inativo"}</span>
   ${canManageProfessionals()?'<button type="button" class="btn secondary" data-toggle-professional-active="'+p.id+'" data-active="'+(p.active?"true":"false")+'" '+(p.access_enabled?'disabled title="Revogue o acesso ao App antes de inativar."':"")+'>'+(p.active?"Inativar":"Reativar")+'</button>':""}
  </div>
  <div class="professional-person-meta"><span>${esc(p.phone||p.email||"Contato não informado")}</span><span>Comissão <b>${Number(p.commission_rate||0)}%</b></span>${p.tax_regime==="mei"?'<span>CNPJ '+esc(p.cnpj||"—")+'</span>':''}</div>
  <div class="professional-assigned-services"><small>SERVIÇOS HABILITADOS</small><div>${(assignedNames.get(p.id)||[]).length?(assignedNames.get(p.id)||[]).map(name=>'<span>'+esc(name)+'</span>').join(""):'<em>Nenhum serviço vinculado</em>'}</div></div>
  <div class="professional-person-footer" style="${canManageProfessionals()?"":"display:none"}">
   <label class="professional-app-toggle"><input type="checkbox" data-professional-toggle="${p.id}" ${p.access_enabled?"checked":""} ${!p.active?"disabled":""}><span class="professional-switch"></span><span>App Profissional</span></label>
   <details class="professional-access-details"><summary>Gerenciar acesso</summary>
    <div class="professional-access-fields">
     <label>CPF de acesso<input data-professional-cpf="${p.id}" data-mask="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autocomplete="off"></label>
     <label>Senha temporária<input type="password" data-initial-password="${p.id}" value="${esc(initialPasswords.get(p.id)||"")}" placeholder="Gerada ao liberar acesso" readonly></label>
     <div><button type="button" class="btn secondary" data-professional-reset="${p.id}" ${!p.access_enabled?"disabled":""}>Redefinir senha</button><button type="button" class="btn secondary" data-professional-copy="${p.id}" ${!initialPasswords.has(p.id)?"disabled":""}>Copiar senha</button></div>
    </div>
   </details>
  </div>
 </article>`).join("")||'<div class="professional-empty"><span>—</span><b>Sua equipe começa aqui</b><p>Cadastre o primeiro profissional e vincule os serviços que ele realiza.</p><button class="btn primary" type="button" data-open-professional-modal>Novo profissional</button></div>'}</div>
 <p class="professional-security-note">Os dados de acesso são protegidos. A senha temporária é apresentada somente no momento da criação ou redefinição.</p>
 <dialog class="professional-modal sp-modal" id="professional-create-modal" aria-labelledby="professional-modal-title">
  <form id="professional-create-form" class="professional-modal-form sp-modal-shell">
   <header class="professional-modal-head sp-modal-head"><div><h2 id="professional-modal-title">Novo profissional</h2><p>Preencha os dados e selecione os serviços que ele atende.</p></div><button type="button" class="professional-modal-close" data-close-professional-modal aria-label="Fechar">×</button></header>
   <div class="professional-modal-body sp-modal-body">
    <h3>Dados pessoais</h3>
    <div class="professional-form-grid">
     <label>Nome completo<input class="field" name="name" required maxlength="120" placeholder="Nome do profissional"></label>
     <label>CPF<input class="field" name="cpf" data-mask="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></label>
     <label>Telefone<input class="field" name="phone" data-mask="phone" type="tel" placeholder="(00) 00000-0000"></label>
     <label>E-mail<input class="field" name="email" type="email" placeholder="profissional@email.com"></label>
     <label>Especialidade / área de atuação<input class="field" name="specialty" maxlength="100" placeholder="Ex.: Manicure, cabeleireiro"></label>
     <label>Comissão padrão (%)<input class="field" name="commission_rate" type="number" min="0" max="100" step="0.01" value="0" required></label>
    </div>
    <h3>Dados fiscais</h3>
    <label>Tipo de cadastro<select class="field" name="tax_regime"><option value="individual">Pessoa física</option><option value="mei">MEI</option></select></label>
    <div id="professional-mei-fields" class="professional-form-grid" hidden>
     <label>CNPJ<input class="field" name="cnpj" data-mask="cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></label>
     <label>Razão social<input class="field" name="legal_name" maxlength="160" placeholder="Razão social do MEI"></label>
     <label>Nome fantasia (opcional)<input class="field" name="trade_name" maxlength="160" placeholder="Nome fantasia"></label>
    </div>
    <h3>Serviços que atende</h3>
    <p class="demo-note">Marque todos os serviços compatíveis com este profissional. Ex.: unhas para manicure; cabelo para cabeleireiro.</p>
    <input class="field" id="professional-service-filter" type="search" placeholder="Buscar serviço..." autocomplete="off">
    <div id="professional-service-choices">${serviceChoices||'<p class="empty-state">Cadastre serviços antes de vincular um profissional.</p>'}</div>
    <h3>Acesso ao App Profissional</h3>
    <label class="professional-app-option"><input type="checkbox" name="enable_app"><span><b>Liberar acesso ao App Profissional agora</b><small>O profissional entrará usando CPF e senha temporária. Ao liberar o App, o CPF é protegido pelo servidor; se deixar desmarcado, o CPF não será gravado e precisará ser informado novamente ao liberar o acesso.</small></span></label>
   </div>
   <footer class="professional-modal-foot sp-modal-foot"><button type="button" class="btn secondary" data-close-professional-modal>Cancelar</button><button class="btn primary" type="submit">Salvar profissional</button></footer>
  </form>
 </dialog>`;
 if(canManageProfessionals())host.insertAdjacentHTML("beforeend", `
 <details class="settings-card"><summary><b>Acesso ao App para proprietário e recepção</b></summary>
  <p class="demo-note">O proprietário ou administrador pode liberar o próprio acesso completo. A recepção recebe agenda completa e acesso operacional às comandas.</p>
  
  <div class="record-list">${targets.map(m=>`
   <article class="record-card">
    <span class="record-main"><b>${esc(profileNames.get(m.user_id)|| (m.user_id===state.user?.id?"Minha conta":"Usuário da recepção"))}</b>
     <small>${m.role==="receptionist"?"Recepção":"Proprietário / Administrador"} · ${m.role==="receptionist"?"Agenda completa":"Acesso administrativo completo"}</small></span>
    <span class="record-trailing"><label class="access-toggle"><input type="checkbox" data-staff-app-toggle="${m.user_id}" data-staff-role="${m.role}" ${m.professional_app_enabled?"checked":""}><span>Permitir acesso ao App</span></label></span>
   </article>`).join("")||'<div class="empty-state">Nenhuma conta de recepção ou administrador disponível.</div>'}</div>
 </details>`);
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
