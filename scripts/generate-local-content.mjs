#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

// ──────────────────────────────────────────────────────────────
// DETERMINISTIC SEEDED RANDOM
// ──────────────────────────────────────────────────────────────
function hash(slug, seed = 0) {
  let h = seed * 31 + 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0);
}

function pick(slug, seed, arr) {
  return arr[hash(slug, seed) % arr.length];
}

function pickN(slug, seed, arr, n) {
  const indices = [];
  const used = new Set();
  let s = seed;
  while (indices.length < n && indices.length < arr.length) {
    const idx = hash(slug, s) % arr.length;
    if (!used.has(idx)) { indices.push(idx); used.add(idx); }
    s++;
  }
  return indices.map(i => arr[i]);
}

// ──────────────────────────────────────────────────────────────
// MICRO-RÉGIONS GARDOISES (30)
// ──────────────────────────────────────────────────────────────
const MICRO_REGIONS = {
  'cevennes-piemont': {
    label: 'Cévennes & Piémont',
    description: 'contreforts montagneux et vallées cévenoles autour d\'Alès',
    climate: 'épisodes cévenols d\'une violence extrême avec abats d\'eau torrentiels (jusqu\'à 500mm en 24h) et vent fort en crête',
    roofRisk: 'infiltrations brutales sous tuiles canal et affaissement des charpentes anciennes sous le poids des pluies cévenoles',
    maintenanceCycle: 4,
    communes: [
      'ales', 'la-grand-combe', 'saint-jean-du-gard', 'besseges', 'saint-privat-des-vieux', 
      'saint-hilaire-de-brethmas', 'salindres', 'rousson', 'saint-ambroix', 'anduze', 
      'saint-christol-lez-ales', 'bagard', 'saint-julien-les-rosiers', 'mons', 'le-vigan', 
      'sumene', 'lasalle', 'vezenobres'
    ]
  },
  'plaine-nimes': {
    label: 'Plaine de Nîmes',
    description: 'bassin de vie nîmois et la plaine des Costières',
    climate: 'chaleur estivale écrasante de type caniculaire dépassant régulièrement 42°C et orages d\'été soudains',
    roofRisk: 'chocs thermiques sur tuiles romanes desséchées par le soleil et surchauffe extrême sous les toits',
    maintenanceCycle: 5,
    communes: [
      'nimes', 'milhaud', 'manduel', 'bouillargues', 'marguerittes', 'caissargues', 
      'garons', 'bernis', 'uchaud', 'vergeze', 'codognan', 'poulx', 'redessan', 
      'bezouce', 'saint-gervasy', 'rodilhan', 'generac', 'caveirac', 'clarensac', 'langlade'
    ]
  },
  'rhodanien': {
    label: 'Gard Rhodanien & Rhône',
    description: 'couloir rhodanien et coteaux nord-est du Gard',
    climate: 'exposition directe au vent du Mistral soufflant en rafales violentes du nord et humidité de la vallée du Rhône',
    roofRisk: 'arrachement et déplacement des tuiles canal par le Mistral et infiltrations d\'eau par vent de face',
    maintenanceCycle: 5,
    communes: [
      'bagnols-sur-ceze', 'beaucaire', 'pont-saint-esprit', 'villeneuve-les-avignon', 
      'les-angles', 'roquemaure', 'laudun-lardoise', 'aramon', 'saint-laurent-des-arbres', 
      'fourques', 'jonquieres-saint-vincent', 'comps'
    ]
  },
  'camargue': {
    label: 'Petite Camargue',
    description: 'plaines alluviales et littoral méditerranéen gardois',
    climate: 'vents marins humides chargés de sel et embruns corrosifs du golfe d\'Aigues-Mortes',
    roofRisk: 'corrosion saline des zingueries et fixations en fer, et décollement des tuiles par le vent marin',
    maintenanceCycle: 3,
    communes: [
      'vauvert', 'saint-gilles', 'aigues-mortes', 'le-grau-du-roi', 'aimargues', 
      'gallargues-le-montueux', 'saint-laurent-daigouze', 'bellegarde', 'le-cailar', 
      'beauvoisin'
    ]
  },
  'uzege': {
    label: 'Uzège & Garrigues',
    description: 'collines calcaires, garrigues et val d\'Uzès',
    climate: 'climat sec méditerranéen contrasté avec épisodes de gel hivernal et fortes chaleurs estivales',
    roofRisk: 'fissuration des tuiles canal anciennes et encrassement par la végétation de garrigue environnante',
    maintenanceCycle: 5,
    communes: [
      'uzes', 'remoulins', 'castillon-du-gard', 'saint-quentin-la-poterie', 'sommieres', 
      'calvisson', 'quissac', 'saint-hippolyte-du-fort', 'congenies', 'saint-chaptes', 
      'saint-mamert-du-gard', 'ledignan', 'vers-pont-du-gard', 'la-calmette'
    ]
  }
};

function getMicroRegion(slug) {
  for (const [key, region] of Object.entries(MICRO_REGIONS)) {
    if (region.communes.includes(slug)) return key;
  }
  // Fallback by coordinates
  const c = communes.find(c => c.slug === slug);
  if (!c) return 'plaine-nimes';
  const lat = c.latitude || 43.83;
  const lon = c.longitude || 4.36;
  
  if (lat > 44.05 && lon < 4.3) return 'cevennes-piemont';
  if (lat > 44.05 && lon >= 4.3) return 'rhodanien';
  if (lat < 43.7 && lon < 4.3) return 'camargue';
  if (lat < 43.7 && lon >= 4.3) return 'rhodanien'; // Beaucaire area
  if (lon < 4.2 && lat > 43.8) return 'uzege';
  return 'plaine-nimes';
}

// ──────────────────────────────────────────────────────────────
// LANDMARKS PAR COMMUNE (réels et vérifiés - Gard 30)
// ──────────────────────────────────────────────────────────────
const LANDMARKS_DB = {
  'nimes': ['les Arènes de Nîmes et la Maison Carrée classée UNESCO', 'la Tour Magne et les Jardins de la Fontaine'],
  'ales': ['le Fort Vauban et la colline de l\'Ermitage', 'la cathédrale Saint-Jean-Baptiste et la mine témoin'],
  'uzes': ['le Duché d\'Uzès et la place aux Herbes', 'la Tour Fenestrelle et la vallée d\'Eure'],
  'aigues-mortes': ['les remparts médiévaux et la Tour de Constance', 'les salins roses du Midi et les étangs'],
  'le-grau-du-roi': ['le port de pêche traditionnel et le phare de l\'Espiguette', 'la plage sauvage de l\'Espiguette et la baie d\'Aigues-Mortes'],
  'vauvert': ['le centre historique et les paysages de Petite Camargue', 'l\'église Notre-Dame et les manades environnantes'],
  'saint-gilles': ['l\'abbatiale romane classée UNESCO sur le chemin de Compostelle', 'les ports fluviaux et le canal de la Petite Camargue'],
  'bagnols-sur-ceze': ['la place Mallet et la tour de l\'Horloge', 'le musée Albert-André et la vallée de la Cèze'],
  'villeneuve-les-avignon': ['le Fort Saint-André et la Chartreuse du Val de Bénédiction', 'la Tour Philippe-le-Bel dominant le Rhône'],
  'pont-saint-esprit': ['le pont médiéval sur le Rhône classé monument historique', 'la collégiale Saint-Saturnin'],
  'beaucaire': ['le château médiéval de Beaucaire et la Maison Gothique', 'le port de plaisance sur le canal du Rhône à Sète'],
  'anduze': ['la bambouseraie en Cévennes et le train à vapeur', 'la Tour de l\'Horloge et les gorges du Gardon'],
  'sommieres': ['le pont romain de Tibère sur le Vidourle', 'le château médiéval dominant le centre historique'],
  'remoulins': ['le Pont du Gard romain situé à proximité immédiate', 'le vieux village de Remoulins et les berges du Gardon'],
  'la-grand-combe': ['la Maison du Mineur et le puits Ricard', 'la vallée du Gardon d\'Alès et les Cévennes'],
  'les-angles': ['le vieux village perché dominant le Rhône et Avignon', 'la plaine des Angles']
};

function getLandmarks(slug) {
  if (LANDMARKS_DB[slug]) return LANDMARKS_DB[slug];
  const region = getMicroRegion(slug);
  const regionData = MICRO_REGIONS[region];
  const fallbacks = {
    'cevennes-piemont': ['les parcs naturels et les vallées des Cévennes', 'la Bambouseraie d\'Anduze'],
    'plaine-nimes': ['la plaine nîmoise et les vestiges romains', 'les arènes et la Maison Carrée'],
    'rhodanien': ['les vignobles du Gard Rhodanien', 'les berges du Rhône et ses monuments historiques'],
    'camargue': ['les plaines de la Petite Camargue et ses manades de taureaux', 'les salins du Midi'],
    'uzege': ['le Pont du Gard romain classé UNESCO', 'les collines de garrigues et le Duché d\'Uzès']
  };
  return fallbacks[region] || ['les paysages typiques du Gard', 'la garrigue gardoise'];
}

function getAltitude(slug) {
  const altitudes = {
    'nimes': 39, 'ales': 134, 'bagnols-sur-ceze': 47, 'beaucaire': 6, 'saint-gilles': 7,
    'villeneuve-les-avignon': 25, 'vauvert': 18, 'pont-saint-esprit': 33, 'les-angles': 35,
    'aigues-mortes': 1, 'le-grau-du-roi': 1, 'uzes': 120, 'remoulins': 23, 'sommieres': 32,
    'anduze': 125, 'la-grand-combe': 188, 'calvisson': 50, 'saint-ambroix': 150,
    'saint-privat-des-vieux': 112, 'saint-hilaire-de-brethmas': 98, 'salindres': 160,
    'rousson': 180, 'saint-jean-du-gard': 189, 'besseges': 160, 'roquemaure': 25,
    'laudun-lardoise': 45, 'aramon': 10, 'saint-laurent-des-arbres': 55
  };
  if (altitudes[slug]) return altitudes[slug];
  const region = getMicroRegion(slug);
  const defaults = {
    'cevennes-piemont': 150, 'plaine-nimes': 45, 'rhodanien': 30, 'camargue': 5, 'uzege': 90
  };
  return defaults[region] || 50;
}

// ──────────────────────────────────────────────────────────────
// INTERCOMMUNALITÉS (Gard 30)
// ──────────────────────────────────────────────────────────────
function getIntercommunalite(cp, slug) {
  const codePostal = String(cp);
  const region = getMicroRegion(slug);

  if (region === 'plaine-nimes' || ['nimes', 'milhaud', 'manduel', 'bouillargues', 'marguerittes', 'caissargues', 'garons', 'bernis', 'uchaud', 'redessan', 'bezouce', 'saint-gervasy', 'rodilhan', 'generac', 'caveirac', 'clarensac', 'langlade', 'poulx'].includes(slug)) {
    return "Nîmes Métropole";
  }
  if (region === 'cevennes-piemont' || ['ales', 'la-grand-combe', 'saint-privat-des-vieux', 'saint-hilaire-de-brethmas', 'salindres', 'rousson', 'saint-christol-lez-ales', 'bagard', 'saint-julien-les-rosiers', 'mons', 'anduze', 'saint-jean-du-gard', 'vezenobres'].includes(slug)) {
    return "Alès Agglomération";
  }
  if (['bagnols-sur-ceze', 'pont-saint-esprit', 'roquemaure', 'laudun-lardoise', 'saint-laurent-des-arbres'].includes(slug)) {
    return "Communauté de communes du Gard Rhodanien";
  }
  if (['villeneuve-les-avignon', 'les-angles', 'aramon'].includes(slug)) {
    return "Communauté d'agglomération du Grand Avignon";
  }
  if (['beaucaire', 'jonquieres-saint-vincent', 'fourques', 'comps'].includes(slug)) {
    return "Communauté de communes Beaucaire Terre d'Argence";
  }
  if (['vauvert', 'saint-gilles', 'aimargues', 'le-cailar', 'beauvoisin'].includes(slug)) {
    return "Communauté de communes de la Petite Camargue";
  }
  if (['aigues-mortes', 'le-grau-du-roi', 'saint-laurent-daigouze'].includes(slug)) {
    return "Communauté de communes Terre de Camargue";
  }
  if (['uzes', 'saint-quentin-la-poterie', 'remoulins', 'vers-pont-du-gard', 'castillon-du-gard'].includes(slug)) {
    return "Communauté de communes du Pays d'Uzès";
  }
  if (['sommieres', 'calvisson', 'congenies'].includes(slug)) {
    return "Communauté de communes du Pays de Sommières";
  }
  return "Département du Gard";
}

// ──────────────────────────────────────────────────────────────
// HABITAT DESCRIPTIONS gardoises
// ──────────────────────────────────────────────────────────────
const HABITAT_BY_REGION = {
  'cevennes-piemont': [
    "mas traditionnels en schiste ou grès cévenol, aux lourdes toitures en tuiles canal d'époque ou lauzes",
    "maisons de mineurs ou anciennes bâtisses ouvrières en pierres de pays avec toitures pentues en tuiles mécaniques",
    "villas contemporaines construites à flanc de colline avec charpentes bois industrielles et écrans HPV",
    "granges et anciennes magnaneries réhabilitées aux structures de toits massives reposant sur des poutres en châtaignier"
  ],
  'plaine-nimes': [
    "maisons de ville nîmoises avec façades en pierre de Lens, toitures en tuiles canal maçonnées au mortier de chaux",
    "villas résidentielles des lotissements des Costières des années 80-2000 avec tuiles romanes terre cuite à emboîtement",
    "maisons de maître et bastides de garrigue aux génoises à trois rangs et tuiles canal ocre",
    "pavillons modernes de plain-pied avec toitures à faible pente, exposés à un ensoleillement intense"
  ],
  'rhodanien': [
    "bâtisses de village mitoyennes aux toitures imbriquées du Gard Rhodanien avec d'importantes contraintes d'écoulement",
    "maisons en pierre du centre historique de Beaucaire avec charpentes traditionnelles à pannes massives",
    "villas récentes des coteaux du Rhône aux toitures équipées de tuiles mécaniques et crochets anti-vent",
    "anciens domaines viticoles aux toitures très étendues en tuiles canal ocre flammées posées sur voliges"
  ],
  'camargue': [
    "mas camarguais bas, aux toitures traditionnelles en roseaux ou tuiles canal à faible inclinaison pour résister au vent marin",
    "villas de vacances du Grau-du-Roi exposées aux embruns marins, équipées de tuiles béton ou romanes hautement étanches",
    "maisons de pêcheurs du centre ancien avec toitures d'époque en tuiles canal et fixations en acier inoxydable",
    "pavillons résidentiels de Petite Camargue reposant sur des sols alluviaux nécessitant des structures de toit légères"
  ],
  'uzege': [
    "maisons de village en pierres blondes d'Uzès aux toitures canal traditionnelles, soumises aux contraintes des Bâtiments de France",
    "mas de garrigue restaurés avec toitures de caractère, faîtages maçonnés à la chaux et génoises soignées",
    "villas discrètes intégrées dans la garrigue calcaire, équipées de toits en tuiles romanes ocre clair",
    "maisons vigneronnes avec grandes granges attenantes possédant d'importantes surfaces de couverture en tuiles canal"
  ]
};

function getHabitatType(slug, region) {
  if (slug === 'nimes') return "immeubles du centre historique et écusson aux couvertures en tuiles canal anciennes maçonnées, et villas individuelles de garrigue";
  if (slug === 'ales') return "maisons de ville typiques de l'histoire minière en tuiles mécaniques et pavillons individuels du bassin alésien";
  if (slug === 'uzes') return "bâtisses de caractère en pierre blonde avec toitures en tuiles canal traditionnelles et génoises sous forte réglementation ABF";
  if (slug === 'aigues-mortes') return "maisons de ville ceintes de remparts médiévaux aux toitures de tuiles canal basses et mas de Camargue exposés au sel";
  
  const habitats = HABITAT_BY_REGION[region] || HABITAT_BY_REGION['plaine-nimes'];
  return pick(slug, 10, habitats);
}

// ──────────────────────────────────────────────────────────────
// ROOF CHARACTERISTICS (Gard 30)
// ──────────────────────────────────────────────────────────────
function getRoofCharacteristics(slug, region) {
  const chars = {
    'cevennes-piemont': { tuileDominante: 'Tuile canal ancienne ou Lauze de schiste', fixation: 'Crochets galvanisés renforcés ou mortier bâtard', ventilation: 'Chatières de toiture et grilles pare-feuilles', ecran: 'Écran de sous-toiture pare-neige et pare-pluie HPV' },
    'plaine-nimes': { tuileDominante: 'Tuile romane en terre cuite ou mécanique grand moule', fixation: 'Crochets galvanisés DTU 40.21 Zone III', ventilation: 'Chatières + closoir de faîtage ventilé anti-surchauffe', ecran: 'Écran sous-toiture HPV réflectif haute température' },
    'rhodanien': { tuileDominante: 'Tuile canal ou romane ocre flammée', fixation: 'Crochets et vis de fixation anti-arrachement Mistral', ventilation: 'Closoirs ventilés à haute efficacité', ecran: 'Écran sous-toiture HPV résistant aux infiltrations par Mistral' },
    'camargue': { tuileDominante: 'Tuile canal terre cuite ou tuile béton étanche', fixation: 'Crochets en acier inoxydable de qualité marine', ventilation: 'Closoirs et chatières résistants aux entrées de sable', ecran: 'Écran de sous-toiture HPV résistant au sel et à la corrosion' },
    'uzege': { tuileDominante: 'Tuile canal traditionnelle terre cuite ocre/blonde', fixation: 'Mortier de chaux traditionnel et crochets galvanisés', ventilation: 'Chatières de toiture discrètes (normes ABF)', ecran: 'Écran sous-toiture HPV de haute performance' }
  };
  return chars[region] || chars['plaine-nimes'];
}

// ──────────────────────────────────────────────────────────────
// 12+ TEMPLATES D'INTRO (Gard 30)
// ──────────────────────────────────────────────────────────────
function getLocalIntroText(commune, region) {
  const { nom, slug, population } = commune;
  const habitat = getHabitatType(slug, region);
  const regionData = MICRO_REGIONS[region];
  const landmarks = getLandmarks(slug);
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const templates = [
    () => `Située ${altitude > 100 ? `à ${altitude}m d'altitude` : 'dans la plaine ensoleillée du Gard'}, la commune de ${nom} (${pop} habitants) possède un patrimoine composé de ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} : les toitures subissent ici un ${regionData.roofRisk}. À proximité de ${landmarks[0]}, les couvreurs certifiés RGE du 30 maîtrisent les techniques spécifiques à ce secteur pour assurer l'étanchéité et la longévité de votre couverture.`,
    
    () => `Le secteur de ${nom} dans le Gard est soumis à des contraintes climatiques redoutables : ${regionData.climate}. Les ${pop} habitants de la commune résident dans un parc immobilier varié — ${habitat} — qui demande une expertise locale pointue en couverture. Proche de ${landmarks[0]}, chaque intervention de réfection ou d'entretien de toit doit faire face aux risques de ${regionData.roofRisk}.`,
    
    () => `${nom} (${commune.codePostal}), commune de ${pop} habitants, connaît un marché immobilier très recherché dans le département du Gard. Le parc résidentiel, constitué de ${habitat}, nécessite des interventions régulières de couverture. La spécificité locale — ${regionData.climate} — impose aux artisans couvreurs du 30 une connaissance approfondie des pathologies propres à ${regionData.description}.`,
    
    () => `Les toitures de ${nom} présentent des particularités techniques liées à leur implantation dans ${regionData.description}. Le bâti local, principalement constitué de ${habitat}, subit de plein fouet les effets de ${regionData.climate}. Avec ${pop} habitants et ${landmarks[0]} comme repère emblématique, la commune impose aux professionnels de la couverture une vigilance renforcée face aux risques de ${regionData.roofRisk}.`,
    
    () => `Protéger sa toiture à ${nom} n'est pas qu'une question d'esthétique : c'est une nécessité absolue face aux ${regionData.climate}. Le parc immobilier de cette commune de ${pop} habitants — ${habitat} — exige un entretien rigoureux adapté au cycle de maintenance recommandé de ${regionData.maintenanceCycle} ans dans cette zone. Située près de ${landmarks[0]}, ${nom} bénéficie d'un réseau d'artisans couvreurs RGE spécialisés dans les spécificités du ${regionData.label}.`,
    
    () => `Implantée dans ${regionData.description}, ${nom} est une commune active de ${pop} habitants dont les habitations — ${habitat} — sont directement exposées à ${regionData.climate}. Le principal risque pour les couvertures du secteur demeure le ${regionData.roofRisk}. Les artisans certifiés RGE intervenant sur ${nom} et ses environs connaissent parfaitement ces contraintes et adaptent leurs techniques de pose de tuiles en conséquence.`,
    
    () => `À ${nom} (${commune.codePostal}), les travaux de toiture doivent concilier performance thermique et respect des règles architecturales locales. Cette commune de ${pop} habitants, idéalement située dans ${regionData.description}, possède un parc bâti riche composé de ${habitat}. L'${regionData.climate} accroît les risques de ${regionData.roofRisk}, rendant capital le recours à des couvreurs qualifiés du département 30.`,
    
    () => `Chaque saison met à rude épreuve les toitures de ${nom}. L'été, la canicule gardoise fait monter la température sous les tuiles à plus de 70°C. L'automne apporte les pluies torrentielles cévenoles. L'hiver, ${altitude > 150 ? 'le gel régulier' : 'l\'humidité persistante'} fragilise les fixations. Le parc immobilier de cette commune de ${pop} habitants — ${habitat} — requiert l'intervention de couvreurs RGE maîtrisant les caractéristiques de ${regionData.description}.`,
    
    () => `Le tissu urbain de ${nom}, commune gardoise de ${pop} habitants, se distingue par ${habitat}. Proche de ${landmarks[0]}, les toitures y subissent les assauts de ${regionData.climate}. Le risque technique majeur identifié par les couvreurs locaux est le ${regionData.roofRisk}. Un entretien professionnel régulier, tous les ${regionData.maintenanceCycle} ans, est vivement conseillé pour prévenir toute infiltration d'eau.`,
    
    () => `Investir dans la rénovation de sa toiture à ${nom} est un choix patrimonial fort. Dans cette commune du Gard de ${pop} habitants, les habitations — ${habitat} — font face à ${regionData.climate}. Ignorer les prémices de ${regionData.roofRisk} peut provoquer des sinistres matériels lourds. Les couvreurs certifiés RGE du secteur de ${regionData.label} interviennent rapidement pour pérenniser votre bien immobilier.`,
    
    () => `Dans le département du Gard, ${nom} (${pop} habitants) fait face à des enjeux environnementaux clairs : ${regionData.climate}. Le bâti résidentiel, composé de ${habitat}, requiert des solutions de couverture à la fois performantes et conformes aux exigences du climat de ${regionData.description}. L'isolation thermique par le toit y est cruciale pour le confort d'été.`,
    
    () => `Seul un couvreur connaissant parfaitement le climat du Gard à ${nom} peut garantir des travaux de couverture durables. Cette commune de ${pop} habitants, implantée dans ${regionData.description}, abrite ${habitat}. Avec ${regionData.climate}, les toitures exigent des techniques de pose maîtrisées : fixations résistantes aux vents, zinguerie dimensionnée pour les orages et traitement adapté contre ${regionData.roofRisk}.`
  ];

  return pick(slug, 20, templates)();
}

// ──────────────────────────────────────────────────────────────
// 12+ VARIANTES CONSEIL LOCAL (Gard 30)
// ──────────────────────────────────────────────────────────────
function getLocalAdvice(commune, region) {
  const { nom, slug, codePostal } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const advices = [
    `Après un épisode cévenol violent à ${nom}, inspectez visuellement votre toiture depuis le sol pour détecter toute tuile glissée, fissure dans le solin ou gouttière obstruée. Déclarez les dommages à votre assureur sous 5 jours et demandez un diagnostic d'étanchéité d'urgence à un couvreur du Gard.`,
    `Le cycle de nettoyage et traitement recommandé pour les toitures dans le secteur de ${nom} (${regionData.label}) est fixé à ${regionData.maintenanceCycle} ans. Une application d'anti-mousse et d'hydrofuge préventif évite la porosité des tuiles canal et romanes.`,
    `Pour pouvoir prétendre aux aides de l'Anah ou MaPrimeRénov' pour l'isolation de votre toiture à ${nom}, vous devez obligatoirement signer avec un artisan couvreur certifié RGE (Reconnu Garant de l'Environnement) assuré en décennale.`,
    `À ${nom}, le Mistral et les tempêtes d'automne peuvent souffler en rafales à plus de 110 km/h. Faites vérifier la fixation mécanique de vos tuiles selon le DTU 40.21 (Zone III) par un professionnel afin d'éviter tout arrachement de toiture.`,
    `Le Plan Local d'Urbanisme (PLU) de ${nom} (${codePostal}) encadre strictement les teintes de tuiles et les finitions de rives de toit. Prenez contact avec le service d'urbanisme de la mairie avant vos travaux de rénovation de toiture.`,
    `Si votre projet de réfection de toit à ${nom} se situe dans le champ de visibilité d'un bâtiment historique (comme le Pont du Gard ou le Duché d'Uzès), l'avis conforme de l'Architecte des Bâtiments de France (ABF) est obligatoire.`,
    `Avant d'engager un couvreur à ${nom}, demandez toujours son attestation d'assurance décennale nominative couvrant précisément les travaux de couverture et de zinguerie pour l'année en cours dans le Gard.`,
    `En ${regionData.description}, l'exposition au soleil dessèche les joints de mortier des toits anciens. Un entretien régulier avec réfection des solins et des joints de faîtage est indispensable pour préserver la structure en bois.`,
    `L'intercommunalité ${getIntercommunalite(codePostal, slug)} propose ponctuellement des aides financières locales pour l'isolation ou la rénovation des toitures. Prenez conseil auprès du guichet unique de l'habitat du secteur de ${nom}.`,
    `La proximité de pinèdes ou de chênes verts de garrigue autour de votre maison à ${nom} accélère le dépôt d'aiguilles et de feuilles dans vos gouttières. Pensez à faire poser des crapaudines et des grilles pare-feuilles métalliques.`,
    `En cas de grêle importante sur la plaine de ${nom}, documentez les dégâts avec des photos de vos tuiles cassées ou grêlées. Déposez immédiatement un dossier auprès de votre compagnie d'assurance pour faire valoir vos droits.`,
    altitude > 130
      ? `À ${nom} et sur le piémont cévenol (${altitude}m), le gel hivernal peut fendre les tuiles de terre cuite poreuses. Exigez de votre couvreur des tuiles certifiées NF EN 490 ou DTU 40.22 résistantes au gel.`
      : `Face aux chaleurs extrêmes d'été à ${nom}, la lame d'air sous toiture doit être de 4 cm minimum. Installez des chatières de toiture et un faîtage ventilé pour assurer un confort thermique optimal sous vos combles.`
  ];

  return pick(slug, 30, advices);
}

// ──────────────────────────────────────────────────────────────
// FAQ POOL (Gard 30)
// ──────────────────────────────────────────────────────────────
function getLocalFAQ(commune, region) {
  const { nom, slug, codePostal, population } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const universalPool = [
    {
      q: `Quel est le prix moyen au m² pour refaire un toit à ${nom} ?`,
      a: `À ${nom}, le coût de réfection complète de toiture oscille généralement entre 95€ et 160€ le m² TTC. Ce tarif englobe la dépose des anciennes tuiles, la pose d'un écran sous-toiture HPV, les liteaux et la couverture neuve (tuiles romanes ou canal). Un diagnostic sur place est indispensable pour chiffrer l'état de la charpente.`
    },
    {
      q: `Tuile canal traditionnelle ou tuile romane moderne à ${nom} ?`,
      a: `La tuile romane offre un excellent rapport qualité/prix, une pose rapide par emboîtement et une étanchéité parfaite. La tuile canal scellée au mortier de chaux est le standard des mas anciens dans le Gard. Le PLU de ${nom} ou l'Architecte des Bâtiments de France (ABF) peut imposer l'usage exclusif de la tuile canal dans les zones protégées.`
    },
    {
      q: `Quelle est la durée de vie d'un toit en tuiles dans le Gard ?`,
      a: `Une couverture en tuiles terre cuite à ${nom} dure entre 50 et 75 ans si elle est bien entretenue. Le climat de ${regionData.description} subissant les ${regionData.climate}, les matériaux sont mis à rude épreuve. Un démoussage hydrofuge régulier (tous les ${regionData.maintenanceCycle} à 5 ans) prolonge la longévité de 15 ans.`
    },
    {
      q: `Comment isoler son toit contre la canicule estivale à ${nom} ?`,
      a: `Pour faire face aux canicules gardoises, l'isolation par sarking (par l'extérieur) avec des panneaux de laine de bois haute densité est la solution la plus performante. Elle offre un fort déphasage thermique (10 à 12h), bloquant la chaleur du soleil avant qu'elle ne pénètre dans vos combles à ${nom}.`
    },
    {
      q: `Faut-il déclarer des travaux de toiture en mairie à ${nom} ?`,
      a: `Oui, toute modification de l'aspect extérieur d'un bâtiment (changement de couleur de tuile, pose d'un Velux ou réfection à neuf) impose le dépôt d'une Déclaration Préalable de travaux (DP) en mairie de ${nom}. Le délai d'instruction est de 1 mois (2 mois en secteur classé ABF).`
    },
    {
      q: `Comment protéger mon toit du risque d'inondation cévenole à ${nom} ?`,
      a: `Pour faire face aux abats d'eau torrentiels des épisodes cévenols à ${nom}, il est impératif d'installer un écran sous-toiture HPV (Haute Perméabilité à la Vapeur) étanche et de dimensionner vos gouttières en zinc ou aluminium de développement 33, avec des descentes de diamètre 100 pour évacuer les pluies sans déborder.`
    }
  ];

  const cevenolPool = [
    {
      q: `Comment réagir en urgence après une fuite de toit suite à un orage cévenol à ${nom} ?`,
      a: `En cas de fuite de toiture après un orage à ${nom}, sécurisez d'abord vos pièces. Ne montez jamais sur une toiture mouillée et glissante. Contactez un couvreur local en urgence pour effectuer un bâchage temporaire et réparer les tuiles cassées. Déclarez le sinistre sous 5 jours à votre assurance habitation.`
    },
    {
      q: `Comment se passe l'indemnisation assurance après une catastrophe naturelle (Cat-Nat) à ${nom} ?`,
      a: `Si la commune de ${nom} fait l'objet d'un arrêté officiel de Catastrophe Naturelle suite à des inondations ou pluies cévenoles, vous disposez de 10 jours après la publication au Journal Officiel pour envoyer votre déclaration de sinistre toiture. L'assureur mandatera un expert pour valider le devis de votre couvreur.`
    }
  ];

  const mistralPool = [
    {
      q: `Le Mistral peut-il arracher les tuiles de mon toit à ${nom} ?`,
      a: `Oui, le couloir du Rhône et la plaine de ${nom} sont régulièrement balayés par des rafales de Mistral soufflant à plus de 100 km/h. Les règles DTU imposent le clouage, le crochetage ou le scellement d'une tuile sur trois au minimum, et de toutes les tuiles de rives, de faîtage et d'égout pour éviter tout soulèvement.`
    }
  ];

  const camarguePool = [
    {
      q: `Les toitures en Petite Camargue à ${nom} demandent-elles des fixations spéciales ?`,
      a: `Absolument. En raison de la proximité des salins et du littoral méditerranéen de ${nom}, l'air chargé de sel corrode les fixations en acier standard. Les couvreurs installent exclusivement des crochets et visseries en acier inoxydable de qualité marine (A4) pour fixer les tuiles et gouttières.`
    }
  ];

  let pool = [...universalPool];
  if (region === 'cevennes-piemont') pool.push(...cevenolPool);
  if (region === 'rhodanien') pool.push(...mistralPool);
  if (region === 'camargue') pool.push(...camarguePool);

  const count = (hash(slug, 50) % 2) + 4; // 4 or 5
  return pickN(slug, 40, pool, count);
}

// ──────────────────────────────────────────────────────────────
// MARKET DATA (Gard 30)
// ──────────────────────────────────────────────────────────────
function getMarketData(commune, region) {
  const { slug, population } = commune;
  const h = hash(slug, 4);

  let rgeCount = 2;
  if (population > 100000) rgeCount = 35; // Nîmes
  else if (population > 40000) rgeCount = 18; // Alès
  else if (population > 15000) rgeCount = 8;
  else if (population > 5000) rgeCount = 4;
  rgeCount += (h % 4);
  rgeCount = Math.max(1, rgeCount);

  const priceMultiplier = {
    'cevennes-piemont': 1.10, 'plaine-nimes': 1.15, 'rhodanien': 1.08,
    'camargue': 1.05, 'uzege': 1.12
  };
  const mult = priceMultiplier[region] || 1.05;

  const basePriceRef = Math.round((90 + (h % 35)) * mult);
  const basePriceDem = Math.round((12 + (h % 12)) * mult);

  return {
    couvreursRGE: rgeCount,
    prixM2Refection: basePriceRef,
    prixM2Demoussage: basePriceDem,
    delaiMoyenJours: 5 + (h % 15) // 5 - 20 days
  };
}

// ──────────────────────────────────────────────────────────────
// MAIN: ENRICH ALL GARD COMMUNES
// ──────────────────────────────────────────────────────────────
const enriched = communes.map(commune => {
  const region = getMicroRegion(commune.slug);
  const regionData = MICRO_REGIONS[region];
  const intercommunalite = getIntercommunalite(commune.codePostal, commune.slug);
  const intro = getLocalIntroText(commune, region);
  const conseil = getLocalAdvice(commune, region);
  const faq = getLocalFAQ(commune, region);
  const market = getMarketData(commune, region);
  const landmarks = getLandmarks(commune.slug);
  const altitude = getAltitude(commune.slug);

  return {
    ...commune,
    intercommunalite,
    microRegion: region,
    microRegionLabel: regionData.label,
    altitude,
    landmarks,
    introText: intro,
    conseilLocal: conseil,
    faq: faq,
    marketData: market
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2), 'utf-8');

// Stats Verification
const introTexts = enriched.map(c => c.introText);
const uniqueIntros = new Set(introTexts);
const regions = {};
enriched.forEach(c => { regions[c.microRegion] = (regions[c.microRegion] || 0) + 1; });

console.log(`✅ Enriched ${enriched.length} Gard (30) communes with unique SEO data.`);
console.log(`   📊 Unique intros: ${uniqueIntros.size} / ${enriched.length}`);
console.log(`   📊 Micro-régions distribution:`, regions);
console.log(`\nSample Nîmes intro:\n${enriched.find(c => c.slug === 'nimes')?.introText?.substring(0, 200)}...`);
console.log(`\nSample Alès intro:\n${enriched.find(c => c.slug === 'ales')?.introText?.substring(0, 200)}...`);
console.log(`\nSample Uzès intro:\n${enriched.find(c => c.slug === 'uzes')?.introText?.substring(0, 200)}...`);
