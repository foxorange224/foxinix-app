/* check-css.mjs — revisa app.css contra lo que NativeScript entiende.

   Sin emulador: usa el mismo parser que usa NS (css-tree) y contrasta
   las propiedades con TODAS las que el runtime declara (se leen del
   `cssName` de cada CssProperty registrada en @nativescript/core).

   También avisa de pseudo-clases que NS no dispara (sólo existen
   :pressed/:highlighted/:active en Button y :focus/:blur en los campos).

   Uso: node tools/check-css.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as csstree from 'css-tree';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSS = path.join(ROOT, 'app', 'app.css');
const CORE = path.join(ROOT, 'node_modules', '@nativescript', 'core');

/* ---- 1. todas las propiedades CSS que declara el runtime ---- */
const known = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) {
      const src = fs.readFileSync(p, 'utf8');
      const re = /cssName:\s*'([^']+)'/g;
      let m;
      while ((m = re.exec(src))) known.add(m[1]);
    }
  }
};
walk(CORE);

/* Propiedades estándar que NS acepta aunque no las registre con
   cssName (las de CSS3Parser). */
for (const p of [
  'font', 'border', 'border-radius', 'border-width', 'border-color',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-top-width', 'border-right-width', 'border-bottom-width',
  'border-left-width', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'margin', 'padding', 'background', 'animation', 'transition',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end',
  'place-items', 'place-content', 'align-items', 'justify-content',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'order', 'gap', 'row-gap', 'column-gap', 'overflow', 'z-index',
  'white-space', 'word-break', 'overflow-wrap', 'text-overflow',
  'list-style', 'content', 'cursor', 'src', 'filter', 'visibility',
  'box-shadow', 'clip-path',
]) {
  known.add(p);
}

/* ---- 2. pseudo-clases que NS dispara de verdad ---- */
const pseudoOk = new Set(['pressed', 'highlighted', 'active', 'normal',
  'focus', 'blur']);

/* ---- 3. parsear el CSS ---- */
const src = fs.readFileSync(CSS, 'utf8');
const ast = csstree.parse(src, { positions: true, onParseError: (e) => {
  throw new Error(`app.css:${e.line}:${e.column}: ${e.message}`);
} });

let problems = 0;
let rules = 0;
csstree.walk(ast, {
  visit: 'Rule',
  enter(node) {
    rules++;
    const sel = csstree.generate(node.prelude);
    for (const pseudo of node.prelude.children) {
      if (pseudo.type === 'PseudoClassSelector' && !pseudoOk.has(pseudo.name)) {
        console.log(`pseudo-clase no disparada por NS: :${pseudo.name}  (${sel})`);
        problems++;
      }
    }
    node.block.children.forEach((decl) => {
      if (decl.type !== 'Declaration') return;
      const prop = decl.property;
      if (prop.startsWith('--')) return;
      if (!known.has(prop)) {
        console.log(`propiedad desconocida: ${prop}  (${sel})`);
        problems++;
      }
    });
  },
});

console.log(`reglas: ${rules} | problemas: ${problems}`);
if (problems) process.exit(2);
console.log('OK: app.css usa sólo lo que NativeScript entiende');
