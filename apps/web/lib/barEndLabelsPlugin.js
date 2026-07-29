// Plugin Chart.js générique : affiche une étiquette (ex: "12 power plants" ou
// "12 centrales", déjà traduite par l'appelant) à la fin de chaque barre, à
// partir d'un tableau `plantLabels` posé sur le dataset. Utilisé partout où
// on affiche la capacité par filière (page dédiée /energie et dashboard
// pays) — centralisé ici pour ne pas dupliquer la même logique à deux
// endroits. Ne contient aucun texte en dur : c'est l'appelant qui traduit.
export const barEndLabelsPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const label = dataset.plantLabels?.[index];
        if (label == null) return;
        ctx.save();
        ctx.fillStyle = "#444";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(label, bar.x + 6, bar.y);
        ctx.restore();
      });
    });
  },
};
