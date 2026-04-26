import React from "react";
import { useLocation } from "react-router-dom";

export default function CompanyRegisterAwait() {
  const location = useLocation();
  const email = location.state?.email || "";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-8 text-center">
        <span className="inline-block px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-widest uppercase mb-4">Acesso Empresarial</span>
        <h1 className="text-xl font-extrabold text-blue-800 dark:text-slate-100 mb-2">Confirmação enviada</h1>
        <p className="text-slate-700 dark:text-slate-200 mb-4">
          Enviamos um e-mail de confirmação para <b>{email}</b>.<br />
          Acesse sua caixa de entrada e clique no link para ativar o cadastro.
        </p>
      </div>
    </div>
  );
}
