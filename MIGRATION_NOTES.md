# Migration Notes: Supabase -> Generic

One of the key requirements of this MVP is portability. The system is designed with specific "Adapters" that isolate the dependency on Supabase.

## Database (Postgres)

**Current**: Uses Supabase Postgres.
**Migration**: 
1. Use `pg_dump` to export your data from Supabase.
2. Restore into any PostgreSQL instance (AWS RDS, DigitalOcean, local Docker).
3. Update `DATABASE_URL` in `.env`.
4. The `PostgresAdapter` in `packages/adapters/src/db-postgres` uses standard SQL queries via `postgres.js`, so no code changes are required in the application logic.

## Auth

**Current**: Minimal implementation (Admin Secret / Mock).
**Migration**: Implement your own Auth provider (NextAuth.js, Clerk, or custom JWT) and update the `User` entity in `core`.

## Edge Functions (Deno) -> Node.js

**Current**: `supabase/functions/telegram-webhook` runs on Deno.
**Migration**:
1. Create a new Express/Fastify server or use Next.js API Routes.
2. Copy the logic from `supabase/functions/telegram-webhook/index.ts`.
3. Replace Deno-specific imports (`https://...`) with Node.js `npm` packages (`npm install postgres`).
4. Since `packages/core` is pure Typescript, you can import the same Use Cases directly in Node.js.

## Vector DB (pgvector)

**Current**: `pgvector` extension on Supabase.
**Migration**: Ensure your target Postgres instance has `pgvector` installed and enabled (`CREATE EXTENSION vector;`).

## File Storage (Optional)

**Current**: If using Supabase Storage for audio (not heavily used in MVP).
**Migration**: Switch to S3 or local file system by creating a `StoragePort` implementation in `packages/adapters`.
