import fs from "node:fs";
import path from "node:path";

const colors = {
  aluminum: "#c5ccd1",
  steel: "#7d848a",
  stainless: "#d5d9dd",
  titanium: "#8e9aa3",
  brass: "#d4b15a",
  copper: "#c56a45",
  plastic: "#b7c7a4",
  bronze: "#b08d57",
  other: "#c2b2a1",
};

const items = [
  ["ex-01", "aluminum", "round", "6061-T6"],
  ["ex-02", "aluminum", "block", "7075-T651"],
  ["ex-03", "aluminum", "plate", "6061-T6"],
  ["ex-04", "stainless", "sheet", "304"],
  ["ex-05", "stainless", "tube", "316"],
  ["ex-06", "steel", "round", "1018"],
  ["ex-07", "steel", "plate", "A36"],
  ["ex-08", "titanium", "round", "Ti-6Al-4V"],
  ["ex-09", "brass", "round", "360 brass"],
  ["ex-10", "copper", "round", "110 copper"],
  ["ex-11", "plastic", "round", "Acetal"],
  ["ex-12", "steel", "tube", "4130"],
  ["ex-13", "aluminum", "sheet", "5052-H32"],
  ["ex-14", "aluminum", "bar", "6061-T6"],
  ["ex-15", "other", "round", "Invar 36"],
  ["ex-16", "steel", "angle", "A36 angle"],
  ["ex-17", "bronze", "round", "932 bronze"],
];

const out = path.join(process.cwd(), "public", "seed");
fs.mkdirSync(out, { recursive: true });

for (const [id, material, form, alloy] of items) {
  const fill = colors[material];
  fs.writeFileSync(path.join(out, `${id}.svg`), svg(fill, form, alloy, material));
}

function svg(fill, form, alloy, material) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#efe7d8"/>
  <rect x="48" y="48" width="704" height="504" rx="18" fill="#243f38"/>
  ${shape(form, fill)}
  <text x="80" y="470" fill="#f6f1e7" font-family="Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(alloy)}</text>
  <text x="80" y="515" fill="#e7b089" font-family="Arial, sans-serif" font-size="24">${escapeXml(material)} · ${escapeXml(form)} · example</text>
</svg>
`;
}

function shape(form, fill) {
  if (form === "round") {
    return `<circle cx="250" cy="230" r="90" fill="${fill}" stroke="#1c1915" stroke-width="8"/>
      <rect x="360" y="185" width="280" height="90" rx="45" fill="${fill}" stroke="#1c1915" stroke-width="8"/>`;
  }
  if (form === "tube") {
    return `<circle cx="400" cy="230" r="110" fill="none" stroke="${fill}" stroke-width="36"/>
      <circle cx="400" cy="230" r="110" fill="none" stroke="#1c1915" stroke-width="8"/>`;
  }
  if (form === "block") {
    return `<polygon points="220,280 460,280 540,190 300,190" fill="${fill}" stroke="#1c1915" stroke-width="8"/>
      <polygon points="220,280 220,360 460,360 460,280" fill="${shade(fill)}" stroke="#1c1915" stroke-width="8"/>
      <polygon points="460,280 540,190 540,270 460,360" fill="#1c1915" fill-opacity="0.25" stroke="#1c1915" stroke-width="8"/>`;
  }
  if (form === "sheet") {
    return `<rect x="150" y="170" width="500" height="150" rx="6" fill="${fill}" stroke="#1c1915" stroke-width="8"/>`;
  }
  if (form === "bar") {
    return `<rect x="160" y="200" width="480" height="70" fill="${fill}" stroke="#1c1915" stroke-width="8"/>`;
  }
  if (form === "angle") {
    return `<polygon points="180,160 250,160 250,340 560,340 560,410 180,410" fill="${fill}" stroke="#1c1915" stroke-width="8"/>`;
  }
  return `<rect x="170" y="160" width="460" height="180" rx="4" fill="${fill}" stroke="#1c1915" stroke-width="8"/>`;
}

function shade(fill) {
  return fill;
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
