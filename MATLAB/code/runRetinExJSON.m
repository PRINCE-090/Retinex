function runRetinExJSON(imagePath, outputJsonPath)

% ============================================================
% RUNRETINEXJSON - JSON wrapper around runRetinEx for the backend
%
% Calls the existing runRetinEx() pipeline and writes its outcome to
% outputJsonPath using the fixed JSON contract expected by the Node
% backend:
%
%   {
%     "quality": "adequate" | "borderline" | "reject",
%     "reject_reason": "<string>" | null,
%     "image_path": "<string>" | null,
%     "optic_disc": { "x": <num>, "y": <num>, "radius": <num> } | null,
%     "fovea": { "x": <num>, "y": <num>, "score": <num> } | null
%   }
%
% Any failure inside runRetinEx (including optic-disc/fovea detection
% errors) is caught here and turned into a valid "reject" result instead
% of a MATLAB crash with no output file.
%
% ============================================================

quality = "reject";
rejectReason = "Unexpected error before RetinEx processing began.";
imagePathOut = [];
opticDiscOut = [];
foveaOut = [];

try

    result = runRetinEx(imagePath);

    stage = string(result.processing_stage);

    if stage == "original" || stage == "enhanced"

        if stage == "original"

            quality = "adequate";
            imagePathOut = char(imagePath);

        else

            quality = "borderline";
            imagePathOut = toAbsolutePath(result.enhanced_image_path);

        end

        if ~isfile(imagePathOut)

            error("runRetinExJSON:missingImage", ...
                "Expected output image does not exist on disk: %s", ...
                imagePathOut);

        end

        rejectReason = [];

        disc = result.localization.disc;
        fov = result.localization.fovea;

        opticDiscOut = struct( ...
            "x", disc.centerX, ...
            "y", disc.centerY, ...
            "radius", disc.radius);

        foveaOut = struct( ...
            "x", fov.centerX, ...
            "y", fov.centerY, ...
            "score", fov.score);

    elseif stage == "rejected"

        quality = "reject";
        rejectReason = char(result.reject_reason);
        imagePathOut = [];
        opticDiscOut = [];
        foveaOut = [];

    else

        error("runRetinExJSON:unknownStage", ...
            "Unrecognized processing_stage returned by runRetinEx: %s", ...
            stage);

    end

catch ME

    quality = "reject";
    rejectReason = sprintf("RetinEx processing failed: %s", ME.message);
    imagePathOut = [];
    opticDiscOut = [];
    foveaOut = [];

end

writeResultJson( ...
    outputJsonPath, quality, rejectReason, imagePathOut, opticDiscOut, foveaOut);

end


% ============================================================
% Local functions
% ============================================================

function writeResultJson(outputJsonPath, quality, rejectReason, imagePath, opticDisc, fovea)

json = buildJson(quality, rejectReason, imagePath, opticDisc, fovea);

fid = fopen(outputJsonPath, "w");

if fid == -1

    error("runRetinExJSON:writeFailed", ...
        "Could not open output JSON file for writing: %s", outputJsonPath);

end

cleanupObj = onCleanup(@() fclose(fid)); %#ok<NASGU>

fwrite(fid, json, "char");

end


function json = buildJson(quality, rejectReason, imagePath, opticDisc, fovea)

qualityJson = sprintf('"quality": "%s"', jsonEscape(quality));

if isempty(rejectReason)
    reasonJson = '"reject_reason": null';
else
    reasonJson = sprintf('"reject_reason": "%s"', jsonEscape(rejectReason));
end

if isempty(imagePath)
    imageJson = '"image_path": null';
else
    imageJson = sprintf('"image_path": "%s"', jsonEscape(imagePath));
end

if isempty(opticDisc)

    discJson = '"optic_disc": null';

else

    discJson = sprintf( ...
        '"optic_disc": {"x": %s, "y": %s, "radius": %s}', ...
        numJson(opticDisc.x), numJson(opticDisc.y), numJson(opticDisc.radius));

end

if isempty(fovea)

    foveaJson = '"fovea": null';

else

    foveaJson = sprintf( ...
        '"fovea": {"x": %s, "y": %s, "score": %s}', ...
        numJson(fovea.x), numJson(fovea.y), numJson(fovea.score));

end

json = sprintf( ...
    "{\n  %s,\n  %s,\n  %s,\n  %s,\n  %s\n}\n", ...
    qualityJson, reasonJson, imageJson, discJson, foveaJson);

end


function s = numJson(v)

s = sprintf("%.6g", double(v));

end


function s = jsonEscape(str)

str = char(str);
str = strrep(str, "\", "\\");
str = strrep(str, '"', '\"');
str = strrep(str, sprintf("\n"), "\\n");
str = strrep(str, sprintf("\r"), "");
s = str;

end


function p = toAbsolutePath(p)

p = char(p);

if isempty(p)
    return;
end

isAbs = (ispc && length(p) >= 2 && p(2) == ":") || (~ispc && startsWith(p, "/"));

if ~isAbs
    p = fullfile(pwd, p);
end

end
