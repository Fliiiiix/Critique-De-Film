// Script à usage unique — bascule tous les films notés via la grille des
// 7 critères vers la note manuelle ("ancien référentiel"), en figeant la
// note manuelle sur la note calculée actuelle (computeNote(crit)). Ne touche
// pas aux films déjà en note manuelle, et ne supprime pas `crit` (juste
// ignoré à l'affichage une fois manual_note renseigné — voir getDisplayNote()
// dans js/app.js).
//
// Usage : ouvrir l'app dans le navigateur, se connecter, ouvrir la console
// (F12 → Console), coller ce script en entier, Entrée. Recharger la page
// ensuite pour voir le résultat.

(async () => {
  const { data: rows, error } = await supabaseClient
    .from('films')
    .select('id, title, crit, manual_note')
    .is('manual_note', null);

  if(error){
    console.error('Erreur de lecture :', error);
    return;
  }

  console.log(`${rows.length} film(s) actuellement sur la grille.`);

  let done = 0, skipped = 0;
  for(const row of rows){
    const note = computeNote(row.crit || {});
    if(note === null){
      console.warn(`Ignoré (pas de note calculable) : ${row.title}`);
      skipped++;
      continue;
    }
    const { error: updError } = await supabaseClient
      .from('films')
      .update({ manual_note: note })
      .eq('id', row.id);
    if(updError){
      console.error(`Erreur sur "${row.title}" :`, updError);
      continue;
    }
    console.log(`OK — ${row.title} → ${note}`);
    done++;
  }

  console.log(`Terminé : ${done} converti(s), ${skipped} ignoré(s). Recharge la page.`);
})();
