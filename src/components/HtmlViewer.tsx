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

const sanitize = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/ on[a-z]+="[^"]*"/gi, '') // strip inline event handlers
    .replace(/ on[a-z]+='[^']*'/gi, '');

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
