export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function truncate(value: string, limit = 8000): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n...[truncated]`;
}
