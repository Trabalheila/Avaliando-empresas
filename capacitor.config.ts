import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trabalheila.app',
  appName: 'Trabalhei La',
  webDir: 'build',
  server: {
    url: 'https://trabalheila.com.br',
    cleartext: true
    // Remova ou comente as linhas hostname e androidScheme temporariamente para testar
  },
};

export default config;
