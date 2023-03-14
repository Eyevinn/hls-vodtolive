function keysToM3u8(keys) {
  let m3u8 = "";
  for (const keyFormat of Object.keys(keys)) {
    const key = keys[keyFormat];
    m3u8 += `#EXT-X-KEY:METHOD=${key.method}`;
    m3u8 += key.uri ? `,URI=${key.uri}` : "";
    m3u8 += key.iv ? `,IV=${key.iv}` : "";
    m3u8 += key.keyId ? `,KEYID=${key.keyId}` : "";
    m3u8 += key.keyFormatVersions ? `,KEYFORMATVERSIONS=${key.keyFormatVersions}` : "";
    m3u8 += key.keyFormat ? `,KEYFORMAT=${key.keyFormat}` : "";
    m3u8 += "\n";
  }
  return m3u8;
}

module.exports = {
  keysToM3u8
}