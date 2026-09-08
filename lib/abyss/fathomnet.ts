import snapshot from './generated/fathomnet.json';

export type ReferenceImage = {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  longitude: number;
  latitude: number;
  depthMeters: number | null;
  capturedAt: string | null;
  labels: string[];
  reviewState: 'UNVERIFIED';
  sourceUrl: string;
  sha256: string;
  credit: string;
  collectionNames: string[];
  citation: string[];
  locationId: string;
};

export type ReferenceLocation = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  imageCount: number;
};

// The sample contains unverified labels and three shared registered positions.
// These image references are independent of OBIS occurrences and gap scores.
export const referenceImages: ReferenceImage[] = snapshot.images.map(
  (image) => {
    if (image.reviewState !== 'UNVERIFIED') {
      throw new Error(
        `Unexpected FathomNet annotation review state: ${image.id}`,
      );
    }
    return { ...image, reviewState: image.reviewState };
  },
);

export const referenceLocations: ReferenceLocation[] = snapshot.locations;
export const imageLicenseUrl = snapshot.imageLicenseUrl;
export const annotationLicenseUrl = snapshot.annotationLicenseUrl;
export const snapshotRetrievedAt = snapshot.snapshotRetrievedAt;

export function getReferenceImage(id: string): ReferenceImage | undefined {
  return referenceImages.find((image) => image.id === id);
}

export function getReferenceLocation(
  id: string,
): ReferenceLocation | undefined {
  return referenceLocations.find((location) => location.id === id);
}

export function referenceImagesForLocation(
  locationId: string,
): ReferenceImage[] {
  return referenceImages.filter((image) => image.locationId === locationId);
}
