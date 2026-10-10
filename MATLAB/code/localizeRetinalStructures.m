function result = localizeRetinalStructures(img)

% Step 1: Locate optic disc
disc = locateOpticDisc(img);

% Step 2: Locate fovea using optic disc
fovea = locateFovea(img, disc);

% Store results
result.disc = disc;
result.fovea = fovea;

end