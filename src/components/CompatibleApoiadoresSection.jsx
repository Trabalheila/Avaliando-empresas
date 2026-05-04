import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";
import SECTORS from "../data/sectors";
import ContactApoiadorModal from "./ContactApoiadorModal";

/**
 * CompatibleApoiadoresSection
 * --------------------------------------------------------------
 * Lista Apoiadores Premium compatíveis e permite à empresa filtrar
 * por "Ramo de Especialização". Substitui o placeholder estático de
 * profissionais compatíveis no painel da empresa.
 *
 * Props:
 *   companyId      string
 *   companyName    string
 *   companySector  string  (ramo da empresa, usado como filtro inicial)
 *   fromUid        string  (uid do gestor da empresa)
 */
export default function CompatibleApoiadoresSection({
  companyId,
  companyName,
  companySector,
  fromUid,
}) {
  const [filter, setFilter] = useState(() =>
    SECTORS.includes(companySector || "") ? companySector : ""
  );
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        /* Busca apoiadores ativos no plano premium. Se houver filtro,
           prioriza ramoEspecializacao; faz fallback sem filtro caso o
           índice composto ainda não exista. */
        const ref = collection(db, "apoiadores");
        let snap;
        try {
          if (filter) {
            snap = await getDocs(
              query(
                ref,
                where("plano", "==", "premium"),
                where("ramoEspecializacao", "==", filter),
                limit(60)
              )
            );
          } else {
            snap = await getDocs(
              query(ref, where("plano", "==", "premium"), limit(60))
            );
          }
        } catch {
          snap = await getDocs(query(ref, limit(60)));
        }

        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => a.plano === "premium")
          .filter((a) => (filter ? a.ramoEspecializacao === filter : true))
          .filter((a) => a.status !== "rejeitado");

        if (!cancelled) {
          setItems(list);
          setLoading(false);
        }
      } catch (err) {
        console.warn("CompatibleApoiadoresSection erro:", err);
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const filterOptions = useMemo(
    () => ["", ...SECTORS],
    []
  );

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Profissionais compatíveis
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Apoiadores Premium selecionados conforme o perfil e o ramo da sua empresa.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Filtrar por ramo:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filterOptions.map((opt) => (
              <option key={opt || "__all__"} value={opt}>
                {opt || "Todos os ramos"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando apoiadores…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Nenhum apoiador encontrado para este filtro.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a) => {
            const av = a.foto || "";
            const isImg = av && (av.startsWith("data:") || av.startsWith("http"));
            return (
              <li
                key={a.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 flex flex-col"
              >
                <div className="flex items-center gap-3">
                  {isImg ? (
                    <img
                      src={av}
                      alt={a.nome}
                      className="h-12 w-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="h-12 w-12 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
                      👤
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      {a.nome || "Apoiador"}
                    </div>
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-0.5 truncate">
                      {a.especialidade || a.tipo || "Apoiador Premium"}
                    </div>
                  </div>
                </div>
                {a.ramoEspecializacao && (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {a.ramoEspecializacao}
                  </p>
                )}
                {a.descricao && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                    {a.descricao}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelected(a);
                    setOpen(true);
                  }}
                  className="mt-3 self-start px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Entrar em contato
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <ContactApoiadorModal
          open={open}
          onClose={() => {
            setOpen(false);
            setSelected(null);
          }}
          onSent={() => {}}
          companyId={companyId}
          companyName={companyName}
          fromUid={fromUid}
          apoiadorId={selected.id}
          apoiadorName={selected.nome || ""}
        />
      )}
    </div>
  );
}
