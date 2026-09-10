import type { Session as AuthSession } from "@auth/core/types";

declare global {
  namespace App {
    interface Locals {
      auth(): Promise<AuthSession | null>;
      /** Resolved once per request in hooks.server.ts. */
      session: AuthSession | null;
    }
    interface Session {
      user?: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        role?: "admin" | "investor" | string;
      };
    }
  }
}

export {};
