function fovea = locateFovea(img, disc)

% ============================================================
% FOVEA LOCALIZATION
%
% Method:
% Optic Disc
%      ↓
% Broad Temporal ROI
%      ↓
% Green Channel
%      ↓
% Darkness + Vessel-Free Score
%      ↓
% Boundary Exclusion
%      ↓
% Fovea Candidate
% ============================================================

%% 1. Image information

[rows, cols, ~] = size(img);

%% 2. Green channel

greenChannel = img(:,:,2);
greenDouble = im2double(greenChannel);

%% 3. Optic disc information

discCenterX = disc.centerX;
discCenterY = disc.centerY;

%% 4. Determine temporal direction

if discCenterX < cols/2
    discSide = "left";
else
    discSide = "right";
end

%% 5. Broad temporal search ROI

% Validated on IDRiD 055-059

if discSide == "left"

    xLeft  = round(discCenterX + 300);
    xRight = round(discCenterX + 650);

else

    xLeft  = round(discCenterX - 650);
    xRight = round(discCenterX - 300);

end

% Vertical search range

yTop    = round(discCenterY - 200);
yBottom = round(discCenterY + 200);

%% 6. Keep ROI inside image

xLeft   = max(1,xLeft);
xRight  = min(cols,xRight);

yTop    = max(1,yTop);
yBottom = min(rows,yBottom);

%% 7. Extract ROI

roi = greenDouble(yTop:yBottom,xLeft:xRight);

%% 8. Smooth intensity

roiSmooth = imgaussfilt(roi,15);

%% 9. Darkness score

intensityNorm = mat2gray(roiSmooth);

darknessScore = 1 - intensityNorm;

%% 10. Dark vessel enhancement

vesselDark = imbothat( ...
    roi, ...
    strel("disk",8));

vesselNorm = mat2gray(vesselDark);

%% 11. Approximate vessel mask

vesselMask = vesselNorm > 0.20;

vesselMask = bwareaopen( ...
    vesselMask, ...
    20);

%% 12. Local vessel density

vesselDensityMap = imboxfilt( ...
    double(vesselMask), ...
    [41 41]);

vesselDensityNorm = mat2gray( ...
    vesselDensityMap);

%% 13. Vessel-free score

vesselFreeScore = ...
    1 - vesselDensityNorm;

%% 14. Combined fovea score

foveaScore = ...
    0.50 * darknessScore + ...
    0.50 * vesselFreeScore;

%% 15. Remove ROI boundary artifacts

[roiRows,roiCols] = size(foveaScore);

candidateMask = true(roiRows,roiCols);

borderX = round(0.20 * roiCols);
borderY = round(0.20 * roiRows);

candidateMask(1:borderY,:) = false;

candidateMask(end-borderY+1:end,:) = false;

candidateMask(:,1:borderX) = false;

candidateMask(:,end-borderX+1:end) = false;

%% 16. Restrict candidate search

restrictedScore = foveaScore;

restrictedScore(~candidateMask) = -Inf;

%% 17. Find best candidate

[maxScore,maxIndex] = ...
    max(restrictedScore(:));

[localY,localX] = ...
    ind2sub( ...
        size(restrictedScore), ...
        maxIndex);

%% 18. Convert ROI coordinates to image coordinates

foveaX = xLeft + localX - 1;
foveaY = yTop + localY - 1;

%% 19. Candidate intensity

candidateIntensity = ...
    roiSmooth(localY,localX);

%% 20. Candidate neighborhood

candidateRadius = 20;

px1 = max(1,localX-candidateRadius);
px2 = min(size(roiSmooth,2),localX+candidateRadius);

py1 = max(1,localY-candidateRadius);
py2 = min(size(roiSmooth,1),localY+candidateRadius);

candidateRegion = ...
    roiSmooth(py1:py2,px1:px2);

%% 21. Candidate statistics

candidateMean = ...
    mean(candidateRegion(:));

candidateStd = ...
    std(candidateRegion(:));

candidateVesselRegion = ...
    vesselDensityMap(py1:py2,px1:px2);

candidateVesselDensity = ...
    mean(candidateVesselRegion(:));

%% 22. Overall ROI statistics

searchMean = mean(roiSmooth(:));

overallVesselDensity = ...
    mean(vesselMask(:));

%% 23. Darkness comparison

darknessDifference = ...
    searchMean - candidateMean;

%% 24. Distance from optic disc

distanceFromDisc = sqrt( ...
    (foveaX-discCenterX)^2 + ...
    (foveaY-discCenterY)^2);

%% 25. Distance in disc diameters

distanceInDiscDiameters = ...
    distanceFromDisc / disc.diameter;

%% 26. Distance from image boundary

distanceToBoundary = min([ ...
    foveaX-1, ...
    foveaY-1, ...
    cols-foveaX, ...
    rows-foveaY]);

%% 27. Store results

fovea.centerX = foveaX;
fovea.centerY = foveaY;

fovea.score = maxScore;

fovea.candidateIntensity = ...
    candidateIntensity;

fovea.candidateMean = ...
    candidateMean;

fovea.candidateStd = ...
    candidateStd;

fovea.candidateVesselDensity = ...
    candidateVesselDensity;

fovea.roiVesselDensity = ...
    overallVesselDensity;

fovea.darknessDifference = ...
    darknessDifference;

fovea.distanceFromDisc = ...
    distanceFromDisc;

fovea.distanceInDiscDiameters = ...
    distanceInDiscDiameters;

fovea.distanceToBoundary = ...
    distanceToBoundary;

% Store ROI information

fovea.roi.xLeft = xLeft;
fovea.roi.xRight = xRight;
fovea.roi.yTop = yTop;
fovea.roi.yBottom = yBottom;

fprintf("\n===== Fovea Localization =====\n");

fprintf("Disc Side       = %s\n",discSide);

fprintf("Search ROI      = X:%d-%d, Y:%d-%d\n", ...
    xLeft,xRight,yTop,yBottom);

fprintf("Fovea           = (%.1f, %.1f)\n", ...
    foveaX,foveaY);

fprintf("Fovea Score     = %.4f\n", ...
    maxScore);

fprintf("Disc-Fovea Dist = %.2f px\n", ...
    distanceFromDisc);

fprintf("Distance        = %.2fD\n", ...
    distanceInDiscDiameters);

end