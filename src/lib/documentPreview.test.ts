import { describe, expect, it } from "vitest";
import { getPreviewKind } from "./documentPreview";

describe("document preview formats", () => {
  it.each([
    ["application/pdf", "policy", "pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "policy.docx", "word"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.template", "mall.dotx", "word"],
    ["application/vnd.ms-excel.sheet.macroEnabled.12", "mall.xlsm", "spreadsheet"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "mall.xlsx", "spreadsheet"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation", "office"],
    ["application/msword", "policy.doc", "office"],
    ["image/png", "bild.png", "image"],
    ["text/html", "policy.html", "html"],
    ["video/mp4", "film.mp4", "video"],
    ["application/octet-stream", "mall.DOTX", "word"],
  ])("opens %s (%s) using %s", (mime, name, expected) => {
    expect(getPreviewKind(mime, name)).toBe(expected);
  });
  it("does not claim support for unknown binary files", () => {
    expect(getPreviewKind("application/octet-stream", "archive.zip")).toBe("unsupported");
  });
});