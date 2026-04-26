// Tree-walking helpers used by the orchestrator to resolve a `data-pretext`
// marker into the elements pretext should actually measure.
//
// Lives in its own module so the logic is testable without spawning a worker
// or running the full orchestrator side-effects on import.

// Tags whose textContent we measure for min-height. Anything else is treated
// as a container and walked into.
//
// Notably *absent*: `A`, `BUTTON`, `LABEL`. These are polymorphic — most
// often they appear inline inside paragraphs/list-items, where the parent
// is the right measurement target. Promoting them to leaves would silently
// break the very common `<p>See <a>here</a></p>` case (the walker would
// skip the <p> and measure the <a>, losing the paragraph's height). Sites
// where these are always standalone CTAs / toolbar buttons can opt in via
// the `tags.textLeaf` plugin option.
export const TEXT_LEAF_TAGS: ReadonlySet<string> = new Set<string>([
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
  'CAPTION',
  'BLOCKQUOTE',
  'CITE',
  'DT',
  'DD',
  'SUMMARY',
  'LEGEND',
]);

// Tags treated as block-level for the "should we walk?" decision. The set is
// a superset of TEXT_LEAF_TAGS plus the structural containers (lists, tables,
// articles, sections, forms, dialogs, etc.) that wrap them.
export const BLOCK_TAGS: ReadonlySet<string> = new Set<string>([
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
  'FORM',
  'FIELDSET',
  'DETAILS',
  'DIALOG',
]);

export interface TagSets {
  textLeaf: ReadonlySet<string>;
  block: ReadonlySet<string>;
}

const DEFAULT_SETS: TagSets = { textLeaf: TEXT_LEAF_TAGS, block: BLOCK_TAGS };

export function hasBlockChild(
  el: Element,
  blockTags: ReadonlySet<string> = BLOCK_TAGS,
): boolean {
  for (const child of el.children) {
    if (blockTags.has(child.tagName)) return true;
  }
  return false;
}

// Recursively collect text-leaf descendants whose own children don't include
// further block content. Example: an outer <li> wrapping <span> + nested <ol>
// is skipped (mixed content), but the inner <li>s inside the nested ol are
// picked up.
export function collectLeaves(
  root: Element,
  out: Element[],
  sets: TagSets = DEFAULT_SETS,
): void {
  for (const child of Array.from(root.children)) {
    const isLeafTag = sets.textLeaf.has(child.tagName);
    const wraps = hasBlockChild(child, sets.block);
    if (isLeafTag && !wraps) {
      out.push(child);
    } else {
      collectLeaves(child, out, sets);
    }
  }
}

// Resolve a marker into the elements pretext should measure: the marker
// itself when it's a clean leaf, or its leaf descendants when it has block
// children. This is what makes the marker "smart" — you can mark a paragraph
// or a whole article with the same attribute.
export function resolveTargets(el: Element, sets: TagSets = DEFAULT_SETS): Element[] {
  if (!hasBlockChild(el, sets.block)) return [el];
  const leaves: Element[] = [];
  collectLeaves(el, leaves, sets);
  return leaves;
}

/**
 * Build merged TagSets from a user's `tags` extension.
 *
 * - Tag names are normalised to upper case (DOM `tagName` is upper for HTML).
 * - Custom leaves are auto-promoted into the block set so a parent containing
 *   only custom leaves still walks in (otherwise `<article><my-headline></…>`
 *   would be measured as one big leaf instead of walked).
 * - Always extends the built-ins; never replaces them.
 */
export function buildTagSets(extra?: { textLeaf?: string[]; block?: string[] }): TagSets {
  if (!extra || (!extra.textLeaf?.length && !extra.block?.length)) {
    return DEFAULT_SETS;
  }
  const textLeaf = new Set<string>(TEXT_LEAF_TAGS);
  const block = new Set<string>(BLOCK_TAGS);
  for (const t of extra.textLeaf ?? []) {
    const upper = t.toUpperCase();
    textLeaf.add(upper);
    block.add(upper);
  }
  for (const t of extra.block ?? []) {
    block.add(t.toUpperCase());
  }
  return { textLeaf, block };
}
