import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { isAdmin } from "../utils/rbac";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";

/* ════════════════════════════════════════════════
   AdminDashboardPreview
   Simula o dashboard que um apoiador veria, com base
   em uma profissão escolhida no dropdown. Read-only:
   nenhum dado real é gravado e nenhuma interação de
   apoiador (responder leads, editar perfil, etc.) é
   permitida — apenas visualização.
   ════════════════════════════════════════════════ */

const STARS = [1, 2, 3, 4, 5];

/* Conteúdos sugeridos por categoria (servem para a aba
   "Conteúdo recomendado" do dashboard simulado). */
const CATEGORY_CONTENT = {
  Jurídico: {
    blurb:
      "Recursos para apoiadores que atuam com Direito do Trabalho, OAB e contencioso trabalhista.",
    metrics: ["Casos respondidos", "Tempo médio de resposta", "Indicadores OAB"],
    tips: [
      "Mantenha sua OAB atualizada no perfil para o selo verificado.",
      "Use o WhatsApp Business para triagem inicial de leads.",
      "Publique artigos sobre reforma trabalhista no seu portfólio.",
    ],
    leadHints: [
      "Empresa de tecnologia consultando sobre PJ vs CLT",
      "Funcionário com dúvidas sobre demissão por justa causa",
      "Startup buscando revisão de contrato de prestação",
    ],
  },
  "Recursos Humanos": {
    blurb:
      "Recursos para consultores e analistas de RH, recrutamento e cultura organizacional.",
    metrics: ["Vagas indicadas", "Match com candidatos", "Net Promoter Score"],
    tips: [
      "Destaque cases de turnover reduzido para atrair leads.",
      "Inclua certificações (PHRi, SHRM) no portfólio.",
      "Ative o filtro de nichos para receber leads mais qualificados.",
    ],
    leadHints: [
      "PME buscando estruturar plano de cargos e salários",
      "Empresa de 80 pessoas com problemas de clima",
      "Equipe remota precisando de onboarding",
    ],
  },
  Saúde: {
    blurb:
      "Recursos para profissionais de Saúde Ocupacional, ergonomia e bem-estar corporativo.",
    metrics: ["Avaliações ergonômicas", "Atendimentos PCMSO", "Taxa de retorno"],
    tips: [
      "Anexe o número do conselho (CRM/CREFITO/CRP) para o selo verificado.",
      "Ofereça pacotes de avaliação ergonômica para PMEs.",
      "Integre relatórios de SST ao seu portfólio premium.",
    ],
    leadHints: [
      "Indústria solicitando laudo ergonômico",
      "Empresa pedindo ginástica laboral semanal",
      "Escritório com colaboradores em home office",
    ],
  },
  Consultoria: {
    blurb:
      "Recursos para consultores estratégicos, M&A, processos e transformação organizacional.",
    metrics: ["Projetos entregues", "Ticket médio", "Indicações recebidas"],
    tips: [
      "Mostre logos de clientes (com autorização) no portfólio.",
      "Use o campo 'segmentos de atuação' para SEO interno.",
      "Publique artigos curtos sobre frameworks que você aplica.",
    ],
    leadHints: [
      "Empresa familiar buscando profissionalização",
      "Diretoria avaliando reestruturação societária",
      "Startup em fase de série A pedindo apoio estratégico",
    ],
  },
  Outros: {
    blurb:
      "Conteúdo genérico para apoiadores. Configure uma categoria para ver dicas específicas.",
    metrics: ["Visualizações", "Cliques de contato", "Avaliações"],
    tips: [
      "Defina uma categoria na página de Profissões para ver dicas direcionadas.",
      "Mantenha sua descrição clara e objetiva.",
      "Anexe documentos para aumentar a credibilidade.",
    ],
    leadHints: [
      "Lead genérico aguardando categorização",
      "Empresa interessada em conhecer seu perfil",
    ],
  },
};

/* Hash determinístico simples para gerar números fictícios estáveis
   por profissão (assim o preview não muda a cada render). */
function seededInt(seed, min, max) {
  let h = 2166136261;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h);
  return min + (n % (max - min + 1));
}

/* Gera um perfil simulado do apoiador a partir da profissão. */
function buildMockSupporter(prof) {
  const seed = prof?.id || prof?.name || "preview";
  const visualizacoes = seededInt(`${seed}-views`, 120, 980);
  const cliques = seededInt(`${seed}-clicks`, 8, Math.max(10, Math.floor(visualizacoes / 6)));
  const avaliacoes = seededInt(`${seed}-rev`, 0, 38);
  const ratingTimes10 = seededInt(`${seed}-rating`, 38, 50); // 3.8 - 5.0
  const rating = avaliacoes === 0 ? 0 : ratingTimes10 / 10;
  const leadsAbertos = seededInt(`${seed}-leads`, 0, 6);
  const respostaMin = seededInt(`${seed}-resp`, 12, 240);
  return {
    nome: `Apoiador(a) — ${prof?.name || "Profissão"}`,
    profissao: prof?.name || "—",
    categoria: prof?.category || "Outros",
    descricao:
      prof?.description ||
      "Profissional cadastrado(a) na plataforma Trabalhei Lá. Esta é uma simulação read-only com dados fictícios para validação de UX.",
    iconUrl: prof?.iconUrl || "",
    plano: avaliacoes > 10 ? "premium" : "gratuito",
    rating,
    totalAvaliacoes: avaliacoes,
    visualizacoes,
    cliquesContato: cliques,
    leadsAbertos,
    respostaMediaMin: respostaMin,
  };
}

function StarDisplay({ rating, size = "w-4 h-4" }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Nota ${rating}`}>
      {STARS.map((s) => (
        <svg
          key={s}
          className={`${size} ${
            s <= Math.round(rating)
              ? "text-yellow-400"
              : "text-slate-300 dark:text-slate-600"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

/* Pequeno cartão de métrica */
function MetricCard({ label, value, hint }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Dashboard simulado (read-only) do apoiador
   ════════════════════════════════════════════════ */
function SimulatedSupporterDashboard({ profession }) {
  const supporter = useMemo(
    () => buildMockSupporter(profession),
    [profession]
  );
  const content =
    CATEGORY_CONTENT[supporter.categoria] || CATEGORY_CONTENT.Outros;

  const isPremium = supporter.plano === "premium";

  return (
    <div className="space-y-6">
      {/* Banner de aviso de simulação */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
        <span aria-hidden>🔒</span>
        <p>
          <strong>Modo Preview (admin):</strong> esta visualização é{" "}
          <strong>somente leitura</strong>. Os dados exibidos são fictícios e
          gerados a partir da profissão selecionada — nenhuma informação real
          de apoiador é lida ou alterada.
        </p>
      </div>

      {/* Card do perfil */}
      <section
        className={`rounded-2xl p-5 bg-white dark:bg-slate-800 border ${
          isPremium
            ? "border-2 border-blue-500 dark:border-blue-400"
            : "border-slate-200 dark:border-slate-700"
        } shadow-sm`}
      >
        <div className="flex items-start gap-4">
          {supporter.iconUrl ? (
            <img
              src={supporter.iconUrl}
              alt=""
              className="h-16 w-16 rounded-2xl object-contain bg-white border border-slate-200 dark:border-slate-600"
              onError={(ev) => {
                ev.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-3xl">
              👤
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-extrabold text-slate-800 dark:text-slate-100">
                {supporter.nome}
              </h2>
              {isPremium && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full whitespace-nowrap">
                  ✓ Apoiador Premium Verificado
                </span>
              )}
              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full">
                Preview
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {supporter.profissao}
              {supporter.categoria && (
                <>
                  {" · "}
                  <span className="text-blue-700 dark:text-blue-300 font-semibold">
                    {supporter.categoria}
                  </span>
                </>
              )}
            </p>

            {supporter.totalAvaliacoes > 0 ? (
              <div className="flex items-center gap-2 mt-2">
                <StarDisplay rating={supporter.rating} />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {supporter.rating.toFixed(1)} ({supporter.totalAvaliacoes}{" "}
                  avaliações)
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">Ainda sem avaliações</p>
            )}
          </div>
        </div>

        {supporter.descricao && (
          <p className="text-sm text-slate-700 dark:text-slate-200 mt-4 leading-relaxed">
            {supporter.descricao}
          </p>
        )}
      </section>

      {/* Métricas */}
      <section>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
          Métricas do mês
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Visualizações"
            value={supporter.visualizacoes}
            hint="perfil aberto por usuários"
          />
          <MetricCard
            label="Cliques de contato"
            value={supporter.cliquesContato}
            hint="WhatsApp + e-mail"
          />
          <MetricCard
            label="Leads em aberto"
            value={supporter.leadsAbertos}
            hint="aguardando resposta"
          />
          <MetricCard
            label="Resposta média"
            value={`${supporter.respostaMediaMin} min`}
            hint="tempo até a 1ª resposta"
          />
        </div>
      </section>

      {/* Métricas específicas por categoria */}
      <section>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
          Indicadores específicos —{" "}
          <span className="text-blue-700 dark:text-blue-300">
            {supporter.categoria}
          </span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {content.blurb}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {content.metrics.map((m, i) => (
            <MetricCard
              key={m}
              label={m}
              value={seededInt(`${supporter.profissao}-${m}`, 4, 120)}
            />
          ))}
        </div>
      </section>

      {/* Leads recentes (mock) */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
          Leads recentes (simulados)
        </h3>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {content.leadHints.map((l, i) => (
            <li
              key={l}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                  {l}
                </p>
                <p className="text-[11px] text-slate-400">
                  Há {seededInt(`${supporter.profissao}-l-${i}`, 1, 72)}h
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Indisponível no preview"
                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed"
              >
                Responder
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Conteúdo recomendado por categoria */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
          Dicas para apoiadores de {supporter.categoria}
        </h3>
        <ul className="space-y-2">
          {content.tips.map((t) => (
            <li
              key={t}
              className="text-sm text-slate-600 dark:text-slate-300 flex gap-2"
            >
              <span aria-hidden>💡</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ações desabilitadas (read-only) */}
      <section className="flex flex-wrap gap-2 pt-1">
        {["Editar perfil", "Convidar cliente", "Configurar agenda", "Sair"].map(
          (label) => (
            <button
              key={label}
              type="button"
              disabled
              title="Ação desabilitada no preview de admin"
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed"
            >
              {label}
            </button>
          )
        )}
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Página principal
   ════════════════════════════════════════════════ */
export default function AdminDashboardPreview({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [professions, setProfessions] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  /* Proteção de rota */
  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let snap;
      try {
        snap = await getDocs(
          query(collection(db, "professions"), orderBy("order", "asc"))
        );
      } catch {
        snap = await getDocs(collection(db, "professions"));
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const oa = Number.isFinite(Number(a.order))
          ? Number(a.order)
          : Number.MAX_SAFE_INTEGER;
        const ob = Number.isFinite(Number(b.order))
          ? Number(b.order)
          : Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "pt-BR",
          { sensitivity: "base" }
        );
      });
      setProfessions(list);
      if (list.length > 0) setSelectedId((prev) => prev || list[0].id);
    } catch (err) {
      console.error("Falha ao carregar profissões:", err);
      setErrorMsg("Não foi possível carregar a lista de profissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  const selected = useMemo(
    () => professions.find((p) => p.id === selectedId) || null,
    [professions, selectedId]
  );

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <AdminQuickAccess />

      <main className="w-full max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">
              Preview de Dashboard de Apoiador
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Selecione uma profissão para visualizar como o dashboard apareceria
              para um apoiador dessa categoria.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/profissoes")}
              className="text-sm text-blue-700 dark:text-blue-300 hover:underline"
            >
              Gerenciar profissões
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-blue-700 dark:text-blue-300 hover:underline"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Dropdown de profissão */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-blue-100 dark:border-slate-700 p-4 md:p-5 mb-6">
          <label
            htmlFor="prof-select"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
          >
            Profissão / Especialidade
          </label>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Carregando profissões…
            </p>
          ) : professions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma profissão cadastrada. Cadastre uma em{" "}
              <button
                type="button"
                onClick={() => navigate("/admin/profissoes")}
                className="text-blue-700 dark:text-blue-300 underline"
              >
                Gerenciamento de Profissões
              </button>
              .
            </p>
          ) : (
            <select
              id="prof-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full md:w-2/3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
            >
              {professions.map((p) => {
                const inactive = p.isActive === false;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name || "(sem nome)"}
                    {p.category ? ` — ${p.category}` : ""}
                    {inactive ? " · INATIVA" : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Área de exibição do dashboard simulado */}
        <div className="bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 md:p-6">
          {selected ? (
            <SimulatedSupporterDashboard profession={selected} />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Selecione uma profissão acima para começar.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
