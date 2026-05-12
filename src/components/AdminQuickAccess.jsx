import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isAdmin } from "../utils/rbac";

/**
 * AdminQuickAccess
 * Botão flutuante (FAB) fixo no canto superior direito, visível apenas
 * para administradores. Centraliza atalhos para ferramentas internas como
 * o "Preview de Dashboard de Apoiador" e o "Gerenciamento de Profissões".
 *
 * Uso: renderizar em páginas administrativas, ex.:
 *   <AdminQuickAccess />
 */
export default function AdminQuickAccess({ position = "top-right" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  if (!isAdmin()) return null;

  const here = location.pathname;
  const items = [
    {
      to: "/admin/preview-apoiador",
      label: "Preview de Dashboard",
      icon: "👁️",
      hint: "Simular dashboard por profissão",
    },
    {
      to: "/admin/profissoes",
      label: "Gerenciar Profissões",
      icon: "🧩",
      hint: "Profissões / Especialidades",
    },
    {
      to: "/admin/apoiadores",
      label: "Apoiadores",
      icon: "🤝",
      hint: "Dashboard de apoiadores",
    },
    {
      to: "/admin/plans",
      label: "Gerenciar Planos",
      icon: "💳",
      hint: "Conceder/remover Premium Gratuito",
    },
    {
      to: "/admin/crescimento",
      label: "Crescimento",
      icon: "📈",
      hint: "Métricas, gráfico e tabela de usuários",
    },
    {
      to: "/admin?tab=verif",
      label: "Verificações Empresa",
      icon: "🛡️",
      hint: "Aprovar/rejeitar verificações manuais",
    },
    {
      to: "/admin",
      label: "Painel Admin",
      icon: "⚙️",
      hint: "Painel principal",
    },
  ];

  const positionCls =
    position === "top-left"
      ? "top-4 left-4 items-start"
      : "top-4 right-4 items-end";

  return (
    <div
      className={`fixed z-40 flex flex-col gap-2 ${positionCls}`}
      role="region"
      aria-label="Atalhos administrativos"
    >
      {/* FAB principal */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Atalhos de admin"
        className="h-11 w-11 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-lg flex items-center justify-center text-lg ring-1 ring-white/10"
      >
        {open ? "×" : "🛠️"}
      </button>

      {open && (
        <div
          role="menu"
          className="min-w-[220px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-2"
        >
          <p className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Admin
          </p>
          {items.map((it) => {
            const active = here === it.to;
            return (
              <button
                key={it.to}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (!active) navigate(it.to);
                }}
                className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  active
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-semibold"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span aria-hidden className="text-base leading-5">
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{it.label}</span>
                  <span className="block text-[11px] text-slate-400">
                    {it.hint}
                  </span>
                </span>
                {active && (
                  <span className="text-[10px] text-blue-700 dark:text-blue-300">
                    aqui
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
