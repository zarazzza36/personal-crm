/** How often to talk to a contact, in the order the form offers them. */
export const contactFrequencies = ["week", "month", "quarter", "year"] as const;

export type ContactFrequency = (typeof contactFrequencies)[number];

export const contactFrequencyLabels: Record<ContactFrequency, string> = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

/** The note "Пообщались" saves: the countdown restarts from it as from any note. */
export const TALKED_NOTE_BODY = "Пообщались";

/** A contact it is time to talk to, as a row of "Пора связаться". */
export type DueContact = {
  id: number;
  name: string;
  contactFrequency: ContactFrequency;
  /** Null when there are no notes yet. */
  daysSinceLastNote: number | null;
};
