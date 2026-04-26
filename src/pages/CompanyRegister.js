import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export default function CompanyRegister() {
  const navigate = useNavigate();
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Busca razão social via BrasilAPI
  async function fetchRazaoSocial(cnpjValue) {
    try {
      setRazaoSocial("");
      if (!cnpjValue || cnpjValue.length < 14) return;
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjValue}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setRazaoSocial(data.razao_social || "");
    } catch {
      setRazaoSocial("");
    }
  }

  function handleCnpjChange(e) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 14);
    setCnpj(value);
    if (value.length === 14) fetchRazaoSocial(value);
    else setRazaoSocial("");
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Gera um ID simples para a empresa (pode ser o CNPJ ou um UUID)
      const empresaId = cnpj;
      // Salva no Firestore
      await setDoc(doc(db, "companies", empresaId), {
        cnpj,
        razaoSocial,
        responsavel,
        cargo,
        email,
        senha, // Em produção, nunca salve senha em texto puro!
        status: "pendente",
        createdAt: Date.now(),
      });
      // Chama API para enviar e-mail de confirmação
      await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj,
          razaoSocial,
          responsavel,
          email,
          empresaId,
        }),
      });
      setLoading(false);
      navigate("/empresa/cadastro/aguarde", { state: { email } });
    } catch (err) {
      setError("Erro ao cadastrar empresa. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-8">
        <div className="mb-6 flex flex-col items-center">
          <span className="inline-block px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-widest uppercase mb-2">Acesso Empresarial</span>
          <h1 className="text-xl font-extrabold text-blue-800 dark:text-slate-100 mb-1">Cadastro de Empresa</h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 text-center">Preencha os dados para criar o perfil empresarial e gerenciar avaliações.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">CNPJ</label>
            <input type="text" value={cnpj} onChange={handleCnpjChange} required minLength={14} maxLength={14} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Digite o CNPJ" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Razão Social</label>
            <input type="text" value={razaoSocial} readOnly className="w-full px-3 py-2 border rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200" placeholder="Será preenchido automaticamente" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Nome do Responsável</label>
            <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Cargo do Responsável</label>
            <input type="text" value={cargo} onChange={e => setCargo(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Cargo (ex: Diretor, RH)" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">E-mail Corporativo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="email@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Crie uma senha" />
          </div>
          {error && <div className="text-red-600 text-xs font-semibold mt-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-2 mt-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Cadastrando..." : "Cadastrar Empresa"}
          </button>
        </form>
      </div>
    </div>
  );
}
