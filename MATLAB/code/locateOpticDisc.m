function disc = locateOpticDisc(img)

    % Extract green channel
    greenChannel = img(:,:,2);

    % Convert to grayscale double
    greenDouble = im2double(greenChannel);

    % Slight smoothing to reduce small retinal structures
    smoothGreen = imgaussfilt(greenDouble, 2);

    % Detect bright circular structures
    [centers, radii, metric] = imfindcircles( ...
    smoothGreen, ...
    [25 100], ...
    "ObjectPolarity", "bright", ...
    "Sensitivity", 0.90, ...
    "Method", "TwoStage");

    % Check whether a circle was detected
    if isempty(centers)
        error("Optic disc could not be detected.");
    end

    % Image dimensions
    [rows, cols, ~] = size(img);

    % Distance of each candidate from horizontal image center
    horizontalDistance = abs(centers(:,1) - cols/2);

    % Keep candidates that are sufficiently far from image center
    % This favors the peripheral region where the optic disc is expected.
    candidateMask = horizontalDistance > 0.20 * cols;

    % If no candidate satisfies the location constraint,
    % fall back to the strongest circular candidate.
    if any(candidateMask)

        validIndices = find(candidateMask);

        [~, localBest] = max(metric(validIndices));

        bestIndex = validIndices(localBest);

    else

        [~, bestIndex] = max(metric);

    end

    bestCenter = centers(bestIndex,:);
    bestRadius = radii(bestIndex);
    
    % Store optic disc information
    disc.centerX = bestCenter(1);
    disc.centerY = bestCenter(2);

    disc.radius = bestRadius;
    disc.diameter = 2 * bestRadius;

    disc.width = 2 * bestRadius;
    disc.height = 2 * bestRadius;

    disc.area = pi * bestRadius^2;

    disc.metric = metric(bestIndex);

end