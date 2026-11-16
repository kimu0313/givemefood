import { defineConfig } from "vite";

// base "./" = 빌드 결과(dist)를 아무 웹 서버 폴더에 올려도 그대로 열리게
export default defineConfig({
  base: "./",
  // 기본은 이 PC 에서만 접속. 같은 와이파이의 폰으로 보려면 `npm run dev -- --host`
  server: { port: 5173, strictPort: true },
  build: { target: "es2022", outDir: "dist", assetsInlineLimit: 0 },
});
