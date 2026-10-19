import { describe, expect, it } from "vitest";
import { confirmKbMutation } from "./kbMutation";

describe("knowledge base mutation confirmation", () => {
  it("rejects a failed save instead of reporting publication", async () => {
    await expect(confirmKbMutation(Promise.resolve({ data: null, error: { message: "Permission denied" } }))).rejects.toThrow("Permission denied");
  });
  it("rejects a publication update that changed no accessible row", async () => {
    await expect(confirmKbMutation(Promise.resolve({ data: null, error: null }))).rejects.toThrow();
  });
  it("confirms a persisted video", async () => {
    await expect(confirmKbMutation(Promise.resolve({ data: { id: "video-id" }, error: null }))).resolves.toBeUndefined();
  });
});