/**
 * EmbedPlayer — renders a YouTube/Vimeo (or any iframe) embed responsively.
 * On web: a real <iframe>. On native: a WebView with autoplay-friendly
 * source attributes. Always 16:9 aspect ratio so the layout stays stable
 * before the embed loads.
 */
import { createElement } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  src: string;
  style?: ViewStyle;
};

export function EmbedPlayer({ src, style }: Props) {
  if (Platform.OS === 'web') {
    return createElement('iframe', {
      src,
      style: { width: '100%', aspectRatio: '16 / 9', height: 'auto', border: 0, display: 'block' },
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowFullScreen: true,
    });
  }
  // Native: wrap in a local HTML page so YouTube's embed sees a valid
  // origin/referrer. Loading youtube.com/embed/<id> directly in a WKWebView
  // returns "Video unavailable / error 153" because the embed script checks
  // window.parent against an allowlist that empty/about:blank origins fail.
  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <style>
      html,body{margin:0;padding:0;background:#000;height:100%;width:100%;overflow:hidden}
      iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
    </style>
  </head><body>
    <iframe src="${src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
  </body></html>`;

  return (
    <View style={[{ width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <WebView
        source={{ html, baseUrl: 'https://allhere.org' }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}
