import { registerWebModule, NativeModule } from 'expo';

// Web stub — the AVSampleBufferDisplayLayer pipeline is iOS-only.
// Callers on web should fall back to <Image> or a regular <video>;
// this module is registered with no surface so imports don't error.
class EarthVideoModule extends NativeModule {}

export default registerWebModule(EarthVideoModule, 'EarthVideoModule');
