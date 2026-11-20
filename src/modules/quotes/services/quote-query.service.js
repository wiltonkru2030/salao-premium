/** Consultas de catálogo e regras de orçamento, isoladas por organização e filial. */
/** Retorna os resultados do catálogo sem alterar estado ou interface. */
export async function queryQuoteWorkspace({supabase,orgId,branchId}){
 if(!supabase?.from||!orgId)throw new TypeError("Contexto do orçamento inválido.");
    let customerQuery=supabase.from("customers").select("id,name,phone")
      .eq("org_id",orgId).eq("active",true);
    let serviceQuery=supabase.from("services").select("id,name,price,duration_minutes")
      .eq("org_id",orgId).eq("active",true);
    let professionalQuery=supabase.from("professionals").select("id,name")
      .eq("org_id",orgId).eq("active",true);
    let quoteQuery=supabase.from("quotes").select("id,quote_number,customer_id,status,total,created_at,branch_id")
      .eq("org_id",orgId);
    if(branchId) {
      customerQuery=customerQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      serviceQuery=serviceQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      professionalQuery=professionalQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      quoteQuery=quoteQuery.eq("branch_id",branchId);
    }
    const [customerResult,serviceResult,professionalResult,professionalServiceResult,quoteResult,settingResult,ruleResult,discountCatalogResult]=await Promise.all([
      customerQuery.order("name").limit(1000),
      serviceQuery.order("name").limit(500),
      professionalQuery.order("name").limit(500),
      supabase.from("professional_services").select("professional_id,service_id").eq("org_id",orgId),
      quoteQuery.order("created_at",{ascending:false}).limit(100),
      supabase.from("quote_settings").select("max_discount_percent,allow_fixed_discount").eq("org_id",orgId).maybeSingle(),
      supabase.from("quote_discount_services").select("service_id").eq("org_id",orgId).eq("discount_allowed",true),
      supabase.from("services").select("id,name,branch_id").eq("org_id",orgId).eq("active",true).order("name").limit(1000)
    ]);
    for(const r of [customerResult,serviceResult,professionalResult,professionalServiceResult,quoteResult,settingResult,ruleResult,discountCatalogResult]) if(r.error) throw r.error;

 return {customerResult,serviceResult,professionalResult,professionalServiceResult,quoteResult,settingResult,ruleResult,discountCatalogResult};
}
