import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import AppHeader from "../components/AppHeader";

const AREAS_OPTIONS = [
  "RH",
  "Cultura organizacional",
  "Recrutamento",
  "Liderança",
  "Diversidade",
  "Outros",
];

const MAX_DESC = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 3;

function ConsultorCadastro({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [areas, setAreas] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [valorMedio, setValorMedio] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleArea = useCallback((area) => {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }, []);

  const handleFiles = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const valid = [];
    for (const f of files) {
      if (valid.length + arquivos.length >= MAX_FILES) break;
      const ext = f.name.split(".").pop().toLowerCase();
      if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext)) continue;
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

    if (!nome.trim() || !email.trim() || !telefone.trim() || !especialidade.trim()) {
      setError("Preencha todos os campos obrigatórios.");
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

      // Converter arquivos para base64 para armazenar referência
      // (Em produção, usar Firebase Storage)
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

      const id = `consultor_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      await setDoc(doc(db, "consultores", id), {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        whatsapp: telefone.trim(),
        especialidade: especialidade.trim(),
        areas,
        descricao: descricao.trim().slice(0, MAX_DESC),
        linkedin: linkedin.trim(),
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
  }, [nome, email, telefone, especialidade, areas, descricao, linkedin, valorMedio, aceiteTermos, arquivos]);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-2">Cadastro enviado!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Seu cadastro será analisado em até <strong>5 dias úteis</strong>. Após aprovação, seu perfil aparecerá no marketplace de consultores.
          </p>
          <button
            type="button"
            onClick={() => navigate("/escolha-perfil")}
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
            Cadastro de Consultor Parceiro
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Preencha os dados abaixo para se cadastrar como consultor na plataforma Trabalhei Lá.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nome completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
                required
              />
            </div>

            {/* E-mail */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">E-mail profissional *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
                required
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Telefone com WhatsApp *</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
                required
              />
            </div>

            {/* Especialidade */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Especialidade principal *</label>
              <input
                type="text"
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
                placeholder="Ex: Gestão de clima organizacional"
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
                required
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">LinkedIn</label>
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/seu-perfil"
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
              />
            </div>

            {/* Valor médio */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Valor médio de contrato (R$)</label>
              <input
                type="text"
                value={valorMedio}
                onChange={(e) => setValorMedio(e.target.value)}
                placeholder="Ex: 5.000,00"
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Áreas de atuação */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Áreas de atuação</label>
            <div className="flex flex-wrap gap-2">
              {AREAS_OPTIONS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    areas.includes(area)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Descrição profissional ({descricao.length}/{MAX_DESC})
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, MAX_DESC))}
              rows={4}
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 resize-none"
              placeholder="Descreva sua experiência, certificações e diferenciais..."
            />
          </div>

          {/* Upload de documentos */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Documentos comprobatórios (máx. {MAX_FILES} arquivos, 5MB cada)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Certificações, diplomas, registro profissional — PDF ou imagens.
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleFiles}
              disabled={arquivos.length >= MAX_FILES}
              className="text-sm text-slate-600 dark:text-slate-300"
            />
            {arquivos.length > 0 && (
              <div className="mt-2 space-y-1">
                {arquivos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate max-w-[200px]">{f.name}</span>
                    <span className="text-slate-400">({(f.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aceite dos termos */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceiteTermos}
                onChange={(e) => setAceiteTermos(e.target.checked)}
                className="mt-1 shrink-0"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Declaro que estou ciente de que a plataforma Trabalhei Lá retém <strong>10% sobre contratos fechados</strong> por meio da plataforma, e que empresas com <strong>Plano Premium</strong> têm direito a <strong>20% de desconto</strong> no valor do consultor. Concordo com os termos de uso da plataforma.
              </span>
            </label>
          </div>

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? "Enviando cadastro…" : "Enviar cadastro"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConsultorCadastro;
