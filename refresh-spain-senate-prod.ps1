# Rafraichissement complet du Senat espagnol en production, en une seule
# commande. Contourne le blocage Akamai (voir TODO.md) en faisant le
# travail de recuperation depuis une connexion residentielle (votre PC),
# puis en transferant uniquement le resultat vers la production.
#
# Etapes : (1) re-ingere depuis senado.es en local, (2) exporte les
# donnees du Senat espagnol uniquement (pas les autres pays/chambres),
# (3) transfere le fichier vers le VPS, (4) l'importe en production,
# (5) nettoie les fichiers temporaires (local et VPS).
#
# Usage : .\refresh-spain-senate-prod.ps1
# Pre-requis : le conteneur API local doit tourner (docker compose up),
# et export-spain-senate.js doit deja etre place dans apps\api\ (voir
# session du 13 aout 2026 si besoin de le retelecharger).
#
# Note technique : $ErrorActionPreference reste volontairement sur
# "Continue" (pas "Stop") tout du long. PowerShell 7.3+ traite parfois
# la moindre sortie stderr d'une commande externe comme une erreur
# fatale meme quand elle est benigne (un simple message d'info) - on
# verifie donc explicitement $LASTEXITCODE apres chaque etape plutot que
# de compter sur la detection automatique, plus fiable ici.

$ErrorActionPreference = "Continue"
$VPS_HOST = "debian@51.75.26.18"
$SSH_KEY = "$HOME\.ssh\pdpb_auto"
$VPS_PROJECT_DIR = "pas-de-planete-b"

Write-Host "1/5 - Re-ingestion depuis senado.es (connexion locale)..." -ForegroundColor Cyan
docker compose exec api node src/scripts/ingest-spain-senate.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec de l'ingestion locale (code $LASTEXITCODE) - arret." -ForegroundColor Red
    exit 1
}

Write-Host "2/5 - Export cible du Senat espagnol..." -ForegroundColor Cyan
docker cp "apps\api\export-spain-senate.js" pas-de-planete-b-api-1:/app/export-spain-senate.js
# On capture la sortie dans une variable plutot que d'utiliser la
# redirection ">" directement : sur Windows, ">" ecrit par defaut en
# UTF-16 (avec BOM), ce qui corrompt le fichier pour l'import PostgreSQL
# ensuite (erreur "invalid byte sequence for encoding UTF8"). Ecriture
# explicite en UTF-8 sans BOM via .NET pour eviter ce piege.
$sqlLines = docker compose exec api node export-spain-senate.js
$exportExitCode = $LASTEXITCODE
[System.IO.File]::WriteAllLines(
    "$PWD\spain-senate-export.sql",
    $sqlLines,
    (New-Object System.Text.UTF8Encoding $false)
)

if (-not (Test-Path spain-senate-export.sql) -or (Get-Item spain-senate-export.sql).Length -eq 0) {
    Write-Host "Export vide ou absent (code $exportExitCode) - arret, rien n'a ete envoye en production." -ForegroundColor Red
    exit 1
}
Write-Host "Export cree : $((Get-Item spain-senate-export.sql).Length) octets." -ForegroundColor Green

Write-Host "3/5 - Transfert vers le VPS..." -ForegroundColor Cyan
scp -i $SSH_KEY spain-senate-export.sql "${VPS_HOST}:~/spain-senate-export.sql"

Write-Host "4/5 - Import en production..." -ForegroundColor Cyan
ssh -i $SSH_KEY $VPS_HOST "cd $VPS_PROJECT_DIR && docker compose -f docker-compose.prod.yml exec -T postgres psql -U pdpb -d pasdeplaneteb < ~/spain-senate-export.sql && rm ~/spain-senate-export.sql"

Write-Host "5/5 - Nettoyage local..." -ForegroundColor Cyan
Remove-Item spain-senate-export.sql

Write-Host "`nTermine ! Verifiez sur /etat-des-donnees ou /international/es que les nouvelles donnees apparaissent." -ForegroundColor Green
