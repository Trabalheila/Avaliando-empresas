import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import Home from './Home';
import './i18n';

import AuthLinkedIn from './pages/AuthLinkedIn';
import ChoosePseudonym from './pages/ChoosePseudonym';
import CompanyDetails from './pages/CompanyDetails';
import CompanyItemComments from './pages/CompanyItemComments';
import Purpose from './pages/Purpose';
import DeleteData from './pages/DeleteData';
import TermsOfUse from './pages/TermsOfUse';
import PrivacyPolicy from './pages/PrivacyPolicy';
import EscolhaPerfil from './pages/EscolhaPerfil';
import BusinessDashboard from './pages/BusinessDashboard';
import AdminPanel from './pages/AdminPanel';
import AdminUserDetail from './pages/AdminUserDetail';
import AdminSupportersDashboard from './pages/AdminSupportersDashboard';
import AdminProfessionsManager from './pages/AdminProfessionsManager';
import AdminDashboardPreview from './pages/AdminDashboardPreview';
import AdminPlansManager from './pages/AdminPlansManager';
import AdminGrowthDashboard from './pages/AdminGrowthDashboard';
import AdminNfseDashboard from './pages/AdminNfseDashboard';
import EmployerVerification from './pages/EmployerVerification';
import IndiqueGanhe from './pages/IndiqueGanhe';
import ConsultorCadastro from './pages/ConsultorCadastro';
import PrestadorCadastro from './pages/PrestadorCadastro';
import ApoiadorCadastro from './pages/ApoiadorCadastro';
import ApoiadoresList from './pages/ApoiadoresList';
import Apoiadores from './pages/Apoiadores';
import ApoiadorPerfil from './pages/ApoiadorPerfil';
import WorkerProfile from './pages/WorkerProfile';
import MinhaConta from './pages/MinhaConta';
import MyContacts from './pages/MyContacts';
import MyContactsApoiador from './pages/MyContactsApoiador';
import ApoiadorPerfilGerenciar from './pages/ApoiadorPerfilGerenciar';
import CaseDetailsPage from './components/Specialist/CaseDetailsPage';
import SpecialistBenefitsPage from './components/Specialist/SpecialistBenefitsPage';
import FindSpecialistPage from './components/Worker/FindSpecialistPage';
import WorkerBenefitsPage from './components/Worker/WorkerBenefitsPage';
import PlatformChat from './components/Chat/PlatformChat';
import ApoiadorRequisicoes from './pages/ApoiadorRequisicoes';
import CookieBanner from './components/CookieBanner';
import ChatbotWidget from './components/ChatbotWidget';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/RequireAuth';
import CompanyRegister from './pages/CompanyRegister';
import CompanyConfirm from './pages/CompanyConfirm';
import CompanyRegisterAwait from './pages/CompanyRegisterAwait';
import CompanyProfile from './pages/CompanyProfile';
import EmpresaDashboard from './pages/EmpresaDashboard';
import EvaluatePartner from './pages/EvaluatePartner';
import Login from './pages/Login';
import SealDetailsPage from './pages/SealDetailsPage';
import AuthAction from './pages/AuthAction';
import ProfissionalApoioCadastro from './pages/ProfissionalApoioCadastro';
import ProfissionalApoioPerfil from './pages/ProfissionalApoioPerfil';
import ConsultaAvulsaPage from './pages/ConsultaAvulsaPage';
import PagamentoConsultaPage from './pages/PagamentoConsultaPage';
import ConsultaConfirmacaoPage from './pages/ConsultaConfirmacaoPage';
import AgendarAdExitumPage from './pages/AgendarAdExitumPage';
import SelecionarConsultaPage from './pages/SelecionarConsultaPage';
import ConsultaEspecializadaDetalhesPage from './pages/ConsultaEspecializadaDetalhesPage';
import migrateApoiadoresToUsers from './scripts/migrateApoiadoresToUsers';

// Função para aplicar o tema (dark/light)
function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const DEFAULT_ROUTE_TRANSITION = {
  durationMs: 320,
  easing: 'cubic-bezier(0.22, 0.9, 0.2, 1)',
};

const ROUTE_TRANSITION_PRESETS = {
  home: { durationMs: 220, easing: 'cubic-bezier(0.24, 0.86, 0.24, 1)' },
  company: { durationMs: 460, easing: 'cubic-bezier(0.14, 0.96, 0.2, 1)' },
  profile: { durationMs: 340, easing: 'cubic-bezier(0.22, 0.9, 0.2, 1)' },
  purpose: { durationMs: 300, easing: 'cubic-bezier(0.2, 0.88, 0.24, 1)' },
  auth: { durationMs: 280, easing: 'cubic-bezier(0.2, 0.88, 0.24, 1)' },
};

function getTransitionDurationMs() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_ROUTE_TRANSITION.durationMs;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : DEFAULT_ROUTE_TRANSITION.durationMs;
}

function getRouteTransitionProfile(pathname) {
  const baseDuration = getTransitionDurationMs();
  if (baseDuration === 0) return { durationMs: 0, easing: 'linear' };

  const path = pathname || '/';

  if (path === '/') {
    return ROUTE_TRANSITION_PRESETS.home;
  }

  if (path.startsWith('/empresa')) {
    return ROUTE_TRANSITION_PRESETS.company;
  }

  if (path.startsWith('/pseudonym')) {
    return ROUTE_TRANSITION_PRESETS.profile;
  }

  if (path.startsWith('/perfil')) {
    return ROUTE_TRANSITION_PRESETS.profile;
  }

  if (path.startsWith('/minha-conta')) {
    return ROUTE_TRANSITION_PRESETS.profile;
  }

  if (path.startsWith('/purpose')) {
    return ROUTE_TRANSITION_PRESETS.purpose;
  }

  if (path.startsWith('/excluir-dados')) {
    return ROUTE_TRANSITION_PRESETS.purpose;
  }

  if (path.startsWith('/auth')) {
    return ROUTE_TRANSITION_PRESETS.auth;
  }

  return { durationMs: baseDuration, easing: DEFAULT_ROUTE_TRANSITION.easing };
}

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('trabalheiLa_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  // Valor padrão: dia (azul claro). Não seguimos o esquema de cores do sistema automaticamente.
  return 'light';
}


function App() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [theme, setTheme] = useState(getPreferredTheme);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [outgoingLocation, setOutgoingLocation] = useState(null);
  const [incomingLocation, setIncomingLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('forward');
  const initialProfile = useMemo(() => getRouteTransitionProfile(location.pathname), [location.pathname]);
  const [transitionDurationMs, setTransitionDurationMs] = useState(initialProfile.durationMs);
  const [transitionEasing, setTransitionEasing] = useState(initialProfile.easing);
  const transitionTimeoutRef = useRef(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem('trabalheiLa_theme', theme);
  }, [theme]);

  /* Migração one-shot (apenas em dev): espelha cadastros antigos de
     `apoiadores` na coleção `users` com userType="apoiador" para que
     o painel admin os encontre no filtro por tipo. Usa flag em
     localStorage para rodar uma única vez por navegador. */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    migrateApoiadoresToUsers().catch(() => {});
  }, []);

  const toggleTheme = useMemo(() => {
    return () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const currentKey = `${currentLocation.pathname}${currentLocation.search}`;
    const nextKey = `${location.pathname}${location.search}`;
    if (currentKey === nextKey) return;

    const direction = navigationType === 'POP' ? 'back' : 'forward';
    const profile = getRouteTransitionProfile(location.pathname);

    setTransitionDurationMs(profile.durationMs);
    setTransitionEasing(profile.easing);
    setTransitionDirection(direction);
    setOutgoingLocation(currentLocation);
    setIncomingLocation(location);
    setIsTransitioning(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    const duration = profile.durationMs;
    if (duration === 0) {
      setCurrentLocation(location);
      setOutgoingLocation(null);
      setIncomingLocation(location);
      setIsTransitioning(false);
      return;
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentLocation(location);
      setOutgoingLocation(null);
      setIncomingLocation(location);
      setIsTransitioning(false);
    }, duration);
  }, [location, navigationType, currentLocation]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const renderRoutes = (routeLocation) => (
    <Routes location={routeLocation}>
      <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/login" element={<Login theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/entrar" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/auth/linkedin" element={<AuthLinkedIn />} />
      <Route path="/pseudonym" element={<ChoosePseudonym theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa" element={<CompanyDetails theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa/dashboard" element={<BusinessDashboard theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin" element={<AdminPanel theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/avaliador/:profileId" element={<AdminUserDetail theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/apoiadores" element={<AdminSupportersDashboard theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/profissoes" element={<AdminProfessionsManager theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/preview-apoiador" element={<AdminDashboardPreview theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/plans" element={<AdminPlansManager theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/crescimento" element={<AdminGrowthDashboard theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin/nfse" element={<AdminNfseDashboard theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa/verificacao" element={<RequireAuth><EmployerVerification theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/indique-e-ganhe" element={<RequireAuth><IndiqueGanhe theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/consultores/cadastro" element={<ConsultorCadastro theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/prestadores/cadastro" element={<PrestadorCadastro theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/apoiadores" element={<Apoiadores theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/apoiadores/lista" element={<ApoiadoresList theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/apoiadores/cadastro" element={<ApoiadorCadastro theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/apoiadores/perfil/:id" element={<ApoiadorPerfil theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa/comentarios-item" element={<CompanyItemComments theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/purpose" element={<Purpose theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/termos-de-uso" element={<TermsOfUse theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicy theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/escolha-perfil" element={<EscolhaPerfil theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/excluir-dados" element={<RequireAuth><DeleteData theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/perfil/:profileId" element={<WorkerProfile theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/minha-conta" element={<RequireAuth><MinhaConta theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/my-contacts" element={<RequireAuth><MyContacts theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/apoiador/my-contacts" element={<RequireAuth><MyContactsApoiador theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/apoiador/perfil" element={<RequireAuth><ApoiadorPerfilGerenciar theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/especialista/:specialistType/caso/:caseId" element={<RequireAuth><CaseDetailsPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/especialista/beneficios" element={<RequireAuth><SpecialistBenefitsPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/trabalhador/encontrar-especialista" element={<RequireAuth><FindSpecialistPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/trabalhador/beneficios" element={<RequireAuth><WorkerBenefitsPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/consulta-avulsa" element={<RequireAuth><ConsultaAvulsaPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/pagamento-consulta" element={<RequireAuth><PagamentoConsultaPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/consulta/confirmacao" element={<RequireAuth><ConsultaConfirmacaoPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/agendar-ad-exitum/:specialistId" element={<RequireAuth><AgendarAdExitumPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/selecionar-consulta/:specialistId" element={<RequireAuth><SelecionarConsultaPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/consulta-especializada-detalhes/:specialistId" element={<RequireAuth><ConsultaEspecializadaDetalhesPage theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/chat/:conversationId" element={<RequireAuth><PlatformChat theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/apoiador/requisicoes" element={<RequireAuth><ApoiadorRequisicoes theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/empresa/cadastro" element={<CompanyRegister />} />
      <Route path="/empresa/cadastro/aguarde" element={<CompanyRegisterAwait />} />
      <Route path="/empresa/confirmar" element={<CompanyConfirm />} />
      <Route path="/empresa/perfil" element={<RequireAuth><CompanyProfile theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/empresa-dashboard" element={<RequireAuth><EmpresaDashboard theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/empresa/avaliar-parceiro" element={<RequireAuth><EvaluatePartner theme={theme} toggleTheme={toggleTheme} /></RequireAuth>} />
      <Route path="/selo-trabalheila" element={<SealDetailsPage />} />
      <Route path="/auth/action" element={<AuthAction />} />
      <Route path="/profissionais-apoio/cadastro" element={<ProfissionalApoioCadastro theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/profissionais-apoio/:id" element={<ProfissionalApoioPerfil theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );

  return (
    <>
      <div
        className="route-transition-stage"
        style={{
          '--route-transition-ms': `${transitionDurationMs}ms`,
          '--route-transition-ease': transitionEasing,
        }}
      >
        {isTransitioning && outgoingLocation ? (
          <>
            <div
              key={`out-${outgoingLocation.pathname}${outgoingLocation.search}`}
              className={`route-layer route-layer-exit ${
                transitionDirection === 'back' ? 'route-exit-back' : 'route-exit-forward'
              }`}
            >
              <ErrorBoundary key={`eb-out-${outgoingLocation.pathname}`}>
                {renderRoutes(outgoingLocation)}
              </ErrorBoundary>
            </div>
            <div
              key={`in-${incomingLocation.pathname}${incomingLocation.search}`}
              className={`route-layer route-layer-enter ${
                transitionDirection === 'back' ? 'route-enter-back' : 'route-enter-forward'
              }`}
            >
              <ErrorBoundary key={`eb-in-${incomingLocation.pathname}`}>
                {renderRoutes(incomingLocation)}
              </ErrorBoundary>
            </div>
          </>
        ) : (
          <div className="route-layer route-layer-steady">
            <ErrorBoundary key={`eb-${currentLocation.pathname}`}>
              {renderRoutes(currentLocation)}
            </ErrorBoundary>
          </div>
        )}
      </div>
      <CookieBanner />
      <ChatbotWidget />
    </>
  );
}
export default App;
