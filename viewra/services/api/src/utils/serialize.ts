import type { Document } from "mongoose";

type PlainObject = Record<string, unknown>;

function isObjectIdLike(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as { constructor?: { name?: string } }).constructor?.name ===
      "ObjectId" &&
    typeof (value as { toString?: unknown }).toString === "function"
  );
}

function transformValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isObjectIdLike(value)) {
    return (value as { toString(): string }).toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(transformValue);
  if (typeof value === "object") {
    const obj = value as PlainObject;
    if (typeof (obj as { toObject?: unknown }).toObject === "function") {
      return serializeDoc(obj as unknown as Document);
    }
    const out: PlainObject = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "_id") {
        out.id = transformValue(v);
        continue;
      }
      if (k === "__v") continue;
      out[k] = transformValue(v);
    }
    return out;
  }
  return value;
}

export function serializeDoc<T extends PlainObject = PlainObject>(
  doc: Document | PlainObject | null | undefined,
): T | null {
  if (!doc) return null;
  const raw =
    typeof (doc as Document).toObject === "function"
      ? (doc as Document).toObject({ virtuals: false })
      : { ...(doc as PlainObject) };
  return transformValue(raw) as T;
}

export function serializeDocs<T extends PlainObject = PlainObject>(
  docs: Array<Document | PlainObject>,
): T[] {
  return docs.map((d) => serializeDoc<T>(d)!);
}
