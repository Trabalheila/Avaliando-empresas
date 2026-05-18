$ErrorActionPreference = 'Stop'
$file = "src/TrabalheiLaDesktop.js"
$lines = Get-Content $file -Encoding UTF8

if ($lines.Length -ne 1378) { throw "Esperava 1378 linhas, achei $($lines.Length)." }

# Verificacoes
$check = @{
  738  = 'CONTE.DO - 3 COLUNAS'
  741  = 'COLUNA ESQUERDA - LOGIN \+ RANKING'
  744  = 'LOGIN ATUALIZADO'
  759  = 'Login para Avaliar'
  761  = 'flex flex-col items-center space-y-4'
  762  = '<div className="w-full max-w-xs -ml-3">'
  782  = '^\s*$'
  783  = 'Bloco neutro de cadastro por perfil'
  816  = '</section>'
}
foreach ($k in $check.Keys) {
  if ($lines[$k-1] -notmatch $check[$k]) {
    throw "Marcador linha $k falhou. Esperado /$($check[$k])/. Got: $($lines[$k-1])"
  }
}

# === Construir novo arquivo ===
$nl = [System.Collections.ArrayList]::new()

# 1..737 (indices 0..736): tudo antes do comentario "CONTEUDO - 3 COLUNAS"
[void]$nl.AddRange($lines[0..736])

# Inserir card central amarelo (Google + LinkedIn)
$yellowCard = @(
  '        {/* CARD CENTRAL DE LOGIN — Google + LinkedIn (acima das colunas) */}'
  '        {!isAuthenticated && ('
  '          <div className="mx-auto max-w-2xl mb-6 bg-amber-100 dark:bg-amber-200/15 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl shadow-xl p-5">'
  '            <h2 className="text-xl md:text-2xl font-extrabold text-amber-900 dark:text-amber-100 text-center mb-1 tracking-wide">'
  '              Entre para avaliar'
  '            </h2>'
  '            <p className="text-sm text-amber-800 dark:text-amber-200 text-center mb-4">'
  '              Use sua conta Google ou LinkedIn — seu nome continua anônimo.'
  '            </p>'
  '            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">'
  '              <button'
  '                type="button"'
  '                onClick={onGoogleLogin}'
  '                disabled={isLoading}'
  '                className="flex-1 sm:max-w-xs inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 text-blue-800 dark:text-blue-200 font-semibold py-2.5 px-4 rounded-lg shadow hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors text-sm md:text-base disabled:opacity-60"'
  '              >'
  '                <FaGoogle className="text-lg" /> Entrar com Google'
  '              </button>'
  '              <div className="flex-1 sm:max-w-xs">'
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
foreach ($l in $yellowCard) { [void]$nl.Add($l) }

# 738..743 (indices 737..742): comentario das 3 colunas + abertura do flex row + COLUNA ESQUERDA + abertura div da coluna esquerda + blank
[void]$nl.AddRange($lines[737..742])

# Inserir card lateral esquerdo SOMENTE com cadastro por perfil
$leftCard = @(
  '            {/* CADASTRO POR PERFIL (sem login social — esse foi para o card central) */}'
  '            <section'
  '              className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 mb-6 border border-blue-100 dark:border-slate-700"'
  '              style={{ animation: "homeLoginSectionIn 700ms ease-out both" }}'
  '            >'
  '              <style>{`'
  '                @keyframes homeLoginSectionIn {'
  '                  from { opacity: 0; transform: translateY(18px); }'
  '                  to { opacity: 1; transform: translateY(0); }'
  '                }'
  '              `}</style>'
  '              <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 tracking-wide font-azonix">Crie sua conta</h2>'
  '              <div className="w-28 h-1 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />'
  '              <p className="text-xs text-slate-600 dark:text-slate-300 text-center mb-3">'
  '                Escolha seu perfil e comece a usar a plataforma!'
  '              </p>'
  '              <div className="flex flex-col gap-2">'
  '                <Link'
  '                  to="/pseudonym"'
  '                  className="w-full text-center py-2 px-3 rounded-lg bg-lime-400 hover:bg-lime-500 text-emerald-950 text-sm font-bold shadow transition"'
  '                >'
  '                  Sou Trabalhador'
  '                </Link>'
  '                <Link'
  '                  to="/empresa/cadastro"'
  '                  className="w-full text-center py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-500 text-amber-950 text-sm font-bold shadow transition"'
  '                >'
  '                  Sou Empresário'
  '                </Link>'
  '                <Link'
  '                  to="/apoiadores"'
  '                  className="w-full text-center py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow transition"'
  '                >'
  '                  Sou Apoiador'
  '                </Link>'
  '              </div>'
  '              {isAuthenticated && ('
  '                <p className="text-green-600 font-semibold text-center mt-4 text-sm">✓ Você está autenticado!</p>'
  '              )}'
  '            </section>'
  ''
)
foreach ($l in $leftCard) { [void]$nl.Add($l) }

# Pular linhas 744..817 (todo o bloco LOGIN antigo + linha em branco apos </section>)
# Continuar de 818 (RANKING DE EMPRESAS) ate o final
[void]$nl.AddRange($lines[817..($lines.Length-1)])

# Tambem trocar o comentario da coluna para refletir o novo conteudo
# Encontrar e substituir o comentario que ainda esta "COLUNA ESQUERDA - LOGIN + RANKING"
for ($i=0; $i -lt $nl.Count; $i++) {
  if ($nl[$i] -match 'COLUNA ESQUERDA - LOGIN \+ RANKING') {
    $nl[$i] = '          {/* COLUNA ESQUERDA - CADASTRO + RANKING (flex-col ordem 1) */}'
    break
  }
}

$out = ($nl -join "`r`n")
Set-Content $file -Value $out -NoNewline -Encoding UTF8
Write-Host "OK. Linhas: $($nl.Count) (era 1378)"
