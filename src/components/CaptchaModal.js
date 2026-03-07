import React from "react";

export default function CaptchaModal({ open, onClose, checked, onChange, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6">
        <h2 className="text-xl font-bold text-blue-800 mb-4">Verificação de segurança</h2>
        <p className="text-sm text-slate-600 mb-4">
          Antes de enviar sua avaliação, precisamos confirmar que você é uma pessoa real. Isso ajuda a manter a comunidade confiável.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="captcha-checkbox"
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="captcha-checkbox" className="text-sm text-slate-700">
            Não sou um robô e confirmo que minha avaliação será sincera.
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!checked}
            className={`px-4 py-2 rounded-xl font-semibold text-white ${
              checked ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-200 cursor-not-allowed"
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
