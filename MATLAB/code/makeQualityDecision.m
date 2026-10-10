function decision = makeQualityDecision(quality)

% =========================================================
% DEVELOPMENT THRESHOLDS
% These are NOT clinically validated.
% They are only for pipeline development/testing.
% =========================================================

blurThreshold = 1.0;

brightnessLow = 40;
brightnessBorderline = 60;

uniformityLow = 0.50;
uniformityBorderline = 0.65;

fovCoverageLow = 50;
fovCoverageBorderline = 60;

% =========================================================
% Initialize
% =========================================================

decision.quality = "adequate";
decision.reject_reason = "";

% =========================================================
% 1. Check severe blur
% =========================================================

if quality.sharpness < blurThreshold

    decision.quality = "reject";
    decision.reject_reason = "Image is too blurry.";

    return;

end

% =========================================================
% 2. Check severe underexposure
% =========================================================

if quality.meanFOVBrightness < brightnessLow

    decision.quality = "reject";
    decision.reject_reason = "Image is too dark.";

    return;

end

% =========================================================
% 3. Check severe uneven illumination
% =========================================================

if quality.illuminationUniformity < uniformityLow

    decision.quality = "reject";
    decision.reject_reason = ...
        "Illumination across the retinal field is too uneven.";

    return;

end

% =========================================================
% 4. Check insufficient FOV
% =========================================================

if quality.fovCoverage < fovCoverageLow

    decision.quality = "reject";
    decision.reject_reason = ...
        "Retinal field coverage is insufficient.";

    return;

end

% =========================================================
% 5. Borderline conditions
% =========================================================

if quality.sharpness < 2.0 || ...
        quality.meanFOVBrightness < brightnessBorderline || ...
        quality.illuminationUniformity < uniformityBorderline || ...
        quality.fovCoverage < fovCoverageBorderline

    decision.quality = "borderline";
    decision.reject_reason = "";

    return;

end



