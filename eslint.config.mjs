import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 暂时关闭any类型警告
      "@typescript-eslint/no-unused-vars": "off", // 暂时关闭未使用变量警告
      "@next/next/no-img-element": "warn", // 降级为警告
      "react-hooks/exhaustive-deps": "warn", // 降级为警告
    },
  },
];

export default eslintConfig;
