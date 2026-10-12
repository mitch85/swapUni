import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { backend } from '@/lib/backend';

import { Icon } from './ui';

/** Explains that data stays on this device while no Supabase project is configured. */
export function DemoBanner() {
  if (backend.mode !== 'demo') return null;
  return (
    <View style={styles.banner}>
      <Icon name="flask-outline" size={18} color={Colors.primary} />
      <Text style={styles.text}>
        Demo-Modus: Daten bleiben nur auf diesem Gerät. Registriere dich mit einer beliebigen E-Mail-Adresse.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primaryBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  text: { flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
});
