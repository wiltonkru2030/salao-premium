/** Testes unitários: datas, semanas e cálculos de duração usados pela Agenda. */
import {dateKey,addDays,startOfWeek} from '../utils/date.utils.js';
import {timeToMinutes,addDuration} from '../utils/duration.utils.js';
export function runAgendaUnitChecks(){const checks=[['date key',dateKey(new Date(2026,10,12))==='2026-11-12'],['add days',dateKey(addDays(new Date(2026,10,12),1))==='2026-11-13'],['week starts monday',startOfWeek(new Date(2026,10,12)).getDay()===1],['time conversion',timeToMinutes('09:30')===570],['duration arithmetic',addDuration('09:30',45)==='10:15']];return {passed:checks.filter(x=>x[1]).length,total:checks.length,checks}}
