import React, { useCallback, useEffect, useMemo, useState } from "react";
import RestrictedComment from "../components/RestrictedComment";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { SealIcon } from "./SealDetailsPage";
import CompanyCommentsManager from "../components/CompanyCommentsManager";

const PREMIUM_PRICE_LABEL = "R$ 1.499,99/mês";
const PREMIUM_AVAILABLE_AT = "01/08/2026";

// Duração do trial gratuito do Plano Premium Empresa.
const PREMIUM_TRIAL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Recursos Premium descritos para a seção "Desbloqueie o Potencial".
// Substitui os antigos blocos borrados por descrições detalhadas e claras.
const PREMIUM_FEATURES_SHOWCASE = [
  {
    icon: "📊",
    title: "Comparativo com empresas do mesmo CNAE",
    description:
      "Veja como sua nota geral se posiciona frente à média de empresas do mesmo setor (CNAE). Identifique gaps competitivos e priorize ações que tirem sua empresa da média.",
  },
  {
    icon: "📈",
    title: "Relatório executivo mensal",
    description:
      "Síntese pronta para apresentação à diretoria, com tendências do mês, top 3 forças, top 3 oportunidades por critério, benchmark de setor e recomendações priorizadas de ação.",
  },
  {
    icon: "💬",
    title: "Gerenciar e responder comentários",
    description:
      "Responda publicamente às avaliações recebidas, mostre o lado da empresa e demonstre maturidade institucional. Gerencie todas as respostas em um único painel.",
  },
  {
    icon: "🤝",
    title: "Rede de profissionais compatíveis",
    description:
      "Acesso a consultores, psicólogos organizacionais e especialistas em liderança selecionados conforme o perfil e os pontos críticos da sua empresa.",
  },
  {
    icon: "☎️",
    title: "Linha Direta com Apoiadores Premium",
    description:
      "Atendimento prioritário via WhatsApp com apoiadores especializados em cultura organizacional, RH e gestão de pessoas. Tire dúvidas e agende consultorias.",
  },
  {
    icon: "🆘",
    title: "Solicitar apoio especializado",
    description:
      "Acione nossa equipe quando precisar reagir a avaliações negativas, planejar mudanças culturais ou estruturar políticas de pessoas baseadas em dados.",
  },
];

// URL externa de referência sobre o GPTW (Great Place to Work).
const GPTW_INFO_URL = "https://greatplacetowork.com.br/o-que-e-gptw/";

// Lista placeholder de profissionais de apoio sugeridos para empresas Premium.
// Em produção, virá de uma coleção como `supportProfessionals` filtrada por
// compatibilidade (CNAE, especialidade, região etc.).
const SUPPORT_PROFESSIONALS_PLACEHOLDER = [
  {
    id: "sp-1",
    name: "Ana Cardoso",
    role: "Consultora de Cultura & Clima",
    specialty: "Diagnóstico e plano de ação para pontos negativos",
    contact: "ana.cardoso@trabalheila.example",
  },
  {
    id: "sp-2",
    name: "Bruno Lima",
    role: "Especialista em Liderança",
    specialty: "Mentoria para gestores e feedback estruturado",
    contact: "bruno.lima@trabalheila.example",
  },
  {
    id: "sp-3",
    name: "Carla Mendes",
    role: "Psicóloga Organizacional",
    specialty: "Saúde mental no trabalho e prevenção de assédio",
    contact: "carla.mendes@trabalheila.example",
  },
];

// Critérios suportados nas avaliações (mesmos campos usados em Home.js).
const CRITERIA = [
  { key: "rating", label: "Nota geral" },
  { key: "salario", label: "Salário" },
  { key: "beneficios", label: "Benefícios" },
  { key: "cultura", label: "Cultura" },
  { key: "oportunidades", label: "Oportunidades" },
  { key: "lideranca", label: "Liderança" },
  { key: "ambiente", label: "Ambiente" },
  { key: "equilibrio", label: "Equilíbrio vida/trabalho" },
  { key: "reconhecimento", label: "Reconhecimento" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "etica", label: "Ética" },
  { key: "desenvolvimento", label: "Desenvolvimento" },
  { key: "diversidade", label: "Diversidade" },
];

function formatCnpj(value) {
  const v = (value || "").toString().replace(/\D/g, "").slice(0, 14);
  if (v.length !== 14) return value || "—";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function StarRow({ value = 0, size = "h-5 w-5" }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${v.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${size} ${v >= i - 0.25 ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
          viewBox="0 0 24 24"
          fill={v >= i - 0.25 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export default function EmpresaDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState(null); // erro real ao consultar Firestore
  const [reloadKey, setReloadKey] = useState(0); // incrementar dispara nova tentativa
  const [reviews, setReviews] = useState([]);
  const [peerStats, setPeerStats] = useState(null); // { count, avg }

  // Banner de boas-vindas pós-confirmação (vindo de CompanyConfirm via Home).
  // A flag fica em sessionStorage para sobreviver ao OAuth do LinkedIn/Google.
  const [showConfirmedToast, setShowConfirmedToast] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("trabalheiLa_companyConfirmedFlag") === "1") {
        setShowConfirmedToast(true);
        sessionStorage.removeItem("trabalheiLa_companyConfirmedFlag");
      }
    } catch {
      /* sessionStorage indisponível */
    }
  }, []);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    notifyOnReview: true,
    publicProfile: true,
  });

  // Quantidade de funcionários PJ / CLT (editável, persistido no Firestore).
  const [employees, setEmployees] = useState({ pj: "", clt: "" });
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [employeesSaved, setEmployeesSaved] = useState(false);

  // Rascunhos de resposta da empresa por avaliação (apenas Premium).
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);

  // Modal de "Solicitar apoio" (apenas Premium).
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  // Modal "Linha Direta com Apoiadores Premium" via WhatsApp (apenas Premium).
  const [showHotlineModal, setShowHotlineModal] = useState(false);

  // TODO: tornar dinâmico (vir do perfil do apoiador no Firestore).
  const PREMIUM_SUPPORTER_WHATSAPP = "5511999999999";
  const PREMIUM_SUPPORTER_WA_MESSAGE =
    "Olá! Sou uma empresa Premium do Trabalhei Lá e preciso de suporte.";
  const premiumSupporterWaUrl = `https://wa.me/${PREMIUM_SUPPORTER_WHATSAPP}?text=${encodeURIComponent(
    PREMIUM_SUPPORTER_WA_MESSAGE
  )}`;

  // Status da empresa na Receita Federal (BrasilAPI via /api/cnpj-data).
  const [receitaData, setReceitaData] = useState(null);
  const [receitaLoading, setReceitaLoading] = useState(false);
  const [receitaError, setReceitaError] = useState("");

  // Selo Trabalhei Lá de Excelência (recalculado via /api/seal-status).
  const [sealInfo, setSealInfo] = useState(null); // { hasSeal, averageScore, numberOfEvaluations, sealGrantedDate, thresholds }

  // Auth ready
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Logs de depuração do estado de autenticação no Dashboard.
      let storedProfile = null;
      try {
        storedProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
      } catch {
        storedProfile = null;
      }
      console.log("[EmpresaDashboard] onAuthStateChanged", {
        hasFirebaseUser: !!u,
        uid: u?.uid || null,
        email: u?.email || null,
        emailVerified: u?.emailVerified || false,
        storedProfile: storedProfile
          ? {
              role: storedProfile.role,
              userType: storedProfile.userType,
              managedCompanyId: storedProfile.managedCompanyId,
              isEmployer: storedProfile.isEmployer,
            }
          : null,
      });
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Carrega o documento da empresa do Firestore (sem recadastrar CNPJ).
  const loadCompany = useCallback(async (currentUser) => {
    setLoading(true);
    setLoadError(null);
    console.log("[EmpresaDashboard] loadCompany start", {
      uid: currentUser?.uid,
      email: currentUser?.email,
    });

    // Força o ID token a estar pronto antes de qualquer query no Firestore.
    // Sem isso, a primeira leitura logo após onAuthStateChanged pode falhar
    // com permission-denied de forma intermitente, fazendo o dashboard cair
    // em "Empresa não encontrada" mesmo havendo empresa cadastrada.
    try {
      await currentUser.getIdToken();
    } catch (err) {
      console.warn("[EmpresaDashboard] falha ao obter ID token", err);
    }

    // Acumulador de erros de queries — se qualquer leitura falhar, não
    // podemos concluir com segurança que "não existe empresa".
    const queryErrors = [];

    // 0) Carrega o doc do usuário em /users/{uid} para obter o vínculo
    //    explícito com a empresa (managedCompanyId / isEmployer). Esse é
    //    o caminho preferencial: se existir, evitamos heurísticas e
    //    buscamos diretamente o documento da empresa correspondente.
    let userDocData = null;
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      userDocData = userSnap.exists() ? userSnap.data() : null;
    } catch (err) {
      console.warn("[EmpresaDashboard] erro ao carregar /users/{uid}", err);
      queryErrors.push({ step: "users/{uid}", err });
    }
    const fullUser = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      ...(userDocData || {}),
    };
    console.log("Usuário logado:", fullUser);
    console.log(
      "ID da empresa gerenciada pelo usuário (managedCompanyId):",
      fullUser?.managedCompanyId
    );

    // Heurística de "qualidade" do doc: priorizamos o doc com mais campos
    // cadastrais preenchidos (cnpj, razaoSocial, cnaeCodigo, setor). Isso
    // evita que um stub criado acidentalmente em `companies/{uid}` mascare
    // o doc real em `companies/{cnpjDigits}` gravado por confirm-company.js.
    const scoreDoc = (d) => {
      if (!d) return -1;
      let s = 0;
      if (d.cnpj) s += 4;
      if (d.razaoSocial || d.companyName) s += 3;
      if (d.cnaeCodigo || d.cnae?.codigo) s += 2;
      if (d.setor) s += 1;
      if (d.email) s += 1;
      return s;
    };
    const pickBest = (docs) => {
      if (!docs || !docs.length) return null;
      return [...docs].sort((a, b) => scoreDoc(b.data) - scoreDoc(a.data))[0];
    };

    try {
      const collected = []; // { id, data, source }

      // 1a) preferencial: managedCompanyId apontando para companies/{id}.
      const managedCompanyId = fullUser?.managedCompanyId;
      if (managedCompanyId) {
        console.log("Buscando empresa com ID:", managedCompanyId);
        try {
          const cSnap = await getDoc(doc(db, "companies", managedCompanyId));
          const dadosDaEmpresa = cSnap.exists()
            ? { id: cSnap.id, ...cSnap.data() }
            : null;
          console.log("Resultado da busca da empresa:", dadosDaEmpresa);
          if (cSnap.exists()) {
            collected.push({
              id: cSnap.id,
              data: cSnap.data(),
              source: "managedCompanyId",
            });
          }
        } catch (err) {
          console.warn(
            "[EmpresaDashboard] erro ao buscar companies/{managedCompanyId}",
            err
          );
          queryErrors.push({ step: "companies/{managedCompanyId}", err });
        }
      }

      // 1) por ownerUid (todos os matches; pode haver mais de um).
      try {
        const snap = await getDocs(query(collection(db, "companies"), where("ownerUid", "==", currentUser.uid)));
        snap.docs.forEach((d) => collected.push({ id: d.id, data: d.data(), source: "ownerUid" }));
      } catch (err) {
        console.warn("[EmpresaDashboard] erro ao buscar por ownerUid", err);
        queryErrors.push({ step: "ownerUid", err });
      }

      // 2) por e-mail (que é como o cadastro original grava).
      if (currentUser.email) {
        try {
          const snap = await getDocs(query(collection(db, "companies"), where("email", "==", currentUser.email)));
          snap.docs.forEach((d) => {
            if (!collected.some((c) => c.id === d.id)) {
              collected.push({ id: d.id, data: d.data(), source: "email" });
            }
          });
        } catch (err) {
          console.warn("[EmpresaDashboard] erro ao buscar por email", err);
          queryErrors.push({ step: "email", err });
        }
      }

      console.log("[EmpresaDashboard] candidatos encontrados", collected.map((c) => ({
        id: c.id,
        source: c.source,
        score: scoreDoc(c.data),
        razaoSocial: c.data?.razaoSocial,
        cnpj: c.data?.cnpj,
      })));

      const best = pickBest(collected);
      if (best) {
        const merged = { id: best.id, ...best.data };
        console.log("[EmpresaDashboard] doc escolhido", {
          id: best.id,
          source: best.source,
          razaoSocial: merged.razaoSocial,
          cnpj: merged.cnpj,
          cnaeCodigo: merged.cnaeCodigo || merged.cnae?.codigo,
          cnaeDescricao: merged.cnaeDescricao || merged.cnae?.descricao,
          setor: merged.setor,
          situacaoCadastral: merged.situacaoCadastral,
          logoUrl: merged.logoUrl ? "(presente)" : "(ausente)",
        });
        setCompany(merged);
        // Garante que o `userProfile` em localStorage reflita o status de
        // empresário do usuário atual. Sem isso, ao clicar em "Página inicial"
        // a Home renderiza com cache antigo (sem managedCompanyId/role), o
        // botão "Painel Empresa" some e "Crie seu perfil" aparece até que
        // o effect onAuthStateChanged da Home termine de re-popular o perfil.
        try {
          let existing = {};
          try {
            existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
          } catch {
            existing = {};
          }
          const refreshed = {
            ...existing,
            uid: existing.uid || currentUser?.uid,
            id: existing.id || currentUser?.uid,
            email: existing.email || currentUser?.email || "",
            role: existing.role || fullUser?.role || "admin_empresa",
            userType: existing.userType || fullUser?.userType || "empresario",
            isEmployer: true,
            managedCompanyId: best.id || fullUser?.managedCompanyId || existing.managedCompanyId || null,
            managedCompanyName:
              merged.razaoSocial || merged.name || existing.managedCompanyName || null,
          };
          localStorage.setItem("userProfile", JSON.stringify(refreshed));
          window.dispatchEvent(new Event("trabalheiLa_user_updated"));
        } catch (err) {
          console.warn("[EmpresaDashboard] falha ao sincronizar userProfile no localStorage", err);
        }
        setPrefs((prev) => ({
          notifyOnReview: best.data?.prefs?.notifyOnReview ?? prev.notifyOnReview,
          publicProfile: best.data?.prefs?.publicProfile ?? prev.publicProfile,
        }));
        setEmployees({
          pj: best.data?.funcionariosPJ != null ? String(best.data.funcionariosPJ) : "",
          clt: best.data?.funcionariosCLT != null ? String(best.data.funcionariosCLT) : "",
        });
      } else if (queryErrors.length > 0) {
        // Houve falhas de leitura — não podemos afirmar que a empresa não
        // existe. Marca erro para a UI mostrar "Tentar novamente" em vez
        // de "Empresa não encontrada".
        console.warn(
          "[EmpresaDashboard] carregamento incompleto por erros de query",
          queryErrors
        );
        setCompany(null);
        setLoadError(queryErrors[0]?.err || new Error("Falha ao carregar dados."));
      } else {
        console.warn("[EmpresaDashboard] nenhuma empresa encontrada para este usuário");
        setCompany(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-retry uma vez quando houve erro de carregamento (mitiga
  // intermitências de propagação de token / rede logo após login).
  useEffect(() => {
    if (!loadError) return;
    if (reloadKey > 0) return; // só 1 retry automático
    const t = setTimeout(() => setReloadKey((k) => k + 1), 1500);
    return () => clearTimeout(t);
  }, [loadError, reloadKey]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadCompany(user);
  }, [authReady, user, loadCompany, reloadKey]);

  // Busca status da Receita Federal via /api/cnpj-data assim que o CNPJ
  // estiver disponível. Falhas não bloqueiam o resto do dashboard.
  useEffect(() => {
    const cnpjDigits = (company?.cnpj || "").toString().replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      setReceitaData(null);
      setReceitaError("");
      return;
    }
    let cancelled = false;
    setReceitaLoading(true);
    setReceitaError("");
    (async () => {
      try {
        const r = await fetch(`/api/cnpj-data?cnpj=${cnpjDigits}`);
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setReceitaError(body?.error || "Não foi possível consultar a Receita Federal.");
          setReceitaData(null);
        } else {
          setReceitaData(body);
        }
      } catch (err) {
        if (cancelled) return;
        setReceitaError("Falha de rede ao consultar a Receita Federal.");
        setReceitaData(null);
      } finally {
        if (!cancelled) setReceitaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company?.cnpj]);

  // Recalcula o "Selo Trabalhei Lá de Excelência" sempre que a lista de
  // avaliações muda. O backend persiste hasSeal/sealGrantedDate em
  // /companies/{cnpj}.
  useEffect(() => {
    const cnpjDigits = (company?.cnpj || "").toString().replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      setSealInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/seal-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj: cnpjDigits }),
        });
        if (!r.ok) return;
        const body = await r.json();
        if (!cancelled) setSealInfo(body);
      } catch {
        /* silencioso — selo é opcional */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Recalcula quando o número de avaliações muda (criar/editar/excluir).
  }, [company?.cnpj, reviews.length]);

  // Carrega avaliações da empresa.
  useEffect(() => {
    async function fetchReviews() {
      if (!company) return;
      try {
        const ref = collection(db, "reviews");
        const candidates = [];
        if (company.razaoSocial) {
          candidates.push(query(ref, where("company", "==", company.razaoSocial)));
        }
        if (company.cnpj) {
          candidates.push(query(ref, where("companyCnpj", "==", company.cnpj)));
        }
        const map = new Map();
        for (const q of candidates) {
          try {
            const snap = await getDocs(q);
            snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
          } catch {
            /* segue */
          }
        }
        const list = Array.from(map.values()).sort(
          (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
        );
        setReviews(list);
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
      }
    }
    fetchReviews();
  }, [company]);

  // Carrega comparativo do mesmo CNAE (apenas para Premium).
  // Aceita tanto o campo legado `plan === "premium"` quanto o novo `isPremium`.
  const isPremium = company?.plan === "premium" || company?.isPremium === true;
  const isGPTWCompatible = company?.isGPTWCompatible === true;

  // ----- Trial gratuito do Plano Premium Empresa -----
  const trialEndMs = useMemo(() => {
    const v = company?.premiumTrialEndDate;
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, [company?.premiumTrialEndDate]);

  // Atualiza um "now" a cada 6h para o contador regressivo permanecer correto
  // sem provocar re-renderizações excessivas.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const trialActive = !!company?.isPremiumTrialActive && trialEndMs > nowMs;
  const trialUsed =
    !!company?.premiumTrialUsed ||
    (!!company?.premiumTrialEndDate && !trialActive);
  const trialDaysLeft = trialActive
    ? Math.max(0, Math.ceil((trialEndMs - nowMs) / MS_PER_DAY))
    : 0;
  // Acesso efetivo aos recursos Premium = assinante Premium OU trial ativo.
  const effectivePremium = isPremium || trialActive;

  const [startingTrial, setStartingTrial] = useState(false);
  const handleStartTrial = useCallback(async () => {
    if (!company?.id || trialUsed || isPremium || startingTrial) return;
    setStartingTrial(true);
    try {
      const end = new Date(Date.now() + PREMIUM_TRIAL_DAYS * MS_PER_DAY);
      const start = new Date();
      await setDoc(
        doc(db, "companies", company.id),
        {
          isPremiumTrialActive: true,
          premiumTrialStartDate: start,
          premiumTrialEndDate: end,
          premiumTrialUsed: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCompany((prev) =>
        prev
          ? {
              ...prev,
              isPremiumTrialActive: true,
              premiumTrialStartDate: start,
              premiumTrialEndDate: end,
              premiumTrialUsed: true,
            }
          : prev
      );
    } catch (err) {
      console.error("Erro ao iniciar trial Premium:", err);
      alert("Não foi possível iniciar o trial Premium. Tente novamente.");
    } finally {
      setStartingTrial(false);
    }
  }, [company?.id, trialUsed, isPremium, startingTrial]);

  // Encerra automaticamente o trial expirado no Firestore (uma única vez).
  useEffect(() => {
    if (
      company?.id &&
      company?.isPremiumTrialActive === true &&
      trialEndMs > 0 &&
      trialEndMs <= nowMs &&
      !isPremium
    ) {
      setDoc(
        doc(db, "companies", company.id),
        { isPremiumTrialActive: false, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
      setCompany((prev) =>
        prev ? { ...prev, isPremiumTrialActive: false } : prev
      );
    }
  }, [company?.id, company?.isPremiumTrialActive, trialEndMs, nowMs, isPremium]);

  useEffect(() => {
    async function fetchPeers() {
      if (!effectivePremium || !company) return;
      const cnaeKey = company?.cnaeCodigo || company?.cnae?.codigo || company?.setor;
      if (!cnaeKey) return;
      try {
        // Busca outras empresas do mesmo CNAE (campo cnaeCodigo ou setor).
        const ref = collection(db, "companies");
        let snap;
        try {
          snap = await getDocs(query(ref, where("cnaeCodigo", "==", String(cnaeKey))));
        } catch {
          snap = null;
        }
        if (!snap || snap.empty) {
          try {
            snap = await getDocs(query(ref, where("setor", "==", String(cnaeKey).slice(0, 2))));
          } catch {
            /* sem permissão / índice */
          }
        }
        if (!snap) return;

        const peerCnpjs = snap.docs
          .map((d) => d.data()?.cnpj)
          .filter((c) => c && c !== company.cnpj);

        if (!peerCnpjs.length) {
          setPeerStats({ count: 0, avg: 0 });
          return;
        }

        // Limita a 10 vizinhos para evitar custo alto.
        const sample = peerCnpjs.slice(0, 10);
        const reviewsRef = collection(db, "reviews");
        let total = 0;
        let count = 0;
        for (const peerCnpj of sample) {
          try {
            const peerSnap = await getDocs(query(reviewsRef, where("companyCnpj", "==", peerCnpj)));
            peerSnap.docs.forEach((d) => {
              const r = d.data();
              const v = Number(r.rating) || 0;
              if (v > 0) {
                total += v;
                count += 1;
              }
            });
          } catch {
            /* segue */
          }
        }
        setPeerStats({ count, avg: count ? total / count : 0 });
      } catch (err) {
        console.error("Erro ao carregar comparativo CNAE:", err);
      }
    }
    fetchPeers();
  }, [effectivePremium, company]);

  const overallAvg = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  const criteriaAverages = useMemo(() => {
    return CRITERIA.map((c) => {
      const values = reviews
        .map((r) => Number(r[c.key]))
        .filter((v) => Number.isFinite(v) && v > 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { ...c, avg, count: values.length };
    });
  }, [reviews]);

  // Top pontos positivos (maiores médias) e negativos (menores médias),
  // ignorando a "Nota geral" e critérios sem avaliações.
  const { topPositivos, topNegativos } = useMemo(() => {
    const evaluated = criteriaAverages.filter((c) => c.key !== "rating" && c.count > 0);
    const sorted = [...evaluated].sort((a, b) => b.avg - a.avg);
    return {
      topPositivos: sorted.slice(0, 3),
      topNegativos: sorted.slice(-3).reverse(),
    };
  }, [criteriaAverages]);

  const handleSavePrefs = async () => {
    if (!company?.id) return;
    setSavingPrefs(true);
    try {
      await setDoc(
        doc(db, "companies", company.id),
        { prefs, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      alert("Não foi possível salvar as preferências.");
    } finally {
      setSavingPrefs(false);
    }
  };

  // Salva a contagem de funcionários PJ/CLT no documento da empresa.
  const handleSaveEmployees = async () => {
    if (!company?.id) return;
    const pj = employees.pj === "" ? null : Number(employees.pj);
    const clt = employees.clt === "" ? null : Number(employees.clt);
    if ((pj != null && (!Number.isFinite(pj) || pj < 0)) || (clt != null && (!Number.isFinite(clt) || clt < 0))) {
      alert("Informe valores numéricos válidos (≥ 0) para PJ e CLT.");
      return;
    }
    setSavingEmployees(true);
    setEmployeesSaved(false);
    try {
      await setDoc(
        doc(db, "companies", company.id),
        {
          funcionariosPJ: pj,
          funcionariosCLT: clt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCompany((prev) => (prev ? { ...prev, funcionariosPJ: pj, funcionariosCLT: clt } : prev));
      setEmployeesSaved(true);
    } catch (err) {
      console.error("Erro ao salvar funcionários:", err);
      alert("Não foi possível salvar a quantidade de funcionários.");
    } finally {
      setSavingEmployees(false);
    }
  };

  // Salva a resposta da empresa a uma avaliação específica (Premium).
  // Persistimos diretamente no documento da review em `companyResponse`,
  // mantendo o mesmo padrão de acesso a Firestore usado no restante do dashboard.
  const handleSubmitReply = async (reviewId) => {
    if (!effectivePremium) return;
    const text = (replyDrafts[reviewId] || "").trim();
    if (!text) return;
    setReplyingId(reviewId);
    try {
      await setDoc(
        doc(db, "reviews", reviewId),
        {
          companyResponse: {
            text,
            respondedAt: serverTimestamp(),
            respondedByUid: user?.uid || null,
            respondedByCompanyId: company?.id || null,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                companyResponse: {
                  text,
                  respondedAt: new Date(),
                  respondedByUid: user?.uid || null,
                  respondedByCompanyId: company?.id || null,
                },
              }
            : r
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
    } catch (err) {
      console.error("Erro ao enviar resposta:", err);
      alert("Não foi possível enviar a resposta. Tente novamente.");
    } finally {
      setReplyingId(null);
    }
  };

  // Solicita apoio (Premium): cria um documento em `supportRequests`.
  const handleRequestSupport = async () => {
    if (!effectivePremium || !company?.id) return;
    const message = supportMessage.trim();
    setSendingSupport(true);
    try {
      const reqId = `${company.id}_${Date.now()}`;
      await setDoc(doc(db, "supportRequests", reqId), {
        companyId: company.id,
        companyName: company.razaoSocial || "",
        cnpj: company.cnpj || "",
        requesterUid: user?.uid || null,
        requesterEmail: user?.email || "",
        message,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSupportSent(true);
      setSupportMessage("");
    } catch (err) {
      console.error("Erro ao solicitar apoio:", err);
      alert("Não foi possível registrar sua solicitação. Tente novamente.");
    } finally {
      setSendingSupport(false);
    }
  };

  // ---------- UI ----------

  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Tenta detectar um perfil local (localStorage) — caso o usuário tenha
    // "logado" via fluxo que não sincroniza com Firebase Auth, ou cuja
    // sessão Firebase expirou. Nesse caso, oferecemos "Entrar" com retorno
    // para o próprio dashboard, em vez de bloquear como "Acesso restrito"
    // definitivo.
    let localProfile = null;
    try {
      localProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
    } catch {
      localProfile = null;
    }
    const role = (localProfile?.role || "").toString().toLowerCase().trim();
    const userType = (localProfile?.userType || "").toString().toLowerCase().trim();
    const looksLikeEmployer =
      role === "admin_empresa" ||
      userType === "empresario" ||
      userType === "empres\u00e1rio" ||
      localProfile?.isEmployer === true ||
      Boolean(localProfile?.managedCompanyId);

    console.log("[EmpresaDashboard] sem firebase user", {
      hasLocalProfile: !!localProfile,
      role,
      userType,
      managedCompanyId: localProfile?.managedCompanyId || null,
      looksLikeEmployer,
    });

    const titulo = looksLikeEmployer
      ? "Sess\u00e3o expirada"
      : "Acesso restrito";
    const subtitulo = looksLikeEmployer
      ? "Sua sess\u00e3o expirou. Entre novamente para acessar o dashboard da sua empresa."
      : "Fa\u00e7a login com a conta da sua empresa para acessar o dashboard.";
    const labelBtn = looksLikeEmployer ? "Entrar novamente" : "Entrar";

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">{titulo}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitulo}</p>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/login?redirectAfterLogin=" + encodeURIComponent("/empresa-dashboard")
              )
            }
            style={{ backgroundColor: "#1a237e" }}
            className="mt-6 w-full h-12 rounded-lg font-bold text-white hover:brightness-110"
          >
            {labelBtn}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Voltar para a página inicial
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    // Se houve erro de leitura no Firestore, NÃO afirmamos que a empresa
    // não existe — oferecemos retry, evitando o flicker entre "carregou" e
    // "não encontrada" causado por falhas intermitentes (token, rede, regras).
    if (loadError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
            <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">
              Não foi possível carregar o dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Houve uma falha ao consultar os dados da sua empresa. Verifique
              sua conexão e tente novamente.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setReloadKey((k) => k + 1);
              }}
              style={{ backgroundColor: "#1a237e" }}
              className="mt-6 w-full h-12 rounded-lg font-bold text-white hover:brightness-110"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-3 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Voltar para a página inicial
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Não localizamos uma empresa vinculada a esta conta. Conclua o cadastro primeiro.
          </p>
          <button
            type="button"
            onClick={() => navigate("/empresa/cadastro")}
            style={{ backgroundColor: "#1a237e" }}
            className="mt-6 w-full h-12 rounded-lg font-bold text-white hover:brightness-110"
          >
            Cadastrar empresa
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-3 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const cnaeCodigo = company?.cnaeCodigo || company?.cnae?.codigo || "";
  const cnaeDescricao = company?.cnaeDescricao || company?.cnae?.descricao || "";
  const setor = company?.setor || (cnaeCodigo ? cnaeCodigo.slice(0, 2) : "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {showConfirmedToast && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 flex items-start gap-3 shadow-sm"
          >
            <span className="text-2xl leading-none" aria-hidden="true">✅</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                Empresa confirmada com sucesso!
              </div>
              <p className="mt-0.5 text-sm text-emerald-900/90 dark:text-emerald-100/90">
                Bem-vindo(a) ao painel da sua empresa. Configure suas preferências e responda às avaliações abaixo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmedToast(false)}
              aria-label="Fechar aviso"
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-bold text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* CTA Trial gratuito do Plano Premium Empresa (apenas para Free e não usado) */}
        {!isPremium && !trialActive && !trialUsed && (
          <section
            aria-label="Experimente o Plano Premium Empresa grátis"
            className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-amber-900/20 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-3xl leading-none" aria-hidden="true">✨</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Oferta exclusiva
                  </div>
                  <h2 className="mt-0.5 text-lg sm:text-xl font-extrabold text-amber-900 dark:text-amber-100">
                    Experimente o Plano Premium Grátis por {PREMIUM_TRIAL_DAYS} dias!
                  </h2>
                  <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90 max-w-2xl">
                    Desbloqueie comparativo de setor, relatório executivo, gerenciamento de comentários e a Linha
                    Direta com Apoiadores Premium. Sem cobrança, sem cartão de crédito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartTrial}
                disabled={startingTrial}
                className={`h-11 px-5 rounded-lg font-bold text-white transition shrink-0 ${
                  startingTrial
                    ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {startingTrial ? "Ativando..." : `Ativar trial de ${PREMIUM_TRIAL_DAYS} dias`}
              </button>
            </div>
          </section>
        )}

        {/* Contador regressivo do trial ativo */}
        {trialActive && !isPremium && (
          <section
            aria-label="Status do trial Premium"
            className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 shadow-sm"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl leading-none" aria-hidden="true">⏳</span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                    Seu trial Premium está ativo
                  </div>
                  <p className="mt-0.5 text-sm text-emerald-900/90 dark:text-emerald-100/90">
                    Termina em <strong>{trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}</strong>
                    {trialEndMs > 0 && (
                      <> ({new Date(trialEndMs).toLocaleDateString("pt-BR")})</>
                    )}. Aproveite todos os recursos Premium liberados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/escolha-perfil")}
                className="h-10 px-4 rounded-lg font-bold text-emerald-800 dark:text-emerald-100 border border-emerald-600 dark:border-emerald-400 bg-transparent hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shrink-0"
              >
                Assinar agora
              </button>
            </div>
          </section>
        )}

        {/* Aviso de trial expirado */}
        {trialUsed && !trialActive && !isPremium && (
          <section
            aria-label="Trial Premium encerrado"
            className="rounded-2xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-5 py-4 shadow-sm"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl leading-none" aria-hidden="true">🔒</span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-blue-900 dark:text-blue-100">
                    Seu trial Premium terminou
                  </div>
                  <p className="mt-0.5 text-sm text-blue-900/90 dark:text-blue-100/90">
                    Os recursos Premium foram bloqueados novamente. Assine o Plano Premium para mantê-los liberados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/escolha-perfil")}
                style={{ backgroundColor: "#1a237e" }}
                className="h-10 px-4 rounded-lg font-bold text-white hover:brightness-110 transition shrink-0"
              >
                Fazer Upgrade
              </button>
            </div>
          </section>
        )}

        {/* Header / Resumo */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {/* Logo da empresa (se houver) */}
              <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={`Logo de ${company.razaoSocial || "empresa"}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="h-7 w-7 text-slate-400 dark:text-slate-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                )}
              </div>

              <div className="min-w-0">
              <div className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Dashboard da empresa
              </div>
              <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                {company.razaoSocial || "Empresa sem nome"}
              </h1>
              {(sealInfo?.hasSeal || company?.hasSeal) && (
                <button
                  type="button"
                  onClick={() => navigate("/selo-trabalheila")}
                  title="Selo Trabalhei Lá de Excelência — clique para saber mais"
                  aria-label="Selo Trabalhei Lá de Excelência — saber mais"
                  className="group mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <SealIcon className="h-5 w-5" />
                  Selo Trabalhei Lá de Excelência
                  {typeof sealInfo?.averageScore === "number" && (
                    <span className="text-[11px] font-medium opacity-80">
                      · {sealInfo.averageScore.toFixed(1)} ({sealInfo.numberOfEvaluations})
                    </span>
                  )}
                  <span className="hidden group-hover:inline text-[10px] font-medium opacity-80">
                    · saiba mais
                  </span>
                </button>
              )}
              {isGPTWCompatible && (
                <a
                  href={GPTW_INFO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Esta empresa é GPTW compatível. Clique para saber o que é o Great Place to Work."
                  aria-label="Selo GPTW compatível — saber mais sobre o Great Place to Work"
                  className="group mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l2.39 4.84L20 7.27l-3.86 3.76.91 5.31L12 13.77l-5.05 2.57.91-5.31L4 7.27l5.61-.43L12 2z" />
                  </svg>
                  GPTW Compatível
                  <span className="hidden group-hover:inline text-[10px] font-medium opacity-80">
                    · saiba mais
                  </span>
                </a>
              )}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400 dark:text-slate-500">CNPJ:</span> {formatCnpj(company.cnpj)}</div>
                <div><span className="text-slate-400 dark:text-slate-500">CNAE:</span> {cnaeCodigo || "—"}{cnaeDescricao ? ` · ${cnaeDescricao}` : ""}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Setor (divisão):</span> {setor || "—"}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Plano:</span>{" "}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isPremium
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : trialActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {isPremium
                      ? "Premium"
                      : trialActive
                      ? `Trial Premium · ${trialDaysLeft} ${trialDaysLeft === 1 ? "dia" : "dias"} restantes`
                      : "Free"}
                  </span>
                </div>
              </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/")}
                aria-label="Voltar para a página inicial"
                className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Página inicial
              </button>
              <button
                type="button"
                onClick={() => navigate(
                  company?.id
                    ? `/empresa/perfil?cid=${encodeURIComponent(company.id)}&edit=1`
                    : "/empresa/perfil?edit=1"
                )}
                className="h-10 px-4 rounded-lg font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar Perfil da Empresa
              </button>
              <button
                type="button"
                onClick={() => navigate(
                  company?.id
                    ? `/empresa/perfil?cid=${encodeURIComponent(company.id)}`
                    : "/empresa/perfil"
                )}
                className="h-10 px-4 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Ver perfil público
              </button>
            </div>
          </div>
        </section>

        {/* Status na Receita Federal (BrasilAPI) */}
        <section
          aria-label="Situação da empresa na Receita Federal"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Situação na Receita Federal
            </h2>
            {receitaData?.atualizadoEm && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Atualizado em {new Date(receitaData.atualizadoEm).toLocaleString("pt-BR")}
              </span>
            )}
          </div>

          {receitaLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" />
              </svg>
              Consultando Receita Federal...
            </div>
          )}

          {!receitaLoading && receitaError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
            >
              {receitaError}
            </div>
          )}

          {!receitaLoading && !receitaError && receitaData && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                    receitaData.hasFiscalIssues
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      receitaData.hasFiscalIssues ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    aria-hidden="true"
                  />
                  {receitaData.situacaoCadastral || "—"}
                </span>
                {receitaData.dataSituacaoCadastral && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    desde {receitaData.dataSituacaoCadastral}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {receitaData.razaoSocial && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Razão social</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{receitaData.razaoSocial}</dd>
                  </div>
                )}
                {receitaData.nomeFantasia && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Nome fantasia</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{receitaData.nomeFantasia}</dd>
                  </div>
                )}
                {(receitaData.municipio || receitaData.uf) && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Município / UF</dt>
                    <dd className="text-slate-700 dark:text-slate-200">
                      {[receitaData.municipio, receitaData.uf].filter(Boolean).join(" / ")}
                    </dd>
                  </div>
                )}
                {receitaData.porte && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Porte</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{receitaData.porte}</dd>
                  </div>
                )}
                {receitaData.naturezaJuridica && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Natureza jurídica</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{receitaData.naturezaJuridica}</dd>
                  </div>
                )}
                {receitaData.dataAbertura && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Abertura</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{receitaData.dataAbertura}</dd>
                  </div>
                )}
              </dl>

              {receitaData.hasFiscalIssues && receitaData.issues?.length > 0 && (
                <div className="rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-4 py-3">
                  <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
                    Pendências detectadas
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-rose-800 dark:text-rose-200 space-y-0.5">
                    {receitaData.issues.map((iss, idx) => (
                      <li key={idx}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Fonte: BrasilAPI · dados públicos da Receita Federal.
              </p>
            </div>
          )}
        </section>

        {/* Avaliações */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Avaliações recebidas</h2>
            <div className="flex items-center gap-3">
              <StarRow value={overallAvg} />
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{overallAvg.toFixed(1)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"})
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criteriaAverages.map((c) => (
              <div
                key={c.key}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
                <div className="flex items-center gap-2">
                  <StarRow value={c.avg} size="h-4 w-4" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-9 text-right">
                    {c.count ? c.avg.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {reviews.length === 0 && (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400 text-center">
              Ainda não há avaliações para esta empresa.
            </p>
          )}
        </section>

        {/* Resumo: pontos positivos e negativos */}
        {reviews.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Resumo das avaliações</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Total de {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"} · Nota média {overallAvg.toFixed(1)}/5
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <h3 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                  Principais pontos positivos
                </h3>
                {topPositivos.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-100/80">Sem dados suficientes.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {topPositivos.map((c) => (
                      <li key={c.key} className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">{c.label}</span>
                        <span className="font-bold text-emerald-900 dark:text-emerald-100">{c.avg.toFixed(1)}/5</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4">
                <h3 className="text-sm font-extrabold text-rose-800 dark:text-rose-200 uppercase tracking-wider">
                  Principais pontos a melhorar
                </h3>
                {topNegativos.length === 0 ? (
                  <p className="mt-2 text-sm text-rose-900/80 dark:text-rose-100/80">Sem dados suficientes.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {topNegativos.map((c) => (
                      <li key={c.key} className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-rose-900 dark:text-rose-100">{c.label}</span>
                        <span className="font-bold text-rose-900 dark:text-rose-100">{c.avg.toFixed(1)}/5</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Seção 2: Dicas e Boas Práticas para sua Empresa (Gratuito) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Dicas e Boas Práticas para sua Empresa
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Orientações para transformar avaliações em ações concretas e proteger a marca empregadora.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                Ajuste os pontos negativos com responsabilidade
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                Ignorar críticas recorrentes pode custar caro: <strong>perda de clientes</strong>, <strong>fuga de bons
                profissionais</strong> e <strong>processos judiciais</strong>. Use as avaliações como insumo concreto
                para melhoria contínua — não como motivo para retaliação.
              </p>
            </div>
            <div className="rounded-2xl border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-blue-900 dark:text-blue-200">
                Avalie o profissional como uma vida
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">
                Decisões tomadas sobre pessoas afetam <strong>vidas inteiras</strong> — saúde, família, dignidade.
                Antes de agir com base em opiniões individuais, verifique se a decisão está alinhada às <strong>políticas
                e à visão pública da própria empresa</strong>. Coerência protege a marca empregadora e respeita quem
                trabalhou com você.
              </p>
            </div>
          </div>
        </section>

        {/* Seção 3: Quadro de funcionários (Gratuito) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quadro de funcionários</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Informe a quantidade atual de profissionais contratados em cada modalidade. Esta informação ajuda a
            contextualizar suas avaliações e o comparativo de setor.
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Funcionários PJ</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={employees.pj}
                onChange={(e) => { setEmployees((p) => ({ ...p, pj: e.target.value })); setEmployeesSaved(false); }}
                placeholder="Ex.: 12"
                className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Funcionários CLT</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={employees.clt}
                onChange={(e) => { setEmployees((p) => ({ ...p, clt: e.target.value })); setEmployeesSaved(false); }}
                placeholder="Ex.: 38"
                className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            {employeesSaved && (
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Salvo!</span>
            )}
            <button
              type="button"
              onClick={handleSaveEmployees}
              disabled={savingEmployees}
              style={{ backgroundColor: savingEmployees ? undefined : "#1a237e" }}
              className={`h-11 px-5 rounded-lg font-bold text-white transition ${
                savingEmployees ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
              }`}
            >
              {savingEmployees ? "Salvando..." : "Salvar quadro de funcionários"}
            </button>
          </div>
        </section>

        {/* Seção 4: Desbloqueie o Potencial da Sua Empresa (Premium) */}
        <section
          aria-label="Recursos do Plano Premium Empresa"
          className="bg-gradient-to-br from-blue-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-xl p-8"
        >
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-3xl leading-none" aria-hidden="true">🚀</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                {effectivePremium ? "Recursos liberados" : "Plano Premium Empresa"}
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                Desbloqueie o Potencial da Sua Empresa com o Plano Premium
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
                Ferramentas avançadas para transformar avaliações em decisões estratégicas, comparar sua empresa com
                pares de mercado e fortalecer a marca empregadora.
              </p>
            </div>
          </div>

          {!effectivePremium && (
            <>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {PREMIUM_FEATURES_SHOWCASE.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none" aria-hidden="true">{f.icon}</span>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                          {f.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {f.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 p-6 text-center">
                <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {PREMIUM_PRICE_LABEL}
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {!trialUsed ? (
                    <button
                      type="button"
                      onClick={handleStartTrial}
                      disabled={startingTrial}
                      className={`h-12 px-6 rounded-lg font-bold text-white transition w-full sm:w-auto ${
                        startingTrial
                          ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                          : "bg-amber-600 hover:bg-amber-700"
                      }`}
                    >
                      {startingTrial
                        ? "Ativando..."
                        : `Experimentar Grátis por ${PREMIUM_TRIAL_DAYS} dias`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate("/escolha-perfil")}
                      style={{ backgroundColor: "#1a237e" }}
                      className="h-12 px-6 rounded-lg font-bold text-white hover:brightness-110 transition w-full sm:w-auto"
                    >
                      Assinar Plano Premium
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/escolha-perfil")}
                    className="h-12 px-6 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition w-full sm:w-auto"
                  >
                    Ver detalhes do plano
                  </button>
                </div>
                {!trialUsed && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Sem cobrança · Sem cartão de crédito · Cancele quando quiser
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Comparativo CNAE (Premium) */}
        {effectivePremium && (
        <section className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Comparativo com empresas do mesmo CNAE
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Como sua nota geral se compara à média do setor {cnaeDescricao ? `“${cnaeDescricao}”` : `(CNAE ${cnaeCodigo || "—"})`}.
          </p>

          <div className={`mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 ${effectivePremium ? "" : "blur-sm select-none pointer-events-none"}`}>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sua média</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">{overallAvg.toFixed(1)}</div>
              <StarRow value={overallAvg} size="h-4 w-4" />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Média do setor</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                {peerStats?.count ? peerStats.avg.toFixed(1) : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {peerStats?.count ? `${peerStats.count} avaliações de pares` : "Sem dados suficientes"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Diferença</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                {peerStats?.count
                  ? `${overallAvg >= peerStats.avg ? "+" : ""}${(overallAvg - peerStats.avg).toFixed(1)}`
                  : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">vs. média de pares</div>
            </div>
          </div>

          {!effectivePremium && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                  PLANO PREMIUM EMPRESA
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                  Comparativo de setor disponível no Premium
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full h-11 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                >
                  Fazer upgrade (em breve)
                </button>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Relatório executivo (Premium) */}
        {effectivePremium && (
        <section className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Relatório executivo</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Síntese mensal pronta para apresentação à diretoria, com pontos fortes, oportunidades e plano de ação.
          </p>

          <div className={`mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-6 ${effectivePremium ? "" : "blur-sm select-none pointer-events-none"}`}>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li>• Resumo de avaliações e tendências do mês</li>
              <li>• Top 3 forças e top 3 oportunidades por critério</li>
              <li>• Benchmark vs. setor (CNAE) e porte da empresa</li>
              <li>• Recomendações priorizadas de ação</li>
            </ul>
            {effectivePremium && (
              <button
                type="button"
                style={{ backgroundColor: "#1a237e" }}
                className="mt-4 h-11 px-5 rounded-lg font-bold text-white hover:brightness-110"
              >
                Gerar relatório do mês
              </button>
            )}
          </div>

          {!effectivePremium && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                  PLANO PREMIUM EMPRESA
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                  Relatório executivo no Premium
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full h-11 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                >
                  Fazer upgrade (em breve)
                </button>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Gerenciar comentários (Premium) */}
        {effectivePremium && (
        <CompanyCommentsManager
          isPremium={effectivePremium}
          reviews={reviews}
          criteria={CRITERIA}
          replyDrafts={replyDrafts}
          replyingId={replyingId}
          onReplyChange={(reviewId, text) =>
            setReplyDrafts((prev) => ({ ...prev, [reviewId]: text }))
          }
          onSubmitReply={handleSubmitReply}
          onUpgradeClick={() => navigate("/escolha-perfil")}
        />
        )}

        {/* Recursos Premium: respostas, apoio e profissionais compatíveis */}
        {effectivePremium && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Recursos Premium</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Responda às avaliações, solicite apoio especializado e conheça profissionais compatíveis com sua empresa.
              </p>
            </div>
            {effectivePremium && (
              <button
                type="button"
                onClick={() => { setShowSupportModal(true); setSupportSent(false); }}
                style={{ backgroundColor: "#1a237e" }}
                className="h-11 px-5 rounded-lg font-bold text-white hover:brightness-110"
              >
                Solicitar apoio
              </button>
            )}
          </div>

          {!effectivePremium ? (
            <div className="mt-6 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-6 text-center">
              <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                PLANO PREMIUM EMPRESA
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">
                Disponível apenas para assinantes Premium
              </h3>
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <li>✓ Responder publicamente às avaliações recebidas</li>
                <li>✓ Solicitar apoio de consultores especializados</li>
                <li>✓ Acesso à rede de profissionais compatíveis</li>
              </ul>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
              </p>
              <button
                type="button"
                disabled
                className="mt-4 h-11 px-5 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
              >
                Assinar Premium (em breve)
              </button>
            </div>
          ) : (
            <>
              {/* Responder a comentários */}
              <div className="mt-6">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Responder a comentários
                </h3>
                {reviews.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Ainda não há avaliações para responder.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {reviews.slice(0, 10).map((r) => {
                      const draft = replyDrafts[r.id] || "";
                      const submitting = replyingId === r.id;
                      const existing = r.companyResponse?.text || "";
                      return (
                        <li
                          key={r.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4"
                        >
                          <div className="flex items-center gap-2">
                            <StarRow value={Number(r.rating) || 0} size="h-4 w-4" />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {(Number(r.rating) || 0).toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              · {r.pseudonimo || r.userName || "Avaliador anônimo"}
                            </span>
                          </div>
                          {r.generalComment || r.comment ? (
                            <RestrictedComment
                              comment={r.generalComment || r.comment}
                              restrictedSegments={r.restrictedSegments}
                              className="mt-2 text-sm text-slate-700 dark:text-slate-200"
                            />
                          ) : (
                            <p className="mt-2 text-sm italic text-slate-400 dark:text-slate-500">
                              (Sem comentário escrito.)
                            </p>
                          )}

                          {existing ? (
                            <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                                Resposta da empresa
                              </div>
                              <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                                {existing}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <textarea
                                rows={3}
                                value={draft}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                                placeholder="Escreva uma resposta pública e respeitosa…"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSubmitReply(r.id)}
                                  disabled={submitting || !draft.trim()}
                                  style={{ backgroundColor: submitting || !draft.trim() ? undefined : "#1a237e" }}
                                  className={`h-10 px-4 rounded-lg font-bold text-white transition ${
                                    submitting || !draft.trim()
                                      ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                                      : "hover:brightness-110"
                                  }`}
                                >
                                  {submitting ? "Enviando..." : "Enviar resposta"}
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Profissionais de apoio compatíveis */}
              <div className="mt-8">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Profissionais compatíveis
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Especialistas selecionados que podem ajudar sua empresa a evoluir nos pontos críticos das avaliações.
                </p>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SUPPORT_PROFESSIONALS_PLACEHOLDER.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4"
                    >
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{p.name}</div>
                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-0.5">{p.role}</div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{p.specialty}</p>
                      <a
                        href={`mailto:${p.contact}`}
                        className="mt-3 inline-block text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline break-all"
                      >
                        {p.contact}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
        )}

        {/* Linha Direta com Apoiadores Premium (somente Premium) */}
        {effectivePremium && (
          <section className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 rounded-2xl shadow-xl border border-indigo-200 dark:border-indigo-800 p-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-2xl" aria-hidden="true">
                  💬
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-indigo-700 text-white text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full">
                    EXCLUSIVO PREMIUM
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-100">
                    Linha Direta com Apoiadores Premium
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                    Acesso prioritário a apoiadores especializados em cultura organizacional, RH e gestão de pessoas.
                    Tire dúvidas, agende consultorias e receba orientações sob medida para sua empresa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHotlineModal(true)}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700"
              >
                <span aria-hidden="true">💬</span>
                Contactar Apoiador Premium via WhatsApp
              </button>
            </div>
          </section>
        )}

        {/* Modal "Linha Direta com Apoiadores Premium" via WhatsApp */}
        {effectivePremium && showHotlineModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Fale com um Apoiador Premium via WhatsApp"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
            onClick={(e) => { if (e.target === e.currentTarget) setShowHotlineModal(false); }}
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Fale com um Apoiador Premium via WhatsApp
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Entre em contato diretamente com nossos apoiadores especializados para suas necessidades. Clique no
                botão abaixo para iniciar uma conversa no WhatsApp.
              </p>
              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHotlineModal(false)}
                  className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Fechar
                </button>
                <a
                  href={premiumSupporterWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowHotlineModal(false)}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  <span aria-hidden="true">💬</span>
                  Iniciar Conversa no WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Modal "Solicitar apoio" */}
        {effectivePremium && showSupportModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Solicitar apoio"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Solicitar apoio</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Conte brevemente em que sua empresa precisa de apoio. Nossa equipe entrará em contato pelo e-mail
                cadastrado.
              </p>
              {supportSent ? (
                <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                  ✅ Solicitação enviada! Em breve um especialista entrará em contato.
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Ex.: Gostaríamos de apoio para melhorar comunicação interna após avaliações negativas neste critério."
                  className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {supportSent ? "Fechar" : "Cancelar"}
                </button>
                {!supportSent && (
                  <button
                    type="button"
                    onClick={handleRequestSupport}
                    disabled={sendingSupport}
                    style={{ backgroundColor: sendingSupport ? undefined : "#1a237e" }}
                    className={`h-10 px-4 rounded-lg font-bold text-white transition ${
                      sendingSupport ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
                    }`}
                  >
                    {sendingSupport ? "Enviando..." : "Enviar solicitação"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Configurações */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configurações do perfil</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Preferências básicas. Para editar nome, logo, redes sociais e demais dados, use o botão "Editar Perfil da Empresa" no topo do dashboard.
          </p>

          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Notificar por e-mail novas avaliações</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Você recebe um aviso assim que uma avaliação pública for publicada.</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.notifyOnReview}
                onChange={(e) => setPrefs({ ...prefs, notifyOnReview: e.target.checked })}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Perfil público visível</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Permite que sua empresa apareça nas listagens e buscas.</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.publicProfile}
                onChange={(e) => setPrefs({ ...prefs, publicProfile: e.target.checked })}
                className="h-5 w-5"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(
                company?.id
                  ? `/empresa/perfil?cid=${encodeURIComponent(company.id)}&edit=1`
                  : "/empresa/perfil?edit=1"
              )}
              className="h-11 px-4 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Editar Perfil da Empresa
            </button>
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={savingPrefs}
              style={{ backgroundColor: savingPrefs ? undefined : "#1a237e" }}
              className={`h-11 px-5 rounded-lg font-bold text-white transition ${
                savingPrefs ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
              }`}
            >
              {savingPrefs ? "Salvando..." : "Salvar preferências"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
