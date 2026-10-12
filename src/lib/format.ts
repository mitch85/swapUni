import type { University } from './types';

/** Time for today's messages, otherwise the date. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

/** Short description of when a university allows a swap. */
export function swapRuleSummary(uni: University): string {
  if (!uni.swapPossible) return 'Kein Tausch möglich';
  if (uni.maxSemester === 0) return 'Nur vor Studienbeginn';
  if (uni.minSemester == null) return 'Semesterregel unbekannt';
  if (uni.minSemester === 0) return 'Ab 1. Semester (auch vor Studienbeginn)';
  return `Ab ${uni.minSemester}. Semester${uni.maxSemester ? ` bis ${uni.maxSemester}. Semester` : ''}`;
}
