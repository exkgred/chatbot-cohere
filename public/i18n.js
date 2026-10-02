export const LANG_STORAGE_KEY = 'chat_lang';

const PROJECTS_PT =
  'Átrio, VendaCore ERP, Nexo, Smarty Hardware, Kanban, Chat Observability no Grafana, Discador Zenvia e Brasa';
const PROJECTS_EN =
  'Átrio, VendaCore ERP, Nexo, Smarty Hardware, Kanban, Chat Observability on Grafana, Discador Zenvia, and Brasa';

export const STRINGS = {
  pt: {
    htmlLang: 'pt-BR',
    title: 'Joshua Silva — Portfólio',
    role: 'Engenheiro de Software',
    location: '📍 Curitiba, PR · Brasil',
    emailTitle: 'Enviar e-mail',
    bio: 'Especialista em PHP, Laravel, Vue.js e Node.js. Apaixonado por automação com agentes inteligentes e sistemas escaláveis.',
    status: '● online',
    sendAria: 'Enviar',
    langGroup: 'Idioma',
    placeholderName: 'Digite seu nome para começar...',
    placeholderAsk: (name, compact) =>
      compact ? `Pergunte algo, ${name}...` : `Pergunte algo para o Joshua, ${name}...`,
    placeholderAskAnon: 'Pergunte algo para o Joshua...',
    welcome: `Olá! Eu sou o Joshua Silva, engenheiro de software em Curitiba.

Atuo com PHP, Laravel, Vue.js, Node.js e NestJS — principalmente em sistemas ERP, automações e agentes inteligentes.

Pode me perguntar sobre experiência, stack, projetos do portfólio (${PROJECTS_PT}) ou como cada um foi construído.

Antes de conversarmos, como posso te chamar?`,
    welcomeBack: (name) => `Olá de novo, ${name}!

Sou o Joshua, engenheiro de software em Curitiba. Trabalho com PHP, Laravel, Vue.js, Node.js e NestJS — principalmente ERP, automações e agentes inteligentes.

Pode me perguntar sobre experiência, projetos do portfólio (${PROJECTS_PT}), como cada um foi construído, stack técnica ou contato. Por onde quer começar?`,
    afterName: (name) => `Prazer em te conhecer, ${name}!

Pode me perguntar sobre meus projetos de portfólio (${PROJECTS_PT}), como cada um foi construído, stack técnica, experiência ou contato. Por onde quer começar?`,
    greetingRetry: 'Oi! Antes de continuar, como posso te chamar? Pode me dizer seu nome.',
    errorProcess: 'Erro ao processar a mensagem.',
    errorEmpty: 'Não consegui processar sua mensagem.',
    errorConn: 'Tive um problema de conexão. Tenta de novo!',
  },
  en: {
    htmlLang: 'en',
    title: 'Joshua Silva — Portfolio',
    role: 'Software Engineer',
    location: '📍 Curitiba, PR · Brazil',
    emailTitle: 'Send email',
    bio: 'Specialist in PHP, Laravel, Vue.js and Node.js. Passionate about intelligent-agent automation and scalable systems.',
    status: '● online',
    sendAria: 'Send',
    langGroup: 'Language',
    placeholderName: 'Type your name to get started...',
    placeholderAsk: (name, compact) =>
      compact ? `Ask something, ${name}...` : `Ask Joshua something, ${name}...`,
    placeholderAskAnon: 'Ask Joshua something...',
    welcome: `Hi! I'm Joshua Silva, a software engineer in Curitiba.

I work with PHP, Laravel, Vue.js, Node.js and NestJS — mostly ERP systems, automations and intelligent agents.

Ask me about experience, stack, portfolio projects (${PROJECTS_EN}), or how each one was built.

Before we start, what should I call you?`,
    welcomeBack: (name) => `Welcome back, ${name}!

I'm Joshua, a software engineer in Curitiba. I work with PHP, Laravel, Vue.js, Node.js and NestJS — mostly ERP, automations and intelligent agents.

Ask me about experience, portfolio projects (${PROJECTS_EN}), how each one was built, tech stack, or how to reach me. Where do you want to start?`,
    afterName: (name) => `Nice to meet you, ${name}!

Ask me about my portfolio projects (${PROJECTS_EN}), how each one was built, tech stack, experience, or how to reach me. Where do you want to start?`,
    greetingRetry: 'Hi! Before we continue, what should I call you? Just tell me your name.',
    errorProcess: 'Something went wrong while processing your message.',
    errorEmpty: "I couldn't process your message.",
    errorConn: 'I had a connection issue. Please try again!',
  },
};

export function normalizeLang(value) {
  return String(value || '')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'pt';
}

export function detectLang() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    /* storage indisponível */
  }

  const nav = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || 'pt';
  return normalizeLang(nav);
}

export function persistLang(lang) {
  const next = normalizeLang(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    /* storage indisponível */
  }
  return next;
}

export function t(lang) {
  return STRINGS[normalizeLang(lang)];
}
