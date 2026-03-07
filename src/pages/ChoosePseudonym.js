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
  const [resumeText, setResumeText] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
  const [error, setError] = useState(null);

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

    try {
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
      resumeExperiences,
      resumeText,
    ]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
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

          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3">
            <p className="text-sm text-slate-700">
              Seu LinkedIn ja foi validado no login e vinculado automaticamente ao seu perfil.
            </p>
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
            {isParsingResume && <p className="text-sm text-blue-700 mt-2">Lendo e interpretando curriculo...</p>}
            {resumeFileName && !isParsingResume && (
              <p className="text-sm text-emerald-700 mt-2">Arquivo processado: {resumeFileName}</p>
            )}
          </div>

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
            <label className="block text-sm font-semibold text-slate-700">Experiencias identificadas</label>
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
    </div>
  );
}

export default ChoosePseudonym;
