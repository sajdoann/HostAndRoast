import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The rules suite shares one Firestore emulator — keep files sequential.
    fileParallelism: false,
  },
});
