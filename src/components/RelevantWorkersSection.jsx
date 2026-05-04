import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isPremiumSupporter } from "../utils/rbac";
import ContactWorkerModal from "./ContactWorkerModal";

/**
 * RelevantWorkersSection
 * --------------------------------------------------------------
 * Seção exibida na página de detalhes da empresa, visível apenas
 * para usuários "Premium Empresa" (Apoiador Premium). Lista
 * trabalhadores Premium que:
 *   • avaliaram esta empresa OU empresas do mesmo setor/ramo
 *   • têm Índice de Credibilidade "confiável" (>= ~70%)
 *   • estão com isAvailableForContact === true
 *
 * Para cada profissional exibe avatar, pseudônimo, índice e um
 * botão "Entrar em Contato".
 *
 * Props:
 *   companySlug   string   slug da empresa atual
 *   companyName   string
 *   companySector string   ramo / setor (para fallback)
 */
export default function RelevantWorkersSection({
  companySlug,
  companyName,
  companySector,
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState([]);

  const userProfile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);

  const apoiadorUid = userProfile?.uid || userProfile?.id || userProfile?.profileId || "";
  const apoiadorCompany =
    userProfile?.companyName ||
    userProfile?.empresa ||
    userProfile?.razaoSocial ||
    userProfile?.name ||
    "Apoiador Premium";

  const visible = isPremiumSupporter();

  useEffect(() => {
    if (!visible || !companySlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        /* 1. Reviews da empresa atual e do mesmo setor (se houver) */
        const reviewsRef = collection(db, "reviews");
        const reviewQueries = [
          query(reviewsRef, where("companySlug", "==", companySlug), limit(200)),
        ];
        if (companySector) {
          reviewQueries.push(
            query(reviewsRef, where("companySector", "==", companySector), limit(200))
          );
        }

        const reviewSnaps = await Promise.all(
          reviewQueries.map((q) => getDocs(q).catch(() => null))
        );

        const authorIds = new Set();
        reviewSnaps.forEach((snap) => {
          if (!snap) return;
          snap.docs.forEach((d) => {
            const data = d.data() || {};
            const id = data.authorProfileId || data.authorUid || data.author;
            if (id) authorIds.add(String(id));
          });
        });

        if (authorIds.size === 0) {
          if (!cancelled) {
            setWorkers([]);
            setLoading(false);
          }
          return;
        }

        /* 2. Carrega cada perfil. Filtra: Premium + Disponível +
              Credibilidade "confiavel". Limite: 24 perfis.       */
        const ids = Array.from(authorIds).slice(0, 60);
        const profiles = await Promise.all(
          ids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              if (!snap.exists()) return null;
              return { id: snap.id, ...snap.data() };
            } catch {
              return null;
            }
          })
        );

        const filtered = profiles
          .filter(Boolean)
          .filter((p) => p.isAvailableForContact === true)
          .filter((p) => {
            const cred = String(p.credibilityIndex || "").toLowerCase();
            return cred === "confiavel";
          })
          .filter((p) => {
            const role = String(p.role || "").toLowerCase();
            return (
              p.is_premium_worker === true ||
              role === "premium_worker" ||
              role === "trabalhador_premium" ||
              p.is_premium === true
            );
          })
          .slice(0, 24);

        if (!cancelled) {
          setWorkers(filtered);
          setLoading(false);
        }
      } catch (err) {
        console.warn("RelevantWorkersSection erro:", err);
        if (!cancelled) {
          setWorkers([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, companySlug, companySector]);

  if (!visible) return null;

  return (
    <section className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm p-6 border border-purple-200 dark:border-slate-700">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-purple-600 text-white text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full">
            EXCLUSIVO PREMIUM EMPRESA
          </div>
          <h2 className="mt-2 text-lg font-bold text-purple-800 dark:text-purple-200 flex items-center gap-2">
            <span aria-hidden="true">🎯</span>
            Profissionais Relevantes
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Trabalhadores Premium com alta credibilidade que avaliaram esta empresa
            ou outras do mesmo setor e que aceitam ser contatados.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            Carregando profissionais relevantes…
          </p>
        ) : workers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum profissional relevante disponível no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workers.map((w) => {
              const pseudonym = w.pseudonimo || w.name || "Anônimo";
              const av = w.avatar || w.picture || "";
              const isImg = av && (av.startsWith("data:") || av.startsWith("http"));
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
                >
                  {isImg ? (
                    <img
                      src={av}
                      alt={pseudonym}
                      className="h-12 w-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="h-12 w-12 rounded-full bg-blue-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                      {av && av.length <= 4 ? av : "👤"}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {pseudonym}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                      ✅ Índice de Credibilidade: Confiável
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(w);
                      setOpen(true);
                    }}
                    className="shrink-0 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    Entrar em contato
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <ContactWorkerModal
          open={open}
          onClose={() => {
            setOpen(false);
            setSelected(null);
          }}
          onSent={() => {
            /* mantém modal aberto na tela de sucesso */
          }}
          apoiadorUid={apoiadorUid}
          apoiadorCompany={
            companyName /* o contexto é a empresa avaliada */
              ? `${apoiadorCompany}`
              : apoiadorCompany
          }
          workerUid={selected.id}
          workerPseudonym={selected.pseudonimo || selected.name || "Anônimo"}
        />
      )}
    </section>
  );
}
