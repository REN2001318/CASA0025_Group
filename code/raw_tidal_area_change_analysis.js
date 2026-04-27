// ==========================================
// 1. LOAD DATA (keep original raster data unchanged)
// ==========================================
var tidal2014 = ee.Image("projects/bigdata25-494213/assets/Final_TidalFlat_Raster_2014-2015");
var tidal2019 = ee.Image("projects/bigdata25-494213/assets/Final_TidalFlat_Raster_2019_30m");
var tidal2024 = ee.Image("projects/bigdata25-494213/assets/Final_TidalFlat_Raster_2024_30m_1");

// Convert to binary (0/1)
tidal2014 = tidal2014.gt(0);
tidal2019 = tidal2019.gt(0);
tidal2024 = tidal2024.gt(0);

// ==========================================
// 2. CHANGE CALCULATION (basic temporal difference)
// ==========================================
var change_14_24 = tidal2024.subtract(tidal2014);
var change_14_19 = tidal2019.subtract(tidal2014);
var change_19_24 = tidal2024.subtract(tidal2019);

// ==========================================
// 3. CREATE CLEAN MASK (remove manually drawn areas + remove background)
// ==========================================
var allOne = ee.Image.constant(1);
var boxZero = ee.Image.constant(0).clip(RemoveArea);

// This mask sets the manually drawn polygon area to transparent
var keepMask = allOne.blend(boxZero);

// Core logic:
// 1) Mask out manually defined error regions (urban / misclassified areas)
// 2) Remove zero-value pixels (no-change areas) to eliminate white background
var change_14_24_clean = change_14_24
  .updateMask(keepMask)
  .updateMask(change_14_24.neq(0));

var change_14_19_clean = change_14_19
  .updateMask(keepMask)
  .updateMask(change_14_19.neq(0));

var change_19_24_clean = change_19_24
  .updateMask(keepMask)
  .updateMask(change_19_24.neq(0));

// ==========================================
// 4. DISPLAY (visualised on transparent background)
// ==========================================
Map.centerObject(tidal2024, 10);

// Overall change (2014–2024)
Map.addLayer(change_14_24_clean, {
  min: -1,
  max: 1,
  palette: ['red','white','green'] // white will not appear (masked out)
}, 'Change 2014–2024 (No White Background)');

// Stage change 2014–2019 (hidden by default)
Map.addLayer(change_14_19_clean, {
  min: -1,
  max: 1,
  palette: ['red','white','green']
}, 'Change 2014–2019 (No White Background)', false);

// Stage change 2019–2024 (hidden by default)
Map.addLayer(change_19_24_clean, {
  min: -1,
  max: 1,
  palette: ['red','white','green']
}, 'Change 2019–2024 (No White Background)', false);

// Loss and gain visualisation
var loss_clean = change_14_24_clean.eq(-1);
var gain_clean = change_14_24_clean.eq(1);

Map.addLayer(loss_clean.selfMask(), {palette:['red']}, 'Tidal Loss 2014–2024');
Map.addLayer(gain_clean.selfMask(), {palette:['green']}, 'Tidal Gain 2014–2024');

// ==========================================
// 5. EXPORT IMAGE (clean transparent raster)
// ==========================================
Export.image.toDrive({
  image: change_14_24_clean, // exported image has transparent background
  description: 'Tidal_Change_2014_2024_Clean',
  folder: 'GEE_Tidal_Exports',
  region: tidal2024.geometry(),
  scale: 30,
  maxPixels: 1e13
});

// ==========================================
// 6. AREA CHANGE CSV EXPORT (independent from mask)
// ==========================================
function calcAreaKm2(img, label) {
  var areaImage = img.selfMask()
    .multiply(ee.Image.pixelArea())
    .rename('area');

  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: tidal2024.geometry(),
    scale: 60,
    maxPixels: 1e13,
    bestEffort: true,
    tileScale: 16
  });

  return ee.Feature(null, {
    period: label,
    area_km2: ee.Number(stats.get('area')).divide(1e6)
  });
}

var f2014 = calcAreaKm2(tidal2014, '2014–2015');
var f2019 = calcAreaKm2(tidal2019, '2019');
var f2024 = calcAreaKm2(tidal2024, '2024');

var a2014 = ee.Number(f2014.get('area_km2'));
var a2019 = ee.Number(f2019.get('area_km2'));
var a2024 = ee.Number(f2024.get('area_km2'));

var changeTable = ee.FeatureCollection([
  f2014.set({
    change_from_previous_km2: null,
    change_rate_from_previous_pct: null
  }),

  f2019.set({
    change_from_previous_km2: a2019.subtract(a2014),
    change_rate_from_previous_pct: a2019.subtract(a2014).divide(a2014).multiply(100)
  }),

  f2024.set({
    change_from_previous_km2: a2024.subtract(a2019),
    change_rate_from_previous_pct: a2024.subtract(a2019).divide(a2019).multiply(100),
    total_change_from_2014_km2: a2024.subtract(a2014),
    total_change_from_2014_pct: a2024.subtract(a2014).divide(a2014).multiply(100)
  })
]);

Export.table.toDrive({
  collection: changeTable,
  description: 'TidalFlat_Area_Change_2014_2019_2024',
  folder: 'GEE_Tidal_Exports',
  fileFormat: 'CSV'
});

// ==========================================
// 7. HIDE DRAWING TOOLS (remove blue polygons from view)
// ==========================================
Map.drawingTools().setShown(false);