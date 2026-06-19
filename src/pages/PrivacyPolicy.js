import React from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function PrivacyPolicy({ theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300 mb-6">Política de Privacidade</h1>

          <div className="space-y-5 text-slate-700 dark:text-slate-200 leading-relaxed">
            <div>
              <p>
                Esta Política de Privacidade descreve como a plataforma Trabalhei Lá coleta, utiliza, armazena e protege
                as informações dos seus usuários, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
                Ao acessar ou utilizar nossos serviços, você concorda com os termos aqui descritos.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">1. Coleta de dados anônimos</h2>
              <p>
                O Trabalhei Lá foi pensado para preservar a identidade de quem avalia. As avaliações, comentários e relatos
                são publicados de forma anônima, vinculados a um pseudônimo escolhido pelo usuário, e não ao seu nome real.
                Coletamos apenas os dados estritamente necessários para o funcionamento da plataforma, mantendo os dados
                pessoais separados do conteúdo público das avaliações.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">2. Pseudônimo como proteção de identidade</h2>
              <p>
                O pseudônimo é o principal mecanismo de proteção da sua identidade. Ele permite que você contribua com
                avaliações reais sobre empresas sem expor seu nome verdadeiro publicamente. Os dados que poderiam
                identificar você não são exibidos a outros usuários nem associados publicamente às suas avaliações.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">3. Uso do Firebase</h2>
              <p>
                Utilizamos os serviços do Google Firebase para autenticação, armazenamento de dados (Firestore),
                hospedagem e armazenamento de arquivos. As informações são processadas e armazenadas na infraestrutura
                do Firebase, que adota medidas de segurança reconhecidas no mercado. Ao usar a plataforma, alguns dados
                podem ser tratados pelo Google conforme as políticas de privacidade do próprio Firebase.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">4. Finalidade do tratamento</h2>
              <p>
                Os dados coletados são utilizados exclusivamente para viabilizar o cadastro e a autenticação dos usuários,
                permitir a publicação de avaliações de forma anônima, melhorar a experiência de uso e garantir a segurança
                da plataforma. Não comercializamos dados pessoais dos usuários.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">5. Conformidade com a LGPD</h2>
              <p>
                Em conformidade com a LGPD, você tem o direito de solicitar acesso, correção, portabilidade, anonimização
                ou exclusão dos seus dados pessoais, bem como revogar o consentimento a qualquer momento. Tratamos os dados
                com base nos princípios da finalidade, necessidade, transparência e segurança. Para exercer seus direitos,
                entre em contato através dos canais oficiais da plataforma.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">6. Alterações nesta Política</h2>
              <p>
                Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que você a consulte
                regularmente para se manter informado sobre como protegemos seus dados. Alterações significativas serão
                comunicadas pelos meios disponíveis na plataforma.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/"
                className="text-blue-700 dark:text-blue-300 underline font-semibold hover:text-blue-900 dark:hover:text-blue-200"
              >
                Voltar para a página inicial
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
