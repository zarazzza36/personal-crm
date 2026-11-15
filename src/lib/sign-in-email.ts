import { z } from "zod";

export const signInEmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
