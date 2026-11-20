/**
 * Serviço de configuração de expediente, folgas e fechamentos.
 * Todas as operações usam sessão do Supabase; RLS limita gravações a owner/admin.
 */
import { supabase } from "../../supabase/client.js";
import { requireUuid, validateWeeklyInterval, validateDateRange } from "./availability.utils.js";

async function requireManager(){
 const {data,error}=await supabase.auth.getUser();
 if(error||!data?.user) throw new Error("Entre na sua conta para configurar a disponibilidade.");
 return data.user;
}
async function unwrap(query){
 const {data,error}=await query;
 if(error) throw error;
 return data;
}
export async function listAvailabilitySettings(orgId,branchId){
 await requireManager();
 const org=requireUuid(orgId,"Organização"), branch=requireUuid(branchId,"Unidade");
 const [branchHours,professionals,closures]=await Promise.all([
  unwrap(supabase.from("branch_business_hours").select("*").eq("org_id",org).eq("branch_id",branch).order("weekday").order("opens_at")),
  unwrap(supabase.from("professionals").select("id,name,branch_id,active").eq("org_id",org).eq("active",true).or(`branch_id.eq.${branch},branch_id.is.null`).order("name")),
  unwrap(supabase.from("branch_closures").select("*").eq("org_id",org).eq("branch_id",branch).order("starts_at").limit(100))
 ]);
 const professionalIds=(professionals||[]).map(p=>p.id);
 let professionalHours=[],timeOff=[];
 if(professionalIds.length){
  [professionalHours,timeOff]=await Promise.all([
   unwrap(supabase.from("professional_working_hours").select("*").eq("org_id",org).in("professional_id",professionalIds).order("weekday").order("starts_at")),
   unwrap(supabase.from("professional_time_off").select("*").eq("org_id",org).in("professional_id",professionalIds).order("starts_at").limit(200))
  ]);
 }
 return {branchHours:branchHours||[],professionals:professionals||[],professionalHours:professionalHours||[],closures:closures||[],timeOff:timeOff||[]};
}
export async function addBranchBusinessHours(orgId,branchId,input){
 await requireManager();
 const row=validateWeeklyInterval(input);
 return unwrap(supabase.from("branch_business_hours").insert({org_id:requireUuid(orgId,"Organização"),branch_id:requireUuid(branchId,"Unidade"),...row}).select("*").single());
}
export async function addProfessionalWorkingHours(orgId,professionalId,input){
 await requireManager();
 const row=validateWeeklyInterval(input,{professional:true});
 return unwrap(supabase.from("professional_working_hours").insert({org_id:requireUuid(orgId,"Organização"),professional_id:requireUuid(professionalId,"Profissional"),...row}).select("*").single());
}
export async function addBranchClosure(orgId,branchId,input){
 await requireManager();
 const range=validateDateRange(input),reason=String(input.reason||"").trim();
 if(!reason) throw new TypeError("Informe o motivo do fechamento.");
 return unwrap(supabase.from("branch_closures").insert({org_id:requireUuid(orgId,"Organização"),branch_id:requireUuid(branchId,"Unidade"),...range,reason,created_by:(await supabase.auth.getUser()).data.user.id}).select("*").single());
}
export async function addProfessionalTimeOff(orgId,professionalId,input){
 await requireManager();
 const range=validateDateRange(input),reason=String(input.reason||"").trim()||null;
 return unwrap(supabase.from("professional_time_off").insert({org_id:requireUuid(orgId,"Organização"),professional_id:requireUuid(professionalId,"Profissional"),...range,reason,created_by:(await supabase.auth.getUser()).data.user.id}).select("*").single());
}
export async function removeAvailabilityEntry(table,id,orgId){
 await requireManager();
 const allowed=new Set(["branch_business_hours","professional_working_hours","branch_closures","professional_time_off"]);
 if(!allowed.has(table)) throw new TypeError("Tipo de disponibilidade inválido.");
 const {data,error}=await supabase.from(table).delete().eq("id",requireUuid(id,"Registro")).eq("org_id",requireUuid(orgId,"Organização")).select("id").maybeSingle();
 if(error) throw error;
 if(!data) throw new Error("Registro não encontrado ou sem permissão para excluir.");
 return true;
}
