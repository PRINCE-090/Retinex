function result = processRetinalImage(img, imageName)

    % =========================================================
    % RetinEx Image Quality Processing Pipeline
    % =========================================================

    outputFolder = "output";

    if ~isfolder(outputFolder)
        mkdir(outputFolder);
    end


    % =========================================================
    % STEP 1: Initial Quality Evaluation
    % =========================================================

    qualityBefore = evaluateImageQuality(img);

    decisionBefore = makeQualityDecision(qualityBefore);

    % Store initial metrics
    result.metrics_before = qualityBefore;


    % =========================================================
    % STEP 2: ADEQUATE
    % =========================================================

    if decisionBefore.quality == "adequate"

        result.quality = "adequate";
        result.reject_reason = "";
        result.enhanced_image_path = "";
        % Localize optic disc and fovea
        localization = localizeRetinalStructures(img);

        % Store localization results
        result.localization = localization;
        result.metrics_after = qualityBefore;
        result.processing_stage = "original";

        return;

    end


    % =========================================================
    % STEP 3: REJECT
    % =========================================================

    if decisionBefore.quality == "reject"

        result.quality = "reject";
        result.reject_reason = decisionBefore.reject_reason;
        result.enhanced_image_path = "";
        result.processing_stage = "rejected";
        % No enhancement performed
        result.metrics_after = [];

        return;

    end


    % =========================================================
    % STEP 4: BORDERLINE → ENHANCEMENT
    % =========================================================

    if decisionBefore.quality == "borderline"

        % Enhance image
        enhancedImg = enhanceRetinalImage(img);


        % Re-check quality
        qualityAfter = evaluateImageQuality(enhancedImg);

        decisionAfter = makeQualityDecision(qualityAfter);

        % Store post-enhancement metrics
        result.metrics_after = qualityAfter;


        % -----------------------------------------------------
        % Enhancement successful
        % -----------------------------------------------------

        if decisionAfter.quality == "adequate"

            enhancedFileName = ...
                imageName + "_enhanced.jpg";

            enhancedPath = fullfile( ...
                outputFolder, ...
                enhancedFileName);

            imwrite(enhancedImg, enhancedPath);

            result.quality = "adequate";
            result.reject_reason = "";
            result.enhanced_image_path = enhancedPath;
            % Localize optic disc and fovea on enhanced image
            localization = localizeRetinalStructures(enhancedImg);

            result.localization = localization;

            result.processing_stage = "enhanced";

            return;

        end


        % -----------------------------------------------------
        % Still borderline
        % -----------------------------------------------------

        if decisionAfter.quality == "borderline"

            % Check whether enhancement improved the image

            improvement = ...
                qualityAfter.illuminationUniformity - ...
                qualityBefore.illuminationUniformity;

            if improvement > 0

                enhancedFileName = ...
                    imageName + "_enhanced.jpg";

                enhancedPath = fullfile( ...
                    outputFolder, ...
                    enhancedFileName);

                imwrite(enhancedImg, enhancedPath);

                result.quality = "adequate";
                result.reject_reason = "";
                result.enhanced_image_path = enhancedPath;
                result.processing_stage = "enhanced";

                localization = ...
                    localizeRetinalStructures(enhancedImg);

                result.localization = localization;

                return;

            else

                result.quality = "reject";

                result.reject_reason = ...
                    "Image remains unsuitable after enhancement.";

                result.enhanced_image_path = "";
                result.processing_stage = "rejected";

                return;

            end

        end


        % -----------------------------------------------------
        % Reject after enhancement
        % -----------------------------------------------------

        if decisionAfter.quality == "reject"

            result.quality = "reject";

            result.reject_reason = ...
                decisionAfter.reject_reason;

            result.enhanced_image_path = "";

            result.processing_stage = "rejected";

            return;

        end

    end

end