
export function saveCitizenVote(anonymousId, legislature, numeroScrutin, position) {
  return fetch(`/api/citizen-votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousId, legislature, numeroScrutin, position }),
  }).then((res) => {
    if (!res.ok) throw new Error("Échec de l'enregistrement du vote");
    return res.json();
  });
}

export function fetchCitizenVotes(anonymousId) {
  return fetch(`/api/citizen-votes/${anonymousId}`).then((res) => {
    if (!res.ok) throw new Error("Échec du chargement de l'historique");
    return res.json();
  });
}

export function fetchCitizenAlignment(anonymousId) {
  return fetch(`/api/citizen-votes/${anonymousId}/alignment`).then((res) => {
    if (!res.ok) throw new Error("Échec du calcul d'alignement");
    return res.json();
  });
}

export function fetchCitizenScrutinStats(legislature, numero) {
  return fetch(`/api/scrutins/${legislature}/${numero}/citizen-stats`).then((res) => {
    if (!res.ok) throw new Error("Échec du chargement des statistiques citoyennes");
    return res.json();
  });
}

export function deleteAllCitizenVotes(anonymousId) {
  return fetch(`/api/citizen-votes/${anonymousId}`, { method: "DELETE" }).then((res) => {
    if (!res.ok) throw new Error("Échec de la suppression");
    return res.json();
  });
}
