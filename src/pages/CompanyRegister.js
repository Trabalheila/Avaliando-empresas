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
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaTouched, setSenhaTouched] = useState(false);
  const [confirmarTouched, setConfirmarTouched] = useState(false);
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


  function formatCnpjMask(value) {
    const v = value.replace(/\D/g, "").slice(0, 14);
    if (!v) return "";
    let m = v;
    if (v.length > 12) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
    else if (v.length > 8) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`;
    else if (v.length > 5) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`;
    else if (v.length > 2) m = `${v.slice(0,2)}.${v.slice(2)}`;
    return m;
  }

  function handleCnpjChange(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
    setCnpj(formatCnpjMask(e.target.value));
    if (raw.length === 14) fetchRazaoSocial(raw);
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
          email,
          companyName: razaoSocial,
          token: window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
        })
      });
      setLoading(false);
      navigate("/empresa/enviado");
    } catch (err) {
      setError("Erro ao cadastrar empresa. Tente novamente.");
      setLoading(false);
    }
  }

  function validarSenha(s) {
    return {
      tamanho: s.length >= 8,
      maiuscula: /[A-Z]/.test(s),
      numero: /\d/.test(s),
      especial: /[^A-Za-z0-9]/.test(s),
    };
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Cadastro de Empresa</h2>
      <div className="mb-4">
        <label className="block mb-1">CNPJ</label>
        <input type="text" value={cnpj} onChange={handleCnpjChange} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Razão Social</label>
        <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Responsável</label>
        <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Cargo</label>
        <input type="text" value={cargo} onChange={e => setCargo(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">E-mail</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Senha</label>
        <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Confirmar Senha</label>
        <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} className="w-full border p-2 rounded" required />
      </div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
        {loading ? "Enviando..." : "Cadastrar"}
      </button>
    </form>
  );
