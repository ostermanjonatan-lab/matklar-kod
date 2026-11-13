/**
 * The search on the start screen: words, OCH (AND) and ELLER (OR), and brackets.
 *
 * - Words next to each other must all be in the recipe: "kyckling kokosmjölk".
 * - OCH, AND, "&", "+", "samt" and a comma mean the same: "kyckling och spenat".
 * - ELLER, OR and "|" mean that one of them is enough: "lax eller torsk".
 * - OCH binds harder than ELLER, as in "kyckling och spenat eller lax" =
 *   (kyckling och spenat) eller lax. Brackets choose another order:
 *   "(kyckling eller lax) och citron".
 * The operators may be written in small or capital letters.
 */

export type SearchNode =
  | { type: 'term'; text: string }
  | { type: 'and'; parts: SearchNode[] }
  | { type: 'or'; parts: SearchNode[] };

const AND_WORDS = new Set(['och', 'and', 'samt', '&', '+', ',', ';']);
const OR_WORDS = new Set(['eller', 'or', '|']);
// Little words between the foods, which are not searched for themselves
const STOP_WORDS = new Set(['med', 'i', 'på', 'av', 'till']);

type Token = { kind: 'word'; text: string } | { kind: 'and' } | { kind: 'or' } | { kind: 'open' } | { kind: 'close' };

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  // Brackets and the signs are tokens of their own, also without spaces around them
  for (const raw of query.toLowerCase().split(/(\(|\)|,|;|\||&|\+)|\s+/)) {
    const t = raw?.trim();
    if (!t) continue;
    if (t === '(') tokens.push({ kind: 'open' });
    else if (t === ')') tokens.push({ kind: 'close' });
    else if (AND_WORDS.has(t)) tokens.push({ kind: 'and' });
    else if (OR_WORDS.has(t)) tokens.push({ kind: 'or' });
    else if (!STOP_WORDS.has(t)) tokens.push({ kind: 'word', text: t });
  }
  return tokens;
}

/**
 * The query as a tree, or null when there is nothing to search for. A query that is not
 * complete while it is being typed ("lax eller", "(kyckling") is read as far as it goes.
 */
export function parseSearch(query: string): SearchNode | null {
  const tokens = tokenize(query);
  let pos = 0;

  const simplify = (type: 'and' | 'or', parts: SearchNode[]): SearchNode | null =>
    parts.length === 0 ? null : parts.length === 1 ? parts[0] : { type, parts };

  // or := and (OR and)*
  const parseOr = (): SearchNode | null => {
    const parts: SearchNode[] = [];
    const first = parseAnd();
    if (first) parts.push(first);
    while (pos < tokens.length && tokens[pos].kind === 'or') {
      pos++;
      const next = parseAnd();
      if (next) parts.push(next);
    }
    return simplify('or', parts);
  };

  // and := item ((AND)? item)*  - words next to each other are AND too
  const parseAnd = (): SearchNode | null => {
    const parts: SearchNode[] = [];
    while (pos < tokens.length) {
      const t = tokens[pos];
      if (t.kind === 'or' || t.kind === 'close') break;
      if (t.kind === 'and') {
        pos++;
        continue;
      }
      if (t.kind === 'open') {
        pos++;
        const inner = parseOr();
        if (pos < tokens.length && tokens[pos].kind === 'close') pos++;
        if (inner) parts.push(inner);
        continue;
      }
      parts.push({ type: 'term', text: t.text });
      pos++;
    }
    return simplify('and', parts);
  };

  let result: SearchNode | null = null;
  const all: SearchNode[] = [];
  while (pos < tokens.length) {
    const part = parseOr();
    if (part) all.push(part);
    // A closing bracket without an opening one is skipped
    if (pos < tokens.length && tokens[pos].kind === 'close') pos++;
  }
  result = simplify('and', all);
  return result;
}

/** Whether the texts of a recipe (name, ingredients and so on, in small letters) match the query. */
export function matchesSearch(node: SearchNode, fields: string[]): boolean {
  switch (node.type) {
    case 'term':
      return fields.some((f) => f.includes(node.text));
    case 'and':
      return node.parts.every((p) => matchesSearch(p, fields));
    case 'or':
      return node.parts.some((p) => matchesSearch(p, fields));
  }
}
