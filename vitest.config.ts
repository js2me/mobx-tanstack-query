import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";


export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: 'istanbul', // or 'v8'
      include: ['src'],
      exclude: ['src/preset'],
      reporter: [
        'text',
        'text-summary',
        'html'
      ],
      reportsDirectory: './coverage'
    },
  },
});