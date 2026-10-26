const aliases: Record<string, string> = {"بايثون": "python", "إس كيو إل": "sql", "اس كيو ال": "sql"};
export function skillKey(value: string) {
  const key = value.trim().toLowerCase();
  return aliases[key] ?? key;
}
export function displaySkills(values: string[]) {
  return [...new Map(values.map(value => {
    const key = skillKey(value);
    return [key, key === "python" ? "Python" : key === "sql" ? "SQL" : value.trim()];
  })).values()];
}
