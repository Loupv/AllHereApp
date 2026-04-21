export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

export type TranscriptCue = {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
};

const timeToSec = (t: string): number => {
  const [h, m, rest] = t.split(':');
  const [s, ms] = rest.replace(',', '.').split('.');
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + (ms ? Number(ms) / 1000 : 0);
};

const interpolateWords = (text: string, start: number, end: number): TranscriptWord[] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);
  const duration = Math.max(0.001, end - start);
  let cursor = start;
  const words: TranscriptWord[] = [];
  for (const token of tokens) {
    const weight = Math.max(1, token.length) / totalChars;
    const wStart = cursor;
    const wEnd = Math.min(end, cursor + duration * weight);
    words.push({ text: token, start: wStart, end: wEnd });
    cursor = wEnd;
  }
  return words;
};

const TERMINAL_PUNCT = /[.?!…]$/;
const SENTENCE_GAP_SEC = 1.5;

const splitTrailingPunct = (s: string): [string, string] => {
  const m = s.match(/^(.*?)([.,!?…]*)$/);
  return m ? [m[1], m[2]] : [s, ''];
};

const PAIR_FIXES: Record<string, [string, string]> = {
  'all hears': ['All', "Here's"],
  'all here': ['All', 'Here'],
};

const TOKEN_FIXES: Record<string, string> = {
  'allhere': 'All Here',
};

const applyCorrections = (words: TranscriptWord[]): TranscriptWord[] => {
  const out: TranscriptWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = { ...words[i] };

    // Merge leading-hyphen tokens: previous + "-body" -> "previous-body"
    if (/^-\S/.test(w.text) && out.length > 0) {
      const prev = out[out.length - 1];
      const [prevCore, prevPunct] = splitTrailingPunct(prev.text);
      prev.text = prevCore + w.text + prevPunct;
      prev.end = w.end;
      continue;
    }
    // Merge dangling trailing-hyphen previous + next: "six-" "week" -> "six-week"
    if (out.length > 0 && /\S-$/.test(out[out.length - 1].text)) {
      const prev = out[out.length - 1];
      prev.text = prev.text + w.text;
      prev.end = w.end;
      continue;
    }

    // 2-word phrase substitutions
    const next = words[i + 1];
    if (next) {
      const [cCore] = splitTrailingPunct(w.text.toLowerCase());
      const [nCore, nPunct] = splitTrailingPunct(next.text.toLowerCase());
      const key = `${cCore} ${nCore}`;
      const sub = PAIR_FIXES[key];
      if (sub) {
        out.push({ text: sub[0], start: w.start, end: w.end });
        out.push({ text: sub[1] + nPunct, start: next.start, end: next.end });
        i++;
        continue;
      }
    }

    // Single-token substitutions
    const [core, punct] = splitTrailingPunct(w.text.toLowerCase());
    const single = TOKEN_FIXES[core];
    if (single) {
      w.text = single + punct;
    }

    out.push(w);
  }
  return out;
};

const rebuildBySentence = (words: TranscriptWord[]): TranscriptCue[] => {
  const cues: TranscriptCue[] = [];
  let bucket: TranscriptWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.text) continue;
    bucket.push(w);
    const next = words[i + 1];
    const endsSentence = TERMINAL_PUNCT.test(w.text);
    const gap = next ? next.start - w.end : 0;
    const bigPause = next ? gap >= SENTENCE_GAP_SEC : false;
    const isLast = i === words.length - 1;
    if (endsSentence || bigPause || isLast) {
      if (bucket.length > 0) {
        cues.push({
          start: bucket[0].start,
          end: bucket[bucket.length - 1].end,
          text: bucket.map(x => x.text).join(' '),
          words: bucket,
        });
        bucket = [];
      }
    }
  }
  return cues;
};

export const parseSRT = (raw: string): TranscriptCue[] => {
  const blocks = raw.replace(/\r\n/g, '\n').split(/\n\n+/);
  const allWords: TranscriptWord[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const match = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{1,3})/);
    if (!match) continue;
    const start = timeToSec(match[1]);
    const end = timeToSec(match[2]);
    const textLines = lines.filter(l => l !== timeLine && !/^\d+$/.test(l));
    const text = textLines.join(' ').trim();
    if (!text) continue;
    allWords.push(...interpolateWords(text, start, end));
  }
  return rebuildBySentence(applyCorrections(allWords));
};

export type WhisperJsonSegment = {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
};
export type WhisperJson = { segments: WhisperJsonSegment[] };

export const parseWhisperJson = (raw: string): TranscriptCue[] => {
  const data: WhisperJson = JSON.parse(raw);
  const allWords: TranscriptWord[] = [];
  for (const seg of data.segments) {
    if (seg.words && seg.words.length) {
      for (const w of seg.words) {
        const text = w.word.trim();
        if (text) allWords.push({ text, start: w.start, end: w.end });
      }
    } else {
      const text = seg.text.trim();
      if (text) allWords.push(...interpolateWords(text, seg.start, seg.end));
    }
  }
  return rebuildBySentence(applyCorrections(allWords));
};

export const findCueIndex = (cues: TranscriptCue[], t: number): number => {
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t <= cues[i].end) return i;
    if (t < cues[i].start) return Math.max(0, i - 1);
  }
  return cues.length - 1;
};

export const findWordIndex = (words: TranscriptWord[], t: number): number => {
  if (words.length === 0) return -1;
  let lo = 0, hi = words.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
};
