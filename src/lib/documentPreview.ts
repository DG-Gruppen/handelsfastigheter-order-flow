export type PreviewKind = "pdf" | "word" | "spreadsheet" | "office" | "image" | "html" | "text" | "video" | "audio" | "unsupported";

export function getPreviewKind(mime: string, name = ""): PreviewKind {
  const type = mime.toLowerCase().split(";")[0].trim();
  const ext = name.toLowerCase().split(".").pop();
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (/wordprocessingml\.(document|template)$/.test(type) || ["docx", "dotx"].includes(ext ?? "")) return "word";
  if (/spreadsheet|ms-excel|excel/.test(type) || ["xlsx", "xls", "xlsm", "xltx", "xltm", "csv"].includes(ext ?? "")) return "spreadsheet";
  if (/presentation|powerpoint|msword/.test(type) || ["doc", "dot", "ppt", "pptx", "potx", "ppsx"].includes(ext ?? "")) return "office";
  if (type.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext ?? "")) return "video";
  if (type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(ext ?? "")) return "audio";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext ?? "")) return "image";
  if (type === "text/html" || ["html", "htm"].includes(ext ?? "")) return "html";
  if (type.startsWith("text/") || ["txt", "md", "json", "xml"].includes(ext ?? "")) return "text";
  return "unsupported";
}