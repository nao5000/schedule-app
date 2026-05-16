// URL用のランダムなslugを作る（衝突しにくく、短く、コピペしやすい）
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // 紛らわしい文字を除外

export function generateSlug(length = 10): string {
  let out = "";
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out += ALPHABET[buf[i] % ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  }
  return out;
}
