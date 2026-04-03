import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import AppHeader from "../components/AppHeader";

const TIPO_LABELS = { consultor: "Consultor de RH", advogado: "Advogado Trabalhista", prestador: "Prestador de Serviços" };
const STARS = [1, 2, 3, 4, 5];

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
  const [apoiador, setApoiador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState([]);

  /* ── Formulário de avaliação ── */
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "apoiadores", id));
        if (snap.exists()) {
          setApoiador({ id: snap.id, ...snap.data() });
          /* Carregar avaliações */
          const avSnap = await getDocs(query(collection(db, "apoiadores", id, "avaliacoes"), orderBy("createdAt", "desc")));
          setAvaliacoes(avSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    setSubmittingReview(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);

      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const reviewData = {
        rating: newRating,
        comment: newComment.trim().slice(0, 200),
        authorName: profile?.pseudonym || profile?.name || "Anônimo",
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "apoiadores", id, "avaliacoes"), reviewData);

      /* Recalcular rating no documento do apoiador */
      const allRatings = [...avaliacoes.map((a) => a.rating), newRating];
      const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
      await updateDoc(doc(db, "apoiadores", id), {
        rating: parseFloat(avgRating.toFixed(2)),
        totalAvaliacoes: allRatings.length,
      });

      setApoiador((prev) => prev ? { ...prev, rating: parseFloat(avgRating.toFixed(2)), totalAvaliacoes: allRatings.length } : prev);
      setAvaliacoes((prev) => [{ ...reviewData, id: Date.now().toString(), createdAt: { toDate: () => new Date() } }, ...prev]);
      setNewRating(0);
      setNewComment("");
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
    }
    setSubmittingReview(false);
  }, [id, newRating, newComment, avaliacoes]);

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
        <p className="text-center py-20 text-slate-500">Apoiador não encontrado.</p>
      </div>
    );
  }

  const isPremium = apoiador.plano === "premium";
  const nichos = apoiador.nichos || apoiador.areas || apoiador.segmentos || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full">
                    ✓ Apoiador Premium Verificado
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {TIPO_LABELS[apoiador.tipo] || apoiador.tipo}
                {apoiador.especialidade && ` · ${apoiador.especialidade}`}
              </p>

              {isPremium && apoiador.rating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <StarDisplay rating={apoiador.rating} />
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {apoiador.rating.toFixed(1)} ({apoiador.totalAvaliacoes || 0} avaliações)
                  </span>
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

          {/* Contato */}
          <div className="flex flex-wrap gap-3 mt-5">
            {apoiador.email && (
              <a href={`mailto:${apoiador.email}`}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Enviar e-mail
              </a>
            )}
            {(apoiador.whatsapp || apoiador.telefone) && (
              <a href={`https://wa.me/55${(apoiador.whatsapp || apoiador.telefone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition">
                WhatsApp
              </a>
            )}
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

        {/* ── Avaliações (só Premium) ── */}
        {isPremium && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-4">Avaliações</h2>

            {/* Formulário */}
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
            </form>

            {/* Lista */}
            {avaliacoes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma avaliação ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {avaliacoes.map((av) => (
                  <div key={av.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={av.rating} size="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{av.authorName || "Anônimo"}</span>
                    </div>
                    {av.comment && <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{av.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ApoiadorPerfil;
