/**
 * Stock photos the app used to fill in when no picture was chosen. A recipe with one of these,
 * or with no address at all, has no picture of its own.
 */
const STAND_IN_PHOTOS = ['photo-1546069901-ba9599a7e63c', 'photo-1498837167922-ddd27525d352'];

export const hasCoverImage = (url?: string | null): url is string =>
  Boolean(url && url.trim()) && !STAND_IN_PHOTOS.some((id) => url!.includes(id));
