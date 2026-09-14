export const BIRTH_DATE = { year: 1997, month: 1, day: 9 };

function calendarParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

export function ageFromBirth(now = new Date(), timeZone = 'America/Sao_Paulo') {
  const today = calendarParts(now, timeZone);
  let age = today.year - BIRTH_DATE.year;
  if (today.month < BIRTH_DATE.month || (today.month === BIRTH_DATE.month && today.day < BIRTH_DATE.day)) {
    age -= 1;
  }
  return age;
}

export function personalAgeContext(now = new Date()) {
  const age = ageFromBirth(now);
  return `Dados pessoais: tenho ${age} anos.`;
}
