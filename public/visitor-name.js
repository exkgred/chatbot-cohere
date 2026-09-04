const NAME_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von']);
const GREETINGS = new Set([
  'ola',
  'oi',
  'oie',
  'oii',
  'oiii',
  'hello',
  'hi',
  'hey',
  'yo',
  'eae',
  'eai',
  'iae',
  'salve',
  'opa',
  'opaa',
  'fala',
  'bom dia',
  'boa tarde',
  'boa noite',
  'boa madrugada',
  'tudo bem',
  'tudo bom',
  'td bem',
  'td bom',
  'blz',
  'beleza',
  'eae blz',
  'oi tudo bem',
  'ola tudo bem',
  'ola td bem',
]);
const NOT_NAMES = new Set([
  'sim',
  'nao',
  'ok',
  'okay',
  'valeu',
  'obrigado',
  'obrigada',
  'tchau',
  'bye',
  'thanks',
  'por favor',
  'pfv',
  'claro',
  'certo',
  'entendi',
  'legal',
  'show',
  'massa',
  'top',
  'isso',
  'aqui',
  'visitante',
  'anonimo',
  'ninguem',
  'teste',
  'test',
  'eu',
  'voce',
]);
const NAME_FROM_PHRASE = /(?:meu nome [eéè]|me chamo|pode me chamar de|me chama de|chamo-me|sou [oa]|eu sou [oa]?)\s+(.+)/i;

const ELONGATED_GREETING = /^(oi+e*|ola+|hey+|hi+|hello+|eae+|eai+|opa+|iae+|yo+|salve+|fala+)$/;

export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGreetingLike(normalized) {
  return GREETINGS.has(normalized) || ELONGATED_GREETING.test(normalized);
}

function collapseGreetingToken(token) {
  if (/^oi+e*$/.test(token)) return 'oi';
  if (/^ola+$/.test(token)) return 'ola';
  if (/^hey+$/.test(token)) return 'hey';
  if (/^hi+$/.test(token)) return 'hi';
  if (/^hello+$/.test(token)) return 'hello';
  if (/^eae+$/.test(token)) return 'eae';
  if (/^eai+$/.test(token)) return 'eai';
  if (/^opa+$/.test(token)) return 'opa';
  return token;
}

function titleCaseName(words) {
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (NAME_PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function parseAsName(candidate, { fromPhrase = false } = {}) {
  if (!candidate) return null;

  const cleaned = String(candidate)
    .replace(/["'`]/g, '')
    .replace(/[!.]+$/g, '')
    .trim();

  if (!cleaned || /[?]/.test(cleaned) || cleaned.length > 40) return null;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return null;

  const normalized = normalizeText(cleaned);
  if (!normalized) return null;
  if (!fromPhrase && isGreetingLike(normalized)) return null;
  if (NOT_NAMES.has(normalized)) return null;
  if (!fromPhrase && words.some((word) => isGreetingLike(normalizeText(word)))) return null;

  const nameWord = /^[\p{L}][\p{L}'’-]*$/u;
  const allWordsValid = words.every((word) => {
    const particle = NAME_PARTICLES.has(word.toLowerCase());
    return nameWord.test(word) && (particle || word.length >= 2);
  });
  if (!allWordsValid) return null;

  return titleCaseName(words);
}

export function extractVisitorName(text) {
  const raw = String(text || '').trim();
  const phraseMatch = raw.match(NAME_FROM_PHRASE);
  if (phraseMatch) {
    const afterPhrase = phraseMatch[1].split(/[,.!]| e | entao| então| depois/i)[0];
    const fromPhrase = parseAsName(afterPhrase, { fromPhrase: true });
    if (fromPhrase) return fromPhrase;
  }

  const withoutGreeting = raw
    .replace(/^(ol[aá]+|oi+e*|hello+|hi+|hey+|eae+|eai+|opa+|fala+|salve+)[,!.\s]+/i, '')
    .trim();

  if (withoutGreeting && withoutGreeting !== raw) {
    return parseAsName(withoutGreeting);
  }

  return parseAsName(raw);
}

export function isGreetingOnly(text) {
  const normalized = normalizeText(String(text || ''));
  if (!normalized) return false;

  const tokens = normalized.split(' ').map(collapseGreetingToken);
  const collapsed = tokens.join(' ');
  if (isGreetingLike(collapsed) || GREETINGS.has(collapsed)) return true;

  return tokens.length > 0 && tokens.every((token) => isGreetingLike(token) || NOT_NAMES.has(token));
}

export function sanitizeVisitorName(name) {
  if (!name || typeof name !== 'string') return null;
  return parseAsName(name.trim());
}
