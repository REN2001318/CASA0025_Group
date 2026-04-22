/**
 * TIDAL FLAT EXTRACTION PIPELINE: HYBRID METHOD (RULES + RANDOM FOREST)
 * * 1. PARAMETERS TO UPDATE FOR DIFFERENT YEARS:
 * - YEAR_LABEL: String used for export/chart naming.
 * - START / END: Core time window for Sentinel-2 collection (Crucial).
 * - basemap filterDate (Step 3): Must match your target year for visual checks.
 * - minPatchSize: Filtering inland noises after RF.
 * 
 * CORE LOGIC & METHODOLOGY OVERVIEW
 * 
 * * 1. THE MERGING STRATEGY (Murray Baseline + Sentinel-2 Dynamics):
 * Relying on a single data source is insufficient. The Murray dataset lacks recent 
 * dynamic changes, while relying solely on Sentinel-2 thresholds struggles with 
 * the northern tidal flats, where differing physical properties (e.g., sediment 
 * types, moisture) lead to severe omission errors. By merging the historical 
 * baseline with S2 dynamic inundation rules and applying morphological smoothing, 
 * we establish a physically logical, continuous "candidate zone" that minimizes 
 * data-specific blind spots.
 * 
 * * 2. RANDOM FOREST & EDGE DENSITY FEATURE:
 * Distinguishing natural tidal flats from coastal built-up areas, aquaculture 
 * ponds, and salt pans is nearly impossible using standard spectral or inundation 
 * filters, as they share highly similar water-frequency characteristics. To break 
 * this bottleneck, we apply a Random Forest classifier armed with "Edge Density" 
 * as a crucial spatial feature. In image learning, artificial structures present 
 * highly rigid, straight, and concentrated geometric boundaries, unlike the 
 * gradual, natural transitions of mudflats. The Edge Density feature allows the 
 * model to recognize these unnatural textures, successfully isolating artificial 
 * zones and carving out the true pixel-level boundaries of the tidal flats.
 */

// 1. PARAMETERS

var SITE_NAME   = 'Lianyungang Coast';
var YEAR_LABEL  = '2022–2023';
var START       = '2022-01-01';
var END         = '2023-12-31';
var CLOUD_MAX   = 20;  // cloud mask

var ELEV_MAX    = 10; 
// Elevation threshold (meters). It is used to restrict the research area, and tidal flats cannot occur at an altitude higher than 10 meters, significantly eliminating the interference of inland mountains

var NDVI_VEG    = 0.4;
// Vegetation index threshold. When NDVI is greater than 0.4, it is recognized as high-density vegetation

var MIN_PATCH   = 500;
// The minimum plaque area is used to eliminate image noise

var MNDWI_WATER = 0;
// A value greater than 0 is determined to be a water body, which is the basis for calculating the frequency of inundation.

var ZONE_UPPER  = 0.3;
var ZONE_LOWER  = 0.6;
// Intertidal zone zonation threshold. Based on the frequency of being submerged by water, tidal flats are classified into high tide flats (frequency < 0.3), medium tide flats (between 0.3 and 0.6), and low tide flats (> 0.6).



// 2. STUDY AREA & DEM

Map.setCenter(119.22, 34.60, 10); 

// change to your own path
var studyArea = ee.FeatureCollection("projects/copper-booster-488414-p6/assets/LYG_Final");


Map.centerObject(studyArea, 11);

// clip to study area
var dem = ee.Image('USGS/SRTMGL1_003').clip(studyArea);
var lowLand = dem.lte(ELEV_MAX);
// Generate a binary mask, setting only the area with an altitude of no more than 10 meters as 1 and the rest as 0, and assign it to lowLand.


// 3. SATELLITE BASEMAP


// satellite image data

var basemap = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
 // change to target timeband to get basemap layer
  .filterDate('2023-01-01', '2023-12-31') 
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
// The median can most effectively filter out the extreme values of occasional clouds, shadows or aircraft, generating a clean composite image.

  .clip(studyArea);

Map.addLayer(
  basemap,
  {bands: ['B4','B3','B2'], min: 0, max: 3000},
  'S2 2023 True Color',
  true
);



// 4. STEP A — MURRAY SPATIAL BASELINE
// Murray global tidal data(14-17 & 19) + water frequency filter

// Obtain the global intertidal zone basic classification data from 2014 to 2016.
var murrayV1 = ee.ImageCollection('UQ/murray/Intertidal/v1_1/global_intertidal')
  .filterDate('2014-01-01', '2017-01-01')
  .first()
  .select('classification')
  .clip(studyArea);

var murrayV2 = ee.Image('JCU/Murray/GIC/global_tidal_wetland_change/2019');

var murrayEnd = murrayV2.select('twprobabilityEnd').gt(50).clip(studyArea);
// Obtain the intertidal zone probability data of 2019 and extract the areas with a probability greater than 50%.

var murrayUnion = murrayV1.or(murrayEnd).updateMask(lowLand);



// 5. SENTINEL-2 COLLECTION

// Load the Sentinel-2 images of the target time period and perform cloud removal processing
function maskClouds(img) {
  var qa = img.select('QA60');
  return img.updateMask(
    qa.bitwiseAnd(1 << 10).eq(0)
    .and(qa.bitwiseAnd(1 << 11).eq(0))
  ).copyProperties(img, ['system:time_start']);
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_MAX))
  .map(maskClouds);

// cloud removal logic

var s2Median = s2.median().clip(studyArea);


// 6. STEP B — INUNDATION FREQUENCY
// Calculate the proportion of the number of times each pixel is presented as water within the research period to the total number of clear observations. This is the core indicator for identifying the dynamic characteristics of tidal flats

var mndwiCol = s2.map(function(img) {
  return img.normalizedDifference(['B3', 'B11']).rename('MNDWI');
});
// Calculate MNDWI (using green band and short-wave infrared)(better suppress the background noise of buildings/mud and sand)

var waterBinary = mndwiCol.map(function(img) {
  return img.gt(MNDWI_WATER).rename('water');
});
// Binarize the continuous values of MNDWI (convert to 1: water, 0: non-water)
// The total number of inundations divided by the total number of valid observations gives the inundation frequency between 0 and 1

var validCount = waterBinary.count().clip(studyArea);
var waterSum   = waterBinary.sum().clip(studyArea);

var inundFreqRaw = waterSum.divide(validCount).rename('inund_freq');

var inundFreq = inundFreqRaw
  .updateMask(murrayUnion)
  .updateMask(lowLand)
  .updateMask(validCount.gte(3))
  .clip(studyArea);
// At least three cloudless clear observations within a year


// 7. VEGETATION

var maxNDVI = s2.map(function(img) {
  return img.normalizedDifference(['B8', 'B4']).rename('NDVI');
}).max().clip(studyArea);
// Extract the maximum value of NDVI for each pixel in the time series

var denseVeg = maxNDVI.gt(NDVI_VEG);
var notDenseVeg = denseVeg.not().or(maxNDVI.unmask(0).not());



// 8. FINAL MURRAY TIDAL FLAT MASK

// Expand with a circle of radius 1 (fill the extremely small voids inside the tidal flat), and then corrode (restore the original boundary)
var tidalFlatRaw = murrayUnion.updateMask(lowLand).clip(studyArea);
var vegInTidal = denseVeg.and(murrayUnion).updateMask(lowLand).clip(studyArea);
var bareTidalFlat = murrayUnion.and(notDenseVeg).updateMask(lowLand).clip(studyArea);

var k = ee.Kernel.circle({radius: 1, units: 'pixels'});
var cleaned = tidalFlatRaw
  .focal_max({kernel: k, iterations: 1})
  .focal_min({kernel: k, iterations: 1});

var conn = cleaned.selfMask()
  .connectedPixelCount({maxSize: MIN_PATCH + 1, eightConnected: true});
// Calculate the number of connected pixels (eight-way connection, that is, diagonals adjacent to each other are also counted). maxSize is set to 501 to optimize computing resources (once the number of connections exceeds 500, it will no longer be counted further)


var tidalFlatClean = cleaned.updateMask(conn.gte(MIN_PATCH));



// 9. TIDAL ZONATION

// According to the frequency of inundation, the tidal flats are divided into high tide flats (which remain dry for a long time), medium tide flats and low tide flats (which remain submerged for a long time)

var hasFreqData = inundFreq.mask();
var upperFlat  = tidalFlatClean.and(inundFreq.lt(ZONE_UPPER)).updateMask(hasFreqData);
var middleFlat = tidalFlatClean.and(inundFreq.gte(ZONE_UPPER)).and(inundFreq.lt(ZONE_LOWER)).updateMask(hasFreqData);
var lowerFlat  = tidalFlatClean.and(inundFreq.gte(ZONE_LOWER)).updateMask(hasFreqData);
var unzonedFlat = tidalFlatClean.and(hasFreqData.not().or(hasFreqData.unmask(0).not()));



// 10. S2-DETECTED EXTENSION
// Murray's data is up to 2019, and the tidal flats are in a state of dynamic change (such as new sandbars). This step is used to capture new tidal flats outside the baseline range

var freqTidalFlat = inundFreqRaw
  .updateMask(lowLand)
  .updateMask(validCount.gte(10));

// The water frequency must be between 5% and 60% (land is rarely flooded, and deep water is excessively flooded)
var freqDetected = freqTidalFlat.gte(0.05).and(freqTidalFlat.lt(0.6));
var strictVeg = maxNDVI.lt(0.2);
// Use relatively strict non-vegetation standards (<0.2) to prevent inland farmland from being mistaken for tidal flats

var freqExtension = freqDetected.and(murrayUnion.unmask(0).not())
  .and(strictVeg)
  .updateMask(lowLand)
  .clip(studyArea);
// Make sure that the extracted area is outside the baseline.

var connExt = freqExtension.selfMask()
  .connectedPixelCount({maxSize: 26, eightConnected: true});
freqExtension = freqExtension.updateMask(connExt.gte(25));
// Clear out new noise points with less than 25 pixels


// 11-12. AREA STATISTICS 

var px = ee.Image.pixelArea();


// 13. UNION BEFORE RF & PRE-CLEANING
// Combine the historical baseline cleaning version and the Sentinel dynamic expansion version, and perform strict boundary smoothing before inputting the random forest to avoid "jagged" or numerous hole results.

var mergedRaw = tidalFlatClean.unmask(0).or(freqExtension.unmask(0));
 
// Corrosion followed by expansion can break extremely fine connections (such as Bridges or small ditches), while expansion followed by corrosion can fill the voids. This can make the candidate areas look more like natural patches
var k_clean = ee.Kernel.circle({radius: 2});
var mergedCleaned = mergedRaw
  .focal_min({kernel: k_clean, iterations: 1})
  .focal_max({kernel: k_clean, iterations: 1})
  .focal_max({kernel: k_clean, iterations: 1})
  .focal_min({kernel: k_clean, iterations: 1});

var mergedConn = mergedCleaned.selfMask()
  .connectedPixelCount({maxSize: 41, eightConnected: true});

// Clear the debris (< 40 pixels) generated during the smoothing process.
var mergedBeforeRF = mergedCleaned.updateMask(mergedConn.gte(40));


// 14. RF DEFINED ON MERGED RESULT 
// Distinguish the boundaries of artificial fish ponds, aquaculture areas and real tidal flats. Here, machine learning algorithms (RF) are introduced for further judgment

var ndvi_rf = s2Median.normalizedDifference(['B8','B4']).rename('NDVI');
var ndwi_rf = s2Median.normalizedDifference(['B3','B8']).rename('NDWI');
var mndwi_rf = s2Median.normalizedDifference(['B3','B11']).rename('MNDWI');

// Calculate the Euclidean distance from pixels to a constant water body (MNDWI > 0.2). Inland areas are farther from water, while tidal flats are closer to water.
var waterMask = mndwi_rf.gt(0.2);
var distToWater = waterMask.fastDistanceTransform(30).sqrt().rename('dist_water');

var inundFreq_RF = inundFreqRaw.updateMask(lowLand).updateMask(validCount.gte(10));

// Edge Density
// The Canny algorithm is used to detect the mutation of MNDWI (extremely sensitive to the water-land boundary)
var edge = ee.Algorithms.CannyEdgeDetector({
  image: mndwi_rf,
  threshold: 0.3, 
// The mutation threshold of 0.3 can capture the distinct boundary between water and land in fish ponds
  sigma: 1
});
// Calculate the edge density within a 3x3 pixel radius
var edgeDensity = edge.reduceNeighborhood({
  reducer: ee.Reducer.mean(),
  kernel: ee.Kernel.circle(3)
}).rename('edge_density');

// Local Standard Deviation
// Calculate the variance within the 5x5 window using the near-infrared band (B8), which is most sensitive to surface undulations and roughness
var localStdDev = s2Median.select('B8').reduceNeighborhood({
  reducer: ee.Reducer.stdDev(),
  kernel: ee.Kernel.square(2) }).rename('nir_stdDev');


var featureStack = ee.Image.cat([
  s2Median.select(['B2','B3','B4','B8','B11','B12']),
  ndvi_rf, 
  ndwi_rf, 
  mndwi_rf,
  inundFreq_RF.rename('inund_freq'),
  dem.rename('elevation'), 
  distToWater,
  edgeDensity,      
  localStdDev      
]).float();

var nonTidal = nontidal.map(function(f){ return f.set('class', 0); });
var tidal = tidal.map(function(f){ return f.set('class', 1); });
var samples = nonTidal.merge(tidal).randomColumn();

var training = featureStack.sampleRegions({
  collection: samples.filter(ee.Filter.lt('random', 0.7)),
  properties: ['class'],
  scale: 10
});

var rf = ee.Classifier.smileRandomForest(100).train(training, 'class');
var rfResult = featureStack.classify(rf);


// 15. FINAL RESULT MASK

var finalTidalFlatRaw = mergedBeforeRF.updateMask(rfResult.neq(0));


// Raise the threshold for connectivity screening to remove inland isolated small patches
// each 10x10=100 square meters, and 100 pixels equal 1 hectare
// If the inland patches are relatively large, you can increase this value
var minPatchSize = 100;
// Calc pixel connectivity number to clean up the random noise of 1-2 pixels
var finalConnFilter = finalTidalFlatRaw.selfMask()
  .connectedPixelCount({maxSize: 26, eightConnected: true});

var finalTidalFlat = finalTidalFlatRaw.updateMask(finalConnFilter.gte(25));



// 16. DISPLAY

Map.addLayer(mergedBeforeRF.selfMask(), {palette: ['#FFD54F'], opacity: 0.7}, 'Merged Base (Before RF)', false);
Map.addLayer(finalTidalFlat.selfMask(), {palette: ['#E53935'], opacity: 0.8}, 'Final Tidal Flat', true);

