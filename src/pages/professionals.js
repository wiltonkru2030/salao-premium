import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, esc } from "../utils.js";

const initialPasswords=new Map();
const onlyDigits=value=>String(value||"").replace(/\D/g,"");
function validCpf(value){
 const cpf=onlyDigits(value);if(cpf.length!==11||/^([0-9])\1{10}$/.test(cpf))return false;
 const digit=(base,factor)=>{let sum=0;for(let i=0;i<base.length;i++)sum+=Number(base[i])*(factor-i);const rest=(sum*10)%11;return rest===10?0:rest;};
 return digit(cpf.slice(0,9),10)===Number(cpf[9])&&digit(cpf.slice(0,10),11)===Number(cpf[10]);
}
function validCnpj(value){
 const cnpj=onlyDigits(value);if(cnpj.length!==14||/^([0-9])\1{13}$/.test(cnpj))return false;
 const calc=(base,weights)=>{const sum=base.split("").reduce((total,n,i)=>total+Number(n)*weights[i],0),rest=sum%11;return rest<2?0:11-rest;};
 const first=calc(cnpj.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
 const second=calc(cnpj.slice(0,12)+first,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return first===Number(cnpj[12])&&second===Number(cnpj[13]);
}
export function professionalsPage(){
 return head("Profissionais","Cadastre profissionais e gerencie o acesso individual por CPF ao App Profissional.")+
  '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>'+
  '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
export async function loadProfessionalsPage(){
 const host=document.querySelector("#professionals-access");
 if(!host||!state.organization?.id)return;
 const [professionalResult,serviceResult,membersResult]=await Promise.all([
  supabase.from("professionals").select("id,name,phone,email,active,access_enabled,commission_rate,tax_regime,cnpj,legal_name,trade_name,specialty").eq("org_id",state.organization.id).order("name"),
  supabase.from("services").select("id,name,category,active").eq("org_id",state.organization.id).eq("active",true).order("category").order("name").limit(500),
  supabase.from("org_memberships").select("user_id,role,professional_app_enabled,professional_app_scope").eq("org_id",state.organization.id).eq("status","active").in("role",["owner","admin","receptionist"])
 ]);
 const {data,error}=professionalResult,{data:services, error:serviceError}=serviceResult,{data:members,error:membersError}=membersResult;
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os profissionais.</div>';return;}
 const targets=(members||[]).filter(m=>m.role==="receptionist"||m.user_id===state.user?.id);
 const targetIds=targets.map(m=>m.user_id);
 const {data:profiles}=targetIds.length?await supabase.from("profiles").select("id,full_name").in("id",targetIds):{data:[]};
 const profileNames=new Map((profiles||[]).map(p=>[p.id,p.full_name]));
 const groups=new Map();
 (services||[]).forEach(s=>{const category=s.category||"Outros";if(!groups.has(category))groups.set(category,[]);groups.get(category).push(s);});
 const serviceChoices=[...groups.entries()].map(([category,items])=>'<section class="professional-service-group"><b>'+esc(category)+'</b><div class="professional-service-options">'+items.map(s=>'<label><input type="checkbox" name="service_ids" value="'+s.id+'"><span>'+esc(s.name)+'</span></label>').join("")+'</div></section>').join("");
 host.innerHTML=`
 <div class="professional-page-toolbar"><div><h3>Equipe profissional</h3><p class="demo-note">Cadastre os dados, defina a área de atuação e vincule os serviços atendidos.</p></div><button class="btn primary" type="button" data-open-professional-modal>＋ Cadastrar profissional</button></div>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} profissionais</span></div>
 <div class="record-list">${(data||[]).map(p=>`
 <article class="record-card professional-access-card" data-professional-card="${p.id}">
  <span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.specialty||"Profissional")} · ${p.tax_regime==="mei"?"MEI":"Pessoa física"}</small><small>${esc(p.phone||p.email||"Sem contato")} · ${p.active?"Ativo":"Inativo"} · Comissão: ${Number(p.commission_rate||0)}%</small>
   ${p.tax_regime==="mei"?'<small>CNPJ: '+esc(p.cnpj||"—")+' · '+esc(p.legal_name||"")+'</small>':''}
   <label class="field">CPF para acesso ao aplicativo<input class="field" data-professional-cpf="${p.id}" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autocomplete="off"></label>
   <label class="field">Senha temporária<input class="field" type="password" data-initial-password="${p.id}" value="${esc(initialPasswords.get(p.id)||"")}" placeholder="Gerada ao liberar acesso" readonly></label>
  </span>
  <span class="record-trailing"><label class="access-toggle"><input type="checkbox" data-professional-toggle="${p.id}" ${p.access_enabled?"checked":""} ${!p.active?"disabled":""}><span>App Profissional</span></label>
   <button type="button" class="btn secondary" data-professional-reset="${p.id}" ${!p.access_enabled?"disabled":""}>Redefinir senha</button>
   <button type="button" class="btn secondary" data-professional-copy="${p.id}" ${!initialPasswords.has(p.id)?"disabled":""}>Copiar senha</button>
  </span>
 </article>`).join("")||'<div class="empty-state">Nenhum profissional cadastrado.</div>'}</div>
 <p class="demo-note">O CPF não é armazenado em texto puro. Ao liberar o App, o servidor cria a identificação protegida para login. A senha temporária é exibida uma única vez.</p>
 <dialog class="professional-modal" id="professional-create-modal">
  <form id="professional-create-form" class="professional-modal-form">
   <header class="professional-modal-head"><div><h2>Novo profissional</h2><p>Preencha os dados e selecione os serviços que ele atende.</p></div><button type="button" class="professional-modal-close" data-close-professional-modal aria-label="Fechar">×</button></header>
   <div class="professional-modal-body">
    <h3>Dados pessoais</h3>
    <div class="professional-form-grid">
     <label>Nome completo<input class="field" name="name" required maxlength="120" placeholder="Nome do profissional"></label>
     <label>CPF<input class="field" name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></label>
     <label>Telefone<input class="field" name="phone" type="tel" placeholder="(00) 00000-0000"></label>
     <label>E-mail<input class="field" name="email" type="email" placeholder="profissional@email.com"></label>
     <label>Especialidade / área de atuação<input class="field" name="specialty" maxlength="100" placeholder="Ex.: Manicure, cabeleireiro"></label>
     <label>Comissão padrão (%)<input class="field" name="commission_rate" type="number" min="0" max="100" step="0.01" value="0" required></label>
    </div>
    <h3>Dados fiscais</h3>
    <label>Tipo de cadastro<select class="field" name="tax_regime"><option value="individual">Pessoa física</option><option value="mei">MEI</option></select></label>
    <div id="professional-mei-fields" class="professional-form-grid" hidden>
     <label>CNPJ<input class="field" name="cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></label>
     <label>Razão social<input class="field" name="legal_name" maxlength="160" placeholder="Razão social do MEI"></label>
     <label>Nome fantasia (opcional)<input class="field" name="trade_name" maxlength="160" placeholder="Nome fantasia"></label>
    </div>
    <h3>Serviços que atende</h3>
    <p class="demo-note">Marque todos os serviços compatíveis com este profissional. Ex.: unhas para manicure; cabelo para cabeleireiro.</p>
    <input class="field" id="professional-service-filter" type="search" placeholder="Buscar serviço..." autocomplete="off">
    <div id="professional-service-choices">${serviceChoices||'<p class="empty-state">Cadastre serviços antes de vincular um profissional.</p>'}</div>
    <h3>Acesso ao App Profissional</h3>
    <label class="professional-app-option"><input type="checkbox" name="enable_app"><span><b>Liberar acesso ao App Profissional agora</b><small>O profissional entrará usando CPF e senha temporária. O CPF será protegido pelo servidor, não salvo em texto puro.</small></span></label>
   </div>
   <footer class="professional-modal-foot"><button type="button" class="btn secondary" data-close-professional-modal>Cancelar</button><button class="btn primary" type="submit">Salvar profissional</button></footer>
  </form>
 </dialog>`;
 if(serviceError){const box=host.querySelector("#professional-service-choices");if(box)box.innerHTML='<p class="empty-state">Não foi possível carregar os serviços.</p>';}
 host.insertAdjacentHTML("beforeend", `
 <details class="settings-card"><summary><b>Acesso ao App para proprietário e recepção</b></summary>
  <p class="demo-note">O proprietário ou administrador pode liberar o próprio acesso completo. A recepção recebe agenda completa e acesso operacional às comandas.</p>
  ${membersError?'<div class="empty-state">Não foi possível carregar as permissões da equipe.</div>':''}
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
  if(event.target.closest("[data-open-professional-modal]")){host.querySelector("#professional-create-modal")?.showModal();return;}
  if(event.target.closest("[data-close-professional-modal]")){host.querySelector("#professional-create-modal")?.close();return;}
  const reset=event.target.closest("[data-professional-reset]");
  if(reset){if(!window.confirm("Gerar uma nova senha temporária para este profissional?"))return;await provision(reset,"reset");return;}
  const copy=event.target.closest("[data-professional-copy]");
  if(copy){const id=copy.dataset.professionalCopy,password=initialPasswords.get(id);if(!password)return;await navigator.clipboard.writeText(password);toast("Senha inicial copiada.");}
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
  const staffToggle=event.target.closest("[data-staff-app-toggle]");
  if(staffToggle){
   const userId=staffToggle.dataset.staffAppToggle,role=staffToggle.dataset.staffRole,enabled=staffToggle.checked;
   staffToggle.disabled=true;
   const {error}=await supabase.rpc("set_professional_app_access",{p_target_user_id:userId,p_enabled:enabled,p_scope:role==="receptionist"?"calendar_all":"all"});
   staffToggle.disabled=false;
   if(error){toast(error.message||"Não foi possível atualizar o acesso ao App.");staffToggle.checked=!enabled;return;}
   toast(enabled?"Acesso ao App liberado.":"Acesso ao App revogado.");await loadProfessionalsPage();return;
  }
  const toggle=event.target.closest("[data-professional-toggle]");if(!toggle)return;
  const id=toggle.dataset.professionalToggle;
  if(toggle.checked){const ok=await provision(toggle,"create");if(!ok)toggle.checked=false;}
  else{
   toggle.disabled=true;const {error}=await supabase.rpc("revoke_professional_app_access",{p_professional_id:id});toggle.disabled=false;
   if(error){toast(error.message||"Não foi possível revogar o acesso.");toggle.checked=true;return;}
   initialPasswords.delete(id);toast("Acesso ao App Profissional revogado.");await loadProfessionalsPage();
  }
 });
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#professional-create-form"))return;
  event.preventDefault();
  const form=event.target,button=form.querySelector('[type="submit"]'),v=new FormData(form);
  const name=String(v.get("name")||"").trim(),cpf=String(v.get("cpf")||"").replace(/\\D/g,""),phone=String(v.get("phone")||"").trim(),email=String(v.get("email")||"").trim(),rate=Number(v.get("commission_rate")||0),taxRegime=String(v.get("tax_regime")||"individual"),cnpj=String(v.get("cnpj")||"").replace(/\\D/g,"");
  const serviceIds=[...form.querySelectorAll('input[name="service_ids"]:checked')].map(input=>input.value);
  if(!name||!validCpf(cpf)||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira nome, CPF e comissão.");return;}
  if(taxRegime==="mei"&&(!validCnpj(cnpj)||!String(v.get("legal_name")||"").trim())){toast("Para MEI, informe CNPJ válido e razão social.");return;}
  if(!serviceIds.length){toast("Selecione ao menos um serviço que o profissional atende.");return;}
  button.disabled=true;button.textContent="Salvando…";
  const payload={org_id:state.organization.id,name,phone:phone||null,email:email||null,commission_rate:rate,active:true,tax_regime:taxRegime,cnpj:taxRegime==="mei"?cnpj:null,legal_name:taxRegime==="mei"?String(v.get("legal_name")||"").trim():null,trade_name:taxRegime==="mei"?String(v.get("trade_name")||"").trim()||null:null,specialty:String(v.get("specialty")||"").trim()||null};
  const {data:professional,error:insertError}=await supabase.from("professionals").insert(payload).select("id").single();
  if(insertError){button.disabled=false;button.textContent="Salvar profissional";toast("Não foi possível cadastrar: "+insertError.message);return;}
  const links=serviceIds.map(service_id=>({org_id:state.organization.id,professional_id:professional.id,service_id}));
  const {error:linkError}=await supabase.from("professional_services").insert(links);
  if(linkError){await supabase.from("professionals").delete().eq("org_id",state.organization.id).eq("id",professional.id);button.disabled=false;button.textContent="Salvar profissional";toast("Não foi possível vincular os serviços: "+linkError.message);return;}
  const enableApp=v.get("enable_app")==="on";
  if(enableApp){
   const {data:access,error:accessError}=await supabase.functions.invoke("manage-professional-access",{body:{action:"create",org_id:state.organization.id,professional_id:professional.id,cpf}});
   if(accessError||!access?.success){
    toast(access?.error||"Cadastro salvo, mas não foi possível liberar o App. Você pode liberar depois no cartão do profissional.");
   }else if(access.temporary_password){
    initialPasswords.set(professional.id,access.temporary_password);
    window.alert("Senha temporária de "+(access.professional_name||name)+":\\n"+access.temporary_password+"\\n\\nEntregue ao profissional por um canal seguro. Ela será solicitada apenas neste primeiro acesso.");
   }
  }
  form.reset();host.querySelector("#professional-create-modal")?.close();button.disabled=false;button.textContent="Salvar profissional";
  toast("Profissional cadastrado e serviços vinculados.");await loadProfessionalsPage();
 });
 async function provision(button,action){
  const id=button.dataset.professionalReset||button.dataset.professionalToggle;
  const card=host.querySelector('[data-professional-card="'+id+'"]');
  const cpf=String(card?.querySelector('[data-professional-cpf="'+id+'"]')?.value||"").replace(/\\D/g,"");
  if(cpf.length!==11){toast("Informe os 11 números do CPF do profissional.");return false;}
  button.disabled=true;
  const {data,error}=await supabase.functions.invoke("manage-professional-access",{body:{action,org_id:state.organization.id,professional_id:id,cpf}});
  button.disabled=false;
  if(error||!data?.success){toast(data?.error||"Não foi possível criar o acesso.");return false;}
  if(data.temporary_password)initialPasswords.set(id,data.temporary_password);
  toast(action==="reset"?"Senha temporária redefinida.":"Acesso ao App Profissional liberado.");
  await loadProfessionalsPage();
  const target=host.querySelector('[data-professional-card="'+id+'"]');
  if(target&&data.temporary_password){const pass=target.querySelector('[data-initial-password="'+id+'"]');if(pass)pass.value=data.temporary_password;const copy=target.querySelector('[data-professional-copy="'+id+'"]');if(copy)copy.disabled=false;window.alert("Senha temporária de "+data.professional_name+":\\n"+data.temporary_password+"\\n\\nEntregue ao profissional por um canal seguro.");}
  return true;
 }
}
