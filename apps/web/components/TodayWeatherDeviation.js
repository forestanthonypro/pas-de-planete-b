import { useEffect, useState } from "react";
import { useT } from "../lib/useT";

function formatDeviation(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("fr-FR")} °C`;
}

export default function TodayWeatherDeviation() {
  const { t } = useT();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/reference-weather/today")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return null; // widget discret : une panne ici ne doit pas casser le reste de la page
  if (!rows) return null; // chargement silencieux, pas de saut de mise en page

  const ready = rows.filter((r) => r.dataReady);
  const notReady = rows.length - ready.length;

  if (ready.length === 0) {
    return (
      <div style={{ background: "var(--color-fond)", borderRadius: 8, padding: "1rem", fontSize: 13, color: "var(--color-texte-clair)", fontStyle: "italic" }}>
        {t("referenceWeather.collecting")}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
        {t("referenceWeather.explanation")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {ready.map((r) => {
          const isHot = r.deviationMax > 0;
          return (
            <div key={r.stationCode} className="pdpb-card" style={{ padding: "0.75rem" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>{r.cityLabel}</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 2px" }}>{r.tempMax.toLocaleString("fr-FR")} °C</p>
              <p style={{ fontSize: 12, margin: 0, color: isHot ? "#b0401f" : "#2a78d6" }}>
                {formatDeviation(r.deviationMax)} {t("referenceWeather.vs_normal")}
              </p>
              {r.isNewRecordMax && <p style={{ fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>🔥 {t("referenceWeather.new_record_hot")}</p>}
              {r.isNewRecordMin && <p style={{ fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>❄️ {t("referenceWeather.new_record_cold")}</p>}
            </div>
          );
        })}
      </div>
      {notReady > 0 && (
        <p style={{ fontSize: 11, color: "var(--color-texte-clair)", marginTop: 8, fontStyle: "italic" }}>
          {t("referenceWeather.others_collecting", { count: notReady })}
        </p>
      )}
    </div>
  );
}
