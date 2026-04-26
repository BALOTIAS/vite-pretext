import { describe, expect, it } from 'vitest';
import { collectLeaves, hasBlockChild, resolveTargets } from '../src/walk.js';

function html(markup: string): HTMLElement {
  // Wrapping in a host avoids weirdness around the parser hoisting <td>/<li>
  // out of context when used at the top level.
  const host = document.createElement('div');
  host.innerHTML = markup.trim();
  return host.firstElementChild as HTMLElement;
}

describe('hasBlockChild', () => {
  it('is false when the element has no children', () => {
    const el = html('<p>just text</p>');
    expect(hasBlockChild(el)).toBe(false);
  });

  it('is false when children are inline', () => {
    const el = html('<p>Hello <em>world</em>, <strong>friend</strong></p>');
    expect(hasBlockChild(el)).toBe(false);
  });

  it('is true when a direct child is a block-level tag', () => {
    const el = html('<article><h2>Title</h2><p>Body</p></article>');
    expect(hasBlockChild(el)).toBe(true);
  });

  it('is true for table containers', () => {
    const el = html('<table><tbody><tr><td>x</td></tr></tbody></table>');
    expect(hasBlockChild(el)).toBe(true);
  });
});

describe('collectLeaves', () => {
  it('finds direct text-leaf descendants', () => {
    const el = html('<article><h2>Title</h2><p>Body</p></article>');
    const out: Element[] = [];
    collectLeaves(el, out);
    expect(out.map((e) => e.tagName)).toEqual(['H2', 'P']);
  });

  it('skips outer <li> wrapping a nested list and picks inner <li>s', () => {
    const el = html(`
      <ol>
        <li>
          <span>section</span>
          <ol>
            <li>sub one</li>
            <li>sub two</li>
          </ol>
        </li>
      </ol>
    `);
    const out: Element[] = [];
    collectLeaves(el, out);
    // Outer li wraps a span + nested ol → mixed; skipped.
    // Inner li's are clean leaves → picked.
    expect(out.map((e) => e.textContent?.trim())).toEqual(['sub one', 'sub two']);
  });

  it('walks into a table and collects each cell', () => {
    const el = html(`
      <figure>
        <figcaption>Caption</figcaption>
        <table>
          <thead><tr><th>A</th><th>B</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>2</td></tr>
            <tr><td>3</td><td>4</td></tr>
          </tbody>
        </table>
      </figure>
    `);
    const out: Element[] = [];
    collectLeaves(el, out);
    expect(out.map((e) => e.tagName)).toEqual([
      'FIGCAPTION',
      'TH',
      'TH',
      'TD',
      'TD',
      'TD',
      'TD',
    ]);
  });

  it('handles a deeply nested structure (article with section + aside)', () => {
    const el = html(`
      <article>
        <header><h1>Title</h1></header>
        <section>
          <p>One</p>
          <p>Two</p>
        </section>
        <aside>
          <h2>Sidebar</h2>
          <ul>
            <li>a</li>
            <li>b</li>
          </ul>
        </aside>
      </article>
    `);
    const out: Element[] = [];
    collectLeaves(el, out);
    expect(out.map((e) => e.tagName)).toEqual(['H1', 'P', 'P', 'H2', 'LI', 'LI']);
  });

  it('returns nothing for a container with only inline children', () => {
    // collectLeaves starts at children; it does not include the root.
    const el = html('<div>Plain text only</div>');
    const out: Element[] = [];
    collectLeaves(el, out);
    expect(out).toEqual([]);
  });
});

describe('resolveTargets', () => {
  it('returns [self] for a leaf element', () => {
    const el = html('<p>Just one paragraph</p>');
    expect(resolveTargets(el)).toEqual([el]);
  });

  it('returns [self] when the element has only inline children', () => {
    const el = html('<p>Hello <em>world</em></p>');
    expect(resolveTargets(el)).toEqual([el]);
  });

  it('returns leaf descendants when the element has block children', () => {
    const el = html('<article><h1>Title</h1><p>Body</p></article>');
    const targets = resolveTargets(el);
    expect(targets.map((e) => e.tagName)).toEqual(['H1', 'P']);
    // The article itself must NOT be in the list — it would be measured as
    // one big concatenated string with the wrong font.
    expect(targets).not.toContain(el);
  });

  it('handles the demo card-outline shape correctly', () => {
    const el = html(`
      <aside class="card card-outline">
        <h3>Architecture</h3>
        <ol class="outline">
          <li>
            <span class="outline-label">Worker boundary</span>
            <ol>
              <li>OffscreenCanvas-backed measurement</li>
              <li>Structured-clone request/response</li>
            </ol>
          </li>
          <li>
            <span class="outline-label">Main thread</span>
            <ol>
              <li>MutationObserver discovers markers</li>
            </ol>
          </li>
        </ol>
      </aside>
    `);
    const targets = resolveTargets(el);
    expect(targets.map((e) => e.tagName)).toEqual(['H3', 'LI', 'LI', 'LI']);
    expect(targets.map((e) => e.textContent?.trim())).toEqual([
      'Architecture',
      'OffscreenCanvas-backed measurement',
      'Structured-clone request/response',
      'MutationObserver discovers markers',
    ]);
  });

  it('handles the demo thread shape correctly', () => {
    const el = html(`
      <article class="card card-thread">
        <header class="thread-head"><strong>mira</strong></header>
        <p class="thread-body">Top comment</p>
        <ul class="thread-replies">
          <li class="reply">
            <header><strong>jules</strong></header>
            <p>Reply text</p>
            <ul class="thread-replies">
              <li class="reply">
                <header><strong>mira</strong></header>
                <p>Nested reply</p>
              </li>
            </ul>
          </li>
        </ul>
      </article>
    `);
    const targets = resolveTargets(el);
    // Top comment p, the reply's p (which itself has a nested ul → skipped as
    // a leaf, but its own p child is picked up), and the nested reply's p.
    const tags = targets.map((e) => e.tagName);
    expect(tags).toContain('P');
    expect(tags.filter((t) => t === 'P').length).toBe(3);
    expect(targets.map((e) => e.textContent?.trim())).toEqual([
      'Top comment',
      'Reply text',
      'Nested reply',
    ]);
  });

  it('handles a single h2 leaf without descending', () => {
    const el = html('<h2>Just a heading</h2>');
    expect(resolveTargets(el)).toEqual([el]);
  });
});
