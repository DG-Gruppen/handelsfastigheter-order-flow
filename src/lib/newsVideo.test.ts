import { describe, expect, it } from "vitest";
import { validateNewsVideo, NEWS_VIDEO_MAX_BYTES } from "./newsVideo";

describe("MP4 news attachments", () => {
  it("accepts MP4 videos", () => {
    expect(validateNewsVideo({ name: "Thomas.MP4", type: "video/mp4", size: 1024 })).toBeNull();
  });
  it("rejects other formats even with an MP4 MIME type", () => {
    expect(validateNewsVideo({ name: "video.mov", type: "video/mp4", size: 1024 })).not.toBeNull();
  });
  it("enforces the storage limit", () => {
    expect(NEWS_VIDEO_MAX_BYTES).toBe(524288000);
    expect(validateNewsVideo({ name: "video.mp4", type: "video/mp4", size: 524288000 })).toBeNull();
    expect(validateNewsVideo({ name: "video.mp4", type: "video/mp4", size: 524288001 })).not.toBeNull();
  });
  it("rejects empty videos", () => {
    expect(validateNewsVideo({ name: "video.mp4", type: "video/mp4", size: 0 })).not.toBeNull();
  });
});