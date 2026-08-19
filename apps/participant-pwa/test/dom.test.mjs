// Test du helper d'échappement (ADR-004). On teste html()/safe(), parties pures ;
// render() (qui touche le DOM) est hors périmètre Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, safe } from '../public/dom.js';

test('html() échappe une donnée serveur hostile (XSS neutralisé)', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const frag = html`<span>${evil}</span>`;
  assert.ok(!frag.__safe.includes('<img'));
  assert.ok(frag.__safe.includes('&lt;img'));
});

test('html() compose des fragments safe() sans double-échappement', () => {
  const inner = html`<b>${'A&B'}</b>`;
  const outer = html`<div>${inner}</div>`;
  assert.equal(outer.__safe, '<div><b>A&amp;B</b></div>');
});

test('html() concatène une liste de fragments en échappant chacun', () => {
  const list = html`${[html`<i>${'x'}</i>`, html`<i>${'<y>'}</i>`]}`;
  assert.equal(list.__safe, '<i>x</i><i>&lt;y&gt;</i>');
});

test('safe() insère du HTML de confiance tel quel', () => {
  assert.equal(html`${safe('<hr/>')}`.__safe, '<hr/>');
});
