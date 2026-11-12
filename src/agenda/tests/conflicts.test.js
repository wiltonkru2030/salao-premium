import {findConflict,validateAppointment} from '../utils/conflict.utils.js';
export function runConflictUnitChecks(){
 const items=[{id:1,date:'2026-11-12',time:'09:00',duration:60,pro:0,name:'Cliente A',service:'Corte'}];
 const base={id:2,date:'2026-11-12',time:'09:30',duration:30,pro:0,name:'Cliente B',service:'Escova'};
 const checks=[
  ['detecta sobreposição',!!findConflict(items,base)],
  ['rejeita sobreposição',!validateAppointment(base,items).valid],
  ['aceita horário imediatamente após outro',validateAppointment({...base,time:'10:00'},items).valid],
  ['aceita outro profissional',validateAppointment({...base,pro:1},items).valid],
  ['rejeita fora do expediente',!validateAppointment({...base,time:'19:45',duration:30},items).valid],
  ['rejeita duração inválida',!validateAppointment({...base,duration:0},items).valid],
  ['rejeita cliente vazio',!validateAppointment({...base,name:''},items).valid]
 ];
 return {passed:checks.filter(x=>x[1]).length,total:checks.length,checks};
}
