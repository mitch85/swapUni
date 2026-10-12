import { BUNDLED_UNIVERSITIES, normalizeUniversity } from '@/data/universities';
import { evaluateSwap, findMatches, indexUniversities } from '@/lib/matching';
import { semesterAtSwap, upcomingTerms } from '@/lib/terms';
import type { Offer, SwapRequest } from '@/lib/types';

const NOW = new Date('2026-10-12T12:00:00Z');
const TERM = 'SoSe 2027';

let seq = 0;
function offer(currentUniversityId: string, targetUniversityIds: string[], extra: Partial<SwapRequest> = {}): Offer {
  seq += 1;
  const userId = `user-${seq}`;
  return {
    id: `req-${seq}`,
    userId,
    status: 'active',
    program: 'humanmedizin',
    currentUniversityId,
    targetUniversityIds,
    semester: 3,
    placeType: 'full',
    lawsuitPlace: false,
    admissionConfirmed: true,
    desiredTerm: TERM,
    ringSwap: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    profile: { id: userId, username: `u${seq}`, firstName: 'Test', lastInitial: 'T', verified: false },
    ...extra,
  };
}

describe('terms', () => {
  it('lists the upcoming terms', () => {
    expect(upcomingTerms(NOW)).toEqual(['SoSe 2027', 'WiSe 2027/28', 'SoSe 2028']);
  });

  it('computes the semester at swap time', () => {
    expect(semesterAtSwap(3, 'SoSe 2027', NOW)).toBe(4);
    expect(semesterAtSwap(3, 'WiSe 2027/28', NOW)).toBe(5);
    expect(semesterAtSwap(0, 'SoSe 2027', NOW)).toBe(0);
  });
});

describe('findMatches', () => {
  it('finds a compatible direct swap', () => {
    const me = offer('mainz', ['muenchen-lmu', 'freiburg']);
    const partner = offer('muenchen-lmu', ['mainz']);
    const matches = findMatches(me, [me, partner], BUNDLED_UNIVERSITIES, { now: NOW });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: `d:${partner.id}`, kind: 'direct', compatibility: 'compatible' });
  });

  it('ignores partners with a different program or term', () => {
    const me = offer('mainz', ['muenchen-lmu']);
    const other = [
      offer('muenchen-lmu', ['mainz'], { program: 'zahnmedizin' }),
      offer('muenchen-lmu', ['mainz'], { desiredTerm: 'WiSe 2027/28' }),
      offer('muenchen-lmu', ['mainz'], { status: 'completed' }),
    ];
    expect(findMatches(me, other, BUNDLED_UNIVERSITIES, { now: NOW })).toHaveLength(0);
  });

  it('finds three-way ring swaps only when everybody allows it', () => {
    const me = offer('mainz', ['muenchen-lmu']);
    const a = offer('muenchen-lmu', ['freiburg']);
    const b = offer('freiburg', ['mainz']);
    const rings = findMatches(me, [a, b], BUNDLED_UNIVERSITIES, { now: NOW });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toMatchObject({ kind: 'ring', compatibility: 'compatible' });
    expect(rings[0].partners.map((p) => p.id)).toEqual([a.id, b.id]);

    const optedOut = offer('freiburg', ['mainz'], { ringSwap: false });
    expect(findMatches(me, [a, optedOut], BUNDLED_UNIVERSITIES, { now: NOW })).toHaveLength(0);
  });

  it('rejects ring swaps through universities that forbid them', () => {
    const me = offer('mainz', ['heidelberg']);
    const a = offer('heidelberg', ['freiburg']);
    const b = offer('freiburg', ['mainz']);
    expect(findMatches(me, [a, b], BUNDLED_UNIVERSITIES, { now: NOW })).toHaveLength(0);
    const all = findMatches(me, [a, b], BUNDLED_UNIVERSITIES, { now: NOW, includeIncompatible: true });
    expect(all[0].checks.find((c) => c.label === 'Ringtausch nicht erlaubt')?.status).toBe('fail');
  });
});

describe('evaluateSwap', () => {
  const unis = indexUniversities(BUNDLED_UNIVERSITIES);

  it('requires identical semesters in the clinical part', () => {
    const checks = evaluateSwap(
      [offer('mainz', ['freiburg'], { semester: 6 }), offer('freiburg', ['mainz'], { semester: 7 })],
      unis,
      NOW,
    );
    expect(checks.find((c) => c.label === 'Fachsemester nicht kompatibel')?.status).toBe('fail');
  });

  it('warns about a one-semester difference in the pre-clinical part', () => {
    const checks = evaluateSwap(
      [offer('mainz', ['freiburg'], { semester: 2 }), offer('freiburg', ['mainz'], { semester: 3 })],
      unis,
      NOW,
    );
    expect(checks.find((c) => c.label === 'Fachsemester weichen um 1 ab')?.status).toBe('warn');
  });

  it('applies minimum semester, model program and lawsuit rules', () => {
    const preStart = { semester: 0 };
    const beforeStart = evaluateSwap(
      [offer('mainz', ['muenchen-lmu'], preStart), offer('muenchen-lmu', ['mainz'], preStart)],
      unis,
      NOW,
    );
    expect(beforeStart.find((c) => c.status === 'fail')?.detail).toContain('Mainz');

    const model = evaluateSwap([offer('bonn', ['koeln']), offer('koeln', ['bonn'])], unis, NOW);
    expect(model.find((c) => c.status === 'fail')?.detail).toContain('Modellstudiengäng');

    const lawsuit = evaluateSwap(
      [offer('rostock', ['mainz'], { lawsuitPlace: true }), offer('mainz', ['rostock'])],
      unis,
      NOW,
    );
    expect(lawsuit.find((c) => c.status === 'fail')?.detail).toContain('Klage');
  });

  it('fails for universities that do not allow swaps at all', () => {
    const checks = evaluateSwap([offer('essen', ['mainz']), offer('mainz', ['essen'])], unis, NOW);
    expect(checks.some((c) => c.status === 'fail')).toBe(true);
  });

  it('flags required dean approval as a warning', () => {
    const checks = evaluateSwap([offer('muenster', ['mainz']), offer('mainz', ['muenster'])], unis, NOW);
    expect(checks.find((c) => c.label === 'Dekanatsgenehmigung erforderlich')?.status).toBe('warn');
  });

  it('warns when a semester rule is unknown', () => {
    const custom = indexUniversities([
      normalizeUniversity({ id: 'x', name: 'X', city: 'X', minSemester: 0 }),
      normalizeUniversity({ id: 'y', name: 'Y', city: 'Y' }),
    ]);
    const checks = evaluateSwap([offer('x', ['y']), offer('y', ['x'])], custom, NOW);
    expect(checks.some((c) => c.status === 'warn')).toBe(true);
    expect(checks.some((c) => c.status === 'fail')).toBe(false);
  });
});
