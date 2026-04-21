/*
 * Placeholder until `prisma generate` writes the real Prisma Client to this directory.
 * The generated client output path is configured in `prisma/schema.prisma`.
 */

export class PrismaClient {
  [key: string]: any;

  constructor(_options?: unknown) {}

  async $connect(): Promise<void> {}

  async $disconnect(): Promise<void> {}

  async $transaction<T>(
    input: ((tx: PrismaClient) => Promise<T>) | Promise<T>[],
  ): Promise<T | unknown[]> {
    if (typeof input === "function") {
      return input(this);
    }

    return Promise.all(input);
  }
}

export namespace Prisma {
  export type TransactionClient = PrismaClient;
  export type JsonObject = Record<string, unknown>;
  export type JsonArray = Array<unknown>;
  export type JsonValue =
    | string
    | number
    | boolean
    | JsonObject
    | JsonArray
    | null;
}
