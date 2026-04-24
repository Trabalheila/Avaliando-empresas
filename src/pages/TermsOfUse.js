import React from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function TermsOfUse({ theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300 mb-6">Termos de Uso</h1>

          <div className="space-y-5 text-slate-700 dark:text-slate-200 leading-relaxed">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">1. Objeto da plataforma</h2>
              <p>
                A plataforma Trabalhei La permite que usuarios compartilhem avaliacoes e relatos sobre experiencias
                profissionais em empresas, com foco em transparencia, utilidade publica e melhoria do mercado de trabalho.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">2. Uso aceitavel</h2>
              <p className="mb-2">Ao utilizar a plataforma, o usuario concorda em nao publicar conteudo que:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Seja difamatorio, calunioso, injurioso ou ofensivo.</li>
                <li>Cite nomes de pessoas fisicas ou permita identificacao individual de terceiros.</li>
                <li>Viole direitos de privacidade, imagem, honra ou qualquer legislacao aplicavel.</li>
                <li>Contenha ameacas, discurso de odio, assedio ou qualquer forma de abuso.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">3. Responsabilidade do usuario</h2>
              <p>
                O usuario e integralmente responsavel pelo conteudo que publica, incluindo comentarios, avaliacoes,
                respostas e qualquer outra manifestacao. A plataforma nao endossa opinioes dos usuarios e pode cooperar
                com autoridades competentes quando exigido por lei.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">4. Remocao de conteudo</h2>
              <p>
                A plataforma se reserva o direito de moderar, ocultar ou remover, a qualquer tempo, conteudos que violem
                estes Termos de Uso, normas internas ou a legislacao vigente, sem necessidade de aviso previo.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">5. Privacidade</h2>
              <p>
                Para informacoes sobre tratamento de dados pessoais, consulte nossa
                {" "}
                <a href="/politica-de-privacidade" className="text-blue-700 dark:text-blue-300 underline font-semibold hover:text-blue-900 dark:hover:text-blue-200">
                  Politica de Privacidade
                </a>
                .
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 rounded-xl border border-blue-200 text-blue-700 dark:text-blue-300 dark:border-slate-600 font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 transition"
            >
              Voltar para a pagina inicial
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
