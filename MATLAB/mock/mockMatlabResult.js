// Stand-in for the real MATLAB quality/localization step (MATLAB/code/) until
// that's wired in via `matlab -batch` on a machine with MATLAB installed.
// Mimics the agreed contract:
//   { quality, reject_reason, image_path, optic_disc, fovea }
// with optic_disc/fovea using {x, y, ...} field names (not MATLAB's own
// centerX/centerY), since that's the shape backend/index.js merges into
// the saved Result document.

const fs = require('fs');
const path = require('path');

const VALID_QUALITIES = ['adequate', 'borderline', 'reject'];

// Representative values from real MATLAB output seen on IDRiD images.
function buildOpticDisc() {
  return { x: 1131.7, y: 514.8, radius: 64 };
}

function buildFovea() {
  return { x: 1789.3, y: 508.2, score: 0.6423 };
}

function getMockMatlabResult(imagePath, forcedQuality) {
  const quality =
    forcedQuality ||
    process.env.MOCK_MATLAB_QUALITY ||
    'adequate';

  if (!VALID_QUALITIES.includes(quality)) {
    throw new Error(
      `Invalid mock MATLAB quality override: "${quality}". Expected one of: ${VALID_QUALITIES.join(', ')}`
    );
  }

  if (quality === 'reject') {
    return {
      quality: 'reject',
      reject_reason: 'Illumination across the retinal field is too uneven.',
      image_path: null,
      optic_disc: null,
      fovea: null,
    };
  }

  if (quality === 'borderline') {
    // Pretend an enhanced copy was written alongside the original, keeping
    // the same filename (so downstream image_id derivation stays intact)
    // in a sibling "enhanced" directory.
    const enhancedDir = path.join(path.dirname(imagePath), 'enhanced');

    if (!fs.existsSync(enhancedDir)) {
      fs.mkdirSync(enhancedDir, { recursive: true });
    }

    const enhancedPath = path.join(enhancedDir, path.basename(imagePath));
    fs.copyFileSync(imagePath, enhancedPath);

    return {
      quality: 'borderline',
      reject_reason: null,
      image_path: enhancedPath,
      optic_disc: buildOpticDisc(),
      fovea: buildFovea(),
    };
  }

  // adequate
  return {
    quality: 'adequate',
    reject_reason: null,
    image_path: imagePath,
    optic_disc: buildOpticDisc(),
    fovea: buildFovea(),
  };
}

module.exports = { getMockMatlabResult };
