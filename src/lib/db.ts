import { PostgresAdapter } from "@jarvis/adapters";

// Singleton-ish for server-side
export const db = new PostgresAdapter(
    process.env.DATABASE_URL || ''
);
