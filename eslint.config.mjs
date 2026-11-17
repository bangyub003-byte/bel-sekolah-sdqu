import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'api/**/*', 'server.ts'],
  },
  {
    files: ['**/*.rules'],
    ...firebaseRulesPlugin.configs['flat/recommended'],
  },
];
