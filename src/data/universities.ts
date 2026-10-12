import type { University } from '@/lib/types';

import raw from './universities.json';

/** Fills in defaults for the compact JSON format used in `universities.json`. */
export function normalizeUniversity(input: Partial<University> & Pick<University, 'id' | 'name' | 'city'>): University {
  return {
    swapPossible: true,
    ringSwap: 'unknown',
    ringSwapMax: null,
    minSemester: null,
    maxSemester: null,
    modelProgram: false,
    swapWithModel: true,
    swapWithRegular: true,
    regularSwapMinSemester: null,
    requiresExactSemester: false,
    requiresDeanApproval: false,
    excludesLawsuitPlaces: false,
    partnerMustApplyOnline: false,
    allowedTerms: 'both',
    lastSwapTerm: null,
    achievementNote: null,
    deadlineSoSe: null,
    deadlineWiSe: null,
    forms: [],
    contactEmail: null,
    contactPhone: null,
    website: null,
    notes: [],
    updatedAt: null,
    ...input,
  };
}

/** Bundled copy of the university rules – used in demo mode and as offline fallback. */
export const BUNDLED_UNIVERSITIES: University[] = (raw as Parameters<typeof normalizeUniversity>[0][])
  .map(normalizeUniversity)
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
