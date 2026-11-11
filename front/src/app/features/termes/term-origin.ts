// Page d'UE ou de cours depuis laquelle un terme est créé.
export interface TermOrigin {
  ueCode: string;
  courseId?: number;
  // Complément de « Rattacher à … ».
  label: string;
}

const UE_OR_COURSE_URL = /^\/ue\/([^/?#]+)(?:\/cours\/(\d+))?/;

export function originFromUrl(url: string): TermOrigin | null {
  const match = UE_OR_COURSE_URL.exec(url);
  if (!match) {
    return null;
  }
  const ueCode = decodeURIComponent(match[1]).toUpperCase();
  if (match[2] === undefined) {
    return { ueCode, label: `l’UE ${ueCode}` };
  }
  return { ueCode, courseId: Number(match[2]), label: `ce cours (${ueCode})` };
}
