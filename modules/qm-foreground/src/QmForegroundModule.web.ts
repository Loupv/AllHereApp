import { registerWebModule, NativeModule } from 'expo';

// Web stub — no lock screen / background-suspension problem on web.
class QmForegroundModule extends NativeModule {
  start(_title: string, _body: string): void {}
  stop(): void {}
}

export default registerWebModule(QmForegroundModule, 'QmForegroundModule');
