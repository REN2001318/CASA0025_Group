// =============================================================================
// Shorebird Habitat Assessment Tool
// Study Area: Lianyungang Coastal Zone, Jiangsu, China
//
// Three analysis modes:
//   1. Proximity Analysis – classify tidal flat & roost by mutual distance
//      with adjustable thresholds (2024 roost, latest tidal flat)
//   2. Tidal Flat Change  – compare tidal flat extent between two user-
//      selected years (flexible asset naming)
//   3. Priority Assessment – identify underserved tidal flat (habitat gaps)
//      and rank roost by accessible feeding area
//
// Distance thresholds default to Ma et al. (2023) / Rogers et al. (2006):
//   Optimal  < 1.7 km
//   Sub-opt  1.7 – 2.8 km
//   Marginal 2.8 – 6.2 km
//   Beyond   > 6.2 km
//
// Resolution note:
//   fastDistanceTransform(256) at 100 m scale → max detectable ≈ 12.8 km.
//   Slider capped at 10 km for proximity thresholds.


var CONFIG = {
  studyArea:    'projects/copper-booster-488414-p6/assets/LYG_Final',
  roostAsset:   'projects/copper-booster-488414-p6/assets/roost_30m_2024',
  // Tidal-flat asset path = PREFIX + year + SUFFIX
  tidalPrefix:  'projects/copper-booster-488414-p6/assets/Final_TidalFlat_Raster_',
  tidalSuffix:  '_30m',
  // The year used for roost cleaning and proximity / priority analysis
  referenceYear: '2023',
  // Years available for the change analysis — UPDATE this list if you add
  // new annual tidal-flat assets to your GEE project
  availableYears: [
    '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'
  ],
  scale:        100,          // analysis resolution in metres
  maxDistPx:    256,          // fastDistanceTransform neighbourhood (pixels)
  crs:          'EPSG:4326',
  // Default distance thresholds (km) – literature values
  defaultT1:    1.7,
  defaultT2:    2.8,
  defaultT3:    6.2
};


//  SECTION 2 – DATA LOADING                  

var studyArea = ee.FeatureCollection(CONFIG.studyArea).geometry();

/**
 * Load a binary tidal-flat mask for a given year.
 * Assumes asset value 1 = tidal flat.  Returns a selfMask()ed image clipped
 * to the study area so that non-tidal pixels are masked out.
 */
function loadTidalFlat(year) {
  var id = CONFIG.tidalPrefix + year + CONFIG.tidalSuffix;
  return ee.Image(id).select(0).eq(1).selfMask().clip(studyArea);
}

// Reference tidal flat (latest available year, used for proximity & priority)
var tidalRef = loadTidalFlat(CONFIG.referenceYear);

// Roost mask (2024) – cleaned of permanent water and tidal-flat overlap
var roostRaw = ee.Image(CONFIG.roostAsset).select(0).eq(1).selfMask();

// JRC permanent-water mask (pixels wet >95 % of observed time)
var permWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence').gt(95);

var roost = roostRaw
  .updateMask(permWater.not())
  .updateMask(tidalRef.unmask(0).not())
  .clip(studyArea);

// Sentinel-2 true-colour composite for basemap
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filterDate(CONFIG.referenceYear + '-01-01',
              CONFIG.referenceYear + '-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(studyArea);


// SECTION 3 – PRE-COMPUTE DISTANCE RASTERS (once, reused by all modes) 

//
// fastDistanceTransform returns SQUARED distance in pixel units.
// After .sqrt() we have distance in pixels.  Multiply by pixel side-length
// (≈ scale metres after reproject) to obtain distance in metres.
//
// The trailing .reproject() forces the entire chain to execute at
// CONFIG.scale, so the neighbourhood of 256 pixels covers
// 256/2 × 100 m ≈ 12.8 km – sufficient for our max slider of 10 km.

var distToRoost = roost
  .fastDistanceTransform(CONFIG.maxDistPx).sqrt()
  .multiply(ee.Image.pixelArea().sqrt())
  .reproject({crs: CONFIG.crs, scale: CONFIG.scale});

var distToTidal = tidalRef
  .fastDistanceTransform(CONFIG.maxDistPx).sqrt()
  .multiply(ee.Image.pixelArea().sqrt())
  .reproject({crs: CONFIG.crs, scale: CONFIG.scale});


// SECTION 4 – UI FRAMEWORK                           


ui.root.clear();

// Map
var map = ui.Map();
map.centerObject(studyArea, 11);
map.setOptions('HYBRID');
map.addLayer(s2,
  {bands: ['B4','B3','B2'], min: 200, max: 3000},
  'Sentinel-2 ' + CONFIG.referenceYear, true, 0.6);

// Number of "permanent" base layers (basemap only).
// All analysis layers added later sit on top and can be removed.
var BASE_LAYER_N = 1;

// Control panel (left)
var ctrlPanel = ui.Panel({style: {width: '380px', padding: '8px'}});

// Title block
ctrlPanel.add(ui.Label('Shorebird Habitat Assessment',
  {fontSize: '18px', fontWeight: 'bold', margin: '0 0 2px 0'}));
ctrlPanel.add(ui.Label('Lianyungang Coastal Wetland · Jiangsu · China',
  {fontSize: '12px', color: '#555', margin: '0 0 4px 0'}));
ctrlPanel.add(ui.Label(
  'Assess shorebird habitat quality by analysing tidal-flat / roost ' +
  'proximity, temporal change in tidal-flat extent, and spatial ' +
  'conservation priority.  Distance thresholds follow Ma et al. (2023).',
  {fontSize: '11px', color: '#888', margin: '0 0 10px 0', whiteSpace: 'wrap'}
));

// Mode selector
ctrlPanel.add(ui.Label('Analysis mode', {fontWeight: 'bold', fontSize: '13px'}));
var modeSelect = ui.Select({
  items: [
    {label: '1 · Proximity Analysis',  value: 'proximity'},
    {label: '2 · Tidal-Flat Change',   value: 'change'},
    {label: '3 · Priority Assessment',  value: 'priority'}
  ],
  value: 'proximity',
  style: {stretch: 'horizontal', margin: '0 0 6px 0'}
});
ctrlPanel.add(modeSelect);
ctrlPanel.add(makeDivider());


// SECTION 4A – PROXIMITY PANEL       


var proxPanel = ui.Panel({style: {margin: '2px 0'}});

proxPanel.add(ui.Label('Distance thresholds',
  {fontWeight: 'bold', fontSize: '13px'}));
proxPanel.add(ui.Label(
  'Defaults from literature (Ma et al. 2023 / Rogers et al. 2006).  ' +
  'Drag sliders to test sensitivity.',
  {fontSize: '10px', color: '#888', margin: '0 0 4px 0'}
));

// Slider helpers
function makeThresholdRow(labelText, defaultVal, min, max, step) {
  var lbl = ui.Label(labelText, {fontSize: '12px', margin: '4px 0 0 0'});
  var slider = ui.Slider({
    min: min, max: max, value: defaultVal, step: step,
    style: {stretch: 'horizontal', margin: '0 0 2px 0'}
  });
  return {label: lbl, slider: slider};
}

var rowT1 = makeThresholdRow('Optimal  (<  T₁ km):', CONFIG.defaultT1, 0.5, 5,  0.1);
var rowT2 = makeThresholdRow('Sub-opt  (T₁–T₂ km):', CONFIG.defaultT2, 0.5, 10, 0.1);
var rowT3 = makeThresholdRow('Marginal (T₂–T₃ km):', CONFIG.defaultT3, 1.0, 12, 0.2);

proxPanel.add(rowT1.label); proxPanel.add(rowT1.slider);
proxPanel.add(rowT2.label); proxPanel.add(rowT2.slider);
proxPanel.add(rowT3.label); proxPanel.add(rowT3.slider);

var btnProximity = ui.Button({
  label: '▶  Run proximity analysis',
  style: {stretch: 'horizontal', margin: '6px 0 0 0'}
});
proxPanel.add(btnProximity);

ctrlPanel.add(proxPanel);

// SECTION 4B – CHANGE PANEL   


var chgPanel = ui.Panel({style: {margin: '2px 0', shown: false}});

chgPanel.add(ui.Label('Tidal-flat area change',
  {fontWeight: 'bold', fontSize: '13px'}));
chgPanel.add(ui.Label(
  'Select two years to compare tidal-flat extent.  Green = gain, Red = loss.',
  {fontSize: '10px', color: '#888', margin: '0 0 4px 0'}
));

var selYearA = ui.Select({
  items: CONFIG.availableYears,
  value: CONFIG.availableYears[0],
  style: {stretch: 'horizontal'}
});
var selYearB = ui.Select({
  items: CONFIG.availableYears,
  value: CONFIG.availableYears[CONFIG.availableYears.length - 1],
  style: {stretch: 'horizontal'}
});

chgPanel.add(ui.Label('Start year:'));
chgPanel.add(selYearA);
chgPanel.add(ui.Label('End year:'));
chgPanel.add(selYearB);

var btnChange = ui.Button({
  label: '▶  Compare years',
  style: {stretch: 'horizontal', margin: '6px 0 0 0'}
});
chgPanel.add(btnChange);

ctrlPanel.add(chgPanel);


// SECTION 4C – PRIORITY PANEL                               


var priPanel = ui.Panel({style: {margin: '2px 0', shown: false}});

priPanel.add(ui.Label('Priority assessment',
  {fontWeight: 'bold', fontSize: '13px'}));
priPanel.add(ui.Label(
  'Identify tidal flat beyond effective roost distance (habitat gap) ' +
  'and isolated roosts far from feeding ground.',
  {fontSize: '10px', color: '#888', margin: '0 0 4px 0'}
));

var priSlider = ui.Slider({
  min: 1, max: 10, value: CONFIG.defaultT3, step: 0.2,
  style: {stretch: 'horizontal'}
});
priPanel.add(ui.Label('Effective distance threshold (km):'));
priPanel.add(priSlider);

var btnPriority = ui.Button({
  label: '▶  Compute priority',
  style: {stretch: 'horizontal', margin: '6px 0 0 0'}
});
priPanel.add(btnPriority);

ctrlPanel.add(priPanel);


// SECTION 4D – RESULTS & LEGEND                          

ctrlPanel.add(makeDivider());
ctrlPanel.add(ui.Label('Results', {fontWeight: 'bold', fontSize: '13px'}));
var resultsPanel = ui.Panel();
ctrlPanel.add(resultsPanel);

ctrlPanel.add(makeDivider());
var legendPanel = ui.Panel();
ctrlPanel.add(legendPanel);


// SECTION 5 – LAYOUT                                

ui.root.add(ui.SplitPanel({
  firstPanel:  ctrlPanel,
  secondPanel: map,
  orientation: 'horizontal',
  wipe: false
}));

//  SECTION 6 – UTILITY FUNCTIONS                       


/** Horizontal divider line */
function makeDivider() {
  return ui.Panel({
    style: {height: '1px', backgroundColor: '#ddd', margin: '6px 0'}
  });
}

/** Remove all layers added on top of the basemap */
function clearLayers() {
  var layers = map.layers();
  while (layers.length() > BASE_LAYER_N) {
    layers.remove(layers.get(layers.length() - 1));
  }
}

/** Build a colour legend in the legend panel */
function buildLegend(title, colours, labels) {
  legendPanel.clear();
  legendPanel.add(ui.Label(title,
    {fontWeight: 'bold', fontSize: '12px', margin: '0 0 4px 0'}));
  for (var i = 0; i < colours.length; i++) {
    legendPanel.add(ui.Panel({
      widgets: [
        ui.Label('', {
          backgroundColor: colours[i],
          padding: '8px 14px',
          margin: '1px 6px 1px 0',
          border: '1px solid #bbb'
        }),
        ui.Label(labels[i], {fontSize: '11px', margin: '2px 0'})
      ],
      layout: ui.Panel.Layout.Flow('horizontal')
    }));
  }
}

/**
 * Compute area (km²) grouped by integer class values.
 * Calls `callback(areasObj)` where areasObj = {classValue: areaKm2, …}.
 */
function groupedArea(classImage, callback) {
  var areaImg = ee.Image.pixelArea()
    .addBands(classImage.rename('cls'));
  var stats = areaImg.reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1}),
    geometry: studyArea,
    scale: CONFIG.scale,
    maxPixels: 1e9
  });
  stats.evaluate(function(result) {
    var out = {};
    if (result && result.groups) {
      result.groups.forEach(function(g) {
        out[g.group] = g.sum / 1e6;   // m² → km²
      });
    }
    callback(out);
  });
}

/**
 * Make a bar chart from class labels and area values.
 * Returns a ui.Chart widget.
 */
function makeBarChart(title, labels, values, colours) {
  // Build a DataTable manually so we can control bar colours
  var header = [['Class', 'Area (km²)', {role: 'style'}]];
  var rows = [];
  for (var i = 0; i < labels.length; i++) {
    rows.push([labels[i], values[i], colours[i]]);
  }
  var dataTable = header.concat(rows);

  var chart = ui.Chart(dataTable)
    .setChartType('ColumnChart')
    .setOptions({
      title: title,
      titleTextStyle: {fontSize: 12},
      legend: {position: 'none'},
      hAxis: {textStyle: {fontSize: 10}},
      vAxis: {title: 'km²', textStyle: {fontSize: 10}},
      bar: {groupWidth: '70%'},
      height: 200
    });
  return chart;
}


// SECTION 7 – MODE SWITCHING                                    

modeSelect.onChange(function(mode) {
  proxPanel.style().set('shown', mode === 'proximity');
  chgPanel.style().set('shown',  mode === 'change');
  priPanel.style().set('shown',  mode === 'priority');
});


// SECTION 8A – PROXIMITY ANALYSIS                                 

btnProximity.onClick(function() {

  // Read thresholds (km → m) and enforce T1 < T2 < T3
  var t1 = rowT1.slider.getValue() * 1000;
  var t2 = rowT2.slider.getValue() * 1000;
  var t3 = rowT3.slider.getValue() * 1000;
  t2 = Math.max(t2, t1 + 100);
  t3 = Math.max(t3, t2 + 100);

  // Classify tidal flat by distance to nearest roost 
  // Class 1 = optimal, 2 = sub-opt, 3 = marginal, 4 = beyond
  var tidalClass = ee.Image.constant(4)
    .where(distToRoost.lte(t3), 3)
    .where(distToRoost.lte(t2), 2)
    .where(distToRoost.lte(t1), 1)
    .updateMask(tidalRef)
    .clip(studyArea);

  // Classify roost by distance to nearest feeding ground 
  var roostClass = ee.Image.constant(4)
    .where(distToTidal.lte(t3), 3)
    .where(distToTidal.lte(t2), 2)
    .where(distToTidal.lte(t1), 1)
    .updateMask(roost)
    .clip(studyArea);

  // Map layers
  clearLayers();

  var tidalPal = ['#1565C0','#42A5F5','#AB47BC','#E0E0E0'];
  var roostPal = ['#2E7D32','#66BB6A','#FDD835','#E0E0E0'];

  map.addLayer(tidalClass,
    {min: 1, max: 4, palette: tidalPal},
    'Tidal flat → nearest roost');

  map.addLayer(roostClass,
    {min: 1, max: 4, palette: roostPal},
    'Roost → nearest feeding');

  // Labels
  var classLabels = [
    '< ' + (t1/1000).toFixed(1) + ' km  (Optimal)',
    (t1/1000).toFixed(1) + ' – ' + (t2/1000).toFixed(1) + ' km  (Sub-opt)',
    (t2/1000).toFixed(1) + ' – ' + (t3/1000).toFixed(1) + ' km  (Marginal)',
    '> ' + (t3/1000).toFixed(1) + ' km  (Beyond)'
  ];

  // Area stats
  resultsPanel.clear();
  resultsPanel.add(ui.Label('Computing areas …', {color: '#999'}));

  groupedArea(tidalClass, function(tAreas) {
    resultsPanel.clear();

    // Tidal-flat table
    resultsPanel.add(ui.Label('Tidal-flat area by distance to roost',
      {fontWeight: 'bold', fontSize: '12px'}));

    var tVals = [];
    var totalTidal = 0;
    for (var i = 1; i <= 4; i++) {
      var v = tAreas[i] || 0;
      tVals.push(v);
      totalTidal += v;
      resultsPanel.add(ui.Label(
        classLabels[i-1] + ':  ' + v.toFixed(2) + ' km²',
        {fontSize: '11px'}));
    }
    resultsPanel.add(ui.Label(
      'Total:  ' + totalTidal.toFixed(2) + ' km²',
      {fontSize: '11px', fontWeight: 'bold'}));

    // Chart
    resultsPanel.add(makeBarChart(
      'Tidal-flat area by roost distance',
      classLabels, tVals, tidalPal));

    // Roost table
    groupedArea(roostClass, function(rAreas) {
      resultsPanel.add(ui.Label('Roost area by distance to feeding',
        {fontWeight: 'bold', fontSize: '12px', margin: '10px 0 0 0'}));

      var rVals = [];
      var totalRoost = 0;
      for (var j = 1; j <= 4; j++) {
        var rv = rAreas[j] || 0;
        rVals.push(rv);
        totalRoost += rv;
        resultsPanel.add(ui.Label(
          classLabels[j-1] + ':  ' + rv.toFixed(2) + ' km²',
          {fontSize: '11px'}));
      }
      resultsPanel.add(ui.Label(
        'Total:  ' + totalRoost.toFixed(2) + ' km²',
        {fontSize: '11px', fontWeight: 'bold'}));

      resultsPanel.add(makeBarChart(
        'Roost area by feeding distance',
        classLabels, rVals, roostPal));
    });
  });

  // Legend
  buildLegend('Proximity classes',
    tidalPal.concat(roostPal),
    classLabels.map(function(l){return 'Tidal: '+l;})
      .concat(classLabels.map(function(l){return 'Roost: '+l;}))
  );
});


// SECTION 8B – TIDAL-FLAT CHANGE ANALYSIS       

// Change classification:
//   1 = Stable   (present in both years)
//   2 = Gain     (absent in start year, present in end year)
//   3 = Loss     (present in start year, absent in end year)

btnChange.onClick(function() {

  var yA = selYearA.getValue();
  var yB = selYearB.getValue();

  if (yA === yB) {
    resultsPanel.clear();
    resultsPanel.add(ui.Label('⚠  Please select two different years.',
      {color: '#D32F2F'}));
    return;
  }

  // Ensure chronological order
  if (Number(yA) > Number(yB)) {
    var tmp = yA; yA = yB; yB = tmp;
  }

  var tfA = loadTidalFlat(yA).unmask(0);
  var tfB = loadTidalFlat(yB).unmask(0);

  var changeImg = ee.Image.constant(0)
    .where(tfA.eq(1).and(tfB.eq(1)), 1)   // stable
    .where(tfA.eq(0).and(tfB.eq(1)), 2)   // gain
    .where(tfA.eq(1).and(tfB.eq(0)), 3)   // loss
    .selfMask()
    .clip(studyArea);

  // Map layers
  clearLayers();

  var chgPal = ['#78909C', '#4CAF50', '#EF5350'];
  map.addLayer(changeImg,
    {min: 1, max: 3, palette: chgPal},
    'Change ' + yA + ' → ' + yB);

  // Also add individual year layers (off by default for reference)
  map.addLayer(loadTidalFlat(yA), {palette: ['#90CAF9']},
    'Tidal flat ' + yA, false);
  map.addLayer(loadTidalFlat(yB), {palette: ['#42A5F5']},
    'Tidal flat ' + yB, false);

  // Area stats
  resultsPanel.clear();
  resultsPanel.add(ui.Label('Computing change …', {color: '#999'}));

  groupedArea(changeImg, function(areas) {
    var stable = areas[1] || 0;
    var gain   = areas[2] || 0;
    var loss   = areas[3] || 0;
    var totA   = stable + loss;
    var totB   = stable + gain;
    var net    = gain - loss;
    var pct    = totA > 0 ? ((net / totA) * 100) : 0;

    resultsPanel.clear();
    resultsPanel.add(ui.Label(
      'Tidal-flat change: ' + yA + ' → ' + yB,
      {fontWeight: 'bold', fontSize: '12px'}));

    resultsPanel.add(ui.Label(yA + ' extent:  ' + totA.toFixed(2) + ' km²'));
    resultsPanel.add(ui.Label(yB + ' extent:  ' + totB.toFixed(2) + ' km²'));
    resultsPanel.add(ui.Label('Stable:        ' + stable.toFixed(2) + ' km²'));
    resultsPanel.add(ui.Label('Gain:        + ' + gain.toFixed(2) + ' km²',
      {color: '#388E3C'}));
    resultsPanel.add(ui.Label('Loss:        − ' + loss.toFixed(2) + ' km²',
      {color: '#D32F2F'}));
    resultsPanel.add(ui.Label(
      'Net change:  ' + (net >= 0 ? '+' : '') + net.toFixed(2) + ' km²  (' +
      (net >= 0 ? '+' : '') + pct.toFixed(1) + ' %)',
      {fontWeight: 'bold'}));

    // Chart
    resultsPanel.add(makeBarChart(
      'Area change (' + yA + ' → ' + yB + ')',
      ['Stable', 'Gain', 'Loss'],
      [stable, gain, loss],
      chgPal));
  });

  buildLegend('Tidal-flat change',
    chgPal,
    ['Stable (both years)',
     'Gain  (new in ' + yB + ')',
     'Loss  (lost from ' + yA + ')']);
});


// SECTION 8C – PRIORITY ASSESSMENT                                

//
// Two outputs:
//   A.  Tidal-flat priority gradient  –  distance / threshold, clamped [0,1].
//       0 (blue) = well-served by nearby roost.
//       1 (red)  = at or beyond effective distance → habitat gap, priority
//                  for roost creation or tidal-flat restoration.
//
//   B.  Roost status  –  connected (within threshold of feeding) vs isolated.
//
// Summary statistics:
//   - Served vs unserved (gap) tidal-flat area
//   - Connected vs isolated roost area

btnPriority.onClick(function() {

  var threshM = priSlider.getValue() * 1000;

  // Tidal-flat priority score: 0 (close) → 1 (far / gap)
  var priorityImg = distToRoost
    .min(threshM)
    .divide(threshM)
    .updateMask(tidalRef)
    .clip(studyArea);

  // Binary served/gap classification for stats
  var tidalBin = ee.Image.constant(2)           // 2 = gap
    .where(distToRoost.lte(threshM), 1)          // 1 = served
    .updateMask(tidalRef)
    .clip(studyArea);

  // Roost connectivity
  var roostBin = ee.Image.constant(2)           // 2 = isolated
    .where(distToTidal.lte(threshM), 1)          // 1 = connected
    .updateMask(roost)
    .clip(studyArea);

  // Map layers
  clearLayers();

  map.addLayer(priorityImg,
    {min: 0, max: 1, palette: ['#1565C0','#FFF176','#E53935']},
    'Tidal-flat priority');

  map.addLayer(roostBin.eq(1).selfMask(),
    {palette: ['#4CAF50']}, 'Roost – connected');
  map.addLayer(roostBin.eq(2).selfMask(),
    {palette: ['#FF7043']}, 'Roost – isolated');

  // Stats
  resultsPanel.clear();
  resultsPanel.add(ui.Label('Computing priority …', {color: '#999'}));

  groupedArea(tidalBin, function(tAreas) {
    var served = tAreas[1] || 0;
    var gap    = tAreas[2] || 0;
    var total  = served + gap;
    var servPct = total > 0 ? ((served / total) * 100).toFixed(1) : '0';
    var gapPct  = total > 0 ? ((gap / total) * 100).toFixed(1) : '0';

    resultsPanel.clear();
    resultsPanel.add(ui.Label(
      'Priority (threshold ' + (threshM/1000).toFixed(1) + ' km)',
      {fontWeight: 'bold', fontSize: '12px'}));

    resultsPanel.add(ui.Label('── Tidal flat ──',
      {fontSize: '11px', color: '#666', margin: '4px 0 0 0'}));
    resultsPanel.add(ui.Label(
      'Served:  ' + served.toFixed(2) + ' km²  (' + servPct + ' %)'));
    resultsPanel.add(ui.Label(
      'Gap:     ' + gap.toFixed(2) + ' km²  (' + gapPct + ' %)',
      {color: '#D32F2F', fontWeight: 'bold'}));
    resultsPanel.add(ui.Label(
      'Total:   ' + total.toFixed(2) + ' km²'));

    // Chart for tidal flat
    resultsPanel.add(makeBarChart(
      'Tidal-flat served vs gap',
      ['Served', 'Gap'],
      [served, gap],
      ['#1565C0', '#E53935']));

    // Roost stats
    groupedArea(roostBin, function(rAreas) {
      var conn = rAreas[1] || 0;
      var iso  = rAreas[2] || 0;
      var rTot = conn + iso;
      var connPct = rTot > 0 ? ((conn / rTot) * 100).toFixed(1) : '0';

      resultsPanel.add(ui.Label('── Roost ──',
        {fontSize: '11px', color: '#666', margin: '8px 0 0 0'}));
      resultsPanel.add(ui.Label(
        'Connected:  ' + conn.toFixed(2) + ' km²  (' + connPct + ' %)'));
      resultsPanel.add(ui.Label(
        'Isolated:   ' + iso.toFixed(2) + ' km²',
        {color: '#FF7043'}));
      resultsPanel.add(ui.Label(
        'Total:      ' + rTot.toFixed(2) + ' km²'));

      resultsPanel.add(makeBarChart(
        'Roost connected vs isolated',
        ['Connected', 'Isolated'],
        [conn, iso],
        ['#4CAF50', '#FF7043']));
    });
  });

  buildLegend('Priority assessment',
    ['#1565C0', '#FFF176', '#E53935', '#4CAF50', '#FF7043'],
    ['Tidal: well-served (score ≈ 0)',
     'Tidal: moderate',
     'Tidal: gap / priority (score ≈ 1)',
     'Roost: connected',
     'Roost: isolated']);
});


// SECTION 9 – MAP CLICK INSPECTOR                           

//
// Clicking the map shows distance-to-roost and distance-to-tidal at that
// point, helping users inspect specific locations.

var inspectorPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '6px 10px',
    width: '260px'
  }
});
inspectorPanel.add(ui.Label('Click map to inspect distances',
  {fontSize: '11px', color: '#888'}));
map.add(inspectorPanel);

map.onClick(function(coords) {
  var pt = ee.Geometry.Point([coords.lon, coords.lat]);

  var vals = distToRoost.addBands(distToTidal.rename('distTidal'))
    .rename(['distRoost', 'distTidal'])
    .reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: pt,
      scale: CONFIG.scale
    });

  vals.evaluate(function(result) {
    inspectorPanel.clear();
    inspectorPanel.add(ui.Label('Point inspector',
      {fontWeight: 'bold', fontSize: '12px'}));

    if (result && result.distRoost !== null) {
      var dR = (result.distRoost / 1000).toFixed(2);
      var dT = (result.distTidal / 1000).toFixed(2);
      inspectorPanel.add(ui.Label(
        'Lat ' + coords.lat.toFixed(4) + ', Lon ' + coords.lon.toFixed(4),
        {fontSize: '10px', color: '#888'}));
      inspectorPanel.add(ui.Label('→ Nearest roost:  ' + dR + ' km'));
      inspectorPanel.add(ui.Label('→ Nearest tidal:  ' + dT + ' km'));
    } else {
      inspectorPanel.add(ui.Label('Outside study area or no data.',
        {color: '#999'}));
    }
  });
});


// SECTION 10 – ON LOAD: RUN DEFAULT PROXIMITY ANALYSIS    

// Trigger the proximity analysis with literature defaults so the user sees
// something immediately when the app loads.

// We cannot call btnProximity.onClick() directly; instead, duplicate the
// initial run using a small helper.
(function initRun() {
  // Use the same logic as the button handler but with default values
  var t1 = CONFIG.defaultT1 * 1000;
  var t2 = CONFIG.defaultT2 * 1000;
  var t3 = CONFIG.defaultT3 * 1000;

  var tidalClass = ee.Image.constant(4)
    .where(distToRoost.lte(t3), 3)
    .where(distToRoost.lte(t2), 2)
    .where(distToRoost.lte(t1), 1)
    .updateMask(tidalRef)
    .clip(studyArea);

  var roostClass = ee.Image.constant(4)
    .where(distToTidal.lte(t3), 3)
    .where(distToTidal.lte(t2), 2)
    .where(distToTidal.lte(t1), 1)
    .updateMask(roost)
    .clip(studyArea);

  map.addLayer(tidalClass,
    {min: 1, max: 4, palette: ['#1565C0','#42A5F5','#AB47BC','#E0E0E0']},
    'Tidal flat → nearest roost');
  map.addLayer(roostClass,
    {min: 1, max: 4, palette: ['#2E7D32','#66BB6A','#FDD835','#E0E0E0']},
    'Roost → nearest feeding');

  // Build initial legend
  var defLabels = [
    '< 1.7 km (Optimal)',
    '1.7 – 2.8 km (Sub-opt)',
    '2.8 – 6.2 km (Marginal)',
    '> 6.2 km (Beyond)'
  ];
  buildLegend('Proximity classes (defaults)',
    ['#1565C0','#42A5F5','#AB47BC','#E0E0E0',
     '#2E7D32','#66BB6A','#FDD835','#E0E0E0'],
    defLabels.map(function(l){return 'Tidal: '+l;})
      .concat(defLabels.map(function(l){return 'Roost: '+l;}))
  );

  resultsPanel.add(ui.Label(
    'Default proximity loaded. Adjust thresholds and click ▶ to update.',
    {fontSize: '11px', color: '#888'}));
})();