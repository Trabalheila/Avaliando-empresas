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
} from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import Select from 'react-select';
import './index.css';
import LoginLinkedInButton from './components/LoginLinkedInButton';

function TrabalheiLaMobile({
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
      className="min-h-screen p-2 md:p-8"
      style={{
        backgroundImage: 'url("/fundo-new.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="max-w-7xl mx-auto mb-6 md:mb-8">
        <div className="rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative bg-black/50 md:bg-black/40 backdrop-blur-sm">
          <div className="p-4 md:p-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
                  Trabalhei{' '}
                  <span className="text-[#4FC3F7] drop-shadow-[0_0_8px_rgba(0,0,0,1)]">
                    Lá
                  </span>
                </h1>
                <p className="mt-2 md:mt-3 text-xs md:text-base font-bold text-white">
                  Avaliações reais, anônimas e confiáveis.
                </p>
              </div>
              {isAuthenticated && (
                <div className="flex items-center gap-2 md:gap-3 bg-white/10 px-3 py-1.5 md:px-6 md:py-3 rounded-full shadow-lg border border-white/30 backdrop-blur-md">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs md:text-sm text-white font-semibold">
                    Autenticado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-3 md:p-8 border border-white/20">
            {!isAuthenticated && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 md:p-6 mb-6 md:mb-8 text-white shadow-lg">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="text-2xl md:text-3xl">🔒</div>
                  <div>
                    <h3 className="font-bold text-base md:text-lg mb-1 md:mb-2">
                      Sua privacidade é garantida
                    </h3>
                    <p className="text-xs md:text-sm text-blue-50">
                      Usamos o LinkedIn ou Google apenas para verificar seu vínculo
                      profissional. Suas avaliações são <strong>100% anônimas</strong> —
                      nome e perfil nunca são exibidos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 md:p-6 border border-gray-200">
                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
                  <FaBuilding className="text-blue-600" /> Selecione a Empresa
                </label>
                <Select
                  value={company}
                  onChange={setCompany}
                  options={companyOptions}
                  formatOptionLabel={formatOptionLabel}
                  placeholder="Digite ou selecione..."
                  className="mb-3 md:mb-4 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="flex-1 border-2 border-gray-300 p-2 md:p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="Ou adicione uma nova empresa"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 md:px-4 py-2 rounded-xl hover:shadow-lg transition-all font-semibold whitespace-nowrap text-xs md:text-sm"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 md:gap-4">
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
                    label: 'Salário e Benefícios',
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
                      className="bg-white rounded-xl p-3 md:p-4 border-2 border-gray-200 hover:border-purple-400 transition-all"
                    >
                      <label className="block text-xs md:text-sm font-extrabold text-[#1E3A8A] mb-2 flex items-center gap-2 drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]">
                        <IconComponent className={item.color} /> {item.label}
                        <span className="ml-auto text-purple-600">
                          {item.value}/5
                        </span>
                      </label>
                      <div className="flex gap-1 mb-2 md:mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FaStar
                            key={star}
                            size={20}
                            className="cursor-pointer transition-all hover:scale-110"
                            color={star <= item.value ? '#facc15' : '#e5e7eb'}
                            onClick={() => item.setter(star)}
                          />
                        ))}
                      </div>
                      <textarea
                        value={item.comment}
                        onChange={(e) => item.setComment(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 p-2 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y max-h-32"
                        placeholder={`Comente sobre ${item.label.toLowerCase()} (opcional)`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 md:p-6 border-2 border-purple-200">
                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2 md:mb-3">
                  💬 Comentário Geral (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full border-2 border-purple-300 p-3 md:p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y max-h-40 text-xs md:text-sm"
                  placeholder="Compartilhe uma visão geral sobre sua experiência (opcional)"
                />
              </div>

              <div className="flex flex-col items-center space-y-3 md:space-y-4">
                {!isAuthenticated ? (
                  <div className="w-full max-w-xs space-y-3">
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
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg px-6 py-3 rounded-xl transition-all font-semibold text-gray-700 text-sm"
                    >
                      <FcGoogle size={24} />
                      Entrar com Google
                    </button>

                    {isLoading && (
                      <p className="text-xs md:text-sm text-gray-600 mt-2 md:mt-3 text-center animate-pulse">
                        Autenticando...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-3 md:p-4 text-white text-center font-semibold shadow-lg max-w-md text-xs md:text-sm">
                    ✅ Pronto! Agora você pode enviar sua avaliação anônima
                  </div>
                )}
                <button
                  type="submit"
                  className={`px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-white font-semibold text-xs md:text-base transition-all max-w-xs w-full ${
                    isAuthenticated
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg'
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
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-4 md:p-6 border border-white/20 lg:sticky lg:top-8">
            <div className="flex flex-col items-center mb-4 md:mb-6">
              <h2 className="text-sm md:text-base font-bold text-slate-700 text-center mb-3">
                Ranking - Top Empresas Avaliadas
              </h2>
              <img
                src="/trofeu-new.png"
                alt="Troféu Trabalhei Lá"
                className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg"
              />
            </div>

            {top3.length > 0 && (
              <div className="mb-4 md:mb-6 space-y-2 md:space-y-3">
                {top3.map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${getMedalColor(
                        idx
                      )} rounded-2xl p-3 md:p-4 text-white shadow-lg transform hover:scale-105 transition-all`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="text-2xl md:text-4xl">
                            {getMedalEmoji(idx)}
                          </span>
                          <div>
                            <h3 className="font-bold text-sm md:text-lg">
                              {emp.company}
                            </h3>
                            <p className="text-xs opacity-90">
                              {emp.area} • {emp.periodo}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white/20 px-2 md:px-3 py-1 rounded-full font-bold text-xs md:text-sm">
                          {media} ⭐
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 md:space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {empresas.length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <FaChartBar className="text-gray-300 text-4xl md:text-6xl mx-auto mb-3 md:mb-4" />
                  <p className="text-gray-500 font-medium text-sm md:text-base">
                    Nenhuma avaliação ainda
                  </p>
                  <p className="text-xs md:text-sm text-gray-400 mt-2">
                    Seja o primeiro a avaliar!
                  </p>
                </div>
              ) : (
                empresas.slice(3).map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-3 md:p-4 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2 md:mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-sm md:text-base">
                            {emp.company}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {emp.area} • {emp.periodo}
                          </p>
                        </div>
                        <div
                          className={`${getBadgeColor(
                            media
                          )} px-2 md:px-3 py-1 rounded-full text-white font-bold text-xs md:text-sm shadow-md`}
                        >
                          {media} ⭐
                        </div>
                      </div>
                      {emp.comment && (
                        <p className="text-xs md:text-sm text-gray-600 italic border-t border-gray-200 pt-2 md:pt-3 mt-2 md:mt-3">
                          "{emp.comment.substring(0, 80)}
                          {emp.comment.length > 80 ? '...' : ''}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto mt-8 md:mt-12 text-center">
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20">
          <p className="text-gray-600 text-xs md:text-sm">
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

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #ec4899);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #db2777);
        }
      `}</style>
    </div>
  );
}

export default TrabalheiLaMobile;
