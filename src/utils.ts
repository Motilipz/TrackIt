/**
 * Extracts Google Drive File ID from a sharing web link and returns
 * the hot-linkable direct image rendering proxy URL.
 */
export const getDirectDriveImageUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  
  // Try matching /file/d/FILE_ID
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}=w800`;
  }
  
  // Try matching ?id=FILE_ID or &id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w800`;
  }
  
  return url;
};
