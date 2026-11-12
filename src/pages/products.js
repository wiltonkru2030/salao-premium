import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function productsPage(){
 return head("Produtos e estoque","Cadastre produtos e acompanhe preço e quantidade disponível.")+
 '<div id="products-manager"><div class="empty-state">Carregando produtos…</div></div>';
}
export async function loadProductsPage(){
 const host=document.querySelector("#products-manager");if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("products").select("id,name,sku,category,cost_price,sale_price,stock_quantity,min_stock,active").eq("org_id",state.organization.id).order("name").limit(500);
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os produtos.</div>';return;}
 host.innerHTML=`
 <details class="settings-card" open><summary><b>＋ Novo produto</b></summary>
 <form id="product-create-form" class="settings-form">
  <label>Nome do produto<input class="field" name="name" required maxlength="120"></label>
  <label>SKU / Código<input class="field" name="sku"></label>
  <label>Categoria<input class="field" name="category"></label>
  <label>Custo (R$)<input class="field" name="cost_price" type="number" min="0" step="0.01" value="0"></label>
  <label>Preço de venda (R$)<input class="field" name="sale_price" type="number" min="0" step="0.01" value="0"></label>
  <label>Estoque inicial<input class="field" name="stock_quantity" type="number" min="0" step="0.001" value="0"></label>
  <label>Estoque mínimo<input class="field" name="min_stock" type="number" min="0" step="0.001" value="0"></label>
  <button class="btn primary" type="submit">Cadastrar produto</button>
 </form></details>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} produtos</span></div>
 <div class="record-list">${(data||[]).map(p=>`<article class="record-card"><span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.sku||"Sem SKU")} · ${esc(p.category||"Sem categoria")}</small><small>Estoque: ${Number(p.stock_quantity)} · Mínimo: ${Number(p.min_stock)}</small></span><span class="record-trailing"><b>${money(p.sale_price)}</b><small>${p.active?"Ativo":"Inativo"}</small></span></article>`).join("")||'<div class="empty-state">Nenhum produto cadastrado.</div>'}</div>`;
 if(host.dataset.bound==="true")return;host.dataset.bound="true";
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#product-create-form"))return;event.preventDefault();
  const v=new FormData(event.target),name=String(v.get("name")||"").trim(),cost=Number(v.get("cost_price")||0),price=Number(v.get("sale_price")||0),stock=Number(v.get("stock_quantity")||0),min=Number(v.get("min_stock")||0);
  if(!name||![cost,price,stock,min].every(Number.isFinite)||[cost,price,stock,min].some(n=>n<0)){toast("Confira os dados e os valores do produto.");return;}
  const {error}=await supabase.from("products").insert({org_id:state.organization.id,name,sku:String(v.get("sku")||"").trim()||null,category:String(v.get("category")||"").trim()||null,cost_price:cost,sale_price:price,stock_quantity:stock,min_stock:min,active:true});
  if(error){toast("Não foi possível cadastrar o produto: "+error.message);return;}
  toast("Produto cadastrado.");await loadProductsPage();
 });
}
