// Static lede article that sits below the streaming feed. Contains a
// highlighted target paragraph: the visual anchor that escapes the viewport
// on the WITHOUT side as cards stream above it.

const LEDE = [
  'You are reading a layout-shift demo. The two columns above contain identical content; the only difference is that the left column adds the data-pretext attribute to text-bearing elements, opting them into worker-measured reservation.',
  'Press start streaming. New cards prepend to both feeds at a steady rate. The shift-rate gauge in the column header reports how many pixels of existing content drift per second on each side.',
];

const TARGET =
  'Try to keep your eye on this paragraph as cards stream in above. On the WITH side the line you are reading stays welded to its position. On the WITHOUT side it slips down the page with every new arrival.';

const BODY = [
  'The right column is honest about what the browser is doing without help. Each new card paints, the browser learns its height, and everything beneath has to make room. The shift counter ticks up whether you read it or not.',
  'The left column is a little less honest, in a useful sense. Pretext measures the new card off-thread before the browser commits paint, applies a min-height, and the layout settles in one step instead of two.',
  'The width toggle in the header lets you trigger the same problem from a different direction. Both columns reflow; only the left one already knew the line counts at the new width.',
  'The webfont toggle swaps system-stack metrics from sans to serif. Heavy display fonts pack lines differently. Pretext re-measures via document.fonts.ready and through ResizeObserver; the right side simply lives with the FOUT.',
];

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

export function mountLede(root: HTMLElement, withMarker: boolean): HTMLElement[] {
  // Single root-level marker; the orchestrator finds the <p> children on its own.
  if (withMarker) root.setAttribute('data-pretext', '');
  const tracked: HTMLElement[] = [];
  const make = (text: string, classes?: string): HTMLParagraphElement => {
    const attrs: Record<string, string> = {};
    if (classes) attrs.class = classes;
    return el('p', attrs, text);
  };

  for (const text of LEDE) {
    const p = make(text);
    root.appendChild(p);
    tracked.push(p);
  }

  const target = make(TARGET, 'target');
  root.appendChild(target);
  tracked.push(target);

  for (const text of BODY) {
    const p = make(text);
    root.appendChild(p);
    tracked.push(p);
  }
  return tracked;
}
