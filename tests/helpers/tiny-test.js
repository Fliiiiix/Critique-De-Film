// --- Micro-framework de test, sans dépendance npm (aucune n'existe dans ce
// projet — 100% vanilla, voir tests/README.md) ---
// test(name, fn) enregistre un cas ; fn peut être async (plusieurs tests
// enchaînent un import Letterboxd asynchrone puis vérifient l'état écrit —
// l'ordre d'exécution doit être respecté et chaque étape attendue).
// suite.run(label) exécute les cas dans l'ordre d'enregistrement, affiche
// chaque résultat, et renvoie une Promise<boolean> (true si tout est
// passé) — à exporter telle quelle en bas de chaque fichier de test pour
// que run-all.js puisse l'attendre.
function createSuite(){
  const items = [];
  function test(name, fn){ items.push({ name, fn }); }

  async function run(fileLabel){
    let passed = 0;
    for(const { name, fn } of items){
      try{
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      }catch(e){
        console.log(`  ✗ ${name}`);
        console.log(`    ${e && e.message ? e.message : e}`);
      }
    }
    console.log(`${fileLabel}: ${passed}/${items.length} passés\n`);
    return passed === items.length;
  }

  return { test, run };
}

module.exports = { createSuite, assert: require('assert') };
