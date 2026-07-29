const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function saveCitizenVote(anonymousId, legislature, numeroScrutin, position) {
  return fetch(`${API_URL}/api/citizen-votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousId, legislature, numeroScrutin, position }),
  }).then((res) => {
    if (!res.ok) throw new Error("Échec de l'enregistrement du vote");
    return res.json();
  });
}

export function fetchCitizenVotes(anonymousId) {
  return fetch(`${API_URL}/api/citizen-votes/${anonymousId}`).then((res) => {
    if (!res.ok) throw new Error("Échec du chargement de l'historique");
    return res.json();
  });
}

export function fetchCitizenAlignment(anonymousId) {
  return fetch(`${API_URL}/api/citizen-votes/${anonymousId}/alignment`).then((res) => {
    if (!res.ok) throw new Error("Échec du calcul d'alignement");
    return res.json();
  });
}

export function deleteAllCitizenVotes(anonymousId) {
  return fetch(`${API_URL}/api/citizen-votes/${anonymousId}`, { method: "DELETE" }).then((res) => {
    if (!res.ok) throw new Error("Échec de la suppression");
    return res.json();
  });
}
