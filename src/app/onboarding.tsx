import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MAX_WISHES,
  PROGRAMS,
  SemesterStepper,
  UniversityList,
  toggleWish,
} from '@/components/request-fields';
import { Button, ErrorText, Icon, OptionRow, ProgressDots, Screen, SegmentedControl, Title, ToggleRow } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { upcomingTerms } from '@/lib/terms';
import type { PlaceType, Program } from '@/lib/types';

const STEPS = 5;

export default function OnboardingScreen() {
  const { universities, setMyRequest, refresh, universityById } = useApp();
  const terms = useMemo(() => upcomingTerms(new Date()), []);
  const [step, setStep] = useState(0);
  const [program, setProgram] = useState<Program>('humanmedizin');
  const [current, setCurrent] = useState<string | null>(null);
  const [wishes, setWishes] = useState<string[]>([]);
  const [semester, setSemester] = useState(1);
  const [placeType, setPlaceType] = useState<PlaceType>('full');
  const [lawsuitPlace, setLawsuitPlace] = useState(false);
  const [provisionalEnrollment, setProvisionalEnrollment] = useState(false);
  const [admissionConfirmed, setAdmissionConfirmed] = useState(false);
  const [term, setTerm] = useState(terms[0]);
  const [ringSwap, setRingSwap] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canContinue = [
    true,
    !!current,
    wishes.length > 0,
    semester > 0 || admissionConfirmed,
    !!term,
  ][step];

  async function finish() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const request = await backend.saveMyRequest({
        program,
        currentUniversityId: current,
        targetUniversityIds: wishes,
        semester,
        placeType,
        lawsuitPlace,
        provisionalEnrollment,
        admissionConfirmed: semester > 0 || admissionConfirmed,
        desiredTerm: term,
        ringSwap,
      });
      await refresh();
      setMyRequest(request);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const next = () => (step === STEPS - 1 ? finish() : setStep((s) => s + 1));
  const currentUni = current ? universityById(current) : undefined;

  return (
    <Screen
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button
            title={step === STEPS - 1 ? 'Tauschprofil erstellen' : 'Weiter'}
            onPress={next}
            disabled={!canContinue}
            loading={saving}
          />
        </>
      }>
      <View style={styles.top}>
        {step > 0 ? (
          <Pressable accessibilityLabel="Zurück" onPress={() => setStep((s) => s - 1)} hitSlop={10}>
            <Icon name="arrow-back" size={24} />
          </Pressable>
        ) : (
          <Pressable onPress={() => backend.signOut()} hitSlop={10}>
            <Text style={styles.link}>Abmelden</Text>
          </Pressable>
        )}
        <ProgressDots step={step} total={STEPS} />
        <View style={styles.spacer} />
      </View>

      {step === 0 ? (
        <>
          <Title center subtitle="Wähle deinen Studiengang aus.">
            Was studierst du?
          </Title>
          {PROGRAMS.map((p) => (
            <OptionRow
              key={p.value}
              icon="medkit-outline"
              label={p.label}
              selected={program === p.value}
              onPress={() => setProgram(p.value)}
            />
          ))}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Title center subtitle="Wähle deine aktuelle Universität – oder die, an der du zugelassen bist.">
            Wo studierst du aktuell?
          </Title>
          <UniversityList
            universities={universities}
            selected={current ? [current] : []}
            onToggle={(id) => {
              setCurrent(id);
              setWishes((w) => w.filter((x) => x !== id));
            }}
          />
          {currentUni && !currentUni.swapPossible ? (
            <ErrorText>{`${currentUni.name} erlaubt keinen Studienplatztausch.`}</ErrorText>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Title center subtitle={`Wähle bis zu ${MAX_WISHES} Wunschuniversitäten – in der Reihenfolge deiner Priorität.`}>
            Wo möchtest du studieren?
          </Title>
          <UniversityList
            multi
            universities={universities}
            selected={wishes}
            exclude={current ?? undefined}
            onToggle={(id) => setWishes((w) => toggleWish(w, id))}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Title center subtitle="Wähle dein aktuelles Fachsemester.">
            In welchem Fachsemester bist du?
          </Title>
          <SemesterStepper value={semester} onChange={setSemester} />
          {semester === 0 ? (
            <OptionRow
              multi
              icon="document-text-outline"
              label="Mein Studienplatz ist bestätigt"
              description="Ein Tausch vor Studienbeginn ist nur mit Zulassungsbescheid möglich."
              selected={admissionConfirmed}
              onPress={() => setAdmissionConfirmed((v) => !v)}
            />
          ) : null}
          <Text style={[Font.subheading, styles.question]}>Art deines Studienplatzes</Text>
          <SegmentedControl
            value={placeType}
            onChange={setPlaceType}
            options={[
              { value: 'full', label: 'Vollstudienplatz' },
              { value: 'partial', label: 'Teilstudienplatz' },
            ]}
          />
          <ToggleRow
            label="Studienplatz über eine Klage erhalten"
            description="Manche Universitäten schließen Klageplätze vom Tausch aus."
            value={lawsuitPlace}
            onChange={setLawsuitPlace}
          />
          <ToggleRow
            label="Nur vorläufig eingeschrieben"
            description="Vorläufige Plätze lassen sich nicht gegen endgültige tauschen."
            value={provisionalEnrollment}
            onChange={setProvisionalEnrollment}
          />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Title center subtitle="Wähle den gewünschten Wechselzeitpunkt.">
            Wann möchtest du wechseln?
          </Title>
          {terms.map((t) => (
            <OptionRow key={t} label={t} selected={term === t} onPress={() => setTerm(t)} icon="calendar-outline" />
          ))}
          <Text style={[Font.body, styles.question]}>Dürfen wir auch nach Ringtauschmöglichkeiten suchen?</Text>
          <Text style={Font.small}>Beim Ringtausch tauschen drei Studierende reihum ihre Plätze.</Text>
          <SegmentedControl
            value={ringSwap ? 'yes' : 'no'}
            onChange={(v) => setRingSwap(v === 'yes')}
            options={[
              { value: 'yes', label: 'Ja' },
              { value: 'no', label: 'Nein' },
            ]}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  spacer: { width: 72 },
  link: { color: Colors.primary, fontWeight: '600', width: 72 },
  question: { marginTop: Spacing.md },
});
