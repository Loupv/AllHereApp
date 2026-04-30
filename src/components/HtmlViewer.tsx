import { Platform, View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { createElement, Fragment } from 'react';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  html: string;
  /** Canonical URL of the original article (used on native where we can't render HTML) */
  link?: string;
};

// ---- text-only fallback (native) ---------------------------------------

const decodeEntities = (s: string) =>
  s.replace(/&#8217;/g, '’')
   .replace(/&#8216;/g, '‘')
   .replace(/&#8220;/g, '“')
   .replace(/&#8221;/g, '”')
   .replace(/&#8211;/g, '–')
   .replace(/&#8212;/g, '—')
   .replace(/&#038;/g, '&')
   .replace(/&amp;/g, '&')
   .replace(/&nbsp;/g, ' ')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"')
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

const stripHtml = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

const htmlToParagraphs = (html: string): string[] => {
  const ps = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map(m => stripHtml(m[1]));
  const cleaned = ps.filter(Boolean);
  if (cleaned.length) return cleaned;
  const single = stripHtml(html);
  return single ? [single] : [];
};

// ---- light sanitizer ---------------------------------------------------
// WP rarely outputs <script> but we strip them just in case. Everything
// else (iframes, images, links, headings) renders as-is on web.

/**
 * The Forum Radio (and similar) WP posts ship a custom audio widget:
 * a wrapping <div class="podcast-player-wrap"> with hand-rolled
 * play/seek/mute buttons, an inline <style> block, and an inline
 * <script> that wires the buttons to an <audio> element holding the
 * Buzzsprout MP3. Our sanitize step strips the <script>, leaving
 * the buttons inert and the page with what looks like a broken
 * player. Replace the whole widget with a clean <audio controls>
 * element pointing at the same MP3 — the browser's native player
 * works without JS and is consistent across Spotify / Apple /
 * Buzzsprout-only posts where this widget is the source of truth.
 */
const rewriteCustomAudioWidget = (html: string): string => {
  const start = html.search(/<div\s+class="(?:list-img[^"]*|podcast-player-wrap)/i);
  if (start < 0) return html;
  const tail = html.slice(start);
  const srcMatch = tail.match(/<source\s+src="([^"]+\.mp3[^"]*)"\s+type="audio\/mpeg"/i);
  if (!srcMatch) return html;
  const src = srcMatch[1];
  // Find the end of the widget block — typically `</script></div>` (the
  // wrapper div closes after the inline script). Match the inline JS
  // closer plus any number of immediately-following </div> tags so we
  // don't leave a dangling wrapper open.
  const closer = tail.match(/<\/script>(\s*<\/div>)*/i);
  if (!closer) return html;
  const end = start + (closer.index ?? 0) + closer[0].length;
  const replacement = `<audio src="${src}" controls preload="metadata" style="width:100%;display:block;margin:16px 0;border-radius:10px"></audio>`;
  return html.slice(0, start) + replacement + html.slice(end);
};

const sanitize = (html: string) => {
  const lifted = rewriteCustomAudioWidget(html);
  return (
    lifted
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/ on[a-z]+="[^"]*"/gi, '') // strip inline event handlers
      .replace(/ on[a-z]+='[^']*'/gi, '')
      // Strip srcset / sizes / lazy-loading attributes on <img>: WP
      // generates srcset entries for tiny variants (e.g. 18w) that the
      // browser may pick when our CSS forces width:100%, leaving the
      // image effectively invisible — and rocket-lazyload's
      // loading="lazy" + data-lazy-src kept podcast-platform badges
      // (Apple/Spotify/Deezer/Buzzsprout) from ever loading on the
      // detail page. Force browsers to use just the canonical `src`.
      .replace(/\s+srcset=("[^"]*"|'[^']*')/gi, '')
      .replace(/\s+sizes=("[^"]*"|'[^']*')/gi, '')
      .replace(/\s+loading=("[^"]*"|'[^']*')/gi, '')
      .replace(/\s+data-lazy-src=("[^"]*"|'[^']*')/gi, '')
      .replace(/\s+data-lazy-srcset=("[^"]*"|'[^']*')/gi, '')
  );
};

// ---- component ---------------------------------------------------------

export function HtmlViewer({ html, link }: Props) {
  if (Platform.OS === 'web') {
    // React Native Web forwards unknown components to the DOM, so we render
    // via createElement('div') with dangerouslySetInnerHTML. A companion
    // <style> scopes images / iframes to the container so they don't
    // blow out the phone frame.
    return createElement(
      Fragment,
      null,
      createElement('style', { key: 's' }, SCOPED_CSS),
      createElement('div', {
        key: 'd',
        className: 'ah-html',
        dangerouslySetInnerHTML: { __html: sanitize(html) },
      }),
    );
  }

  // Native fallback: text paragraphs + Read on allhere.org
  const paragraphs = htmlToParagraphs(html);
  return (
    <View>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.paragraph}>{p}</Text>
      ))}
      {link ? (
        <Pressable onPress={() => Linking.openURL(link).catch(() => {})} hitSlop={8} style={styles.readMoreBtn}>
          <Text style={styles.readMore}>Read on allhere.org →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    ...type.body, color: colors.textMuted,
    marginBottom: spacing.md, lineHeight: 24, maxWidth: 620,
  },
  readMoreBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
  },
  readMore: { ...type.caption, color: colors.accent },
});

// Keep remote HTML constrained: images + iframes fluid, text color muted
// to match the app, links use the accent color.
const SCOPED_CSS = `
.ah-html { color: #c8cedd; font-family: Montserrat, system-ui, sans-serif; font-size: 15px; line-height: 1.6; padding: 0 16px; }
.ah-html p { margin: 0 0 16px; color: #c8cedd; }
.ah-html b, .ah-html strong { color: #fff; }
.ah-html h1, .ah-html h2, .ah-html h3 { color: #fff; font-family: inherit; margin: 24px 0 12px; }
.ah-html a { color: #e88b88; text-decoration: underline; }
.ah-html img, .ah-html iframe, .ah-html video {
  max-width: 100%; width: 100%; height: auto; border-radius: 10px; display: block; margin: 16px 0; border: 0;
}
.ah-html iframe { aspect-ratio: 16 / 9; height: auto; }
/* Podcast-platform badges (Apple Podcasts / Spotify / Buzzsprout /
   Deezer) live inside <div class="podcast-img"> on allhere.org. They're
   icon-sized (175×75) — letting our generic img rule stretch them to
   100% looks ridiculous and hides them entirely on some browsers when
   the srcset 18w variant is picked. Render them at natural size,
   inline, with a small gap. */
.ah-html .podcast-img { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; align-items: center; }
.ah-html .podcast-img a { display: inline-block; line-height: 0; }
.ah-html .podcast-img img { width: auto; max-width: 175px; height: auto; margin: 0; border-radius: 6px; display: inline-block; }
/* Native <audio> element (the rewritten Forum Radio / Buzzsprout
   player) — dark-glass background that matches the rest of the app. */
.ah-html audio { width: 100%; display: block; margin: 16px 0; border-radius: 10px; background: rgba(255,255,255,0.04); }
.ah-html ul, .ah-html ol { padding-left: 20px; }
.ah-html figure { margin: 16px 0; }
.ah-html figcaption { font-size: 12px; color: #8a93a6; text-align: center; margin-top: 6px; }
.ah-html blockquote { border-left: 3px solid #e88b88; padding-left: 12px; margin: 16px 0; color: #c8cedd; font-style: italic; }
/* Force any font/color the CMS hardcoded to be readable on our dark bg */
.ah-html [style*="color"] { color: inherit !important; }
.ah-html [style*="font-family"] { font-family: inherit !important; }
.ah-html [style*="font-size"] { font-size: inherit !important; }
.ah-html [style*="background"] { background: transparent !important; }
`;
