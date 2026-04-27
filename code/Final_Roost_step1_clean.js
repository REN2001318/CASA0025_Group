// Roost Proxy Identification — Lianyungang Coastal Zone
// Combines Random Forest classification with seasonal migration analysis
// to identify potential shorebird roosting sites at 30m resolution.

var P = 'projects/copper-booster-488414-p6/assets/';

// Step 1: Study area and elevation data
// SRTM 30m DEM used later as both a classification feature and
// a physical constraint (roost sites must be low-elevation coastal land).
var roi = ee.FeatureCollection(P + 'LYG_Final');
var roiG = roi.geometry();
Map.centerObject(roi, 11);

var dem = ee.Image('USGS/SRTMGL1_003').clip(roiG);

// Step 2: Sentinel-2 cloud-free composite (2022-2023)
// Two-year window to maximise cloud-free pixel availability.
// QA60 band: bit 10 = opaque cloud, bit 11 = cirrus.
// Reflectance divided by 10000 to convert DN to 0-1 range.
function mc(img) {
  var qa = img.select('QA60');
  return img.updateMask(
    qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0))
  ).select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
   .divide(10000)
   .copyProperties(img, ['system:time_start']);
}

var comp = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roiG)
    .filterDate('2023-01-01', '2024-12-31')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(mc).median().clip(roiG);

// Step 3: Spectral indices
// NDVI — vegetation density; low values indicate bare ground suitable for roosting.
// MNDWI — water detection using Green and SWIR1; separates water from land.
// NDBI — built-up index; positive values indicate impervious surfaces.
// BSI — bare soil index; highlights exposed earth and salt flats.
var ndvi  = comp.normalizedDifference(['B8', 'B4']).rename('NDVI');
var mndwi = comp.normalizedDifference(['B3', 'B11']).rename('MNDWI');
var ndbi  = comp.normalizedDifference(['B11', 'B8']).rename('NDBI');
var bsi   = comp.expression(
  '((S+R)-(N+B)) / ((S+R)+(N+B))',
  {S: comp.select('B11'), R: comp.select('B4'),
   N: comp.select('B8'),  B: comp.select('B2')}
).rename('BSI');

// Feature stack: 6 spectral bands + 4 indices + DEM = 11 features for RF.
var feat = comp.addBands([ndvi, mndwi, ndbi, bsi, dem.rename('DEM')]);
var bands = feat.bandNames();

// Step 4: Physical constraint mask (candidate area)
// Applied before RF to exclude areas that cannot physically be roost sites.
// mNDWI > 0.75 identifies permanent deep water (ocean, rivers, large ponds).
// DEM <= 10m restricts to low-elevation coastal zone.
// NDVI <= 0.2 excludes dense vegetation (crops, forest).
// Only pixels passing all three conditions enter the RF classifier.
var waterM = mndwi.gt(0.75);
var candMask = dem.lte(10)
    .and(waterM.not())
    .and(ndvi.lte(0.2));

// Step 5: Training data — four-class suitability gradient
// Uses image.sample() instead of sampleRegions() to avoid memory overflow.
// numPixels caps the sample count server-side; tileScale=8 reduces tile size
// to prevent computation timeout on large geometries.
//
// Class 0 (neg_core): built-up areas, roads, deep water — clearly unsuitable.
// Class 1 (neg_weak): OSM-derived roads/buildings — spectrally similar to
//         roost but ecologically unsuitable. Key confusion class that helps
//         RF learn the boundary between roost-like and non-roost surfaces.
// Class 2 (pos_weak): brownfield, bare open ground — undeveloped, no water
//         management, may serve as roost but less certain.
// Class 3 (pos_core): pond embankments, salt pans — managed water levels
//         provide safe roosting with adjacent feeding areas.
function sampleFromFC(fc, label, nPx) {
  return feat.sample({
    region: fc.geometry(),
    scale: 30,
    numPixels: nPx,
    seed: 42,
    tileScale: 8,
    geometries: false
  }).map(function(f) { return f.set('label', label); });
}

var s0 = sampleFromFC(ee.FeatureCollection(P + 'neg_core'), 0, 400);
var s1 = sampleFromFC(ee.FeatureCollection(P + 'neg_weak'), 1, 400);
var s2 = sampleFromFC(ee.FeatureCollection(P + 'pos_weak'), 2, 400);
var s3 = sampleFromFC(ee.FeatureCollection(P + 'pos_core'), 3, 400);

// Additional water-body negative samples sampled directly from permanent
// water pixels, merged into class 0 to strengthen water exclusion.
var sW = feat.updateMask(waterM).sample({
  region: roiG, scale: 30, numPixels: 300, seed: 99,
  tileScale: 8, geometries: false
}).map(function(f) { return f.set('label', 0); });

var tr = s0.merge(sW).merge(s1).merge(s2).merge(s3);
print('Training size:', tr.size());

// Step 6: Random Forest classification
// 50 trees; trained on all 11 features.
// Output is a 4-class map, then masked by candMask so only candidate
// pixels receive a classification.
var clf = ee.Classifier.smileRandomForest(50).train(tr, 'label', bands);
print('Importance:', ee.Dictionary(clf.explain().get('importance')));

var classed = feat.classify(clf).updateMask(candMask).clip(roiG);

// Post-classification filtering:
// Class 3 (pos_core) retained directly — highest confidence roost.
// Class 2 (pos_weak) retained only under stricter physical constraints
// to reduce false positives from spectrally ambiguous surfaces:
//   DEM <= 5m (stricter than the 10m candidate mask)
//   NDVI <= 0.15 (more bare than the 0.2 candidate threshold)
//   mNDWI < 0.4 (exclude wet surfaces that passed the 0.75 water mask)
//   NDBI < 0.2 (exclude hard impervious surfaces)
var rfCore = classed.eq(3);

var weakStrict = classed.eq(2)
    .and(dem.lte(5))
    .and(ndvi.lte(0.15))
    .and(mndwi.lt(0.4))
    .and(ndbi.lt(0.2));

var rfGood = rfCore.or(weakStrict).selfMask().rename('rf');

// Step 7: Cross-validation accuracy assessment
// 70/30 random split on training data. Reports overall accuracy and
// Cohen's Kappa to evaluate classification performance.
var sp = tr.randomColumn('x', 1);
var cvC = ee.Classifier.smileRandomForest(50)
    .train(sp.filter(ee.Filter.lt('x', 0.7)), 'label', bands);
var cm = sp.filter(ee.Filter.gte('x', 0.7))
    .classify(cvC).errorMatrix('label', 'classification');
print('Accuracy:', cm.accuracy());
print('Kappa:', cm.kappa());

// Step 8: Seasonal migration analysis (MED supplement)
// Captures both spring (Mar-May) and autumn (Aug-Oct) migration windows.
// Some sites are bare only during migration periods but vegetated in
// summer, causing the annual composite to miss them.
var migS2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roiG)
    .filterDate('2023-01-01', '2024-12-31')
    .filter(ee.Filter.or(
      ee.Filter.calendarRange(3, 5, 'month'),
      ee.Filter.calendarRange(8, 10, 'month')
    ))
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(mc);

var migNDVI = migS2.median()
    .normalizedDifference(['B8', 'B4']).rename('migNDVI').clip(roiG);

var medFC = ee.FeatureCollection(P + 'med');
var medMask = ee.Image.constant(0).paint(medFC, 1).selfMask();
var medGood = migNDVI.lt(0.15)
    .updateMask(medMask)
    .updateMask(candMask)
    .selfMask().rename('med');

// Step 9: Merge RF and MED results, then morphological cleanup
// Union of both detection methods gives the raw merged roost map.
// Erosion (focal_min, radius=2px) breaks narrow connections along
// embankments so that individual ponds become separate patches.
// Connected-pixel filter (>= 200px ≈ 8ha after erosion shrinkage)
// removes small fragments that are too small to function as roost.
// Dilation (focal_max, radius=0.5px) restores boundaries to
// approximate original extent, clipped by the merged mask to
// prevent outward expansion beyond the original detection.
var merged = rfGood.unmask(0).add(medGood.unmask(0))
    .gt(0).selfMask();

var eroded = merged.focal_min({radius: 2, units: 'pixels'});

var patchN = eroded.connectedPixelCount(201, true);
var filtered = eroded.updateMask(patchN.gte(200));

var finalRoost = filtered.focal_max({radius: 0.5, units: 'pixels'})
    .updateMask(merged)
    .rename('roost');

// Step 10: Display and export
Map.addLayer(comp.select(['B4', 'B3', 'B2']).multiply(3),
    {min: 0, max: 0.3}, 'RGB', false);
Map.addLayer(candMask.selfMask(),
    {palette: ['#FFEE58']}, 'Candidate mask', false);
Map.addLayer(classed,
    {min: 0, max: 3, palette: ['d73027', 'fc8d59', 'fee08b', '1a9850']},
    'RF 4-class', false);
Map.addLayer(rfGood, {palette: ['2166ac']}, 'RF filtered', false);
Map.addLayer(medGood, {palette: ['ff9800']}, 'MED seasonal', false);
Map.addLayer(finalRoost, {palette: ['00796b']}, 'Final roost', true);
Map.addLayer(roi.style({color: 'red', fillColor: '00000000', width: 2}), {}, 'ROI');

Export.image.toAsset({
  image: finalRoost,
  description: 'LYG_Roost_asset',
  assetId: P + 'roost_30m_2024',
  region: roiG,
  scale: 30,
  maxPixels: 1e9
});
