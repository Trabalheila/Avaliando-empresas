import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy, where, increment } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { isPremium as checkUserIsPremium, getUserRole } from "../utils/rbac";
import AppHeader from "../components/AppHeader";
import ConsultationModal from "../components/ConsultationModal";
import { getConsultationPrice, getRatingLabel } from "../data/consultationPricing";

const TIPO_LABELS = { consultor: "Consultor de RH", advogado: "Advogado Trabalhista", prestador: "Prestador de Serviços" };
const STARS = [1, 2, 3, 4, 5];

function BRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function StarDisplay({ rating, size = "w-5 h-5" }) {
  return (
    <span className="inline-flex gap-0.5">
      {STARS.map((s) => (
        <svg key={s} className={`${size} ${s <= Math.round(rating) ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-1">
      {STARS.map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none"
        >
          <svg className={`w-7 h-7 transition ${s <= (hover || value) ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

function ApoiadorPerfil({ theme, toggleTheme }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [apoiador, setApoiador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState([]);

  /* ── Formulário de avaliação ── */
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [hasConsultation, setHasConsultation] = useState(false);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const userIsPremium = checkUserIsPremium();
  const userRole = getUserRole();
  const viewerAudience = userRole === "empresa" || userRole === "admin_empresa" ? "employer" : "worker";

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "apoiadores", id));
        if (snap.exists()) {
          setApoiador({ id: snap.id, ...snap.data() });

          /* Incrementar visualizações */
          updateDoc(doc(db, "apoiadores", id), { visualizacoes: increment(1) }).catch(() => {});

          /* Carregar avaliações */
          const avSnap = await getDocs(query(collection(db, "apoiadores", id, "avaliacoes"), orderBy("dataCriacao", "desc")));
          setAvaliacoes(avSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

          /* Verificar se o usuário já avaliou */
          const uid = auth.currentUser?.uid;
          if (uid) {
            const dupSnap = await getDocs(query(collection(db, "apoiadores", id, "avaliacoes"), where("autorId", "==", uid)));
            if (!dupSnap.empty) setAlreadyReviewed(true);

            /* Verificar se o usuário já realizou consulta com este apoiador.
               Só quem consultou (e pagou) pode avaliar. */
            try {
              const consSnap = await getDocs(
                query(
                  collection(db, "consultas"),
                  where("apoiadorId", "==", id),
                  where("workerId", "==", uid)
                )
              );
              setHasConsultation(!consSnap.empty);
            } catch {
              setHasConsultation(false);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar apoiador:", err);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSubmitReview = useCallback(async (e) => {
    e.preventDefault();
    if (newRating === 0) return;
    setReviewError("");
    setSubmittingReview(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);

      /* Verificar se é Premium */
      if (!userIsPremium) {
        setReviewError("Apenas usuários Premium podem avaliar Especialistas.");
        setSubmittingReview(false);
        return;
      }

      /* Só pode avaliar quem teve consulta intermediada com este apoiador. */
      if (!hasConsultation) {
        setReviewError("Você precisa realizar uma consulta com este Especialista antes de avaliá-lo.");
        setSubmittingReview(false);
        return;
      }

      /* Verificar duplicidade */
      const uid = auth.currentUser?.uid;
      if (uid) {
        const dupSnap = await getDocs(query(collection(db, "apoiadores", id, "avaliacoes"), where("autorId", "==", uid)));
        if (!dupSnap.empty) {
          setAlreadyReviewed(true);
          setReviewError("Você já avaliou este Especialista.");
          setSubmittingReview(false);
          return;
        }
      }

      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const reviewData = {
        autorId: uid || null,
        autorPseudonimo: profile?.pseudonym || profile?.name || "Anônimo",
        nota: newRating,
        comentario: newComment.trim().slice(0, 200),
        dataCriacao: serverTimestamp(),
      };

      await addDoc(collection(db, "apoiadores", id, "avaliacoes"), reviewData);

      /* Recalcular rating no documento do apoiador */
      const allRatings = [...avaliacoes.map((a) => a.nota || a.rating), newRating];
      const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
      await updateDoc(doc(db, "apoiadores", id), {
        rating: parseFloat(avgRating.toFixed(2)),
        totalAvaliacoes: allRatings.length,
      });

      setApoiador((prev) => prev ? { ...prev, rating: parseFloat(avgRating.toFixed(2)), totalAvaliacoes: allRatings.length } : prev);
      setAvaliacoes((prev) => [{ ...reviewData, id: Date.now().toString(), dataCriacao: { toDate: () => new Date() } }, ...prev]);
      setNewRating(0);
      setNewComment("");
      setAlreadyReviewed(true);
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      setReviewError("Erro ao enviar avaliação. Tente novamente.");
    }
    setSubmittingReview(false);
  }, [id, newRating, newComment, avaliacoes, userIsPremium, hasConsultation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <p className="text-center py-20 text-slate-500">Carregando perfil…</p>
      </div>
    );
  }

  if (!apoiador) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <p className="text-center py-20 text-slate-500">Especialista não encontrado.</p>
      </div>
    );
  }

  const isPremium = apoiador.plano === "premium";
  const isEssencial = apoiador.plano === "essencial" || apoiador.plano === "essential";
  const isGratuito = !isPremium && !isEssencial;
  const consultationPrice = getConsultationPrice(apoiador, viewerAudience);
  const apoiadorTier = isPremium ? "premium" : "essential";
  const ratingLabel = getRatingLabel(apoiador.rating);
  // Indicador de elegibilidade para upgrade: Essencial com avaliação "Excelente"
  // E adExitum=true ganha um destaque visual sugerindo migração ao Premium.
  const eligibleForPremiumUpgrade =
    isEssencial && Math.round(apoiador.rating || 0) === 5 && apoiador.adExitum === true;
  // Selo de profissional verificado:
  //  - Selo aprimorado: registro no conselho aprovado E diploma aprovado.
  //  - Selo base: apenas o registro no conselho aprovado
  //    (ou legacy verificationStatus === "verified").
  //  - Sem selo: registro não aprovado (perfil não ativo).
  const isCouncilVerified =
    apoiador.isCouncilVerified === true ||
    apoiador.verificationStatus === "verified";
  const isDiplomaVerified = apoiador.isDiplomaVerified === true;
  const isVerifiedWithDiploma = isCouncilVerified && isDiplomaVerified;
  const isVerified = isCouncilVerified;
  const nichos = apoiador.nichos || apoiador.areas || apoiador.segmentos || [];
  // Dono do perfil = o próprio especialista logado, identificado pelo
  // match entre o uid do auth e o uid armazenado no doc do apoiador.
  const currentUid = auth.currentUser?.uid || "";
  const ownerUid = apoiador.uid || apoiador.authUid || apoiador.userId || "";
  const isOwner = Boolean(currentUid && ownerUid && currentUid === ownerUid);
  // "Ad Exitum" é um regime de honorários advocatícios — só faz sentido
  // para advogados. Esconde os selos para qualquer outro tipo.
  const isAdvogado = String(apoiador.tipo || "").toLowerCase() === "advogado";
  const showAdExitum = apoiador.adExitum === true && isAdvogado;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {isOwner && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/apoiador/my-contacts")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow transition"
            >
              ← Voltar ao Painel
            </button>
          </div>
        )}
        {/* ── Card do perfil ── */}
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border ${isPremium ? "border-2 border-blue-500 dark:border-blue-400" : "border-slate-200 dark:border-slate-700"}`}>
          <div className="flex items-start gap-4">
            {apoiador.foto ? (
              <img src={apoiador.foto} alt={apoiador.nome} className="h-20 w-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 shrink-0" />
            ) : (
              <span className="h-20 w-20 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-3xl shrink-0">👤</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{apoiador.nome}</h1>
                {isPremium && (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full">
                    ✓ Especialista Premium Verificado
                  </span>
                )}
                {isVerifiedWithDiploma && !isPremium && (
                  <span
                    className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full"
                    title="Registro no conselho de classe e diploma verificados pela equipe."
                  >
                    🎓 Profissional Verificado com Diploma
                  </span>
                )}
                {isVerified && !isVerifiedWithDiploma && !isPremium && (
                  <span
                    className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full"
                    title="Registro no conselho de classe verificado pela equipe."
                  >
                    ✓ Profissional Verificado
                  </span>
                )}
                {isDiplomaVerified && (
                  <span
                    className="px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full"
                    title="Diploma verificado pela equipe — você é elegível a 10% de desconto no Plano Especialista Essencial."
                  >
                    🎉 Elegível a 10% de desconto no Plano Especialista Essencial
                  </span>
                )}
                {showAdExitum && (
                  <span
                    className="px-2.5 py-0.5 text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full"
                    title="Este especialista aceita o modelo Ad Exitum — você só paga se ganhar a causa."
                  >
                    ⚖️ Aceita Ad Exitum
                  </span>
                )}
                {eligibleForPremiumUpgrade && isAdvogado && (
                  <span
                    className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-full"
                    title="Avaliação Excelente + aceita Ad Exitum — elegível para o plano Premium."
                  >
                    ⭐ Elegível para Premium
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {TIPO_LABELS[apoiador.tipo] || apoiador.tipo}
                {apoiador.especialidade && ` · ${apoiador.especialidade}`}
              </p>

              {isPremium && apoiador.rating > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StarDisplay rating={apoiador.rating} />
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {apoiador.rating.toFixed(1)} ({apoiador.totalAvaliacoes || 0} avaliações)
                  </span>
                  {ratingLabel && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {ratingLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {apoiador.descricao && (
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-4 leading-relaxed">{apoiador.descricao}</p>
          )}

          {/* Nichos */}
          {nichos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {nichos.map((n) => (
                <span key={n} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">{n}</span>
              ))}
            </div>
          )}

          {/* Dados específicos */}
          <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {apoiador.oab && <p>OAB: {apoiador.oab}/{apoiador.seccional}</p>}
            {apoiador.cnpj && <p>CNPJ: {apoiador.cnpj}</p>}
            {apoiador.linkedin && (
              <a href={apoiador.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline inline-block">LinkedIn</a>
            )}
            {apoiador.site && (
              <a href={apoiador.site} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline inline-block ml-3">Site</a>
            )}
          </div>

          {/* Preço de consulta (Essencial / Premium) — Gratuito não exibe. */}
          {!isGratuito && consultationPrice && (
            <div className="mt-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300">
                    {isPremium && isAdvogado
                      ? "Liberação de contato seguro"
                      : `Consulta ${isPremium ? "(preço do profissional)" : "(preço tabelado pela plataforma)"}`}
                  </p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                    {BRL(consultationPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  {isPremium && isAdvogado ? "Pagar e liberar contato" : "Solicitar consulta"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {isPremium && isAdvogado
                  ? "Pagamento seguro via Mercado Pago. Após confirmação, os dados de contato do advogado são enviados por e-mail e também ficam disponíveis em Minha Conta."
                  : `Pagamento seguro via Mercado Pago. A plataforma retém ${isPremium ? "12,5%" : "10%"} para custos operacionais.`}
              </p>
            </div>
          )}

          {/* Estatísticas de processos (Essencial) */}
          {isEssencial && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Processos</p>
                <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                  {Number(apoiador.processosCount) || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-[11px] uppercase font-semibold tracking-wider text-emerald-700 dark:text-emerald-300">Casos ganhos</p>
                <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {Number(apoiador.casosGanhos) || 0}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Por segurança, os dados de contato direto deste especialista não são exibidos publicamente.
              Use o fluxo de pagamento da plataforma para liberar o contato com confirmação registrada.
            </p>
          </div>

          {/* Documentos (Premium) */}
          {isPremium && apoiador.documentos && apoiador.documentos.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Documentos e certificações</h3>
              <div className="flex gap-2 flex-wrap">
                {apoiador.documentos.map((d, i) => (
                  <a key={i} href={d.url || d} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline">
                    {d.nome || `Documento ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Portfólio (só Premium) ── */}
        {isPremium && apoiador.portfolio && apoiador.portfolio.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-4">Portfólio</h2>
            <div className="space-y-3">
              {apoiador.portfolio.map((p, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
                  {p.descricao && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{p.descricao}</p>}
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                      Ver projeto →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Avaliações (só Premium) ── */}
        {isPremium && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-4">Avaliações</h2>

            {/* Formulário */}
            {!userIsPremium ? (
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Apenas usuários Premium podem deixar avaliações.</p>
              </div>
            ) : !hasConsultation ? (
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Apenas trabalhadores Premium que realizaram uma consulta com este Apoiador podem avaliá-lo.
                </p>
              </div>
            ) : alreadyReviewed ? (
              <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">Você já avaliou este Especialista.</p>
              </div>
            ) : (
            <form onSubmit={handleSubmitReview} className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Deixe sua avaliação</p>
              <StarInput value={newRating} onChange={setNewRating} />
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value.slice(0, 200))}
                rows={2}
                maxLength={200}
                placeholder="Comentário (opcional, até 200 caracteres)"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">{newComment.length}/200</span>
                <button type="submit" disabled={newRating === 0 || submittingReview}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                  {submittingReview ? "Enviando…" : "Enviar"}
                </button>
              </div>
              {reviewSuccess && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Avaliação enviada!</p>}
              {reviewError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{reviewError}</p>}
            </form>
            )}

            {/* Lista */}
            {avaliacoes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma avaliação ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {avaliacoes.map((av) => (
                  <div key={av.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={av.nota || av.rating} size="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{av.autorPseudonimo || av.authorName || "Anônimo"}</span>
                    </div>
                    {(av.comentario || av.comment) && <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{av.comentario || av.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <ConsultationModal
        open={consultationModalOpen}
        onClose={() => setConsultationModalOpen(false)}
        apoiador={apoiador}
        audience={viewerAudience}
      />
    </div>
  );
}

export default ApoiadorPerfil;
