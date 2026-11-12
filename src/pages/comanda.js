import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { mountAutocomplete } from "../components/autocomplete.js";

let cleanup = [];
let selectedOrder = null;
let selectedCustomer = null;
let selectedProfessional = null;
let selectedService = null;\nlet selectedProduct = null;
const currency = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function comandaPage() {
  selectedOrder = null;
  return head("Comanda","Abertura e acompanhamento de comandas, serviços e profissionais.") +
    '<div id="comanda-manager"><div class="empty-state"><b>Carregando comandas…</b></div></div>';
}
async function tenant() {
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError)throw userError;
  if(!user||!state.organization?.id)throw new Error("Entre no sistema para acessar as comandas.");
  return {user,orgId:state.organization.id};
}
function clearAutocomplete(){cleanup.forEach(fn=>fn());cleanup=[];}
function renderCreateForm(host, customers, professionals) {
  host.innerHTML = `
    <section class="settings-card">
      <h3>Nova comanda</h3>
      <form id="comanda-create-form" class="settings-form">
        <label>Cliente<input id="comanda-customer" class="field" placeholder="Digite o nome do cliente" autocomplete="off" required></label>
        <label>Profissional responsável<input id="comanda-professional" class="field" placeholder="Digite o nome do profissional" autocomplete="off" required></label>
        <label>Observações<textarea name="notes" rows="2" placeholder="Observações (opcional)"></textarea></label>
        <div class="drawer-actions"><button type="button" class="btn secondary" data-action="cancel-comanda">Cancelar</button><button class="btn primary" type="submit">Abrir comanda</button></div>
      </form>
    </section>`;
  selectedCustomer=null;selectedProfessional=null;
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-customer"),{
    search: async term => customers.filter(c=>c.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name,onSelect:item=>selectedCustomer=item
  }));
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-professional"),{
    search: async term => professionals.filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name,onSelect:item=>selectedProfessional=item
  }));
  host.querySelector("#comanda-create-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!selectedCustomer||!selectedProfessional){toast("Selecione um cliente e um profissional nas sugestões.");return;}
    const {user,orgId}=await tenant();
    const {error}=await supabase.from("service_orders").insert({
      org_id:orgId,customer_id:selectedCustomer.id,assigned_professional_id:selectedProfessional.id,
      status:"open",notes:String(new FormData(event.target).get("notes")||"").trim(),
      created_by:user.id,created_by_type:"salon"
    });
    if(error){toast("Não foi possível abrir a comanda: "+error.message);return;}
    toast("Comanda aberta.");await loadComandaPage();
  });
}
async function renderOrderDetails(host, order, orgId) {
  const [{data:items,error},{data:services},{data:products}] = await Promise.all([
    supabase.from("service_order_items").select("id,item_type,description,quantity,unit_price,total,professional_id").eq("org_id",orgId).eq("order_id",order.id).order("created_at"),
    supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).order("name").limit(200),
    supabase.from("products").select("id,name,sale_price,stock_quantity").eq("org_id",orgId).eq("active",true).order("name").limit(300)
  ]);
  if(error)throw error;
  host.innerHTML = `
    <div class="list-toolbar"><button class="btn secondary" data-action="back-comandas">← Voltar</button><span class="result-count">Comanda #${esc(order.order_number)}</span></div>
    <section class="settings-card"><h3>Itens da comanda</h3>
      ${items?.length?items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+'</b><small>'+Number(i.quantity)+' × '+currency(i.unit_price)+'</small></span><b>'+currency(i.total)+'</b></div>').join(""):'<div class="empty-state">Nenhum item adicionado.</div>'}
      <div class="setting-row"><b>Total parcial</b><b>${currency(order.total)}</b></div>
    </section>
    <section class="settings-card"><h3>Adicionar serviço</h3><form id="comanda-service-form">
      <label>Serviço<input id="comanda-service" class="field" placeholder="Digite para buscar" autocomplete="off" required></label>
      <label>Profissional<select name="professional_id" class="field" required>${(await supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name")).data?.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")||""}</select></label>
      <button class="btn primary" type="submit">Adicionar serviço</button>
    </form></section>
    <section class="settings-card"><h3>Adicionar produto</h3><form id="comanda-product-form">
      <label>Produto<input id="comanda-product" class="field" placeholder="Digite para buscar" autocomplete="off" required></label>
      <label>Quantidade<input name="quantity" class="field" type="number" min="1" step="1" value="1" required></label>
      <button class="btn primary" type="submit">Adicionar produto</button>
      <p class="demo-note">O produto entra na comanda; a baixa de estoque será feita na etapa de fechamento.</p>
    </form></section>`;
  selectedService=null;selectedProduct=null;
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-service"),{
    search:async term=>(services||[]).filter(s=>s.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name+" · "+currency(item.price),onSelect:item=>selectedService=item
  }));
  host.querySelector("#comanda-service-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!selectedService){toast("Selecione um serviço na lista de sugestões.");return;}
    const {user}=await tenant(),fd=new FormData(event.target),professionalId=String(fd.get("professional_id"));
    const price=Number(selectedService.price||0);
    const {error}=await supabase.from("service_order_items").insert({
      org_id:orgId,order_id:order.id,item_type:"service",service_id:selectedService.id,
      professional_id:professionalId,description:selectedService.name,quantity:1,
      unit_price:price,total:price,created_by:user.id
    });
    if(error){toast("Não foi possível adicionar o serviço: "+error.message);return;}
    toast("Serviço adicionado.");await loadComandaPage(order.id);
  });
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-product"),{
    search:async term=>(products||[]).filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
    getLabel:item=>item.name+" · "+currency(item.sale_price)+" · Estoque: "+Number(item.stock_quantity||0),
    onSelect:item=>selectedProduct=item
  }));
  host.querySelector("#comanda-product-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!selectedProduct){toast("Selecione um produto na lista de sugestões.");return;}
    const {user}=await tenant(),quantity=Number(new FormData(event.target).get("quantity")||1),price=Number(selectedProduct.sale_price||0);
    if(!Number.isFinite(quantity)||quantity<=0){toast("Informe uma quantidade válida.");return;}
    const {error}=await supabase.from("service_order_items").insert({
      org_id:orgId,order_id:order.id,item_type:"product",product_id:selectedProduct.id,
      description:selectedProduct.name,quantity,unit_price:price,total:price*quantity,created_by:user.id
    });
    if(error){toast("Não foi possível adicionar o produto: "+error.message);return;}
    toast("Produto adicionado à comanda.");await loadComandaPage(order.id);
  });
}
export async function loadComandaPage(orderId=null) {
  const host=document.querySelector("#comanda-manager");if(!host)return;
  clearAutocomplete();
  try {
    const {user,orgId}=await tenant();
    if(orderId||selectedOrder){
      const id=orderId||selectedOrder;
      const {data:order,error}=await supabase.from("service_orders").select("id,order_number,status,total,discount,notes,customer_id,assigned_professional_id").eq("org_id",orgId).eq("id",id).maybeSingle();
      if(error)throw error;if(!order){selectedOrder=null;throw new Error("Comanda não encontrada.");}
      selectedOrder=order.id;await renderOrderDetails(host,order,orgId);return;
    }
    const {data:orders,error}=await supabase.from("service_orders").select("id,order_number,status,total,created_at,customer_id,assigned_professional_id").eq("org_id",orgId).order("created_at",{ascending:false}).limit(100);
    if(error)throw error;
    const customerIds=[...new Set((orders||[]).map(o=>o.customer_id).filter(Boolean))],professionalIds=[...new Set((orders||[]).map(o=>o.assigned_professional_id).filter(Boolean))];
    const [customerResult,professionalResult]=await Promise.all([
      customerIds.length?supabase.from("customers").select("id,name").eq("org_id",orgId).in("id",customerIds):Promise.resolve({data:[]}),
      professionalIds.length?supabase.from("professionals").select("id,name").eq("org_id",orgId).in("id",professionalIds):Promise.resolve({data:[]})
    ]);
    const customerMap=new Map((customerResult.data||[]).map(c=>[c.id,c.name])),professionalMap=new Map((professionalResult.data||[]).map(p=>[p.id,p.name]));
    host.innerHTML=`
      <div class="list-toolbar"><span class="result-count">${orders?.length||0} comandas</span><button class="btn primary" data-action="new-comanda">＋ Nova comanda</button></div>
      <div class="record-list">${(orders||[]).map(o=>'<button class="record-card" data-open-comanda="'+o.id+'"><span class="record-main"><b>Comanda #'+esc(o.order_number)+'</b><small>'+esc(customerMap.get(o.customer_id)||"Cliente não informado")+'</small><small>'+esc(professionalMap.get(o.assigned_professional_id)||"Sem profissional")+'</small></span><span class="record-trailing"><b>'+currency(o.total)+'</b><small>'+esc(o.status)+'</small></span><span class="record-chevron">›</span></button>').join("")||'<div class="empty-state">Nenhuma comanda cadastrada.</div>'}</div>`;
    if(host.dataset.bound!=="true"){host.dataset.bound="true";host.addEventListener("click",async event=>{
      const open=event.target.closest("[data-open-comanda]");if(open){selectedOrder=open.dataset.openComanda;await loadComandaPage(selectedOrder);return;}
      if(event.target.closest('[data-action="new-comanda"]')){const [c,p]=await Promise.all([
        supabase.from("customers").select("id,name").eq("org_id",orgId).eq("active",true).order("name").limit(500),
        supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name").limit(200)
      ]);renderCreateForm(host,c.data||[],p.data||[]);}
      if(event.target.closest('[data-action="back-comandas"]')){selectedOrder=null;await loadComandaPage();}
      if(event.target.closest('[data-action="cancel-comanda"]')){selectedOrder=null;await loadComandaPage();}
    });}
  } catch(error) {
    host.innerHTML='<div class="empty-state">'+esc(error.message||"Não foi possível carregar as comandas.")+'</div>';
  }
}
