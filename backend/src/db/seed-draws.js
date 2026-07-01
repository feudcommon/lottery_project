.// backend/src/db/seed-draws.js
const db = require('./connection');

const testDraws = [
  { date: '2026-06-30', status: 'completed', winnerId: 123 },
  { date: '2026-07-01', status: 'pending', winnerId: null },
];

testDraws.forEach(draw => {
  db.prepare(`
    INSERT INTO draws (date, status, winner_id)
    VALUES (?, ?, ?)
  `).run(draw.date, draw.status, draw.winnerId);
});

console.log('Test draws created!');