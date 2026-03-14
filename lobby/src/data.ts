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

export interface BetEntry {
  game: CasinoGame['slug']
  label: string
  amount: string
  result: 'win' | 'loss' | 'pending'
  payout: string
  proof: string
  time: string
}

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
