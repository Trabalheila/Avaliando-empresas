import React from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import PlanosApoiador from "../components/PlanosApoiador";

/**
 * Pagina dedicada aos profissionais (consultores, advogados, prestadores)
 * que desejam se tornar Apoiadores da plataforma. Apresenta os 3 planos
 * disponiveis (Gratuito, Apoiador Essencial e Apoiador Premium) usando o
 * componente compartilhado <PlanosApoiador />, que ja conta com os links
 * de assinatura via preapproval_plan_id do Mercado Pago.
 */
function Apoiadores({ theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Seja um Apoiador" />

      <main className="max-w-5xl mx-auto px-4 pt-10 pb-4 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3">
          Planos para Apoiadores
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base">
          Consultores de RH, advogados trabalhistas, prestadores de serviços e demais profissionais
          podem criar um perfil verificado, receber leads qualificados e ampliar sua atuação dentro
          do Trabalhei Lá. Escolha o plano que combina com o seu momento.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/apoiadores/cadastro"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
          >
            Cadastrar meu perfil
          </Link>
          <Link
            to="/apoiadores/lista"
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Ver apoiadores ativos
          </Link>
        </div>
      </main>

      {/* Cards dos 3 planos: Gratuito, Apoiador Essencial (RECOMENDADO) e Apoiador Premium. */}
      <PlanosApoiador />

      <footer className="w-full py-8 text-center text-xs text-slate-500 dark:text-slate-600">
        © {new Date().getFullYear()} Trabalhei Lá — Todos os direitos reservados
      </footer>
    </div>
  );
}

export default Apoiadores;
