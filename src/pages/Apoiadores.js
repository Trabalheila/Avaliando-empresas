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
          Planos para Apoiadores a de Trabalhadores e Empresas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base">
          Profissionais como <strong>Advogados Trabalhistas, Psicólogos, Consultores Empresariais e outros especialistas</strong>:
          crie seu perfil verificado no Trabalhei Lá para receber leads qualificados e expandir sua atuação.
          Nossa plataforma atua como um ponto de conexão eficiente, unindo quem oferece serviços a quem precisa deles.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mt-3">
          Não há qualquer intermediação financeira ou negociação por parte do Trabalhei Lá.
          O pagamento é feito diretamente entre o cliente e o profissional, sem taxas adicionais da plataforma.
        </p>

        {/* CTA principal: cadastro do perfil */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/apoiadores/cadastro"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 sm:px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-base sm:text-lg font-extrabold tracking-wide shadow-lg shadow-blue-600/30 hover:shadow-blue-700/40 transform hover:-translate-y-0.5 transition-all"
          >
            <span>✨ Cadastrar meu perfil</span>
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            É rápido e gratuito — comece agora a ser encontrado.
          </p>
          <Link
            to="/apoiadores/lista"
            className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 underline-offset-2 hover:underline transition"
          >
            Ver apoiadores ativos
          </Link>
        </div>
      </main>

      {/* Transição para a seção de planos */}
      <section className="max-w-5xl mx-auto px-4 mt-10 text-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
          Já tem um perfil? Conheça nossos planos para ir além
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto">
          Amplie sua visibilidade na plataforma e receba mais leads qualificados com os planos pagos.
        </p>
      </section>

      {/* Cards dos 3 planos: Gratuito, Apoiador Essencial (RECOMENDADO) e Apoiador Premium. */}
      <PlanosApoiador />

      <footer className="w-full py-8 text-center text-xs text-slate-500 dark:text-slate-600">
        © {new Date().getFullYear()} Trabalhei Lá — Todos os direitos reservados
      </footer>
    </div>
  );
}

export default Apoiadores;
