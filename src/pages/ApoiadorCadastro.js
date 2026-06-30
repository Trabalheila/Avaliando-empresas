import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import AppHeader from "../components/AppHeader";
import LoginLinkedInButton from "../LoginLinkedInButton";
import { FaGoogle } from "react-icons/fa";
import { loginWithGoogleAndFinalize } from "../services/socialAuth";
import {
  setSelectedProfileType,
  clearSelectedProfileType,
} from "../services/profileType";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import EssencialFreePopup from "../components/EssencialFreePopup";
import { isAdmin } from "../utils/rbac";
import { buildDeclarationText } from "../components/ConflictDeclarationGate";
import SECTORS from "../data/sectors";
import WelcomeModal from "../components/WelcomeModal";
import PaymentInfoModal from "../components/Specialist/PaymentInfoModal";

/* ── Opções por tipo (lista abrangente de profissões) ── */
const TIPOS = [
  { value: "advogado", label: "Advogado" },
  { value: "medico", label: "Médico" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "assistente_social", label: "Assistente Social" },
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
const REGULATED_PROFESSIONS = new Set(["advogado", "medico", "psicologo", "assistente_social", "engenheiro_seguranca", "fisioterapeuta_ocupacional", "contador"]);

/* ── Ramos de atuação do Direito (exibido apenas para advogados) ── */
const RAMOS_DIREITO = [
  "Direito Trabalhista",
  "Direito Previdenciário",
  "Direito Civil",
  "Direito Empresarial",
  "Direito do Consumidor",
  "Direito Digital",
  "Direito Tributário",
  "Direito Penal",
  "Direito Ambiental",
  "Direito Imobiliário",
  "Direito de Família",
  "Direito Administrativo",
];const CREDENTIAL_LABELS = {
  advogado:                  { number: "Número da OAB",  state: "Estado da OAB (UF)",     placeholder: "Ex: SP" },
  medico:                    { number: "Número do CRM",  state: "Estado do CRM (UF)",     placeholder: "Ex: SP" },
  psicologo:                 { number: "Número do CRP",  state: "Região do CRP",          placeholder: "Ex: 06/SP" },
  assistente_social:         { number: "Número do CRESS", state: "Região do CRESS",        placeholder: "Ex: 9/SP" },
  contador:                  { number: "Número do CRC",  state: "Estado do CRC (UF)",     placeholder: "Ex: SP" },
  engenheiro_seguranca:      { number: "Número do CREA", state: "Estado do CREA (UF)",    placeholder: "Ex: SP" },
  fisioterapeuta_ocupacional:{ number: "Número do CREFITO", state: "Região do CREFITO",  placeholder: "Ex: 3/SP" },
};

/* Removidas as constantes antigas: PROFISSOES, AREAS_RH, SEGMENTOS_PRESTADOR (não utilizadas no novo fluxo unificado). */

const MAX_DESC = 600;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;

const TERMOS = [
  "A plataforma atua exclusivamente como intermediadora e não é parte de nenhuma relação contratual estabelecida entre Especialista e cliente.",
  "O Especialista é inteiramente responsável pelos serviços prestados e pela conduta ética conforme regulamentação da sua categoria profissional.",
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
  const [fotoFile, setFotoFile] = useState(null);
  const [termosAceitos, setTermosAceitos] = useState(TERMOS.map(() => false));
  const [conflictDeclarationAccepted, setConflictDeclarationAccepted] = useState(false);
  const [nichos, setNichos] = useState([]);
  const [adExitum, setAdExitum] = useState(false);
  /* Em quais contextos o apoiador atua: trabalhadores, empresas ou ambos. */
  const [servesWorker, setServesWorker] = useState(true);
  const [servesEmployer, setServesEmployer] = useState(false);
  const [ramoEspecializacao, setRamoEspecializacao] = useState("");
  /* Ramos de atuação do Direito (apenas advogados, múltipla escolha). */
  const [ramosDireito, setRamosDireito] = useState([]);

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
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdApoiadorId, setCreatedApoiadorId] = useState("");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
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

  const toggleRamoDireito = useCallback((ramo) => {
    setRamosDireito((prev) =>
      prev.includes(ramo) ? prev.filter((r) => r !== ramo) : [...prev, ramo]
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

  /** Comprime/redimensiona imagem para um preview leve (~512px, JPEG).
      Mantém o preview rápido e serve de fallback pequeno (< 1MB) caso o
      upload no Storage falhe. */
  const compressImageToDataUrl = useCallback(async (file, maxDim = 512, quality = 0.8) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  }, []);

  const handleFoto = useCallback(async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError("A foto excede 5 MB.");
      return;
    }
    setError("");
    // Guarda o arquivo original para upload no Storage e gera um preview
    // leve (compactado) imediatamente — rápido e sem travar a UI.
    setFotoFile(f);
    try {
      const preview = await compressImageToDataUrl(f, 512, 0.8);
      setFoto(preview);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setFoto(reader.result);
      reader.readAsDataURL(f);
    }
  }, [compressImageToDataUrl]);

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

  /* Tipos elegíveis ao modelo Ad Exitum (apenas advocacia) */
  const isAdvogadoTipo = (value) => {
    const v = (value || "").toString().trim().toLowerCase();
    return v === "advogado" || v === "advocacia";
  };
  const canOfferAdExitum = isAdvogadoTipo(tipo);

  /* Reset campos condicionais ao trocar tipo (profissão) */
  const handleTipoChange = useCallback((value) => {
    setTipo(value);
    setCredentialNumber("");
    setCredentialStateOrRegion("");
    setCredentialPortfolioUrl("");
    setCredentialCertifications("");
    if (!isAdvogadoTipo(value)) {
      setAdExitum(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    if (!tipo) { setError("Selecione o tipo de especialista."); return; }
    if (!nome.trim() || !email.trim() || !telefone.trim()) { setError("Preencha todos os campos obrigatórios."); return; }
    if (!ramoEspecializacao) { setError("Selecione o Ramo de Especialização."); return; }
    if (isAdvogadoTipo(tipo) && ramosDireito.length === 0) {
      setError("Selecione ao menos um Ramo de Atuação de Direito.");
      return;
    }

    /* Validação das credenciais */
    if (REGULATED_PROFESSIONS.has(tipo)) {
      if (!credentialNumber.trim() || !credentialStateOrRegion.trim()) {
        setError("Informe o número e o estado/região do conselho da sua categoria.");
        return;
      }
    }
    // Diploma é opcional. Não bloqueia o submit se não enviado — perfis sem
    // diploma só não ganham o selo aprimorado "Verificado com Diploma".

    if (!allTermosAceitos) { setError("Aceite todos os termos obrigatórios."); return; }
    if (!conflictDeclarationAccepted) {
      setError("É obrigatório aceitar a Declaração de Ausência de Conflito de Interesses.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);

      const id = `apoiador_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

      // Foto: sobe para o Firebase Storage e guarda apenas a URL (string
      // pequena). Evita estourar o limite de 1MB do documento Firestore
      // — causa de o cadastro "não salvar" antes — e é muito mais rápido.
      // Fallback: dataURL compactado (já < 1MB) se o Storage falhar.
      let fotoUrl = null;
      if (fotoFile) {
        try {
          const safeName = (fotoFile.name || "foto").replace(/[^\w.-]+/g, "_");
          const path = `apoiadorPhotos/${id}/${Date.now()}-${safeName}`;
          const sRef = storageRef(storage, path);
          await uploadBytes(sRef, fotoFile, {
            contentType: fotoFile.type || "image/*",
          });
          fotoUrl = await getDownloadURL(sRef);
        } catch (storageErr) {
          console.warn("[apoiadorCadastro] falha no Storage; usando dataURL compactado", storageErr);
          fotoUrl = foto || null;
        }
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

      const baseData = {
        tipo,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        whatsapp: (whatsapp.trim() || telefone.trim()),
        descricao: descricao.trim().slice(0, MAX_DESC),
        foto: fotoUrl || null,
        documentos: docsData,
        // Especialista já entra "ativo" para aparecer imediatamente no
        // diretório público (a query da busca filtra por status === "ativo").
        // A verificação de credenciais continua independente, via
        // verificationStatus, e só controla a exibição do selo de verificado.
        status: "ativo",
        plano: "gratuito",
        rating: 0,
        totalAvaliacoes: 0,
        visualizacoes: 0,
        cliquesContato: 0,
        portfolio: portfolio.slice(0, 5),
        nichos: nichos.slice(0, 3),
        adExitum: Boolean(adExitum),
        servesAudiences: [
          ...(servesWorker ? ["worker"] : []),
          ...(servesEmployer ? ["employer"] : []),
        ],
        ramoEspecializacao,
        // Ramos de atuação do Direito (somente advogados). Permite filtrar
        // advogados por especialidade jurídica.
        ramosDireito: isAdvogadoTipo(tipo) ? ramosDireito : [],
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),

        /* Credenciais (PRIVADO - nao exibir publicamente).
           Apenas o selo "Especialista Verificado" sera exposto quando
           verificationStatus for definido como "verified" manualmente. */
        credential: {
          number: REGULATED_PROFESSIONS.has(tipo) ? credentialNumber.trim() : "",
          stateOrRegion: REGULATED_PROFESSIONS.has(tipo) ? credentialStateOrRegion.trim() : "",
          portfolioUrl: !REGULATED_PROFESSIONS.has(tipo) ? credentialPortfolioUrl.trim() : "",
          certifications: !REGULATED_PROFESSIONS.has(tipo) ? credentialCertifications.trim() : "",
          proof: credentialProof, // { name, size, type, url(base64) } | null
        },
        verificationStatus: "pending",
        // Flags atualizadas pela equipe de análise:
        //  - isCouncilVerified: true após checagem do número do conselho
        //    (OAB/CRM/CRP/CRC/CREA/CREFITO). Necessário para ativar o perfil
        //    e exibir o selo "Profissional Verificado".
        //  - isDiplomaVerified: true se o diploma foi enviado e aprovado.
        //    Quando combinado com isCouncilVerified, gera o selo aprimorado
        //    "Profissional Verificado com Diploma".
        isCouncilVerified: false,
        isDiplomaVerified: false,
        hasDiplomaUploaded: !!credentialProof,
        hasAgreedConflictDeclaration: true,
        conflictDeclarationAgreedAt: serverTimestamp(),
      };

      /* CNPJ / site / segmentos são opcionais e válidos para qualquer profissão */
      if (cnpj.trim()) baseData.cnpj = cnpj.trim();
      if (site.trim()) baseData.site = site.trim();
      if (segmentos.length > 0) baseData.segmentos = segmentos;

      await setDoc(doc(db, "apoiadores", id), baseData);

      /* Espelha o cadastro na coleção `users` para que o painel admin
         consiga listar este apoiador no filtro por tipo. Mantemos o
         documento de `apoiadores` intacto — aqui apenas garantimos que
         exista um doc em `users` com userType="apoiador" + campos mínimos.
         A chave preferida é o uid autenticado; quando não houver, usamos
         o próprio id do apoiador como fallback estável. */
      try {
        const userDocId = (auth.currentUser?.uid || id).toString();
        await setDoc(
          doc(db, "users", userDocId),
          {
            userType: "apoiador",
            name: nome.trim(),
            email: email.trim(),
            uid: auth.currentUser?.uid || null,
            apoiadorId: id,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (mirrorErr) {
        console.warn("Falha ao espelhar apoiador em users:", mirrorErr);
      }

      setCreatedApoiadorId(id);

      /* Verifica no Firestore se o modal de boas-vindas ja foi exibido
         antes para este apoiador. Em um cadastro novo o campo nao existe,
         logo o modal sera exibido. Em re-submissoes (admin), respeitamos
         o estado anterior. */
      try {
        const snap = await getDoc(doc(db, "apoiadores", id));
        const alreadyShown = snap.exists() && snap.data()?.welcomeModalShown === true;
        if (!alreadyShown) setShowWelcomeModal(true);
      } catch (welcomeErr) {
        console.warn("Falha ao verificar welcomeModalShown:", welcomeErr);
        // Em caso de falha de leitura, exibe o modal por padrao apos um
        // cadastro recem-criado.
        setShowWelcomeModal(true);
      }

      setSuccess(true);
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      setError("Ocorreu um erro ao enviar o cadastro. Tente novamente.");
    }
    setSubmitting(false);
  }, [tipo, nome, email, telefone, whatsapp, descricao, foto, fotoFile, arquivos, allTermosAceitos, conflictDeclarationAccepted, cnpj, segmentos, site, portfolio, nichos, adExitum, servesWorker, servesEmployer, ramoEspecializacao, ramosDireito, credentialNumber, credentialStateOrRegion, credentialPortfolioUrl, credentialCertifications, credentialProof]);

  /* Fecha o WelcomeModal e marca welcomeModalShown=true no Firestore.
     O proprio WelcomeModal ja persiste o flag; aqui apenas garantimos
     uma segunda gravacao defensiva e atualizamos o estado local. */
  const handleWelcomeClose = useCallback(async () => {
    setShowWelcomeModal(false);
    if (!createdApoiadorId) return;
    try {
      await setDoc(
        doc(db, "apoiadores", createdApoiadorId),
        { welcomeModalShown: true },
        { merge: true }
      );
    } catch (err) {
      console.warn("Falha ao persistir welcomeModalShown ao fechar:", err);
    }
  }, [createdApoiadorId]);

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const linkedInRedirectUri = getLinkedInRedirectUri();

  // Login social na própria página do Especialista. Reaproveita o serviço
  // `loginWithGoogleAndFinalize`: recorrentes são finalizados na hora;
  // novos seguem para a coleta de pseudônimo (?provider=google).
  const handleGoogleClick = useCallback(async () => {
    setError("");
    setSelectedProfileType("specialist");
    setSubmitting(true);
    try {
      const res = await loginWithGoogleAndFinalize({});
      if (res?.requiresPseudonym) {
        const s = res.session || {};
        try {
          const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
          localStorage.setItem(
            "userProfile",
            JSON.stringify({
              ...existing,
              id: s.uid,
              uid: s.uid,
              name: "",
              nomeReal: s.displayName || existing.nomeReal || "",
              fullName: s.displayName || existing.fullName || "",
              email: s.email || existing.email || "",
              picture: s.picture || existing.picture || "",
              avatar: s.picture || existing.avatar || "",
              loginProvider: "google",
              profileTypeChosen: "specialist",
            })
          );
        } catch {
          /* storage indisponível */
        }
        navigate("/pseudonym?provider=google");
      } else {
        clearSelectedProfileType();
        navigate("/");
      }
    } catch (err) {
      console.error("[apoiadorCadastro] Google login falhou:", err);
      setError("Não foi possível entrar com o Google agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }, [navigate]);

  /* ═══ Tela de sucesso ═══ */
  if (success) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-2">Cadastro enviado!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Seu cadastro será analisado em até <strong>5 dias úteis</strong>. Após aprovação, seu perfil aparecerá na listagem de especialistas.
            </p>
            <button
              type="button"
              disabled={showWelcomeModal}
              onClick={() => navigate("/apoiadores/lista")}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              Ver Especialistas
            </button>
          </div>
        </div>
        {showWelcomeModal && (
          <WelcomeModal
            open={showWelcomeModal}
            apoiadorId={createdApoiadorId}
            onClose={handleWelcomeClose}
          />
        )}
      </>
    );
  }

  /* ═══ Formulário ═══ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      <EssencialFreePopup
        planName="Especialista Essencial"
        storageKey="essencialFreePopup:supporter:v1"
        ctaLabel="Quero Aproveitar!"
        accent="indigo"
      />
      <AppHeader theme={theme} toggleTheme={toggleTheme} hideAvatar />

      <form onSubmit={handleSubmit} className="w-full max-w-4xl px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">Cadastro de Especialista</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Consultores de RH, advogados trabalhistas e prestadores de serviços corporativos podem se cadastrar como especialistas da plataforma.
          </p>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowPaymentInfo(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              💳 Como funciona o pagamento?
            </button>
          </div>

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
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Tipo de especialista *</label>
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
              {/* Login social — LinkedIn primeiro (reforça a credibilidade profissional).
                  Aparece somente depois que a profissão foi selecionada, para que o
                  perfil já nasça com a especialidade definida. */}
              <div className="mb-6 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/60 dark:bg-slate-900/40 p-4">
                <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-200">
                  Conecte seu perfil profissional
                </p>
                <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2">
                  <div
                    className="flex-1"
                    onClickCapture={(e) => {
                      e.preventDefault();
                      setSelectedProfileType("specialist");
                    }}
                  >
                    <LoginLinkedInButton
                      clientId={linkedInClientId}
                      redirectUri={linkedInRedirectUri}
                      onLoginSuccess={() => {}}
                      onLoginFailure={(err) => setError(err?.message || String(err))}
                      disabled={submitting}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleClick}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-[42px] rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                  >
                    <FaGoogle className="text-base" /> Continuar com Google
                  </button>
                </div>
              </div>

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
                  especialistas compatíveis por este ramo.
                </p>
              </div>

              {/* ── Ramo de Atuação de Direito (apenas advogados, múltipla escolha) ── */}
              {isAdvogadoTipo(tipo) && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Ramo de Atuação de Direito <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RAMOS_DIREITO.map((ramo) => (
                      <button
                        key={ramo}
                        type="button"
                        onClick={() => toggleRamoDireito(ramo)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          ramosDireito.includes(ramo)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400"
                        }`}
                      >
                        {ramo}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Selecione uma ou mais áreas do Direito em que você atua. Ajuda
                    os trabalhadores a encontrar o advogado certo para o caso.
                  </p>
                </div>
              )}

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
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Exemplos: certificados de cursos, comprovante de registro em conselho de classe, publicações ou outros documentos que comprovem sua experiência. Diferente do diploma, esses documentos aparecem no seu perfil público.
                </p>
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
                  <span className="font-semibold"> "Especialista Verificado"</span>.
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

                {/* Diploma (OPCIONAL). Registro no conselho continua
                    obrigatório para profissões regulamentadas. */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Diploma <span className="text-xs font-normal text-slate-500">(opcional)</span>
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    PDF, JPG ou PNG (máx. 5 MB).
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
                  <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      O upload do seu diploma é <strong>opcional</strong>, mas perfis com
                      diploma verificado recebem um selo de <strong>“Profissional Verificado
                      com Diploma”</strong>, aumentando a confiança dos clientes e a visibilidade
                      na plataforma. A verificação do seu registro no órgão de classe
                      (OAB, CRM, etc.) é <strong>obrigatória</strong> para a ativação do perfil.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Modelo de honorários: Ad Exitum (opcional) ── */}
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  Em quais contextos você atende?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Marque ambos se você atende tanto trabalhadores individuais quanto empresas.
                  Isso define em quais buscas o seu perfil aparece.
                </p>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={servesWorker}
                    onChange={(e) => setServesWorker(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Atendo <strong>trabalhadores</strong> (direito trabalhista, psicologia, coach de carreira, RH e benefícios)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={servesEmployer}
                    onChange={(e) => setServesEmployer(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Atendo <strong>empresas</strong> (consultoria de RH, contabilidade, advocacia empresarial, employer branding e benefícios corporativos)
                  </span>
                </label>
              </div>

              {/* ── Modelo de honorários: Ad Exitum (apenas Advogado/Advocacia) ── */}
              {canOfferAdExitum && (
              <div className="mb-6 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adExitum}
                    onChange={(e) => setAdExitum(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-purple-600"
                  />
                  <span>
                    <span className="block text-sm font-bold text-purple-800 dark:text-purple-200">
                      Aceito o modelo Ad Exitum
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                      Ad exitum significa que você só recebe se ganhar a causa do cliente.
                      Especialistas que aceitam esse modelo ganham um selo destacado no perfil
                      e aparecem em buscas filtradas por essa modalidade.
                    </span>
                  </span>
                </label>
              </div>
              )}

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

        {/* ── Requisitos do cadastro ── */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <span className="text-rose-500">*</span> Requisitos obrigatórios
            </h2>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Tipo de especialista (profissão)</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Nome completo / Razão social</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> E-mail</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Telefone</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Ramo de Especialização</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Número e estado/região do conselho de classe (OAB, CRM, CRP etc.) — para profissões regulamentadas</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Aceite de todos os termos obrigatórios</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span> Aceite da Declaração de Ausência de Conflito de Interesses</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <span className="text-slate-400 text-sm font-normal">(opcional)</span> Requisitos opcionais
            </h2>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> WhatsApp</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> CNPJ</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Site institucional</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Segmentos de atuação</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Nichos de atuação (até 3)</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Foto ou logotipo</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Descrição do perfil</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Documentos comprobatórios</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Portfólio (casos ou projetos)</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Link de Portfólio / LinkedIn e certificações (profissões não regulamentadas)</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Diploma (gera o selo "Profissional Verificado com Diploma")</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Contextos de atendimento (trabalhadores e/ou empresas)</li>
              <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span> Modelo Ad Exitum (apenas advogados)</li>
            </ul>
          </div>
        </div>
      </form>
      <PaymentInfoModal
        open={showPaymentInfo}
        onClose={() => setShowPaymentInfo(false)}
        audience="specialist"
      />
    </div>
  );
}

export default ApoiadorCadastro;
