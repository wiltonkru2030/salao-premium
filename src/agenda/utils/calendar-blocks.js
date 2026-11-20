/**
 * Converte bloqueios persistidos em segmentos diários, sem acesso ao DOM ou banco.
 */
import {dateKey,addDays} from "./date.utils.js";
/**
 * Divide bloqueios de vários dias no intervalo visível, incluindo folgas gerais.
 * @param {Array} blocks Bloqueios originais.
 * @param {Array} professionals Profissionais na ordem visual.
 * @param {Date} start Início inclusivo da consulta.
 * @param {Date} end Fim exclusivo da consulta.
 * @returns {Array} Segmentos por dia e profissional.
 */
export function expandCalendarBlocks(blocks,professionals,start,end){
 const indices=new Map(professionals.map((p,i)=>[p.id,i]));
 const time=d=>[d.getHours(),d.getMinutes()].map(n=>String(n).padStart(2,"0")).join(":");
 return blocks.flatMap(block=>{
  const from=new Date(Math.max(new Date(block.starts_at).getTime(),start.getTime()));
  const until=new Date(Math.min(new Date(block.ends_at).getTime(),end.getTime()));
  if(!(from<until))return [];
  const targets=block.professional_id?[indices.get(block.professional_id)].filter(i=>i!==undefined):professionals.map((_,i)=>i);
  const segments=[];
  for(let cursor=from;cursor<until;){
   const midnight=new Date(cursor);midnight.setHours(0,0,0,0);
   const next=addDays(midnight,1);
   const limit=new Date(Math.min(next.getTime(),until.getTime()));
   for(const pro of targets)segments.push({id:block.id,pro,date:dateKey(cursor),start:time(cursor),end:limit.getTime()===next.getTime()?"24:00":time(limit),reason:block.reason});
   cursor=limit;
  }
  return segments;
 });
}
