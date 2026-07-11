import { encode } from "@toon-format/toon";

export type FieldDef =
  | { type: "field"; key: string; as?: string }
  | { type: "pluck"; key: string; subkey: string; as?: string }
  | { type: "lower"; key: string; as?: string }
  | { type: "custom"; as: string; fn: (item: Record<string, unknown>) => unknown };

export function field(key: string, as?: string): FieldDef {
  return { type: "field", key, as };
}

export function pluck(key: string, subkey: string, as?: string): FieldDef {
  return { type: "pluck", key, subkey, as };
}

export function lower(key: string, as?: string): FieldDef {
  return { type: "lower", key, as };
}

export function custom(
  as: string,
  fn: (item: Record<string, unknown>) => unknown,
): FieldDef {
  return { type: "custom", as, fn };
}

export function extract(
  item: Record<string, unknown>,
  schema: FieldDef[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const def of schema) {
    const outputKey = def.as ?? ("key" in def ? def.key : def.as);
    switch (def.type) {
      case "field":
        result[outputKey] = item[def.key] ?? null;
        break;
      case "pluck":
        result[outputKey] =
          (item[def.key] as Record<string, unknown> | undefined)?.[
            def.subkey
          ] ?? null;
        break;
      case "lower":
        result[outputKey] =
          typeof item[def.key] === "string"
            ? (item[def.key] as string).toLowerCase()
            : item[def.key];
        break;
      case "custom":
        result[outputKey] = def.fn(item);
        break;
      default: {
        const _exhaustive: never = def;
        throw new Error(`Unknown field type: ${(_exhaustive as FieldDef).type}`);
      }
    }
  }
  return result;
}

type ToonRecord = Record<string, unknown>;

function asRecord(item: object): ToonRecord {
  return item as ToonRecord;
}

export function renderList(
  label: string,
  items: ReadonlyArray<object>,
  schema: FieldDef[],
): string {
  const extracted = items.map((item) => extract(asRecord(item), schema));
  return encode({ [label]: extracted });
}

export function renderDetail(
  label: string,
  item: object,
  schema: FieldDef[],
): string {
  return encode({ [label]: extract(asRecord(item), schema) });
}

export function renderHelp(lines: string[]): string {
  if (lines.length === 0) return "";
  const indented = lines.map((l) => `  ${l}`).join("\n");
  return `help[${lines.length}]:\n${indented}`;
}

export function renderOutput(blocks: string[]): string {
  return blocks.filter(Boolean).join("\n");
}

export function truncateText(
  text: string,
  limit: number,
  full: boolean,
): { text: string; truncated: boolean; total: number } {
  if (full || text.length <= limit) {
    return { text, truncated: false, total: text.length };
  }
  return {
    text: `${text.slice(0, limit)}... (truncated, ${text.length} chars total — use --full)`,
    truncated: true,
    total: text.length,
  };
}

export function formatCountLine(shown: number, total?: number): string {
  if (total === undefined || total === shown) {
    return `${shown} shown`;
  }
  return `${shown} of ${total} total`;
}
