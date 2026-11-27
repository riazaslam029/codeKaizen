/** "Lena Fischer" → "Lena F." — first name plus initials, for public verification pages. */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : `${p[0]}.`))
    .join(" ");
}
