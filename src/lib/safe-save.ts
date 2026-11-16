import "server-only";

// Database errors can contain SQL parameters and nested driver errors with user data.
export async function safeSave<T>(
  operation: "contact" | "note" | "group",
  save: () => Promise<T>,
): Promise<T> {
  try {
    return await save();
  } catch {
    // Do not attach the original error as a cause: Next.js logs uncaught errors.
    throw new Error(`Failed to save ${operation}`);
  }
}
