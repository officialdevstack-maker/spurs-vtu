export type Vars = Record<string, string | number | null>;

export function fill(template: string, vars: Vars, mode: "body" | "path"): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Missing value for {${key}}.`);
    if (mode === "path") {
      if (value === null) throw new Error(`Null value for {${key}} cannot be used in a provider URL path.`);
      return encodeURIComponent(String(value));
    }
    if (value === null) return "null";
    return typeof value === "number" ? String(value) : JSON.stringify(value);
  });
}
