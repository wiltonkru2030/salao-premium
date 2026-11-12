/**
 * Módulo: máscaras e conversões de campos.
 * Responsabilidade: formatar CPF, CNPJ, telefone, CEP e moeda em campos de formulário.
 * Regra importante: campos de login por e-mail nunca devem receber máscara fiscal.
 */
const digits=value=>String(value??"").replace(/\D/g,"");
export function formatPhone(value){
 const d=digits(value).slice(0,11);
 if(d.length<=2)return d? "("+d : "";
 if(d.length<=6)return "("+d.slice(0,2)+") "+d.slice(2);
 if(d.length<=10)return "("+d.slice(0,2)+") "+d.slice(2,6)+"-"+d.slice(6);
 return "("+d.slice(0,2)+") "+d.slice(2,7)+"-"+d.slice(7);
}
export function formatCpf(value){
 const d=digits(value).slice(0,11);
 return d.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1-$2");
}
export function formatCnpj(value){
 const d=digits(value).slice(0,14);
 return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");
}
export function formatCep(value){
 const d=digits(value).slice(0,8);
 return d.length>5?d.slice(0,5)+"-"+d.slice(5):d;
}
export function formatCurrency(value){
 const d=digits(value);
 if(!d)return "0,00";
 return (Number(d)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
export function parseBRL(value){
 const raw=String(value??"").replace(/\s/g,"").replace(/R\$/gi,"");
 const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""):raw.replace(/[^\d.-]/g,"");
 const parsed=Number(normalized);
 return Number.isFinite(parsed)?parsed:0;
}
/** Detecta apenas máscaras declaradas ou campos inequivocamente identificados. */
export function detectInputMask(input){
 const declared=(input?.dataset?.mask||"").toLowerCase();
 const name=(input?.name||input?.id||"").toLowerCase();
 const hint=(input?.placeholder||"").trim();
 if(declared)return declared;
 if(/(^|[_-])cpf($|[_-])/.test(name)||hint==="000.000.000-00")return "cpf";
 if(/(^|[_-])cnpj($|[_-])/.test(name)||hint==="00.000.000/0000-00")return "cnpj";
 if(/phone|telefone|celular|whatsapp/.test(name)||/^\(00\)\s?00000-0000$/.test(hint))return "phone";
 if(/(^|[_-])cep($|[_-])/.test(name)||hint==="00000-000")return "cep";
 return "";
}
export function applyInputMask(input){
 const mask=detectInputMask(input);
 if(!mask)return;
 if(mask==="cpf")input.value=formatCpf(input.value);
 else if(mask==="cnpj")input.value=formatCnpj(input.value);
 else if(mask==="phone")input.value=formatPhone(input.value);
 else if(mask==="cep")input.value=formatCep(input.value);
 else if(mask==="currency")input.value=formatCurrency(input.value);
}
export function installGlobalMasks(){
 if(document.documentElement.dataset.globalMasks==="true")return;
 document.documentElement.dataset.globalMasks="true";
 document.addEventListener("input",event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement))return;
  const mask=detectInputMask(input);
  if(!mask)return;
  const start=input.selectionStart;
  const before=input.value;
  applyInputMask(input);
  if(start!==null&&document.activeElement===input){
   const delta=input.value.length-before.length;
   const pos=Math.max(0,Math.min(input.value.length,start+delta));
   try{input.setSelectionRange(pos,pos);}catch{}
  }
 });
 document.addEventListener("focusout",event=>{
  const input=event.target;
  if(input instanceof HTMLInputElement)applyInputMask(input);
 });
}
