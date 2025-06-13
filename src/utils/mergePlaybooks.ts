import type { Playbook } from '../interfaces/playbook';

/**
 * Merge two playbook arrays by id, preferring the most recently updated (by updatedAt).
 */
export function mergePlaybooks(local: Playbook[], remote: Playbook[]): Playbook[] {
  const map = new Map<string, Playbook>();
  for (const pb of local) {
    map.set(pb.id, pb);
  }
  for (const pb of remote) {
    const existing = map.get(pb.id);
    if (!existing) {
      map.set(pb.id, pb);
    } else {
      const localDate = new Date(existing.updatedAt || 0).getTime();
      const remoteDate = new Date(pb.updatedAt || 0).getTime();
      if (localDate > remoteDate) {
        map.set(pb.id, existing);
      } else if (remoteDate > localDate) {
        map.set(pb.id, pb);
      } else {
        // If timestamps are equal, prefer higher progress
        const localProgress = typeof existing.progress === 'number' ? existing.progress : 0;
        const remoteProgress = typeof pb.progress === 'number' ? pb.progress : 0;
        map.set(pb.id, localProgress >= remoteProgress ? existing : pb);
      }
    }
  }
  return Array.from(map.values());
}
