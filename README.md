# SwapUni – Studienplatztausch Medizin

App für **iOS, Android und Web**, mit der Studierende der Human- und Zahnmedizin ihren Studienplatz innerhalb Deutschlands tauschen können: Tauschgesuch anlegen, passende Partner (direkt oder per Ringtausch) finden, Uni-Voraussetzungen vorprüfen, chatten und erfolgreiche Tausche abschließen.

Gebaut mit **Expo (React Native, SDK 57) + Expo Router** und **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions).

## Funktionen

Aktuell nur Humanmedizin; Zahnmedizin, Tiermedizin und Pharmazie sind vorbereitet (`ENABLED_PROGRAMS` in `src/components/request-fields.tsx`) und folgen, sobald ihre Uni-Regeln vorliegen.

| Anforderung | Umsetzung |
| --- | --- |
| Registrierung mit E-Mail, Passwort, eigenem Benutzernamen | `src/app/(auth)/*`, Supabase Auth mit E-Mail-Bestätigung, Benutzername eindeutig |
| Abfrage Studiengang, aktuelle Uni, Wunschunis (1–3, priorisiert), Fachsemester, Ringtausch | Onboarding in 5 Schritten (`src/app/onboarding.tsx`), später änderbar (`src/app/request.tsx`) |
| Tausch auch vor Studienbeginn – nur mit bestätigtem Studienplatz | Fachsemester „Vor Studienbeginn“ + Bestätigung der Zulassung; Unis ohne Tausch vor Studienbeginn werden berücksichtigt |
| Tauschpartner ermitteln | Direkte Tausche und Ringtausche zu dritt (`src/lib/matching.ts`) |
| Voraussetzungen der Unis einbeziehen | Vorprüfung je Match: gleiches Fachsemester, Semesterregeln, Wechsel nur zum WiSe/SoSe, Tauschende einer Uni, vorläufige Einschreibung, Leistungsstand, Modellstudiengang, Ringtausch-Erlaubnis, Klageplätze, Voll-/Teilstudienplatz, Dekanatsgenehmigung, Online-Bewerbung |
| Kontakte der Unis (Formulare, Studienbüro) | `src/app/universities/*` mit Fristen, Tauschformularen, Links, E-Mail und Telefon |
| Tausch-Checkliste nach dem Match | Im Chat: Formulare, Unterschriften, Einreichung, Genehmigung, Einschreibung – jeder hakt seine Schritte ab, ohne Prüfung durch die App |
| Erfolgreiche Vermittlungen kennzeichnen und aus dem Pool löschen | „Tausch erfolgreich“ im Match; das Gesuch verschwindet aus dem Pool, es bleibt nur eine anonyme Statistik |
| Push bei neuem passendem Partner und bei Chat-Nachrichten | Edge Function `supabase/functions/notify` + Expo Push |
| Favoriten, Chat, Übersicht Matches / alle Angebote | Tab „Tauschen“ (Matches, Alle Angebote, Favoriten), Tab „Nachrichten“ mit Realtime-Chat, Gruppenchat bei Ringtausch |
| Hochladen von Studienbescheinigungen | Profil → Nachweis hochladen (privater Storage-Bucket); Freigabe durch Admin → Badge „Verifiziert“ |
| Uni-Vorgaben schnell anpassbar | Regeln liegen in der Tabelle `universities` und sind im Supabase-Dashboard änderbar, ohne App-Update |
| Datenschutz | Siehe [Datenschutz & Sicherheit](#datenschutz--sicherheit) |

## Schnellstart (Demo-Modus, ohne Backend)

```bash
npm install
npm run web        # oder: npm run ios / npm run android
```

Ohne Supabase-Zugangsdaten läuft die App im **Demo-Modus**. Die Daten liegen dann nur lokal auf dem Gerät, und es gibt simulierte Studierende, Matches und Chat-Antworten. Damit lässt sich die App sofort ausprobieren.

## Produktivbetrieb mit Supabase

1. Ein Projekt auf [supabase.com](https://supabase.com) anlegen (Region EU, z. B. Frankfurt).
2. Schema und Uni-Daten einspielen:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push                         # supabase/migrations/*
   psql "<connection-string>" -f supabase/seed.sql
   ```
   Alternativ beide SQL-Dateien im SQL Editor des Dashboards ausführen.
3. `.env.example` nach `.env` kopieren und `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` eintragen.
4. Unter **Authentication → URL Configuration** die Web-URL sowie `swapuni://` als Redirect-URL eintragen.

### Push-Benachrichtigungen

1. Ein EAS-Projekt anlegen: `npx eas-cli@latest init` (trägt die `projectId` in `app.json` ein).
2. Die Funktion deployen und ein Webhook-Secret setzen:
   ```bash
   npx supabase functions deploy notify --no-verify-jwt
   npx supabase secrets set NOTIFY_WEBHOOK_SECRET=<zufälliger-wert>
   ```
3. Unter **Database → Webhooks** zwei Webhooks auf die Funktion `notify` anlegen, jeweils mit dem Header `x-webhook-secret: <zufälliger-wert>`:
   - Tabelle `messages`, Ereignis `INSERT`
   - Tabelle `swap_requests`, Ereignisse `INSERT` und `UPDATE`

Push funktioniert nur in echten App-Builds (Development Build oder Store-Build), nicht im Web und nicht in Expo Go.

### Weitere Server-Funktionen

```bash
npx supabase functions deploy delete-account          # Konto löschen inkl. Nachweise
npx supabase functions deploy verification-cleanup --no-verify-jwt
npx supabase functions deploy maintenance --no-verify-jwt
```

- **verification-cleanup:** einen weiteren Webhook anlegen (Tabelle `profiles`, Ereignis `UPDATE`, gleicher Header). Sobald ein Nachweis auf `verified` oder `rejected` gesetzt wird, wird die Datei gelöscht.
- **maintenance:** einmal täglich aufrufen, z. B. mit `pg_cron` und `pg_net` (Extensions im Dashboard aktivieren):
  ```sql
  select cron.schedule('swapuni-maintenance', '0 3 * * *', $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/maintenance',
      headers := '{"x-webhook-secret": "<zufälliger-wert>"}'::jsonb
    );
  $$);
  ```
  Die Funktion pausiert Gesuche nach einem Jahr Inaktivität, erinnert zwei Wochen vorher per Push und löscht abgeschlossene Gesuche sechs Wochen nach dem erfolgreichen Tausch.
- **Erinnerung per E-Mail (optional):** mit einem Konto bei [Resend](https://resend.com) die Secrets `RESEND_API_KEY` und `MAIL_FROM` (z. B. `SwapUni <hallo@swapuni.de>`) setzen. Ohne diese Secrets gibt es nur die Push-Erinnerung.

### Builds für die Stores

```bash
npx eas-cli@latest build --profile development --platform ios   # Dev-Build zum Testen
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
npm run build:web     # statische Web-App in dist/ (z. B. für Vercel/Netlify, SPA-Fallback auf index.html)
```

## Uni-Voraussetzungen pflegen

- **Schnell, ohne App-Update:** Im Supabase-Dashboard unter *Table Editor → universities* die Werte ändern. Die App lädt die Regeln beim Start neu.
- **Dauerhaft im Repo:** `src/data/universities.json` bearbeiten (Quelle: *Übersichtsplan Unis*), dann `npm run seed:generate` ausführen und `supabase/seed.sql` erneut einspielen. Bestehende Einträge werden dabei aktualisiert.

Bedeutung der Felder: `minSemester`/`maxSemester` gelten für das Semester zum Wechselzeitpunkt (0 = vor Studienbeginn, `null` = unbekannt, die App zeigt dann einen Hinweis). Weitere Felder sind `ringSwap` (`yes`/`no`/`unknown`), `ringSwapMax`, `modelProgram`, `swapWithModel`, `swapWithRegular`, `regularSwapMinSemester`, `requiresExactSemester`, `requiresDeanApproval`, `excludesLawsuitPlaces`, `partnerMustApplyOnline`, Fristen, `forms`, Kontaktdaten und `notes`.

### Korrekturen gegenüber der Tabelle (Recherche Oktober 2026)

- **Tübingen:** Tausch ab dem 2. Fachsemester ([Uni Tübingen](https://uni-tuebingen.de/de/960)), kein Ringtausch.
- **TU München:** ergänzt; gleiches Semester, Frist bis zum ersten Vorlesungstag, Ringtausch-Formular ([TUM](https://www.tum.de/studium/bewerbung/medizin/medizinplatztausch/)).
- **TU Dresden:** Tausch nur zum Wintersemester, Leistungsstand mind. 80 % ([TU Dresden](https://tu-dresden.de/med/mf/studium/bedingungen-und-antragsverfahren-studienplatztausch-mf-tud)).
- **Hamburg:** Tausch nur noch bis WiSe 2026/27 ([Uni Hamburg](https://www.uni-hamburg.de/campuscenter/bewerbung/fachwechsel-ortswechsel/studienplatztausch)).

Neue Regelfelder: `allowedTerms` (`both`/`WiSe`/`SoSe`), `lastSwapTerm` (letztes Semester mit Tausch) und `achievementNote` (geforderter Leistungsstand). Das gleiche Fachsemester ist jetzt Pflicht. Vorläufige Plätze werden nicht mit endgültigen gematcht.

Nach Rückmeldung der Auftraggeberin (Oktober 2026) zusätzlich: TU München erst ab dem Physikum, Halle ab dem 1. Fachsemester (Frist bis eine Woche nach Vorlesungsbeginn, kein Ringtausch), Ulm ab dem 2. Fachsemester (kein Ringtausch), Links für Augsburg und Greifswald ergänzt, Dortmund entfernt.

### Noch offen

- **Lausitz (Cottbus):** kommt in die Liste, sobald die Tauschregeln bekannt sind.
- Telefonnummern und Ansprechpersonen der Studienbüros liefert die Auftraggeberin nach. Das Feld `contactPhone` ist vorbereitet.
- Die Regeln sollen zweimal jährlich vor Beginn der Fristphasen geprüft werden.

Meldungen über veraltete Angaben („Angabe falsch oder veraltet?“ auf jeder Uni-Seite) landen in der Tabelle `university_reports`.

## Datenschutz & Sicherheit

- Datenbank und Dateien werden bei Supabase verschlüsselt gespeichert (AES-256), alle Verbindungen laufen über TLS. Das Hosting ist in der EU wählbar.
- Die Anmeldung wird auf iOS und Android im Keychain bzw. Android Keystore gespeichert (`expo-secure-store`).
- Row Level Security auf allen Tabellen:
  - Andere Nutzer sehen nur Vorname, Initiale des Nachnamens, Benutzername, Verifizierungsstatus und das aktive Gesuch.
  - E-Mail-Adresse und vollständiger Name bleiben privat.
  - Chats sind nur für die Teilnehmenden lesbar.
  - Nachweise liegen in einem privaten Bucket.
  - Nutzer können sich nicht selbst verifizieren.
- Konto löschen (DSGVO) entfernt Profil, Gesuch, Chats und Nachweise sofort und vollständig.
- Nachweise werden direkt nach der Prüfung gelöscht. Sie sind nur für das SwapUni-Team sichtbar.
- Abgeschlossene Gesuche werden sechs Wochen nach dem erfolgreichen Tausch gelöscht; es bleibt nur eine anonyme Zählung.
- Gesuche von Nutzern, die ein Jahr nicht aktiv waren, werden pausiert (Erinnerung zwei Wochen vorher).
- Es werden keine Daten an Dritte weitergegeben, und es gibt keine Analytics- oder Werbe-SDKs.

**Offen vor dem Launch:**
- Eigene Datenschutzerklärung und AGB (über `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` setzen) und ein Impressum.
- Ein Auftragsverarbeitungsvertrag (AVV) mit Supabase.
- Chat-Nachrichten sind serverseitig verschlüsselt, aber nicht Ende-zu-Ende (so gewünscht).

## Verifizierung (Admin)

- **Nachweise prüfen:** Dateien liegen unter *Storage → verifications*. Nach der Prüfung in *Table Editor → profiles* den Wert `verification_status` auf `verified` oder `rejected` setzen; die Datei wird danach automatisch gelöscht. Ziel: Prüfung innerhalb von zwei Werktagen.
- **Meldungen:** Profilmeldungen landen in `reports`, Hinweise auf veraltete Uni-Daten in `university_reports`.
- **Sperren:** Bei Geldangeboten oder anderen Verstößen in `profiles` das Feld `blocked_at` auf das aktuelle Datum setzen. Das Gesuch verschwindet aus dem Pool, Chatten ist nicht mehr möglich, die App zeigt einen Sperrhinweis. Zum Entsperren das Feld leeren.
- **Statistik:** `select * from admin_stats;` im SQL Editor zeigt anonyme Kennzahlen (Nutzer, aktive Gesuche, erfolgreiche Tausche, offene Prüfungen, Meldungen).

## Werbung

Die App ist kostenlos und enthält aktuell keine Werbung. Falls später Werbung gewünscht ist, kann z. B. `react-native-google-mobile-ads` ergänzt werden. Das erfordert eine Einwilligungsabfrage (Consent) und eine Anpassung der Datenschutzerklärung.

## Entwicklung

```bash
npm test             # Matching- und Regel-Tests
npm run typecheck
npx eslint .
```

Projektstruktur:

```
src/app/              Screens (Expo Router)
src/components/       UI-Bausteine im SwapUni-Design
src/lib/matching.ts   Matching & Regelprüfung
src/lib/backend/      Supabase- und Demo-Backend hinter gemeinsamer Schnittstelle
src/data/             Uni-Regeln (aus dem Übersichtsplan)
supabase/             Migrationen, Seed, Edge Function
```
