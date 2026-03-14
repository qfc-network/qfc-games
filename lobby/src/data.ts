export interface CasinoGame {
  slug: 'crash' | 'dice' | 'roulette'
  emoji: string
  name: string
  desc: string
  accent: string
  status: 'live' | 'staging' | 'coming-soon'
  minBet: string
  maxBet: string
  rtp: string
  href: string
}

export interface PortalGame {
  slug: 'dungeon' | 'cards' | 'pets' | 'office'
  emoji: string
  name: string
  tagline: string
  desc: string
  accent: string
  status: 'live' | 'beta' | 'coming-soon'
  playerCount: number
  genre: string
  href: string
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  game: PortalGame['slug'] | 'platform'
  date: string
  tag: 'update' | 'event' | 'patch' | 'announcement'
}

export interface BetEntry {
  game: CasinoGame['slug']
  label: string
  amount: string
  result: 'win' | 'loss' | 'pending'
  payout: string
  proof: string
  time: string
}

export const portalGames: PortalGame[] = [
  {
    slug: 'dungeon',
    emoji: '🏰',
    name: 'QFC Dungeon',
    tagline: 'Explore. Fight. Loot.',
    desc: 'Roguelike dungeon crawler with on-chain loot drops, permadeath stakes, and procedurally generated floors.',
    accent: '#ff7a59',
    status: 'live',
    playerCount: 1_247,
    genre: 'Roguelike RPG',
    href: '/qfc-dungeon/',
  },
  {
    slug: 'cards',
    emoji: '🃏',
    name: 'QFC Cards',
    tagline: 'Collect. Build. Duel.',
    desc: 'Competitive card battler with NFT-backed decks, ranked ladders, and seasonal tournament circuits.',
    accent: '#6c5ce7',
    status: 'live',
    playerCount: 892,
    genre: 'Card Battler',
    href: '/qfc-cards/',
  },
  {
    slug: 'pets',
    emoji: '🐾',
    name: 'QFC Pets',
    tagline: 'Hatch. Train. Evolve.',
    desc: 'Virtual pet sim where creatures earn tokens through training, breeding chains, and arena competitions.',
    accent: '#2ed573',
    status: 'beta',
    playerCount: 634,
    genre: 'Pet Sim',
    href: '/qfc-pets/',
  },
  {
    slug: 'office',
    emoji: '🏢',
    name: 'QFC Office',
    tagline: 'Manage. Expand. Profit.',
    desc: 'Business tycoon sim with DAO governance mechanics, staff NFTs, and cross-game economy integration.',
    accent: '#feca57',
    status: 'coming-soon',
    playerCount: 0,
    genre: 'Tycoon Sim',
    href: '/qfc-office/',
  },
]

export const newsItems: NewsItem[] = [
  {
    id: 'n1',
    title: 'Dungeon Floor 50 expansion is live',
    summary: 'Five new procedural floor templates, two boss encounters, and rare loot tables added to the deep dungeon. Permadeath stakes now scale with floor depth.',
    game: 'dungeon',
    date: '2026-03-14',
    tag: 'update',
  },
  {
    id: 'n2',
    title: 'Cards Season 3 tournament registration opens',
    summary: 'Ranked ladder resets March 20. Top 128 players qualify for the Season 3 championship bracket with a 50,000 QFC prize pool.',
    game: 'cards',
    date: '2026-03-13',
    tag: 'event',
  },
  {
    id: 'n3',
    title: 'Pets breeding v2 patch notes',
    summary: 'Trait inheritance reworked for fairer outcomes. New elemental affinities added. Arena matchmaking now considers creature level brackets.',
    game: 'pets',
    date: '2026-03-12',
    tag: 'patch',
  },
  {
    id: 'n4',
    title: 'Office early access announced',
    summary: 'QFC Office enters closed beta in April. Whitelist applications open now. DAO governance module preview available on testnet.',
    game: 'office',
    date: '2026-03-11',
    tag: 'announcement',
  },
  {
    id: 'n5',
    title: 'Cross-game wallet session v2 deployed',
    summary: 'Single sign-on now persists across all four games. Token balances sync in real-time. Gas sponsorship active on testnet.',
    game: 'platform',
    date: '2026-03-10',
    tag: 'update',
  },
  {
    id: 'n6',
    title: 'Dungeon x Cards crossover event',
    summary: 'Defeat the Card Golem boss in Dungeon floors 30-40 to earn exclusive dual-game NFT rewards usable in both titles.',
    game: 'dungeon',
    date: '2026-03-09',
    tag: 'event',
  },
]

export const casinoGames: CasinoGame[] = [
  {
    slug: 'crash',
    emoji: '📈',
    name: 'Crash',
    desc: 'Cash out before the curve busts. Supports auto cashout presets and provable round proofs.',
    accent: '#ff7a59',
    status: 'staging',
    minBet: '1 QFC',
    maxBet: '500 QFC',
    rtp: '99.0%',
    href: '#/games/crash',
  },
  {
    slug: 'dice',
    emoji: '🎲',
    name: 'Dice',
    desc: 'Fast over/under betting with clear odds bands, instant settlement, and fairness proof payloads.',
    accent: '#6c5ce7',
    status: 'live',
    minBet: '0.5 QFC',
    maxBet: '300 QFC',
    rtp: '98.7%',
    href: '#/games/dice',
  },
  {
    slug: 'roulette',
    emoji: '🎡',
    name: 'Roulette',
    desc: 'Color, parity, high-low, and straight bets with auditable spin seeds for every round.',
    accent: '#2ed573',
    status: 'staging',
    minBet: '1 QFC',
    maxBet: '200 QFC',
    rtp: '97.3%',
    href: '#/games/roulette',
  },
]

export const recentBets: BetEntry[] = [
  {
    game: 'dice',
    label: 'Roll under 52.50',
    amount: '12 QFC',
    result: 'win',
    payout: '+10.8 QFC',
    proof: 'dice:8c21…f31d',
    time: '2m ago',
  },
  {
    game: 'crash',
    label: 'Auto cashout @ 1.80x',
    amount: '20 QFC',
    result: 'pending',
    payout: 'Settling',
    proof: 'round:1ab2…de90',
    time: '6m ago',
  },
  {
    game: 'roulette',
    label: 'Red + High',
    amount: '8 QFC',
    result: 'loss',
    payout: '-8 QFC',
    proof: 'spin:77aa…120e',
    time: '14m ago',
  },
  {
    game: 'dice',
    label: 'Roll over 73.00',
    amount: '5 QFC',
    result: 'win',
    payout: '+13.5 QFC',
    proof: 'dice:98fe…aa10',
    time: '22m ago',
  },
]

export const riskLimits = {
  perBet: '500 QFC',
  dailyLoss: '2,500 QFC',
  sessionTimeout: '30m idle auto-lock',
  throttle: '5 bet actions / 10s',
}

export const walletSummary = {
  balance: '12,480 QFC',
  available: '11,920 QFC',
  pending: '560 QFC',
}

export const gameStats = {
  dungeon: { played: 47, wins: 31, hours: 62, topFloor: 38 },
  cards: { played: 124, wins: 71, hours: 89, rank: 'Gold II' },
  pets: { played: 23, wins: 15, hours: 34, creatures: 8 },
  office: { played: 0, wins: 0, hours: 0, rank: 'N/A' },
}
