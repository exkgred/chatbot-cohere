import {
  extractVisitorName,
  isGreetingOnly,
  parseAsName,
} from './visitor-name.js';
import { renderMarkdown } from './markdown.js';

const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const typing = document.getElementById('typing');

const NAME_STORAGE_KEY = 'visitor_name';
const SESSION_STORAGE_KEY = 'visitor_session';

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

let userName = readStoredName();
let awaitingName = !userName;

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
  const compact = window.matchMedia('(max-width: 640px)').matches;
  userInput.placeholder = compact
    ? `Pergunte algo, ${userName}...`
    : `Pergunte algo para o Joshua, ${userName}...`;
}

if (userName) {
  setAskPlaceholder();
  const initialBubble = chatBox.querySelector('.bot .msg-bubble');
  if (initialBubble) {
    initialBubble.classList.add('md');
    initialBubble.innerHTML = renderMarkdown(`Olá de novo, ${userName}!

Sou o Joshua, engenheiro de software em Curitiba. Trabalho com PHP, Laravel, Vue.js, Node.js e NestJS — principalmente ERP, automações e agentes inteligentes.

Pode me perguntar sobre experiência, projetos do portfólio (VendaCore ERP, Smarty Hardware, Kanban, Chat Observability e Discador Zenvia), como cada um foi construído, stack técnica ou contato. Por onde quer começar?`);
  }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function shipLocalTurn(pergunta, resposta) {
  return fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: pergunta,
      reply: resposta,
      userName: userName || undefined,
      sessionId: getSessionId(),
      logOnly: true,
    }),
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
      const greeting = `Prazer em te conhecer, ${parsedName}!

Pode me perguntar sobre meus projetos de portfólio (VendaCore ERP, Smarty Hardware, Kanban, Chat Observability e Discador Zenvia), como cada um foi construído, stack técnica, experiência ou contato. Por onde quer começar?`;
      await Promise.all([shipLocalTurn(text, greeting), replyLater(greeting)]);
      return;
    }

    if (isGreetingOnly(text)) {
      const retry = 'Oi! Antes de continuar, como posso te chamar? Pode me dizer seu nome.';
      await Promise.all([shipLocalTurn(text, retry), replyLater(retry)]);
      return;
    }

    awaitingName = false;
    userInput.placeholder = 'Pergunte algo para o Joshua...';
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
  setLoading(true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userName: userName || undefined,
        sessionId: getSessionId(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      appendMessage('bot', data.detail || data.error || 'Erro ao processar a mensagem.');
    } else {
      appendMessage('bot', data.reply || 'Não consegui processar sua mensagem.');
    }
  } catch (err) {
    appendMessage('bot', 'Tive um problema de conexão. Tenta de novo!');
  } finally {
    setLoading(false);
  }
}

function appendMessage(sender, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', sender);

  if (sender === 'bot') {
    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar');
    avatar.textContent = 'JS';
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
