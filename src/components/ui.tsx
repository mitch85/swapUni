import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, Font, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = Colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Page container: safe area, optional scrolling, centered with a max width on large screens. */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  footer,
  contentStyle,
  background = Colors.background,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
}) {
  const inner = <View style={[styles.screenInner, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{inner}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  small = false,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const palette = buttonPalette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        inactive && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: Colors.primary, fg: '#FFFFFF', border: Colors.primary },
  secondary: { bg: Colors.surface, fg: Colors.primary, border: Colors.border },
  ghost: { bg: 'transparent', fg: Colors.primary, border: 'transparent' },
  danger: { bg: Colors.surface, fg: Colors.danger, border: Colors.border },
  success: { bg: Colors.success, fg: '#FFFFFF', border: Colors.success },
};

export function TextField({
  label,
  icon,
  error,
  secure = false,
  right,
  ...props
}: TextInputProps & { label?: string; icon?: IconName; error?: string; secure?: boolean; right?: ReactNode }) {
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, focused && styles.inputFocused, !!error && styles.inputError]}>
        {icon ? <Icon name={icon} size={18} color={Colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {secure ? (
          <Pressable
            accessibilityLabel={hidden ? 'Passwort anzeigen' : 'Passwort verbergen'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, subtitle, center }: { children: ReactNode; subtitle?: string; center?: boolean }) {
  return (
    <View style={[styles.titleBlock, center && styles.center]}>
      <Text style={[Font.title, center && styles.textCenter]}>{children}</Text>
      {subtitle ? <Text style={[styles.subtitle, center && styles.textCenter]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={Font.subheading}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.row}>
          <Text style={styles.link}>{action}</Text>
          <Icon name="chevron-forward" size={14} color={Colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Selectable list row used for universities, terms and other options. */
export function OptionRow({
  label,
  description,
  selected,
  onPress,
  icon,
  badge,
  multi = false,
  disabled = false,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  badge?: string;
  multi?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {icon ? <Icon name={icon} size={20} color={selected ? Colors.primary : Colors.textSecondary} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.optionLabel, selected && { color: Colors.primary }]}>{label}</Text>
        {description ? <Text style={Font.small}>{description}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{badge}</Text>
        </View>
      ) : null}
      {selected ? (
        <Icon name="checkmark-circle" size={22} color={Colors.primary} />
      ) : (
        <View style={[styles.emptyCheck, multi && { borderRadius: 6 }]} />
      )}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text style={Font.body}>{label}</Text>
        {description ? <Text style={Font.small}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.success, false: Colors.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const toneColors: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: Colors.successSoft, fg: Colors.success },
  warning: { bg: Colors.warningSoft, fg: Colors.warning },
  danger: { bg: Colors.dangerSoft, fg: Colors.danger },
  info: { bg: Colors.primarySoft, fg: Colors.primary },
  neutral: { bg: '#F1F5F9', fg: Colors.textSecondary },
};

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={12} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const avatarColors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9', '#14B8A6'];

export function Avatar({ name, seed, size = 48 }: { name: string; seed: string; size?: number }) {
  const hash = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const color = avatarColors[hash % avatarColors.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color, fontWeight: '700', fontSize: size * 0.36 }}>{initials || '?'}</Text>
    </View>
  );
}

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progress} accessibilityLabel={`Schritt ${step + 1} von ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={styles.progressItem}>
          {i > 0 ? <View style={[styles.progressLine, i <= step && styles.progressDone]} /> : null}
          <View style={[styles.progressDot, i <= step && styles.progressDone]} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={Colors.primary} />
      </View>
      <Text style={[Font.subheading, styles.textCenter]}>{title}</Text>
      {text ? <Text style={[Font.small, styles.textCenter]}>{text}</Text> : null}
      {children}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={Font.small}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.infoValue}>{value}</Text> : value}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Icon name="alert-circle" size={18} color={Colors.danger} />
      <Text style={[styles.errorText, styles.flex]}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screenInner: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  button: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonSmall: { minHeight: 38, borderRadius: Radius.sm, paddingHorizontal: Spacing.md },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSmall: { fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 50,
  },
  inputFocused: { borderColor: Colors.primary },
  inputError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: Spacing.md, outlineStyle: 'none' } as never,
  errorText: { color: Colors.danger, fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.dangerSoft,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  titleBlock: { gap: 6 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 21 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  optionLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  emptyCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.border },
  rankBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rankText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: Radius.md,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: Radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  progressLine: { width: 28, height: 2, backgroundColor: Colors.border },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.border },
  progressDone: { backgroundColor: Colors.primary },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border },
});
