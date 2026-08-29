import type { Comment, Flockdoc } from './types';

export const people = {
  jk: { id: 'jk', name: 'You', initials: 'JK', kind: 'person' as const, color: '#dce5f2' },
  alex: { id: 'alex', name: 'Alex Rivera', initials: 'AR', kind: 'person' as const, color: '#e0bb9a' },
  maya: { id: 'maya', name: 'Maya Chen', initials: 'MC', kind: 'person' as const, color: '#f0c9d8' },
  agent: { id: 'agent', name: 'Flockdoc Agent', initials: 'AI', kind: 'agent' as const, color: '#e4ebf5' },
};

export const initialFlockdocs: Flockdoc[] = [
  { id: 'calendar-2026', name: '2026 Planning Calendar', type: 'spreadsheet', modifiedAt: 'May 12, 2025 · 9:41 AM', collaborators: [people.maya, people.alex, people.agent] },
  { id: 'launch-brief', name: 'Product launch brief', type: 'paper', modifiedAt: 'May 13, 2025 · 2:18 PM', starred: true, collaborators: [people.maya, people.alex, people.agent] },
  { id: 'q3-plan', name: 'Q3 Operating Plan', type: 'spreadsheet', modifiedAt: 'May 9, 2025 · 4:05 PM', collaborators: [people.alex, people.maya] },
  { id: 'research', name: 'Research synthesis', type: 'paper', modifiedAt: 'May 7, 2025 · 11:32 AM', collaborators: [people.alex, people.maya, people.agent] },
];

export const initialComments: Comment[] = [
  {
    id: 'c1', author: people.jk, createdAt: 'May 13, 2:20 PM',
    body: '@Alex can you expand the market opportunity section with the latest research?',
    replies: [{ id: 'c2', author: people.alex, createdAt: 'May 13, 2:27 PM', body: "On it. I’ll add the updated TAM/SAM data and a brief competitive landscape." }],
  },
];
