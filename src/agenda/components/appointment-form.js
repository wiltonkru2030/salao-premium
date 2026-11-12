import { esc } from '../../utils.js';
import { mountAutocomplete } from '../../components/autocomplete.js';
import { supabase } from '../../supabase/client.js';
import { state } from '../../state.js';

let cleanups=[];
function clearAppointmentAutocomplete(){cleanups.forEach(fn=>fn());cleanups=[];}

export function renderAppointmentForm({appointment=null,date='',time='',pro=null}={}) {
  const a=appointment||{};
  const selectedDate=a.date||date;
  const selectedTime=a.time||time||'09:00';
  const professionalId=a.professional_id||pro||'';
  const selectedProfessionalName=a.professionalName||(state.agendaProfessionals||[]).find(item=>item[3]===professionalId)?.[1]||'';
  return '<form class="agenda-form" data-agenda-form>'+
    '<label class="form-field"><span>Cliente</span><input id="appointment-customer-search" value="'+esc(a.name||'')+'" placeholder="Digite para buscar o cliente" autocomplete="off" required></label>'+
    '<input type="hidden" name="customer_id" value="'+esc(a.customer_id||'')+'">'+
    '<label class="form-field"><span>Telefone</span><input name="phone" type="tel" value="'+esc(a.phone||'')+'" placeholder="(00) 00000-0000"></label>'+
    '<label class="form-field"><span>Serviço</span><input id="appointment-service-search" value="'+esc(a.service||'')+'" placeholder="Digite para buscar o serviço" autocomplete="off" required></label>'+
    '<input type="hidden" name="service_id" value="'+esc(a.service_id||'')+'">'+
    '<label class="form-field"><span>Profissional</span><input id="appointment-professional-search" value="'+esc(selectedProfessionalName)+'" placeholder="Digite para buscar o profissional" autocomplete="off" required></label>'+
    '<input type="hidden" name="professional_id" value="'+esc(professionalId)+'">'+
    '<div class="agenda-form-row"><label class="form-field"><span>Data</span><input name="date" type="date" value="'+esc(selectedDate)+'" required></label><label class="form-field"><span>Horário</span><input name="time" type="time" step="300" value="'+esc(selectedTime)+'" required></label></div>'+
    '<div class="agenda-form-row"><label class="form-field"><span>Duração (minutos)</span><input name="duration" type="number" min="5" max="720" step="5" value="'+esc(a.duration||60)+'" required></label><label class="form-field"><span>Valor previsto (R$)</span><input name="price" type="number" min="0" step="0.01" value="'+esc(a.price??'')+'" placeholder="0,00" required></label></div>'+
    '<label class="form-field"><span>Observações</span><textarea name="notes" rows="2" placeholder="Informações adicionais">'+esc(a.notes||'')+'</textarea></label>'+
    '<button class="btn primary full-width" type="submit">'+(a.id?'Salvar reagendamento':'Criar agendamento')+'</button>'+
    '<p class="demo-note">A comanda não é aberta no agendamento. Ela será criada quando o cliente chegar e o atendimento for iniciado.</p></form>';
}

export function mountAppointmentForm(){
  clearAppointmentAutocomplete();
  const form=document.querySelector('[data-agenda-form]');
  if(!form||!state.organization?.id)return;
  const customerInput=form.querySelector('#appointment-customer-search');
  const serviceInput=form.querySelector('#appointment-service-search');
  const professionalInput=form.querySelector('#appointment-professional-search');
  const customerId=form.querySelector('[name="customer_id"]');
  const serviceId=form.querySelector('[name="service_id"]');
  const professionalId=form.querySelector('[name="professional_id"]');
  const phone=form.querySelector('[name="phone"]');
  const duration=form.querySelector('[name="duration"]');
  const price=form.querySelector('[name="price"]');
  const orgId=state.organization.id;\n  let selectedServiceId=serviceId.value||null;

  cleanups.push(mountAutocomplete(customerInput,{
    search:async term=>{
      const {data,error}=await supabase.from('customers').select('id,name,phone')
        .eq('org_id',orgId).eq('active',true).ilike('name','%'+term+'%').order('name').limit(8);
      if(error)throw error;return data||[];
    },
    getLabel:item=>item.name,
    onSelect:item=>{customerId.value=item?.id||'';if(item?.phone)phone.value=item.phone;}
  }));
  cleanups.push(mountAutocomplete(serviceInput,{
    search:async term=>{
      const {data,error}=await supabase.from('services').select('id,name,price,duration_minutes,category')
        .eq('org_id',orgId).eq('active',true).ilike('name','%'+term+'%').order('name').limit(8);
      if(error)throw error;return data||[];
    },
    getLabel:item=>item.name+' · '+Number(item.duration_minutes)+' min · '+Number(item.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
    onSelect:item=>{selectedServiceId=item?.id||null;serviceId.value=selectedServiceId||'';professionalId.value='';professionalInput.value='';if(item){duration.value=String(item.duration_minutes);price.value=Number(item.price||0).toFixed(2);}}
  }));
  cleanups.push(mountAutocomplete(professionalInput,{
    search:async term=>{
      const {data,error}=await supabase.from('professionals').select('id,name')
        .eq('org_id',orgId).eq('active',true).ilike('name','%'+term+'%').order('name').limit(8);
      if(error)throw error;return data||[];
    },
    getLabel:item=>item.name,
    onSelect:item=>{professionalId.value=item?.id||'';}
  }));
}
export function unmountAppointmentForm(){clearAppointmentAutocomplete();}
