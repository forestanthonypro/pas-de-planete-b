-- Permet d'exclure temporairement une station des graphiques historiques
-- (courbes de normales, % de jours au-dessus de la normale) sans toucher
-- à ses données collectées ni à l'ingestion en cours — juste un
-- interrupteur d'affichage, réversible. Utilisé pour Strasbourg (ME126),
-- dont la station source ("Lycée Couffignal") ne transmet plus depuis fin
-- janvier 2026 : ses courbes historiques restaient légitimes à afficher
-- en tant que telles, mais leur présence perturbait la lecture d'ensemble
-- alors que la station est absente de "Aujourd'hui en France". Ne
-- s'applique volontairement PAS à la route /today, dont la note "source
-- indisponible" reste une information utile et distincte de cette
-- question d'affichage dans les graphiques.

ALTER TABLE reference_weather_stations
  ADD COLUMN IF NOT EXISTS excluded_from_charts BOOLEAN NOT NULL DEFAULT false;

UPDATE reference_weather_stations SET excluded_from_charts = true WHERE station_code = 'ME126';
