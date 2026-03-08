import React from "react";
import { Link } from "react-router-dom";

export default function Purpose({ theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-10 px-4">
      <div className="max-w-3xl mx-auto flex justify-end mb-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? "🌙 Tema" : "☀️ Tema"}
        </button>
      </div>
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-blue-100 p-8">
        <h1 className="text-3xl font-extrabold text-blue-800 mb-6">Qual o nosso propósito?</h1>
        <p className="text-slate-700 mb-4">
          O Trabalhei Lá existe para tornar o mercado de trabalho mais transparente e justo.
          Aqui, profissionais de todas as áreas podem compartilhar suas experiências de forma anônima
          para ajudar outras pessoas a encontrarem empresas que realmente valorizam talento, bem-estar e
          desenvolvimento.
        </p>
        <h2 className="text-xl font-semibold text-blue-800 mb-2">Para profissionais</h2>
        <p className="text-slate-700 mb-4">
          - Ajude outros profissionais a tomar decisões mais conscientes sobre onde trabalhar.
          <br />
          - Compartilhe sua experiência de forma honesta e construtiva.
          <br />
          - Saiba onde empresas estão acertando e onde ainda podem melhorar, segundo quem vive o dia a dia.
        </p>
        <h2 className="text-xl font-semibold text-blue-800 mb-2">Para empresas</h2>
        <p className="text-slate-700 mb-4">
          - Receba feedback real dos próprios colaboradores e ex-colaboradores.
          <br />
          - Identifique pontos de melhoria e oportunidades de crescimento.
          <br />
          - Aumente sua atratividade no mercado ao mostrar que você está aberto ao diálogo e à evolução.
          <br />
          - Empresas com alta pontuação podem atrair mais participantes em testes seletivos, permitindo processos mais criteriosos e melhor captação de profissionais.
        </p>
        <div className="text-center">
          <Link
            to="/"
            className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Voltar para a página principal
          </Link>
          <Link
            to="/excluir-dados"
            className="inline-block mt-4 ml-3 px-6 py-3 border border-blue-200 text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition"
          >
            Excluir meus dados
          </Link>
        </div>
      </div>
    </div>
  );
}
