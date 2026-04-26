import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDocs, getDoc, updateDoc, collection, query, where } from "firebase/firestore";

export default function CompanyConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [empresa, setEmpresa] = useState(null);
  const [reenviando, setReenviando] = useState(false);
  const token = searchParams.get("token");

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setStatus("invalid");
        setError("Token não informado.");
        return;
      }
      // Busca empresa pelo token
      const q = query(collection(db, "companies"), where("confirmationToken", "==", token));
      const snap = await getDocs(q);
      if (snap.empty) {
        setStatus("invalid");
        setError("Token inválido ou empresa não encontrada.");
        return;
      }
      const docRef = snap.docs[0].ref;
      const data = snap.docs[0].data();
      setEmpresa({ ...data, id: docRef.id });
      if (!data.tokenExpiresAt || Date.now() > data.tokenExpiresAt) {
        setStatus("expired");
        setError("Token expirado. Solicite um novo e-mail de confirmação.");
        return;
      }
      // Token válido
      await updateDoc(docRef, {
        verified: true,
        status: "ativo",
        confirmationToken: null,
        tokenExpiresAt: null,
      });
      setStatus("success");
      setTimeout(() => {
        navigate("/empresa/painel?confirm=1");
      }, 2000);
    }
    checkToken();
    // eslint-disable-next-line
  }, [token]);

  async function handleResend() {
    if (!empresa) return;
    setReenviando(true);
    try {
      await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: empresa.cnpj,
          razaoSocial: empresa.razaoSocial,
          responsavel: empresa.responsavel,
          email: empresa.email,
          empresaId: empresa.id,
        }),
      });
      setStatus("reenviado");
    } catch {
      setError("Falha ao reenviar e-mail. Tente novamente mais tarde.");
    }
    setReenviando(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-8 text-center">
        <span className="inline-block px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-widest uppercase mb-4">Acesso Empresarial</span>
        {status === "loading" && <p className="text-blue-900 dark:text-blue-100 font-bold">Validando token...</p>}
        {status === "success" && <>
          <h1 className="text-xl font-extrabold text-emerald-700 mb-2">Cadastro confirmado!</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">Sua empresa foi ativada com sucesso.<br />Redirecionando para o painel...</p>
        </>}
        {status === "invalid" && <>
          <h1 className="text-xl font-extrabold text-red-700 mb-2">Token inválido</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">{error}</p>
        </>}
        {status === "expired" && <>
          <h1 className="text-xl font-extrabold text-yellow-700 mb-2">Token expirado</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">{error}</p>
          <button onClick={handleResend} disabled={reenviando} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition disabled:opacity-60">
            {reenviando ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          </button>
          {status === "reenviado" && <p className="text-emerald-700 mt-2">E-mail reenviado! Verifique sua caixa de entrada.</p>}
        </>}
      </div>
    </div>
  );
}
