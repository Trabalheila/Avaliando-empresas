import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import { filterOutTestApoiadores } from "../utils/testAccounts";

const PREMIUM_WORKER_DISCOUNT_PCT = 0.1;
// Preços fixos do Plano Essencial (alinhados ao backend `api/payments`).
// Especialistas Premium definem o valor customizado em
// `valor_consulta_customizado` (ou `precoConsulta` legado).
const ESSENCIAL_CHAT_PRICE = 45;
const ESSENCIAL_VIDEO_PRICE = 75;

function normalizePlan(v) {
  const s = String(v || "").toLowerCase().trim();
  if (!s) return "";
  if (s.includes("premium")) return "premium";
  if (s.includes("essencial") || s.includes("essential") || s.includes("basic") || s === "free" || s === "gratuito") {
    return "essencial";
  }
  return s;
}

function normalizeModalidade(v) {
  const s = String(v || "").toLowerCase().trim();
  return s === "video" || s === "vídeo" ? "video" : "chat";
}

// Calcula o preço final da consulta com base no plano do especialista, na
// modalidade escolhida (chat/vídeo) e aplica o desconto Premium do usuário
// (10%) quando aplicável.
function calculateConsultationPrice(professionalData, isUserPremium, modalidade) {
  if (!professionalData) return 0;
  let basePrice = getBaseSpecialistPrice(professionalData, modalidade);
  if (isUserPremium) {
    basePrice = basePrice * (1 - PREMIUM_WORKER_DISCOUNT_PCT);
  }
  return basePrice;
}

// Preço base (sem desconto do usuário), já aplicada a regra de plano +
// modalidade. Convenção: somente Premium EXPLÍCITO usa valor customizado;
// qualquer outro caso (Essencial, plano em branco, novo cadastro) cai no
// tabelado por modalidade — evita o bug de "preco fixo 150" quando o doc
// do especialista ainda não tem `plano_tipo` definido.
// Preço base (sem desconto do usuário) por MODALIDADE. Na consulta avulsa o
// valor é tabelado pela modalidade escolhida — Chat (Texto) R$ 45 e Vídeo R$ 75,
// ambos com 30 min de duração — independentemente do plano do especialista
// (evita o bug de "preço fixo 150"). O desconto Premium do usuário é aplicado
// em `calculateConsultationPrice`.
function getBaseSpecialistPrice(professionalData, modalidade) {
  const mod = normalizeModalidade(modalidade);
  return mod === "video" ? ESSENCIAL_VIDEO_PRICE : ESSENCIAL_CHAT_PRICE;
}

const SPECIALTY_OPTIONS = [
  { value: "", label: "Selecione uma especialidade" },
  { value: "advogado", label: "Direito Trabalhista (Advogado/a)" },
  { value: "psicologo", label: "Saude Mental (Psicologo/a)" },
  { value: "consultor_rh", label: "Carreira / RH (Consultor/a)" },
  { value: "recrutador", label: "Recrutamento" },
  { value: "medico", label: "Medicina do Trabalho" },
  { value: "contador", label: "Contabilidade" },
  { value: "engenheiro_seguranca", label: "Engenharia de Seguranca" },
  { value: "fisioterapeuta_ocupacional", label: "Fisioterapia Ocupacional" },
  { value: "outro", label: "Outros" },
];

function normalizeTipo(v) {
  return String(v || "").toLowerCase().trim().replace(/-/g, "_");
}

function formatBRL(amount) {
  return Number(amount || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function checkIfUserIsPremiumLocal() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const role = String(profile?.role || "").toLowerCase().trim();
    const plano = String(profile?.plano || profile?.planStatus || "")
      .toLowerCase()
      .trim();
    return (
      Boolean(profile?.is_premium_worker) ||
      plano === "premium" ||
      plano === "premium_gratuito" ||
      role === "premium_worker" ||
      role === "trabalhador_premium"
    );
  } catch {
    return false;
  }
}

async function checkIfUserIsPremium() {
  if (checkIfUserIsPremiumLocal()) return true;
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    const role = String(data.role || "").toLowerCase().trim();
    const plano = String(data.plano || data.planStatus || "")
      .toLowerCase()
      .trim();
    return (
      Boolean(data.is_premium_worker) ||
      plano === "premium" ||
      plano === "premium_gratuito" ||
      role === "premium_worker" ||
      role === "trabalhador_premium"
    );
  } catch {
    return false;
  }
}

export default function ConsultaAvulsaPage({ theme, toggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [especialidades] = useState(SPECIALTY_OPTIONS);
  const [selectedEspecialidade, setSelectedEspecialidade] = useState("");
  const [profissionaisDisponiveis, setProfissionaisDisponiveis] = useState([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [selectedProfessionalData, setSelectedProfessionalData] = useState(null);
  const [displayedConsultationPrice, setDisplayedConsultationPrice] = useState(0);
  const [userDoubt, setUserDoubt] = useState("");
  // Modalidade do atendimento. Afeta o preço quando o especialista é do
  // Plano Essencial (chat=R$45 / vídeo=R$75). Para Premium o preço
  // customizado independe da modalidade, mas o valor segue para o backend
  // para que a sala correta (chat ou vídeo) seja criada no webhook.
  const [modalidade, setModalidade] = useState("chat");
  const [isPremiumWorker, setIsPremiumWorker] = useState(false);
  const [loadingPremium, setLoadingPremium] = useState(true);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPremium(true);
      const premium = await checkIfUserIsPremium();
      if (!cancelled) {
        setIsPremiumWorker(premium);
        setLoadingPremium(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const prefillSpecialty = normalizeTipo(location.state?.prefillSpecialty || "");
    if (prefillSpecialty) {
      setSelectedEspecialidade(prefillSpecialty);
    }
    if (location.state?.prefillDoubt) {
      setUserDoubt(String(location.state.prefillDoubt).slice(0, 2000));
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedEspecialidade) {
      setProfissionaisDisponiveis([]);
      setSelectedProfessionalId("");
      setSelectedProfessionalData(null);
      setDisplayedConsultationPrice(0);
      return;
    }

    let cancelled = false;
    setLoadingProfessionals(true);
    setError("");
    (async () => {
      try {
        const mapDoc = (d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid || "",
            nome: data.nome || data.displayName || "Especialista",
            descricaoBreve:
              data.descricaoBreve || data.bio || data.descricao || data.about || "",
            especialidadeId: normalizeTipo(
              data.especialidadeId || data.tipo || data.profissao || "outro"
            ),
            precoConsulta: Number(data.precoConsulta || data.preco || 0) || 0,
            valorConsultaCustomizado:
              Number(
                data.valor_consulta_customizado ||
                  data.valorConsultaCustomizado ||
                  0
              ) || 0,
            plan: normalizePlan(
              data.plano_tipo ||
                data.plan ||
                data.plano ||
                data.planStatus ||
                data.tier ||
                ""
            ),
            isTest: data.isTest === true,
          };
        };

        // Le das duas colecoes em paralelo: `especialistas` (nova) e
        // `apoiadores` (legada). Erros isolados em cada uma nao impedem
        // o uso da outra.
        const [espRes, apoRes] = await Promise.allSettled([
          getDocs(collection(db, "especialistas")),
          getDocs(query(collection(db, "apoiadores"), where("status", "==", "ativo"))),
        ]);
        if (cancelled) return;

        const merged = new Map();
        if (espRes.status === "fulfilled") {
          espRes.value.docs.forEach((d) => {
            const item = mapDoc(d);
            merged.set(item.id, item);
          });
        }
        if (apoRes.status === "fulfilled") {
          apoRes.value.docs.forEach((d) => {
            const item = mapDoc(d);
            // Especialistas (nova) prevalece sobre apoiadores (legada) com mesmo id.
            if (!merged.has(item.id)) merged.set(item.id, item);
          });
        }

        const mapped = Array.from(merged.values()).filter(
          (pro) => pro.especialidadeId === selectedEspecialidade
        );

        const filteredPros = filterOutTestApoiadores(mapped);
        setProfissionaisDisponiveis(filteredPros);

        const prefillProfessionalId = String(location.state?.prefillProfessionalId || "");
        if (prefillProfessionalId) {
          const exists = filteredPros.find((p) => p.id === prefillProfessionalId);
          if (exists) {
            setSelectedProfessionalId(prefillProfessionalId);
          }
        }
      } catch (err) {
        console.warn("ConsultaAvulsaPage: falha ao carregar profissionais", err);
        setError("Nao foi possivel carregar profissionais agora.");
      } finally {
        if (!cancelled) {
          setLoadingProfessionals(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEspecialidade, location.state]);

  useEffect(() => {
    const professionalData = profissionaisDisponiveis.find((p) => p.id === selectedProfessionalId) || null;
    setSelectedProfessionalData(professionalData);
    if (!professionalData) {
      setDisplayedConsultationPrice(0);
      return;
    }

    setDisplayedConsultationPrice(
      calculateConsultationPrice(professionalData, isPremiumWorker, modalidade)
    );
  }, [selectedProfessionalId, profissionaisDisponiveis, isPremiumWorker, modalidade]);

  const selectedSpecialtyLabel = useMemo(() => {
    return (
      especialidades.find((esp) => esp.value === selectedEspecialidade)?.label ||
      "Especialidade"
    );
  }, [especialidades, selectedEspecialidade]);

  const originalPrice = getBaseSpecialistPrice(selectedProfessionalData, modalidade);
  const discountAmount = Math.max(0, originalPrice - displayedConsultationPrice);

  const handleAdvanceToPayment = () => {
    setError("");
    if (!selectedProfessionalId || !selectedProfessionalData) {
      setError("Selecione um profissional.");
      return;
    }
    if (!userDoubt.trim()) {
      setError("Descreva sua duvida para continuar.");
      return;
    }
    if (displayedConsultationPrice <= 0) {
      setError("Nao foi possivel calcular o valor da consulta.");
      return;
    }

    navigate("/pagamento-consulta", {
      state: {
        professionalId: selectedProfessionalData.id,
        professionalUid: selectedProfessionalData.uid || "",
        professionalName: selectedProfessionalData.nome,
        specialtyId: selectedEspecialidade,
        specialtyLabel: selectedSpecialtyLabel,
        consultationPrice: displayedConsultationPrice,
        originalPrice,
        discountAmount,
        userDoubt: userDoubt.trim(),
        isPremiumWorker,
        modalidade,
        planoTipo: normalizePlan(selectedProfessionalData.plan) || "premium",
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Consulta Avulsa" />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            De quem voce precisa de ajuda?
          </h1>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Selecione a especialidade, escolha um profissional e descreva sua duvida.
          </p>

          {loadingPremium ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Carregando plano...</p>
          ) : isPremiumWorker ? (
            <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Voce e Premium Trabalhador: desconto de 10% aplicado automaticamente.
            </p>
          ) : null}

          <div className="mt-5">
            <label htmlFor="ca-specialty" className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Especialidade
            </label>
            <select
              id="ca-specialty"
              value={selectedEspecialidade}
              onChange={(e) => setSelectedEspecialidade(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            >
              {especialidades.map((esp) => (
                <option key={esp.value} value={esp.value}>
                  {esp.label}
                </option>
              ))}
            </select>
          </div>

          {selectedEspecialidade && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                Profissionais disponiveis
              </p>

              {loadingProfessionals ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">Carregando...</p>
              ) : profissionaisDisponiveis.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">
                  Nenhum profissional encontrado para esta especialidade.
                </p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {profissionaisDisponiveis.map((pro) => (
                    <li key={pro.id}>
                      <label
                        className={[
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition",
                          selectedProfessionalId === pro.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="ca-specialist"
                          value={pro.id}
                          checked={selectedProfessionalId === pro.id}
                          onChange={() => setSelectedProfessionalId(pro.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {pro.nome}
                          </p>
                          {pro.descricaoBreve && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {pro.descricaoBreve}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Valor base: {formatBRL(getBaseSpecialistPrice(pro, modalidade))}
                            {pro.plan === "premium" ? (
                              <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                Plano Premium
                              </span>
                            ) : (
                              <span className="ml-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Plano Essencial
                              </span>
                            )}
                          </p>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedProfessionalData && (
            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                Modalidade do atendimento
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { value: "chat", emoji: "\uD83D\uDCAC", label: "Atendimento por Chat (Texto)", price: ESSENCIAL_CHAT_PRICE },
                  { value: "video", emoji: "\uD83C\uDFA5", label: "Atendimento por Vídeo", price: ESSENCIAL_VIDEO_PRICE },
                ].map((opt) => {
                  const checked = modalidade === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={[
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition",
                        checked
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="ca-modalidade"
                        value={opt.value}
                        checked={checked}
                        onChange={() => setModalidade(opt.value)}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <span aria-hidden="true" className="mr-1">{opt.emoji}</span>
                          {opt.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatBRL(opt.price)} · 30 min de duração
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {selectedProfessionalData && (
            <div className="mt-4">
              <label htmlFor="ca-msg" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Descreva sua duvida (sera enviada ao profissional)
              </label>
              <textarea
                id="ca-msg"
                rows={4}
                value={userDoubt}
                onChange={(e) => setUserDoubt(e.target.value.slice(0, 2000))}
                placeholder="Ex.: Fui demitido sem justa causa e preciso entender meus direitos..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-right">
                {userDoubt.length}/2000
              </p>
            </div>
          )}

          {selectedProfessionalData && (
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Valor da consulta
                <span className="ml-2 normal-case font-medium text-slate-400 dark:text-slate-500">
                  ({modalidade === "video" ? "Vídeo" : "Chat"} · 30 min)
                </span>
              </p>
              {discountAmount > 0 ? (
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm line-through text-slate-400 dark:text-slate-500">
                    {formatBRL(originalPrice)}
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {formatBRL(displayedConsultationPrice)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                    -10% Premium
                  </span>
                </div>
              ) : (
                <div className="mt-1">
                  <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                    {formatBRL(displayedConsultationPrice)}
                  </span>
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Pagamento 100% seguro processado via Mercado Pago. O valor só é liberado ao profissional após a conclusão do atendimento.
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdvanceToPayment}
              disabled={!selectedProfessionalData || !userDoubt.trim() || displayedConsultationPrice <= 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
            >
              Avancar para pagamento
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
