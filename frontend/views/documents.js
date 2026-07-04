(function () {
  const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
  const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
  const ACCEPTED_UPLOAD_TYPES = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

  function dataUrlMime(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;,]+)/);
    return match?.[1] || "";
  }

  function inferFileType(file) {
    const explicit = file.type || file.fileType || "";
    if (explicit) return explicit;
    const fromData = dataUrlMime(file.dataUrl);
    if (fromData) return fromData;
    const name = file.name || file.fileName || "";
    if (/\.pdf$/i.test(name)) return "application/pdf";
    if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return "image/*";
    if (/\.(mp4|mov|webm)$/i.test(name)) return "video/*";
    if (/\.(mp3|wav|m4a)$/i.test(name)) return "audio/*";
    if (/\.(docx?|xlsx?|pptx?)$/i.test(name)) return "application/vnd.openxmlformats-officedocument";
    return "";
  }

  function isOfficeFile(type, name) {
    return /word|excel|powerpoint|officedocument|msword|ms-excel|ms-powerpoint/i.test(type || "")
      || /\.(docx?|xlsx?|pptx?)$/i.test(name || "");
  }

  function attachmentTypeLabel(file) {
    const type = inferFileType(file);
    const name = file.name || file.fileName || "";
    if (type.startsWith("image/")) return "Image";
    if (type === "application/pdf") return "PDF";
    if (isOfficeFile(type, name)) return "Document Office";
    if (type.startsWith("video/")) return "Video";
    if (type.startsWith("audio/")) return "Audio";
    return type || "Fichier";
  }

  window.ClimaParcDocumentsView = {
    limits: {
      documentMaxBytes: DOCUMENT_MAX_BYTES,
      attachmentMaxBytes: ATTACHMENT_MAX_BYTES,
      acceptedUploadTypes: ACCEPTED_UPLOAD_TYPES
    },
    attachmentTypeLabel,
    dataUrlMime,
    inferFileType,
    isOfficeFile
  };
})();
