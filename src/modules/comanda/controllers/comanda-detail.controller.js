/**
 * Controlador dos formulários de detalhes da Comanda.
 * Recebe dependências e permissões da página; não compõe HTML.
 */
import {calculateComandaItemTotal} from "../comanda-money.js";
import {mountAutocomplete} from "../../../components/autocomplete.js";
import {currency} from "../comanda.formatters.js";
import {parseBRL} from "../../../utils/input-masks.js";
import {registerComandaPayment} from "../services/comanda-operations.js";
/**
 * Vincula eventos de itens e pagamentos ao detalhe atual.
 * @param {object} options Dependências, permissões e contexto do detalhe.
 * @returns {Array<Function>} Funções para limpar autocompletes.
 */
export function bindComandaDetails({host,order,orgId,supabase,tenant,toast,reportError,refresh,isCurrent,editable,allowEdit,allowPay,canEditItems,canAddOwnService,isProfessional,professionals}){
 let selectedService=null,selectedProduct=null;
 const cleanup=[];
 /** Impede gravações de uma tela ou sessão que não está mais ativa. */
 function requireCurrent(){if(!isCurrent())throw new Error("A comanda não está mais ativa nesta tela.");}
 if(editable&&(allowEdit||canAddOwnService)){
  selectedService=null;selectedProduct=null;
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-service"),{
   search:async term=>{const {data,error}=await supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).ilike("name","%"+term+
"%").order("name").limit(8);if(error)throw error;return data||[];},
   getLabel:item=>item.name+
" · "+currency(item.price)+
" · "+Number(item.duration_minutes)+
" min",
   onSelect:item=>selectedService=item
  }));
  if(allowEdit)cleanup.push(mountAutocomplete(host.querySelector("#comanda-product"),{
   search:async term=>{const {data,error}=await supabase.from("products").select("id,name,sale_price,stock_quantity").eq("org_id",orgId).eq("active",true).gt("stock_quantity",0).ilike("name","%"+term+
"%").order("name").limit(8);if(error)throw error;return data||[];},
   getLabel:item=>item.name+
" · "+currency(item.sale_price)+
" · Estoque: "+Number(item.stock_quantity||0),
   onSelect:item=>selectedProduct=item
  }));
 }

 if(canEditItems){
  host.querySelectorAll("[data-edit-comanda-item]").forEach(form=>form.addEventListener("submit",async e=>{
   e.preventDefault();const submit=form.querySelector('[type="submit"]');if(!submit||submit.disabled)return;
   const values=new FormData(form),quantity=Number(values.get("quantity")),unitPrice=Number(values.get("unit_price")),discount=Number(values.get("discount")),professionalId=String(values.get("professional_id")||"");
   let total;
   try{total=calculateComandaItemTotal(quantity,unitPrice,discount);}catch(error){toast(error.message);return;}
   submit.disabled=true;submit.textContent="Salvando…";
   try{
    requireCurrent();
    const {error}=await supabase.from("service_order_items").update({quantity,unit_price:unitPrice,discount,total,professional_id:professionalId||null}).eq("org_id",orgId).eq("order_id",order.id).eq("id",form.dataset.editComandaItem);
    if(error)throw error;toast("Item atualizado e total da comanda recalculado.");await refresh();
   }catch(error){reportError(error,{context:"Comanda > editar item"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Salvar alterações";}}
  }));
  host.querySelectorAll("[data-delete-comanda-item]").forEach(button=>button.addEventListener("click",async()=>{
   if(button.disabled)return;
   if(!window.confirm("Excluir este item da comanda? O total será recalculado."))return;
   button.disabled=true;
   try{
    requireCurrent();
    const {error}=await supabase.from("service_order_items").delete().eq("org_id",orgId).eq("order_id",order.id).eq("id",button.dataset.deleteComandaItem);
    if(error)throw error;toast("Item removido e total recalculado.");await refresh();
   }catch(error){reportError(error,{context:"Comanda > excluir item"});button.disabled=false;}
  }));
 }
 if(editable&&(allowEdit||canAddOwnService)){
  host.querySelector("#comanda-service-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');if(!submit||submit.disabled)return;
   if(!selectedService){toast("Selecione um serviço na lista.");return;}
   if(!form.reportValidity())return;
   submit.disabled=true;submit.textContent="Adicionando…";
   try{
    requireCurrent();
    const {user}=await tenant(),professionalId=isProfessional?order.assigned_professional_id:String(new FormData(form).get("professional_id")||""),price=Number(selectedService.price||0);
    requireCurrent();
    if(isProfessional&&professionalId!==professionals.find(item=>item.id===professionalId)?.id)throw new Error("Você só pode lançar serviços no seu próprio atendimento.");

    const {error}=await supabase.from("service_order_items").insert({org_id:orgId,order_id:order.id,item_type:"service",service_id:selectedService.id,professional_id:professionalId||null,description:selectedService.name,quantity:1,unit_price:price,total:calculateComandaItemTotal(1,price),created_by:user.id});
    if(error)throw error;
    toast("Serviço adicionado.");await refresh();
   }catch(error){reportError(error,{context:"Comanda > adicionar serviço"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Adicionar serviço";}}
  });
  if(allowEdit)host.querySelector("#comanda-product-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');if(!submit||submit.disabled)return;
   if(!selectedProduct){toast("Selecione um produto na lista.");return;}
   if(!form.reportValidity())return;
   const values=new FormData(form),quantity=Number(values.get("quantity")||1),price=Number(selectedProduct.sale_price||0),professionalId=String(values.get("professional_id")||"");
   if(!Number.isFinite(quantity)||quantity<=0||quantity>Number(selectedProduct.stock_quantity||0)){toast("Quantidade inválida ou maior que o estoque.");return;}
   submit.disabled=true;submit.textContent="Adicionando…";
   try{
    requireCurrent();
    const {user}=await tenant();requireCurrent();
    const {error}=await supabase.from("service_order_items").insert({org_id:orgId,order_id:order.id,item_type:"product",product_id:selectedProduct.id,professional_id:professionalId||null,description:selectedProduct.name,quantity,unit_price:price,total:calculateComandaItemTotal(quantity,price),created_by:user.id});
    if(error)throw error;
    toast("Produto adicionado.");await refresh();
   }catch(error){reportError(error,{context:"Comanda > adicionar produto"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Adicionar produto";}}
  });
 }
 if(editable&&allowPay){
  host.querySelector("#comanda-payment-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');if(!submit||submit.disabled)return;
   if(!form.reportValidity())return;
   const v=new FormData(form),amount=parseBRL(v.get("amount")),method=String(v.get("payment_method"));
   if(!Number.isFinite(amount)||amount<=0){toast("Informe um valor válido.");return;}
   submit.disabled=true;submit.textContent="Registrando…";
   try{
    requireCurrent();
    const {data,error}=await registerComandaPayment({supabase,orderId:order.id,amount,paymentMethod:method});
    if(error)throw error;
    toast(data?.closed?"Comanda quitada e finalizada. Estoque, caixa e comissões atualizados.":"Pagamento parcial registrado.");
    await refresh();
   }catch(error){reportError(error,{context:"Comanda > registrar pagamento"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Registrar pagamento";}}
  });
 }
 return cleanup;
}
