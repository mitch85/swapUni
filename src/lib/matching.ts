import { parseTerm, semesterAtSwap, semesterLabel, termsBetween } from './terms';
import type { Offer, SwapRequest, University } from './types';

/** First clinical semester (after the Physikum). */
export const FIRST_CLINICAL_SEMESTER = 5;

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type Compatibility = 'compatible' | 'partial' | 'incompatible';

export interface CompatibilityCheck {
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface Match {
  /** Stable id: `d:<requestId>` for direct swaps, `r:<requestId>:<requestId>` for ring swaps. */
  id: string;
  kind: 'direct' | 'ring';
  /** The other participants, in swap order (for a ring: the one taking my place comes last). */
  partners: Offer[];
  compatibility: Compatibility;
  checks: CompatibilityCheck[];
  /** Sum of the wish ranks involved (lower is better). */
  priority: number;
}

type UniMap = Map<string, University>;

export function indexUniversities(universities: University[]): UniMap {
  return new Map(universities.map((u) => [u.id, u]));
}

function worst(checks: CompatibilityCheck[]): Compatibility {
  if (checks.some((c) => c.status === 'fail')) return 'incompatible';
  if (checks.some((c) => c.status === 'warn')) return 'partial';
  return 'compatible';
}

/** Does `uni` accept a student coming from `fromUni` in semester `semester`? */
function modelProgramCheck(uni: University, fromUni: University, semester: number): string | null {
  if (fromUni.modelProgram && !uni.swapWithModel) {
    return `${uni.name} tauscht nicht mit Modellstudiengängen.`;
  }
  if (!fromUni.modelProgram) {
    if (!uni.swapWithRegular) return `${uni.name} tauscht nur mit Modellstudiengängen.`;
    if (uni.regularSwapMinSemester != null && semester < uni.regularSwapMinSemester) {
      return `${uni.name} tauscht mit Regelstudiengängen erst ab dem ${uni.regularSwapMinSemester}. Semester.`;
    }
  }
  return null;
}

function semesterRuleCheck(uni: University, semester: number): CompatibilityCheck | null {
  if (uni.minSemester == null) {
    return {
      label: `Semesterregel ${uni.name} nicht hinterlegt`,
      status: 'warn',
      detail: 'Bitte beim Studierendensekretariat erfragen, ab wann ein Tausch möglich ist.',
    };
  }
  const max = uni.maxSemester ?? Infinity;
  if (semester < uni.minSemester || semester > max) {
    let detail: string;
    if (uni.maxSemester === 0) detail = `${uni.name}: Tausch nur vor Studienbeginn möglich.`;
    else if (semester === 0) detail = `${uni.name}: Tausch vor Studienbeginn nicht möglich.`;
    else if (semester < uni.minSemester) detail = `${uni.name}: Tausch erst ab dem ${uni.minSemester}. Semester.`;
    else detail = `${uni.name}: Tausch nur bis zum ${uni.maxSemester}. Semester.`;
    return { label: 'Semestervoraussetzung nicht erfüllt', status: 'fail', detail };
  }
  return null;
}

/**
 * Evaluates whether the given participants can swap their places. `cycle[i]` moves to the
 * university of `cycle[i + 1]` (wrapping around), so a direct swap is a cycle of two.
 */
export function evaluateSwap(cycle: SwapRequest[], unis: UniMap, now: Date): CompatibilityCheck[] {
  const checks: CompatibilityCheck[] = [];
  const uniOf = (r: SwapRequest) => unis.get(r.currentUniversityId);
  const resolved = cycle.map(uniOf);
  if (resolved.some((u) => !u)) {
    return [{ label: 'Universität unbekannt', status: 'fail' }];
  }
  const universities = resolved as University[];

  const sameProgram = cycle.every((r) => r.program === cycle[0].program);
  checks.push({ label: 'Studiengang identisch', status: sameProgram ? 'ok' : 'fail' });

  const sameTerm = cycle.every((r) => r.desiredTerm === cycle[0].desiredTerm);
  checks.push({
    label: 'Wechselzeitpunkt identisch',
    status: sameTerm ? 'ok' : 'fail',
    detail: sameTerm ? cycle[0].desiredTerm : undefined,
  });

  // Fachsemester: practically all universities require the same Fachsemester.
  const semesters = cycle.map((r) => semesterAtSwap(r.semester, r.desiredTerm, now));
  const sameSemester = semesters.every((sem) => sem === semesters[0]);
  checks.push(
    sameSemester
      ? { label: 'Fachsemester identisch', status: 'ok', detail: semesterLabel(cycle[0].semester) }
      : {
          label: 'Fachsemester unterschiedlich',
          status: 'fail',
          detail: 'Die Universitäten verlangen beim Tausch das gleiche Fachsemester.',
        },
  );

  if (semesters.some((sem) => sem >= FIRST_CLINICAL_SEMESTER) && cycle.some((r) => !r.physikumPassed)) {
    checks.push({
      label: 'Physikum noch nicht bestanden',
      status: 'warn',
      detail: 'Für einen Tausch ins klinische Semester muss das Physikum bis zum Wechsel bestanden sein.',
    });
  }

  const samePlaceType = cycle.every((r) => r.placeType === cycle[0].placeType);
  checks.push({
    label: samePlaceType ? 'Art des Studienplatzes identisch' : 'Voll- und Teilstudienplatz',
    status: samePlaceType ? 'ok' : 'fail',
    detail: samePlaceType ? undefined : 'Ein Vollstudienplatz kann nur gegen einen Vollstudienplatz getauscht werden.',
  });

  const provisional = cycle.filter((r) => r.provisionalEnrollment).length;
  if (provisional > 0 && provisional < cycle.length) {
    checks.push({
      label: 'Vorläufige und endgültige Einschreibung',
      status: 'fail',
      detail: 'Vorläufige Studienplätze können nicht gegen endgültige getauscht werden.',
    });
  } else if (provisional > 0) {
    checks.push({
      label: 'Vorläufige Einschreibung',
      status: 'warn',
      detail: 'Viele Universitäten tauschen nur endgültig vergebene Plätze. Bitte vorab erfragen.',
    });
  }

  if (cycle.some((r) => r.semester === 0 && !r.admissionConfirmed)) {
    checks.push({
      label: 'Zulassung nicht bestätigt',
      status: 'fail',
      detail: 'Ein Tausch vor Studienbeginn ist erst mit bestätigtem Studienplatz möglich.',
    });
  }

  // University rules
  const ruleFailures: string[] = [];
  const ruleWarnings: CompatibilityCheck[] = [];
  cycle.forEach((request, i) => {
    const own = universities[i];
    const next = universities[(i + 1) % cycle.length];
    const semester = semesters[i];
    if (!own.swapPossible) ruleFailures.push(`${own.name}: Studienplatztausch nicht möglich.`);
    const modelIssue = modelProgramCheck(next, own, semester);
    if (modelIssue) ruleFailures.push(modelIssue);
    const semIssue = semesterRuleCheck(next, semester);
    if (semIssue?.status === 'fail') ruleFailures.push(semIssue.detail!);
    else if (semIssue && !ruleWarnings.some((w) => w.label === semIssue.label)) ruleWarnings.push(semIssue);
    const term = parseTerm(request.desiredTerm);
    if (term && next.allowedTerms !== 'both' && term.kind !== next.allowedTerms) {
      ruleFailures.push(
        `${next.name}: Tausch nur zum ${next.allowedTerms === 'WiSe' ? 'Wintersemester' : 'Sommersemester'}.`,
      );
    }
    const last = next.lastSwapTerm ? parseTerm(next.lastSwapTerm) : null;
    if (term && last && termsBetween(last, term) > 0) {
      ruleFailures.push(`${next.name}: Studienplatztausch nur noch bis ${next.lastSwapTerm}.`);
    }
    if (request.lawsuitPlace && own.excludesLawsuitPlaces) {
      ruleFailures.push(`${own.name}: Über eine Klage erhaltene Studienplätze sind vom Tausch ausgeschlossen.`);
    }
  });
  checks.push({
    label: ruleFailures.length ? 'Tausch laut Uni-Vorgaben nicht möglich' : 'Tausch grundsätzlich möglich',
    status: ruleFailures.length ? 'fail' : 'ok',
    detail: ruleFailures.join('\n') || undefined,
  });
  checks.push(...ruleWarnings);

  if (cycle.length > 2) {
    const ringIssues = universities.filter(
      (u) => u.ringSwap === 'no' || (u.ringSwapMax != null && u.ringSwapMax < cycle.length),
    );
    const ringUnknown = universities.filter((u) => u.ringSwap === 'unknown');
    if (ringIssues.length) {
      checks.push({
        label: 'Ringtausch nicht erlaubt',
        status: 'fail',
        detail: ringIssues.map((u) => u.name).join(', '),
      });
    } else if (ringUnknown.length) {
      checks.push({
        label: 'Ringtausch-Regel unbekannt',
        status: 'warn',
        detail: `Bitte erfragen bei: ${ringUnknown.map((u) => u.name).join(', ')}`,
      });
    } else {
      checks.push({ label: 'Ringtausch erlaubt', status: 'ok' });
    }
  }

  if (cycle.some((r) => r.lawsuitPlace)) {
    checks.push({
      label: 'Studienplatz über Klage',
      status: 'warn',
      detail: 'Tauschbarkeit von Klageplätzen bei den Universitäten erfragen.',
    });
  }
  const dean = universities.filter((u) => u.requiresDeanApproval);
  if (dean.length) {
    checks.push({
      label: 'Dekanatsgenehmigung erforderlich',
      status: 'warn',
      detail: dean.map((u) => u.name).join(', '),
    });
  }
  const online = universities.filter((u) => u.partnerMustApplyOnline);
  if (online.length) {
    checks.push({
      label: 'Zusätzliche Online-Bewerbung',
      status: 'warn',
      detail: `Der neue Studierende muss sich zusätzlich bewerben: ${online.map((u) => u.name).join(', ')}`,
    });
  }
  const achievement = universities.filter((u) => u.achievementNote);
  if (achievement.length) {
    checks.push({
      label: 'Leistungsstand wird geprüft',
      status: 'warn',
      detail: achievement.map((u) => `${u.name}: ${u.achievementNote}`).join('\n'),
    });
  }

  return checks;
}

function rank(request: SwapRequest, universityId: string): number {
  const index = request.targetUniversityIds.indexOf(universityId);
  return index === -1 ? Infinity : index + 1;
}

function wants(request: SwapRequest, universityId: string): boolean {
  return request.targetUniversityIds.includes(universityId);
}

function eligible(mine: SwapRequest, other: SwapRequest): boolean {
  return (
    other.status === 'active' &&
    other.userId !== mine.userId &&
    other.program === mine.program &&
    other.desiredTerm === mine.desiredTerm
  );
}

const compatibilityOrder: Record<Compatibility, number> = { compatible: 0, partial: 1, incompatible: 2 };

/**
 * Finds direct swap partners and – if the user allows it – three-way ring swaps.
 * Incompatible candidates are dropped unless `includeIncompatible` is set.
 */
export function findMatches(
  mine: SwapRequest,
  offers: Offer[],
  universities: University[],
  { now = new Date(), includeIncompatible = false } = {},
): Match[] {
  const unis = indexUniversities(universities);
  const pool = offers.filter((o) => eligible(mine, o));
  const matches: Match[] = [];

  for (const other of pool) {
    if (wants(mine, other.currentUniversityId) && wants(other, mine.currentUniversityId)) {
      const checks = evaluateSwap([mine, other], unis, now);
      matches.push({
        id: `d:${other.id}`,
        kind: 'direct',
        partners: [other],
        checks,
        compatibility: worst(checks),
        priority: rank(mine, other.currentUniversityId) + rank(other, mine.currentUniversityId),
      });
    }
  }

  if (mine.ringSwap) {
    const ringPool = pool.filter((o) => o.ringSwap);
    for (const a of ringPool) {
      // I move to A's university, A moves to B's, B moves to mine.
      if (!wants(mine, a.currentUniversityId) || a.currentUniversityId === mine.currentUniversityId) continue;
      for (const b of ringPool) {
        if (b.id === a.id || b.userId === a.userId) continue;
        const ids = new Set([mine.currentUniversityId, a.currentUniversityId, b.currentUniversityId]);
        if (ids.size < 3) continue;
        if (!wants(a, b.currentUniversityId) || !wants(b, mine.currentUniversityId)) continue;
        const checks = evaluateSwap([mine, a, b], unis, now);
        matches.push({
          id: `r:${a.id}:${b.id}`,
          kind: 'ring',
          partners: [a, b],
          checks,
          compatibility: worst(checks),
          priority:
            rank(mine, a.currentUniversityId) + rank(a, b.currentUniversityId) + rank(b, mine.currentUniversityId),
        });
      }
    }
  }

  return matches
    .filter((m) => includeIncompatible || m.compatibility !== 'incompatible')
    .sort(
      (x, y) =>
        compatibilityOrder[x.compatibility] - compatibilityOrder[y.compatibility] ||
        (x.kind === y.kind ? 0 : x.kind === 'direct' ? -1 : 1) ||
        x.priority - y.priority,
    );
}

export function findMatchById(
  id: string,
  mine: SwapRequest,
  offers: Offer[],
  universities: University[],
  now = new Date(),
): Match | undefined {
  return findMatches(mine, offers, universities, { now, includeIncompatible: true }).find((m) => m.id === id);
}
