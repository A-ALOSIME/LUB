type OrganizationEventCandidate = {
  id: string;
  title: string;
  featured: boolean;
};

const genericIntroduction = /(?:ال)?لقاء\s+(?:ال)?تعريفي|(?:^|\s)(?:ال)?تعريف\s+ب(?:النادي|المجلس|الجهة)|orientation\s+(?:meeting|session|event)|introductory\s+(?:meeting|session|event)|welcome\s+(?:meeting|event)/i;

export function selectOrganizationEventHighlights<T extends OrganizationEventCandidate>(events: readonly T[]): T[] {
  const featured = events.find(event => event.featured);
  const highlights = featured ? [featured] : [];

  for (const event of events) {
    if (event.featured || genericIntroduction.test(event.title)) continue;
    highlights.push(event);
    if (highlights.length === 3) break;
  }

  return highlights;
}
