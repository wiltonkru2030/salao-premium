/**
 * Consultas de detalhes da Comanda, sem estado global ou manipulação de interface.
 */
import {userErrorMessage} from "../../../utils/errors.js";
/**
 * Carrega itens, pagamentos e catálogos autorizados da organização.
 * @param {object} options Cliente, comanda, organização e permissões de leitura.
 * @returns {Promise<object>} Dados para composição dos detalhes.
 */
export async function queryComandaDetails({supabase,order,orgId,canPay,canManage}){
 if(!supabase?.from||!order?.id||!orgId)throw new TypeError("Contexto da comanda inválido.");
 const [items,payments,customer,professional,services,products,professionals]=await Promise.all([
  supabase.from("service_order_items").select("id,item_type,description,quantity,unit_price,discount,total,professional_id,created_at").eq("org_id",orgId).eq("order_id",order.id).order("created_at"),
  canPay?supabase.from("service_order_payments").select("id,amount,payment_method,status,paid_at,refunded_at,refund_cash_movement_id").eq("org_id",orgId).eq("order_id",order.id).order("paid_at"):Promise.resolve({data:[],error:null}),
  order.customer_id?supabase.from("customers").select("id,name,phone").eq("org_id",orgId).eq("id",order.customer_id).maybeSingle():Promise.resolve({data:null,error:null}),
  order.assigned_professional_id?supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("id",order.assigned_professional_id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).order("name").limit(250),
  canManage||canPay?supabase.from("products").select("id,name,sale_price,stock_quantity").eq("org_id",orgId).eq("active",true).order("name").limit(250):Promise.resolve({data:[],error:null}),
  supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name").limit(200)
 ]);
 for(const [label,result] of [["itens",items],["pagamentos",payments],["cliente",customer],["profissional",professional],["serviços",services],["produtos",products],["equipe",professionals]]) {
  if(result.error) throw new Error("Falha ao carregar "+label+
": "+userErrorMessage(result.error));
 }
 return {items:items.data||[],payments:payments.data||[],customer:customer.data,professional:professional.data,services:services.data||[],products:products.data||[],professionals:professionals.data||[]};
}
