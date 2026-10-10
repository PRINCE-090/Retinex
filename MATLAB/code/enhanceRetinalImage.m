function enhancedImg = enhanceRetinalImage(img)

    % Convert image to double
    imgDouble = im2double(img);

    % ---------------------------------------------------------
    % 1. Create FOV mask
    % ---------------------------------------------------------

    grayImg = im2gray(imgDouble);

    fovMask = grayImg > 0.03;

    fovMask = bwareaopen(fovMask, 5000);
    fovMask = imfill(fovMask, "holes");

    % ---------------------------------------------------------
    % 2. Extract RGB channels
    % ---------------------------------------------------------

    R = imgDouble(:,:,1);
    G = imgDouble(:,:,2);
    B = imgDouble(:,:,3);

    % ---------------------------------------------------------
    % 3. Apply mild CLAHE ONLY to Green channel
    % ---------------------------------------------------------

    enhancedG = adapthisteq( ...
        G, ...
        "ClipLimit", 0.005, ...
        "NumTiles", [8 8]);

    % ---------------------------------------------------------
    % 4. Apply enhancement only inside retinal FOV
    % ---------------------------------------------------------

    G_final = G;

    enhancementStrength = 0.30;

    G_final(fovMask) = ...
        (1 - enhancementStrength) * G(fovMask) + ...
        enhancementStrength * enhancedG(fovMask);

    % ---------------------------------------------------------
    % 5. Reconstruct RGB image
    % ---------------------------------------------------------

    enhancedImg = cat(3, R, G_final, B);

    % ---------------------------------------------------------
    % 6. Preserve background exactly
    % ---------------------------------------------------------

    for c = 1:3

        channel = enhancedImg(:,:,c);
        originalChannel = imgDouble(:,:,c);

        channel(~fovMask) = originalChannel(~fovMask);

        enhancedImg(:,:,c) = channel;

    end

    % Convert back to uint8
    enhancedImg = im2uint8(enhancedImg);

end