// Roost Post-Processing — River Masking and Morphological Cleanup
// Takes the raw RF+MED roost output (roost_30m_2024) and removes
// river channel overlap, small fragments, and jagged edges to
// produce the final roost proxy map.

var roi = ee.FeatureCollection(
  'projects/copper-booster-488414-p6/assets/LYG_Final'
);
Map.centerObject(roi, 11);

// Step 1: Load raw roost raster from identification pipeline
// connectedPixelCount filter removes isolated small patches
// (< 150 pixels ≈ 13.5 ha at 30m) that are too small to
// function as roost sites.
var roost = ee.Image(
  'projects/copper-booster-488414-p6/assets/roost_30m_2024'
).selfMask().clip(roi);

roost = roost.updateMask(
  roost.connectedPixelCount(150, true).gte(150)
);

// Step 2: Load river buffer mask
// Pre-computed 30m raster of buffered river channels, used to
// exclude roost pixels that overlap with river water bodies.
var river = ee.Image(
  'projects/copper-booster-488414-p6/assets/river_buffer_30m'
).selfMask().clip(roi);

// Step 3: Apply river mask
// Reproject river to match roost grid to ensure pixel-level
// alignment before masking. Roost pixels overlapping river
// buffer are removed.
var riverAligned = river.reproject({
  crs: roost.projection(),
  scale: 30
});

var roostMasked = roost.updateMask(
  riverAligned.unmask(0).not()
);

// Step 4: Morphological closing (fill gaps left by river removal)
// focal_max then focal_min = closing operation.
// Radius 20m bridges small gaps where the river mask cut through
// a roost patch, reconnecting fragments that still belong together.
var closed = roostMasked
  .focal_max({radius: 20, units: 'meters'})
  .focal_min({radius: 20, units: 'meters'});

// Step 5: Patch size filter (remove small remnants)
// After river masking, some roost patches may have been split
// into fragments too small to be ecologically relevant.
// Threshold: 150 connected pixels ≈ 13.5 ha at 30m resolution.
var patchSize = closed.gt(0).selfMask()
  .connectedPixelCount(500, true);
var largePatch = closed.updateMask(patchSize.gte(150));

// Step 6: Edge smoothing
// focal_max then focal_min at 10m radius smooths jagged pixel
// edges from the raster processing, producing cleaner boundaries
// for the final map product.
var smooth = largePatch
  .focal_max({radius: 10, units: 'meters'})
  .focal_min({radius: 10, units: 'meters'})
  .rename('roost_final');

// Step 7: Display
Map.addLayer(roost, {palette: ['red']}, 'Original roost', false);
Map.addLayer(riverAligned, {palette: ['blue']}, 'River buffer', false);
Map.addLayer(roostMasked, {palette: ['cyan']}, 'After river mask', false);
Map.addLayer(smooth, {palette: ['yellow']}, 'Final roost proxy', true);

// Area check
var area = roostMasked.multiply(ee.Image.pixelArea())
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e9
  });
print('Roost area after river mask (m²):', area);

// Step 8: Export final product
Export.image.toDrive({
  image: smooth.toByte(),
  description: 'roost_final_30m',
  folder: 'GEE_LYG',
  fileNamePrefix: 'roost_final_30m',
  region: roi.geometry(),
  scale: 30,
  maxPixels: 1e9
});
