// Deterministic 16-hex-character hash used across the in-page interactive
// demos to show signature match / mismatch in real time. Not a real
// cryptographic signature; on the live chain the hash comes from the
// agent's signing key and the canonical message bytes. Here we just need
// "the input changed, the hash changed, the verifier sees it" to land.
//
// Two parallel 32-bit DJB2 streams joined as one 64-bit-wide hex string.

export function simulateHash(input: string): string {
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    a = ((a << 5) + a + c) >>> 0;
    b = ((b << 5) + b + c) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return "0x" + hex(a) + hex(b);
}

// Short display form for cramped UIs: 0xabcd…ef01.
export function shortHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return hash.slice(0, 6) + "…" + hash.slice(-4);
}
