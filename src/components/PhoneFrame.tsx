import { Platform, View, useWindowDimensions, StyleSheet } from 'react-native';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const shouldFrame = Platform.OS === 'web' && width >= 700;

  if (!shouldFrame) {
    return <View style={styles.fullscreen}>{children}</View>;
  }

  // Scale to fit viewport height while keeping the phone aspect ratio
  const available = Math.min(height - 40, 900);
  const scale = available / PHONE_HEIGHT;
  const frameWidth = PHONE_WIDTH;
  const frameHeight = PHONE_HEIGHT;

  return (
    <View style={styles.stage}>
      <View
        style={[
          styles.phone,
          {
            width: frameWidth,
            height: frameHeight,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.notch} />
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05060b',
    backgroundImage: 'radial-gradient(circle at 50% 50%, #11132a 0%, #050610 60%)' as any,
    overflow: 'hidden',
  },
  phone: {
    borderRadius: 48,
    backgroundColor: '#0A0B13',
    padding: 10,
    borderColor: '#1f2232',
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
  },
  notch: {
    position: 'absolute',
    top: 18,
    left: '50%',
    width: 100,
    height: 26,
    marginLeft: -50,
    backgroundColor: '#000',
    borderRadius: 14,
    zIndex: 5,
  },
  screen: {
    flex: 1,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#00102E',
    paddingTop: 32,
  },
});
