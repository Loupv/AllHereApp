import { NativeModule, requireNativeModule } from 'expo';

declare class QmForegroundModule extends NativeModule {
  /** Start the foreground service with a plain notification. */
  start(title: string, body: string): void;
  /** Stop the foreground service + dismiss the notification. */
  stop(): void;
}

export default requireNativeModule<QmForegroundModule>('QmForeground');
