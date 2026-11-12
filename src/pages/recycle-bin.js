import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";

let selectedGroup=null;
const actionLabel={INSERT:"Criou",UPDATE:"Atualizou",DELETE:"Excluiu",RESTORE:"Restaurou",PERMANENT_DELETE:"Exclusão permanente"};
const dateTime=value=>new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
export function recycleBinPage(){
 selectedGroup=null;
 return head("Recuperar","Consulte exclusões realizadas nos últimos 30 dias, veja o histórico e restaure registros.")+
  '<div id="recycle-bin-manager"><div class="empty-state">Carregando lixeira e auditoria…</div></div>';
}
function actorName(actorId,map){
 if(!actorId)return "Sistema";
 return map.get(actorId)||"Usuário";
}
function renderDetailsModal(group,profiles){
 const first=group.entries[0];
 const details=group.entries.map(entry=>{
  const pairs=Object.entries(entry.row_data||{});
  return '<section class="recycle-item-detail"><h3>'+esc(entry.description)+'</h3><div class="recycle-detail-meta"><span>'+esc(entry.entity_table)+'</span><span>ID: '+esc(entry.entity_id)+'</span></div>'+
   '<dl>'+pairs.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(typeof value==="object"&&value!==null?JSON.stringify(value):String(value??"—"))+'</dd></div>').join("")+'</dl></section>';
 }).join("");
 return '<div class="recycle-modal-backdrop" data-action="close-recycle-modal"></div><section class="recycle-modal" role="dialog" aria-modal="true" aria-label="Detalhes dos dados excluídos">'+
  '<header><div><small>RECUPERAR · DETALHES</small><h2>Dados excluídos</h2></div><button type="button" class="icon-btn" data-action="close-recycle-modal" aria-label="Fechar">×</button></header>'+
  '<div class="recycle-modal-meta"><div><span>Excluído por</span><b>'+esc(actorName(first.deleted_by,profiles))+'</b></div><div><span>Data e hora</span><b>'+dateTime(first.deleted_at)+'</b></div><div><span>Disponível até</span><b>'+dateTime(first.expires_at)+'</b></div><div><span>Registros nesta operação</span><b>'+group.entries.length+'</b></div></div>'+
  '<div class="recycle-modal-content">'+details+'</div>'+
  '<footer><button type="button" class="btn secondary" data-action="close-recycle-modal">Fechar</button><button type="button" class="btn secondary" data-recycle-delete="'+group.id+'">Excluir permanentemente</button><button type="button" class="btn primary" data-recycle-restore="'+group.id+'">Restaurar dados</button></footer>'+
  '</section>';
}
function renderPage(host,groups,events,profiles){
 const deletedCount=groups.reduce((sum,g)=>sum+g.entries.length,0);
 host.innerHTML=`
 <section class="settings-card recycle-summary">
  <div><span class="eyebrow">LIXEIRA</span><h2>${deletedCount} registro(s) disponíveis</h2><p>Os snapshots ficam disponíveis por 30 dias após a exclusão.</p></div>
 </section>
 <div class="section-title"><h2>Itens excluídos</h2><span class="result-count">${groups.length} operação(ões)</span></div>
 <div class="record-list">
 ${groups.map(group=>{
  const first=group.entries[0];
  const names=group.entries.map(e=>e.entity_table).filter((v,i,a)=>a.indexOf(v)===i).join(", ");
  return '<button class="record-card" data-recycle-open="'+group.id+'"><span class="record-main"><b>'+esc(group.entries.length+' registro(s) · '+names)+'</b><small>'+esc(first.description)+'</small><small>Excluído por '+esc(actorName(first.deleted_by,profiles))+' · '+dateTime(first.deleted_at)+'</small></span><span class="record-trailing"><small>Expira em</small><b>'+new Date(first.expires_at).toLocaleDateString("pt-BR")+'</b></span><span class="record-chevron">›</span></button>';
 }).join("")||'<div class="empty-state">A lixeira está vazia.</div>'}
 </div>
 <div class="section-title section-title--spaced"><h2>Histórico de operações</h2><span class="result-count">Últimas 100 ações</span></div>
 <div class="record-list">
 ${events.map(event=>'<article class="record-card"><span class="record-main"><b>'+esc(actionLabel[event.action]||event.action)+' · '+esc(event.table_name)+'</b><small>'+esc(event.description)+'</small><small>'+esc(actorName(event.actor_id,profiles))+' · '+dateTime(event.occurred_at)+'</small></span><span class="record-trailing"><small>'+esc(event.actor_role||"Sistema")+'</small><small>'+esc(event.record_id||"—")+'</small></span></article>').join("")||'<div class="empty-state">Nenhuma operação registrada.</div>'}
 </div>
 <div id="recycle-modal-root"></div>`;
 if(selectedGroup){
  const group=groups.find(g=>g.id===selectedGroup);
  if(group)host.querySelector("#recycle-modal-root").innerHTML=renderDetailsModal(group,profiles);
 }
}
export async function loadRecycleBinPage(){
 const host=document.querySelector("#recycle-bin-manager");
 if(!host||!state.organization?.id)return;
 try{
  const [binResult,auditResult]=await Promise.all([
   supabase.from("recycle_bin").select("id,org_id,entity_table,entity_id,description,row_data,deleted_by,deleted_role,deleted_at,expires_at,delete_group,status")
    .eq("org_id",state.organization.id).eq("status","active").gt("expires_at",new Date().toISOString()).order("deleted_at",{ascending:false}).limit(1000),
   supabase.from("audit_events").select("id,action,table_name,record_id,description,actor_id,actor_role,occurred_at")
    .eq("org_id",state.organization.id).order("occurred_at",{ascending:false}).limit(100)
  ]);
  if(binResult.error)throw binResult.error;
  if(auditResult.error)throw auditResult.error;
  const rows=binResult.data||[],events=auditResult.data||[];
  const ids=[...new Set([...rows.map(r=>r.deleted_by),...events.map(e=>e.actor_id)].filter(Boolean))];
  let profiles=new Map();
  if(ids.length){
   const result=await supabase.from("profiles").select("id,full_name").in("id",ids);
   if(!result.error)profiles=new Map((result.data||[]).map(p=>[p.id,p.full_name]));
  }
  const grouped=new Map();
  for(const row of rows){
   const current=grouped.get(row.delete_group)||{id:row.delete_group,entries:[]};
   current.entries.push(row);grouped.set(row.delete_group,current);
  }
  const groups=[...grouped.values()].sort((a,b)=>new Date(b.entries[0].deleted_at)-new Date(a.entries[0].deleted_at));
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async event=>{
    const open=event.target.closest("[data-recycle-open]");
    if(open){selectedGroup=open.dataset.recycleOpen;await loadRecycleBinPage();return;}
    const close=event.target.closest('[data-action="close-recycle-modal"]');
    if(close){selectedGroup=null;await loadRecycleBinPage();return;}
    const restore=event.target.closest("[data-recycle-restore]");
    if(restore){
     const groupId=restore.dataset.recycleRestore;
     if(!window.confirm("Restaurar todos os registros desta operação?"))return;
     const {data,error}=await supabase.rpc("restore_recycle_bin_group",{p_group_id:groupId});
     if(error){toast(error.message||"Não foi possível restaurar os registros.");return;}
     selectedGroup=null;toast(Number(data||0)+" registro(s) restaurado(s).");await loadRecycleBinPage();return;
    }
    const remove=event.target.closest("[data-recycle-delete]");
    if(remove){
     const groupId=remove.dataset.recycleDelete;
     if(!window.confirm("Excluir permanentemente os snapshots desta operação? Esta ação não pode ser desfeita."))return;
     const {data,error}=await supabase.rpc("permanently_delete_recycle_bin_group",{p_group_id:groupId});
     if(error){toast(error.message||"Não foi possível excluir permanentemente.");return;}
     selectedGroup=null;toast(Number(data||0)+" snapshot(s) removido(s) permanentemente.");await loadRecycleBinPage();
    }
   });
  }
  renderPage(host,groups,events,profiles);
 }catch(error){
  reportError(error,{context:"Recuperar > carregar lixeira e auditoria"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar Recuperar.</b><small>Verifique sua permissão e tente novamente.</small></div>';
 }
}
