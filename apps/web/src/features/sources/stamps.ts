export interface StampToken {
  type: "stamp";
  raw: string;
  seconds: number;
}

export interface TextToken {
  type: "text";
  text: string;
}

export type StampChunk = StampToken | TextToken;

/**
 * Parses a timestamp string into seconds.
 * Supports:
 * - "M:SS" or "MM:SS" (e.g., "0:15", "01:30", "12:45")
 * - "H:MM:SS" or "HH:MM:SS" (e.g., "1:02:15", "01:02:15")
 *
 * Rejects:
 * - Malformed patterns like "1:2", "99:99", negative times, non-digits.
 */
export function parseStamp(stamp: string | null | undefined): number | null {
  if (!stamp) return null;
  const trimmed = stamp.trim();
  if (!trimmed) return null;

  // Pattern: optional 1-2 digit hours, then 1-2 digit minutes, then strictly 2 digit seconds
  const match = trimmed.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hoursStr = match[1];
  const minsStr = match[2];
  const secsStr = match[3];

  if (!minsStr || !secsStr) return null;

  const seconds = parseInt(secsStr, 10);
  const minutes = parseInt(minsStr, 10);
  const hours = hoursStr ? parseInt(hoursStr, 10) : 0;

  // Seconds must be in [0, 59]
  if (seconds < 0 || seconds >= 60) return null;

  // If hours are specified, minutes must be in [0, 59]
  // If hours are not specified, minutes can exceed 59 in edge cases, but standard MM:SS requires minutes < 60
  if (minutes < 0 || minutes >= 60) return null;

  if (hours < 0) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats a duration in seconds into "MM:SS" or "H:MM:SS".
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";

  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const secStr = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    const minStr = minutes.toString().padStart(2, "0");
    return `${hours}:${minStr}:${secStr}`;
  }

  return `${minutes}:${secStr}`;
}

/**
 * Splits arbitrary text into alternating text chunks and valid timestamp tokens.
 */
export function splitStamps(text: string | null | undefined): StampChunk[] {
  if (!text) return [];

  const chunks: StampChunk[] = [];
  // Regex finding timestamp candidates: e.g. 0:15, 01:23, 1:05:30
  const candidateRegex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = candidateRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = candidateRegex.lastIndex;
    const raw = match[0];

    // Check if the preceding character is alphanumeric or invalid delimiter (e.g. part of a word or malformed ratio)
    if (matchStart > 0 && /\w/.test(text[matchStart - 1] ?? "")) {
      continue;
    }
    // Check if following character is alphanumeric
    if (matchEnd < text.length && /\w/.test(text[matchEnd] ?? "")) {
      continue;
    }

    const seconds = parseStamp(raw);
    if (seconds !== null) {
      // Append preceding plain text if any
      if (matchStart > lastIndex) {
        chunks.push({
          type: "text",
          text: text.slice(lastIndex, matchStart),
        });
      }

      chunks.push({
        type: "stamp",
        raw,
        seconds,
      });

      lastIndex = matchEnd;
    }
  }

  // Append remaining text
  if (lastIndex < text.length) {
    chunks.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return chunks;
}
