import {
  extractVisitorName,
  isGreetingOnly,
  parseAsName,
} from './visitor-name.js';
import { detectLang, persistLang, t } from './i18n.js';
import { renderMarkdown } from './markdown.js';

const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const typing = document.getElementById('typing');

const NAME_STORAGE_KEY = 'visitor_name';
const SESSION_STORAGE_KEY = 'visitor_session';

let lang = detectLang();
let userName = readStoredName();
let awaitingName = !userName;

function copy() {
  return t(lang);
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function readStoredName() {
  const stored = localStorage.getItem(NAME_STORAGE_KEY) || '';
  const parsed = parseAsName(stored);
  if (stored && !parsed) {
    localStorage.removeItem(NAME_STORAGE_KEY);
  }
  return parsed || '';
}

function saveVisitorName(name) {
  userName = name;
  awaitingName = false;
  localStorage.setItem(NAME_STORAGE_KEY, name);
  setAskPlaceholder();
}

function setAskPlaceholder() {
  const strings = copy();
  const compact = window.matchMedia('(max-width: 640px)').matches;
  if (awaitingName) {
    userInput.placeholder = strings.placeholderName;
    return;
  }
  if (userName) {
    userInput.placeholder = strings.placeholderAsk(userName, compact);
    return;
  }
  userInput.placeholder = strings.placeholderAskAnon;
}

function hasUserMessages() {
  return Boolean(chatBox.querySelector('.message.user'));
}

function refreshWelcomeBubble() {
  if (hasUserMessages()) return;
  const initialBubble = chatBox.querySelector('.bot .msg-bubble');
  if (!initialBubble) return;
  const strings = copy();
  const text = userName ? strings.welcomeBack(userName) : strings.welcome;
  initialBubble.classList.add('md');
  initialBubble.innerHTML = renderMarkdown(text);
}

function applyLanguage() {
  const strings = copy();
  document.documentElement.lang = strings.htmlLang;
  document.title = strings.title;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = strings[key];
    if (typeof value === 'string') el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const value = strings[key];
    if (typeof value === 'string') el.setAttribute('title', value);
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const value = strings[key];
    if (typeof value === 'string') el.setAttribute('aria-label', value);
  });

  sendBtn.setAttribute('aria-label', strings.sendAria);

  document.querySelectorAll('.lang-switch [data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
  });

  setAskPlaceholder();
  refreshWelcomeBubble();
}

function setLanguage(next) {
  lang = persistLang(next);
  applyLanguage();
}

function bindLangSwitch() {
  document.querySelectorAll('.lang-switch [data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-lang');
      if (next && next !== lang) setLanguage(next);
    });
  });
}

applyLanguage();
bindLangSwitch();

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function chatPayload(extra = {}) {
  return {
    userName: userName || undefined,
    sessionId: getSessionId(),
    language: lang,
    ...extra,
  };
}

function shipLocalTurn(pergunta, resposta) {
  return fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatPayload({
      message: pergunta,
      reply: resposta,
      logOnly: true,
    })),
  }).catch(() => {});
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  userInput.value = '';

  if (awaitingName) {
    const parsedName = extractVisitorName(text);
    if (parsedName) {
      saveVisitorName(parsedName);
      const greeting = copy().afterName(parsedName);
      await Promise.all([shipLocalTurn(text, greeting), replyLater(greeting)]);
      return;
    }

    if (isGreetingOnly(text)) {
      const retry = copy().greetingRetry;
      await Promise.all([shipLocalTurn(text, retry), replyLater(retry)]);
      return;
    }

    awaitingName = false;
    setAskPlaceholder();
  }

  await askJoshua(text);
}

function replyLater(text) {
  setLoading(true);
  return new Promise((resolve) => {
    setTimeout(() => {
      setLoading(false);
      appendMessage('bot', text);
      resolve();
    }, 450);
  });
}

async function askJoshua(text) {
  const strings = copy();
  setLoading(true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatPayload({ message: text })),
    });
    const data = await response.json();
    if (!response.ok) {
      appendMessage('bot', data.detail || data.error || strings.errorProcess);
    } else {
      appendMessage('bot', data.reply || strings.errorEmpty);
    }
  } catch {
    appendMessage('bot', strings.errorConn);
  } finally {
    setLoading(false);
  }
}

function appendMessage(sender, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', sender);

  if (sender === 'bot') {
    const avatar = document.createElement('img');
    avatar.classList.add('msg-avatar');
    avatar.src = 'joshua.jpg';
    avatar.alt = '';
    avatar.width = 30;
    avatar.height = 30;
    wrapper.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.classList.add('msg-bubble');
  if (sender === 'bot') {
    bubble.classList.add('md');
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  wrapper.appendChild(bubble);

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  userInput.disabled = isLoading;
  typing.style.display = isLoading ? 'flex' : 'none';
  if (isLoading) chatBox.scrollTop = chatBox.scrollHeight;
}
