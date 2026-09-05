// --- Lance tous les tests de régression (tests/*.test.js) ---
// Usage : node tests/run-all.js
// N'exécute PAS les fichiers *.live.js (réseau + clé TMDB requis, voir
// tests/README.md) — ceux-là se lancent à la main quand on veut revérifier
// contre l'API réelle. Chaque *.test.js exporte une Promise<boolean>
// (voir tests/helpers/tiny-test.js) : ce runner les attend dans l'ordre et
// sort en code 1 si l'un d'eux a échoué.
const fs = require('fs');
const path = require('path');

const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();

(async () => {
  console.log(`${testFiles.length} fichier(s) de test trouvé(s) : ${testFiles.join(', ')}\n`);
  let allOk = true;
  for(const file of testFiles){
    console.log(`--- ${file} ---`);
    const ok = await require(path.join(__dirname, file));
    if(!ok) allOk = false;
    console.log('');
  }
  if(allOk){
    console.log('✓ Tous les tests sont passés.');
  }else{
    console.log('✗ Au moins un test a échoué — voir le détail ci-dessus.');
    process.exitCode = 1;
  }
})();
