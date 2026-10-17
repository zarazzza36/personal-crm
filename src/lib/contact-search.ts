/** Bounds a value must stay within; both ends are included, `null` means no bound. */
export type Range = { min: number | null; max: number | null };

export type ContactSearch = {
  /** Words to find in the name or the body type: lowercase, with "ё" as "е". */
  words: string[];
  tons: Range | null;
  cubicMeters: Range | null;
};

// Search ignores letter case and treats "ё" and "е" as the same letter.
export function normalizeForSearch(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
// "т", "т.", "тн", "тонна", "тонны", "тонн"; "куб", "куба", "кубов", "кубометров", "м3", "м³"
const UNIT = String.raw`(т(?:онн[аыуе]?|н)?\.?|куб(?:ометр(?:а|ов)?|а|ов|ы)?|м3|м³)`;
// Unicode-aware word edges: \b only knows Latin letters.
const START = String.raw`(?<![\p{L}\d])`;
const END = String.raw`(?![\p{L}\d])`;

// "от 5 до 10 тонн"
const RANGE = new RegExp(
  String.raw`${START}от\s*${NUMBER}\s*до\s*${NUMBER}\s*${UNIT}${END}`,
  "gu",
);
// "5 т", "от 5 тонн", "до 40 м3", "5+ т", "5 тонн и больше", "82 куба и меньше"
const AMOUNT = new RegExp(
  String.raw`${START}(?:(от|не менее|не меньше|до|не более|не больше)\s*)?${NUMBER}\s*(\+)?\s*${UNIT}${END}` +
    String.raw`(?:\s*(\+|и\s+(?:больше|более|меньше|менее)${END}))?`,
  "gu",
);

const AT_LEAST = ["от", "не менее", "не меньше"];

// Words that only name what is being looked for: "вместимость 5 тонн", "кузов тент".
const FILLER_WORD_STARTS = ["вместимост", "грузоподъемност", "объем", "кузов"];

/**
 * Splits a search query into words and capacity bounds:
 * "тент от 5 тонн" means a tent body and at least 5 tons.
 */
export function parseContactSearch(query: string): ContactSearch {
  let rest = normalizeForSearch(query);
  let tons: Range | null = null;
  let cubicMeters: Range | null = null;

  const add = (unit: string, bounds: Range) => {
    if (unit.startsWith("т")) {
      tons = intersect(tons, bounds);
    } else {
      cubicMeters = intersect(cubicMeters, bounds);
    }
  };

  rest = rest.replace(RANGE, (_match, from: string, to: string, unit: string) => {
    add(unit, { min: toNumber(from), max: toNumber(to) });
    return " ";
  });

  rest = rest.replace(AMOUNT, (_match, ...groups: (string | undefined)[]) => {
    const [prefix, amount = "", plus, unit = "", suffix = ""] = groups;
    const value = toNumber(amount);

    if (prefix !== undefined) {
      add(unit, AT_LEAST.includes(prefix) ? { min: value, max: null } : { min: null, max: value });
    } else if (plus !== undefined || suffix === "+" || /больше|более/.test(suffix)) {
      add(unit, { min: value, max: null });
    } else if (/меньше|менее/.test(suffix)) {
      add(unit, { min: null, max: value });
    } else {
      add(unit, { min: value, max: value });
    }
    return " ";
  });

  const words = rest
    .split(/\s+/)
    // "тент, от 5 тонн": punctuation around a word is not a part of it.
    .map((word) => word.replace(/^[\p{P}]+|[\p{P}]+$/gu, ""))
    .filter((word) => word && !FILLER_WORD_STARTS.some((start) => word.startsWith(start)));

  return { words, tons, cubicMeters };
}

function toNumber(value: string) {
  return Number(value.replace(",", "."));
}

/** Values within both ranges. */
function intersect(range: Range | null, bounds: Range): Range {
  return {
    min: higher(range?.min ?? null, bounds.min),
    max: lower(range?.max ?? null, bounds.max),
  };
}

function higher(a: number | null, b: number | null) {
  return a === null ? b : b === null ? a : Math.max(a, b);
}

function lower(a: number | null, b: number | null) {
  return a === null ? b : b === null ? a : Math.min(a, b);
}
