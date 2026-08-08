const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function saveParliamentCitizenVote(country, anonymousId, voteId, position) {
  return fetch(`${API_URL}/api/parliament/${country}/citizen-votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousId, voteId, position }),
  }).then((res) => {
    if (!res.ok) throw new Error("Échec de l'enregistrement du vote");
    return res.json();
  });
}

export function fetchParliamentCitizenVotes(country, anonymousId) {
  return fetch(`${API_URL}/api/parliament/${country}/citizen-votes/${anonymousId}`).then((res) => {
    if (!res.ok) throw new Error("Échec du chargement de l'historique");
    return res.json();
  });
}

export function fetchParliamentCitizenAlignment(country, anonymousId) {
  return fetch(`${API_URL}/api/parliament/${country}/citizen-votes/${anonymousId}/alignment`).then((res) => {
    if (!res.ok) throw new Error("Échec du calcul d'alignement");
    return res.json();
  });
}

export function fetchParliamentCitizenVoteStats(country, voteId) {
  return fetch(`${API_URL}/api/parliament/${country}/votes/${voteId}/citizen-stats`).then((res) => {
    if (!res.ok) throw new Error("Échec du chargement des statistiques citoyennes");
    return res.json();
  });
}

export function deleteAllParliamentCitizenVotes(country, anonymousId) {
  return fetch(`${API_URL}/api/parliament/${country}/citizen-votes/${anonymousId}`, { method: "DELETE" }).then((res) => {
    if (!res.ok) throw new Error("Échec de la suppression");
    return res.json();
  });
}
