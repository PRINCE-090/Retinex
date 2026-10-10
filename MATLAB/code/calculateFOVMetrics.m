function metrics = calculateFOVMetrics(img)

% Convert image to grayscale
grayImg = im2gray(img);

% Initial FOV mask
fovMask = grayImg > 10;

% Clean mask
cleanFOVMask = bwareaopen(fovMask, 5000);
cleanFOVMask = imfill(cleanFOVMask, "holes");

% Find connected components
props = regionprops(cleanFOVMask, ...
    "Area", "BoundingBox", "Perimeter");

% Find largest FOV region
[~, largestIndex] = max([props.Area]);

largestFOV = props(largestIndex);

% FOV measurements
fovArea = largestFOV.Area;

totalImageArea = numel(cleanFOVMask);

fovCoverage = (fovArea / totalImageArea) * 100;

% Bounding box
boundingBox = largestFOV.BoundingBox;

fovWidth = boundingBox(3);
fovHeight = boundingBox(4);

aspectRatio = fovWidth / fovHeight;

% Circularity
fovPerimeter = largestFOV.Perimeter;

circularity = (4 * pi * fovArea) / ...
    (fovPerimeter^2);

% Store results
metrics.area = fovArea;
metrics.coverage = fovCoverage;
metrics.width = fovWidth;
metrics.height = fovHeight;
metrics.aspectRatio = aspectRatio;
metrics.perimeter = fovPerimeter;
metrics.circularity = circularity;
metrics.mask = cleanFOVMask;

end