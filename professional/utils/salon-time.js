/** Converte instantes da Agenda em datas civis do salão e limites de consulta. */

/** Usa o fuso cadastrado; registros antigos sem fuso seguem o padrão brasileiro. */
export function salonTimezone(timezone) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {timeZone:timezone || "America/Sao_Paulo"}).resolvedOptions().timeZone;
  } catch {
    return "America/Sao_Paulo";
  }
}

/** Representa o dia civil do salão como uma data local para os controles do calendário. */
export function salonCalendarDate(instant, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone:salonTimezone(timezone),year:"numeric",month:"numeric",day:"numeric"
  }).formatToParts(new Date(instant)).map(({type,value})=>[type,value]));
  return new Date(Number(parts.year),Number(parts.month)-1,Number(parts.day),12);
}

/** Converte o primeiro dia do mês civil em instante para a consulta ao Supabase. */
export function salonMonthStart(year, month, timezone) {
  const midnight = Date.UTC(year,month,1);
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone:salonTimezone(timezone),timeZoneName:"shortOffset"
  });
  /** Obtém a diferença entre UTC e o fuso do salão no instante consultado. */
  const offsetAt = instant => {
    const label = formatter.formatToParts(instant).find(part=>part.type==="timeZoneName").value;
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label);
    return match ? (match[1]==="-"?-1:1)*(Number(match[2])*60+Number(match[3]||0))*60000 : 0;
  };
  const initial = midnight-offsetAt(midnight);
  return new Date(midnight-offsetAt(initial));
}
