import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function Background({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
