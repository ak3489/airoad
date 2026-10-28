import { describe, expect, test } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  test('renders basic markdown', () => {
    const html = renderMarkdown('## 标题\n\n**加粗**与 `code`');
    expect(html).toContain('<h2>标题</h2>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('inline-code');
  });

  test('strips scripts and inline event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  test('sanitizes javascript: links', () => {
    const html = renderMarkdown('[点我](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });

  test('adds safe rel attributes to external links only', () => {
    const html = renderMarkdown('[官方](https://example.com)\n\n[站内](/tasks/p1-t1-setup-lab)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    const internal = html.slice(html.indexOf('href="/tasks'));
    expect(internal).not.toContain('target="_blank"');
  });

  test('highlights known languages and escapes unknown code', () => {
    const ts = renderMarkdown('```ts\nconst n: number = 1;\n```');
    expect(ts).toContain('data-lang="ts"');
    expect(ts).toContain('hljs');

    const escaped = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  test('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
