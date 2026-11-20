/**
 * Utilitários de calendário.
 * Responsabilidade: converter chaves de data e calcular dias/semanas sem mutar a data original.
 */

/** Converte uma data em chave local AAAA-MM-DD para filtros e agrupamentos da Agenda. */
export function dateKey(date){const d=new Date(date);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
/** Converte chave AAAA-MM-DD em objeto Date no fuso local. */
export function parseDateKey(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d)}
/** Soma dias preservando a data original recebida. */
export function addDays(date,amount){const d=new Date(date);d.setDate(d.getDate()+amount);return d}
/** Retorna a segunda-feira da semana da data informada, com horário zerado. */
export function startOfWeek(date){const d=new Date(date);d.setHours(0,0,0,0);return addDays(d,-((d.getDay()+6)%7))}
/** Formata data para pt-BR usando opções Intl fornecidas ou padrão dia/mês/ano. */
export function formatDate(date,options={day:'numeric',month:'long',year:'numeric'}){return new Intl.DateTimeFormat('pt-BR',options).format(date)}
/** Compara duas datas pelo dia local, ignorando diferenças de horário. */
export function isSameDay(a,b){return dateKey(a)===dateKey(b)}
