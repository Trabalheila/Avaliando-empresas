import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import AppHeader from "../components/AppHeader";

const SEGMENTOS_OPTIONS = [
  "Tecnologia",
  "Facilities",
  "Saúde ocupacional",
  "Benefícios corporativos",
  "Segurança do trabalho",
  "Treinamento técnico",
];

const MAX_DESC = 600;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 3;

function PrestadorCadastro({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [segmentos, setSegmentos] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [site, setSite] = useState("");
  const [valorMedio, setValorMedio] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleSegmento = useCallback((seg) => {
    setSegmentos((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    );
  }, []);

  const handleFiles = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const valid = [];
    for (const f of files) {
      if (valid.length + arquivos.length >= MAX_FILES) break;
      const ext = f.name.split(".").pop().toLowerCase();
      if (ext !== "pdf") continue;
      if (f.size > MAX_FILE_SIZE) continue;
      valid.push(f);
    }
    setArquivos((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = "";
  }, [arquivos]);

  const removeFile = useCallback((idx) => {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    if (!razaoSocial.trim() || !cnpj.trim() || !email.trim() || !telefone.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (segmentos.length === 0) {
      setError("Selecione pelo menos um segmento de atuação.");
      return;
    }
    if (!aceiteTermos) {
      setError("Você precisa aceitar os termos para se cadastrar.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const docsData = [];
      for (const f of arquivos) {
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        docsData.push({ nome: f.name, tamanho: f.size, tipo: f.type, url: base64 });
      }

      const id = `prestador_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      await setDoc(doc(db, "prestadores", id), {
        razaoSocial: razaoSocial.trim(),
        cnpj: cnpj.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        segmentos,
        descricao: descricao.trim().slice(0, MAX_DESC),
        site: site.trim(),
        valorMedio: valorMedio.trim(),
        documentos: docsData,
        status: "pendente",
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      setError("Ocorreu um erro ao enviar o cadastro. Tente novamente.");
    }
    setSubmitting(false);
  }, [razaoSocial, cnpj, email, telefone, segmentos, descricao, site, valorMedio, aceiteTermos, arquivos]);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-2">Cadastro enviado!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Seu cadastro será analisado em até <strong>5 dias úteis</strong>. Após aprovação, sua empresa aparecerá no marketplace de prestadores de serviços.
          </p>
          <button
            type="button"
            onClick={() => navigate("/escolha-perfil?planos=1")}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      <AppHeader theme={theme} toggleTheme={toggleTheme} hideAvatar />

      <form onSubmit={handleSubmit} className="w-full max-w-3xl px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">
            Cadastro de Prestador de Serviços
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Preencha os dados abaixo para cadastrar sua empresa como prestadora de serviços corporativos no Trabalhei Lá.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Razão Social */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Razão social *</label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="Nome da empresa"
                maxLength={120}
              />
            </div>
            {/* CNPJ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">CNPJ *</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="00.000.000/0001-00"
                maxLength={18}
              />
            </div>
            {/* E-mail */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">E-mail comercial *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="contato@empresa.com"
              />
            </div>
            {/* Telefone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Telefone *</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="(11) 99999-0000"
                maxLength={20}
              />
            </div>
            {/* Site */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Site institucional</label>
              <input
                type="url"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="https://www.empresa.com"
              />
            </div>
            {/* Valor Médio */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Valor médio de contrato (R$)</label>
              <input
                type="text"
                value={valorMedio}
                onChange={(e) => setValorMedio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                placeholder="Ex: 5.000,00"
              />
            </div>
          </div>

          {/* Segmentos de atuação */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Segmento de atuação * (selecione um ou mais)</label>
            <div className="flex flex-wrap gap-2">
              {SEGMENTOS_OPTIONS.map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => toggleSegmento(seg)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    segmentos.includes(seg)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400"
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Descrição dos serviços oferecidos ({descricao.length}/{MAX_DESC})
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, MAX_DESC))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 resize-none"
              rows={4}
              placeholder="Descreva os serviços que sua empresa oferece..."
              maxLength={MAX_DESC}
            />
          </div>

          {/* Upload documentos */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Documentos comprobatórios (contrato social, certificações, alvarás) — PDF, até 5MB cada, máx. {MAX_FILES}
            </label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFiles}
              className="block text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
            {arquivos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {arquivos.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate max-w-[200px]">{f.name}</span>
                    <span className="text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Termos */}
          <div className="mb-6">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aceiteTermos}
                onChange={(e) => setAceiteTermos(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Aceito os termos de parceria: a plataforma retém <strong>10% sobre contratos fechados</strong> via Trabalhei Lá.
                Empresas Premium têm <strong>15% de desconto</strong> sobre esse valor.
                Confirmo que as informações fornecidas são verdadeiras e os documentos enviados são autênticos.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Enviar cadastro"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PrestadorCadastro;
