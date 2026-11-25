/** Saves a file on the device. The link has to be in the page for some browsers to keep the filename. */
export function downloadFile(file: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** ASCII-only filename: some browsers drop names with umlauts or spaces. */
export function safeFileName(name: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
  return name
    .replace(/[äöüÄÖÜß]/g, (c) => map[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");
}
