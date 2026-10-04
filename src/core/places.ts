const COUNTRY_ALIASES: Record<string, string> = {
  co: "co",
  col: "co",
  colombia: "co",
  us: "us",
  usa: "us",
  "united states": "us",
  "estados unidos": "us",
  "united states of america": "us",
};

export function fold(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function canonicalCountry(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const folded = fold(value);
  return COUNTRY_ALIASES[folded] ?? folded;
}

export function sameCountry(left: string | undefined, right: string | undefined): boolean {
  const a = canonicalCountry(left);
  const b = canonicalCountry(right);
  return Boolean(a && b && a === b);
}

export function sameCity(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return fold(left) === fold(right);
}
