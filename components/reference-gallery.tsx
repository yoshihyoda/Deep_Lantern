'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LocateFixed,
  MapPin,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  annotationLicenseUrl,
  imageLicenseUrl,
  referenceImages,
  referenceLocations,
  snapshotRetrievedAt,
} from '@/lib/abyss/fathomnet';

type ReferenceGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  onLocate: (locationId: string) => void;
};

function formatDate(value: string | null) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

function coordinates(latitude: number, longitude: number) {
  return `${Math.abs(latitude)}° ${latitude < 0 ? 'S' : 'N'} · ${Math.abs(longitude)}° ${longitude < 0 ? 'W' : 'E'}`;
}

function GallerySession({
  locationId,
  onLocate,
}: Pick<ReferenceGalleryProps, 'locationId' | 'onLocate'>) {
  const id = useId();
  const [locationFilter, setLocationFilter] = useState(
    referenceLocations.some((location) => location.id === locationId)
      ? locationId!
      : 'all',
  );
  const [labelFilter, setLabelFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locationImages = referenceImages.filter(
    (item) => locationFilter === 'all' || item.locationId === locationFilter,
  );
  const availableLabels = [
    ...new Set(locationImages.flatMap((item) => item.labels)),
  ].sort((a, b) => a.localeCompare(b, 'en'));
  const images = locationImages.filter(
    (item) => labelFilter === 'all' || item.labels.includes(labelFilter),
  );
  const selected = images.find((item) => item.id === selectedId) ?? images[0];
  const selectedIndex = selected ? images.indexOf(selected) : -1;
  const thumbnailStart = Math.max(0, Math.floor(selectedIndex / 6) * 6);
  const thumbnailImages = images.slice(thumbnailStart, thumbnailStart + 6);
  const location = referenceLocations.find(
    (item) => item.id === selected?.locationId,
  );
  const subjects = selected?.labels.length
    ? selected.labels.join(', ')
    : 'No named organism label';

  function selectPage(direction: -1 | 1) {
    const next = images[thumbnailStart + direction * 6];
    if (next) setSelectedId(next.id);
  }

  return (
    <>
      <header className="reference-gallery-header">
        <div className="reference-gallery-eyebrow">
          <Camera size={15} aria-hidden="true" /> Original image archive
        </div>
        <DialogTitle className="reference-gallery-title">
          Life, seen up close.
        </DialogTitle>
        <DialogDescription className="reference-gallery-description">
          Explore original NOAA images supplied with the FathomNet reference
          set.
        </DialogDescription>
        <p className="reference-gallery-count">
          <strong>{referenceImages.length}</strong> reference images
          <span aria-hidden="true">/</span>
          <strong>{referenceLocations.length}</strong> registered locations
        </p>
      </header>

      <div className="reference-gallery-filters">
        <label htmlFor={`${id}-location`}>
          <span>Registered location</span>
          <select
            id={`${id}-location`}
            value={locationFilter}
            onChange={(event) => {
              setLocationFilter(event.target.value);
              setLabelFilter('all');
              setSelectedId(null);
            }}
          >
            <option value="all">All locations</option>
            {referenceLocations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.imageCount}{' '}
                {item.imageCount === 1 ? 'image' : 'images'}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-label`}>
          <span>Unverified annotation label</span>
          <select
            id={`${id}-label`}
            value={labelFilter}
            onChange={(event) => {
              setLabelFilter(event.target.value);
              setSelectedId(null);
            }}
          >
            <option value="all">All labels</option>
            {availableLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <output className="reference-gallery-results">
          {images.length} {images.length === 1 ? 'image' : 'images'} in view
        </output>
      </div>

      {selected ? (
        <div className="reference-gallery-content">
          <div className="reference-gallery-visuals">
            <figure className="reference-image-frame">
              <Image
                key={selected.id}
                src={selected.imagePath}
                alt={`NOAA underwater reference image; unverified annotation labels: ${subjects}.`}
                width={selected.width}
                height={selected.height}
                unoptimized
                decoding="async"
                className="reference-original-image"
              />
              <figcaption className="reference-image-caption">
                <span>Original image · NOAA</span>
                <span>
                  {selectedIndex + 1} / {images.length}
                </span>
              </figcaption>
            </figure>
            <div className="reference-gallery-browse">
              <button
                type="button"
                className="reference-step"
                aria-label="Previous six reference images"
                disabled={thumbnailStart === 0}
                onClick={() => selectPage(-1)}
              >
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <div
                className="reference-thumbnails"
                aria-label="Reference image thumbnails"
              >
                {thumbnailImages.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="reference-thumbnail"
                    aria-pressed={selected.id === item.id}
                    aria-label={`View image ${thumbnailStart + index + 1}: ${item.labels.join(', ') || 'No named organism label'}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <Image
                      src={item.imagePath}
                      alt=""
                      width={item.width}
                      height={item.height}
                      unoptimized
                      loading="lazy"
                      decoding="async"
                    />
                    <span>
                      {String(thumbnailStart + index + 1).padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="reference-step"
                aria-label="Next six reference images"
                disabled={thumbnailStart + 6 >= images.length}
                onClick={() => selectPage(1)}
              >
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
            <output className="reference-thumbnail-range">
              Images {thumbnailStart + 1}–
              {Math.min(thumbnailStart + 6, images.length)} of {images.length}
            </output>
            <p className="reference-gallery-integrity">
              Original photographs, shown without cropping. Annotation labels
              are source metadata, not confirmed species identifications.
            </p>
          </div>

          <section
            className="reference-image-details"
            aria-label="Selected image details"
          >
            <div className="reference-subject-heading">
              <span>Annotated subjects</span>
              <span className="reference-review-badge">Unverified</span>
            </div>
            <div className="reference-subjects" aria-live="polite">
              {selected.labels.length ? (
                selected.labels.map((label) => <span key={label}>{label}</span>)
              ) : (
                <span>No named organism label</span>
              )}
            </div>
            <div className="reference-location">
              <MapPin size={16} aria-hidden="true" />
              <div>
                <h3>{location?.name ?? 'Registered location'}</h3>
                <p>{coordinates(selected.latitude, selected.longitude)}</p>
              </div>
            </div>
            <p className="reference-location-caveat">
              These are source-registered coordinates shared by a group of
              images. They may not be the exact capture position.
            </p>
            <button
              type="button"
              className="reference-locate-button"
              onClick={() => onLocate(selected.locationId)}
            >
              <LocateFixed size={16} aria-hidden="true" />
              Locate on map
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <dl className="reference-metadata">
              <div>
                <dt>Capture date (UTC)</dt>
                <dd>{formatDate(selected.capturedAt)}</dd>
              </div>
              <div>
                <dt>Image depth</dt>
                <dd>
                  {selected.depthMeters === null
                    ? 'Not supplied'
                    : `${selected.depthMeters.toLocaleString('en-US', { maximumFractionDigits: 3 })} m`}
                </dd>
              </div>
              <div>
                <dt>Credit</dt>
                <dd>{selected.credit}</dd>
              </div>
            </dl>
            <a
              className="reference-source-link"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open original source <ExternalLink size={13} aria-hidden="true" />
            </a>
            <details className="reference-image-provenance">
              <summary>Image provenance & licenses</summary>
              {selected.collectionNames.length > 0 && (
                <p>
                  <strong>Collections:</strong>{' '}
                  {selected.collectionNames.join('; ')}
                </p>
              )}
              {selected.citation.map((citation, index) => (
                <p key={`${index}-${citation}`}>{citation}</p>
              ))}
              <p>
                Images:{' '}
                <a href={imageLicenseUrl} target="_blank" rel="noreferrer">
                  CC BY-NC-ND 4.0
                </a>
                . Annotations:{' '}
                <a href={annotationLicenseUrl} target="_blank" rel="noreferrer">
                  CC BY-NC 4.0
                </a>
                .
              </p>
              <p>
                Reference snapshot retrieved {formatDate(snapshotRetrievedAt)}.
              </p>
              <p className="reference-image-id">Image ID: {selected.id}</p>
            </details>
          </section>
        </div>
      ) : (
        <div className="reference-gallery-empty">
          <Camera size={30} aria-hidden="true" />
          <p>No reference images match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setLocationFilter('all');
              setLabelFilter('all');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <footer className="reference-gallery-note">
        <span className="reference-note-dot" aria-hidden="true" />
        <p>
          FathomNet is an image reference set, not an occurrence dataset. These
          images do not enter OBIS record counts or exploration scores, and
          cannot establish why an animal lives here.{' '}
          <a
            href="https://www.fathomnet.org/datause"
            target="_blank"
            rel="noreferrer"
          >
            About the data
          </a>
        </p>
      </footer>
    </>
  );
}

export default function ReferenceGallery({
  open,
  onOpenChange,
  locationId,
  onLocate,
}: ReferenceGalleryProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="reference-gallery">
        {open && (
          <GallerySession
            key={locationId ?? 'all'}
            locationId={locationId}
            onLocate={onLocate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
