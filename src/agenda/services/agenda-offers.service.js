/**
 * Camada de dados de Pacotes e Lista de Espera (Agenda).
 * Todas as gravações passam pelas RPCs autenticadas do Supabase.
 * A consulta de encaixes não altera reservas; somente book_appointment_from_waitlist grava o atendimento.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE=100;
const validUuid=value=>UUID.test(String(value||""));
const validDate=value=>{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const dt=new Date(value+"T00:00:00Z");
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===value;
};
/** Mapeia erros em português, sem exibir SQL ou informações privadas. */
export function mapAgendaOfferError(error){
 if(error?.code==="23505")return new Error("Essa solicitação já existe ou já foi agendada. Atualize a lista.");
 if(error?.code==="23P01")return new Error("O horário deixou de estar disponível. Busque encaixes novamente.");
 if(error?.code==="42501")return new Error("Seu perfil não pode acessar ou alterar estes dados.");
 if(["PGRST202","42883","PGRST205","42P01"].includes(error?.code))return new Error("O recurso ainda não está disponível na versão do banco.");
 if(error instanceof TypeError)return error;
 return new Error("Não foi possível concluir a operação. Confira os dados e tente novamente.");
}
function scope(client,orgId,branchId){
 if(!client?.rpc||!client?.from)throw new TypeError("Conexão com a Agenda não disponível.");
 if(!validUuid(orgId)||!validUuid(branchId))throw new TypeError("Selecione uma organização e uma unidade válidas.");
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error)throw mapAgendaOfferError(error);
 return data;
}
/** Lista registros paginados sem truncamento silencioso nem duplicações entre páginas. */
async function pages(buildQuery){
 const rows=[],seen=new Set();
 for(let offset=0;;offset+=PAGE_SIZE){
  if(offset>5000)throw new Error("Há muitos registros para exibir. Utilize filtros ou a pesquisa da organização.");
  const {data,error}=await buildQuery().range(offset,offset+PAGE_SIZE-1);
  if(error)throw mapAgendaOfferError(error);
  if(!Array.isArray(data))throw new Error("Resposta inválida do banco.");
  for(const row of data){
   if(!validUuid(row.id)||seen.has(row.id))throw new Error("Os registros mudaram. Atualize a consulta.");
   seen.add(row.id);rows.push(row);
  }
  if(data.length<PAGE_SIZE)return rows;
 }
}
/** Obtém os serviços e profissionais elegíveis à unidade; nunca mistura organizações. */
export async function loadOfferCatalog({client,orgId,branchId}){
 scope(client,orgId,branchId);
 const [services,professionals]=await Promise.all([
  pages(()=>client.from("services")
   .select("id,name,branch_id,price,duration_minutes,active").eq("org_id",orgId)
   .eq("active",true).or("branch_id.eq."+branchId+",branch_id.is.null")
   .order("name",{ascending:true}).order("id",{ascending:true})),
  pages(()=>client.from("professionals")
   .select("id,name,branch_id,active").eq("org_id",orgId)
   .eq("active",true).or("branch_id.eq."+branchId+",branch_id.is.null")
   .order("name",{ascending:true}).order("id",{ascending:true}))
 ]);
 return {services,professionals};
}
/** Busca clientes por nome; busca feita no tenant, sem carregar o cadastro inteiro. */
export async function searchOfferCustomers({client,orgId,branchId,term}){
 scope(client,orgId,branchId);
 const search=String(term||"").trim();
 if(search.length<2)return [];
 const safe=search.replace(/[%,()]/g," ").slice(0,80);
 const {data,error}=await client.from("customers").select("id,name,phone")
  .eq("org_id",orgId).eq("active",true).ilike("name","%"+safe+"%")
  .order("name",{ascending:true}).limit(12);
 if(error)throw mapAgendaOfferError(error);
 return data||[];
}
/** Lista todo o catálogo de pacotes da organização aplicável à unidade escolhida. */
export async function loadServicePackages({client,orgId,branchId}){
 scope(client,orgId,branchId);
 const packages=await pages(()=>client.from("service_packages")
  .select("id,org_id,branch_id,name,description,reference_price,active,created_at")
  .eq("org_id",orgId).or("branch_id.eq."+branchId+",branch_id.is.null")
  .order("name",{ascending:true}).order("id",{ascending:true}));
 const items=[];
 for(let i=0;i<packages.length;i+=70){
  const ids=packages.slice(i,i+70).map(row=>row.id);
  if(!ids.length)continue;
  const part=await pages(()=>client.from("service_package_items")
   .select("id,package_id,service_id,sort_order,quantity,pause_after_minutes")
   .eq("org_id",orgId).in("package_id",ids).order("package_id").order("sort_order").order("id"));
  items.push(...part);
 }
 const byId=new Map(packages.map(row=>[row.id,{...row,items:[]}]));
 for(const item of items)byId.get(item.package_id)?.items.push(item);
 return [...byId.values()];
}
/** Valida a composição de um combo antes da transação no banco. */
export function validatePackageInput({name,description="",referencePrice=null,items}={}){
 const cleanName=String(name||"").trim(),cleanDescription=String(description||"").trim();
 if(cleanName.length<2||cleanName.length>120||cleanDescription.length>1000)
  throw new TypeError("Informe nome entre 2 e 120 caracteres e descrição de até 1.000.");
 const price=referencePrice===null||referencePrice===""?null:Number(referencePrice);
 if(price!==null&&(!Number.isFinite(price)||price<0||price>9999999999.99||Number(price.toFixed(2))!==price))
  throw new TypeError("O preço de referência deve usar até duas casas decimais.");
 if(!Array.isArray(items)||items.length<1||items.length>20)
  throw new TypeError("Adicione de um a vinte serviços ao combo.");
 const normalized=items.map(item=>{
  const quantity=Number(item.quantity),pause=Number(item.pause_after_minutes);
  if(!validUuid(item.service_id)||!Number.isInteger(quantity)||quantity<1||quantity>20||
    !Number.isInteger(pause)||pause<0||pause>720)
   throw new TypeError("Confira serviço, quantidade e pausa dos itens.");
  return {service_id:item.service_id,quantity,pause_after_minutes:pause};
 });
 return {name:cleanName,description:cleanDescription||null,referencePrice:price,items:normalized};
}
/** Salva um combo transacionalmente, sem gerar vendas nem agendamentos. */
export async function saveServicePackage({client,orgId,branchId,packageId=null,...input}={}){
 scope(client,orgId,branchId);
 if(packageId!==null&&!validUuid(packageId))throw new TypeError("Pacote inválido.");
 const validated=validatePackageInput(input);
 return rpc(client,"save_service_package",{
  p_org_id:orgId,p_branch_id:branchId,p_name:validated.name,
  p_description:validated.description,p_reference_price:validated.referencePrice,
  p_items:validated.items,p_package_id:packageId
 });
}
/** Ativa ou inativa um pacote sem excluir seu histórico. */
export async function setServicePackageActive({client,orgId,branchId,packageId,active}={}){
 scope(client,orgId,branchId);
 if(!validUuid(packageId)||typeof active!=="boolean")throw new TypeError("Pacote ou situação inválidos.");
 return rpc(client,"set_service_package_active",{p_org_id:orgId,p_package_id:packageId,p_active:active});
}
/** Lista a fila completa da unidade por páginas e desempate de ID. */
export async function listAppointmentWaitlist({client,orgId,branchId}={}){
 scope(client,orgId,branchId);
 const rows=[],ids=new Set();
 for(let offset=0;;offset+=PAGE_SIZE){
  if(offset>5000)throw new Error("A lista de espera excede o limite de consulta.");
  const page=await rpc(client,"list_appointment_waitlist",{p_org_id:orgId,p_branch_id:branchId,p_offset:offset,p_limit:PAGE_SIZE});
  if(!Array.isArray(page))throw new Error("A lista de espera retornou dados inválidos.");
  for(const item of page){
   if(!validUuid(item.waitlist_id)||ids.has(item.waitlist_id))throw new Error("A lista mudou durante a consulta. Atualize.");
   ids.add(item.waitlist_id);rows.push(item);
  }
  if(page.length<PAGE_SIZE)return rows;
 }
}
/** Registra uma preferência real sem bloquear nenhum horário. */
export async function addAppointmentWaitlist({client,orgId,branchId,customerId,serviceId,professionalId=null,fromDate,untilDate,fromTime,untilTime,notes=""}={}){
 scope(client,orgId,branchId);
 if(!validUuid(customerId)||!validUuid(serviceId)||(professionalId!==null&&!validUuid(professionalId))||
    !validDate(fromDate)||!validDate(untilDate)||untilDate<fromDate||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(fromTime))||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(untilTime))||untilTime<=fromTime||
    String(notes).length>500)
  throw new TypeError("Confira o cliente, serviço, datas e intervalo de horários.");
 return rpc(client,"add_appointment_waitlist",{
  p_org_id:orgId,p_branch_id:branchId,p_customer_id:customerId,p_service_id:serviceId,
  p_professional_id:professionalId,p_preferred_from:fromDate,p_preferred_until:untilDate,
  p_time_from:fromTime,p_time_until:untilTime,p_notes:String(notes).trim()||null
 });
}
/** Atualiza o contato/cancelamento, ou vincula somente agendamento validado no servidor. */
export async function setAppointmentWaitlistStatus({client,orgId,branchId,waitlistId,status,appointmentId=null}={}){
 scope(client,orgId,branchId);
 if(!validUuid(waitlistId)||!["contacted","booked","cancelled"].includes(status)||
  (status==="booked"?!validUuid(appointmentId):appointmentId!==null))
  throw new TypeError("Selecione uma alteração válida para a lista de espera.");
 return rpc(client,"set_appointment_waitlist_status",{
  p_org_id:orgId,p_waitlist_id:waitlistId,p_status:status,p_appointment_id:appointmentId
 });
}
/** Sugere vagas disponíveis verificadas no banco, sem criar uma reserva. */
export async function findAppointmentWaitlistOpenings({client,orgId,branchId,date}={}){
 scope(client,orgId,branchId);
 if(!validDate(date))throw new TypeError("Escolha uma data válida para os encaixes.");
 return rpc(client,"find_appointment_waitlist_openings",{
  p_org_id:orgId,p_branch_id:branchId,p_date:date,p_limit:30
 });
}
/** Efetiva o encaixe no servidor, garantindo inclusão e atualização da fila na mesma transação. */
export async function bookAppointmentFromWaitlist({client,orgId,branchId,waitlistId,professionalId,startsAt}={}){
 scope(client,orgId,branchId);
 if(!validUuid(waitlistId)||!validUuid(professionalId)||!Number.isFinite(Date.parse(startsAt))||Date.parse(startsAt)<=Date.now())
  throw new TypeError("Selecione um encaixe futuro válido.");
 const result=await rpc(client,"book_appointment_from_waitlist",{
  p_org_id:orgId,p_waitlist_id:waitlistId,p_professional_id:professionalId,
  p_starts_at:new Date(startsAt).toISOString()
 });
 if(!validUuid(result))throw new Error("Não foi possível confirmar o agendamento. Atualize a Agenda.");
 return result;
}
