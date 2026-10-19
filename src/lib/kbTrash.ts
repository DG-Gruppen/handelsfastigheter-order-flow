export const KB_TRASH_RETENTION_DAYS = 10;

export function canRestoreKbTrash(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() > now;
}