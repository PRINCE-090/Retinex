function score = calculateSharpness(img)

% Convert RGB image to grayscale
grayImg = im2gray(img);

% Apply Laplacian filter
laplacianImg = imfilter( ...
    grayImg, ...
    fspecial("laplacian"));

% Calculate variance of Laplacian
score = var(double(laplacianImg(:)));

end