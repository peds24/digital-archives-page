import { useState } from 'react';

export function InfoTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="info-tooltip">
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="About the archive tile art"
      >
        ?
      </button>
      {open && (
        <div className="info-tooltip-panel" role="tooltip">
          <p>
            Each archive's tile is generative Canvas art, not album artwork — one of six geometric
            algorithms, deterministically chosen by the archive's number, drawn with seeded randomness so
            every archive looks unique within its family.
          </p>
        </div>
      )}
    </div>
  );
}
