import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

import { LogoMark, Wordmark } from './logo';

export function Splash() {
  return (
    <View style={styles.container} accessibilityLabel="SwapUni wird geladen">
      <View style={styles.center}>
        <LogoMark size={120} />
        <Wordmark size={44} light />
        <Text style={styles.tagline}>Der Weg zu deiner Wunschuniversität</Text>
      </View>
      <View style={styles.bottom}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.loading}>Verbinde Universitäten…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.splash, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', gap: 20 },
  tagline: { color: '#CBD5E1', fontSize: 17 },
  bottom: { position: 'absolute', bottom: 72, alignItems: 'center', gap: 12 },
  loading: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
});
