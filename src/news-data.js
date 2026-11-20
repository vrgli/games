// The VRG news feed: the source of truth for every post, games and apps together.
// Newest first. Each entry: id (stable, never reused), date (YYYY-MM-DD), kind
// ('game' | 'app'), about (name), title, body (paragraphs; blank line splits),
// optional image (path on play.vrg.li), optional url. Add an entry here and ship.
// Entries already posted by hand on the channels carry posted: true, so the
// fan-out job must skip them.
export const NEWS = [
  {
    id: 'nuclear-negotiations-visitors', date: '2026-11-11', kind: 'game', about: 'Nuclear Negotiations', posted: true,
    title: 'Nuclear Negotiations, now with visitors',
    body: `The summit was going too smoothly, so we invited some guests. When an escalation ends, a rogue leader now pulls a SWAP! and changes seats with a calm colleague across the table. Find them again, fast. A gorilla wanders through the room. The lights go out. The paparazzi flash in everyone's faces. None of them changes the rules, only what you can see, which turns out to be enough.

Sometimes aliens land. The game pauses, every leader is beamed up and set back down in a new seat, as a lizard, for four moves. We can neither confirm nor deny anything.

Every event is dealt from the game's seed, so leaderboard runs are still replayed on the server before they count. Play free at play.vrg.li.`,
    url: 'https://play.vrg.li/play/nuclear-negotiations/',
  },
  {
    id: 'nuclear-negotiations-faster', date: '2026-11-03', kind: 'game', about: 'Nuclear Negotiations',
    title: 'Nuclear Negotiations, faster and with a leaderboard',
    body: `Diplomacy now moves at the speed of panic. You get 3 seconds a move to keep the two rogue leaders from facing each other. After six moves it drops to 1 second. Then a third leader goes rogue, cools off, and comes back. Our own tester did not survive the first escalation.

Sign in and your longest run goes on the leaderboard. Every run is replayed on the server before it counts, so the top spot cannot be typed in.

Play free at play.vrg.li.`,
    url: 'https://play.vrg.li/play/nuclear-negotiations/',
  },
  {
    id: 'tariff-wars-bribes', date: '2026-11-02', kind: 'game', about: 'Tariff Wars',
    title: 'Tariff Wars: now with bribes',
    body: `Guessing wrong in Tariff Wars now costs you twice: the deals you miss, and a bribe into the pot. At the end the top three split it: 50%, 30%, 15%. Fourth place gets a lesson. The house keeps 5%, because of course it does.

Tied at the top after the last round? Nobody goes home. The auction plays on, one round at a time, until a single leader stands alone, and whoever sits third can still crash the party.

Also new: pixel-art goods (grain, wine, cars, chips) and clearer round reports. Play at play.vrg.li.`,
    url: 'https://play.vrg.li/play/tariff-wars/',
  },
  {
    id: 'wallop-hello', date: '2026-11-01', kind: 'game', about: 'Wallop',
    title: 'Wallop: pick a side, then throw a punch',
    body: `Wallop is a fight game with a price chart for a referee. Call Bitcoin up or down, and your fighter lands a punch or eats one when the round ends. Quick, loud and a little unfair, like the market.

The price feed is a seeded simulation for now, so nobody's real money is in the ring. Free to play at play.vrg.li, free to copy and remix on GitHub.`,
    url: 'https://play.vrg.li/play/wallop/',
  },
  {
    id: 'quadnav-first-look', date: '2026-11-01', kind: 'app', about: 'QuadNav',
    title: 'QuadNav: keyboard navigation for people who like their mouse',
    body: `QuadNav is a Chrome extension that picks a quarter of the screen first, then labels only what is in it. Left hand on Alt+1, right hand never leaves the mouse. Fewer labels, fewer keystrokes, no hunting for the right two letters.

The first release is in preparation. The code is already public.`,
    url: 'https://github.com/vrgli/quadnav',
  },
];
