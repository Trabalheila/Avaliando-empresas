import React from 'react';
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaRocket,
  FaHeart,
  FaChartBar,
  FaTrophy,
} from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import Select from 'react-select';
import './index.css';
import LoginLinkedInButton from './components/LoginLinkedInButton';

function TrabalheiLaDesktop({
  company,
  setCompany,
  newCompany,
  setNewCompany,
  rating,
  setRating,
  contatoRH,
  setContatoRH,
  salarioBeneficios,
  setSalarioBeneficios,
  estruturaEmpresa,
  setEstruturaEmpresa,
  acessibilidadeLideranca,
  setAcessibilidadeLideranca,
  planoCarreiras,
  setPlanoCarreiras,
  bemestar,
  setBemestar,
  estimulacaoOrganizacao,
  setEstimulacaoOrganizacao,
  commentRating,
  setCommentRating,
  commentContatoRH,
  setCommentContatoRH,
  commentSalarioBeneficios,
  setCommentSalarioBeneficios,
  commentEstruturaEmpresa,
  setCommentEstruturaEmpresa,
  commentAcessibilidadeLideranca,
  setCommentAcessibilidadeLideranca,
  commentPlanoCarreiras,
  setCommentPlanoCarreiras,
  commentBemestar,
  setCommentBemestar,
  commentEstimulacaoOrganizacao,
  setCommentEstimulacaoOrganizacao,
  comment,
  setComment,
  empresas,
  isAuthenticated,
  isLoading,
  companies,
  companyOptions,
  formatOptionLabel,
  handleAddCompany,
  handleLinkedInSuccess,
  handleLinkedInFailure,
  handleGoogleLogin,
  handleSubmit,
  calcularMedia,
  getBadgeColor,
  top3,
  getMedalColor,
  getMedalEmoji,
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: 'url("/fundo-new.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Header fixo */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/trofeu-new.png"
              alt="Troféu"
              className="w-10 h-10 object-contain"
            />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Trabalhei{' '}
              <span className="text-[#4FC3F7]">Lá</span>
            </h1>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-400/50">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm text-white font-semibold">
                Autenticado
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Top 3 - Pódio horizontal */}
      {top3.length > 0 && (
        <section className="max-w-7xl mx-auto px-8 py-8">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex items-center justify-center gap-3 mb-6">
              <FaTrophy className="text-yellow-500 text-3xl" />
              <h2 className="text-2xl font-bold text-gray-800">
                Top 3 Empresas Mais Bem Avaliadas
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {top3.map((emp, idx) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={idx}
                    className={`bg-gradient-to-br ${getMedalColor(
                      idx
                    )} rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-all`}
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-3">{getMedalEmoji(idx)}</div>
                      <h3 className="font-bold text-xl mb-2">{emp.company}</h3>
                      <p className="text-sm opacity-90 mb-3">
                        {emp.area} • {emp.periodo}
                      </p>
                      <div className="bg-white/30 px-4 py-2 rounded-full font-bold text-lg inline-block">
                        {media} ⭐
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Formulário centralizado */}
      <section className="max-w-4xl mx-auto px-8 py-8">
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-10 border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Avalie uma Empresa
            </h2>
            <p className="text-gray-600">
              Sua opinião é anônima e ajuda outros profissionais
            </p>
          </div>

          {!isAuthenticated && (
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🔒</div>
                <div>
                  <h3 className="font-bold text-lg mb-2">
                    Sua privacidade é garantida
                  </h3>
                  <p className="text-sm text-blue-50">
                    Usamos o LinkedIn ou Google apenas para verificar seu vínculo
                    profissional. Suas avaliações são{' '}
                    <strong>100% anônimas</strong> — nome e perfil nunca são
                    exibidos.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de empresa */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <FaBuilding className="text-blue-600" /> Selecione a Empresa
              </label>
              <Select
                value={company}
                onChange={setCompany}
                options={companyOptions}
                formatOptionLabel={formatOptionLabel}
                placeholder="Digite ou selecione..."
                className="mb-4"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="flex-1 border-2 border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ou adicione uma nova empresa"
                />
                <button
                  type="button"
                  onClick={handleAddCompany}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-semibold whitespace-nowrap"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Avaliações em grid 4 colunas */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: 'Avaliação Geral',
                  value: rating,
                  setter: setRating,
                  icon: FaStar,
                  color: 'text-yellow-500',
                  comment: commentRating,
                  setComment: setCommentRating,
                },
                {
                  label: 'Contato do RH',
                  value: contatoRH,
                  setter: setContatoRH,
                  icon: FaHandshake,
                  color: 'text-blue-500',
                  comment: commentContatoRH,
                  setComment: setCommentContatoRH,
                },
                {
                  label: 'Salário',
                  value: salarioBeneficios,
                  setter: setSalarioBeneficios,
                  icon: FaMoneyBillWave,
                  color: 'text-green-500',
                  comment: commentSalarioBeneficios,
                  setComment: setCommentSalarioBeneficios,
                },
                {
                  label: 'Estrutura',
                  value: estruturaEmpresa,
                  setter: setEstruturaEmpresa,
                  icon: FaBuilding,
                  color: 'text-gray-600',
                  comment: commentEstruturaEmpresa,
                  setComment: setCommentEstruturaEmpresa,
                },
                {
                  label: 'Liderança',
                  value: acessibilidadeLideranca,
                  setter: setAcessibilidadeLideranca,
                  icon: FaUserTie,
                  color: 'text-purple-500',
                  comment: commentAcessibilidadeLideranca,
                  setComment: setCommentAcessibilidadeLideranca,
                },
                {
                  label: 'Plano de Carreira',
                  value: planoCarreiras,
                  setter: setPlanoCarreiras,
                  icon: FaRocket,
                  color: 'text-red-500',
                  comment: commentPlanoCarreiras,
                  setComment: setCommentPlanoCarreiras,
                },
                {
                  label: 'Bem-estar',
                  value: bemestar,
                  setter: setBemestar,
                  icon: FaHeart,
                  color: 'text-pink-500',
                  comment: commentBemestar,
                  setComment: setCommentBemestar,
                },
                {
                  label: 'Organização',
                  value: estimulacaoOrganizacao,
                  setter: setEstimulacaoOrganizacao,
                  icon: FaChartBar,
                  color: 'text-indigo-500',
                  comment: commentEstimulacaoOrganizacao,
                  setComment: setCommentEstimulacaoOrganizacao,
                },
              ].map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-400 transition-all"
                  >
                    <label className="block text-xs font-extrabold text-[#1E3A8A] mb-2 flex items-center gap-1">
                      <IconComponent className={item.color} size={16} />
                      <span className="truncate">{item.label}</span>
                    </label>
                    <div className="flex justify-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FaStar
                          key={star}
                          size={18}
                          className="cursor-pointer transition-all hover:scale-110"
                          color={star <= item.value ? '#facc15' : '#e5e7eb'}
                          onClick={() => item.setter(star)}
                        />
                      ))}
                    </div>
                    <div className="text-center text-sm font-bold text-purple-600">
                      {item.value}/5
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comentários individuais (expansível) */}
            <details className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <summary className="font-bold text-gray-700 cursor-pointer hover:text-purple-600 transition-colors">
                💬 Adicionar comentários detalhados (opcional)
              </summary>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Avaliação Geral', comment: commentRating, setComment: setCommentRating },
                  { label: 'Contato do RH', comment: commentContatoRH, setComment: setCommentContatoRH },
                  { label: 'Salário e Benefícios', comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios },
                  { label: 'Estrutura', comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa },
                  { label: 'Liderança', comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca },
                  { label: 'Plano de Carreira', comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras },
                  { label: 'Bem-estar', comment: commentBemestar, setComment: setCommentBemestar },
                  { label: 'Organização', comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao },
                ].map((item, idx) => (
                  <div key={idx}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {item.label}
                    </label>
                    <textarea
                      value={item.comment}
                      onChange={(e) => item.setComment(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                      placeholder={`Comente sobre ${item.label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            </details>

            {/* Comentário geral */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                💬 Comentário Geral (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full border-2 border-purple-300 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                placeholder="Compartilhe uma visão geral sobre sua experiência"
              />
            </div>

            {/* Autenticação e envio */}
            <div className="flex flex-col items-center space-y-4">
              {!isAuthenticated ? (
                <div className="w-full max-w-md space-y-3">
                  <LoginLinkedInButton
                    clientId={
                      process.env.REACT_APP_LINKEDIN_CLIENT_ID || '77dv5urtc8ixj3'
                    }
                    redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                    onLoginSuccess={handleLinkedInSuccess}
                    onLoginFailure={handleLinkedInFailure}
                    disabled={isLoading}
                  />

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg px-6 py-3 rounded-xl transition-all font-semibold text-gray-700"
                  >
                    <FcGoogle size={24} />
                    Entrar com Google
                  </button>

                  {isLoading && (
                    <p className="text-sm text-gray-600 text-center animate-pulse">
                      Autenticando...
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-4 text-white text-center font-semibold shadow-lg max-w-md">
                  ✅ Pronto! Agora você pode enviar sua avaliação anônima
                </div>
              )}
              <button
                type="submit"
                className={`px-12 py-4 rounded-xl text-white font-bold text-lg transition-all ${
                  isAuthenticated
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-2xl hover:scale-105'
                    : 'bg-gray-400 cursor-not-allowed opacity-60'
                }`}
                disabled={!isAuthenticated}
              >
                {isAuthenticated
                  ? '🚀 Enviar Avaliação'
                  : '🔒 Faça login para avaliar'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Últimas avaliações */}
      {empresas.length > 3 && (
        <section className="max-w-7xl mx-auto px-8 py-8">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Últimas Avaliações
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {empresas.slice(3, 9).map((emp, idx) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-5 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                          {emp.company}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {emp.area} • {emp.periodo}
                        </p>
                      </div>
                      <div
                        className={`${getBadgeColor(
                          media
                        )} px-3 py-1 rounded-full text-white font-bold text-sm shadow-md`}
                      >
                        {media} ⭐
                      </div>
                    </div>
                    {emp.comment && (
                      <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-3 mt-3">
                        "{emp.comment.substring(0, 100)}
                        {emp.comment.length > 100 ? '...' : ''}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-8 text-center">
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <p className="text-gray-600 text-sm">
            <a
              href="/politica-de-privacidade.html"
              className="text-purple-600 hover:text-purple-800 font-semibold underline"
            >
              Política de Privacidade
            </a>
            {' • '}
            <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default TrabalheiLaDesktop;
