const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Accept common fundus image formats. TIFF is included since some retinal
// cameras export TIFF; browsers/tools may send it as image/tiff.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/tiff',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate the image_id here so it's available both as the stored
    // filename and on req.imageId for the route handler to respond with.
    const imageId = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '';
    req.imageId = imageId;
    req.storedFilename = `${imageId}${ext}`;
    cb(null, req.storedFilename);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, TIFF.`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — fundus images can be large
});

// ---------------------------------------------------------------------
// Two-eye (OD/OS) visit upload
// ---------------------------------------------------------------------
// Separate multer instance for POST /api/visits, which accepts up to two
// files ("image_od"/"image_os") in one request. `storage` above generates
// a single req.imageId/req.storedFilename per request (fine for the
// single-file /api/images route), so a second diskStorage is used here
// that generates one id PER FILE FIELD instead, keyed on req.eyeUploads.
// fileFilter/limits are reused as-is -- same accepted formats, same size
// cap, only the storage/id-generation differs.
const visitStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const imageId = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '';
    const storedFilename = `${imageId}${ext}`;

    req.eyeUploads = req.eyeUploads || {};
    req.eyeUploads[file.fieldname] = { imageId, storedFilename };

    cb(null, storedFilename);
  },
});

const uploadVisit = multer({
  storage: visitStorage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

module.exports = { upload, uploadVisit, UPLOAD_DIR };
