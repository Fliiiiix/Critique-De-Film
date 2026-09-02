// Script à usage unique — complète genre_ids pour les films déjà en base
// et déjà liés à une fiche TMDB (tmdb_id renseigné) mais ajoutés avant que
// cette colonne n'existe (voir migrations/029). Un appel TMDB par film,
// espacé de 250ms pour rester tranquille sur le rate limit — même gabarit
// que backfill-original-title.js (migrations/008).
//
// Usage : ouvrir l'app dans le navigateur, se connecter, ouvrir la console
// (F12 → Console), coller ce script en entier, Entrée. Recharger la page
// ensuite pour voir le résultat (filtre par genre repeuplé).

(async () => {
  const { data: rows, error } = await supabaseClient
    .from('films')
    .select('id, title, tmdb_id')
    .not('tmdb_id', 'is', null)
    .is('genre_ids', null);

  if(error){
    console.error('Erreur de lecture :', error);
    return;
  }

  console.log(`${rows.length} film(s) à compléter.`);

  let done = 0, skipped = 0;
  for(const row of rows){
    try{
      const res = await fetch(`https://api.themoviedb.org/3/movie/${row.tmdb_id}`, {
        headers: { Authorization: `Bearer ${TMDB_API_KEY}`, Accept: 'application/json' }
      });
      if(!res.ok){
        console.warn(`TMDB KO (${res.status}) pour : ${row.title}`);
        skipped++;
        continue;
      }
      const details = await res.json();
      const genreIds = (details.genres || []).map(g => g.id);
      if(genreIds.length === 0){
        skipped++;
        continue;
      }
      const { error: updError } = await supabaseClient
        .from('films')
        .update({ genre_ids: genreIds })
        .eq('id', row.id);
      if(updError){
        console.error(`Erreur sur "${row.title}" :`, updError);
        continue;
      }
      console.log(`OK — ${row.title} → [${genreIds.join(', ')}]`);
      done++;
    }catch(e){
      console.error(`Erreur réseau pour "${row.title}" :`, e);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`Terminé : ${done} complété(s), ${skipped} sans genre TMDB trouvé. Recharge la page.`);
})();
