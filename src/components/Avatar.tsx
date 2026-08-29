import { Bot } from 'lucide-react';
import type { Collaborator } from '../types';

export function Avatar({ person, small = false }: { person: Collaborator; small?: boolean }) {
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ background: person.color }} title={person.name}>{person.kind === 'agent' ? <Bot size={small ? 14 : 16} /> : person.initials}</span>;
}
