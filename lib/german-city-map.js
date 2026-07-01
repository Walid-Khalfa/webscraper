export const GERMAN_CITY_COORDS = {
  berlin: [52.52, 13.405],
  hamburg: [53.5511, 9.9937],
  "münchen": [48.1351, 11.582],
  "koln": [50.9375, 6.9603],
  "köln": [50.9375, 6.9603],
  "frankfurt am main": [50.1109, 8.6821],
  stuttgart: [48.7758, 9.1829],
  "düsseldorf": [51.2277, 6.7735],
  dusseldorf: [51.2277, 6.7735],
  leipzig: [51.3397, 12.3731],
  dortmund: [51.5136, 7.4653],
  essen: [51.4556, 7.0116],
  bremen: [53.0793, 8.8017],
  dresden: [51.0504, 13.7373],
  hannover: [52.3759, 9.732],
  "nürnberg": [49.4521, 11.0767],
  nurnberg: [49.4521, 11.0767],
  duisburg: [51.4325, 6.7652],
  bochum: [51.4818, 7.2162],
  wuppertal: [51.2562, 7.1508],
  bielefeld: [52.0302, 8.5325],
  bonn: [50.7374, 7.0982],
  "münster": [51.9607, 7.6261],
  munster: [51.9607, 7.6261],
  karlsruhe: [49.0069, 8.4037],
  mannheim: [49.4875, 8.466],
  augsburg: [48.3715, 10.8985],
  wiesbaden: [50.0782, 8.2398],
  gelsenkirchen: [51.5112, 7.1028],
  "mönchengladbach": [51.1927, 6.4327],
  monchengladbach: [51.1927, 6.4327],
  braunschweig: [52.2689, 10.5268],
  kiel: [54.3233, 10.1228],
  chemnitz: [50.8333, 12.9167],
  aachen: [50.7753, 6.0839],
  halle: [51.4828, 11.9697],
  magdeburg: [52.1205, 11.6276],
  freiburg: [47.999, 7.8421],
  "freiburg im breisgau": [47.999, 7.8421],
  krefeld: [51.3333, 6.5667],
  "lübeck": [53.8655, 10.6866],
  lubeck: [53.8655, 10.6866],
  mainz: [49.9929, 8.2473],
  erfurt: [50.9787, 11.0328],
  oberhausen: [51.47, 6.8646],
  rostock: [54.0924, 12.0991],
  kassel: [51.3127, 9.4797],
  hagen: [51.3671, 7.4633],
  "saarbrücken": [49.2401, 6.9969],
  saarbrucken: [49.2401, 6.9969],
  hamm: [51.6811, 7.818],
  potsdam: [52.3906, 13.0645],
  ludwigshafen: [49.4815, 8.4419],
  "mülheim": [51.4275, 6.8825],
  mulheim: [51.4275, 6.8825],
  oldenburg: [53.1435, 8.2146],
  "osnabrück": [52.2799, 8.0472],
  osnabruck: [52.2799, 8.0472],
  leverkusen: [51.0303, 6.9843],
  heidelberg: [49.3988, 8.6724],
  darmstadt: [49.8728, 8.6512],
};

export const CITY_MARKET_NOTES = {
  berlin: "Scale-up, produit et design",
  hamburg: "Logistique, santé et opérations",
  "münchen": "Industrie, data et conseil",
  "frankfurt am main": "Finance, support et ventes B2B",
  "köln": "Médias, support client et commerce",
  stuttgart: "Automobile, production et ingénierie",
  leipzig: "Supply chain et services",
  dresden: "Semi-conducteurs et R&D",
};

export function normalizeCityKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractPrimaryCity(location) {
  return String(location || "")
    .split(",")[0]
    .split("(")[0]
    .trim();
}
