import React, { useCallback, useEffect, useMemo, useState } from "react";
import RestrictedComment from "../components/RestrictedComment";
import WorkPeriodBadge from "../components/WorkPeriodBadge";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, storage } from "../firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const PREMIUM_PRICE_LABEL = "R$ 1.499,99/mês";
const PREMIUM_AVAILABLE_AT = "01/08/2026";
const FREE_REPLY_LIMIT = 3;

const LOCKED_METRICS = [
  {
    title: "Comparativo com concorrentes",
    description: "Veja como sua empresa se posiciona frente a outras do mesmo setor.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Tendências do setor",
    description: "Acompanhe a evolução de clima e reputação no seu segmento.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Relatório executivo",
    description: "Documento mensal pronto para apresentação à diretoria.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    title: "Benchmark de reputação",
    description: "Compare métricas-chave com empresas do mesmo porte e região.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

function formatCnpj(value) {
  const v = (value || "").toString().replace(/\D/g, "").slice(0, 14);
  if (v.length !== 14) return value || "";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function StarRow({ value = 0, size = "h-5 w-5" }) {
  const rounded = Math.round((value || 0) * 2) / 2;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = rounded >= i;
        const half = !filled && rounded >= i - 0.5;
        return (
          <svg
            key={i}
            className={`${size} ${filled || half ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : half ? "url(#halfGrad)" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {half && (
              <defs>
                <linearGradient id="halfGrad">
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
}

export default function CompanyProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  // companyId pode vir via query string (?cid=...) ao navegar do Dashboard.
  const companyIdFromUrl = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return (sp.get("cid") || sp.get("companyId") || "").trim();
    } catch {
      return "";
    }
  }, [location.search]);
  console.log("[CompanyProfile] render", {
    cidFromUrl: companyIdFromUrl,
    pathname: location.pathname,
    search: location.search,
  });
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [replies, setReplies] = useState({}); // { [reviewId]: replyText }
  const [savingReplyId, setSavingReplyId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState("idle");

  // Auth ready
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Carrega empresa: prioridade =>
  //   1) `?cid=<docId>` na URL (vindo do Dashboard "Ver perfil público")
  //   2) busca por `ownerUid == user.uid` (escolhendo o doc mais completo)
  //   3) busca por `email == user.email` (escolhendo o doc mais completo)
  //   4) sem registro → retorna null (sem criar stub no Firestore)
  const loadCompany = useCallback(async (currentUser) => {
    if (!currentUser && !companyIdFromUrl) return null;
    setLoading(true);

    // Mesma heurística do EmpresaDashboard: prioriza doc com cnpj/razaoSocial.
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
      console.log("[CompanyProfile] loadCompany start", {
        cid: companyIdFromUrl,
        uid: currentUser?.uid,
        email: currentUser?.email,
      });
      let data = null;
      let docId = null;

      // 1) carregar pelo companyId da URL.
      if (companyIdFromUrl) {
        try {
          const snap = await getDoc(doc(db, "companies", companyIdFromUrl));
          if (snap.exists()) {
            data = snap.data();
            docId = snap.id;
            console.log("[CompanyProfile] empresa carregada por cid", { docId, data });
          } else {
            console.warn("[CompanyProfile] cid não encontrado em /companies", companyIdFromUrl);
          }
        } catch (err) {
          console.warn("[CompanyProfile] erro ao buscar por cid", err);
        }
      }

      // 2) ownerUid + 3) email — coleta todos e escolhe o melhor.
      if (!data && currentUser) {
        const collected = [];
        if (currentUser.uid) {
          try {
            const snap = await getDocs(query(collection(db, "companies"), where("ownerUid", "==", currentUser.uid)));
            snap.docs.forEach((d) => collected.push({ id: d.id, data: d.data(), source: "ownerUid" }));
          } catch {
            // ignora
          }
        }
        if (currentUser.email) {
          try {
            const snap = await getDocs(query(collection(db, "companies"), where("email", "==", currentUser.email)));
            snap.docs.forEach((d) => {
              if (!collected.some((c) => c.id === d.id)) {
                collected.push({ id: d.id, data: d.data(), source: "email" });
              }
            });
          } catch {
            // ignora
          }
        }
        console.log("[CompanyProfile] candidatos", collected.map((c) => ({
          id: c.id,
          source: c.source,
          score: scoreDoc(c.data),
          razaoSocial: c.data?.razaoSocial,
          cnpj: c.data?.cnpj,
        })));
        const best = pickBest(collected);
        if (best) {
          data = best.data;
          docId = best.id;
          console.log("[CompanyProfile] doc escolhido", { docId, source: best.source });
        }
      }

      if (data) {
        setCompany({ id: docId, ...data });
        return { id: docId, ...data };
      }
      // 4) Sem registro — não criamos stub no Firestore. Apenas retornamos null;
      // a UI exibirá "Empresa não encontrada" e o usuário deverá concluir o cadastro.
      console.warn("[CompanyProfile] nenhum doc de empresa encontrado para este usuário");
      setCompany(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [companyIdFromUrl]);

  useEffect(() => {
    if (!authReady) return;
    if (!user && !companyIdFromUrl) {
      setLoading(false);
      return;
    }
    loadCompany(user);
  }, [authReady, user, companyIdFromUrl, loadCompany]);

  // Carrega comentários públicos referentes à empresa
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
        const docsMap = new Map();
        for (const q of candidates) {
          try {
            const snap = await getDocs(q);
            snap.docs.forEach((d) => docsMap.set(d.id, { id: d.id, ...d.data() }));
          } catch {
            // segue
          }
        }
        const list = Array.from(docsMap.values()).sort(
          (a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt)
        );
        setReviews(list);
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
      }
    }
    fetchReviews();
  }, [company]);

  const isPremium = company?.plan === "premium";
  // Trial Premium ativo: empresário com `isPremiumTrialActive=true` e
  // `premiumTrialEndDate` ainda no futuro deve ter o mesmo acesso de
  // métricas avançadas que um Premium pago.
  const trialEndMs = useMemo(() => {
    const v = company?.premiumTrialEndDate;
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }, [company?.premiumTrialEndDate]);
  const trialActive =
    !!company?.isPremiumTrialActive && trialEndMs > Date.now();
  const effectivePremium = isPremium || trialActive;
  const isVerified = !!company?.verified || !!user?.emailVerified;

  const visibleReviews = useMemo(() => {
    if (isPremium) return reviews;
    return reviews.slice(0, 3);
  }, [isPremium, reviews]);

  const avg = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((acc, r) => acc + (Number(r.rating) || Number(r.media) || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  const repliesUsed = Number(company?.repliesUsedThisMonth || 0);
  const repliesRemaining = isPremium ? Infinity : Math.max(0, FREE_REPLY_LIMIT - repliesUsed);

  const openEdit = () => {
    if (!company) return;
    const initial = {
      razaoSocial: company.razaoSocial || "",
      cnpj: company.cnpj || "",
      ramo: company.ramo || "",
      location: company.location || "",
      site: company.site || "",
      linkedin: company.socials?.linkedin || "",
      instagram: company.socials?.instagram || "",
    };
    console.log("[CompanyProfile] openEdit — pre-preenchendo formulário com", initial);
    setEditForm(initial);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editForm) return;
    setSavingEdit(true);
    try {
      // Usa o id real do doc da empresa quando disponível; senão cai para o uid.
      const targetId = company?.id || user.uid;
      const ref = doc(db, "companies", targetId);
      const payload = {
        ownerUid: company?.ownerUid || user.uid,
        email: user.email || company?.email || "",
        razaoSocial: editForm.razaoSocial.trim(),
        cnpj: (editForm.cnpj || "").replace(/\D/g, ""),
        ramo: editForm.ramo.trim(),
        location: editForm.location.trim(),
        site: editForm.site.trim(),
        socials: {
          linkedin: editForm.linkedin.trim(),
          instagram: editForm.instagram.trim(),
        },
        updatedAt: serverTimestamp(),
      };
      console.log("[CompanyProfile] salvando edição", { targetId, payload });
      await setDoc(ref, payload, { merge: true });
      setCompany((prev) => ({ ...(prev || {}), ...payload, id: targetId }));
      setEditOpen(false);
    } catch (err) {
      console.error("Erro ao salvar empresa:", err);
      alert("Não foi possível salvar as informações. Tente novamente.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLogoUploading(true);
    try {
      const targetId = company?.id || user.uid;

      // Preferimos Firebase Storage para evitar inflar o doc do Firestore
      // com base64. Em caso de falha (regras/CORS), caimos para dataURL.
      let logoUrl = "";
      try {
        const safeName = (file.name || "logo").replace(/[^\w.\-]+/g, "_");
        const path = `companyLogos/${targetId}/${Date.now()}-${safeName}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file, { contentType: file.type || "image/*" });
        logoUrl = await getDownloadURL(sRef);
      } catch (storageErr) {
        console.warn("[CompanyProfile] falha no Storage; usando dataURL", storageErr);
        const reader = new FileReader();
        logoUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const ref = doc(db, "companies", targetId);
      await setDoc(
        ref,
        { ownerUid: company?.ownerUid || user.uid, logoUrl, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setCompany((prev) => ({ ...(prev || {}), logoUrl }));
    } catch (err) {
      console.error("Erro no upload do logo:", err);
      alert("Falha ao enviar o logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleReply = async (reviewId) => {
    const text = (replies[reviewId] || "").trim();
    if (!text || !user) return;
    if (!isPremium && repliesRemaining <= 0) {
      alert("Você atingiu o limite de 3 respostas no plano gratuito. Faça upgrade para Premium.");
      return;
    }
    setSavingReplyId(reviewId);
    try {
      await updateDoc(doc(db, "reviews", reviewId), {
        companyReply: {
          text,
          authorUid: user.uid,
          createdAt: serverTimestamp(),
        },
      });
      if (!isPremium) {
        await setDoc(
          doc(db, "companies", user.uid),
          { ownerUid: user.uid, repliesUsedThisMonth: repliesUsed + 1 },
          { merge: true }
        );
        setCompany((prev) => ({ ...(prev || {}), repliesUsedThisMonth: repliesUsed + 1 }));
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, companyReply: { text, authorUid: user.uid, createdAt: new Date() } }
            : r
        )
      );
      setReplies((prev) => ({ ...prev, [reviewId]: "" }));
    } catch (err) {
      console.error("Erro ao responder:", err);
      alert("Não foi possível enviar a resposta.");
    } finally {
      setSavingReplyId(null);
    }
  };

  const handleWaitlist = async (e) => {
    e.preventDefault();
    const email = waitlistEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistStatus("invalid");
      return;
    }
    setWaitlistStatus("saving");
    try {
      await addDoc(collection(db, "waitlist_empresa"), {
        email,
        timestamp: serverTimestamp(),
        ownerUid: user?.uid || null,
        cnpj: company?.cnpj || null,
      });
      setWaitlistStatus("ok");
      setWaitlistEmail("");
    } catch (err) {
      console.error("Erro ao salvar waitlist:", err);
      setWaitlistStatus("error");
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

  // Perfil público: acessível a qualquer visitante quando houver `?cid=` na URL.
  // Só exibimos a tela "Acesso restrito" quando não há cid na URL E não há usuário
  // logado (ou seja, não há nenhuma forma de identificar qual empresa carregar).
  if (!user && !companyIdFromUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">Selecione uma empresa</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Para ver um perfil público, abra-o a partir do dashboard ou da lista de empresas.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Voltar para a página inicial
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Não foi possível localizar os dados desta empresa.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Voltar para a página inicial
          </button>
        </div>
      </div>
    );
  }

  // Visitantes (não logados ou logados que não são donos) não podem editar nem responder.
  const isOwner = !!user && (company?.ownerUid === user.uid || company?.email === user.email);

  const labelClass = "block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";
  const inputClass =
    "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Logo + upload */}
            <div className="shrink-0">
              {isOwner ? (
                <label className="relative block w-28 h-28 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 cursor-pointer group">
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo da empresa" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span className="text-[11px] mt-1">Adicionar logo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                  />
                  {logoUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    </div>
                  )}
                </label>
              ) : (
                <div className="relative block w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt={`Logo de ${company?.razaoSocial || "empresa"}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span className="text-[11px] mt-1">Sem logo</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                  {company?.razaoSocial || "Empresa sem nome"}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-full">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    EMPRESA VERIFICADA
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400 dark:text-slate-500">CNPJ:</span> {formatCnpj(company?.cnpj) || "—"}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Ramo:</span> {company?.ramo || "—"}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Localização:</span> {company?.location || "—"}</div>
                <div className="truncate">
                  <span className="text-slate-400 dark:text-slate-500">Site:</span>{" "}
                  {company?.site ? (
                    <a href={company.site} target="_blank" rel="noreferrer" className="text-blue-700 dark:text-blue-300 hover:underline">
                      {company.site}
                    </a>
                  ) : "—"}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {company?.socials?.linkedin && (
                  <a href={company.socials.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-700 dark:text-blue-300 hover:underline">
                    LinkedIn
                  </a>
                )}
                {company?.socials?.instagram && (
                  <a href={company.socials.instagram} target="_blank" rel="noreferrer" className="text-xs text-blue-700 dark:text-blue-300 hover:underline">
                    Instagram
                  </a>
                )}
              </div>

              <div className="mt-5">
                {isOwner && (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="inline-flex items-center gap-2 px-4 h-10 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Editar informações da empresa
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Avaliações */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Avaliações</h2>
            <div className="flex items-center gap-3">
              <StarRow value={avg} />
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {avg.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"})
              </span>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {visibleReviews.length === 0 && (
              <li className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                Ainda não há avaliações públicas para esta empresa.
              </li>
            )}
            {visibleReviews.map((r) => {
              const rating = Number(r.rating) || Number(r.media) || 0;
              const reply = r.companyReply;
              const replyText = replies[r.id] || "";
              const canReply = isPremium || repliesRemaining > 0;
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                        {r.pseudonym || r.author || "Anônimo"}
                      </span>
                      <StarRow value={rating} size="h-4 w-4" />
                      <WorkPeriodBadge workPeriod={r.workPeriod} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {r.createdAt ? new Date(toMillis(r.createdAt)).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                  {(r.generalComment || r.comment) && (
                    <RestrictedComment
                      comment={r.generalComment || r.comment}
                      restrictedSegments={r.restrictedSegments}
                      className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                    />
                  )}

                  {reply?.text ? (
                    <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                      <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 tracking-wider">RESPOSTA DA EMPRESA</div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{reply.text}</p>
                    </div>
                  ) : isOwner ? (
                    <div className="mt-3">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder={canReply ? "Responder publicamente..." : "Limite de respostas grátis atingido este mês"}
                        disabled={!canReply}
                        className={`${inputClass} ${!canReply ? "opacity-60 cursor-not-allowed" : ""}`}
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {isPremium
                            ? "Respostas ilimitadas (Premium)"
                            : `Restam ${repliesRemaining} de ${FREE_REPLY_LIMIT} respostas neste mês`}
                        </span>
                        <button
                          type="button"
                          disabled={!canReply || !replyText.trim() || savingReplyId === r.id}
                          onClick={() => handleReply(r.id)}
                          style={{ backgroundColor: canReply && replyText.trim() ? "#1a237e" : undefined }}
                          className={`h-10 px-4 rounded-lg font-bold text-white transition ${
                            canReply && replyText.trim()
                              ? "hover:brightness-110"
                              : "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                          }`}
                        >
                          {savingReplyId === r.id ? "Enviando..." : "Responder"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {!isPremium && reviews.length > 3 && (
            <div className="mt-5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-200 text-center">
              Você está vendo as 3 avaliações mais recentes. Faça upgrade para o plano <b>Premium Empresa</b> para ver todas.
            </div>
          )}
        </section>

        {/* Métricas (bloqueado) */}
        <section className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Métricas avançadas</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Indicadores estratégicos para sua gestão de pessoas e reputação.
          </p>

          <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 ${effectivePremium ? "" : "blur-sm select-none pointer-events-none"}`}>
            {LOCKED_METRICS.map((m, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {m.icon}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.title}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-snug">{m.description}</p>
              </div>
            ))}
          </div>

          {!effectivePremium && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                  PLANO PREMIUM EMPRESA
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                  Disponível no Plano Premium Empresa
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>

                <button
                  type="button"
                  disabled
                  className="mt-5 w-full h-11 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                >
                  Disponível em breve
                </button>

                <form onSubmit={handleWaitlist} className="mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => {
                      setWaitlistEmail(e.target.value);
                      setWaitlistStatus("idle");
                    }}
                    placeholder="seu@email.com"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={waitlistStatus === "saving"}
                    style={{ backgroundColor: "#1a237e" }}
                    className="h-12 px-4 rounded-lg font-bold text-white hover:brightness-110 disabled:opacity-60 transition"
                  >
                    {waitlistStatus === "saving" ? "Salvando..." : "Me avisar"}
                  </button>
                </form>
                {waitlistStatus === "ok" && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    Tudo certo! Avisaremos você assim que o plano estiver disponível.
                  </p>
                )}
                {waitlistStatus === "invalid" && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">Informe um e-mail válido.</p>
                )}
                {waitlistStatus === "error" && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível salvar. Tente novamente.</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Painel de respostas (resumo) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Respostas públicas</h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isPremium
                ? "Plano Premium · respostas ilimitadas"
                : `Plano Free · ${repliesUsed}/${FREE_REPLY_LIMIT} respostas usadas neste mês`}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Use o campo de resposta abaixo de cada avaliação na seção acima para responder publicamente.
            No plano Free você pode publicar até <b>{FREE_REPLY_LIMIT} respostas por mês</b>; no Premium, sem limites.
          </p>
        </section>
      </div>

      {/* Modal de edição */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar informações da empresa</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className={labelClass}>Logo da empresa</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {company?.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt="Logo atual"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center px-1">
                        Sem logo
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="inline-flex items-center gap-2 px-4 h-10 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                      {logoUploading ? "Enviando..." : (company?.logoUrl ? "Trocar logo" : "Enviar logo")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={logoUploading}
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      PNG, JPG ou SVG. Recomendado: 256×256px.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Razão Social</label>
                <input
                  type="text"
                  value={editForm.razaoSocial}
                  onChange={(e) => setEditForm({ ...editForm, razaoSocial: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>CNPJ</label>
                <input
                  type="text"
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ramo de atuação</label>
                <input
                  type="text"
                  value={editForm.ramo}
                  onChange={(e) => setEditForm({ ...editForm, ramo: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Localização</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Site</label>
                <input
                  type="url"
                  value={editForm.site}
                  onChange={(e) => setEditForm({ ...editForm, site: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>LinkedIn</label>
                <input
                  type="url"
                  value={editForm.linkedin}
                  onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Instagram</label>
                <input
                  type="url"
                  value={editForm.instagram}
                  onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="h-11 px-4 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ backgroundColor: savingEdit ? undefined : "#1a237e" }}
                className={`h-11 px-5 rounded-lg font-bold text-white transition ${
                  savingEdit ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
                }`}
              >
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
