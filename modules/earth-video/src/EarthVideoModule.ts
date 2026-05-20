import { NativeModule, requireNativeModule } from 'expo';

declare class EarthVideoModule extends NativeModule {}

// This call loads the native module object from the JSI. The module
// only exposes a View — there are no JS-callable functions or
// constants, so the class is empty.
export default requireNativeModule<EarthVideoModule>('EarthVideo');
