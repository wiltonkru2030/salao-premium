/**
 * Módulo: Unidades e filiais.
 * Responsabilidade: apresentar e administrar filiais da organização ativa.
 * Integração: a unidade organiza catálogo, equipe, agenda e dados comerciais do salão.
 * Segurança: consultas/mutações passam pelo serviço do domínio e pelas políticas RLS.
 * Limite: a matriz é administrada pelo cadastro da organização e não pode ser inativada aqui.
 */
import {formatSavedPhone} from "../utils/input-masks.js";
import {supabase} from "../supabase/client.js";
import {state} from "../state.js";
import {head,esc,toast,btn} from "../utils.js";
import {reportError} from "../utils/errors.js";
import {listBranches,saveBranch,setBranchActive} from "../modules/branches/branches.service.js";

let modalListenerInstalled=false;
let branchesCache=[];

/** Somente proprietário e administrador podem cadastrar ou alterar unidades. */
const canManageBranches=()=>["owner","admin"].includes(state.membership?.role);

/**
 * Abre modal de criação/edição e preenche dados da filial.
 * @param {object|null} branch Filial existente ou null para nova unidade.
 * @returns {void} Exibe o modal com os campos preenchidos.
 */
function openBranchModal(branch=null) {
  const dialog=document.querySelector("#branch-create-modal");
  const form=dialog?.querySelector("#branch-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.branch_id.value=branch?.id||"";
  form.elements.name.value=branch?.name||"";
  form.elements.phone.value=formatSavedPhone(branch?.phone);
  form.elements.email.value=branch?.email||"";
  form.elements.document.value=branch?.document||"";
  const title=dialog.querySelector("#branch-modal-title");
  const submit=form.querySelector('[type="submit"]');
  if(title)title.textContent=branch?"Editar unidade":"Nova unidade";
  if(submit)submit.textContent=branch?"Salvar alterações":"Cadastrar unidade";
  if(!dialog.open)dialog.showModal();
}

/** Renderiza a página de unidades e a ação de cadastro conforme o perfil. */
export function branchesPage() {
  return head("Unidades","Gerencie as filiais vinculadas à organização.",
    canManageBranches()?btn("＋ Nova unidade","open-branch-modal","primary"):"")+
    '<div id="branches-manager"><div class="empty-state">Carregando unidades…</div></div>';
}

/**
 * Carrega filiais paginadas do tenant e instala eventos da tela uma única vez.
 * @returns {Promise<void>} Atualiza a listagem e estados de erro/vazio.
 */
export async function loadBranchesPage() {
  const host=document.querySelector("#branches-manager");
  if(!host||!state.organization?.id)return;
  const orgId=state.organization.id,userId=state.user?.id,role=state.membership?.role;
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  // Descarta respostas obsoletas ao trocar página, usuário ou organização.
  const current=()=>host.isConnected&&state.page==='Unidades'&&state.organization?.id===orgId&&state.user?.id===userId&&state.membership?.role===role&&host.dataset.request===request;
  let branches;
  try {
    branches=await listBranches({client:supabase,orgId});
    if(!current())return;
    branchesCache=branches;
  } catch(error) {
    if(!current())return;
    reportError(error,{context:"Unidades > carregar filiais"});
    host.innerHTML='<div class="empty-state"><b>Não foi possível carregar as unidades.</b><small>Verifique sua conexão e suas permissões. Tente novamente.</small></div>';
    return;
  }

  const cards=branchesCache.map(branch=>{
    const actions=canManageBranches()&&!branch.is_main
      ? '<button class="btn secondary" type="button" data-edit-branch="'+esc(branch.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-branch="'+esc(branch.id)+'" data-active="'+(branch.active?"true":"false")+'">'+(branch.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(branch.name)+(branch.is_main?' <small>· Matriz</small>':"")+'</b>'+
      '<small>'+esc(branch.phone||"Telefone não informado")+'</small>'+
      '<small>'+esc(branch.email||branch.document||"")+'</small></span>'+
      '<span class="record-trailing"><small class="status-pill '+(branch.active?"active":"inactive")+'">'+(branch.active?"Ativa":"Inativa")+'</small>'+actions+'</span></article>';
  }).join("");

  host.innerHTML=
    '<dialog class="sp-modal" id="branch-create-modal" aria-labelledby="branch-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="branch-modal-title">Nova unidade</h2><p>Cadastre uma filial vinculada a esta organização.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-branch-modal aria-label="Fechar">×</button></header>'+
      '<form id="branch-create-form"><input type="hidden" name="branch_id"><div class="sp-modal-body">'+
      '<label class="sp-span">Nome da unidade<input name="name" required minlength="2" maxlength="120" placeholder="Ex.: Unidade Centro"></label>'+
      '<label>Telefone<input name="phone" type="tel" data-mask="phone" maxlength="30" placeholder="(00) 00000-0000"></label>'+
      '<label>E-mail<input name="email" type="email" maxlength="160" placeholder="unidade@seudominio.com"></label>'+
      '<label class="sp-span">Documento (opcional)<input name="document" maxlength="30" placeholder="CPF ou CNPJ"></label>'+
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-branch-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar unidade</button></footer></form></div></dialog>'+
    '<div class="list-toolbar"><span class="result-count">'+branchesCache.length+' unidade(s)</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhuma unidade cadastrada.</div>')+'</div>'+
    '<p class="demo-note">A matriz é preservada e deve ser alterada no cadastro da organização.</p>';

  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";

  if(!modalListenerInstalled) {
    modalListenerInstalled=true;
    document.addEventListener("click",event=>{
      const dialog=document.querySelector("#branch-create-modal");
      if(!dialog)return;
      if(event.target.closest('[data-action="open-branch-modal"]')&&canManageBranches())openBranchModal();
      else if(event.target.closest("[data-close-branch-modal]")||event.target===dialog) {
        if(dialog.open)dialog.close();
      }
    });
  }

  host.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-branch]");
    if(edit) {
      if(!canManageBranches())return toast("Seu perfil não pode editar unidades.");
      openBranchModal(branchesCache.find(branch=>branch.id===edit.dataset.editBranch)||null);
      return;
    }
    const toggle=event.target.closest("[data-toggle-branch]");
    if(!toggle)return;
    if(!canManageBranches())return toast("Seu perfil não pode alterar unidades.");
    const nextActive=toggle.dataset.active!=="true";
    if(!window.confirm(nextActive?"Reativar esta unidade?":"Inativar esta unidade? O histórico será preservado."))return;
    toggle.disabled=true;
    try {
      await setBranchActive({client:supabase,orgId:state.organization.id,branchId:toggle.dataset.toggleBranch,active:nextActive});
      toast(nextActive?"Unidade reativada.":"Unidade inativada.");
      await loadBranchesPage();
    } catch(error) {
      reportError(error,{context:"Unidades > alterar situação"});
    } finally {
      if(toggle.isConnected)toggle.disabled=false;
    }
  });

  host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#branch-create-form"))return;
    event.preventDefault();
    if(!canManageBranches())return toast("Seu perfil não pode cadastrar unidades.");
    const values=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    const email=String(values.get("email")||"").trim();
    if(email&&!form.elements.email.validity.valid)return toast("Informe um e-mail válido.");
    submit.disabled=true;
    try {
      const branchId=String(values.get("branch_id")||"").trim()||null;
      await saveBranch({
        client:supabase,orgId:state.organization.id,branchId,
        name:values.get("name"),phone:values.get("phone"),
        email,document:values.get("document")
      });
      document.querySelector("#branch-create-modal")?.close();
      toast(branchId?"Unidade atualizada.":"Unidade cadastrada.");
      await loadBranchesPage();
    } catch(error) {
      reportError(error,{context:"Unidades > salvar filial"});
    } finally {
      if(submit.isConnected)submit.disabled=false;
    }
  });
}
