const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const typing = document.getElementById('typing');

let userName = localStorage.getItem('visitor_name') || '';

if (userName) {
  userInput.placeholder = `Pergunte algo para o Joshua, ${userName}...`;
  const initialBubble = chatBox.querySelector('.bot .msg-bubble');
  if (initialBubble) {
    initialBubble.textContent = `Olá de novo, ${userName}! Sou o Joshua. Pode me perguntar sobre minha experiência, projetos, habilidades ou contato! 😊`;
  }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // Primeiro passo: identificar o visitante
  if (!userName) {
    userName = text;
    localStorage.setItem('visitor_name', userName);
    appendMessage('user', userName);
    userInput.value = '';
    userInput.placeholder = `Pergunte algo para o Joshua, ${userName}...`;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      appendMessage(
        'bot',
        `Prazer em te conhecer, ${userName}! Fique à vontade para me perguntar sobre meus projetos (como ERP e automações), habilidades técnicas ou contato. O que gostaria de saber?`
      );
    }, 500);
    return;
  }

  appendMessage('user', text);
  userInput.value = '';
  setLoading(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, userName }),
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
