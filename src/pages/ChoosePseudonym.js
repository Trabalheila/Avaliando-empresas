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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [resumeExperiences, setResumeExperiences] = useState([]);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeMimeType, setResumeMimeType] = useState("");
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [isResumePreviewExpanded, setIsResumePreviewExpanded] = useState(false);
  const [resumeReadConfirmed, setResumeReadConfirmed] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
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
      if (parsed?.email) {
        setEmail(parsed.email);
      }
      if (parsed?.phone) {
        setPhone(parsed.phone);
      }
      if (parsed?.educationLevel) {
        setEducationLevel(parsed.educationLevel);
      }
      if (Array.isArray(parsed?.resumeData?.experiences)) {
        setResumeExperiences(parsed.resumeData.experiences);
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
      setResumeExperiences(parsed.experiences || []);
      setResumeFileName(file.name || "curriculo");
      setResumeText(parsed.rawText || "");
    } catch (err) {
      setError(err?.message || "Nao foi possivel ler o curriculo automaticamente.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleFillFromLinkedIn = useCallback(() => {
    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      if (existingProfile?.name && !pseudonym.trim()) {
        setPseudonym(existingProfile.name);
      }
      if (existingProfile?.email && !email.trim()) {
        setEmail(existingProfile.email);
      }
      if (existingProfile?.phone && !phone.trim()) {
        setPhone(existingProfile.phone);
      }
      setError(null);
    } catch {
      setError("Nao foi possivel carregar dados do LinkedIn no momento.");
    }
  }, [pseudonym, email, phone]);

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
        cpf: cpfNumbers || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        avatar,
        resumeData: {
          fileName: resumeFileName || undefined,
          mimeType: resumeMimeType || undefined,
          readConfirmed: resumeReadConfirmed,
          experiences: resumeExperiences,
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
      email,
      phone,
      educationLevel,
      avatar,
      confirmedHuman,
      resumeFileName,
      resumeMimeType,
      resumeReadConfirmed,
      resumeExperiences,
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
        <label className="block text-sm font-semibold text-slate-700">Nivel escolar</label>
        <input
          value={educationLevel}
          onChange={(e) => setEducationLevel(e.target.value)}
          placeholder="Ex.: Ensino Superior"
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Experiencias identificadas (editavel)</label>
        <textarea
          value={(resumeExperiences || []).join("\n")}
          onChange={(e) =>
            setResumeExperiences(
              e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            )
          }
          placeholder="Experiencias detectadas automaticamente do curriculo"
          rows={5}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Texto extraido do curriculo (editavel)</label>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Texto lido do curriculo para conferencia"
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
            <label className="block text-sm font-semibold text-slate-700 mb-2">Carregar curriculo (PDF, DOCX, TXT, MD, RTF)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleResumeUpload}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">
              O sistema tenta ler e preencher automaticamente os campos essenciais do curriculo.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className={`px-2 py-1 rounded-lg border ${hasResumeFile ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                1. Arquivo carregado: {hasResumeFile ? "OK" : "Pendente"}
              </div>
              <div className={`px-2 py-1 rounded-lg border ${hasResumeParsed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                2. Leitura concluida: {hasResumeParsed ? "OK" : "Pendente"}
              </div>
              <div className={`sm:col-span-2 px-2 py-1 rounded-lg border ${resumeReadConfirmed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                3. Confirmacao do usuario: {resumeReadConfirmed ? "Confirmada" : "Pendente"}
              </div>
            </div>
            {isParsingResume && <p className="text-sm text-blue-700 mt-2">Lendo e interpretando curriculo...</p>}
            {resumeFileName && !isParsingResume && (
              <p className="text-sm text-emerald-700 mt-2">Arquivo processado: {resumeFileName}</p>
            )}
            {resumeFileName && !isParsingResume && !resumeReadConfirmed && (
              <button
                type="button"
                onClick={() => setResumeReadConfirmed(true)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                Confirmar carregamento e leitura do curriculo
              </button>
            )}
            {resumeReadConfirmed && (
              <p className="text-sm text-emerald-700 mt-2 font-semibold">Leitura do curriculo confirmada.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleFillFromLinkedIn}
            className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
          >
            Carregar informacoes do proprio LinkedIn
          </button>

          <div className="hidden md:block space-y-4">
            {renderEditableResumeData()}
          </div>

          <details className="md:hidden bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Verificar e editar dados extraidos do curriculo
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
