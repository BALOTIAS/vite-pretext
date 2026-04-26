// Tree-walking helpers used by the orchestrator to resolve a `data-pretext`
// marker into the elements pretext should actually measure.
//
// Lives in its own module so the logic is testable without spawning a worker
// or running the full orchestrator side-effects on import.

// Tags whose textContent we measure for min-height. Anything else is treated
// as a container and walked into.
export const TEXT_LEAF_TAGS = new Set<string>([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'TD',
  'TH',
  'FIGCAPTION',
  'BLOCKQUOTE',
  'CITE',
  'DT',
  'DD',
]);

// Tags treated as block-level for the "should we walk?" decision. The set is
// a superset of TEXT_LEAF_TAGS plus the structural containers (lists, tables,
// articles, sections, etc.) that wrap them.
export const BLOCK_TAGS = new Set<string>([
  ...TEXT_LEAF_TAGS,
  'UL',
  'OL',
  'DL',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'ARTICLE',
  'SECTION',
  'ASIDE',
  'DIV',
  'NAV',
  'HEADER',
  'FOOTER',
  'MAIN',
  'FIGURE',
  'PRE',
  'ADDRESS',
  'HR',
]);

export function hasBlockChild(el: Element): boolean {
  for (const child of el.children) {
    if (BLOCK_TAGS.has(child.tagName)) return true;
  }
  return false;
}

// Recursively collect text-leaf descendants whose own children don't include
// further block content. Example: an outer <li> wrapping <span> + nested <ol>
// is skipped (mixed content), but the inner <li>s inside the nested ol are
// picked up.
export function collectLeaves(root: Element, out: Element[]): void {
  for (const child of Array.from(root.children)) {
    const isLeafTag = TEXT_LEAF_TAGS.has(child.tagName);
    const wraps = hasBlockChild(child);
    if (isLeafTag && !wraps) {
      out.push(child);
    } else {
      collectLeaves(child, out);
    }
  }
}

// Resolve a marker into the elements pretext should measure: the marker
// itself when it's a clean leaf, or its leaf descendants when it has block
// children. This is what makes the marker "smart" — you can mark a paragraph
// or a whole article with the same attribute.
export function resolveTargets(el: Element): Element[] {
  if (!hasBlockChild(el)) return [el];
  const leaves: Element[] = [];
  collectLeaves(el, leaves);
  return leaves;
}
