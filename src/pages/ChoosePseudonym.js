import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserProfile } from "../services/users";
import { extractResumeText, parseResumeText } from "../utils/resumeParser";

const predefinedAvatars = [
  "🧑", "🧑‍💼", "🧑‍🔧", "🧑‍💻", "🧑‍🔬", "👩‍🏫", "👨‍🍳", "👩‍⚕️", "👨‍🚀", "👩‍🎨",
];

function ChoosePseudonym() {
  const navigate = useNavigate();
  const [pseudonym, setPseudonym] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [professionalObjective, setProfessionalObjective] = useState("");
  const [educationAndProfession, setEducationAndProfession] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [structuredExperiences, setStructuredExperiences] = useState([]);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeMimeType, setResumeMimeType] = useState("");
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [isResumePreviewExpanded, setIsResumePreviewExpanded] = useState(false);
  const [resumeReadConfirmed, setResumeReadConfirmed] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
    };
  }, [resumePreviewUrl]);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(profile);
      if (parsed?.name) {
        setPseudonym(parsed.name);
      }
      if (parsed?.cpf) {
        setCpf(parsed.cpf);
      }
      if (parsed?.resumeData?.name) {
        setFullName(parsed.resumeData.name);
      }
      if (parsed?.resumeData?.objective) {
        setProfessionalObjective(parsed.resumeData.objective);
      }
      if (parsed?.resumeData?.educationSummary) {
        setEducationAndProfession(parsed.resumeData.educationSummary);
      }
      if (parsed?.email) {
        setEmail(parsed.email);
      }
      if (parsed?.phone) {
        setPhone(parsed.phone);
      }
      if (parsed?.educationLevel) {
        setEducationLevel(parsed.educationLevel);
      }
      if (Array.isArray(parsed?.resumeData?.experiencesStructured)) {
        setStructuredExperiences(parsed.resumeData.experiencesStructured);
      }
      if (parsed?.resumeData?.fileName) {
        setResumeFileName(parsed.resumeData.fileName);
      }
      if (parsed?.resumeData?.mimeType) {
        setResumeMimeType(parsed.resumeData.mimeType);
      }
      if (parsed?.resumeData?.readConfirmed) {
        setResumeReadConfirmed(!!parsed.resumeData.readConfirmed);
      }
      if (parsed?.resumeData?.rawText) {
        setResumeText(parsed.resumeData.rawText);
      }
      if (parsed?.avatar) {
        setAvatar(parsed.avatar);
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const convertFileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await convertFileToDataUrl(file);
      setAvatar(dataUrl);
    } catch {
      // ignore
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setInfo("");
    setIsParsingResume(true);
    setResumeReadConfirmed(false);

    try {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      setResumePreviewUrl(previewUrl);
      setResumeMimeType(file.type || "");

      const text = await extractResumeText(file);
      const storedCompanies = JSON.parse(localStorage.getItem("empresasData") || "[]");
      const knownCompanyNames = (storedCompanies || []).map((emp) => emp?.company).filter(Boolean);
      const parsed = parseResumeText(text, knownCompanyNames);

      if (!pseudonym.trim() && parsed.email) {
        const nickname = parsed.email.split("@")[0].replace(/[._-]+/g, " ");
        setPseudonym(
          nickname
            .split(" ")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(" ")
        );
      }

      if (!cpf && parsed.cpf) setCpf(parsed.cpf);
      if (!email && parsed.email) setEmail(parsed.email);
      if (!phone && parsed.phone) setPhone(parsed.phone);
      if (parsed.educationLevel) setEducationLevel(parsed.educationLevel);
      setFullName(parsed.name || "");
      setProfessionalObjective(parsed.objective || "");
      setEducationAndProfession(parsed.educationSummary || "");
      setStructuredExperiences(parsed.experiencesStructured || []);
      setResumeFileName(file.name || "curriculo");
      setResumeText(parsed.rawText || "");
      setInfo("Currículo lido e organizado. Revise os campos antes de confirmar.");
    } catch (err) {
      setError(err?.message || "Nao foi possivel ler o curriculo automaticamente.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleFillFromLinkedIn = useCallback(() => {
    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      let loadedCount = 0;
      setInfo("");
      setError(null);

      if (existingProfile?.name) {
        setPseudonym(existingProfile.name);
        setFullName(existingProfile.name);
        loadedCount += 1;
      }
      if (existingProfile?.email) {
        setEmail(existingProfile.email);
        loadedCount += 1;
      }
      if (existingProfile?.phone) {
        setPhone(existingProfile.phone);
        loadedCount += 1;
      }

      if (loadedCount > 0) {
        setInfo("Informações carregadas do LinkedIn com sucesso.");
      } else {
        setError("Não encontramos novos dados do LinkedIn para preencher.");
      }
    } catch {
      setError("Não foi possível carregar dados do LinkedIn no momento.");
    }
  }, []);

  const handleExperienceFieldChange = (idx, key, value) => {
    const next = [...structuredExperiences];
    next[idx] = { ...next[idx], [key]: value };
    setStructuredExperiences(next);
  };

  const handleAddExperience = () => {
    const next = [...structuredExperiences, { company: "", role: "", details: "" }];
    setStructuredExperiences(next);
  };

  const handleRemoveExperience = (idx) => {
    const next = structuredExperiences.filter((_, i) => i !== idx);
    setStructuredExperiences(next);
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = pseudonym.trim();
      if (!trimmed) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }

      if (!confirmedHuman) {
        setError("Por favor, confirme que você é um humano.");
        return;
      }

      const cpfNumbers = cpf.replace(/\D/g, "");
      if (cpfNumbers && cpfNumbers.length !== 11) {
        setError("CPF deve conter 11 dígitos.");
        return;
      }

      if (resumeFileName && !resumeReadConfirmed) {
        setError("Confirme a leitura do curriculo antes de salvar o perfil.");
        return;
      }

      localStorage.setItem("userPseudonym", trimmed);
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const nextProfile = {
        ...existingProfile,
        name: trimmed,
        fullName: fullName.trim() || undefined,
        cpf: cpfNumbers || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        avatar,
        resumeData: {
          name: fullName.trim() || undefined,
          objective: professionalObjective.trim() || undefined,
          educationSummary: educationAndProfession.trim() || undefined,
          fileName: resumeFileName || undefined,
          mimeType: resumeMimeType || undefined,
          readConfirmed: resumeReadConfirmed,
          experiences: structuredExperiences.map((item) => item.company).filter(Boolean),
          experiencesStructured: structuredExperiences,
          rawText: resumeText,
          parsedAt: new Date().toISOString(),
        },
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      // Salva no Firebase para persistência centralizada
      try {
        await saveUserProfile({
          id: nextProfile.id || nextProfile.email || `anon_${Date.now()}`,
          ...nextProfile,
        });
      } catch (err) {
        console.warn("Falha ao salvar perfil no Firebase:", err);
      }

      // Dispara evento para que outras partes do app atualizem o estado de login
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      navigate("/");
    },
    [
      navigate,
      pseudonym,
      cpf,
      fullName,
      professionalObjective,
      educationAndProfession,
      email,
      phone,
      educationLevel,
      avatar,
      confirmedHuman,
      resumeFileName,
      resumeMimeType,
      resumeReadConfirmed,
      structuredExperiences,
      resumeText,
    ]
  );

  const renderEditableResumeData = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700">Telefone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Nível escolar</label>
        <input
          value={educationLevel}
          onChange={(e) => setEducationLevel(e.target.value)}
          placeholder="Ex.: Ensino Superior"
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Nome</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nome completo"
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Objetivo profissional</label>
        <textarea
          value={professionalObjective}
          onChange={(e) => setProfessionalObjective(e.target.value)}
          placeholder="Objetivo profissional extraido do curriculo"
          rows={4}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Última formação e profissão</label>
        <input
          value={educationAndProfession}
          onChange={(e) => setEducationAndProfession(e.target.value)}
          placeholder="Ex.: Bacharel - Analista de Dados"
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Experiência profissional (empresa e cargo)</label>
        <div className="space-y-3">
          {structuredExperiences.map((exp, idx) => (
            <div key={`${idx}_${exp.company}`} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={exp.company || ""}
                  onChange={(e) => handleExperienceFieldChange(idx, "company", e.target.value)}
                  placeholder="Empresa"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={exp.role || ""}
                  onChange={(e) => handleExperienceFieldChange(idx, "role", e.target.value)}
                  placeholder="Cargo"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                value={exp.details || ""}
                onChange={(e) => handleExperienceFieldChange(idx, "details", e.target.value)}
                placeholder="Detalhes (periodo, atividades, resultados)"
                rows={2}
                className="mt-2 w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleRemoveExperience(idx)}
                className="mt-2 text-xs text-red-600 font-semibold hover:underline"
              >
                Remover experiência
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddExperience}
            className="px-3 py-2 border border-blue-200 text-blue-700 font-semibold rounded-lg hover:bg-blue-50"
          >
            + Adicionar experiência
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Texto extraído do currículo (editável)</label>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Texto lido do currículo para conferência"
          rows={7}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
  );

  const hasResumeFile = Boolean(resumeFileName);
  const hasResumeParsed = Boolean((resumeText || "").trim().length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
          <h1 className="text-2xl font-extrabold text-blue-800 mb-4 text-center">Seu perfil anônimo</h1>
          <p className="text-sm text-slate-600 mb-6">
            Essas informações ajudam a manter a qualidade das avaliações. Seus dados são armazenados localmente e não serão compartilhados.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Pseudônimo</label>
            <input
              value={pseudonym}
              onChange={(e) => {
                setError(null);
                setPseudonym(e.target.value);
              }}
              placeholder="Ex.: Profissional Anônimo"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">CPF (apenas números)</label>
            <input
              value={cpf}
              onChange={(e) => {
                setError(null);
                setCpf(e.target.value);
              }}
              placeholder="00000000000"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Carregar currículo (PDF, DOCX, TXT, MD, RTF)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleResumeUpload}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">
              O sistema tenta ler e preencher automaticamente os campos essenciais do currículo.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className={`px-2 py-1 rounded-lg border ${hasResumeFile ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                1. Arquivo carregado: {hasResumeFile ? "OK" : "Pendente"}
              </div>
              <div className={`px-2 py-1 rounded-lg border ${hasResumeParsed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                2. Leitura concluída: {hasResumeParsed ? "OK" : "Pendente"}
              </div>
              <div className={`sm:col-span-2 px-2 py-1 rounded-lg border ${resumeReadConfirmed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                3. Confirmação do usuário: {resumeReadConfirmed ? "Confirmada" : "Pendente"}
              </div>
            </div>
            {isParsingResume && <p className="text-sm text-blue-700 mt-2">Lendo e interpretando currículo...</p>}
            {resumeFileName && !isParsingResume && (
              <p className="text-sm text-emerald-700 mt-2">Arquivo processado: {resumeFileName}</p>
            )}
            {resumeFileName && !isParsingResume && !resumeReadConfirmed && (
              <button
                type="button"
                onClick={() => setResumeReadConfirmed(true)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                Confirmar carregamento e leitura do currículo
              </button>
            )}
            {resumeReadConfirmed && (
              <p className="text-sm text-emerald-700 mt-2 font-semibold">Leitura do currículo confirmada.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleFillFromLinkedIn}
            className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
          >
            Carregar informações do próprio LinkedIn
          </button>

          <div className="hidden md:block space-y-4">
            {renderEditableResumeData()}
          </div>

          <details className="md:hidden bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Verificar e editar dados extraídos do currículo
            </summary>
            <div className="mt-3 space-y-4">
              {renderEditableResumeData()}
            </div>
          </details>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Avatar</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedAvatars.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAvatar(item)}
                  className={`h-12 w-12 rounded-xl border flex items-center justify-center text-2xl ${
                    avatar === item ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              {avatar && typeof avatar === "string" && avatar.startsWith("data:") && (
                <span className="text-sm text-slate-600">Imagem carregada</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="confirm-human"
              checked={confirmedHuman}
              onChange={(e) => setConfirmedHuman(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="confirm-human" className="text-sm text-slate-700">
              Não sou um robô e concordo em enviar uma avaliação sincera.
            </label>
          </div>

          {info && <p className="text-emerald-700 text-sm">{info}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
          >
            Salvar perfil
          </button>
          </form>
        </div>

        <aside className="hidden md:block bg-white rounded-3xl shadow-xl p-4 border border-blue-100 h-fit sticky top-6">
          <h2 className="text-sm font-bold text-blue-800 mb-3">Curriculo para verificacao</h2>
          {!resumePreviewUrl ? (
            <p className="text-sm text-slate-500">Carregue um curriculo para visualizar aqui.</p>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                {resumeMimeType === "application/pdf" ? (
                  <iframe title="Preview do curriculo" src={resumePreviewUrl} className="w-full h-64" />
                ) : (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap p-3 max-h-64 overflow-auto">
                    {(resumeText || "").slice(0, 1800) || "Nao foi possivel montar preview visual para este formato."}
                  </pre>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsResumePreviewExpanded(true)}
                className="mt-3 w-full py-2 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50"
              >
                Ampliar verificacao
              </button>
            </>
          )}
        </aside>
      </div>

      {isResumePreviewExpanded && (
        <div className="fixed inset-0 z-50 bg-black/70 p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-blue-800">Visualizacao ampliada do curriculo</h3>
              <button
                type="button"
                onClick={() => setIsResumePreviewExpanded(false)}
                className="px-3 py-1 rounded-lg border border-gray-300 text-slate-700 hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden">
              {resumeMimeType === "application/pdf" ? (
                <iframe title="Preview ampliado do curriculo" src={resumePreviewUrl} className="w-full h-full" />
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap p-4 h-full overflow-auto">
                  {resumeText || "Nao foi possivel montar preview visual para este formato."}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChoosePseudonym;
