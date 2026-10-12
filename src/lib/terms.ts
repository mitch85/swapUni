/**
 * Helpers for German semester terms. Summer term (SoSe) runs April–September, winter
 * term (WiSe) October–March.
 */
export interface Term {
  kind: 'WiSe' | 'SoSe';
  /** Calendar year in which the term starts. */
  year: number;
}

export function termAt(date: Date): Term {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month >= 4 && month <= 9) return { kind: 'SoSe', year };
  return { kind: 'WiSe', year: month >= 10 ? year : year - 1 };
}

export function nextTerm(term: Term): Term {
  return term.kind === 'SoSe' ? { kind: 'WiSe', year: term.year } : { kind: 'SoSe', year: term.year + 1 };
}

export function formatTerm(term: Term): string {
  if (term.kind === 'SoSe') return `SoSe ${term.year}`;
  return `WiSe ${term.year}/${String((term.year + 1) % 100).padStart(2, '0')}`;
}

export function parseTerm(label: string): Term | null {
  const match = /^(WiSe|SoSe) (\d{4})/.exec(label.trim());
  if (!match) return null;
  return { kind: match[1] as Term['kind'], year: Number(match[2]) };
}

function termIndex(term: Term): number {
  return term.year * 2 + (term.kind === 'WiSe' ? 1 : 0);
}

/** Number of semester changes between `from` and `to` (0 if `to` is the same term). */
export function termsBetween(from: Term, to: Term): number {
  return termIndex(to) - termIndex(from);
}

/** The next `count` terms starting with the upcoming one. */
export function upcomingTerms(now: Date, count = 3): string[] {
  const result: string[] = [];
  let term = nextTerm(termAt(now));
  for (let i = 0; i < count; i++) {
    result.push(formatTerm(term));
    term = nextTerm(term);
  }
  return result;
}

/**
 * Semester the student will be in at the new university when the swap takes effect.
 * Returns 0 for students who have not started yet (swap before the start of studies).
 */
export function semesterAtSwap(currentSemester: number, desiredTerm: string, now: Date): number {
  if (currentSemester === 0) return 0;
  const target = parseTerm(desiredTerm);
  if (!target) return currentSemester;
  return currentSemester + Math.max(0, termsBetween(termAt(now), target));
}

export function semesterLabel(semester: number): string {
  return semester === 0 ? 'Vor Studienbeginn' : `${semester}. Fachsemester`;
}
