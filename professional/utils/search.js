/** Pesquisa compartilhada do App Profissional: acentos, palavras, telefones e valores. */
import {formatMoney} from "./formatters.js";
/** Normaliza texto sem modificar a informação original exibida ao usuário. */
export function normalizeSearch(value){
 return String(value??"").normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g," ");
}
/** Cada palavra digitada deve ocorrer no texto pesquisável; ordem não é obrigatória. */
export function matchesSearch(value,term){
 const normalized=normalizeSearch(term),text=normalizeSearch(value);
 return !normalized||normalized.split(" ").every(word=>text.includes(word));
}
/** Pesquisa telefone nacional ou com DDI, sem confundir texto com dígitos. */
export function matchesPhone(value,term){
 const raw=String(term??"").trim();
 if(!/^[+()\d\s-]+$/.test(raw))return false;
 const digits=raw.replace(/\D/g,""),phone=String(value??"").replace(/\D/g,"");
 return digits.length>=2&&phone.includes(digits);
}
/** Busca os campos realmente disponíveis no catálogo, incluindo duração e preço. */
export function searchCatalog(rows,term,limit=8){
 return rows.filter(row=>matchesSearch([row.name,row.category,row.description,row.price,formatMoney(row.price),row.duration_minutes!=null?row.duration_minutes+" min":""].filter(v=>v!=null).join(" "),term)).slice(0,limit);
}
