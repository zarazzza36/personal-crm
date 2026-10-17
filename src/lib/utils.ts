import { createCn } from "cn/config";

// The app's own design tokens from src/app/globals.css. Without them merging takes
// `text-13` for a text color and drops it next to `text-ink`.
export const cn = createCn({
  extend: {
    theme: {
      text: ["11", "13", "15", "22", "26", "28", "32"],
      leading: ["h1"],
      tracking: ["heading", "logo", "label"],
      radius: ["3", "10", "14", "16", "18"],
      shadow: ["card", "card-lg", "hard"],
      container: ["landing"],
    },
  },
});
