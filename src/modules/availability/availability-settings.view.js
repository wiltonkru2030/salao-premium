/**
 * Interface de expediente e exceções da agenda.
 * Renderiza formulários administrativos e conecta as ações ao serviço protegido por RLS.
 */
import {
  addBranchBusinessHours, addProfessionalWorkingHours, addBranchClosure,
  addProfessionalTimeOff, removeAvailabilityEntry, updateWeeklyAvailability
} from "./availability.service.js";
import { reportError } from "../../utils/errors.js";
import { toast, esc } from "../../utils.js";

const DAYS=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const time=value=>esc(String(value||"").slice(0,5));
function record(title,detail,table,id,editable=null,canManage=true){
 return '<article class="record-card"><span class="record-main"><b>'+title+'</b><small>'+detail+'</small></span>'+(canManage?((editable?'<button class="btn secondary" type="button" data-edit-hours="'+esc(table)+'" data-id="'+esc(id)+'" data-weekday="'+esc(editable.weekday)+'" data-start="'+time(editable.start)+'" data-end="'+time(editable.end)+'" data-scope="'+esc(editable.scope)+'">Editar</button>':"")+'<button class="btn secondary" type="button" data-delete-availability="'+table+'" data-id="'+esc(id)+'">Excluir</button>'):"")+'</article>';
}

/** Gera a seção de configuração com os registros reais retornados pelo Supabase. */
export function renderAvailabilitySettings(data,canManage){
 if(!data) return '<section class="surface settings-panel"><div class="empty-state">Cadastre uma unidade para configurar o expediente.</div></section>';
 const professionals=data.professionals||[];
 const professionalOptions=professionals.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
 const branchRows=(data.branchHours||[]).map(h=>record(DAYS[h.weekday],time(h.opens_at)+' às '+time(h.closes_at),'branch_business_hours',h.id,{weekday:h.weekday,start:h.opens_at,end:h.closes_at,scope:h.branch_id},canManage)).join("");
 const proRows=(data.professionalHours||[]).map(h=>{
  const p=professionals.find(x=>x.id===h.professional_id);
  return record(esc(p?.name||"Profissional")+' · '+DAYS[h.weekday],time(h.starts_at)+' às '+time(h.ends_at),'professional_working_hours',h.id,{weekday:h.weekday,start:h.starts_at,end:h.ends_at,scope:h.professional_id},canManage);
 }).join("");
 const closureRows=(data.closures||[]).map(x=>record('Fechamento · '+esc(x.reason),esc(new Date(x.starts_at).toLocaleString("pt-BR"))+' até '+esc(new Date(x.ends_at).toLocaleString("pt-BR")),'branch_closures',x.id,null,canManage)).join("");
 const timeOffRows=(data.timeOff||[]).map(x=>{
  const p=professionals.find(y=>y.id===x.professional_id);
  return record('Afastamento · '+esc(p?.name||"Profissional"),esc(x.reason||"Sem motivo informado")+' · '+esc(new Date(x.starts_at).toLocaleString("pt-BR"))+' até '+esc(new Date(x.ends_at).toLocaleString("pt-BR")),'professional_time_off',x.id,null,canManage);
 }).join("");
 return '<section class="surface settings-panel" style="margin-top:18px">'+
  '<div class="section-heading"><div><h2>Expediente e disponibilidade</h2><p>Todos os agendamentos exigem expediente da unidade e do profissional. Cadastre dois intervalos para incluir almoço ou pausa.</p></div></div>'+
  (canManage?'<div class="availability-grid">'+
   '<form id="branch-hours-form" class="availability-form"><h3>Expediente da unidade</h3><input type="hidden" name="entry_id"><input type="hidden" name="entry_scope"><button type="button" class="btn secondary" data-cancel-hours-edit hidden>Cancelar edição</button>'+
    '<label>Dia<select name="weekday" required>'+DAYS.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join("")+'</select></label>'+
    '<label>Abre às<input name="opens_at" type="time" required></label><label>Fecha às<input name="closes_at" type="time" required></label>'+
    '<button class="btn primary" type="submit">Adicionar horário</button></form>'+
   '<form id="professional-hours-form" class="availability-form"><h3>Expediente do profissional</h3><input type="hidden" name="entry_id"><input type="hidden" name="entry_scope"><button type="button" class="btn secondary" data-cancel-hours-edit hidden>Cancelar edição</button>'+
    '<label>Profissional<select name="professional_id" required><option value="">Selecione</option>'+professionalOptions+'</select></label>'+
    '<label>Dia<select name="weekday" required>'+DAYS.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join("")+'</select></label>'+
    '<label>Início<input name="starts_at" type="time" required></label><label>Fim<input name="ends_at" type="time" required></label>'+
    '<button class="btn primary" type="submit">Adicionar horário</button></form>'+
   '<form id="branch-closure-form" class="availability-form"><h3>Fechamento excepcional</h3>'+
    '<label>Início<input name="starts_at" type="datetime-local" required></label><label>Fim<input name="ends_at" type="datetime-local" required></label>'+
    '<label class="sp-span">Motivo<input name="reason" maxlength="180" required></label><button class="btn secondary" type="submit">Registrar fechamento</button></form>'+
   '<form id="professional-timeoff-form" class="availability-form"><h3>Folga ou afastamento</h3>'+
    '<label>Profissional<select name="professional_id" required><option value="">Selecione</option>'+professionalOptions+'</select></label>'+
    '<label>Início<input name="starts_at" type="datetime-local" required></label><label>Fim<input name="ends_at" type="datetime-local" required></label>'+
    '<label class="sp-span">Motivo<input name="reason" maxlength="180"></label><button class="btn secondary" type="submit">Registrar afastamento</button></form></div>':'')+
  '<div class="availability-lists"><h3>Registros cadastrados</h3><div class="record-list">'+
   (branchRows||'<p class="muted">Nenhum expediente cadastrado para a unidade.</p>')+(proRows||'<p class="muted">Nenhum expediente profissional cadastrado. Cadastre o horário de cada profissional para liberar agendamentos.</p>')+closureRows+timeOffRows+
  '</div></div>'+
  (canManage?'':'<p class="muted">Seu perfil tem acesso somente para consulta.</p>')+'</section>';
}

/** Instala eventos uma única vez; cada ação recarrega a seção sem reload da página. */
const bindingContexts=new WeakMap();
/**
 * Vincula eventos dos formulários de expediente, folgas e fechamentos.
 * @param {HTMLElement} host Contêiner da página de configurações.
 * @param {object} context Organização, filial e permissões ativas.
 * @returns {void} Instala listeners delegados no contêiner.
 */
export function bindAvailabilitySettings(host,context){
 bindingContexts.set(host,context);
 if(host.dataset.availabilityBound==="true") return;
 host.dataset.availabilityBound="true";
 host.addEventListener("submit",async event=>{
  const form=event.target;
  if(!["branch-hours-form","professional-hours-form","branch-closure-form","professional-timeoff-form"].includes(form.id)) return;
  event.preventDefault();
  const current=bindingContexts.get(host);
  if(!current?.canManage) return toast("Seu perfil não pode configurar a disponibilidade.");
  const values=new FormData(form), get=key=>String(values.get(key)||"").trim();
  const button=form.querySelector('[type="submit"]'); button.disabled=true;
  try{
   if(form.id==="branch-hours-form"){const input={weekday:Number(get("weekday")),opensAt:get("opens_at"),closesAt:get("closes_at")};if(get("entry_id"))await updateWeeklyAvailability("branch_business_hours",get("entry_id"),current.orgId,input,current.branchId);else await addBranchBusinessHours(current.orgId,current.branchId,input);}
   if(form.id==="professional-hours-form"){const input={weekday:Number(get("weekday")),startsAt:get("starts_at"),endsAt:get("ends_at")};if(get("entry_id"))await updateWeeklyAvailability("professional_working_hours",get("entry_id"),current.orgId,input,get("entry_scope"));else await addProfessionalWorkingHours(current.orgId,get("professional_id"),input);}
   if(form.id==="branch-closure-form") await addBranchClosure(current.orgId,current.branchId,{startsAt:get("starts_at"),endsAt:get("ends_at"),reason:get("reason")});
   if(form.id==="professional-timeoff-form") await addProfessionalTimeOff(current.orgId,get("professional_id"),{startsAt:get("starts_at"),endsAt:get("ends_at"),reason:get("reason")});
   toast("Disponibilidade atualizada."); await current.reload();
  }catch(error){reportError(error,{context:"Configurações > expediente e disponibilidade"});}
  finally{if(button.isConnected) button.disabled=false;}
 });
 host.addEventListener("click",async event=>{
  const edit=event.target.closest("[data-edit-hours]"),cancel=event.target.closest("[data-cancel-hours-edit]");
  if(edit||cancel){
   if(!bindingContexts.get(host)?.canManage)return;
   if(cancel){const f=cancel.closest("form");f.reset();f.elements.entry_id.value="";f.elements.entry_scope.value="";if(f.elements.professional_id)f.elements.professional_id.disabled=false;f.querySelector("[type=submit]").textContent="Adicionar horário";cancel.hidden=true;return;}
   const d=edit.dataset,pro=d.editHours==="professional_working_hours",f=host.querySelector(pro?"#professional-hours-form":"#branch-hours-form");if(!f)return;
   f.elements.entry_id.value=d.id;f.elements.entry_scope.value=d.scope;f.elements.weekday.value=d.weekday;f.elements[pro?"starts_at":"opens_at"].value=d.start;f.elements[pro?"ends_at":"closes_at"].value=d.end;
   if(pro){f.elements.professional_id.value=d.scope;f.elements.professional_id.disabled=true;}
   f.querySelector("[type=submit]").textContent="Salvar alteração";f.querySelector("[data-cancel-hours-edit]").hidden=false;f.scrollIntoView({block:"center",behavior:"smooth"});f.elements.weekday.focus();return;
  }
  const button=event.target.closest("[data-delete-availability]"); if(!button) return;
  const current=bindingContexts.get(host);
  if(!current?.canManage) return toast("Seu perfil não pode excluir horários.");
  if(!window.confirm("Deseja excluir este registro de disponibilidade?")) return;
  button.disabled=true;
  try{await removeAvailabilityEntry(button.dataset.deleteAvailability,button.dataset.id,current.orgId);toast("Registro excluído.");await current.reload();}
  catch(error){reportError(error,{context:"Configurações > excluir disponibilidade"});button.disabled=false;}
 });
}
