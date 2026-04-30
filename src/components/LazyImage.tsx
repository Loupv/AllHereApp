import { createElement } from 'react';
import { Image, Platform, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  alt?: string;
};

/**
 * RN Image that opts in to native browser lazy loading on web. Without
 * this, the Media tab grid kicks off a parallel fetch for every poster
 * the moment it mounts — even cards offscreen — which on a phone with
 * 10+ items + 100-200 KB each PNG is ~1-2 MB downloaded before anything
 * is interactive. <img loading="lazy"> defers offscreen fetches until
 * the user scrolls them into view.
 *
 * On native (iOS/Android) we just delegate to the standard RN Image
 * component — there's no equivalent attribute, but the slow-grid issue
 * is also less visible there because the device has direct caching.
 */
export function LazyImage({ source, style, resizeMode = 'cover', alt }: Props) {
  if (Platform.OS === 'web') {
    let uri: string | undefined;
    if (typeof source === 'object' && source !== null && 'uri' in source) {
      uri = (source as { uri?: string }).uri;
    } else if (typeof source === 'number') {
      // Static asset (require()) — RN Web resolves via the asset
      // registry. We let RN's Image handle these so the Metro asset
      // pipeline still applies; lazy-loading is mostly a win for the
      // remote WP posters anyway.
      return <Image source={source} style={style} resizeMode={resizeMode} />;
    }
    if (!uri) return <Image source={source} style={style} resizeMode={resizeMode} />;
    return createElement('img', {
      src: uri,
      loading: 'lazy',
      decoding: 'async',
      alt: alt ?? '',
      style: { ...(style as any), objectFit: resizeMode },
    });
  }
  return <Image source={source} style={style} resizeMode={resizeMode} />;
}
