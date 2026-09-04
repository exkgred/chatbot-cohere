import {
  extractVisitorName,
  isGreetingOnly,
  parseAsName,
} from './visitor-name.js';

const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const typing = document.getElementById('typing');

const NAME_STORAGE_KEY = 'visitor_name';

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
    initialBubble.textContent = `Olá de novo, ${userName}!

Sou o Joshua, engenheiro de software em Curitiba. Trabalho com PHP, Laravel, Vue.js, Node.js e NestJS — principalmente ERP, automações e agentes inteligentes.

Pode me perguntar sobre experiência, projetos do portfólio (Smarty Hardware e Kanban), stack técnica ou contato. Por onde quer começar?`;
  }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  userInput.value = '';

  if (awaitingName) {
    const parsedName = extractVisitorName(text);
    if (parsedName) {
      saveVisitorName(parsedName);
      await replyLater(
        `Prazer em te conhecer, ${parsedName}!

Pode me perguntar sobre meus projetos de portfólio (Smarty Hardware e Kanban), stack técnica, experiência ou contato. Por onde quer começar?`
      );
      return;
    }

    if (isGreetingOnly(text)) {
      await replyLater('Oi! Antes de continuar, como posso te chamar? Pode me dizer seu nome.');
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
      body: JSON.stringify({ message: text, userName: userName || undefined }),
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
  bubble.textContent = text;
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
