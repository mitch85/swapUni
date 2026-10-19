import { Text } from 'react-native';

import { Font } from '@/constants/theme';
import { backend } from '@/lib/backend';

import { Button, EmptyState, Screen } from './ui';

/** Shown instead of the app when an admin has blocked the account. */
export function BlockedScreen() {
  return (
    <Screen>
      <EmptyState
        icon="lock-closed-outline"
        title="Dein Konto ist gesperrt"
        text="Dein Konto wurde wegen eines Verstoßes gegen die Nutzungsbedingungen gesperrt, zum Beispiel wegen eines Geldangebots für einen Tausch. Dein Tauschgesuch ist nicht mehr sichtbar.">
        <Text style={Font.small}>Bei Fragen wende dich an das SwapUni-Team.</Text>
      </EmptyState>
      <Button variant="secondary" title="Abmelden" icon="log-out-outline" onPress={() => backend.signOut()} />
    </Screen>
  );
}
