import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import AppHeader from "../components/AppHeader";
import { isAdmin } from "../utils/rbac";
import { buildDeclarationText } from "../components/ConflictDeclarationGate";
import SECTORS from "../data/sectors";

/* ── Opções por tipo (lista abrangente de profissões) ── */
const TIPOS = [
  { value: "advogado", label: "Advogado" },
  { value: "medico", label: "Médico" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "consultor_rh", label: "Consultor de RH" },
  { value: "recrutador", label: "Recrutador" },
  { value: "contador", label: "Contador" },
  { value: "engenheiro_seguranca", label: "Engenheiro de Segurança do Trabalho" },
  { value: "fisioterapeuta_ocupacional", label: "Fisioterapeuta Ocupacional" },
  { value: "outro", label: "Outro" },
];

const NICHOS_OPTIONS = [
  "Recrutamento",
  "Direito trabalhista",
  "Saúde ocupacional",
  "Tecnologia",
  "Benefícios corporativos",
  "Treinamento",
  "Outros",
];

const AREAS_RH = [
  "RH",
  "Cultura organizacional",
  "Recrutamento",
  "Liderança",
  "Diversidade",
  "Outros",
];

const SEGMENTOS_PRESTADOR = [
  "Tecnologia",
  "Facilities",
  "Saúde ocupacional",
  "Benefícios corporativos",
  "Segurança do trabalho",
  "Treinamento técnico",
];

/* ── Profissões regulamentadas exigem número + estado/região do conselho ── */
const REGULATED_PROFESSIONS = new Set(["advogado", "medico", "psicologo", "engenheiro_seguranca", "fisioterapeuta_ocupacional", "contador"]);

const CREDENTIAL_LABELS = {
  advogado:                  { number: "Número da OAB",  state: "Estado da OAB (UF)",     placeholder: "Ex: SP" },
  medico:                    { number: "Número do CRM",  state: "Estado do CRM (UF)",     placeholder: "Ex: SP" },
  psicologo:                 { number: "Número do CRP",  state: "Região do CRP",          placeholder: "Ex: 06/SP" },
  contador:                  { number: "Número do CRC",  state: "Estado do CRC (UF)",     placeholder: "Ex: SP" },
  engenheiro_seguranca:      { number: "Número do CREA", state: "Estado do CREA (UF)",    placeholder: "Ex: SP" },
  fisioterapeuta_ocupacional:{ number: "Número do CREFITO", state: "Região do CREFITO",  placeholder: "Ex: 3/SP" },
};

/* Removidas as constantes antigas: PROFISSOES, AREAS_RH, SEGMENTOS_PRESTADOR (não utilizadas no novo fluxo unificado). */

const MAX_DESC = 600;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;

const TERMOS = [
  "A plataforma atua exclusivamente como intermediadora e não é parte de nenhuma relação contratual estabelecida entre Apoiador e cliente.",
  "O Apoiador é inteiramente responsável pelos serviços prestados e pela conduta ética conforme regulamentação da sua categoria profissional.",
  "A plataforma retém 10% sobre contratos fechados por indicação direta da plataforma.",
  "Dados falsos ou documentos inválidos resultam em exclusão imediata e possível comunicação aos órgãos reguladores competentes.",
  "O cadastro no plano gratuito não garante visibilidade e o destaque é exclusivo do plano Premium.",
];

function ApoiadorCadastro({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  /* ── Estado comum ── */
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivos, setArquivos] = useState([]);
  const [foto, setFoto] = useState(null);
  const [termosAceitos, setTermosAceitos] = useState(TERMOS.map(() => false));
  const [conflictDeclarationAccepted, setConflictDeclarationAccepted] = useState(false);
  const [nichos, setNichos] = useState([]);
  const [ramoEspecializacao, setRamoEspecializacao] = useState("");

  /* ── Estado consultor ── */
  const [especialidade, setEspecialidade] = useState("");
  const [areas, setAreas] = useState([]);
  const [linkedin, setLinkedin] = useState("");
  const [valorMedio, setValorMedio] = useState("");

  /* ── Estado advogado ── */
  const [oab, setOab] = useState("");
  const [seccional, setSeccional] = useState("");

  /* ── CNPJ e site (opcionais para todos) ── */
  const [cnpj, setCnpj] = useState("");
  const [segmentos, setSegmentos] = useState([]);
  const [site, setSite] = useState("");

  /* ── Credenciais (privado, nao exibido publicamente) ── */
  const [credentialNumber, setCredentialNumber] = useState("");
  const [credentialStateOrRegion, setCredentialStateOrRegion] = useState("");
  const [credentialPortfolioUrl, setCredentialPortfolioUrl] = useState("");
  const [credentialCertifications, setCredentialCertifications] = useState("");
  const [credentialProof, setCredentialProof] = useState(null); // { name, size, type, url(base64) }

  /* ── UI ── */
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  /* ── Portfólio (Premium) ── */
  const [portfolio, setPortfolio] = useState([]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [pfTitulo, setPfTitulo] = useState("");
  const [pfDescricao, setPfDescricao] = useState("");
  const [pfLink, setPfLink] = useState("");

  const addPortfolioItem = useCallback(() => {
    if (!pfTitulo.trim() || portfolio.length >= 5) return;
    setPortfolio((prev) => [...prev, { titulo: pfTitulo.trim().slice(0, 80), descricao: pfDescricao.trim().slice(0, 400), link: pfLink.trim() || "" }]);
    setPfTitulo("");
    setPfDescricao("");
    setPfLink("");
    setShowPortfolioForm(false);
  }, [pfTitulo, pfDescricao, pfLink, portfolio]);

  const removePortfolioItem = useCallback((idx) => {
    setPortfolio((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const allTermosAceitos = termosAceitos.every(Boolean);

  const toggleTermo = useCallback((idx) => {
    setTermosAceitos((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }, []);

  const toggleNicho = useCallback((nicho) => {
    setNichos((prev) => prev.includes(nicho) ? prev.filter((n) => n !== nicho) : prev.length >= 3 ? prev : [...prev, nicho]);
  }, []);

  const toggleArea = useCallback((area) => {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }, []);

  const toggleSegmento = useCallback((seg) => {
    setSegmentos((prev) => (prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]));
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

  const handleFoto = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
  }, []);

  const handleCredentialProof = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      setError("Comprovante deve ser PDF, JPG ou PNG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("Comprovante excede 5 MB.");
      e.target.value = "";
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () =>
      setCredentialProof({ name: f.name, size: f.size, type: f.type, url: reader.result });
    reader.readAsDataURL(f);
    e.target.value = "";
  }, []);

  /* Reset campos condicionais ao trocar tipo (profissão) */
  const handleTipoChange = useCallback((value) => {
    setTipo(value);
    setCredentialNumber("");
    setCredentialStateOrRegion("");
    setCredentialPortfolioUrl("");
    setCredentialCertifications("");
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    if (!tipo) { setError("Selecione o tipo de apoiador."); return; }
    if (!nome.trim() || !email.trim() || !telefone.trim()) { setError("Preencha todos os campos obrigatórios."); return; }
    if (!ramoEspecializacao) { setError("Selecione o Ramo de Especialização."); return; }

    /* Validação das credenciais */
    if (REGULATED_PROFESSIONS.has(tipo)) {
      if (!credentialNumber.trim() || !credentialStateOrRegion.trim()) {
        setError("Informe o número e o estado/região do conselho da sua categoria.");
        return;
      }
    }
    if (!credentialProof) {
      setError("Anexe o comprovante de credencial (PDF, JPG ou PNG).");
      return;
    }

    if (!allTermosAceitos) { setError("Aceite todos os termos obrigatórios."); return; }
    if (!conflictDeclarationAccepted) {
      setError("É obrigatório aceitar a Declaração de Ausência de Conflito de Interesses.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);

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

      const id = `apoiador_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      const baseData = {
        tipo,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        whatsapp: (whatsapp.trim() || telefone.trim()),
        descricao: descricao.trim().slice(0, MAX_DESC),
        foto: foto || null,
        documentos: docsData,
        status: "pendente",
        plano: "gratuito",
        rating: 0,
        totalAvaliacoes: 0,
        visualizacoes: 0,
        cliquesContato: 0,
        portfolio: portfolio.slice(0, 5),
        nichos: nichos.slice(0, 3),
        ramoEspecializacao,
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),

        /* Credenciais (PRIVADO - nao exibir publicamente).
           Apenas o selo "Apoiador Verificado" sera exposto quando
           verificationStatus for definido como "verified" manualmente. */
        credential: {
          number: REGULATED_PROFESSIONS.has(tipo) ? credentialNumber.trim() : "",
          stateOrRegion: REGULATED_PROFESSIONS.has(tipo) ? credentialStateOrRegion.trim() : "",
          portfolioUrl: !REGULATED_PROFESSIONS.has(tipo) ? credentialPortfolioUrl.trim() : "",
          certifications: !REGULATED_PROFESSIONS.has(tipo) ? credentialCertifications.trim() : "",
          proof: credentialProof, // { name, size, type, url(base64) }
        },
        verificationStatus: "pending",
        hasAgreedConflictDeclaration: true,
        conflictDeclarationAgreedAt: serverTimestamp(),
      };

      /* CNPJ / site / segmentos são opcionais e válidos para qualquer profissão */
      if (cnpj.trim()) baseData.cnpj = cnpj.trim();
      if (site.trim()) baseData.site = site.trim();
      if (segmentos.length > 0) baseData.segmentos = segmentos;

      await setDoc(doc(db, "apoiadores", id), baseData);
      setSuccess(true);
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      setError("Ocorreu um erro ao enviar o cadastro. Tente novamente.");
    }
    setSubmitting(false);
  }, [tipo, nome, email, telefone, whatsapp, descricao, foto, arquivos, allTermosAceitos, conflictDeclarationAccepted, cnpj, segmentos, site, portfolio, nichos, ramoEspecializacao, credentialNumber, credentialStateOrRegion, credentialPortfolioUrl, credentialCertifications, credentialProof]);

  /* ═══ Tela de sucesso ═══ */
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-2">Cadastro enviado!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Seu cadastro será analisado em até <strong>5 dias úteis</strong>. Após aprovação, seu perfil aparecerá na listagem de apoiadores.
          </p>
          <button type="button" onClick={() => navigate("/apoiadores/lista")} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition">
            Ver Apoiadores
          </button>
        </div>
      </div>
    );
  }

  /* ═══ Formulário ═══ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      <AppHeader theme={theme} toggleTheme={toggleTheme} hideAvatar />

      <form onSubmit={handleSubmit} className="w-full max-w-4xl px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">Cadastro de Apoiador</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Consultores de RH, advogados trabalhistas e prestadores de serviços corporativos podem se cadastrar como apoiadores da plataforma.
          </p>

          {admin && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => navigate("/admin/profissoes")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold shadow"
              >
                ⚙️ Gerenciar Profissões/Especialidades
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ── Seletor de tipo (profissão) ── */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Tipo de apoiador *</label>
            <select
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="">Selecione sua profissão…</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {tipo && (
            <>
              {/* ── Campos comuns (2 colunas no desktop) ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Nome completo / Razão social *
                  </label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">E-mail *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Telefone *</label>
                  <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">WhatsApp</label>
                  <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} placeholder="Mesmo do telefone se vazio"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">CNPJ <span className="text-xs font-normal text-slate-500">(opcional)</span></label>
                  <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" maxLength={18}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Site institucional <span className="text-xs font-normal text-slate-500">(opcional)</span></label>
                  <input type="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://www.empresa.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                </div>
              </div>

              {/* ── Segmentos de atuação (largura total) ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Segmentos de atuação</label>
                <div className="flex flex-wrap gap-2">
                  {SEGMENTOS_PRESTADOR.map((s) => (
                    <button key={s} type="button" onClick={() => toggleSegmento(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${segmentos.includes(s) ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Ramo de Especialização (obrigatório) ── */}
              <div className="mb-6">
                <label htmlFor="ramoEspecializacao" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Ramo de Especialização <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ramoEspecializacao"
                  value={ramoEspecializacao}
                  onChange={(e) => setRamoEspecializacao(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="">Selecione um ramo…</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ramo principal em que você presta consultoria. Empresas Premium poderão filtrar
                  apoiadores compatíveis por este ramo.
                </p>
              </div>

              {/* ── Nichos de atuação (todos os tipos, máx 3) ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Nichos de atuação ({nichos.length}/3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {NICHOS_OPTIONS.map((n) => (
                    <button key={n} type="button" onClick={() => toggleNicho(n)}
                      disabled={!nichos.includes(n) && nichos.length >= 3}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${nichos.includes(n) ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"}`}>
                      {n}
                    </button>
                  ))}
                </div>
                {nichos.length >= 3 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Máximo de 3 nichos selecionados.</p>
                )}
              </div>

              {/* ── Foto ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Foto ou logotipo</label>
                <input type="file" accept="image/*" onChange={handleFoto}
                  className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300" />
                {foto && <img src={foto} alt="preview" className="mt-2 h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-600" />}
              </div>

              {/* ── Descrição ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Descrição ({descricao.length}/{MAX_DESC})
                </label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value.slice(0, MAX_DESC))} rows={4} maxLength={MAX_DESC}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 resize-none"
                  placeholder="Descreva sua experiência, certificações e diferenciais..." />
              </div>

              {/* ── Documentos ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Documentos comprobatórios (máx. {MAX_FILES}, 5MB cada)
                </label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple onChange={handleFiles}
                  className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300" />
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

              {/* ── Portfólio (até 5 casos) ── */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Portfólio — casos ou projetos ({portfolio.length}/5)
                </label>
                {portfolio.map((p, i) => (
                  <div key={i} className="mb-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{p.titulo}</p>
                      {p.descricao && <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{p.descricao}</p>}
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline">{p.link}</a>}
                    </div>
                    <button type="button" onClick={() => removePortfolioItem(i)} className="text-red-500 hover:text-red-700 font-bold text-sm shrink-0">✕</button>
                  </div>
                ))}

                {showPortfolioForm ? (
                  <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 space-y-2">
                    <input type="text" value={pfTitulo} onChange={(e) => setPfTitulo(e.target.value.slice(0, 80))} maxLength={80} placeholder="Título do caso ou projeto *"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                    <textarea value={pfDescricao} onChange={(e) => setPfDescricao(e.target.value.slice(0, 400))} maxLength={400} rows={3} placeholder="Descrição (até 400 caracteres)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 resize-none" />
                    <input type="url" value={pfLink} onChange={(e) => setPfLink(e.target.value)} placeholder="Link (opcional)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200" />
                    <div className="flex gap-2">
                      <button type="button" onClick={addPortfolioItem} disabled={!pfTitulo.trim()}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">Adicionar</button>
                      <button type="button" onClick={() => setShowPortfolioForm(false)}
                        className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">Cancelar</button>
                    </div>
                  </div>
                ) : portfolio.length < 5 && (
                  <button type="button" onClick={() => setShowPortfolioForm(true)}
                    className="mt-1 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition w-full">
                    + Adicionar caso ou projeto
                  </button>
                )}
              </div>

              {/* ── Credenciais (privado, nunca exibido publicamente) ── */}
              <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Credenciais
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    Privado
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                  Esses dados são usados apenas para verificação interna. Não aparecem
                  publicamente. Após análise, seu perfil pode receber o selo
                  <span className="font-semibold"> "Apoiador Verificado"</span>.
                </p>

                {REGULATED_PROFESSIONS.has(tipo) && CREDENTIAL_LABELS[tipo] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        {CREDENTIAL_LABELS[tipo].number} *
                      </label>
                      <input
                        type="text"
                        value={credentialNumber}
                        onChange={(e) => setCredentialNumber(e.target.value)}
                        maxLength={30}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        {CREDENTIAL_LABELS[tipo].state} *
                      </label>
                      <input
                        type="text"
                        value={credentialStateOrRegion}
                        onChange={(e) => setCredentialStateOrRegion(e.target.value)}
                        placeholder={CREDENTIAL_LABELS[tipo].placeholder}
                        maxLength={10}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 uppercase"
                      />
                    </div>
                  </div>
                )}

                {!REGULATED_PROFESSIONS.has(tipo) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Link para Portfólio / LinkedIn
                      </label>
                      <input
                        type="url"
                        value={credentialPortfolioUrl}
                        onChange={(e) => setCredentialPortfolioUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/seu-perfil"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Certificações relevantes
                      </label>
                      <textarea
                        value={credentialCertifications}
                        onChange={(e) => setCredentialCertifications(e.target.value.slice(0, 600))}
                        rows={3}
                        maxLength={600}
                        placeholder="Liste cursos, certificações, formações ou experiências relevantes"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Comprovante (obrigatório para todas as profissões) */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Comprovante de credencial *
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Foto da carteira (OAB/CRM/CRP/CRC/CREA/CREFITO), certificado de formação ou outro
                    documento que comprove sua qualificação. PDF, JPG ou PNG (máx. 5 MB).
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleCredentialProof}
                    className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                  />
                  {credentialProof && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="truncate max-w-[240px]">{credentialProof.name}</span>
                      <span className="text-slate-400">
                        ({(credentialProof.size / 1024).toFixed(0)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => setCredentialProof(null)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Termos obrigatórios ── */}
              <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Termos obrigatórios</p>
                {TERMOS.map((t, i) => (
                  <label key={i} className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={termosAceitos[i]} onChange={() => toggleTermo(i)} className="mt-0.5 shrink-0" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t}</span>
                  </label>
                ))}
              </div>

              {/* ── Declaração de Ausência de Conflito de Interesses ── */}
              <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Declaração de Ausência de Conflito de Interesses
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {buildDeclarationText()}
                </p>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={conflictDeclarationAccepted}
                    onChange={(e) => setConflictDeclarationAccepted(e.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Li e concordo com a declaração acima.
                  </span>
                </label>
              </div>

              {/* ── Botão enviar ── */}
              <button type="submit" disabled={submitting || !allTermosAceitos || !conflictDeclarationAccepted}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? "Enviando…" : "Enviar cadastro"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default ApoiadorCadastro;
