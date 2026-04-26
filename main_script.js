// Data Preparation and Precomputations

// Set research location and basic elements

Map.setCenter(119.22, 34.60, 10);
var roi = ee.FeatureCollection("projects/my-project-20260224-488410/assets/LYG_Final");
var finalRegion2024 = roi.geometry();
Map.addLayer(roi, {color: 'red'}, "Study Area");

var ELEV_MAX    = 10;    // Eliminate high-altitude interference
var NDVI_VEG    = 0.4;   // Define high-density vegetation
var MIN_PATCH   = 100;   // Reducing this to 100, 500 may filter out small sandbars if it is too large
var ZONE_UPPER  = 0.3;   // Boundary of high tide beach
var ZONE_LOWER  = 0.6;   // Boundary of low tide beach

var dem = ee.Image('USGS/SRTMGL1_003').clip(roi);
var lowLand = dem.lte(ELEV_MAX);


// Processing Sentinel-2 data
// Prepare 2018-2024 Sentinel-2 Loop

// 1. Define Sentinel-2 specific bit mask cloud removal function
function maskS2clouds(image) {
  var qa = image.select('QA60');

  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000)
  .copyProperties(image, ["system:time_start", "CLOUDY_PIXEL_PERCENTAGE"]);
}


// 2. Set the function for processing Sentinel-2 data
var processYearlyData = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds)
  
  var imgCount = col.size();
    
  // 2.1 Core dynamic features
  var waterCol = col.map(function(img) {
    return img.normalizedDifference(['B3', 'B11']).gt(0).rename('water_mask');
  });
  var inundationFrequency = waterCol.reduce(ee.Reducer.mean()).rename('inund_freq');
  var validCount = waterCol.count().rename('valid_count');
  
  // 2.2 Generate a median composite map for that year
  
  var median = col.median()
  .clip(finalRegion2024)
  .set('year', year)
  .set('image_count', imgCount)
  .set('info_list', col.reduceColumns(ee.Reducer.toList(2), ['system:index', 'CLOUDY_PIXEL_PERCENTAGE']).get('list'));
  
  // 2.3 Spatial texture features
  var mndwi_rf = median.normalizedDifference(['B3', 'B11']);
  
  // A. Edge Density
  var edge = ee.Algorithms.CannyEdgeDetector({
    image: mndwi_rf, threshold: 0.3, sigma: 1
  });
  
  var edgeDensity = edge.reduceNeighborhood({
    reducer: ee.Reducer.mean(),
    kernel: ee.Kernel.circle(3)
  }).rename('edge_density');

  // B. NIR StdDev
  var localStdDev = median.select('B8').reduceNeighborhood({
    reducer: ee.Reducer.stdDev(),
    kernel: ee.Kernel.square(2) 
  }).rename('nir_stdDev');

  // C. Distance to Water
  var distToWater = mndwi_rf.gt(0.2)
    .fastDistanceTransform(30).sqrt().rename('dist_water');
   
  // D. DEM
  var elevation = dem.rename('elevation');
  
  // E. NDWI, mNDWI, NDVI, NDBI
  var ndwi = median.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndvi = median.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndbi = median.normalizedDifference(['B11', 'B8']).rename('NDBI');
  
  return median.addBands([
    ndwi, mndwi, ndvi, ndbi, 
    inundationFrequency, validCount, edgeDensity, localStdDev, distToWater, elevation
  ]).select(
    ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation'],
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation']
  ).set('year', year);
};

// 3. Execute loop
var yearsList = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
var yearlyList = ee.List(yearsList).map(function(y) { return processYearlyData(y); });

// 4. Return the results to ImageCollection
var finalTimeSeries = ee.ImageCollection.fromImages(yearlyList);


// Processing Landsat8 data
// Prepare 2014-2017 landsat8 Loop

// 1. Define Landsat8 specific bit mask cloud removal function
function maskL8clouds(image) {
  
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  
  var qa = image.select('QA_PIXEL');
  var cloudBitMask = (1 << 3);       
  var cloudShadowBitMask = (1 << 4); 
  
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudShadowBitMask).eq(0));

  return image.addBands(opticalBands, null, true)
    .updateMask(mask)
    .copyProperties(image, ["system:time_start"]); 
}

// 2. Set the function for processing Landsat8 data
var processYearlyLandsat = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8clouds);
    
  var imgCount = col.size();
  
  // 2.1 Core dynamic features
  var waterCol = col.map(function(img) {
    
    return img.normalizedDifference(['SR_B3', 'SR_B6']).gt(0).rename('water_mask');
  });
  var inundationFrequency = waterCol.reduce(ee.Reducer.mean()).rename('inund_freq');
  var validCount = waterCol.count().rename('valid_count');
  
  // 2.2 Generate a median composite map for that year

  // Resample first and then take median to ensure interpolation effect
  var median = col.map(function(img){ 
    return img.resample('bicubic');
  }).median().clip(finalRegion2024);

  // 2.3 Spatial texture features
  var mndwi_rf = median.normalizedDifference(['SR_B3', 'SR_B6']);
  
  // A. Edge Density
  var edge = ee.Algorithms.CannyEdgeDetector({image: mndwi_rf, threshold: 0.3, sigma: 1});
  var edgeDensity = edge.reduceNeighborhood({
    reducer: ee.Reducer.mean(), 
    kernel: ee.Kernel.circle(3)
  }).rename('edge_density');

  // B. NIR StdDev
  var localStdDev = median.select('SR_B5').reduceNeighborhood({
    reducer: ee.Reducer.stdDev(), 
    kernel: ee.Kernel.square(2)
  }).rename('nir_stdDev');

  // C. Distance to Water
  var distToWater = mndwi_rf.gt(0.2).fastDistanceTransform(30).sqrt().rename('dist_water');
  
  // D. DEM
  var elevation = dem.rename('elevation');
  
  // E. NDWI, mNDWI, NDVI, NDBI
  var ndvi = median.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndwi = median.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI');
  var ndbi = median.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');
  
  return median.addBands([
    ndvi, mndwi, ndwi, ndbi, 
    inundationFrequency, validCount, edgeDensity, localStdDev, distToWater, elevation
  ]).select(
    ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation'],
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation']
  )
  .set('year', year)
  .set('image_count', imgCount)
  .set('source', 'Landsat 8 (10m Bicubic)');
};

// 3. Execute loop
var l8Years = [2014, 2015, 2017];
var l8List = ee.List(l8Years).map(function(y) { return processYearlyLandsat(y); });
var l8TimeSeries = ee.ImageCollection.fromImages(l8List);

//Special process --- 2016 Landsat7+Landsat8
//After using Landsat-8's composite image for cloud removal for the first time, there were holes
//so it was decided to use Landsat-7 data for completion

// 1. Define Landsat7 specific bit mask cloud removal function
function maskL7clouds(image) {
  
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  
  var qa = image.select('QA_PIXEL');
  var cloudBitMask = (1 << 3);       
  var cloudShadowBitMask = (1 << 4); 
  
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudShadowBitMask).eq(0));

  return image.addBands(opticalBands, null, true)
    .updateMask(mask)
    .select(
      ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'],
      ['B2', 'B3', 'B4', 'B5', 'B6', 'B7']
    )
    .copyProperties(image, ["system:time_start"]);
}

// 2. Set the function for processing Landsat7+8 data
var process2016Fusion = function() {
  var year = 2016;
  var startDate = '2016-01-01';
  var endDate = '2016-12-31';

  // 2.1  Get L8 collection
  var l8ColRaw = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8clouds); // The MaskL8clouds here must ensure that resamples are not done internally

  // 2.2 Get L7 collection
  var l7ColRaw = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 40))
    .map(maskL7clouds);

  // 2.3 Cross set submergence frequency calculation
  var l8Water = l8ColRaw.map(function(img){ 
    return img.normalizedDifference(['SR_B3', 'SR_B6']).gt(0).rename('w'); 
  });
  
  var l7Water = l7ColRaw.map(function(img){ 
    return img.select('B3','B6').normalizedDifference(['B3', 'B6']).gt(0).rename('w'); 
  });
  
  var combinedWater = l8Water.merge(l7Water);
  var inundationFrequency = combinedWater.reduce(ee.Reducer.mean()).rename('inund_freq');
  var validCount = combinedWater.count().rename('valid_count');
  
  // 2.4 First, interpolate and align to regenerate the base image
  // L8 base image processing
  var l8Median = l8ColRaw.map(function(img) {
    return img.resample('bicubic').select(
      ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
      ['B2', 'B3', 'B4', 'B5', 'B6', 'B7']
    );
  }).median();

  // L7 base image processing
  var l7Median = l7ColRaw.map(function(img) {
    return img.resample('bicubic');
  }).median();

  // Fusion: L8 as the main component, L7 for hole filling
  var fusedImage = l8Median.unmask(l7Median)
  .clip(finalRegion2024);

  // 2.5 Spatial texture features
  var mndwi_rf = fusedImage.normalizedDifference(['B3', 'B6']);
  
   // A. Edge Density
  var edge = ee.Algorithms.CannyEdgeDetector({image: mndwi_rf, threshold: 0.3, sigma: 1});
  var edgeDensity = edge.reduceNeighborhood({
    reducer: ee.Reducer.mean(), 
    kernel: ee.Kernel.circle(3)
  }).rename('edge_density');
  
  // B. NIR StdDev
  var localStdDev = fusedImage.select('B5').reduceNeighborhood({
    reducer: ee.Reducer.stdDev(), 
    kernel: ee.Kernel.square(2)
  }).rename('nir_stdDev');
  
  // C. Distance to Water
  var distToWater = mndwi_rf.gt(0.2).fastDistanceTransform(30).sqrt().rename('dist_water');
  
  // D. DEM
  var elevation = dem.rename('elevation');
  
   // E. NDWI, mNDWI, NDVI, NDBI
  var ndvi = fusedImage.normalizedDifference(['B5', 'B4']).rename('NDVI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndwi = fusedImage.normalizedDifference(['B3', 'B5']).rename('NDWI');
  var ndbi = fusedImage.normalizedDifference(['B6', 'B5']).rename('NDBI');
  
  return fusedImage.addBands([
    ndvi, mndwi, ndwi, ndbi, 
    inundationFrequency, validCount, edgeDensity, localStdDev, distToWater, elevation
  ]).select(
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation']
  ).set('year', 2016).set('source', 'L8-Primary, L7-Filler_10m');
};


var composite2016 = process2016Fusion();

// Data Fusion: Merge S2, L8, 2016 into a Collection

// 1. Convert 2016 fused images to Collection format
var fusion2016Col = ee.ImageCollection([composite2016]);

// 2. Merge all datasets
var fullDataPackage = finalTimeSeries
  .merge(l8TimeSeries)
  .merge(fusion2016Col)
  .sort('year');


// 3. Batch display (2014-2024 one click preview)
fullDataPackage.aggregate_array('year').evaluate(function(years) {
  years.forEach(function(year) {
    var img = fullDataPackage.filter(ee.Filter.eq('year', year)).first();
    Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Final_' + year, false);
  });
});


// 4. Output package
var exportBands = [
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 
  'NDVI', 'mNDWI', 'NDWI', 'NDBI', 
  'inund_freq', 'valid_count', 'edge_density', 'nir_stdDev', 'dist_water', 'elevation'
];

fullDataPackage.aggregate_array('year').evaluate(function(years) {
  years.forEach(function(year) {
   
    var imgToExport = fullDataPackage.filter(ee.Filter.eq('year', year)).first();
    
    var finalImg = imgToExport.select(exportBands).float();

    Export.image.toAsset({
      image: finalImg,
      description: 'LYG_15_features_' + year,
      assetId: 'projects/my-project-20260224-488410/assets/LYG_TimeSeries_Stacks_1/LYG_Stack_' + year,
      region: finalRegion2024,
      scale: 10,
      maxPixels: 1e13,
      crs: 'EPSG:4326',
    });
  });
});

