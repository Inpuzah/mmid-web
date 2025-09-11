// eslint.config.mjs (flat config for ESLint v9+)
import next from 'eslint-config-next';

export default [
  // Ignore folders/files:
  { ignores: ['node_modules/**', '.next/**', 'src/scripts/**'] },

  // Next.js recommended config (includes TS rules):
  ...next(),

  // (Optional) if you ever lint CJS scripts under src/scripts, allow require():
  {
    files: ['src/scripts/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
