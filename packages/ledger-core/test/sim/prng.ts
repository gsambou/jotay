/** PRNG déterministe et sans dépendance (mulberry32). Une graine => une suite reproductible :
 *  un échec de test rejoue exactement le même scénario. Aligné sur l'interdiction de
 *  Math.random dans les moteurs (le hasard est explicite et injecté). */
export function makePrng(seed: number) {
  let a = seed >>> 0;
  return {
    next(): number { // [0,1)
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); },
    pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length - 1)]!; },
  };
}
