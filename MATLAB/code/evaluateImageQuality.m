function quality = evaluateImageQuality(img)

% Calculate all image quality metrics
metrics = calculateImageQualityMetrics(img);

% Store metrics
quality.sharpness = metrics.sharpness;

quality.meanFOVBrightness = metrics.meanFOVBrightness;
quality.illuminationUniformity = metrics.illuminationUniformity;

quality.fovCoverage = metrics.fovCoverage;
quality.fovAspectRatio = metrics.fovAspectRatio;
quality.fovCircularity = metrics.fovCircularity;

end