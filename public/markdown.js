function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHttpUrl(href) {
  try {
    const url = new URL(String(href).replace(/&amp;/g, '&'));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

function renderInline(text) {
  const slots = [];
  const hold = (html) => {
    const key = `%%I${slots.length}%%`;
    slots.push(html);
    return key;
  };

  let out = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));

  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label, href) => {
    const safe = safeHttpUrl(href);
    if (!safe) return label;
    return hold(
      `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    );
  });

  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/gi, (match, prefix, raw) => {
    const trailing = raw.match(/[.,;:!?)]+$/);
    const href = trailing ? raw.slice(0, -trailing[0].length) : raw;
    const punct = trailing ? trailing[0] : '';
    const safe = safeHttpUrl(href);
    if (!safe) return match;
    return `${prefix}${hold(
      `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${href}</a>`,
    )}${punct}`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  return out.replace(/%%I(\d+)%%/g, (_, index) => slots[Number(index)] ?? '');
}

export function renderMarkdown(source) {
  if (!source) return '';
  const escaped = escapeHtml(String(source).replace(/\r\n/g, '\n'));
  const blocks = [];
  const withFences = escaped.replace(/```(?:[a-z0-9_-]*)?\n?([\s\S]*?)```/gi, (_, code) => {
    const key = `%%B${blocks.length}%%`;
    blocks.push(`<pre><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`);
    return `\n${key}\n`;
  });

  const html = [];
  let listType = null;
  const paragraph = [];

  const closeList = () => {
    if (!listType) return;
    html.push(listType === 'ul' ? '</ul>' : '</ol>');
    listType = null;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph.length = 0;
  };

  const openList = (type) => {
    if (listType === type) return;
    closeList();
    html.push(type === 'ul' ? '<ul>' : '<ol>');
    listType = type;
  };

  for (const line of withFences.split('\n')) {
    const fence = line.match(/^%%B(\d+)%%$/);
    if (fence) {
      closeList();
      flushParagraph();
      html.push(blocks[Number(fence[1])]);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      openList('ul');
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      openList('ol');
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    if (line.trim() === '') {
      closeList();
      flushParagraph();
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  closeList();
  flushParagraph();
  return html.join('');
}
