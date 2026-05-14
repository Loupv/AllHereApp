/**
 * Metro custom transformer for .wjson files.
 *
 * .wjson are JSON transcript files loaded via require() in audioRegistry.ts.
 * Adding them to Metro's sourceExts (instead of assetExts) prevents Android
 * from creating duplicate raw/ resource IDs for foo.mp3 + foo.wjson pairs.
 *
 * Metro's default Babel transformer tries to parse them as JS and chokes on
 * the raw JSON. This wrapper intercepts .wjson files, wraps their content as
 * `module.exports = <json>` so Metro bundles them as inline JS modules, and
 * delegates everything else to the default Expo Babel transformer.
 */

// @expo/metro-config lives under expo/node_modules locally (nested) but is
// hoisted to the top-level node_modules on CI / fresh installs. Try both.
function resolveExpoBabelTransformer() {
  const candidates = [
    'expo/node_modules/@expo/metro-config/build/babel-transformer',
    '@expo/metro-config/build/babel-transformer',
  ];
  for (const id of candidates) {
    try {
      return require.resolve(id, { paths: [__dirname] });
    } catch {
      // try the next one
    }
  }
  throw new Error(
    `wjson-transformer: cannot find @expo/metro-config babel-transformer ` +
      `(tried: ${candidates.join(', ')})`,
  );
}

const upstreamTransformer = require(resolveExpoBabelTransformer());

module.exports.transform = function (transformerOptions) {
  const { src, filename } = transformerOptions;
  if (filename.endsWith('.wjson')) {
    return upstreamTransformer.transform({
      ...transformerOptions,
      src: `module.exports = ${src};`,
      // Pretend it's a .js file so Babel doesn't try to parse it as JSON schema
      filename: filename.replace(/\.wjson$/, '.__wjson__.js'),
    });
  }
  return upstreamTransformer.transform(transformerOptions);
};
