// Local Expo module: a generic Android foreground service that keeps
// the process alive (so the QM custom bell-timer + react-native-
// background-timer keep running) while the screen is locked, WITHOUT
// expo-audio's media-player notification (which showed a looping 2 s
// progress bar). Shows a plain "QM Training — séance en cours"
// notification instead. iOS / web are no-ops — iOS stays awake via the
// silent-loop + UIBackgroundModes:["audio"], web has no lock.
export { default } from './src/QmForegroundModule';
