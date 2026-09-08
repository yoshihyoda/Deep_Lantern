import data from './generated/sources.json';
import type { SourceRef } from './types';
export const sources = data as SourceRef[];
export const sourceById = (id: string) => sources.find((s) => s.id === id);
export function validSourceIds(ids: string[]) {
  return ids.every((id) => Boolean(sourceById(id)));
}
