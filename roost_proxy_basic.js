var P = 'projects/copper-booster-488414-p6/assets/';

// 1. ROI & BASE DATA

var roi = ee.FeatureCollection(P + 'LYG_Final');
var roiG = roi.geometry();
Map.centerObject(roi, 11);

var dem = ee.Image('USGS/SRTMGL1_003').clip(roiG);

// 2. S2 COMPOSITE
function mc(img) {
  var qa = img.select('QA60');
  return img.updateMask(
    qa.bitwiseAnd(1<<10).eq(0).and(qa.bitwiseAnd(1<<11).eq(0))
  ).select(['B2','B3','B4','B8','B11','B12'])
   .divide(10000)
   .copyProperties(img, ['system:time_start']);
}

var comp = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roiG)
    .filterDate('2023-01-01','2024-12-31')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(mc).median().clip(roiG);

// 3. INDICES + FEATURE IMAGE
var ndvi  = comp.normalizedDifference(['B8','B4']).rename('NDVI');
var mndwi = comp.normalizedDifference(['B3','B11']).rename('MNDWI');
var ndbi  = comp.normalizedDifference(['B11','B8']).rename('NDBI');
var bsi   = comp.expression(
  '((S+R)-(N+B))/((S+R)+(N+B))',
  {S:comp.select('B11'),R:comp.select('B4'),
   N:comp.select('B8'), B:comp.select('B2')}
).rename('BSI');

var feat = comp.addBands([ndvi, mndwi, ndbi, bsi, dem.rename('DEM')]);
var bands = feat.bandNames();

// 4. MASKS
var waterM = mndwi.gt(0.75);
var candMask = dem.lte(10).and(waterM.not()).and(ndvi.lte(0.2));

// 5. TRAINING — image.sample() 

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

var s0 = sampleFromFC(ee.FeatureCollection(P+'neg_core'), 0, 400);
var s1 = sampleFromFC(ee.FeatureCollection(P+'lyg_osm_neg_weak'), 1, 400);
var s2 = sampleFromFC(ee.FeatureCollection(P+'pos_weak'), 2, 400);
var s3 = sampleFromFC(ee.FeatureCollection(P+'pos_core'), 3, 400);

// water neg sample
var sW = feat.updateMask(waterM).sample({
  region: roiG, scale: 30, numPixels: 300, seed: 99,
  tileScale: 8, geometries: false
}).map(function(f) { return f.set('label', 0); });

var tr = s0.merge(sW).merge(s1).merge(s2).merge(s3);

print('Training size:', tr.size());


// 6. RF
var clf = ee.Classifier.smileRandomForest(50).train(tr, 'label', bands);
print('Importance:', ee.Dictionary(clf.explain().get('importance')));

var classed = feat.classify(clf).updateMask(candMask).clip(roiG);
// core positive: class 3
var rfCore = classed.eq(3);

// weak positive: class 2, but only kept under stricter physical constraints
var weakStrict = classed.eq(2)
  .and(dem.lte(5))          // lowland
  .and(ndvi.lte(0.15))      // low veg
  .and(mndwi.lt(0.4))       // water
  .and(ndbi.lt(0.2));       // build-up area

var rfGood = rfCore.or(weakStrict)
  .selfMask()
  .rename('rf');


// 7. ACCURACY 
var sp = tr.randomColumn('x', 1);
var cvC = ee.Classifier.smileRandomForest(50)
    .train(sp.filter(ee.Filter.lt('x',0.7)), 'label', bands);
var cm = sp.filter(ee.Filter.gte('x',0.7))
    .classify(cvC).errorMatrix('label','classification');
print('Accuracy:', cm.accuracy());
print('Kappa:', cm.kappa());


// 8. MED sample + vegetation rate
var migS2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roiG)
    .filterDate('2022-03-01','2023-06-01')
    .filter(ee.Filter.calendarRange(3,5,'month'))
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(mc);

var migNDVI = migS2.median()
    .normalizedDifference(['B8','B4']).rename('migNDVI').clip(roiG);

var medFC = ee.FeatureCollection(P + 'med');
var medMask = ee.Image.constant(0).paint(medFC, 1).selfMask();
var medGood = migNDVI.lt(0.15).updateMask(medMask)
    .updateMask(candMask).selfMask().rename('med');


// 9. merge + filter

var merged = rfGood.unmask(0).add(medGood.unmask(0))
    .gt(0).selfMask();

// erode
var eroded = merged.focal_min({radius: 2, units: 'pixels'});

// 12ha-30%, 200px ≈ 8ha
var patchN = eroded.connectedPixelCount(201, true);
var filtered = eroded.updateMask(patchN.gte(200));

var finalRoost = filtered.focal_max({radius: 0.5, units: 'pixels'})
    .updateMask(merged)
    .rename('roost');
    
// 10. DISPLAY

Map.addLayer(comp.select(['B4','B3','B2']).multiply(3),
    {min:0,max:0.3}, 'RGB', false);
Map.addLayer(classed,
    {min:0,max:3,palette:['d73027','fc8d59','fee08b','1a9850']},
    'RF 4class', false);
Map.addLayer(rfGood, {palette:['2166ac']}, 'RF suit', false);
Map.addLayer(medGood, {palette:['ff9800']}, 'Med suit', false);
Map.addLayer(finalRoost, {palette:['00796b']}, 'Roost', true);
Map.addLayer(roi.style({color:'red',fillColor:'00000000',width:2}),{},'ROI');

Export.image.toAsset({
  image: finalRoost,
  description: 'LYG_Roost_asset',
  assetId: 'users/jianlingzhao3131/LYG_Roost_2024',
  region: roiG,
  scale: 20,
  maxPixels: 1e9
});