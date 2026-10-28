import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';

marked.use({
  gfm: true,
  breaks: true,
});

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  const label = lang || 'text';
  return `<pre class="code-block" data-lang="${escapeHtml(label)}"><code class="hljs">${highlighted}</code></pre>`;
};
renderer.codespan = ({ text }) => `<code class="inline-code">${escapeHtml(text)}</code>`;

marked.use({ renderer });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || '';
    if (/^https?:\/\//.test(href)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export function renderMarkdown(source: string): string {
  if (!source) return '';
  const raw = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'data-lang'],
  });
}
