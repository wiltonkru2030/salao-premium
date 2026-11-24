/**
 * Testes de integração unitária do repositório Supabase da Agenda.
 * Responsabilidade: validar escopo por organização, CRUD e conflitos com cliente simulado.
 * O mock existe somente no teste; a aplicação não utiliza dados em memória.
 */
import assert from "node:assert/strict";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  changeAppointmentStatus,
  previewMoveAppointment
} from "../services/agenda.service.js";

/** Converte a hora civil do cenário em timestamp no mesmo fuso usado pela Agenda. */
function appointmentTimestamp(time) {
  return new Date("2027-02-10T" + time + ":00").toISOString();
}

const orgId = "org-test";
const professionalId = "professional-test";
const existing = {
  id: "appointment-existing",
  org_id: orgId,
  customer_id: "customer-1",
  professional_id: professionalId,
  service_id: "service-1",
  customer_name: "Cliente A",
  customer_phone: null,
  service_name: "Corte",
  professional_name: "Ana",
  starts_at: appointmentTimestamp("09:00"),
  ends_at: appointmentTimestamp("10:00"),
  price: 100,
  notes: null,
  status: "scheduled",
  booking_source: "salon"
};

/** Cria cliente Supabase simulado com filtro, paginação e operações de gravação. */
function createMockClient(initialRows=[]) {
  const rows = initialRows.map(row=>({...row}));
  let nextId = 1;
  function matches(row,filters) {
    return filters.every(filter=>{
      if(filter.op==="eq")return row[filter.column]===filter.value;
      if(filter.op==="gte")return row[filter.column]>=filter.value;
      if(filter.op==="lt")return row[filter.column]<filter.value;
      return true;
    });
  }
  return {
    rows,
    from(table) {
      assert.equal(table,"appointments");
      let action="select", payload=null, filters=[], range=null, sort=null;
      const query={
        select(){return this;},
        eq(column,value){filters.push({op:"eq",column,value});return this;},
        gte(column,value){filters.push({op:"gte",column,value});return this;},
        lt(column,value){filters.push({op:"lt",column,value});return this;},
        order(column,options){sort={column,ascending:options?.ascending!==false};return this;},
        range(start,end){range=[start,end];return this;},
        insert(value){action="insert";payload=value;return this;},
        update(value){action="update";payload=value;return this;},
        execute(){
          if(action==="insert"){
            const record={id:"appointment-created-"+nextId++,...payload};
            rows.push(record);
            return {data:record,error:null};
          }
          const selected=rows.filter(row=>matches(row,filters));
          if(action==="update"){
            selected.forEach(row=>Object.assign(row,payload));
            return {data:selected,error:null};
          }
          let result=[...selected];
          if(sort)result.sort((a,b)=>sort.ascending
            ? String(a[sort.column]).localeCompare(String(b[sort.column]))
            : String(b[sort.column]).localeCompare(String(a[sort.column])));
          if(range)result=result.slice(range[0],range[1]+1);
          return {data:result,error:null};
        },
        maybeSingle(){
          const result=this.execute();
          return Promise.resolve({data:result.data?.[0]||null,error:result.error});
        },
        single(){
          const result=this.execute();
          return Promise.resolve({data:Array.isArray(result.data)?result.data[0]:result.data,error:result.error});
        },
        then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject);}
      };
      return query;
    }
  };
}

/** Executa cenários do repositório e retorna o resultado para o executor da Agenda. */
export async function runAgendaServiceChecks() {
  const client=createMockClient([existing]);
  const context={client,orgId};
  const checks=[];
  const listed=await listAppointments({...context,date:"2027-02-10",professionalId});
  checks.push(["lista dados persistidos com filtro de tenant",listed.length===1&&listed[0].id===existing.id]);
  const found=await getAppointment(existing.id,context);
  checks.push(["busca agendamento por UUID dentro da organização",found?.customer_name==="Cliente A"]);

  const base={
    customer_id:"customer-2",professional_id:professionalId,service_id:"service-1",
    customer_name:"Cliente B",service_name:"Escova",professional_name:"Ana",
    starts_at:appointmentTimestamp("10:00"),ends_at:appointmentTimestamp("11:00"),
    price:120,status:"scheduled"
  };
  const created=await createAppointment(base,context);
  assert.equal(created.ok, true, created.errors?.join(" "));
  checks.push(["cria agendamento no repositório Supabase",created.ok&&client.rows.length===2]);
  const duplicate=await createAppointment({...base,starts_at:appointmentTimestamp("09:30"),ends_at:appointmentTimestamp("10:30"),customer_name:"Cliente C"},context);
  checks.push(["rejeita conflito do mesmo profissional",!duplicate.ok&&client.rows.length===2]);

  const moved=await updateAppointment(created.appointment.id,{
    starts_at:appointmentTimestamp("11:00"),ends_at:appointmentTimestamp("12:00")
  },context);
  checks.push(["atualiza horário persistido sem conflito",moved.ok&&moved.appointment.starts_at===appointmentTimestamp("11:00")]);

  const preview=await previewMoveAppointment(created.appointment.id,{
    starts_at:appointmentTimestamp("09:30"),ends_at:appointmentTimestamp("10:30")
  },context);
  checks.push(["prévia de reagendamento detecta conflito",!preview.ok]);

  const status=await changeAppointmentStatus(created.appointment.id,"confirmed",context);
  checks.push(["atualiza status no banco",status.ok&&status.appointment.status==="confirmed"]);

  const otherTenant=await listAppointments({client,orgId:"other-org"});
  checks.push(["escopa consulta por org_id",otherTenant.length===0]);

  return {passed:checks.filter(item=>item[1]).length,total:checks.length,checks};
}
