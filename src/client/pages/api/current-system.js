// API route to get current system and nearby systems with distances
// This is a stub. Replace with real data from your backend/game state as needed.
export default function handler(req, res) {
  // Example: get current system from session, socket, or game state
  // Here we use a static example for demonstration
  const currentSystem = {
    name: 'Sol',
    id: 1,
    coords: [0, 0, 0]
  }
  // Example nearby systems (replace with real data)
  const nearby = [
    { name: 'Alpha Centauri', distance: 4.37 },
    { name: "Barnard's Star", distance: 5.96 },
    { name: 'Wolf 359', distance: 7.78 },
    { name: 'Sirius', distance: 8.60 },
    { name: 'Luyten 726-8', distance: 8.73 },
    { name: 'Ross 154', distance: 9.68 },
    { name: 'Ross 248', distance: 10.32 },
    { name: 'Epsilon Eridani', distance: 10.52 },
    { name: 'Lacaille 9352', distance: 10.74 },
    { name: 'Ross 128', distance: 11.03 },
    { name: 'EZ Aquarii', distance: 11.11 },
    { name: 'Procyon', distance: 11.46 },
    { name: '61 Cygni', distance: 11.41 },
    { name: 'Struve 2398', distance: 11.52 },
    { name: 'Groombridge 34', distance: 11.62 },
    { name: 'Epsilon Indi', distance: 11.82 },
    { name: 'Tau Ceti', distance: 11.89 },
    { name: 'YZ Ceti', distance: 12.11 },
    { name: 'Luyten’s Star', distance: 12.36 },
    { name: 'Teegarden’s Star', distance: 12.58 },
    { name: 'Kapteyn’s Star', distance: 12.76 },
    { name: 'Kruger 60', distance: 13.15 },
    { name: 'GJ 1061', distance: 12.03 },
    { name: 'DX Cancri', distance: 11.82 }
  ].sort((a, b) => a.distance - b.distance).slice(0, 20)
  res.status(200).json({ currentSystem, nearby })
}
