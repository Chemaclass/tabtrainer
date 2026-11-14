import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

const forbidAll = (message) => (names) => names.map((name) => ({ name, message }));

function layer(files, folders, globalNames) {
  const patterns = [
    { regex: '(^|/)main(\\.ts)?$', message: 'main.ts is the composition root; nothing imports it.' },
    ...folders.map((folder) => ({
      regex: `(^|/)\\.\\./(\\.\\./)*${folder}(/|$)`,
      message: `This layer must not import from ${folder}.`,
    })),
  ];
  return {
    files: [files],
    rules: {
      'no-restricted-imports': ['error', { patterns }],
      'no-restricted-globals': ['error', ...forbidAll('Not available in this layer.')(globalNames)],
    },
  };
}

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
  layer('src/core/**/*.ts', ['app', 'ui', 'render', 'audio', 'build'], ['document', 'window']),
  layer('src/app/**/*.ts', ['ui', 'render', 'build'], ['document']),
  layer('src/ui/**/*.ts', [], []),
  { files: ['tests/**/*.ts', '*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
