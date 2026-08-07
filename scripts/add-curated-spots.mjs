#!/usr/bin/env node
/**
 * One-shot: merge cafes→food, add hotels category, append curated spots.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const categoriesFile = JSON.parse(readFileSync(join(DATA, 'categories.json'), 'utf8'));
const spotsFile = JSON.parse(readFileSync(join(DATA, 'bali-spots.json'), 'utf8'));

// --- categories: drop cafes, expand food, add hotels ---
categoriesFile.categories = categoriesFile.categories
  .filter((c) => c.id !== 'cafes')
  .map((c) =>
    c.id === 'food'
      ? {
          ...c,
          label: 'Food',
          description: 'Warungs, cafés, bakeries and places worth planning a meal around.',
        }
      : c,
  );

if (!categoriesFile.categories.some((c) => c.id === 'hotels')) {
  categoriesFile.categories.push({
    id: 'hotels',
    label: 'Hotels',
    icon: 'bed',
    color: '#8B6F5C',
    description: 'Boutique cabins, villas and resorts worth a night or a look.',
  });
}

categoriesFile.onboardingInterests = categoriesFile.onboardingInterests
  .filter((i) => i.id !== 'cafes')
  .map((i) =>
    i.id === 'food'
      ? { ...i, label: 'Food', matchesCategories: ['food'] }
      : i,
  );

if (!categoriesFile.onboardingInterests.some((i) => i.id === 'hotels')) {
  const wellnessIdx = categoriesFile.onboardingInterests.findIndex((i) => i.id === 'wellness');
  const hotelInterest = {
    id: 'hotels',
    label: 'Hotels',
    matchesCategories: ['hotels'],
    matchesTags: [],
  };
  if (wellnessIdx >= 0) {
    categoriesFile.onboardingInterests.splice(wellnessIdx, 0, hotelInterest);
  } else {
    categoriesFile.onboardingInterests.push(hotelInterest);
  }
}

categoriesFile._meta.lastUpdated = '2026-08-06';

// --- spots: reassign cafes → food ---
for (const spot of spotsFile.spots) {
  if (spot.category === 'cafes') spot.category = 'food';
}

const existingIds = new Set(spotsFile.spots.map((s) => s.id));

/** @type {import('../src/data/types.ts').Spot[]} */
const additions = [
  {
    id: 'batur-natural-hot-spring',
    name: 'Batur Natural Hot Spring',
    description: 'Volcanic spring pools under Mount Batur, steaming at dusk.',
    longDescription:
      'Natural hot spring pools on the shore of Lake Batur, fed by volcanic rock and popular for a soak after a sunrise trek. The water is mineral-rich and genuinely hot; come late afternoon when the mountain turns pink and the day-trippers thin out.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.25131,115.40027',
    visited: false,
    rating: 4.2,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'wellness',
    region: 'north',
    coordinates: { lat: -8.25131, lng: 115.40027 },
    images: ['/images/spots/batur-natural-hot-spring.jpg'],
    openingHours: { open: '08:00', close: '19:00', note: 'Daily; last entry earlier' },
    visitDurationMin: 90,
    cost: {
      currency: 'IDR',
      min: 100000,
      max: 250000,
      note: 'Entry; private pool upgrades cost more',
    },
    bestTime: '16:00–18:30',
    tips: [
      'Pair it with a Batur sunrise trek — the soak lands perfectly after the descent.',
      'Bring a dry bag; the changing rooms get damp and crowded.',
      'Lake views are better from the upper terraces — ask which pool faces west.',
    ],
    nearby: ['ulun-danu-beratan', 'inap-retreat-boutique-cabin', 'akasa-batur'],
    ferry: null,
  },
  {
    id: 'akasa-batur',
    name: 'AKASA',
    description: 'Lake-view coffee stop above Batur with slow, careful pours.',
    longDescription:
      'A small coffee shop in Central Batur aimed at people who want a proper cup between volcano plans — clean space, lake glimpses, and espresso that is not an afterthought. Easy to combine with hot springs or a cabin stay nearby.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.279617,115.357559',
    visited: false,
    rating: 4.5,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'north',
    coordinates: { lat: -8.279617, lng: 115.357559 },
    images: ['/images/spots/akasa-batur.jpg'],
    openingHours: { open: '08:00', close: '18:00', note: 'Daily' },
    visitDurationMin: 45,
    cost: {
      currency: 'IDR',
      min: 35000,
      max: 120000,
      note: 'Coffee and light bites',
    },
    bestTime: '09:00–11:00',
    tips: [
      'Good recovery stop after Batur sunrise — caffeine before the drive south.',
      'Ask what single-origin they are pouring that week.',
      'Parking is tight when trek vans unload; scooters are easier.',
    ],
    nearby: ['batur-natural-hot-spring', 'inap-retreat-boutique-cabin', 'ulun-danu-beratan'],
    ferry: null,
  },
  {
    id: 'pura-taman-kemuda-saraswati',
    name: 'Pura Taman Kemuda Saraswati',
    description: 'Ubud water temple of lotus ponds and carved stone gates.',
    longDescription:
      'Also called the Ubud Water Palace — a temple complex dedicated to Saraswati, goddess of knowledge, set around lotus ponds and a stage for evening dance. The carved gates and reflections are the draw; it sits a short walk from the main Ubud market.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.506062,115.261062',
    visited: false,
    rating: 4.2,
    distanceFromStayKm: 0,
    tags: ['Cultural', 'Memorable'],
    category: 'temples',
    region: 'ubud',
    coordinates: { lat: -8.506062, lng: 115.261062 },
    images: ['/images/spots/pura-taman-kemuda-saraswati.jpg'],
    openingHours: { open: '07:00', close: '18:00', note: 'Daily; sarong required' },
    visitDurationMin: 45,
    cost: {
      currency: 'IDR',
      min: 0,
      max: 50000,
      note: 'Donation / sarong rental typical',
    },
    bestTime: '07:30–09:00',
    tips: [
      'Lotus blooms are fuller in the morning light before tour groups pack the paths.',
      'Evening Legong performances happen on the stage — check the board out front.',
      'Combine with a coffee on Jalan Kajeng rather than fighting central Ubud parking twice.',
    ],
    nearby: ['sacred-monkey-forest', 'seniman-coffee-studio', 'campuhan-ridge-walk'],
    ferry: null,
  },
  {
    id: 'inap-retreat-boutique-cabin',
    name: 'Inap Retreat Boutique Cabin',
    description: 'Quiet boutique cabins above Lake Batur with volcano air.',
    longDescription:
      'A small cabin retreat in Central Batur built for slow nights — simple rooms, cool highland air, and easy access to sunrise treks and hot springs. It is a base more than a resort, which is the point if you want stars instead of Seminyak traffic.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.256187,115.398188',
    visited: false,
    rating: 5.0,
    distanceFromStayKm: 0,
    tags: ['Memorable', 'Outworldly'],
    category: 'hotels',
    region: 'north',
    coordinates: { lat: -8.256187, lng: 115.398188 },
    images: ['/images/spots/inap-retreat-boutique-cabin.jpg'],
    openingHours: { note: 'Check-in by arrangement' },
    visitDurationMin: 720,
    cost: {
      currency: 'IDR',
      min: 800000,
      max: 2500000,
      note: 'Per night; rates vary by season',
    },
    bestTime: 'Overnight',
    tips: [
      'Book a Batur sunrise package the night before — pickups start absurdly early.',
      'Nights are cold for Bali; bring a layer even in dry season.',
      'Pair with AKASA for coffee and the hot spring for the evening soak.',
    ],
    nearby: ['batur-natural-hot-spring', 'akasa-batur', 'ulun-danu-beratan'],
    ferry: null,
  },
  {
    id: 'villa-bukit-temawang',
    name: 'Villa Bukit Temawang',
    description: 'Hill villa stay near Karangasem with Agung-facing quiet.',
    longDescription:
      'A villa perch in Pering Sari aimed at travelers who want East Bali space — rice and mountain air, room to spread out, and a base for Tirta Gangga or Amed without sleeping in the tourist crush. Best as a multi-night stay rather than a day visit.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.430563,115.465188',
    visited: false,
    rating: 4.8,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'hotels',
    region: 'east',
    coordinates: { lat: -8.430563, lng: 115.465188 },
    images: ['/images/spots/villa-bukit-temawang.jpg'],
    openingHours: { note: 'Check-in by arrangement' },
    visitDurationMin: 720,
    cost: {
      currency: 'IDR',
      min: 1500000,
      max: 5000000,
      note: 'Per night; villa rates vary',
    },
    bestTime: 'Overnight',
    tips: [
      'Use it as a hub for Tirta Gangga, Taman Ujung and the Amed coast.',
      'Roads east get quiet after dark — arrive before sunset on the first night.',
      'Ask about driver day rates; scooters are steep on the Karangasem hills.',
    ],
    nearby: ['tirta-gangga', 'taman-ujung', 'sidemen-valley'],
    ferry: null,
  },
  {
    id: 'padma-resort-ubud',
    name: 'Padma Resort Ubud',
    description: 'Five-star jungle resort in Puhu with river-valley drama.',
    longDescription:
      'A large upscale resort set above the river valley in Puhu — pools, spa and the kind of polished Ubud stay people mean when they say “treat yourself.” Useful even as a day visitor for lunch with a view if you are not overnighting.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.383438,115.274563',
    visited: false,
    rating: 4.8,
    distanceFromStayKm: 0,
    tags: ['Must Visit', 'Memorable'],
    category: 'hotels',
    region: 'ubud',
    coordinates: { lat: -8.383438, lng: 115.274563 },
    images: ['/images/spots/padma-resort-ubud.jpg'],
    openingHours: { note: 'Hotel; day guests by reservation' },
    visitDurationMin: 720,
    cost: {
      currency: 'IDR',
      min: 3500000,
      max: 12000000,
      note: 'Per night; 5-star resort pricing',
    },
    bestTime: 'Overnight',
    tips: [
      'Valley-facing rooms earn the premium — confirm the view when you book.',
      'Spa slots fill on weekends; reserve before you land.',
      'The drive from central Ubud is short but winding; leave buffer for dinner plans.',
    ],
    nearby: ['tegallalang-rice-terrace', 'rumah-subak', 'gunung-kawi'],
    ferry: null,
  },
  {
    id: 'rumah-subak',
    name: 'Rumah Subak',
    description: 'Rice-field stay in Tampaksiring with slow subak mornings.',
    longDescription:
      'A stay wrapped in working rice landscape near Tampaksiring — closer to Tirta Empul and Gunung Kawi than to central Ubud chaos. Built for people who want frogs at night and mist at breakfast more than a shopping street.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.441813,115.314063',
    visited: false,
    rating: 4.6,
    distanceFromStayKm: 0,
    tags: ['Memorable', 'Outworldly'],
    category: 'hotels',
    region: 'ubud',
    coordinates: { lat: -8.441813, lng: 115.314063 },
    images: ['/images/spots/rumah-subak.jpg'],
    openingHours: { note: 'Check-in by arrangement' },
    visitDurationMin: 720,
    cost: {
      currency: 'IDR',
      min: 900000,
      max: 3000000,
      note: 'Per night; rates vary',
    },
    bestTime: 'Overnight',
    tips: [
      'Sunrise over the paddies is the whole argument for staying — set an alarm.',
      'Easy hop to Tirta Empul before the buses; go straight from breakfast.',
      'Mosquitoes love subak edges — repellent for the evening walk.',
    ],
    nearby: ['tirta-empul', 'gunung-kawi', 'tegallalang-rice-terrace'],
    ferry: null,
  },
  {
    id: 'warung-betutu-dewi-sri',
    name: 'Warung Betutu Dewi Sri',
    description: 'Slow-cooked Balinese betutu chicken in Beraban village.',
    longDescription:
      'A Tanah Lot–area warung known for betutu — chicken or duck cooked in spices until it falls apart. It is a proper local lunch stop rather than a beach-club meal; go hungry and order ahead if you can, because the good stuff takes time.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.609813,115.112563',
    visited: false,
    rating: 4.7,
    distanceFromStayKm: 0,
    tags: ['Must Visit', 'Memorable'],
    category: 'food',
    region: 'west',
    coordinates: { lat: -8.609813, lng: 115.112563 },
    images: ['/images/spots/warung-betutu-dewi-sri.jpg'],
    openingHours: { open: '10:00', close: '18:00', note: 'Often sells out; confirm hours' },
    visitDurationMin: 60,
    cost: {
      currency: 'IDR',
      min: 50000,
      max: 150000,
      note: 'Per portion; betutu is the point',
    },
    bestTime: '11:30–13:30',
    tips: [
      'Betutu can sell out — call or arrive early for lunch.',
      'Easy pairing with Tanah Lot if you time the temple for late afternoon.',
      'Order the sambal on the side if you are spice-shy; it arrives serious.',
    ],
    nearby: ['tanah-lot', 'jatiluwih-rice-terraces', 'pura-taman-ayun'],
    ferry: null,
  },
  {
    id: 'roti-bohemia-nyuh-kuning',
    name: 'Roti Bohemia Nyuh Kuning',
    description: 'Artisan bakery in Nyuh Kuning with serious sourdough.',
    longDescription:
      'A beloved Ubud-side bakery in Nyuh Kuning — proper bread, pastries and the kind of coffee line that forms for a reason. Ideal before Monkey Forest or as a picnic supply run for a ridge walk.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.519562,115.257688',
    visited: false,
    rating: 4.7,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'ubud',
    coordinates: { lat: -8.519562, lng: 115.257688 },
    images: ['/images/spots/roti-bohemia-nyuh-kuning.jpg'],
    openingHours: { open: '07:00', close: '18:00', note: 'Daily; popular items go early' },
    visitDurationMin: 30,
    cost: {
      currency: 'IDR',
      min: 40000,
      max: 150000,
      note: 'Bakery items and coffee',
    },
    bestTime: '07:30–09:30',
    tips: [
      'Croissants and loaves vanish mid-morning — go early.',
      'Nyuh Kuning parking is calmer than central Ubud; walk to Monkey Forest after.',
      'Grab a sandwich for Campuhan if you are heading to the ridge.',
    ],
    nearby: ['sacred-monkey-forest', 'seniman-coffee-studio', 'tukies-coconut-shop'],
    ferry: null,
  },
  {
    id: 'tukies-coconut-shop',
    name: "Tukie's Coconut Shop",
    description: 'Everything coconut — sweets, drinks and Ubud snack runs.',
    longDescription:
      'A coconut-obsessed shop in Ubud for drinks, sweets and edible souvenirs that actually taste like the fruit. Useful as a quick sweet stop between temples or a gift run before the airport.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.507562,115.264187',
    visited: false,
    rating: 4.7,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'ubud',
    coordinates: { lat: -8.507562, lng: 115.264187 },
    images: ['/images/spots/tukies-coconut-shop.jpg'],
    openingHours: { open: '09:00', close: '21:00', note: 'Daily' },
    visitDurationMin: 30,
    cost: {
      currency: 'IDR',
      min: 25000,
      max: 150000,
      note: 'Drinks, sweets, packaged gifts',
    },
    bestTime: '14:00–16:00',
    tips: [
      'Packaged coconut sweets survive suitcase heat better than soft cakes.',
      'Combine with a walk past the Saraswati lotus ponds nearby.',
      'Card readers sometimes flake — keep cash for small orders.',
    ],
    nearby: ['pura-taman-kemuda-saraswati', 'seniman-coffee-studio', 'la-baracca-ubud'],
    ferry: null,
  },
  {
    id: 'sate-pepes-bu-ribu',
    name: 'Sate Pepes Sop Ikan Marlin Bu Ribu',
    description: 'Marlin soup, sate and pepes on the Manggis coast road.',
    longDescription:
      'A no-frills seafood warung in Sengkidu known for marlin soup, sate and pepes — the kind of place drivers recommend when you ask where they eat. Expect plastic chairs, serious spice and fish that was swimming nearby.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.502512,115.550172',
    visited: false,
    rating: 4.5,
    distanceFromStayKm: 0,
    tags: ['Memorable', 'Cultural'],
    category: 'food',
    region: 'east',
    coordinates: { lat: -8.502512, lng: 115.550172 },
    images: ['/images/spots/sate-pepes-bu-ribu.jpg'],
    openingHours: { open: '10:00', close: '21:00', note: 'Daily; fish depends on catch' },
    visitDurationMin: 60,
    cost: {
      currency: 'IDR',
      min: 40000,
      max: 150000,
      note: 'Per person; seafood priced by portion',
    },
    bestTime: '12:00–14:00',
    tips: [
      'Order the marlin soup first — that is the reputation.',
      'Handy lunch on a Candidasa / Manggis coastal drive.',
      'Spice levels are local; ask for kurang pedas if needed.',
    ],
    nearby: ['taman-ujung', 'tirta-gangga', 'virgin-beach'],
    ferry: null,
  },
  {
    id: 'warung-mak-beng',
    name: 'Warung Mak Beng',
    description: 'Sanur institution for fried fish and house sambal.',
    longDescription:
      'A Sanur classic — simple fried fish, rice and a house sambal people drive across town for. It is not pretty and it does not need to be; go for lunch, eat with your hands if you want, leave smelling like the grill.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.673687,115.262938',
    visited: false,
    rating: 4.6,
    distanceFromStayKm: 0,
    tags: ['Must Visit', 'Memorable'],
    category: 'food',
    region: 'south',
    coordinates: { lat: -8.673687, lng: 115.262938 },
    images: ['/images/spots/warung-mak-beng.jpg'],
    openingHours: { open: '08:00', close: '18:00', note: 'Daily; peak at lunch' },
    visitDurationMin: 45,
    cost: {
      currency: 'IDR',
      min: 40000,
      max: 100000,
      note: 'Set fish meals',
    },
    bestTime: '11:30–13:00',
    tips: [
      'The set meal is the move — do not overthink the menu.',
      'Queues move fast; scooters park in the lane with everyone else.',
      'Walk off lunch on the Sanur beach path afterward.',
    ],
    nearby: ['sanur-beach-walk', 'lolas-sanur', 'daily-baguette-sanur'],
    ferry: null,
  },
  {
    id: 'lolas-sanur',
    name: "Lola's Tap Craft Beer Bar",
    description: 'Craft beer taproom in Sanur with a serious local following.',
    longDescription:
      'A craft-beer focused bar in Sanur — rotating taps, a crowd that actually cares about what is pouring, and a calmer night out than Canggu club circuits. Good after a beach walk when you want hops instead of another Bintang.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.693688,115.263562',
    visited: false,
    rating: 4.9,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'south',
    coordinates: { lat: -8.693688, lng: 115.263562 },
    images: ['/images/spots/lolas-sanur.jpg'],
    openingHours: { open: '16:00', close: '00:00', note: 'Evenings; confirm kitchen hours' },
    visitDurationMin: 90,
    cost: {
      currency: 'IDR',
      min: 70000,
      max: 250000,
      note: 'Craft pours and bar snacks',
    },
    bestTime: '17:30–21:00',
    tips: [
      'Ask what is on tap that week — the board changes.',
      'Pair with a Sanur sunset walk before you settle in.',
      'Busy on weekends; arrive early for seats outdoors.',
    ],
    nearby: ['sanur-beach-walk', 'warung-mak-beng', 'daily-baguette-sanur'],
    ferry: null,
  },
  {
    id: 'daily-baguette-sanur',
    name: 'Daily Baguette Sanur',
    description: 'Neighbourhood bakery in Sanur for bread and breakfast.',
    longDescription:
      'A Sanur bakery doing baguettes, pastries and easy breakfast plates — useful when you want something European and reliable before a ferry or a beach morning. Grab coffee, sit a while, then walk toward the promenade.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.703187,115.261062',
    visited: false,
    rating: 4.6,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'south',
    coordinates: { lat: -8.703187, lng: 115.261062 },
    images: ['/images/spots/daily-baguette-sanur.jpg'],
    openingHours: { open: '07:00', close: '19:00', note: 'Daily' },
    visitDurationMin: 40,
    cost: {
      currency: 'IDR',
      min: 35000,
      max: 120000,
      note: 'Bakery and light meals',
    },
    bestTime: '07:30–09:30',
    tips: [
      'Baguettes for picnic lunches on the beach walk sell well by mid-morning.',
      'Easy breakfast before a Nusa Penida boat day from Sanur harbour.',
      'Indoor seating helps when the afternoon rain hits.',
    ],
    nearby: ['sanur-beach-walk', 'warung-mak-beng', 'lolas-sanur'],
    ferry: null,
  },
  {
    id: 'la-baracca-ubud',
    name: "La Baracca Bali (Ubud)",
    description: 'Italian trattoria energy in central Ubud, reliably packed.',
    longDescription:
      'A long-running Italian spot in Ubud for pasta, pizza and a lively room — not a secret, just a place that still delivers when you want a non-warung dinner. Book ahead on weekends or take the wait.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-8.503812,115.263562',
    visited: false,
    rating: 4.7,
    distanceFromStayKm: 0,
    tags: ['Memorable'],
    category: 'food',
    region: 'ubud',
    coordinates: { lat: -8.503812, lng: 115.263562 },
    images: ['/images/spots/la-baracca-ubud.jpg'],
    openingHours: { open: '12:00', close: '23:00', note: 'Daily; dinner rush' },
    visitDurationMin: 90,
    cost: {
      currency: 'IDR',
      min: 120000,
      max: 400000,
      note: 'Mains and wine; mid-range Italian',
    },
    bestTime: '18:30–20:30',
    tips: [
      'Weekend dinners need a booking — walk-ins wait.',
      'Split a pasta and a pizza; portions are generous.',
      'Walkable from central Ubud hotels; skip the scooter hunt.',
    ],
    nearby: ['pura-taman-kemuda-saraswati', 'seniman-coffee-studio', 'tukies-coconut-shop'],
    ferry: null,
  },
];

for (const spot of additions) {
  if (existingIds.has(spot.id)) {
    console.warn(`skip existing ${spot.id}`);
    continue;
  }
  // description length check
  const len = spot.description.length;
  if (len < 50 || len > 80) {
    console.warn(`WARN ${spot.id} description length ${len}`);
  }
  spotsFile.spots.push(spot);
  existingIds.add(spot.id);
}

// Patch nearby arrays on a few existing spots to include new ones (light touch)
const patchNearby = (id, extras) => {
  const spot = spotsFile.spots.find((s) => s.id === id);
  if (!spot) return;
  for (const extra of extras) {
    if (existingIds.has(extra) && !spot.nearby.includes(extra)) {
      spot.nearby = [...spot.nearby.slice(0, 2), extra].slice(0, 3);
    }
  }
};
patchNearby('tanah-lot', ['warung-betutu-dewi-sri']);
patchNearby('sanur-beach-walk', ['warung-mak-beng', 'lolas-sanur']);
patchNearby('sacred-monkey-forest', ['roti-bohemia-nyuh-kuning']);
patchNearby('tirta-empul', ['rumah-subak']);

spotsFile._meta.count = spotsFile.spots.length;
spotsFile._meta.lastUpdated = '2026-08-06';

writeFileSync(join(DATA, 'categories.json'), `${JSON.stringify(categoriesFile, null, 2)}\n`);
writeFileSync(join(DATA, 'bali-spots.json'), `${JSON.stringify(spotsFile, null, 2)}\n`);
console.log(`categories updated; spots count ${spotsFile.spots.length}`);
