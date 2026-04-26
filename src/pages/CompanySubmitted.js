import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.svg"; // ajuste o caminho se necessário

export default function CompanySubmitted({ theme, toggleTheme }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-8 flex flex-col items-center">
        <img src={logo} alt="Trabalhei Lá" className="h-12 mb-4" />
        <h1 className="text-2xl font-extrabold text-blue-800 dark:text-slate-100 mb-2">Trabalhei Lá</h1>
        <p className="text-green-700 dark:text-green-400 font-bold text-lg mb-4 text-center">Cadastro enviado com sucesso!</p>
        <p className="text-slate-700 dark:text-slate-200 text-center mb-6">Verifique seu e-mail corporativo para confirmar o acesso.</p>
        <button
          className="w-full py-2 mb-4 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition"
          onClick={() => navigate("/")}
        >
          Voltar à página principal
        </button>
        <button
          type="button"
          className="mt-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          onClick={toggleTheme}
        >
          Alternar tema
        </button>
      </div>
    </div>
  );
}
