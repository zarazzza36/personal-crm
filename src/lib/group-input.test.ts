import { describe, expect, it } from "vitest";

import {
  contactGroupsInputSchema,
  groupIdSchema,
  groupNameKey,
  groupNameSchema,
} from "./group-input";

describe("groupNameSchema", () => {
  it("takes a name and drops the spaces around it", () => {
    expect(groupNameSchema.parse("  Теннис  ")).toBe("Теннис");
  });

  it("keeps the spaces inside the name", () => {
    expect(groupNameSchema.parse("Большой  теннис")).toBe("Большой  теннис");
  });

  // Scenario "Пустое название"
  it.each(["", "   ", "\t\n"])("asks for a name when it is empty: %j", (input) => {
    const result = groupNameSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Укажите название группы");
  });

  it("accepts a name of exactly 50 characters", () => {
    expect(groupNameSchema.parse("а".repeat(50))).toBe("а".repeat(50));
  });

  // Scenario "Слишком длинное название"
  it("refuses a name of 51 characters", () => {
    const result = groupNameSchema.safeParse("а".repeat(51));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Не длиннее 50 символов");
  });

  it("counts the length without the spaces around the name", () => {
    expect(groupNameSchema.safeParse(` ${"а".repeat(50)} `).success).toBe(true);
  });
});

describe("groupNameKey", () => {
  it("gives the same key to names that differ only by case", () => {
    expect(groupNameKey("Теннис")).toBe(groupNameKey("теннис"));
    expect(groupNameKey("ТЕННИС")).toBe(groupNameKey("теннис"));
  });

  it("lowers the case of capital Ё", () => {
    expect(groupNameKey("Ёлки")).toBe("ёлки");
  });

  it("gives different keys to different names", () => {
    expect(groupNameKey("Теннис")).not.toBe(groupNameKey("Большой теннис"));
  });
});

describe("groupIdSchema", () => {
  it("takes a whole positive number", () => {
    expect(groupIdSchema.parse(12)).toBe(12);
  });

  it.each([0, -1, 1.5, "3", null, undefined])("refuses %j", (input) => {
    expect(groupIdSchema.safeParse(input).success).toBe(false);
  });
});

describe("contactGroupsInputSchema", () => {
  it("takes the checked groups and the names of the new ones", () => {
    expect(
      contactGroupsInputSchema.parse({
        groupIds: [3, 5],
        newGroupNames: ["  Аналитики ", "Теннис"],
      }),
    ).toEqual({ groupIds: [3, 5], newGroupNames: ["Аналитики", "Теннис"] });
  });

  it("takes no groups at all", () => {
    expect(contactGroupsInputSchema.parse({ groupIds: [], newGroupNames: [] })).toEqual({
      groupIds: [],
      newGroupNames: [],
    });
  });

  it("points at the new name that is wrong", () => {
    const result = contactGroupsInputSchema.safeParse({
      groupIds: [],
      newGroupNames: ["Теннис", "   "],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Укажите название группы");
    expect(result.error?.issues[0].path).toEqual(["newGroupNames", 1]);
  });

  it("refuses a new name over 50 characters", () => {
    const result = contactGroupsInputSchema.safeParse({
      groupIds: [],
      newGroupNames: ["а".repeat(51)],
    });

    expect(result.error?.issues[0].message).toBe("Не длиннее 50 символов");
  });

  it("refuses an id that is not a whole positive number", () => {
    const refused = (groupIds: unknown[]) =>
      contactGroupsInputSchema.safeParse({ groupIds, newGroupNames: [] }).success === false;

    expect(refused([0])).toBe(true);
    expect(refused(["3"])).toBe(true);
    expect(refused([1.5])).toBe(true);
  });
});
