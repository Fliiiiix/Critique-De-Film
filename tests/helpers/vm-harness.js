// --- Harnais minimal pour exécuter les modules js/*.js de Kinet hors
// navigateur (Node pur, aucune dépendance npm — cohérent avec le reste du
// projet, 100% vanilla, sans build). Beaucoup de fichiers js/ font du
// wiring en bas de fichier (document.getElementById('x').addEventListener(
// ...)) exécuté immédiatement au chargement : les stubs ci-dessous
// suffisent pour que ça ne plante pas, sans essayer de simuler un vrai DOM
// (pas de jsdom, pas de dépendance). Un test qui a besoin d'un comportement
// DOM précis (lire un textContent, etc.) enrichit son propre stub avant de
// charger le fichier concerné plutôt que d'alourdir ce module partagé.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function stubElement(overrides = {}){
  const el = {
    addEventListener(){}, removeEventListener(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    style: {}, dataset: {},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    appendChild(){}, click(){}, focus(){}, blur(){},
    textContent: '', innerHTML: '', value: '', checked: false,
  };
  return Object.assign(el, overrides);
}

// document.getElementById par défaut : renvoie un stub générique pour
// N'IMPORTE QUEL id demandé (les fichiers js/ interrogent des dizaines
// d'ids au chargement) — un test précis peut passer sa propre `elements`
// map pour des ids qu'il veut vraiment inspecter/piloter.
function stubDocument(elements = {}){
  return {
    getElementById: (id) => elements[id] || stubElement(),
    addEventListener(){}, removeEventListener(){},
    querySelectorAll(){ return []; }, querySelector(){ return null; },
    createElement(){ return stubElement(); },
    body: stubElement(),
  };
}

function fakeLocalStorage(){
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for(const k in store) delete store[k]; },
  };
}

// Charge un ou plusieurs fichiers js/ RELATIFS à la racine du repo, dans
// l'ordre donné, sur le MÊME contexte vm (comme index.html les charge tous
// dans le même scope global) — nécessaire quand un fichier lit une
// fonction/variable définie par un autre (ex. importExternal.js attend
// showToast(), normalizeSearch() de js/app.js).
function loadFiles(context, relPaths){
  for(const relPath of relPaths){
    const code = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  }
}

function createContext(overrides = {}){
  const base = {
    console,
    document: stubDocument(),
    localStorage: fakeLocalStorage(),
    window: { addEventListener(){}, removeEventListener(){}, matchMedia: () => ({ matches: false, addEventListener(){} }) },
    location: { hash: '' },
    navigator: { onLine: true },
  };
  const ctx = Object.assign(base, overrides);
  return vm.createContext(ctx);
}

module.exports = { createContext, loadFiles, stubElement, stubDocument, fakeLocalStorage, REPO_ROOT };
