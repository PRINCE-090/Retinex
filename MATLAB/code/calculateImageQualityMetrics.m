function metrics = calculateImageQualityMetrics(img)

    %% 1. Sharpness

    metrics.sharpness = calculateSharpness(img);


    %% 2. Convert to grayscale

    grayImg = im2gray(img);


    %% 3. Create FOV mask

    fovMetrics = calculateFOVMetrics(img);

    fovMask = fovMetrics.mask;


    %% 4. FOV brightness

    fovPixels = double(grayImg(fovMask));

    metrics.meanFOVBrightness = mean(fovPixels);
    metrics.minFOVBrightness = min(fovPixels);
    metrics.maxFOVBrightness = max(fovPixels);


    %% 5. Regional illumination

    [rows, cols] = size(grayImg);

    rowMid = floor(rows / 2);
    colMid = floor(cols / 2);


    % Create quadrant masks

    TL_mask = fovMask(1:rowMid, 1:colMid);
    TR_mask = fovMask(1:rowMid, colMid+1:end);
    BL_mask = fovMask(rowMid+1:end, 1:colMid);
    BR_mask = fovMask(rowMid+1:end, colMid+1:end);


    % Extract FOV pixels

    TL_pixels = double(grayImg(1:rowMid, 1:colMid));
    TL_pixels = TL_pixels(TL_mask);

    TR_pixels = double(grayImg(1:rowMid, colMid+1:end));
    TR_pixels = TR_pixels(TR_mask);

    BL_pixels = double(grayImg(rowMid+1:end, 1:colMid));
    BL_pixels = BL_pixels(BL_mask);

    BR_pixels = double(grayImg(rowMid+1:end, colMid+1:end));
    BR_pixels = BR_pixels(BR_mask);


    % Regional means

    regionalMeans = [
        mean(TL_pixels)
        mean(TR_pixels)
        mean(BL_pixels)
        mean(BR_pixels)
    ];


    %% 6. Illumination uniformity

    brightestRegion = max(regionalMeans);
    darkestRegion = min(regionalMeans);

    illuminationRange = ...
        brightestRegion - darkestRegion;

    illuminationUniformity = 1 - ...
        (illuminationRange / metrics.meanFOVBrightness);


    %% 7. Store illumination metrics

    metrics.topLeftBrightness = regionalMeans(1);
    metrics.topRightBrightness = regionalMeans(2);
    metrics.bottomLeftBrightness = regionalMeans(3);
    metrics.bottomRightBrightness = regionalMeans(4);

    metrics.brightestRegion = brightestRegion;
    metrics.darkestRegion = darkestRegion;
    metrics.illuminationRange = illuminationRange;
    metrics.illuminationUniformity = illuminationUniformity;


    %% 8. Store FOV metrics

    metrics.fovArea = fovMetrics.area;
    metrics.fovCoverage = fovMetrics.coverage;
    metrics.fovWidth = fovMetrics.width;
    metrics.fovHeight = fovMetrics.height;
    metrics.fovAspectRatio = fovMetrics.aspectRatio;
    metrics.fovPerimeter = fovMetrics.perimeter;
    metrics.fovCircularity = fovMetrics.circularity;

    metrics.fovMask = fovMask;

end