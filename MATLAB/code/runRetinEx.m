function result = runRetinEx(imagePath)

% ============================================================
% RETINEX - FINAL RETINAL IMAGE PROCESSING PIPELINE
%
% Input:
%   imagePath - path to retinal image
%
% Output:
%   result    - complete processing result
%
% ============================================================

%% 1. Read image

img = imread(imagePath);

%% 2. Extract image name

[~, imageName, ~] = fileparts(imagePath);
result.imageName = imageName;

%% 3. Run quality + localization + AI preprocessing

result = processRetinalImage(img,imageName);

%% 4. Display summary

fprintf("\n");
fprintf("================================================\n");
fprintf("              RetinEx FINAL RESULT\n");
fprintf("================================================\n");

fprintf("Image               : %s\n",imageName);
fprintf("Quality             : %s\n",result.quality);
fprintf("Processing Stage    : %s\n",result.processing_stage);
fprintf("Reject Reason       : %s\n",result.reject_reason);

%% 5. Localization information

if isfield(result,"localization")

    fprintf("\n--- Retinal Structures ---\n");

    fprintf("Optic Disc          : (%.1f, %.1f)\n", ...
        result.localization.disc.centerX, ...
        result.localization.disc.centerY);

    fprintf("Fovea               : (%.1f, %.1f)\n", ...
        result.localization.fovea.centerX, ...
        result.localization.fovea.centerY);

end

%% 6. AI preprocessing information

if isfield(result,"ai_image")

    fprintf("\n--- AI Input ---\n");

    aiSize = size(result.ai_image);

    fprintf("AI Image Size       : %d x %d x %d\n", ...
        aiSize(1),aiSize(2),aiSize(3));

    fprintf("AI Preprocessing    : Complete\n");

end

fprintf("\n================================================\n");

end