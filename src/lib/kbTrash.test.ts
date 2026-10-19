import { describe, expect, it } from "vitest";
import { canRestoreKbTrash, KB_TRASH_RETENTION_DAYS } from "./kbTrash";

describe("knowledge-base trash retention", () => {
  const deletedAt = Date.parse("2026-10-19T09:00:00Z");
  const expiresAt = "2026-10-29T09:00:00Z";
  it("retains content for ten days", () => {
    expect(KB_TRASH_RETENTION_DAYS).toBe(10);
    expect(Date.parse(expiresAt) - deletedAt).toBe(KB_TRASH_RETENTION_DAYS * 86400000);
  });
  it("allows recovery before ten days elapse", () => {
    expect(canRestoreKbTrash(expiresAt, Date.parse(expiresAt) - 1)).toBe(true);
  });
  it("refuses recovery at and after the ten-day deadline", () => {
    expect(canRestoreKbTrash(expiresAt, Date.parse(expiresAt))).toBe(false);
    expect(canRestoreKbTrash(expiresAt, Date.parse(expiresAt) + 1)).toBe(false);
  });
});