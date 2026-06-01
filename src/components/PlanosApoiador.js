import React, { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { handleCheckout } from "../services/billing";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { getMpPlanUrl } from "../utils/mpSubscription";

function FeatureRow({ ok, children }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <FiCheck className="mt-0.5 w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <FiX className="mt-0.5 w-4 h-4 text-red-400 flex-shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}

export default function PlanosApoiador() {
  const [loadingTier, setLoadingTier] = useState("");
  const [error, setError] = useState("");
  // Quando o usuário clica em "Assinar Essencial", mostramos uma etapa
  // de confirmação com o preço final — com 10% de desconto se o
  // diploma estiver verificado, ou preço cheio caso contrário.
  const [confirmEssencial, setConfirmEssencial] = useState(null);

  const ESSENTIAL_BASE_PRICE = 199.9;
  const ESSENTIAL_DIPLOMA_DISCOUNT = 0.1;
  const formatBRL = (v) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Redireciona efetivamente para o Mercado Pago. O preço final do MP
  // é controlado pelo preapproval_plan_id; quando o desconto se aplica,
  // sinalizamos a intenção via query string para o backend processar
  // (ou para registro de atendimento manual).
  const redirectToCheckout = async (tier, { applyDiplomaDiscount = false } = {}) => {
    setLoadingTier(tier);
    setError("");
    try {
      const directMpUrl = getMpPlanUrl("supporter", tier);
      if (directMpUrl) {
        if (!auth.currentUser) await signInAnonymously(auth);
        const uid = auth.currentUser?.uid;
        if (!uid) { setError("Faça login para continuar."); setLoadingTier(""); return; }
        const snap = await getDocs(query(collection(db, "apoiadores"), where("uid", "==", uid)));
        if (snap.empty) {
          setError("Você precisa ter um cadastro de especialista antes de assinar Premium. Cadastre-se primeiro.");
          setLoadingTier("");
          return;
        }
        const finalUrl = applyDiplomaDiscount
          ? `${directMpUrl}${directMpUrl.includes("?") ? "&" : "?"}diploma_discount=1`
          : directMpUrl;
        window.location.assign(finalUrl);
        return;
      }

      // Caminho 2 (fallback): backend cria preapproval dinamicamente.
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser?.uid;
      if (!uid) { setError("Faça login para continuar."); setLoadingTier(""); return; }
      const snap = await getDocs(query(collection(db, "apoiadores"), where("uid", "==", uid)));
      if (snap.empty) {
        setError("Você precisa ter um cadastro de especialista antes de assinar Premium. Cadastre-se primeiro.");
        setLoadingTier("");
        return;
      }
      const apoiadorId = snap.docs[0].id;

      await handleCheckout({
        cnpj: "",
        companySlug: "trabalhei-la",
        companyName: "Trabalheila",
        audience: "supporter",
        tier,
        apoiadorId,
        diplomaDiscount: !!applyDiplomaDiscount,
      });
    } catch (err) {
      setError(err?.message || "Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoadingTier("");
    }
  };

  // Botão do plano Essencial: antes de redirecionar, busca o cadastro
  // do apoiador e abre o painel de confirmação exibindo o preço final
  // (com ou sem desconto).
  const handleEssencialClick = async () => {
    setError("");
    setLoadingTier("essential");
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser?.uid;
      if (!uid) { setError("Faça login para continuar."); return; }
      const snap = await getDocs(query(collection(db, "apoiadores"), where("uid", "==", uid)));
      if (snap.empty) {
        setError("Você precisa ter um cadastro de especialista antes de assinar. Cadastre-se primeiro.");
        return;
      }
      const data = snap.docs[0].data() || {};
      const isDiplomaVerified = data.isDiplomaVerified === true;
      const discountedPrice = +(
        ESSENTIAL_BASE_PRICE * (1 - ESSENTIAL_DIPLOMA_DISCOUNT)
      ).toFixed(2);
      setConfirmEssencial({
        isDiplomaVerified,
        basePrice: ESSENTIAL_BASE_PRICE,
        finalPrice: isDiplomaVerified ? discountedPrice : ESSENTIAL_BASE_PRICE,
      });
    } finally {
      setLoadingTier("");
    }
  };

  const handleSupporterCheckout = async (tier = "essential") => {
    if (tier === "essential") {
      return handleEssencialClick();
    }
    return redirectToCheckout(tier);
  };

  return (
    <section className="w-full bg-white dark:bg-slate-900 py-16 scroll-mt-8">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-2">
          Amplie sua visibilidade na plataforma
        </h2>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
          Veja o que muda ao se tornar Premium.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10 items-stretch">
          {/* ── Gratuito ── */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Gratuito</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">R$ 0</p>
            <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 flex-1">
              <FeatureRow ok>Perfil público visível na plataforma</FeatureRow>
              <FeatureRow ok>Nome e especialidade exibidos</FeatureRow>
              <FeatureRow ok>Contato inicial via Chat Interno da plataforma (com restrições de conteúdo)</FeatureRow>
              <FeatureRow ok>Aparece na listagem geral de Especialistas</FeatureRow>
              <FeatureRow>Seleção de nichos de atuação</FeatureRow>
              <FeatureRow>Destaque na listagem</FeatureRow>
              <FeatureRow>Aparece em seções de recomendação</FeatureRow>
              <FeatureRow>Selo "Especialista Verificado"</FeatureRow>
              <FeatureRow>Portfólio de casos e projetos</FeatureRow>
              <FeatureRow>Avaliações e estrelas de clientes</FeatureRow>
              <FeatureRow>Relatório mensal de visualizações e cliques</FeatureRow>
              <FeatureRow>Acesso a leads qualificados de empresas e trabalhadores Premium</FeatureRow>
            </ul>
          </div>

          {/* ── Apoiador Essencial — RECOMENDADO ── */}
          <div className="rounded-2xl border-2 border-blue-400 dark:border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6 relative overflow-hidden flex flex-col md:scale-[1.02] shadow-lg">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              RECOMENDADO
            </div>
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-1">Especialista Essencial</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              R$ 199,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
            </p>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-2 py-1 inline-block mb-2">
              🎁 Grátis até 30/06/2026
            </p>
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-2 py-1 inline-block mb-2">
              🎓 Desconto de 10% para profissionais com diploma verificado!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Visibilidade e leads para profissionais parceiros
            </p>
            <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
              <FeatureRow ok>Perfil público visível na plataforma</FeatureRow>
              <FeatureRow ok>Nome e especialidade exibidos</FeatureRow>
              <FeatureRow ok>Contato inicial via Chat Interno da plataforma (com restrições de conteúdo)</FeatureRow>
              <FeatureRow ok>Aparece na listagem geral de Especialistas</FeatureRow>
              <FeatureRow ok>Seleção de até 3 nichos de atuação (recrutamento, direito trabalhista, saúde ocupacional, benefícios corporativos, treinamento)</FeatureRow>
              <FeatureRow ok>Posição de destaque na listagem ordenada por avaliação</FeatureRow>
              <FeatureRow ok>Aparece nas seções de recomendação da página de empresas e de benefícios Premium</FeatureRow>
              <FeatureRow ok>Selo visual "Especialista Essencial Verificado" no perfil</FeatureRow>
              <FeatureRow ok>Portfólio com até 5 casos ou projetos</FeatureRow>
              <FeatureRow ok>Avaliações e estrelas de clientes Premium</FeatureRow>
              <FeatureRow ok>Relatório mensal de visualizações e cliques no perfil</FeatureRow>
              <FeatureRow ok>Acesso a leads qualificados de empresas e trabalhadores Premium com 10% de comissão sobre contratos fechados via plataforma <span className="text-amber-600 dark:text-amber-400 font-semibold">(em breve)</span></FeatureRow>
              <FeatureRow>Participação em programas de suporte Premium para usuários</FeatureRow>
            </ul>
            <button
              type="button"
              onClick={() => handleSupporterCheckout("essential")}
              disabled={!!loadingTier}
              className="mt-6 w-full py-3 rounded-lg bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition"
            >
              {loadingTier === "essential" ? "Abrindo checkout…" : "Assinar Essencial"}
            </button>
          </div>

          {/* ── Apoiador Premium ── */}
          <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 relative overflow-hidden flex flex-col shadow-lg">
            <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              COMPLETO
            </div>
            <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-1">Especialista Premium</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              R$ 399,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Máximo destaque e parceria estratégica com a plataforma
            </p>
            <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
              <FeatureRow ok><span className="font-semibold">Todos os benefícios do plano Especialista Essencial</span></FeatureRow>
              <FeatureRow ok><span className="font-semibold">Contato direto via e-mail e WhatsApp</span> liberado no perfil para visítantes (exclusivo Premium)</FeatureRow>
              <FeatureRow ok><span className="font-semibold">10 Créditos de Contato/mês</span> para iniciar conversas com Empresas Premium</FeatureRow>
              <FeatureRow ok>Acesso à página <span className="font-semibold">"Meus Contatos"</span> para gerenciar interações e responder pedidos de empresas</FeatureRow>
              <FeatureRow ok><span className="font-semibold">Notificações Prioritárias</span> sobre novas oportunidades e pedidos de contato (sininho na plataforma)</FeatureRow>
              <FeatureRow ok>Selo visual <span className="font-semibold">"Especialista Premium Verificado"</span> no perfil (substitui o Essencial)</FeatureRow>
              <FeatureRow ok><span className="font-semibold">Controle de Disponibilidade:</span> ative/desative seu status para receber novos contatos</FeatureRow>
              <FeatureRow ok><span className="font-semibold">Analytics do Perfil:</span> veja visualizações, cliques e taxa de resposta</FeatureRow>
              <FeatureRow ok><span className="font-semibold">Relatórios de Mercado Avançados</span> com insights específicos por especialidade e ramo de atuação</FeatureRow>
              <FeatureRow ok>Acesso prioritário a um volume maior de leads qualificados</FeatureRow>
              <FeatureRow ok>Posicionamento ainda mais privilegiado nas listagens e recomendações</FeatureRow>
              <FeatureRow ok>Participação em programas de suporte Premium para usuários, com remuneração por sessões/consultas incluídas nos planos Premium de trabalhadores e empresas</FeatureRow>
              <FeatureRow ok>Acesso a ferramentas de marketing e branding co-criadas com o Trabalhei Lá</FeatureRow>
              <FeatureRow ok>Convites exclusivos para eventos e workshops da plataforma</FeatureRow>
            </ul>
            <button
              type="button"
              onClick={() => handleSupporterCheckout("premium")}
              disabled={!!loadingTier}
              className="mt-6 w-full py-3 rounded-lg bg-amber-500 text-white text-base font-bold hover:bg-amber-600 transition"
            >
              {loadingTier === "premium" ? "Abrindo checkout…" : "Assinar Premium"}
            </button>
          </div>
        </div>

        {/* Destaque */}
        <div className="max-w-md mx-auto text-center">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 mb-4 text-blue-900 dark:text-blue-200 text-sm font-medium shadow-inner">
            <span className="font-bold">Destaque:</span> Especialistas Essencial e Premium recebem até{" "}
            <span className="font-bold">3× mais contatos</span> de potenciais clientes.
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
            Pagamento via Mercado Pago. Escolha PIX, cartão ou boleto no checkout.
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>

        {/* ===== Modal de confirmação do plano Essencial ===== */}
        {confirmEssencial && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-essencial-title"
            onClick={() => setConfirmEssencial(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="confirm-essencial-title"
                className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-2"
              >
                Confirmar assinatura — Especialista Essencial
              </h3>
              {confirmEssencial.isDiplomaVerified ? (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    🎓 <strong>Você tem diploma verificado!</strong> Aplicamos automaticamente
                    o desconto de 10%.
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-base text-slate-400 line-through">
                      {formatBRL(confirmEssencial.basePrice)}
                    </span>
                    <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatBRL(confirmEssencial.finalPrice)}
                    </span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Você economiza {formatBRL(confirmEssencial.basePrice - confirmEssencial.finalPrice)}/mês.
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    Valor da assinatura mensal:
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                      {formatBRL(confirmEssencial.basePrice)}
                    </span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    🎓 Envie e verifique seu diploma no perfil para ganhar 10% de desconto
                    nas próximas cobranças.
                  </p>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setConfirmEssencial(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loadingTier === "essential"}
                  onClick={() => {
                    const apply = !!confirmEssencial.isDiplomaVerified;
                    setConfirmEssencial(null);
                    redirectToCheckout("essential", { applyDiplomaDiscount: apply });
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingTier === "essential" ? "Abrindo checkout…" : "Confirmar e ir para o checkout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
