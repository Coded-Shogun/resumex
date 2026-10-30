// Trim strings and drop empty entries from string lists, so blank lines left
// while typing never reach the database.
export function normalize(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const items = value.map(normalize);
    return items.every((v) => typeof v === "string") ? items.filter((v) => v !== "") : items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}
