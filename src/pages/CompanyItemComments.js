import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listReviewsByCompanySlug, slugifyCompany } from "../services/reviews";

const ITEM_CONFIG = {
  comunicacao: { label: "Contato do RH", commentKey: "commentComunicacao" },
  etica: { label: "Proposta e acerto salarial", commentKey: "commentEtica" },
  salario: { label: "Salario e beneficios", commentKey: "commentSalario" },
  cultura: { label: "Visao e valores da empresa", commentKey: "commentCultura" },
  saudeBemEstar: { label: "Preocupacao com o bem-estar", commentKey: "commentSaudeBemEstar" },
  lideranca: { label: "Acessibilidade e respeito da lideranca", commentKey: "commentLideranca" },
  ambiente: { label: "Estimulo ao respeito entre colegas", commentKey: "commentAmbiente" },
  estimacaoOrganizacao: { label: "Estimulo a organizacao", commentKey: "commentEstimacaoOrganizacao" },
  desenvolvimento: { label: "Planos de cargos e salarios", commentKey: "commentDesenvolvimento" },
  reconhecimento: { label: "Reconhecimento", commentKey: "commentReconhecimento" },
  equilibrio: { label: "Rotatividade", commentKey: "commentEquilibrio" },
  diversidade: { label: "Atitudes de discriminacao", commentKey: "commentDiversidade" },
  rating: { label: "Saude e Seguranca", commentKey: "commentRating" },
};

function toDateLabel(value) {
  const parsed = new Date(value || "");
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toLocaleString("pt-BR");
}

function toSortableTime(value) {
  const parsed = new Date(value || "");
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

function CompanyItemComments({ theme, toggleTheme }) {
  const [searchParams] = useSearchParams();
  const companyName = (searchParams.get("name") || "").trim();
  const itemKey = (searchParams.get("item") || "").trim();
  const itemConfig = ITEM_CONFIG[itemKey] || null;

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [entries, setEntries] = React.useState([]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!companyName || !itemConfig) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMsg("");

      try {
        const companySlug = slugifyCompany(companyName);
        const reviews = await listReviewsByCompanySlug(companySlug, 300);
        if (!alive) return;

        const commentKey = itemConfig.commentKey;
        const filtered = (reviews || [])
          .filter((review) => typeof review?.[commentKey] === "string" && review[commentKey].trim())
          .map((review) => ({
            id: review.id,
            pseudonym: review.pseudonym || "Anonimo",
            comment: review[commentKey].trim(),
            score: review?.[itemKey],
            createdAt:
              typeof review?.createdAt?.toDate === "function"
                ? review.createdAt.toDate().toISOString()
                : review?.createdAt || "",
          }))
          .sort((a, b) => toSortableTime(b.createdAt) - toSortableTime(a.createdAt));

        setEntries(filtered);
      } catch (err) {
        if (!alive) return;
        setErrorMsg("Nao foi possivel carregar os comentarios deste item.");
      } finally {
        if (!alive) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [companyName, itemConfig, itemKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 py-10 px-4">
      <div className="max-w-4xl mx-auto flex justify-end mb-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Alternar tema"
        >
          Tema
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-8">
        <Link
          to={`/empresa?name=${encodeURIComponent(companyName)}`}
          className="text-sm font-bold text-blue-700 hover:underline"
        >
          {"<- Voltar para a pagina da empresa"}
        </Link>

        <h1 className="mt-4 text-2xl font-extrabold text-blue-800 dark:text-slate-100">
          Comentarios por item
        </h1>

        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Empresa: <span className="font-semibold">{companyName || "Nao informada"}</span>
        </p>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Item: <span className="font-semibold">{itemConfig?.label || "Item invalido"}</span>
        </p>

        {isLoading ? (
          <div className="mt-6 text-sm text-slate-600">Carregando comentarios...</div>
        ) : errorMsg ? (
          <div className="mt-6 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {errorMsg}
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-6 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Ainda nao ha comentarios para este item.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.pseudonym}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{toDateLabel(entry.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-100 whitespace-pre-line">{entry.comment}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Nota neste item: {typeof entry.score === "number" ? entry.score.toFixed(1) : "--"}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyItemComments;
