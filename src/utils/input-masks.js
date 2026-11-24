/**
 * Módulo: máscaras e conversões de campos.
 * Responsabilidade: formatar CPF, CNPJ, telefone, CEP e moeda em campos de formulário.
 * Regra importante: campos de login por e-mail nunca devem receber máscara fiscal.
 */

/** Mantém somente os dígitos de um valor recebido do formulário. */
const digits=value=>String(value??"").replace(/\D/g,"");
/** Formata telefone brasileiro com DDD e limite de onze dígitos. */
export function formatPhone(value){
 const raw=String(value??"").trim();
 // Um DDI informado não pode ser confundido com o DDD brasileiro.
 const all=digits(raw);
 if(raw.startsWith("+")&&!/^55\d{10,11}$/.test(all))return "+"+all;
 const d=(raw.startsWith("+")?all.slice(2):all).slice(0,11);
 if(d.length<=2)return d? "("+d : "";
 if(d.length<=6)return "("+d.slice(0,2)+") "+d.slice(2);
 if(d.length<=10)return "("+d.slice(0,2)+") "+d.slice(2,6)+"-"+d.slice(6);
 return "("+d.slice(0,2)+") "+d.slice(2,7)+"-"+d.slice(7);
}
/** Formata telefone nacional salvo sem reinterpretar outros valores legados. */
export function formatSavedPhone(value){
 const raw=String(value??"");
 return /^\d{10,11}$/.test(raw)?formatPhone(raw):raw;
}
/** Preserva DDI explícito na identidade global da cliente; não corta números internacionais. */
export function formatInternationalPhone(value){
 const raw=String(value??"").trim();
 if(raw.startsWith("+"))return "+"+digits(raw);
 return formatPhone(raw);
}
/** Formata CPF em grupos 000.000.000-00, sem validar os dígitos verificadores. */
export function formatCpf(value){
 const d=digits(value).slice(0,11);
 return d.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1-$2");
}
/** Formata CNPJ em grupos 00.000.000/0000-00, sem validar os dígitos verificadores. */
export function formatCnpj(value){
 const d=digits(value).slice(0,14);
 return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");
}
/** Formata CEP brasileiro como 00000-000. */
export function formatCep(value){
 const d=digits(value).slice(0,8);
 return d.length>5?d.slice(0,5)+"-"+d.slice(5):d;
}
/** Converte dígitos de entrada para moeda brasileira com duas casas decimais. */
export function formatCurrency(value){
 const d=digits(value);
 if(!d)return "0,00";
 return (Number(d)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
/** Converte valor monetário em formato brasileiro para número decimal; entradas inválidas retornam zero. */
export function parseBRL(value){
 const raw=String(value??"").replace(/\s/g,"").replace(/R\$/gi,"");
 const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""):raw.replace(/[^\d.-]/g,"");
 const parsed=Number(normalized);
 return Number.isFinite(parsed)?parsed:0;
}
/** Detecta máscara por data-mask, nome, id ou placeholder reconhecido. */
export function detectInputMask(input){
 const type=String(input?.type||"text").toLowerCase();
 // Nunca modificar credenciais nem campos de tipos incompatíveis com máscara textual.
 if(!["text","tel","search"].includes(type))return "";
 const declared=(input?.dataset?.mask||"").toLowerCase();
 const name=(input?.name||input?.id||"").toLowerCase();
 const hint=(input?.placeholder||"").trim();
 if(declared==="none")return "";
 if(declared)return ["cpf","cnpj","phone","phone-international","cep","currency"].includes(declared)?declared:"";
 if(/(^|[_-])cpf($|[_-])/.test(name)||hint==="000.000.000-00")return "cpf";
 if(/(^|[_-])cnpj($|[_-])/.test(name)||hint==="00.000.000/0000-00")return "cnpj";
 if(/phone|telefone|celular|whatsapp/.test(name)||/^\(00\)\s?00000-0000$/.test(hint))return "phone";
 if(/(^|[_-])cep($|[_-])/.test(name)||hint==="00000-000")return "cep";
 return "";
}
/** Aplica no campo a máscara previamente identificada, sem alterar campos não reconhecidos. */
export function applyInputMask(input){
 if(input?.readOnly||input?.disabled)return;
 const mask=detectInputMask(input);
 if(!mask)return;
 if(mask==="cpf")input.value=formatCpf(input.value);
 else if(mask==="cnpj")input.value=formatCnpj(input.value);
 else if(mask==="phone")input.value=formatPhone(input.value);
 else if(mask==="phone-international")input.value=formatInternationalPhone(input.value);
 else if(mask==="cep")input.value=formatCep(input.value);
 else if(mask==="currency")input.value=formatCurrency(input.value);
}
/** Instala listeners para digitação, colagem, fim da composição e saída do campo. */
export function installGlobalMasks(){
 if(document.documentElement.dataset.globalMasks==="true")return;
 document.documentElement.dataset.globalMasks="true";
 const handleInput=event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||event.isComposing||input.readOnly||input.disabled)return;
  const mask=detectInputMask(input);
  if(!mask)return;
  const start=input.selectionStart;
  const before=input.value;
  applyInputMask(input);
  if(input.value!==before&&start!==null&&document.activeElement===input){
   // Preserva a posição lógica do cursor pela quantidade de dígitos à esquerda.
   const hasRemovedDdi=mask==="phone"&&before.trimStart().startsWith("+")&&!input.value.startsWith("+");
   const count=Math.max(0,digits(before.slice(0,start)).length-(hasRemovedDdi?2:0));
   let pos=0,found=0;
   while(pos<input.value.length&&found<count){if(/\d/.test(input.value[pos]))found++;pos++;}
   if(start===before.length)pos=input.value.length;
   try{input.setSelectionRange(pos,pos);}catch{}
  }
 };
 document.addEventListener("input",handleInput);
 document.addEventListener("compositionend",handleInput);
 document.addEventListener("focusout",event=>{
  const input=event.target;
  if(input instanceof HTMLInputElement)applyInputMask(input);
 });
}
