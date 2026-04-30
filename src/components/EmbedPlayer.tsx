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
  return (
    <View style={[{ width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' }, style]}>
      <WebView
        source={{ uri: src }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}
