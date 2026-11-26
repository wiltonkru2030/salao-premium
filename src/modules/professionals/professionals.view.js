/**
 * Interface da equipe: cartões, cadastro e gerenciamento de acessos.
 * Gera marcação sem consultar o banco ou instalar eventos.
 */
import {formatSavedPhone} from "../../utils/input-masks.js";
import {esc} from "../../utils.js";
/**
 * Renderiza os dados da equipe do contexto ativo.
 * @param {object} workspace Dados retornados pelo serviço.
 * @param {object} options Usuário, permissão e senhas temporárias em memória.
 * @returns {string} Interface da equipe.
 */
export function renderProfessionalsView(workspace,{currentUserId,canManage=false,initialPasswords=new Map()}={}) {
 const {professionals:data,services,members,assignments,profiles}=workspace;
 const serviceNames=new Map((services||[]).map(service=>[service.id,service.name]));
 const assignedNames=new Map();
 (assignments||[]).forEach(link=>{
  if(!assignedNames.has(link.professional_id))assignedNames.set(link.professional_id,[]);
  const name=serviceNames.get(link.service_id);
  if(name)assignedNames.get(link.professional_id).push(name);
 });
 const targets=(members||[]).filter(member=>member.role==="receptionist"||member.user_id===currentUserId);
 const profileNames=new Map((profiles||[]).map(profile=>[profile.id,profile.full_name]));
 const groups=new Map();
 (services||[]).forEach(s=>{const category=s.category||"Outros";if(!groups.has(category))groups.set(category,[]);groups.get(category).push(s);});
 const serviceChoices=[...groups.entries()].map(([category,items])=>'<section class="professional-service-group"><b>'+esc(category)+'</b><div class="professional-service-options">'+items.map(s=>'<label><input type="checkbox" name="service_ids" value="'+esc(s.id)+'"><span>'+esc(s.name)+'</span></label>').join("")+'</div></section>').join("");
 let html=`
 <div class="professional-page-toolbar">
  <button class="btn primary professional-add-button" type="button" data-open-professional-modal style="${canManage?"":"display:none"}"><span>＋</span> Novo profissional</button>
 </div>
 <div class="professional-roster-heading"><b>Equipe cadastrada</b><span class="professional-count">${data?.length||0} <small>PROFISSIONAIS</small></span></div>
 <div class="professional-roster">${(data||[]).map(p=>`
 <article class="professional-person-card" data-professional-card="${esc(p.id)}">
  <div class="professional-person-top">
   <div class="professional-avatar">${esc((p.name||"P").trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase())}</div>
   <div class="professional-person-identity"><h3>${esc(p.name)}</h3><p>${esc(p.specialty||"Profissional")} <span>·</span> ${p.tax_regime==="mei"?"MEI":"Pessoa física"}</p></div>
   <span class="professional-status ${p.active?"is-active":"is-inactive"}"><i></i>${p.active?"Ativo":"Inativo"}</span>
   ${canManage?'<div class="professional-card-actions"><button type="button" class="btn secondary" data-edit-professional="'+esc(p.id)+'">Editar cadastro</button><button type="button" class="btn secondary" data-toggle-professional-active="'+esc(p.id)+'" data-active="'+(p.active?"true":"false")+'" '+(p.access_enabled?'disabled title="Revogue o acesso ao App antes de inativar."':"")+'>'+(p.active?"Inativar":"Reativar")+'</button></div>':""}
  </div>
  <div class="professional-person-meta"><span>${esc(formatSavedPhone(p.phone)||p.email||"Contato não informado")}</span><span>Comissão <b>${Number(p.commission_rate||0)}%</b></span>${p.tax_regime==="mei"?'<span>CNPJ '+esc(p.cnpj||"—")+'</span>':''}</div>
  <div class="professional-assigned-services"><small>SERVIÇOS HABILITADOS</small><div>${(assignedNames.get(p.id)||[]).length?(assignedNames.get(p.id)||[]).map(name=>'<span>'+esc(name)+'</span>').join(""):'<em>Nenhum serviço vinculado</em>'}</div></div>
  <div class="professional-person-footer" style="${canManage?"":"display:none"}">
   <label class="professional-app-toggle"><input type="checkbox" data-professional-toggle="${esc(p.id)}" ${p.access_enabled?"checked":""} ${!p.active?"disabled":""}><span class="professional-switch"></span><span>App Profissional</span></label>
   <details class="professional-access-details"><summary>Gerenciar acesso</summary>
    <div class="professional-access-fields">
     <label>CPF de acesso<input data-professional-cpf="${esc(p.id)}" data-mask="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autocomplete="off"></label>
     <label>Senha temporária<input type="password" data-initial-password="${esc(p.id)}" value="${esc((canManage?initialPasswords.get(p.id):"")||"")}" placeholder="Gerada ao liberar acesso" readonly></label>
     <div><button type="button" class="btn secondary" data-professional-reset="${esc(p.id)}" ${!p.access_enabled?"disabled":""}>Redefinir senha</button><button type="button" class="btn secondary" data-professional-copy="${esc(p.id)}" ${!initialPasswords.has(p.id)?"disabled":""}>Copiar senha</button></div>
    </div>
   </details>
  </div>
 </article>`).join("")||'<div class="professional-empty"><span>—</span><b>Sua equipe começa aqui</b><p>Cadastre o primeiro profissional e vincule os serviços que ele realiza.</p><button class="btn primary" type="button" data-open-professional-modal>Novo profissional</button></div>'}</div>
 <p class="professional-security-note">Os dados de acesso são protegidos. A senha temporária é apresentada somente no momento da criação ou redefinição.</p>
 <dialog class="professional-modal sp-modal" id="professional-create-modal" aria-labelledby="professional-modal-title">
  <form id="professional-create-form" class="professional-modal-form sp-modal-shell"><input type="hidden" name="professional_id" value="">
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
     <label>CNPJ<input class="field" name="cnpj" data-mask="cnpj" autocapitalize="characters" spellcheck="false" maxlength="18" placeholder="00.000.000/0000-00"></label>
     <label>Razão social<input class="field" name="legal_name" maxlength="160" placeholder="Razão social do MEI"></label>
     <label>Nome fantasia (opcional)<input class="field" name="trade_name" maxlength="160" placeholder="Nome fantasia"></label>
    </div>
    <h3>Serviços que atende</h3>
    <p id="professional-edit-services-notice" class="demo-note" hidden>A edição de serviços ainda não está disponível para profissionais já cadastrados. Você pode consultar os serviços vinculados no cartão do profissional.</p>
    <p class="demo-note" id="professional-new-services-help">Marque todos os serviços compatíveis com este profissional. Ex.: unhas para manicure; cabelo para cabeleireiro.</p>
    <input class="field" id="professional-service-filter" type="search" placeholder="Buscar serviço..." autocomplete="off">
    <div id="professional-service-choices">${serviceChoices||'<p class="empty-state">Cadastre serviços antes de vincular um profissional.</p>'}</div>
    <h3 id="professional-app-access-heading">Acesso ao App Profissional</h3>
    <label class="professional-app-option"><input type="checkbox" name="enable_app"><span><b>Liberar acesso ao App Profissional agora</b><small>O profissional entrará usando CPF e senha temporária. Ao liberar o App, o CPF é protegido pelo servidor; se deixar desmarcado, o CPF não será gravado e precisará ser informado novamente ao liberar o acesso.</small></span></label>
   </div>
   <footer class="professional-modal-foot sp-modal-foot"><button type="button" class="btn secondary" data-close-professional-modal>Cancelar</button><button class="btn primary" type="submit">Salvar profissional</button></footer>
  </form>
 </dialog>`;
 if(canManage)html+=`
 <details class="settings-card"><summary><b>Acesso ao App para proprietário e recepção</b></summary>
  <p class="demo-note">O proprietário ou administrador pode liberar o próprio acesso completo. A recepção recebe agenda completa e acesso operacional às comandas.</p>
  
  <div class="record-list">${targets.map(m=>`
   <article class="record-card">
    <span class="record-main"><b>${esc(profileNames.get(m.user_id)|| (m.user_id===currentUserId?"Minha conta":"Usuário da recepção"))}</b>
     <small>${m.role==="receptionist"?"Recepção":"Proprietário / Administrador"} · ${m.role==="receptionist"?"Agenda completa":"Acesso administrativo completo"}</small></span>
    <span class="record-trailing"><label class="access-toggle"><input type="checkbox" data-staff-app-toggle="${esc(m.user_id)}" data-staff-role="${esc(m.role)}" ${m.professional_app_enabled?"checked":""}><span>Permitir acesso ao App</span></label></span>
   </article>`).join("")||'<div class="empty-state">Nenhuma conta de recepção ou administrador disponível.</div>'}</div>
 </details>`;

 return html;
}
