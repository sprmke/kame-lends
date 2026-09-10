import { defineConfig } from "@neon/config/v1";

// Project link: Kame Lends (Singapore). Auth stays Auth.js, not Neon Auth / Better Auth.
export default defineConfig({
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
