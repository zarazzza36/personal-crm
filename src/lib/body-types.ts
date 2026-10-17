/** Truck body types, in the order the form offers them. */
export const bodyTypes = [
  "tent",
  "refrigerator",
  "isothermal",
  "van",
  "flatbed",
  "container_carrier",
  "dump_truck",
  "lowboy",
] as const;

export type BodyType = (typeof bodyTypes)[number];

export const bodyTypeLabels: Record<BodyType, string> = {
  tent: "Тент",
  refrigerator: "Рефрижератор",
  isothermal: "Изотерм",
  van: "Цельнометаллический фургон",
  flatbed: "Бортовой",
  container_carrier: "Контейнеровоз",
  dump_truck: "Самосвал",
  lowboy: "Трал",
};

// Other words logisticians use for the same body type.
const bodyTypeAliases: Partial<Record<BodyType, string[]>> = {
  refrigerator: ["реф", "рефка"],
  isothermal: ["изотерма"],
  van: ["цмф"],
  flatbed: ["борт"],
  container_carrier: ["контейнер"],
  lowboy: ["низкорамник"],
};

// Shorter words would match almost every body type while a name is being typed.
const MIN_WORD_LENGTH = 3;

/**
 * Body types a search word stands for: the word is a part of a name or an alias ("реф"),
 * or a longer form of one ("тентованный"). The word must be lowercase, with "ё" as "е".
 */
export function bodyTypesMatching(word: string): BodyType[] {
  if (word.length < MIN_WORD_LENGTH) return [];

  return bodyTypes.filter((type) =>
    [bodyTypeLabels[type], ...(bodyTypeAliases[type] ?? [])].some((name) => {
      const term = name.toLowerCase();
      return term.includes(word) || word.startsWith(term);
    }),
  );
}
