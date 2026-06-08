// src/components/ErrorBoundary.js
//
// Rede de segurança global contra "tela cinza" (white/blank screen of death).
//
// Sem um Error Boundary, qualquer exceção lançada durante a renderização de
// QUALQUER página (ex.: `profile.pseudonimo` quando `profile` é null) derruba
// toda a árvore React e o usuário fica olhando uma tela em branco/cinza sem
// nenhuma forma de recuperação. Este componente captura esses erros, mostra
// uma tela amigável e oferece ações para o usuário se recuperar (recarregar
// ou voltar ao início) em vez de ficar preso.
//
// Mantido como class component porque os hooks (useState/useEffect) NÃO
// conseguem capturar erros de renderização — apenas os métodos de ciclo de
// vida `getDerivedStateFromError` / `componentDidCatch` fazem isso.

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log para o console — aparece nas DevTools e ajuda no diagnóstico.
    // (Aqui poderia ser enviado a um serviço de monitoramento futuramente.)
    console.error("[ErrorBoundary] Erro de renderização capturado:", error, info);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  handleGoHome = () => {
    try {
      window.location.assign("/");
    } catch {
      /* ignore */
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 py-10 bg-blue-50 dark:bg-slate-900 text-center">
        <div className="text-5xl" aria-hidden="true">
          😕
        </div>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
          Algo deu errado ao abrir esta página
        </h1>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
          Tivemos um problema inesperado ao carregar esta tela. Você pode tentar
          recarregar ou voltar para a página inicial — sua sessão continua
          ativa.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <button
            type="button"
            onClick={this.handleReload}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
          >
            Recarregar
          </button>
          <button
            type="button"
            onClick={this.handleGoHome}
            className="px-5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Ir para o início
          </button>
        </div>
      </div>
    );
  }
}
