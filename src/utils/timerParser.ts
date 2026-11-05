export interface DetectedTimer {
  minutes: number;
  seconds: number;
  label: string;
  rawText: string;
}

export interface TextSegment {
  text: string;
  timer?: DetectedTimer;
}

/**
 * Parses time expressions from Swedish recipe steps (e.g. "9 minuter", "15-20 min", "1,5 timme", "45 sekunder")
 */
export function detectTimersInText(text: string): DetectedTimer[] {
  if (!text) return [];

  const results: DetectedTimer[] = [];

  // 1. Range minutes/hours: "15-20 minuter", "1-2 timmar"
  const rangeRegex = /(\d+)\s*(?:-|–|till)\s*(\d+)\s*(minuter|minut|min|timmar|timme|tim|h|sekunder|sekund|sek)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = rangeRegex.exec(text)) !== null) {
    const minVal = parseInt(match[1], 10);
    const maxVal = parseInt(match[2], 10);
    const unit = match[3].toLowerCase();

    let minutes = minVal; // default to first number in range for timers
    let seconds = minutes * 60;

    if (unit.startsWith('tim') || unit === 'h') {
      minutes = minVal * 60;
      seconds = minutes * 60;
    } else if (unit.startsWith('sek')) {
      minutes = Math.max(1, Math.round(minVal / 60));
      seconds = minVal;
    }

    if (minutes > 0 && minutes <= 720) {
      results.push({
        minutes,
        seconds,
        label: `${minVal}-${maxVal} ${unit}`,
        rawText: match[0],
      });
    }
  }

  // 2. Single duration: "9 minuter", "1,5 timmar", "45 min"
  const singleRegex = /(\d+(?:[.,]\d+)?)\s*(minuter|minut|min|timmar|timme|tim|h|sekunder|sekund|sek)\b/gi;
  while ((match = singleRegex.exec(text)) !== null) {
    // Avoid double matching if part of range already matched
    const isInsideRange = results.some((r) => r.rawText.includes(match![0]));
    if (isInsideRange) continue;

    const num = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();

    let minutes = num;
    let seconds = Math.round(num * 60);

    if (unit.startsWith('tim') || unit === 'h') {
      minutes = Math.round(num * 60);
      seconds = minutes * 60;
    } else if (unit.startsWith('sek')) {
      minutes = Math.max(1, Math.round(num / 60));
      seconds = Math.round(num);
    }

    if (minutes > 0 && minutes <= 720) {
      results.push({
        minutes,
        seconds,
        label: `${match[1]} ${unit}`,
        rawText: match[0],
      });
    }
  }

  // 3. Special Swedish phrases: "en kvart", "en halvtimme", "en timme"
  const specialPhrases = [
    { phrase: /en\s+kvart/gi, minutes: 15, label: '15 min (en kvart)' },
    { phrase: /en\s+halvtimme/gi, minutes: 30, label: '30 min (en halvtimme)' },
    { phrase: /en\s+timme/gi, minutes: 60, label: '60 min (en timme)' },
    { phrase: /ett\s+par\s+minuter/gi, minutes: 2, label: '2 min (ett par minuter)' },
  ];

  for (const sp of specialPhrases) {
    let spMatch: RegExpExecArray | null;
    while ((spMatch = sp.phrase.exec(text)) !== null) {
      results.push({
        minutes: sp.minutes,
        seconds: sp.minutes * 60,
        label: sp.label,
        rawText: spMatch[0],
      });
    }
  }

  return results;
}

/**
 * Splits text into clickable segments so duration words can be rendered as interactive timer buttons
 */
export function splitTextIntoTimerSegments(text: string): TextSegment[] {
  const timers = detectTimersInText(text);
  if (timers.length === 0) {
    return [{ text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Sort timers by their appearance position in the text
  const occurrences: Array<{ start: number; end: number; timer: DetectedTimer }> = [];

  for (const timer of timers) {
    let searchPos = 0;
    while (true) {
      const idx = text.indexOf(timer.rawText, searchPos);
      if (idx === -1) break;
      // Check collision
      const collides = occurrences.some(
        (o) => (idx >= o.start && idx < o.end) || (idx + timer.rawText.length > o.start && idx + timer.rawText.length <= o.end)
      );
      if (!collides) {
        occurrences.push({
          start: idx,
          end: idx + timer.rawText.length,
          timer,
        });
      }
      searchPos = idx + timer.rawText.length;
    }
  }

  occurrences.sort((a, b) => a.start - b.start);

  for (const occ of occurrences) {
    if (occ.start > lastIndex) {
      segments.push({ text: text.substring(lastIndex, occ.start) });
    }
    segments.push({
      text: occ.timer.rawText,
      timer: occ.timer,
    });
    lastIndex = occ.end;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex) });
  }

  return segments;
}
