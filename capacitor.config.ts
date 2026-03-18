import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trabalheila.app',
  appName: 'Trabalhei La',
  webDir: 'build',
  server: {
    // Serve o app como o domínio de produção dentro do WebView.
    // Isso garante que o redirect do LinkedIn (https://www.trabalheila.com.br/auth/auth/)
    // volte para o app, não para o site externo, mantendo o mesmo localStorage.
    hostname: 'www.trabalheila.com.br',
    androidScheme: 'https',
  },
};

export default config;
