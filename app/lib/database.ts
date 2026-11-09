import "server-only";

import { Pool } from "pg";

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseConfigurationError(
      "Set DATABASE_URL to your PostgreSQL connection string to load dashboard data.",
    );
  }

  if (!globalForPostgres.postgresPool) {
    const parsedUrl = new URL(connectionString);
    if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
      throw new DatabaseConfigurationError(
        "DATABASE_URL must use the postgres:// or postgresql:// protocol.",
      );
    }
    globalForPostgres.postgresPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  return globalForPostgres.postgresPool;
}
