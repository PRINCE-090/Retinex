function results = runRetinExBatch(imageFolder)

% ============================================================
% RETINEX - BATCH PROCESSING
% ============================================================

files = dir(fullfile(imageFolder,"*.jpeg"));

results = cell(length(files),1);

fprintf("\n");
fprintf("============================================================\n");
fprintf("                 RetinEx BATCH PROCESSING\n");
fprintf("============================================================\n");

for i = 1:length(files)

    imagePath = fullfile(files(i).folder,files(i).name);

    fprintf("\n------------------------------------------------------------\n");
    fprintf("Processing %d/%d : %s\n", ...
        i,length(files),files(i).name);
    fprintf("------------------------------------------------------------\n");

    % Store each result independently
    results{i} = runRetinEx(imagePath);

end

fprintf("\n");
fprintf("============================================================\n");
fprintf("                 BATCH PROCESSING COMPLETE\n");
fprintf("============================================================\n");

for i = 1:length(results)

    fprintf("%-20s | Quality: %-9s | Stage: %s\n", ...
        files(i).name, ...
        results{i}.quality, ...
        results{i}.processing_stage);

end

fprintf("============================================================\n");

end