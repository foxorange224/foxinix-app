/* test-w106-core.mjs — prueba del núcleo de emojis, stickers y GIFs (W106).
   Corre en modo NativeScript (con los stubs de @nativescript/core) y
   comprueba la lógica que comparten la web y la app nativa:
     - las categorías de emojis, la búsqueda y los recientes
     - los stickers del sitio y sus favoritos
     - la biblioteca de GIFs y el límite de 10 archivos por tipo

   No necesita la API ni credenciales (todo es local).

   Uso: node --import ./tools/ns-register.mjs tools/test-w106-core.mjs
*/
import { store } from '../app/core/store.js';
import {
  emojiCats, emojiCat, emojiRecent, emojiSearch, emojiPush,
  shortcodesToEmoji, emojiCodesPrefix,
} from '../app/core/emoji.js';
import {
  STICKERS, GIF_LIST, ASSET_MAX, assetList, isStkFav, toggleStkFav,
} from '../app/core/stickers.js';

let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log('PASS  ' + name + (detail ? '  [' + detail + ']' : ''));
  } else {
    fail++;
    console.log('FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

/* ---------- emojis ---------- */
const cats = emojiCats();
ok('hay categorías de emojis', cats.length >= 5, cats.length + ' categorías');
ok('la primera categoría es "recientes"', cats[0].id === 'recientes', cats[0].id);

const caras = cats.find((c) => c.id === 'caras');
ok('está la categoría de caritas', !!caras);
ok('la categoría de caritas trae emojis', emojiCat('caras').length > 10,
  emojiCat('caras').length + ' emojis');
ok('una categoría inventada no trae nada', emojiCat('no-existe').length === 0);

ok('emojiSearch("perro") encuentra algo', emojiSearch('perro').length > 0,
  emojiSearch('perro').slice(0, 3).join(' '));
ok('emojiSearch(":fire:") busca por código', emojiSearch(':fire:').length > 0);
ok('emojiSearch("") no devuelve nada', emojiSearch('').length === 0);
ok('shortcodesToEmoji(":fire:")', shortcodesToEmoji(':fire:') === '🔥',
  shortcodesToEmoji(':fire:'));
ok('emojiCodesPrefix("fire") devuelve códigos',
  emojiCodesPrefix('fire', 8).length > 0);

/* Los recientes se guardan en el dispositivo (StorageAdapter). */
emojiPush('🔥');
emojiPush('👍');
const rec = emojiRecent();
ok('los recientes se guardan (el último primero)',
  rec[0] === '👍' && rec[1] === '🔥', rec.join(' '));

/* ---------- stickers ---------- */
ok('hay 24 stickers del sitio', STICKERS.length === 24, String(STICKERS.length));
ok('hay 10 GIFs en la biblioteca', GIF_LIST.length === 10, String(GIF_LIST.length));
ok('un sticker no es favorito al principio', isStkFav('🔥') === false);
toggleStkFav('🔥');
ok('el favorito se marca', isStkFav('🔥') === true);
ok('el favorito está en el store', (store.stkFavs || []).indexOf('🔥') >= 0,
  JSON.stringify(store.stkFavs));
toggleStkFav('🔥');
ok('el favorito se quita', isStkFav('🔥') === false);

/* ---------- biblioteca propia ---------- */
ok('ASSET_MAX es 10', ASSET_MAX === 10);
ok('assetList("gif") es la lista de GIFs', Array.isArray(assetList('gif')));
ok('assetList("sticker") es la lista de stickers', Array.isArray(assetList('sticker')));

console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
