$ErrorActionPreference = 'Stop'
$file = "src/TrabalheiLaMobile.js"
$lines = Get-Content $file -Encoding UTF8

if ($lines.Length -ne 1399) { throw "Esperava 1399 linhas, achei $($lines.Length)." }

# Marcadores
$check = @{
  839 = '\{/\* LOGIN \*/\}'
  854 = 'Acesso para Avaliar'
  855 = 'flex flex-col items-center space-y-3'
  856 = '<div className="w-full max-w-xs">'
  857 = 'LoginLinkedInButton'
  864 = '</div>'
  865 = '<button'
  872 = '</button>'
  873 = 'Bloco neutro de cadastro por perfil'
  918 = '<p className="text-xs text-slate-500'
  920 = '</p>'
  921 = '</div>'
  923 = '</section>'
}
foreach ($k in $check.Keys) {
  if ($lines[$k-1] -notmatch $check[$k]) {
    throw "Marcador linha $k falhou. Esperado /$($check[$k])/. Got: $($lines[$k-1])"
  }
}

$nl = [System.Collections.ArrayList]::new()

# 0..837 (linhas 1..838) — tudo ate antes do comentario LOGIN
[void]$nl.AddRange($lines[0..837])

# Inserir card central amarelo
$yellow = @(
  '        {/* CARD CENTRAL DE LOGIN — Google + LinkedIn (acima do formulario) */}'
  '        {!isAuthenticated && ('
  '          <div className="mx-auto w-full bg-amber-100 dark:bg-amber-200/15 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl shadow-lg p-4">'
  '            <h2 className="text-base font-extrabold text-amber-900 dark:text-amber-100 text-center mb-1 tracking-wide">'
  '              Entre para avaliar'
  '            </h2>'
  '            <p className="text-xs text-amber-800 dark:text-amber-200 text-center mb-3">'
  '              Use Google ou LinkedIn — seu nome continua anonimo.'
  '            </p>'
  '            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2">'
  '              <button'
  '                type="button"'
  '                onClick={onGoogleLogin}'
  '                disabled={isLoading}'
  '                className="flex-1 inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 text-blue-800 dark:text-blue-200 font-semibold py-2.5 px-3 rounded-lg shadow hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-60"'
  '              >'
  '                <FaGoogle className="text-base" /> Entrar com Google'
  '              </button>'
  '              <div className="flex-1">'
  '                <LoginLinkedInButton'
  '                  clientId={linkedInClientId}'
  '                  redirectUri={linkedInRedirectUri}'
  '                  onLoginSuccess={onLoginSuccess}'
  '                  onLoginFailure={(err) => setError(err?.message || String(err))}'
  '                  disabled={isLoading}'
  '                />'
  '              </div>'
  '            </div>'
  '          </div>'
  '        )}'
  ''
)
foreach ($l in $yellow) { [void]$nl.Add($l) }

# Linhas 839..853 (indices 838..852) — comentario LOGIN + section + style — mantemos
[void]$nl.AddRange($lines[838..852])

# Linha 854 (h2 "Acesso para Avaliar"): substituir por "Crie sua conta"
[void]$nl.Add('          <h2 className="text-sm uppercase tracking-[0.14em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-3">Crie sua conta</h2>')

# Linha 855 (indice 854) — div wrapper "flex flex-col items-center space-y-3" — mantem
[void]$nl.Add($lines[854])

# Pular 856..872 (indices 855..871) — LinkedIn + Google buttons
# Continuar a partir de 873 (indice 872) — "Bloco neutro de cadastro por perfil"
# Mas antes preciso ir ate linha 917 (botao Sair) — manter
# Pular 918..920 (indices 917..919) — paragrafo "Sem LinkedIn"
# Manter 921..1399 (indices 920..1398)

# 873..917 (indices 872..916)
[void]$nl.AddRange($lines[872..916])

# Pular 918..920 (indices 917..919) — paragrafo

# 921..end (indices 920..1398)
[void]$nl.AddRange($lines[920..($lines.Length-1)])

$out = ($nl -join "`r`n")
Set-Content $file -Value $out -NoNewline -Encoding UTF8
Write-Host "OK. Linhas: $($nl.Count) (era 1399)"
