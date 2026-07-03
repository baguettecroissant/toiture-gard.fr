import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  intercommunalite?: string;
  microRegion?: string;
  microRegionLabel?: string;
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 110;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  
  return {
    refectionRomane: { min: Math.round(rPrice * 0.95), max: Math.round(rPrice * 1.35) },
    refectionCanal: { min: Math.round(rPrice * 1.10), max: Math.round(rPrice * 1.50) },
    refectionZinc: { min: Math.round(rPrice * 1.25), max: Math.round(rPrice * 1.80) },
    demoussageHydro: { min: Math.round(dPrice * 0.85), max: Math.round(dPrice * 1.30) },
    reparationFuite: { min: 500, max: 4000 },
    faitageMl: { min: 35, max: 70 },
    zinguerieMl: { min: 45, max: 85 },
    isolationSarking: { min: 70, max: 150 },
    charpenteM2: { min: 55, max: 100 },
    surtoitureM2: { min: 130, max: 200 }
  };
}

class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(val);
  }
  return text;
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'demoussage' | 'artisan') {
  const rPrice = commune.marketData?.prixM2Refection || 110;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  const minRPrice = Math.round(rPrice * 0.9);
  const maxRPrice = Math.round(rPrice * 1.3);
  const minDPrice = Math.round(dPrice * 0.85);
  const maxDPrice = Math.round(dPrice * 1.25);
  const rge = commune.marketData?.couvreursRGE || 3;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const pop = commune.population || 3000;
  const slug = commune.slug;

  const lat = commune.latitude || 43.83;
  const lon = commune.longitude || 4.36;
  
  let geoZone: 'littoral' | 'plaine' | 'montagne' = 'plaine';
  if (commune.microRegion === 'camargue') {
    geoZone = 'littoral'; // Petite Camargue
  } else if (commune.microRegion === 'cevennes-piemont') {
    geoZone = 'montagne'; // Cévennes
  }

  const density: 'metropole' | 'village' = pop > 15000 ? 'metropole' : 'village';

  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const proxC1 = nearby[0]?.nom || "Nîmes";
  const proxC2 = nearby[1]?.nom || "Alès";
  const proxC3 = nearby[2]?.nom || "Bagnols-sur-Cèze";
  const proxC4 = nearby[3]?.nom || "Beaucaire";

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Gard",
    DEPARTEMENT_CODE: "30",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: commune.intercommunalite || "Nîmes Métropole",
    PROX_C1: proxC1,
    PROX_C2: proxC2,
    PROX_C3: proxC3,
    PROX_C4: proxC4
  };

  // Title templates
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "Rénovation de Toiture à {VILLE} ({ZIP}) — Couvreur Certifié Gard";
  } else if (pageType === 'demoussage') {
    titleTemplate = "Entretien de Toiture à {VILLE} ({ZIP}) — Devis Nettoyage & Démoussage";
  } else {
    titleTemplate = "Couvreur à {VILLE} ({ZIP}) — Devis Gratuit & Artisan RGE 30";
  }

  // Intro Paragraph templates
  let introTemplate = "";
  if (pageType === 'refection') {
    introTemplate = "Besoin d'un couvreur pour refaire votre toit à {VILLE} ({ZIP}) ? {Le Gard subit chaque année des épisodes cévenols dévastateurs — des trombes d'eau qui cherchent la moindre faille dans votre toiture|Les tuiles canal romanes sont le patrimoine historique du 30 depuis 2 000 ans — les sceller réclame un savoir-faire local spécifique|Les canicules extrêmes de la plaine nîmoise dépassent 42°C — une toiture non isolée transforme vos chambres sous combles en véritable four|Le vent du Mistral souffle en violentes rafales dans le couloir rhodanien — chaque tuile doit être solidement ancrée selon le DTU 40.21|Les intempéries répétées fragilisent les toits vieillissants — réaliser un diagnostic régulier évite des sinistres d'infiltration majeurs}. Les professionnels certifiés du 30 interviennent rapidement et rénovent votre couverture entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ TTC.";
  } else if (pageType === 'demoussage') {
    introTemplate = "Vous recherchez un spécialiste du nettoyage ou démoussage de toit à {VILLE} ({ZIP}) ? {Un traitement hydrofuge de surface tous les 5 ans dans le Gard prévient la porosité des tuiles canal et évite le gel-dégel hivernal|Les lichens noirs et les mousses se développent rapidement sur les tuiles ombragées près des chênes de garrigue|Avec un ensoleillement intense, la terre cuite des tuiles s'assèche et se fragilise, rendant indispensable l'application d'un hydrofuge protecteur}. Les artisans du Gard nettoient, éliminent mousses et lichens et appliquent un hydrofuge à effet perlant longue durée pour un tarif moyen de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².";
  } else {
    introTemplate = "Vous recherchez un artisan couvreur de confiance certifié RGE à {VILLE} ({ZIP}) ? Pour la pose de tuiles canal traditionnelles, des réparations urgentes post-cévenol ou une réfection complète de charpente, profitez d'une estimation gratuite sous {DELAIS} jours. Comparez les offres de couvreurs qualifiés assurés en décennale sur le secteur de {VILLE}, {PROX_C1} et {PROX_C2}.";
  }

  // Climate Context templates
  let climateTemplate = "";
  if (geoZone === 'littoral') {
    climateTemplate = "{Sur le littoral de {VILLE} et en Petite Camargue|Face au golfe d'Aigues-Mortes à {VILLE}|Sur les plaines humides camarguaises}, les toitures subissent une double agression : {l'air salin corrosif et les tempêtes de vent marin chargé de sable|le sel déposé par les entrées maritimes et les vents humides}. {Les tuiles romanes terre cuite|Les couvertures en tuiles canal} {sont exposées à une usure rapide des fixations métalliques standard|accumulent une humidité saline propice aux lichens marins}. {Nos artisans couvreurs du 30|Les compagnons locaux} {préconisent d'utiliser exclusivement des crochets et visseries en acier inoxydable de qualité marine|recommandent un nettoyage anti-sel suivi d'un traitement hydrofuge incolore hydro-oléophobe}.";
  } else if (geoZone === 'montagne') {
    climateTemplate = "{Sur le piémont cévenol et dans les vallées montagneuses autour de {VILLE}|Dans les montagnes des Cévennes à {VILLE}|Sur les contreforts schisteux cévenols}, {les épisodes cévenols déversent des quantités d'eau phénoménales|le climat combine hivers rigoureux et pluies torrentielles d'automne}. {La pose d'un écran sous-toiture HPV robuste|Une couverture en tuiles canal scellées ou en lauze de schiste} {est obligatoire pour parer aux infiltrations sous l'effet du vent|assure la stabilité de la toiture lors des orages cévenols les plus violents}. {Les chenaux et gouttières doivent être surdimensionnés|Les toitures doivent être solidement ancrées} {pour capter 100 litres par m² et par heure sans déborder|afin de résister au vent de crête et au poids de neige hivernale}.";
  } else {
    climateTemplate = "{Dans la plaine languedocienne autour de {VILLE}|Dans le bassin de vie nîmois à {VILLE}|Sur les plaines viticoles gardoises}, {les canicules de juillet-août|la chaleur torride estivale} {chauffe les combles jusqu'à plus de 50°C|crée une surchauffe extrême sous les tuiles}. {La pose d'un écran sous-toiture HPV réflectif|Une isolation de toiture performante en laine de bois ou du sarking} {est primordiale pour maintenir le confort d'été|permet d'économiser l'énergie de climatisation tout en évitant la condensation}. {De plus, la pose doit respecter} {les sections généreuses de gouttières alu ou zinc capables de canaliser les orages violents d'automne|la fixation mécanique des tuiles imposée par la zone III d'exposition au Mistral}.";
  }

  // ABF / Urban rules templates
  const abfTemplate = "{{Les règles d'urbanisme (PLU) de {VILLE} {encadrent de façon stricte l'aspect extérieur des habitations|imposent des restrictions pour les toitures visibles depuis l'espace public}. {Les tuiles romanes ou canal de teinte ocre flammée naturelle|Les finitions maçonnées de type génoises traditionnelles} {sont généralement requises|restent la norme exigée en mairie}. {Si votre logement se situe à proximité d'un monument historique comme le Pont du Gard ou à Uzès|Pour toute rénovation dans le centre ancien de {VILLE}}, {l'accord préalable de l'Architecte des Bâtiments de France (ABF) est obligatoire|les travaux devront faire l'objet d'une validation rigoureuse pour respecter le patrimoine historique local}.}|{Dans les lotissements récents de {VILLE}, {les toitures-terrasses et les tuiles mécaniques ocre ou grises|l'utilisation de bac acier ou de toits plats} {sont tolérées sous réserve de validation du règlement de zone|doivent respecter des coefficients de pente et de végétalisation précis}. {Un professionnel qualifié vous guidera|Les couvreurs gardois de notre réseau vous accompagnent} {dans les démarches de déclaration préalable de travaux en mairie de {VILLE}}.}}";

  // Housing typologies templates
  let housingTemplate = "";
  if (density === 'metropole') {
    housingTemplate = "{Le tissu urbain de {VILLE} se compose de {résidences collectives, de toits terrasses contemporains et de maisons de ville mitoyennes|copropriétés et de pavillons de banlieue}. {Les chantiers de couverture y nécessitent|La réfection de toiture y impose} {une logistique rigoureuse : échafaudage sécurisé, bennes à gravats, autorisation d'occupation de voirie en mairie et grutage éventuel|des assurances solides en responsabilité civile et une gestion coordonnée des nuisances de voisinage}. {L'étanchéité des acrotères et des raccordements en zinc|Le remplacement des gouttières collectives} {fait l'objet d'un contrôle rigoureux pour éviter toute fuite en copropriété|est une priorité absolue lors des rénovations pour prévenir les sinistres d'infiltration}.}";
  } else {
    housingTemplate = "{L'habitat à {VILLE} est principalement constitué de {mas traditionnels, de villas individuelles avec jardin et de pavillons de plain-pied|maisons individuelles en lotissement et de granges réhabilitées}. {L'état de la charpente en bois (fermettes ou pannes massives)|La solidité de la charpente traditionnelle} {est analysé systématiquement avant la pose des tuiles|est inspecté en priorité pour vérifier l'absence de termites ou de champignons lignivores}. {La présence de pins maritimes ou de végétation de garrigue environnante|La végétation forestière proche} {justifie l'installation de grilles pare-feuilles sur les gouttières alu ou zinc|impose des nettoyages réguliers pour éviter l'engorgement des descentes pluviales lors des orages cévenols}.}";
  }

  // Energy/Market templates
  const energyTemplate = "{Dans le Gard, l'isolation thermique sous toiture est {votre meilleure arme contre les factures de climatisation|le poste de travaux le plus rentable pour réduire le DPE}. {En isolant vos rampants de toit ou en optant pour le sarking R=6|L'installation d'une barrière isolante certifiée RGE} {permet d'économiser jusqu'à 35% de climatisation en été|offre un excellent confort d'été en bloquant les vagues de chaleur cévenoles}. {Ces travaux sont éligibles aux aides régionales d'Occitanie|De plus, les aides MaPrimeRénov' et les Certificats d'Économie d'Énergie (CEE) locaux facilitent le financement}.|{Avec les hausses constantes de l'électricité dans le 30|Face à l'augmentation du coût de l'énergie}, {isoler son toit à {VILLE} est un choix stratégique pour valoriser son bien|la rénovation énergétique de la toiture est fortement subventionnée}. {Associer le changement des tuiles à une isolation performante en laine de bois|La pose d'un écran pare-pluie HPV avec isolant à haute densité} {permet d'obtenir une réduction de TVA à 5,5%|permet de passer d'une étiquette DPE F/G à une classification saine et valorisante}.}";

  const realEstateTemplate = "{Réfectionner sa toiture à {VILLE} {constitue un excellent levier de valorisation immobilière|est un argument de vente décisif pour les acquéreurs dans le Gard}. {Un toit en tuiles romanes garanti 10 ans avec facture décennale RGE|Une couverture saine et isolée} {rassure pleinement les acheteurs potentiels et prévient toute négociation à la baisse|évite les décotes sur le prix du m² et assure la longévité de la charpente pour 30 ans}.|{Sur le marché immobilier gardois de {VILLE}|Lors de l'achat d'une villa à {VILLE}}, {l'état de la couverture et de l'isolation est scruté avec attention|le toit est la première ligne de défense de l'habitation}. {Disposer d'un procès-verbal de réception de travaux de couverture|Un entretien régulier avec traitement hydrofuge} {offre une tranquillité d'esprit inégalée et valorise le patrimoine familial|constitue un gage de qualité qui accélère la vente sans intermédiaire}.}";

  // Parsing templates
  const finalTitle = replaceVariables(parseSpintax(slug, 'title', titleTemplate), vars);
  const finalIntro = replaceVariables(parseSpintax(slug, 'intro', introTemplate), vars);
  const finalClimate = replaceVariables(parseSpintax(slug, 'climate', climateTemplate), vars);
  const finalAbf = replaceVariables(parseSpintax(slug, 'abf', abfTemplate), vars);
  const finalHousing = replaceVariables(parseSpintax(slug, 'housing', housingTemplate), vars);
  const finalEnergy = replaceVariables(parseSpintax(slug, 'energy', energyTemplate), vars);
  const finalRealEstate = replaceVariables(parseSpintax(slug, 'realestate', realEstateTemplate), vars);

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    climateContext: finalClimate,
    abfRegulations: finalAbf,
    housingTypologyInsight: finalHousing,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
    faqItems: commune.faq || []
  };
}
