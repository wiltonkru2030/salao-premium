/**
 * Utilitários de duração.
 * Responsabilidade: validar, converter e somar horários no formato HH:mm.
 */

/** Converte HH:mm em minutos desde a meia-noite; lança erro para horário inválido. */
export function timeToMinutes(value){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value||''))throw new Error('Horário inválido.');const [h,m]=value.split(':').map(Number);return h*60+m}
/** Converte minutos em HH:mm, normalizando valores que ultrapassem um dia. */
export function minutesToTime(value){const m=((value%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
/** Soma duração em minutos ao horário inicial e retorna HH:mm. */
export function addDuration(time,duration){return minutesToTime(timeToMinutes(time)+Number(duration))}
/** Formata minutos em horas e minutos para exibição na Agenda. */
export function durationLabel(minutes){const h=Math.floor(minutes/60),m=minutes%60;return [h? h+' h':null,m?m+' min':null].filter(Boolean).join(' ')||'0 min'}
