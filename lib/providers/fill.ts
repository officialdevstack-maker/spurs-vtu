export type Vars = Record<string, string | number>;

export function fill(template: string, vars: Vars, mode: "body" | "path"): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Missing value for {${key}}.`);
    if (mode === "path") return encodeURIComponent(String(value));
    return typeof value === "number" ? String(value) : JSON.stringify(value);
  });
}
