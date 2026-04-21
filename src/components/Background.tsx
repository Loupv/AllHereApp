import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function Background({ children, color }: { children: React.ReactNode; color?: string }) {
  return <View style={[styles.root, { backgroundColor: color ?? colors.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
