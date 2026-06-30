// src/pages/CadastroEscolha.js
//
// Tela inicial de cadastro. Apresenta os caminhos disponíveis para o usuário
// escolher como deseja se cadastrar na plataforma:
//   - Trabalhador  → /pseudonym
//   - Especialista → /apoiadores/cadastro
//
// Esta é a primeira tela de um processo de cadastro genérico (ex.: link
// "Cadastre-se" do login/menu). O cadastro de Empresa está temporariamente
// indisponível e não é exibido aqui.

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";

const OPTIONS = [
  {
    key: "trabalhador",
    title: "Cadastrar como Trabalhador",
    description:
      "Avalie empresas, mantenha seu perfil profissional e contrate especialistas para te apoiar.",
    icon: "👷",
    to: "/pseudonym",
    accent:
      "from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800",
  },
  {
    key: "especialista",
    title: "Cadastrar como Especialista",
    description:
      "Advogados e demais especialistas: ofereça consultas e atenda trabalhadores na plataforma.",
    icon: "⚖️",
    to: "/apoiadores/cadastro",
    accent:
      "from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800",
  },
];

export default function CadastroEscolha({ theme, toggleTheme }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Como você quer se cadastrar?
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Escolha o tipo de perfil que melhor representa você. Você poderá
            criar outros perfis depois, se quiser.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-2xl mx-auto">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => navigate(opt.to)}
              className={`group text-left rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${opt.accent} text-white shadow-lg transition flex flex-col h-full`}
            >
              <span className="text-3xl" aria-hidden="true">
                {opt.icon}
              </span>
              <h2 className="mt-3 text-lg font-bold">{opt.title}</h2>
              <p className="mt-2 text-sm text-white/90 flex-1">
                {opt.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold">
                Continuar
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Já tem conta?{" "}
          <Link
            to="/login"
            className="font-bold text-blue-700 dark:text-blue-300 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </main>
    </div>
  );
}
