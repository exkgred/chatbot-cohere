const NAME_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von']);
const GREETINGS = [
  'ola tudo bem',
  'ola td bem',
  'oi tudo bem',
  'boa madrugada',
  'bom dia',
  'boa tarde',
  'boa noite',
  'tudo bem',
  'tudo bom',
  'td bem',
  'td bom',
  'eae blz',
  'ola',
  'oi',
  'oie',
  'hello',
  'hi',
  'hey',
  'yo',
  'eae',
  'eai',
  'iae',
  'salve',
  'opa',
  'fala',
  'blz',
  'beleza',
];
const GREETING_SET = new Set(GREETINGS);
const BOT_ALIASES = new Set(['joshua', 'joshua silva', 'josh', 'js']);
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

function collapseTokens(normalized) {
  return normalized
    .split(' ')
    .filter(Boolean)
    .map(collapseGreetingToken)
    .join(' ');
}

function isGreetingLike(normalized) {
  const collapsed = collapseTokens(normalized);
  return GREETING_SET.has(collapsed) || ELONGATED_GREETING.test(collapsed);
}

function matchPrefix(haystack, prefixes) {
  return prefixes.find((item) => haystack === item || haystack.startsWith(`${item} `));
}

function stripPrefixList(normalized, prefixes) {
  let rest = collapseTokens(normalized);
  let stripped = false;
  for (let i = 0; i < 8 && rest; i += 1) {
    const match = matchPrefix(rest, prefixes);
    if (!match) break;
    rest = rest.slice(match.length).trim();
    stripped = true;
  }
  return { rest, stripped };
}

function stripLeadingGreetings(normalized) {
  return stripPrefixList(normalized, GREETINGS);
}

function stripBotAlias(normalized) {
  let rest = collapseTokens(normalized);
  const aliases = [...BOT_ALIASES].sort((left, right) => right.length - left.length);
  const match = matchPrefix(rest, aliases);
  if (!match) return { rest, stripped: false };
  return { rest: rest.slice(match.length).trim(), stripped: true };
}

function stripChatNoise(normalized) {
  let rest = collapseTokens(normalized);
  let sawGreeting = false;
  for (let i = 0; i < 8 && rest; i += 1) {
    const greet = stripLeadingGreetings(rest);
    if (greet.stripped) {
      sawGreeting = true;
      rest = greet.rest;
      continue;
    }
    if (sawGreeting) {
      const bot = stripBotAlias(rest);
      if (bot.stripped) {
        rest = bot.rest;
        continue;
      }
    }
    break;
  }
  return rest;
}

function containsGreetingPhrase(normalized) {
  const collapsed = collapseTokens(normalized);
  if (isGreetingLike(collapsed)) return true;
  if (stripLeadingGreetings(collapsed).stripped) return true;
  return GREETINGS.some(
    (greeting) =>
      collapsed === greeting ||
      collapsed.startsWith(`${greeting} `) ||
      collapsed.endsWith(` ${greeting}`) ||
      collapsed.includes(` ${greeting} `),
  );
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
  if (NOT_NAMES.has(normalized)) return null;
  if (!fromPhrase && containsGreetingPhrase(normalized)) return null;

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

  if (/[?]/.test(raw)) return null;

  const remaining = stripChatNoise(normalizeText(raw));
  if (!remaining) return null;
  if (/^(quais|qual|como|onde|quando|quem|porque|por que|o que|oq)\b/.test(remaining)) {
    return null;
  }

  return parseAsName(remaining);
}

export function isGreetingOnly(text) {
  const normalized = normalizeText(String(text || ''));
  if (!normalized) return false;

  const remaining = stripChatNoise(normalized);
  if (!remaining) return true;

  const tokens = remaining.split(' ').map(collapseGreetingToken);
  return tokens.length > 0 && tokens.every((token) => isGreetingLike(token) || NOT_NAMES.has(token));
}

export function sanitizeVisitorName(name) {
  if (!name || typeof name !== 'string') return null;
  return parseAsName(name.trim());
}
