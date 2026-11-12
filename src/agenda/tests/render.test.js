import {state} from '../../state.js';
import {agenda} from '../pages/agenda-page.js';
export function runAgendaRenderChecks(){
 const old={...state};
 const checks=[];
 try{
  state.page='Agenda';state.date=new Date(2026,10,12);state.pro=0;state.view='Dia';state.query='';state.filter='Todos';state.blockedTimes=[];
  const day=agenda();
  checks.push(['renderiza agenda diária',day.includes('Gerencie horários')&&day.includes('calendar')]);
  checks.push(['renderiza seletor de profissionais',day.includes('Mariana Costa')&&day.includes('Ana Lima')]);
  state.view='Semana';const week=agenda();checks.push(['renderiza agenda semanal',week.includes('week-calendar')]);
  state.view='Mês';const month=agenda();checks.push(['renderiza agenda mensal',month.includes('month-calendar')]);
 }catch(error){checks.push(['renderiza agenda sem exceções: '+error.message,false])}
 Object.assign(state,old);
 return {passed:checks.filter(x=>x[1]).length,total:checks.length,checks};
}
