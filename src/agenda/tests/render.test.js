/** Testes de renderização: estrutura HTML dos calendários e seletor de profissional. */
import { renderDayCalendar } from "../components/day-calendar.js";
import { renderWeekCalendar } from "../components/week-calendar.js";
import { renderMonthCalendar } from "../components/month-calendar.js";
import { renderProfessionalSelector } from "../components/professional-selector.js";

export function runAgendaRenderChecks(){
  const date=new Date(2026,10,12);
  const professionals=[["MC","Mariana Costa","Cabeleireira","pro-1"],["AL","Ana Lima","Manicure","pro-2"]];
  const appointments=[
    {id:"a1",date:"2026-11-12",time:"09:00",name:"Camila Rodrigues",service:"Corte",pro:0,duration:60,status:"Confirmado"},
    {id:"a2",date:"2026-11-13",time:"10:00",name:"Fernanda Alves",service:"Escova",pro:0,duration:45,status:"Em atendimento"},
    {id:"a3",date:"2026-11-12",time:"09:15",name:"Juliana Souza",service:"Coloração",pro:0,duration:90,status:"Confirmado"}
  ];
  const props={date,pro:0,professional:professionals[0],appointments,blockedTimes:[]};
  const checks=[];
  try{
    const day=renderDayCalendar(props);
    checks.push(["renderiza agenda diária",day.includes("calendar surface")&&day.includes("Mariana Costa")]);
    checks.push(["mostra atendimento do dia",day.includes("Camila Rodrigues")]);
    checks.push(["mostra atendimento iniciado fora da meia hora exata",day.includes("Juliana Souza")&&day.includes("09:15")]);
    checks.push(["renderiza agenda semanal",renderWeekCalendar(props).includes("week-calendar")]);
    checks.push(["renderiza agenda mensal",renderMonthCalendar(props).includes("month-calendar")]);
    checks.push(["seletor exibe profissionais dinâmicos",renderProfessionalSelector(1,professionals).includes("Ana Lima")]);
  }catch(error){
    checks.push(["renderização sem exceções: "+error.message,false]);
  }
  return {passed:checks.filter(item=>item[1]).length,total:checks.length,checks};
}
