const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// wjson transcripts are loaded via require() in audioRegistry.ts — treat them
// as source modules (inline JSON) rather than assets. This avoids an Android
// build error where foo.mp3 and foo.wjson land in raw/ with the same resource
// ID (Android strips extensions when generating resource names → collision).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'wjson'];

// Workaround for a Metro / expo-asset URL-encoding mismatch visible in
// the device log as:
//   ENOENT: no such file or directory, scandir
//   '/.../AllHereApp/.%2Fassets%2Faudio%2FPart0'
// expo-asset asks Metro for assets with `unstable_path` URL-encoded
// (e.g. `.%2Fassets%2Faudio%2FPart0%2Ffoo.mp3`), but Metro's asset
// server takes the value as a literal filename and joins it onto the
// project root → readdir on a path that doesn't exist. We intercept the
// request, decode the param, and rewrite the URL before Metro's own
// handler runs so the asset resolver sees an honest path. Native-only
// codepath — web bundles assets directly without going through Metro's
// HTTP asset resolver.
const previousEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = previousEnhance
    ? previousEnhance(middleware, server)
    : middleware;
  return (req, res, next) => {
    if (req && req.url && req.url.indexOf('unstable_path=') !== -1) {
      req.url = req.url.replace(
        /([?&]unstable_path=)([^&]+)/,
        (_, prefix, value) => {
          try {
            // Decode once → Metro's downstream asset code path expects
            // the value to be the actual relative file path, not a URL-
            // encoded form. We re-encode minimally so the URL is still
            // syntactically valid for any framework that re-parses it.
            const decoded = decodeURIComponent(value);
            return prefix + decoded.replace(/[#&?]/g, encodeURIComponent);
          } catch {
            return prefix + value;
          }
        },
      );
    }
    return enhanced(req, res, next);
  };
};

module.exports = config;
