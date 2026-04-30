// Dynamic Expo config — Expo CLI auto-merges this on top of app.json so
// every static value still lives in app.json. The only thing we add here
// is `experiments.baseUrl`, gated behind WEB_BUILD=1.
//
// Why conditional? GitHub Pages serves the web build at
// https://loupv.github.io/AllHereApp/, so web asset URLs need an
// /AllHereApp/ prefix. But setting baseUrl unconditionally also leaks
// that prefix into the native asset-copy step (`expo export:embed`)
// during the EAS Xcode bundle phase — it then tries to mkdir
// AllHereApp.app/AllHereApp/assets/..., which collides with the
// AllHereApp executable file inside the .app bundle and fails the build.
//
// `npm run build:web` sets WEB_BUILD=1 so the env var is only present in
// the GitHub Actions web pipeline; EAS native builds and local dev see
// no env var → no baseUrl → no path collision.
module.exports = ({ config }) => {
  const isWebBuild = process.env.WEB_BUILD === '1';
  return {
    ...config,
    experiments: {
      ...(config.experiments ?? {}),
      ...(isWebBuild ? { baseUrl: '/AllHereApp' } : {}),
    },
  };
};
