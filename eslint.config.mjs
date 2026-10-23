import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local dot-folders: execution notes and throwaway measuring scripts.
    ".*/**",
    // The Draco decoder and the Basis transcoder, copied as-is from three/examples (see blender/README.md).
    "public/draco/**",
    "public/basis/**",
  ]),
]);

export default eslintConfig;
