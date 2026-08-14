# Rafraichissement complet du Senat italien en production, en une seule
# commande. Contourne le blocage IP-datacenter (Amazon CloudFront,
# confirme le 14 aout 2026 - meme type de blocage structurel que
# senado.es, via un CDN different) en faisant le travail de recuperation
# depuis une connexion residentielle (votre PC), puis en transferant
# uniquement le resultat vers la production.
#
# Etapes : (1) re-ingere depuis dati.senato.it en local, (2) exporte les
# donnees du Senat italien uniquement (pas les autres pays/chambres),
# (3) transfere le fichier vers le VPS, (4) l'importe en production,
# (5) nettoie les fichiers temporaires (local et VPS).
#
# Usage : .\refresh-italy-senate-prod.ps1
# Pre-requis : le conteneur API local doit tourner (docker compose up),
# et export-italy-senate.js doit deja etre place dans apps\api\.

$ErrorActionPreference = "Continue"
$VPS_HOST = "debian@51.75.26.18"
$VPS_PROJECT_DIR = "pas-de-planete-b"
$SSH_KEY = "$HOME\.ssh\pdpb_auto"

Write-Host "1/5 - Re-ingestion depuis dati.senato.it (connexion locale)..." -ForegroundColor Cyan
docker compose exec api node src/scripts/ingest-italy-senate.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec de l'ingestion locale (code $LASTEXITCODE) - arret." -ForegroundColor Red
    exit 1
}

Write-Host "2/5 - Export cible du Senat italien..." -ForegroundColor Cyan
docker cp "apps\api\export-italy-senate.js" pas-de-planete-b-api-1:/app/export-italy-senate.js
$sqlLines = docker compose exec api node export-italy-senate.js
$exportExitCode = $LASTEXITCODE
[System.IO.File]::WriteAllLines(
    "$PWD\italy-senate-export.sql",
    $sqlLines,
    (New-Object System.Text.UTF8Encoding $false)
)

if (-not (Test-Path italy-senate-export.sql) -or (Get-Item italy-senate-export.sql).Length -eq 0) {
    Write-Host "Export vide ou absent (code $exportExitCode) - arret, rien n'a ete envoye en production." -ForegroundColor Red
    exit 1
}
Write-Host "Export cree : $((Get-Item italy-senate-export.sql).Length) octets." -ForegroundColor Green

Write-Host "3/5 - Transfert vers le VPS..." -ForegroundColor Cyan
scp -i $SSH_KEY italy-senate-export.sql "${VPS_HOST}:~/italy-senate-export.sql"

Write-Host "4/5 - Import en production..." -ForegroundColor Cyan
ssh -i $SSH_KEY $VPS_HOST "cd $VPS_PROJECT_DIR && docker compose -f docker-compose.prod.yml exec -T postgres psql -U pdpb -d pasdeplaneteb < ~/italy-senate-export.sql && rm ~/italy-senate-export.sql"

Write-Host "5/5 - Nettoyage local..." -ForegroundColor Cyan
Remove-Item italy-senate-export.sql

Write-Host "`nTermine ! Verifiez sur /etat-des-donnees ou /international/it que les nouvelles donnees apparaissent." -ForegroundColor Green
