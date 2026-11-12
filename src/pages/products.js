import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function productsPage(){
 return head("Produtos e estoque","Cadastre produtos e acompanhe preço e quantidade disponível.",btn("＋ Novo produto","open-product-modal","primary"))+
 '<div id="products-manager"><div class="empty-state">Carregando produtos…</div></div>';
}
export async function loadProductsPage(){
 const host=document.querySelector("#products-manager");if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("products").select("id,name,sku,category,cost_price,sale_price,stock_quantity,min_stock,active").eq("org_id",state.organization.id).order("name").limit(500);
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os produtos.</div>';return;}
 host.innerHTML=`
 <dialog class="sp-modal" id="product-create-modal" aria-labelledby="product-modal-title"><div class="sp-modal-shell">
  <header class="sp-modal-head"><div><h2 id="product-modal-title">Novo produto</h2><p>Cadastre o produto e defina os valores e o estoque inicial.</p></div><button class="sp-modal-close" type="button" data-close-product-modal aria-label="Fechar">×</button></header>
  <form id="product-create-form"><div class="sp-modal-body">
   <label class="sp-span">Nome do produto<input name="name" required maxlength="120" placeholder="Nome do produto"></label>
   <label>SKU / Código<input name="sku" placeholder="Código interno"></label><label>Categoria<input name="category" placeholder="Ex.: Cuidados capilares"></label>
   <label>Custo (R$)<input name="cost_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
   <label>Preço de venda (R$)<input name="sale_price" type="text" inputmode="decimal" data-mask="currency" value="0,00"></label>
   <label>Estoque inicial<input name="stock_quantity" type="number" min="0" step="0.001" value="0"></label>
   <label>Estoque mínimo<input name="min_stock" type="number" min="0" step="0.001" value="0"></label>
  </div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-product-modal>Cancelar</button><button class="btn primary" type="submit">Cadastrar produto</button></footer></form>
 </div></dialog>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} produtos</span></div>
 <div class="record-list">${(data||[]).map(p=>`<article class="record-card"><span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.sku||"Sem SKU")} · ${esc(p.category||"Sem categoria")}</small><small>Estoque: ${Number(p.stock_quantity)} · Mínimo: ${Number(p.min_stock)}</small></span><span class="record-trailing"><b>${money(p.sale_price)}</b><small>${p.active?"Ativo":"Inativo"}</small></span></article>`).join("")||'<div class="empty-state">Nenhum produto cadastrado.</div>'}</div>`;
 if(host.dataset.bound==="true")return;host.dataset.bound="true";
 host.addEventListener("click",event=>{
  if(event.target.closest('[data-action="open-product-modal"]'))host.querySelector("#product-create-modal")?.showModal();
  if(event.target.closest("[data-close-product-modal]"))host.querySelector("#product-create-modal")?.close();
 });
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#product-create-form"))return;event.preventDefault();
  const form=event.target,v=new FormData(form),name=String(v.get("name")||"").trim(),cost=parseBRL(v.get("cost_price")),price=parseBRL(v.get("sale_price")),stock=Number(v.get("stock_quantity")||0),min=Number(v.get("min_stock")||0),submit=form.querySelector('[type="submit"]');
  if(!name||![cost,price,stock,min].every(Number.isFinite)||[cost,price,stock,min].some(n=>n<0)){toast("Confira os dados e os valores do produto.");return;}
  submit.disabled=true;
  const {error}=await supabase.from("products").insert({org_id:state.organization.id,name,sku:String(v.get("sku")||"").trim()||null,category:String(v.get("category")||"").trim()||null,cost_price:cost,sale_price:price,stock_quantity:stock,min_stock:min,active:true});
  submit.disabled=false;
  if(error){toast("Não foi possível cadastrar o produto: "+error.message);return;}
  host.querySelector("#product-create-modal")?.close();toast("Produto cadastrado.");await loadProductsPage();
 });
}
