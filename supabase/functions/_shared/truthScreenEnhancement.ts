export type TruthScreenEnhancement = {
  kind: 'takeaway' | 'explanation' | 'flow' | 'comparison';
  text: string;
  items: string[];
};

export function normalizeTruthScreenEnhancement(value: unknown): TruthScreenEnhancement | undefined {
  if (!value || typeof value !== 'object') { return undefined; }
  const raw = value as Record<string, unknown>;
  const kind = raw.kind;
  if (kind !== 'takeaway' && kind !== 'explanation' && kind !== 'flow' && kind !== 'comparison') {
    return undefined;
  }
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const items = Array.isArray(raw.items) && raw.items.every(item => typeof item === 'string')
    ? raw.items.map(item => item.trim()).filter(Boolean) : [];
  if (kind === 'takeaway' || kind === 'explanation') {
    if (!text || text.length > (kind === 'takeaway' ? 240 : 700) || items.length) { return undefined; }
  } else if (text || items.some(item => item.length > 180) ||
    (kind === 'comparison' ? items.length !== 2 : items.length < 2 || items.length > 4)) {
    return undefined;
  }
  return { kind, text, items };
}
