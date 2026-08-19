import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, pickLang } from '../public/i18n.js';

test('i18n — fr et en ont exactement les mêmes clés (aucune traduction manquante)', () => {
  const fr = Object.keys(MESSAGES.fr).sort();
  const en = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(en, fr, 'clés en divergent de fr');
});
test('i18n — aucune valeur vide', () => {
  for (const lang of Object.keys(MESSAGES))
    for (const [k, v] of Object.entries(MESSAGES[lang]))
      assert.ok(v && v.length > 0, `${lang}.${k} vide`);
});
test('i18n — langues disponibles : fr et en uniquement', () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), ['en', 'fr']);
});
