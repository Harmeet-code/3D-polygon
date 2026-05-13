/* Demo data enrichment when JSON lacks status/company */

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function demoStatus(no) {
  const r = hashStr(no) % 100;
  if (r < 68) return 'AVAILABLE';
  if (r < 84) return 'HOLD';
  return 'BOOKED';
}

function demoCompany(no) {
  const names = [
    'Acme Corp',
    'BluePeak',
    'Cedar & Co',
    'Nova Labs',
    'Orbit Systems',
    'PineWorks',
    'Zenith AI',
    'RiverStone'
  ];
  return names[hashStr(no) % names.length];
}

function demoPrice(no, base = 1000) {
  return base + (hashStr(no) % 5) * 250;
}

export function enrichData(data) {
  for (const b of data.booths) {
    b.status = b.status || demoStatus(b.boothNo);
    b.company = b.company || demoCompany(b.boothNo);
    b.price = b.price ?? demoPrice(b.boothNo);
    b.size = b.size || '10x10';
  }
}
