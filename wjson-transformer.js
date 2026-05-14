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

const upstreamTransformer = require(
  require.resolve(
    'expo/node_modules/@expo/metro-config/build/babel-transformer',
    { paths: [__dirname] },
  )
);

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
