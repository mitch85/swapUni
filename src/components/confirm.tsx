import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Font, Radius, Spacing } from '@/constants/theme';

import { Button } from './ui';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

let show: ((request: ConfirmRequest) => void) | null = null;

/** In-app confirmation dialog; works the same on iOS, Android and web. */
export function confirmAction(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) resolve(false);
    else show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  if (!request) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <View style={styles.dialog} accessibilityRole="alert">
        <Text style={Font.heading}>{request.title}</Text>
        <Text style={styles.message}>{request.message}</Text>
        <View style={styles.actions}>
          <Button small variant="secondary" title="Abbrechen" onPress={() => close(false)} style={styles.flex} />
          <Button
            small
            variant={request.destructive ? 'danger' : 'primary'}
            title={request.confirmLabel ?? 'Bestätigen'}
            onPress={() => close(true)}
            style={styles.flex}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  dialog: { width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  message: { fontSize: 15, color: Colors.textSecondary, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
});
