import { View, Image, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

const LOGO = require('../../assets/images/allhere-logo.png');

export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 110, height: 36 },
  right: { position: 'absolute', right: spacing.lg, top: 10 },
});
