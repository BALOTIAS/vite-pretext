// Heterogeneous card generator. Each card type renders its own structure with
// distinct typography (size, family, line-height, container) so a single
// reflow event produces asymmetric per-element shifts — the visual loudness
// uniform paragraphs lacked.
//
// Pairs (with/without marker) are produced by building once with markers and
// cloning, so both columns are guaranteed to display identical content.

const HEADLINES = [
  'The hidden cost of late layout',
  'Why fluid type still hurts',
  'Workers: where measurement belongs',
  'A microsecond budget for typography',
  'Reservation, not prediction',
  'The web font escape hatch',
  'Lines you do not see',
];

const LEDES = [
  'Most cumulative layout shift originates in text. The browser learns the line count of every paragraph at paint time, applies it, and the page jumps under your reading position.',
  'Fluid typography sounds elegant until you remember the user is still reading. Every viewport tick rewrites every line break, and every rewrite is a chance to lose the line you were on.',
  'A worker thread is not a clever trick. It is the only place where measurement does not interrupt the reading experience, because nothing on the main thread has to wait for it.',
  'Reservation is older than reflow. Print typesetters built galleys and locked the page. We can do the same with pixels, given a measurement that arrives before paint.',
  'The serif metric problem: heavy display fonts produce shorter lines than their system stand-ins. Every webfont swap is a measured offence against the reader.',
];

const QUOTES: { text: string; author: string }[] = [
  { text: 'The fastest layout is the one you already drew.', author: 'unknown typesetter' },
  {
    text: 'A page that holds its shape disappears, and the words on it become the experience.',
    author: 'pretext docs',
  },
  { text: 'You cannot animate your way out of a missing measurement.', author: 'CLS, paraphrased' },
  { text: 'Typography is the visible part of an invisible promise.', author: 'web designer, 2014' },
  {
    text: 'Reflow is the cost of asking later than you should have asked.',
    author: 'a performance engineer',
  },
];

const LISTS: { title: string; items: string[] }[] = [
  {
    title: 'What pretext measures',
    items: [
      'Heights, exactly, before the browser asks',
      'Line counts at any width, computed off-thread',
      'Webfont substitution costs, ahead of swap',
      'Container query resolutions, predictively',
    ],
  },
  {
    title: 'Causes of paragraph shift',
    items: [
      'Late webfont arrival rewrites every line break',
      'Container width resolves on a second pass',
      'Hidden tabs report zero clientWidth at first',
      'Variable font weight loads asynchronously',
    ],
  },
  {
    title: 'Where the worker helps',
    items: [
      'Off-main-thread canvas measurement, sub-millisecond',
      'OffscreenCanvas first, DOM canvas fallback',
      'Cached results across rapid resizes',
      'Microtask-applied min-heights, hydration safe',
    ],
  },
];

const TABLES: { caption: string; head: string[]; rows: string[][] }[] = [
  {
    caption: 'Browser layout cost, by source',
    head: ['Source', 'Cost', 'Where'],
    rows: [
      ['Reflow', 'High', 'Main thread'],
      ['Repaint', 'Medium', 'Compositor'],
      ['Measurement', 'Low', 'Either, if you ask'],
      ['Worker measure', 'Tiny', 'Off thread'],
    ],
  },
  {
    caption: 'Reflow triggers in this demo',
    head: ['Trigger', 'WITHOUT', 'WITH'],
    rows: [
      ['Width toggle', 'Reflow on every line', 'min-height stable'],
      ['Webfont swap', 'FOUT, every paragraph', 'Re-measure on fonts.ready'],
      ['Card insert', 'Existing content paints again', 'Reserved space ahead of paint'],
      ['Resize storm', 'Frame-by-frame jank', 'rAF-batched in worker'],
    ],
  },
];

const CAPTIONS = [
  'Caption: the worker round-trip is sub-millisecond for short text.',
  'Figure: cumulative shift accumulates fastest at the top of the viewport.',
  'Note: every webfont swap is a chance to disappoint the reader.',
  'Detail: pretext applies heights inside a microtask to dodge hydration races.',
  'Source: ResizeObserver entries are coalesced per requestAnimationFrame.',
];

const CODE_SNIPPETS = [
  '// Mark text that should be measured ahead of paint\n<p data-pretext>...</p>',
  '// One import; the orchestrator owns the rest\nimport "vite-pretext/orchestrator";',
  '// Off-thread measurement, in a worker\nconst { height } = layout({ text, font, width });',
  '// Microtask-applied to dodge hydration mismatch\nqueueMicrotask(() => el.style.minHeight = h + "px");',
];

const PULL_QUOTES = [
  'Reflow is the cost of asking later than you should.',
  'A reading experience is a thousand tiny reservations.',
  'Pixels are cheap. Attention is not.',
  'The page that does not move is the page you remember.',
];

const CHAT_MESSAGES: { user: string; msg: string }[] = [
  { user: 'maya', msg: 'gm' },
  { user: 'jules', msg: 'how was the deploy?' },
  { user: 'mira', msg: 'rolled back — the unexpected-shift bucket was 8× higher in lazy mode' },
  { user: 'sami', msg: 'so the hypothesis actually proved out' },
  { user: 'kai', msg: 'next: try the width mode for the chat bubbles themselves' },
  { user: 'devon', msg: 'right, then they shrink-wrap to text instead of taking the full row' },
  { user: 'mira', msg: 'pretext.measureNaturalWidth gives you exactly the widest forced line — perfect for this' },
];

const THREADS: { user: string; time: string; comment: string; replies: { user: string; comment: string; nested?: { user: string; comment: string } }[] }[] = [
  {
    user: 'mira',
    time: '4h',
    comment: 'Has anyone benchmarked the worker round-trip on a cold cache? Curious how much the first-paint cost actually is for a full article.',
    replies: [
      {
        user: 'jules',
        comment: 'Sub-millisecond on M-series macs in our tests. The bottleneck is the structured-clone of the response, not the measurement itself.',
        nested: {
          user: 'mira',
          comment: 'Fair, that matches what I saw with a profiler. The transferable-buffer optimisation would help, but only for very long text.',
        },
      },
      {
        user: 'kai',
        comment: 'We saw an outlier on Android Go: ~6ms first measurement, then ~0.4ms on subsequent. Worth caching aggressively.',
      },
    ],
  },
  {
    user: 'devon',
    time: '1d',
    comment: 'The dev-hint pattern (text in DOM, masked with CSS) is underrated. Solves the async-fill shift entirely if you have the text up-front.',
    replies: [
      {
        user: 'sami',
        comment: 'Even when you do not have the text, you can use placeholder strings of similar length. Pretext will measure those and the min-height stays roughly correct.',
      },
    ],
  },
];

const OUTLINES: { title: string; sections: { label: string; items: string[] }[] }[] = [
  {
    title: 'Architecture overview',
    sections: [
      {
        label: 'Worker boundary',
        items: [
          'OffscreenCanvas-backed measurement',
          'Structured-clone request/response',
          'Cache keyed by font + text fingerprint',
        ],
      },
      {
        label: 'Main thread',
        items: [
          'MutationObserver discovers markers',
          'ResizeObserver, rAF-batched',
          'document.fonts.ready re-measure',
        ],
      },
      {
        label: 'Hydration safety',
        items: ['Microtask-deferred min-height', 'WeakSet of initialised elements'],
      },
    ],
  },
  {
    title: 'When pretext helps',
    sections: [
      {
        label: 'Definite wins',
        items: [
          'Async content fill with reserved space',
          'SSR with min-height baked in',
          'Off-main-thread layout decisions',
        ],
      },
      {
        label: 'Marginal',
        items: ['Width changes (reactive only)', 'Font swap (reactive only)'],
      },
    ],
  },
];

const CSS_VARS_HEADLINES = [
  // Texts tuned to wrap differently across narrow vs wide column widths,
  // so the line-count-driven CSS treatment changes visibly when you click
  // "Toggle width" or resize.
  'CSS variables driven by your live measurement',
  'A heading that re-scales itself based on how it wraps',
  'Three visual treatments, one selector trick',
  'Lines you can style — without forcing layout once',
];

const CSS_VARS_TAGLINES = [
  'Line count drives a CSS variable; CSS picks the size.',
  'Resize the columns (or click Toggle width) to see typography respond.',
  'No JS in the styling path — just attribute selectors on the inline style.',
];

const KINDS = ['lede', 'quote', 'list', 'table', 'figure', 'code', 'pull', 'thread', 'outline', 'chat'] as const;
type Kind = (typeof KINDS)[number];

let kindSeed = 0;
let textSeed = 0;
const pickFrom = <T>(pool: readonly T[]): T => pool[textSeed++ % pool.length]!;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

interface Built {
  node: HTMLElement;
  // Text-bearing elements that can be tracked by ShiftMeter.
  // (For the with-marker side, these are also what the orchestrator measures.)
  tracked: HTMLElement[];
}

function buildLede(): Built {
  const h2 = el('h2', {}, pickFrom(HEADLINES));
  const p = el('p', { class: 'lede' }, pickFrom(LEDES));
  return {
    node: el('article', { class: 'card card-lede' }, h2, p),
    tracked: [h2, p],
  };
}

function buildQuote(): Built {
  const q = pickFrom(QUOTES);
  const p = el('p', {}, q.text);
  const cite = el('cite', {}, '— ' + q.author);
  return {
    node: el('blockquote', { class: 'card card-quote' }, p, cite),
    tracked: [p],
  };
}

function buildList(): Built {
  const data = pickFrom(LISTS);
  const h3 = el('h3', {}, data.title);
  const items = data.items.map((t) => el('li', {}, t));
  const ul = el('ul', {}, ...items);
  return {
    node: el('aside', { class: 'card card-list' }, h3, ul),
    tracked: [h3, ...items],
  };
}

function buildTable(): Built {
  const data = pickFrom(TABLES);
  const cap = el('figcaption', {}, data.caption);
  const thead = el('thead', {}, el('tr', {}, ...data.head.map((h) => el('th', {}, h))));
  const tracked: HTMLElement[] = [cap];
  const rows = data.rows.map((row) => {
    const tds = row.map((c) => {
      const td = el('td', {}, c);
      tracked.push(td);
      return td;
    });
    return el('tr', {}, ...tds);
  });
  const tbody = el('tbody', {}, ...rows);
  return {
    node: el('figure', { class: 'card card-table' }, cap, el('table', {}, thead, tbody)),
    tracked,
  };
}

function buildFigure(): Built {
  const placeholder = el('div', { class: 'placeholder' });
  const cap = el('figcaption', {}, pickFrom(CAPTIONS));
  return {
    node: el('figure', { class: 'card card-figure' }, placeholder, cap),
    tracked: [cap],
  };
}

function buildCode(): Built {
  const cap = el('figcaption', {}, pickFrom(CAPTIONS));
  const pre = el('pre', {}, el('code', {}, pickFrom(CODE_SNIPPETS)));
  return {
    node: el('figure', { class: 'card card-code' }, cap, pre),
    tracked: [cap],
  };
}

function buildPull(): Built {
  const p = el('p', {}, pickFrom(PULL_QUOTES));
  return {
    node: el('aside', { class: 'card card-pull' }, p),
    tracked: [p],
  };
}

function buildThread(): Built {
  const data = pickFrom(THREADS);
  const tracked: HTMLElement[] = [];

  const head = el('header', { class: 'thread-head' }, el('strong', {}, data.user), ' · ', el(
    'time',
    {},
    data.time,
  ));
  const body = el('p', { class: 'thread-body' }, data.comment);
  tracked.push(body);

  const replies = el('ul', { class: 'thread-replies' });
  for (const reply of data.replies) {
    const replyHead = el('header', {}, el('strong', {}, reply.user));
    const replyBody = el('p', {}, reply.comment);
    tracked.push(replyBody);
    const replyChildren: (Node | string)[] = [replyHead, replyBody];
    if (reply.nested) {
      const nestedBody = el('p', {}, reply.nested.comment);
      tracked.push(nestedBody);
      const nestedItem = el(
        'li',
        { class: 'reply' },
        el('header', {}, el('strong', {}, reply.nested.user)),
        nestedBody,
      );
      replyChildren.push(el('ul', { class: 'thread-replies' }, nestedItem));
    }
    replies.appendChild(el('li', { class: 'reply' }, ...replyChildren));
  }

  return {
    node: el('article', { class: 'card card-thread' }, head, body, replies),
    tracked,
  };
}

function buildOutline(): Built {
  const data = pickFrom(OUTLINES);
  const tracked: HTMLElement[] = [];
  const h3 = el('h3', {}, data.title);
  tracked.push(h3);

  const root = el('ol', { class: 'outline' });
  for (const section of data.sections) {
    const label = el('span', { class: 'outline-label' }, section.label);
    tracked.push(label);
    const sub = el('ol', {});
    for (const item of section.items) {
      const li = el('li', {}, item);
      tracked.push(li);
      sub.appendChild(li);
    }
    root.appendChild(el('li', {}, label, sub));
  }

  return {
    node: el('aside', { class: 'card card-outline' }, h3, root),
    tracked,
  };
}

function buildCssVars(): Built {
  // Showcase: `data-pretext-mode="lines"` writes only the
  // `--pretext-line-count` CSS variable to the heading. CSS attribute
  // selectors on the inline style swap the typography per line count —
  // 1-line headlines render bigger and accent-coloured; 2-line medium;
  // 3+ smaller and muted. Resize-reactive and zero-JS in the styling path.
  const headline = pickFrom(CSS_VARS_HEADLINES);
  const tagline = pickFrom(CSS_VARS_TAGLINES);
  const h2 = el('h2', { 'data-pretext-mode': 'lines' }, headline);
  const p = el('p', { class: 'css-vars-tagline' }, tagline);
  return {
    node: el('article', { class: 'card card-css-vars' }, h2, p),
    tracked: [h2, p],
  };
}

function buildChat(): Built {
  // Two messages per chat card so the difference between width-shrunk
  // bubbles is visible at a glance. The bubbles use mode="width" — pretext
  // shrink-wraps each bubble to its natural text width via
  // measureNaturalWidth, so a one-word "gm" doesn't take a 600px row.
  const tracked: HTMLElement[] = [];
  const mkRow = () => {
    const data = pickFrom(CHAT_MESSAGES);
    const head = el('header', { class: 'chat-head' }, el('strong', {}, data.user));
    const bubble = el(
      'p',
      { class: 'chat-bubble', 'data-pretext-mode': 'width' },
      data.msg,
    );
    tracked.push(bubble);
    return el('div', { class: 'chat-row' }, head, bubble);
  };
  const node = el('article', { class: 'card card-chat' }, mkRow(), mkRow(), mkRow());
  return { node, tracked };
}

const BUILDERS: Record<Kind, () => Built> = {
  lede: buildLede,
  quote: buildQuote,
  list: buildList,
  table: buildTable,
  figure: buildFigure,
  code: buildCode,
  pull: buildPull,
  thread: buildThread,
  outline: buildOutline,
  chat: buildChat,
};

export interface CardPair {
  withNode: HTMLElement;
  withTracked: HTMLElement[];
  withoutNode: HTMLElement;
  withoutTracked: HTMLElement[];
}

function buildPair(kind: Kind): CardPair {
  const built = BUILDERS[kind]();
  // Tag each tracked leaf with a temp id so we can recover the equivalent
  // elements from the clone, then strip the tags from both sides.
  built.tracked.forEach((t, i) => t.setAttribute('data-pt-id', String(i)));
  const withoutNode = built.node.cloneNode(true) as HTMLElement;
  const withoutTracked: HTMLElement[] = [];
  for (let i = 0; i < built.tracked.length; i++) {
    const found = withoutNode.querySelector<HTMLElement>(`[data-pt-id="${i}"]`);
    if (found) withoutTracked.push(found);
  }
  for (const t of built.tracked) t.removeAttribute('data-pt-id');
  for (const t of withoutTracked) t.removeAttribute('data-pt-id');
  // Smart marker on the WITH-side root: pretext walks into block descendants
  // and finds text-bearing leaves on its own. WITHOUT-side gets no marker.
  built.node.setAttribute('data-pretext', '');
  return {
    withNode: built.node,
    withTracked: built.tracked,
    withoutNode,
    withoutTracked,
  };
}

export function nextCard(): CardPair {
  return buildPair(KINDS[kindSeed++ % KINDS.length]!);
}

// Capture textContent for each element and blank it. Returns a fill function
// that restores the original text. Used by the lazy-fill streamer mode to
// simulate fetch-then-fill on the without-pretext side.
export function blankout(elements: HTMLElement[]): () => void {
  const captured = elements.map((el) => el.textContent ?? '');
  for (const el of elements) el.textContent = '';
  return () => {
    for (let i = 0; i < elements.length; i++) {
      elements[i]!.textContent = captured[i] ?? '';
    }
  };
}

// A representative starter set, ordered to read like a magazine page.
export function buildInitial(): CardPair[] {
  const order: Kind[] = [
    'lede',
    'quote',
    'chat',
    'thread',
    'table',
    'pull',
    'outline',
    'figure',
    'code',
    'lede',
    'list',
  ];
  return order.map((k) => buildPair(k));
}

/**
 * The css-vars card is a feature *showcase* — its CSS treatment depends on a
 * pretext-driven CSS variable that doesn't exist on a no-marker render. So
 * it lives outside the A/B comparison columns, in its own banner, where the
 * "WITHOUT" rendering would only confuse the comparison. Returns a single
 * marked-up card; the orchestrator picks up the heading via the marker.
 */
export function buildCssVarsShowcase(): HTMLElement {
  const card = buildCssVars().node;
  card.setAttribute('data-pretext', '');
  return card;
}
