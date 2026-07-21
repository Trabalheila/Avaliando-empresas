// src/components/Specialist/AnamneseCard.jsx
//
// Seção de Anamnese do especialista PSICÓLOGO, exibida na página do caso.
// Reúne dois fluxos:
//   • Identificação do Caso (P3): checkboxes das doenças ocupacionais (CID-10).
//   • Anamnese (P5): documento pré-preenchido, editável e salvo no Firestore
//     vinculado ao caso do paciente (apoiadores/{specialistId}/cases/{caseId}).
//
// Carrega automaticamente a anamnese já existente (se houver) e permite
// gerar, editar e salvar. Visível apenas para o especialista logado (a página
// do caso só é acessível pelo próprio especialista).

import React, { useMemo, useState } from "react";
import { OCCUPATIONAL_DISEASES } from "../../data/occupationalDiseases";
import { saveCaseAnamnese } from "../../services/specialistCases";

function todayBR() {
  return new Date().toLocaleDateString("pt-BR");
}

export default function AnamneseCard({
  specialistId,
  caseId,
  patientName,
  clientProfile,
  existingAnamnese,
}) {
  const initial = existingAnamnese || null;

  const [selected, setSelected] = useState(
    Array.isArray(initial?.doencas) ? initial.doencas.map((d) => d.code) : []
  );
  const [queixas, setQueixas] = useState(initial?.queixasPrincipais || "");
  const [histOcupacional, setHistOcupacional] = useState(
    initial?.historicoOcupacional || ""
  );
  const [histClinico, setHistClinico] = useState(initial?.historicoClinico || "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes || "");
  const [generated, setGenerated] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Dados do paciente disponíveis no sistema (perfil do cliente, quando houver).
  const patientData = useMemo(() => {
    const c = clientProfile || {};
    return {
      nome: c.fullName || patientName || "Paciente",
      idade: c.age || c.idade || "",
      profissao: c.profissao || c.profession || "",
      cidade: c.city || c.cidade || "",
      email: c.email || "",
    };
  }, [clientProfile, patientName]);

  const toggleDisease = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    setMessage("");
  };

  const selectedDiseases = useMemo(
    () => OCCUPATIONAL_DISEASES.filter((d) => selected.includes(d.code)),
    [selected]
  );

  // Gera o documento de anamnese pré-preenchido. Exige ao menos uma doença
  // marcada. Preenche os campos editáveis apenas quando ainda estão vazios,
  // para não sobrescrever o que o especialista já digitou.
  const handleGenerate = () => {
    setError("");
    setMessage("");
    if (selected.length === 0) {
      setError("Selecione ao menos uma doença ocupacional para gerar a anamnese.");
      return;
    }
    const doencasTxt = selectedDiseases
      .map((d) => `• ${d.label} (CID-10: ${d.code})`)
      .join("\n");

    if (!queixas.trim()) {
      setQueixas(
        `Paciente ${patientData.nome} apresenta queixas compatíveis com:\n${doencasTxt}\n\n(Descreva aqui as queixas principais relatadas na sessão.)`
      );
    }
    if (!histOcupacional.trim()) {
      setHistOcupacional(
        `${patientData.profissao ? `Profissão: ${patientData.profissao}.\n` : ""}(Descreva a trajetória e as condições de trabalho relacionadas ao adoecimento.)`
      );
    }
    if (!histClinico.trim()) {
      setHistClinico(
        "(Antecedentes clínicos, tratamentos anteriores, uso de medicação, histórico familiar relevante.)"
      );
    }
    setGenerated(true);
    setMessage("Anamnese gerada. Revise os campos e salve.");
  };

  const buildAnamnese = () => ({
    caseId,
    data: todayBR(),
    paciente: patientData,
    doencas: selectedDiseases.map((d) => ({ code: d.code, label: d.label })),
    queixasPrincipais: queixas,
    historicoOcupacional: histOcupacional,
    historicoClinico: histClinico,
    observacoes,
  });

  const handleSave = async () => {
    setError("");
    setMessage("");
    if (selected.length === 0) {
      setError("Selecione ao menos uma doença ocupacional antes de salvar.");
      return;
    }
    if (!specialistId || !caseId) {
      setError("Não foi possível identificar o caso para salvar a anamnese.");
      return;
    }
    setSaving(true);
    try {
      await saveCaseAnamnese(specialistId, caseId, buildAnamnese());
      setMessage("Anamnese salva com sucesso.");
    } catch (err) {
      setError(err?.message || "Falha ao salvar a anamnese.");
    } finally {
      setSaving(false);
    }
  };

  // Baixa a anamnese como documento Word (.doc) — HTML compatível com Word e
  // Google Docs, gerado a partir dos campos atuais (não exige nada salvo).
  const handleDownload = () => {
    setError("");
    if (selected.length === 0) {
      setError("Selecione ao menos uma doença ocupacional para baixar a anamnese.");
      return;
    }
    const esc = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    const doencasHtml = selectedDiseases
      .map((d) => `<li>${esc(d.label)} (CID-10: ${esc(d.code)})</li>`)
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Anamnese</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <h1 style="color:#1d4ed8;">Anamnese Psicológica Ocupacional</h1>
        <p><strong>Paciente:</strong> ${esc(patientData.nome)}<br>
        <strong>Data:</strong> ${esc(todayBR())}${
          patientData.profissao ? `<br><strong>Profissão:</strong> ${esc(patientData.profissao)}` : ""
        }${patientData.cidade ? `<br><strong>Cidade:</strong> ${esc(patientData.cidade)}` : ""}</p>
        <h2>Doenças ocupacionais identificadas (CID-10)</h2>
        <ul>${doencasHtml}</ul>
        <h2>Queixas principais</h2>
        <p>${esc(queixas)}</p>
        <h2>Histórico ocupacional</h2>
        <p>${esc(histOcupacional)}</p>
        <h2>Histórico clínico</h2>
        <p>${esc(histClinico)}</p>
        <h2>Observações</h2>
        <p>${esc(observacoes)}</p>
      </body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = String(patientData.nome || "paciente").replace(/[^\w.-]+/g, "_");
    a.href = url;
    a.download = `Anamnese_${safeName}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-4 sm:p-5">
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">🧠</span> Anamnese · Identificação do Caso
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Marque as doenças ocupacionais identificadas (CID-10) e gere a anamnese
        pré-preenchida. O documento é salvo com segurança e vinculado a este caso.
      </p>

      {/* Dados do paciente */}
      <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm text-slate-700 dark:text-slate-200">
        <p className="font-semibold">Paciente: {patientData.nome}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Data: {todayBR()}
          {patientData.profissao ? ` · ${patientData.profissao}` : ""}
          {patientData.cidade ? ` · ${patientData.cidade}` : ""}
        </p>
      </div>

      {/* Checkboxes CID-10 (Identificação do Caso) */}
      <fieldset className="mt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Doenças ocupacionais (CID-10)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OCCUPATIONAL_DISEASES.map((d) => {
            const checked = selected.includes(d.code);
            return (
              <label
                key={d.code}
                className={[
                  "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition text-sm",
                  checked
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDisease(d.code)}
                  className="mt-0.5"
                />
                <span className="text-slate-800 dark:text-slate-100">
                  {d.label}{" "}
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    ({d.code})
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
        >
          📝 Gerar Anamnese
        </button>
      </div>

      {/* Campos editáveis (aparecem após gerar ou quando já existe anamnese) */}
      {generated && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Queixas principais
            </label>
            <textarea
              rows={4}
              value={queixas}
              onChange={(e) => setQueixas(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Histórico ocupacional
            </label>
            <textarea
              rows={4}
              value={histOcupacional}
              onChange={(e) => setHistOcupacional(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Histórico clínico
            </label>
            <textarea
              rows={4}
              value={histClinico}
              onChange={(e) => setHistClinico(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Observações
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
            >
              {saving ? "Salvando…" : "💾 Salvar anamnese"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              ⬇️ Baixar anamnese (.doc)
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
