export function dateKey(date){const d=new Date(date);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
export function parseDateKey(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d)}
export function addDays(date,amount){const d=new Date(date);d.setDate(d.getDate()+amount);return d}
export function startOfWeek(date){const d=new Date(date);d.setHours(0,0,0,0);return addDays(d,-((d.getDay()+6)%7))}
export function formatDate(date,options={day:'numeric',month:'long',year:'numeric'}){return new Intl.DateTimeFormat('pt-BR',options).format(date)}
export function isSameDay(a,b){return dateKey(a)===dateKey(b)}
