import { db } from "@/db";
import { users } from "@/db/schema";

export const TEST_USER_ID = "default-test-user";

export async function makeTestUser() {
  await db
    .insert(users)
    .values({ id: TEST_USER_ID, name: "", email: "test@example.com" })
    .onConflictDoNothing();
}
