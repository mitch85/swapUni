import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/** Two universities (blue and green dot) connected by a swap curve. */
export function LogoMark({ size = 64, framed = true }: { size?: number; framed?: boolean }) {
  const mark = (
    <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="swap" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={Colors.primary} />
          <Stop offset="1" stopColor={Colors.success} />
        </LinearGradient>
      </Defs>
      <Path
        d="M18 62 C 30 78, 42 70, 50 50 C 58 30, 70 22, 84 36"
        stroke="url(#swap)"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={18} cy={54} r={12} fill={Colors.primary} />
      <Circle cx={82} cy={50} r={12} fill={Colors.success} />
    </Svg>
  );
  if (!framed) return mark;
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size * 0.22 }]}>{mark}</View>
  );
}

export function Wordmark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <Text style={[styles.word, { fontSize: size, color: light ? '#FFFFFF' : Colors.navy }]}>
      Swap<Text style={{ color: Colors.primary }}>Uni</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  word: { fontWeight: '800', letterSpacing: -1 },
});
