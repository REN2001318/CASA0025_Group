// =============================================================================
// Shorebird Habitat Assessment — Blue Corridor
// 01  Habitat Accessibility — sketch-based redesign
// Lianyungang Coastal Wetland · Jiangsu · China
// =============================================================================


// ---------- 1. CONFIG (unchanged) ------------------------------------------

var CONFIG = {
  studyArea:    'projects/ee-summerxxxa99/assets/LYG_Final',
  roostAsset:   'projects/ee-summerxxxa99/assets/roost_30m_2024',
  tidalPrefix:  'projects/ee-summerxxxa99/assets/tidalflat_all/TidalFlat_',
  tidalSuffix:  '',
  referenceYear: '2024',
  availableYears: [
    '2014','2015','2016','2017','2018','2019',
    '2020','2021','2022','2023','2024'
  ],
  scale:        100,
  maxDistPx:    256,
  crs:          'EPSG:4326',
  defaultT1:    1.7,
  defaultT2:    2.8,
  defaultT3:    6.2,
  // Slider ceiling for each threshold (used by gauges too)
  maxT1:        5,
  maxT2:        10,
  maxT3:        12
};


// ---------- 2. STYLE TOKENS -------------------------------------------------

var COLOR = {
  ocean:       '#3c91e6',
  oceanLight:  '#7ab7e8',
  oceanDark:   '#2a73c0',
  green:       '#9fd356',
  greenDark:   '#7eb53a',
  coral:       '#fa824c',
  coralDark:   '#e36636',
  yellow:      '#f5c84a',
  shadow:      '#342e37',
  porcelain:   '#fafffd',
  bg:          '#f3f6f5',
  card:        '#ffffff',
  text:        '#2a2630',
  textSoft:    '#5b5566',
  textMute:    '#8a8395',
  line:        '#e6eaec',
  lineStrong:  '#cdd5dc',
  grey:        '#9aa6b1'
};

var STYLE = {

  // ---------- Branding ----------
  brandEyebrow: {
    fontSize: '19px',
    fontWeight: 'bold',
    color: '#083D77',
    margin: '0 0 4px 14px',
    padding: '0',
    backgroundColor: COLOR.bg
  },
  
  brandTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#083D77',
    margin: '0 0 4px 14px',
    padding: '0',
    whiteSpace: 'wrap',
    backgroundColor: COLOR.bg
  },
  
  brandPlace: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#F95738',
    margin: '0 0 12px 14px',
    padding: '0',
    backgroundColor: COLOR.bg
  },

  // ---------- Section labels ----------
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: COLOR.textMute,
    margin: '14px 0 6px 0',
    padding: '0'
  },

  // ---------- Cards ----------
  card: {
    backgroundColor: COLOR.card,
    border: '1px solid ' + COLOR.line,
    padding: '14px 16px',
    margin: '0 0 6px 0',
    borderRadius: '13px'
  },

  cardTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: COLOR.shadow,
    margin: '0 0 4px 0',
    padding: '0'
  },

  cardHint: {
    fontSize: '10.5px',
    color: COLOR.textMute,
    margin: '0 0 10px 0',
    padding: '0',
    whiteSpace: 'wrap'
  },

  // ---------- Tabs ----------
  tab: {
    backgroundColor: COLOR.card,
    color: COLOR.text,
    fontSize: '11px',
    padding: '6px 6px',
    margin: '0 2px 0 0',
    stretch: 'horizontal',
    borderRadius: '4px'
  },

  tabActive: {
  backgroundColor: '#BBDEF0', // the frame color of 'EXPLORATION MODULE'
  color: '#083D77',
  fontWeight: 'bold',
  fontSize: '11px',
  padding: '3px 3px',
  margin: '0 8px 0 8px',
  stretch: 'horizontal',
  borderRadius: '4px'
},

  // ---------- Gauges ----------
  gaugePanel: {
    margin: '0 4px',
    padding: '0',
    width: '190px'
  },

  gaugeLabel: {
    fontSize: '10.5px',
    fontWeight: 'bold',
    color: COLOR.shadow,
    textAlign: 'center',
    margin: '2px 0 0 0',
    padding: '0',
    stretch: 'horizontal'
  },

  slider: {
    stretch: 'horizontal',
    margin: '0 0 4px 0'
  },

  // ---------- Buttons ----------
  btnPrimary: {
    backgroundColor: '#083D77',
    color: '#083D77',
    fontWeight: 'bold',
    fontSize: '12px',
    padding: '12px 24px',
    margin: '12px 0 4px 0',
    stretch: 'horizontal',
    borderRadius: '12px'
  },

  // ---------- Dropdown ----------
  caption: {
    fontSize: '11.5px',
    color: COLOR.shadow,
    fontWeight: 'bold',
    margin: '6px 0 2px 0',
    padding: '0'
  },

  select: {
    stretch: 'horizontal',
    margin: '0 0 6px 0'
  },

  // ---------- Results ----------
  subHeader: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: COLOR.ocean,
    margin: '10px 0 6px 0',
    padding: '0',
    stretch: 'horizontal'
  },

  classRow: {
    fontSize: '11px',
    color: COLOR.textSoft,
    margin: '2px 0',
    padding: '0'
  },

  classDot: function(c) {
    return {
      backgroundColor: c,
      padding: '5px 9px',
      margin: '3px 6px 3px 0',
      border: '1px solid ' + COLOR.line
    };
  },

  totalLabel: {
    fontSize: '13px',
    color:'#083D77',
    fontWeight: 'bold',
    margin: '20px 0 0 0',
    padding: '0'
  },

  emptyTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: COLOR.shadow,
    margin: '2px 0 4px 0',
    padding: '0'
  },

  emptyState: {
    fontSize: '12px',
    color: COLOR.textMute,
    margin: '0 0 4px 0',
    padding: '0',
    whiteSpace: 'wrap'
  },

  resultRow: {
    fontSize: '11.5px',
    color: '#8C8C8C',
    margin: '1px 0',
    padding: '0'
  },

  resultGood: {
    fontSize: '11.5px',
    color: '#2EC4B6',
    fontWeight: 'bold',
    margin: '1px 0',
    padding: '0'
  },

  resultBad: {
    fontSize: '11.5px',
    color:  '#FF595E',
    fontWeight: 'bold',
    margin: '1px 0',
    padding: '0'
  },

  resultEm: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: COLOR.shadow,
    margin: '4px 0',
    padding: '0'
  },

  // ---------- Inspector ----------
  inspectorPanel: {
    position: 'bottom-right',
    padding: '10px 14px',
    width: '270px',
    backgroundColor: COLOR.porcelain,
    border: '1px solid ' + COLOR.line,
    margin: '0 12px 12px 0'
  },

  inspectorTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: COLOR.textMute,
    margin: '0 0 6px 0',
    padding: '0'
  },

  inspectorBody: {
    fontSize: '11px',
    color: COLOR.textSoft,
    margin: '0',
    padding: '0',
    whiteSpace: 'wrap'
  }

};


// ---------- 3. DATA LOADING (unchanged) -------------------------------------

var studyArea = ee.FeatureCollection(CONFIG.studyArea).geometry();

function loadTidalFlat(year) {
  var id = CONFIG.tidalPrefix + year + CONFIG.tidalSuffix;
  return ee.Image(id).select(0).eq(1).selfMask().clip(studyArea);
}

var tidalRef = loadTidalFlat(CONFIG.referenceYear);

var roostRaw = ee.Image(CONFIG.roostAsset).select(0).eq(1).selfMask();

var permWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence').gt(95);

var roost = roostRaw
  .updateMask(permWater.not())
  .updateMask(tidalRef.unmask(0).not())
  .clip(studyArea);


// ---------- 4. DISTANCE RASTERS (lazy) --------------------------------------

function computeDistToRoost() {
  return roost
    .fastDistanceTransform(CONFIG.maxDistPx).sqrt()
    .multiply(ee.Image.pixelArea().sqrt())
    .reproject({crs: CONFIG.crs, scale: CONFIG.scale});
}
function computeDistToTidal() {
  return tidalRef
    .fastDistanceTransform(CONFIG.maxDistPx).sqrt()
    .multiply(ee.Image.pixelArea().sqrt())
    .reproject({crs: CONFIG.crs, scale: CONFIG.scale});
}


// ---------- 5. UI HELPERS ---------------------------------------------------

function makeDivider(extra) {
  return ui.Panel({style: {
    height: '1px', backgroundColor: COLOR.line,
    margin: extra || '8px 0', stretch: 'horizontal'
  }});
}

function sectionLabel(text) {
  return ui.Label(text.toUpperCase(), STYLE.sectionLabel);
}

function card(widgets) {
  var p = ui.Panel({style: STYLE.card});
  for (var i = 0; i < widgets.length; i++) p.add(widgets[i]);
  return p;
}

function clearLayers() {
  var layers = map.layers();
  while (layers.length() > BASE_LAYER_N) {
    layers.remove(layers.get(layers.length() - 1));
  }
}

function groupedArea(classImage, callback) {
  var areaImg = ee.Image.pixelArea()
    .addBands(classImage.rename('cls'));
  var stats = areaImg.reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1}),
    geometry: studyArea, scale: CONFIG.scale, maxPixels: 1e9
  });
  stats.evaluate(function(result) {
    var out = {};
    if (result && result.groups) {
      result.groups.forEach(function(g) { out[g.group] = g.sum / 1e6; });
    }
    callback(out);
  });
}

/** Donut chart for the Scenario Summary blocks */
function makeDonut(names, values, colours) {
  var data = [['Class', 'Area']];
  for (var i = 0; i < names.length; i++) data.push([names[i], values[i]]);
  return ui.Chart(data)
    .setChartType('PieChart')
    .setOptions({
      colors: colours,
      pieHole: 0.55,
      legend: {position: 'none'},
      pieSliceText: 'percentage',
      pieSliceTextStyle: {color: '#ffffff', fontSize: 10, bold: true},
      backgroundColor: COLOR.card,
      width: 200,
      height: 180,
      chartArea: {left: 4, top: 4, width: '96%', height: '90%'},
      fontName: 'Roboto'
    });
}

/** Bar chart for the Scenario Summary blocks */
function makeBarChart(names, values, colours) {
  var data = [['Class', 'Area', {role: 'style'}]];

  for (var i = 0; i < names.length; i++) {
    data.push([names[i], values[i], 'color:' + colours[i]]);
  }

  return ui.Chart(data)
    .setChartType('ColumnChart')
    .setOptions({
      backgroundColor: COLOR.card,
      width: 420,
      height: 240,
      legend: {position: 'none'},
      chartArea: {left: 55, top: 20, width: '78%', height: '70%'},
      hAxis: {
        textStyle: {fontSize: 11, bold: true, color: '#083D77'}
      },
      vAxis: {
        title: 'Area (km²)',
        titleTextStyle: {italic: false, fontSize: 11},
        textStyle: {fontSize: 10},
        gridlines: {color: '#E5E7EB'}
      },
      bar: {groupWidth: '58%'}
    });
}


/** Number + colored fill that sits flush against the slider below */
function makeIntegratedMeter(value, maxVal, color) {

  var TOTAL_W = METER_W;   // ← 和 slider 一致
  var fillW = Math.max(2, Math.round((value / maxVal) * TOTAL_W));
  var restW = Math.max(0, TOTAL_W - fillW);

  var bigNum = ui.Label(value.toFixed(1) + ' km', {
    fontSize: '18px',
    fontWeight: 'bold',
    color: color,
    textAlign: 'center',
    margin: '4px 0 4px 0',
    padding: '0',
    width: TOTAL_W + 'px'
  });

  var bar = ui.Panel({
    widgets: [
      ui.Label('', {
        backgroundColor: color,
        width: fillW + 'px',
        height: '8px',
        margin: '0',
        padding: '0'
      }),
      ui.Label('', {
        backgroundColor: COLOR.line,
        width: restW + 'px',
        height: '8px',
        margin: '0',
        padding: '0'
      })
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {
      width: TOTAL_W + 'px',
      padding: '0',
      margin: '0'
    }
  });

  return ui.Panel({
    widgets: [bigNum, bar],
    style: {
      width: TOTAL_W + 'px',
      padding: '0',
      margin: '0'
    }
  });
}

/** Render a class-breakdown row: colour dot + label + value */
function classRow(colour, range, name, value) {
  return ui.Panel({
    widgets: [
      ui.Label('', STYLE.classDot(colour)),
      ui.Label(range + '  ·  ' + name, {
        fontSize: '11px', color: COLOR.shadow,
        margin: '4px 6px 4px 0', padding: '0', stretch: 'horizontal'
      }),
      ui.Label(value.toFixed(2) + ' km²', {
        fontSize: '11px', fontWeight: 'bold',
        color: COLOR.shadow, margin: '4px 0', padding: '0',
        textAlign: 'right'
      })
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {stretch: 'horizontal', padding: '0', margin: '0'}
  });
}

/** Two-column block: class breakdown list (left) + donut (right) */
function summaryBlock(headerText, names, ranges, values, colours, totalLabel) {
  var leftCol = ui.Panel({
    style: {width: '270px', padding: '0', margin: '0 8px 0 0'}
  });
  for (var i = 0; i < names.length; i++) {
    leftCol.add(classRow(colours[i], ranges[i], names[i], values[i]));
  }
  var total = values.reduce(function(a,b){return a+b;},0);
    leftCol.add(
    ui.Panel({
      widgets: [
  
        ui.Label(totalLabel + ': ', {
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#083D77',
          margin: '0',
          padding: '0'
        }),
  
        ui.Label(total.toFixed(2) + ' km²', {
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#F95738',
          margin: '0',
          padding: '0'
        })
  
      ],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        margin: '20px 0 0 0',
        padding: '0'
      }
    })
  );

  var rightCol = ui.Panel({
    widgets: [makeDonut(names, values, colours)],
    style: {padding: '0', margin: '0'}
  });

  var block = ui.Panel({
    style: {stretch: 'horizontal', padding: '0', margin: '4px 0 8px 0'}
  });
  block.add(ui.Label(headerText, STYLE.subHeader));
  block.add(ui.Panel({
    widgets: [leftCol, rightCol],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {stretch: 'horizontal', padding: '0', margin: '0'}
  }));
  return block;
}

function buildLegend(title, colours, labels) {
  legendPanel.clear();
  legendPanel.add(ui.Label(title, STYLE.cardTitle));
  for (var i = 0; i < colours.length; i++) {
    legendPanel.add(ui.Panel({
      widgets: [
        ui.Label('', {
          backgroundColor: colours[i],
          padding: '7px 24px',
          margin: '2px 8px 2px 0',
          border: '1px solid ' + COLOR.line
        }),
        ui.Label(labels[i], {
          fontSize: '11px', color: COLOR.textSoft,
          margin: '4px 0', padding: '0'
        })
      ],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {padding: '0', margin: '0'}
    }));
  }
}


// ---------- 6. UI FRAMEWORK -------------------------------------------------

ui.root.clear();

var map = ui.Map();
map.setCenter(119.26, 34.80, 12);
map.setOptions('HYBRID');
map.setControlVisibility({
  drawingToolsControl: false, layerList: true,
  zoomControl: true, scaleControl: true,
  mapTypeControl: false, fullscreenControl: true
});

var BASE_LAYER_N = 0;

// Wider sidebar to fit 3 gauges in a row
var ctrlPanel = ui.Panel({
  style: {
    width: '680px',
    padding: '20px 18px 20px 20px',
    backgroundColor: COLOR.bg
  }
});

// --- Title block (Blue Corridor branding)
ctrlPanel.add(ui.Label('BLUE CORRIDOR:', STYLE.brandEyebrow));
ctrlPanel.add(ui.Label(
  'Estuarine Habitat Dynamics for Migratory Birds',
  STYLE.brandTitle));
ctrlPanel.add(ui.Label(
  'Lianyungang Coastal Wetland · Jiangsu · China',
  STYLE.brandPlace));

ctrlPanel.add(makeDivider('4px 0 12px 0'));


// --- Module tabs (3 buttons, active state highlighted)

var modeBtns = {};
function setActiveMode(mode) {
  modeBtns.proximity.style().set(mode === 'proximity' ? STYLE.tabActive : STYLE.tab);
  modeBtns.change.style().set(mode === 'change' ? STYLE.tabActive : STYLE.tab);

  proxPanel.style().set('shown', mode === 'proximity');
  chgPanel.style().set('shown', mode === 'change');

  clearLayers();

  resultsPanel.clear();
  resultsPanel.add(ui.Label('Ready to analyse.', STYLE.emptyTitle));
  resultsPanel.add(ui.Label(
    'Select a module and run analysis.',
    STYLE.emptyState
  ));

  legendPanel.clear();
  legendPanel.add(ui.Label(
    'Legend appears here once an analysis is run.',
    STYLE.emptyState
  ));
}

modeBtns.proximity = ui.Button({
  label: '01 ACCESSIBILITY',
  onClick: function() { setActiveMode('proximity'); },
  style: STYLE.tabActive
});
modeBtns.change = ui.Button({
  label: '02 CHANGE OVER TIME',
  onClick: function() { setActiveMode('change'); },
  style: STYLE.tab
});

ctrlPanel.add(ui.Panel({
  widgets: [

    ui.Label('EXPLORATION MODULE', {
      fontSize: '13px',
      fontWeight: 'bold',
      color: COLOR.shadow,
      margin: '0 0 12px 0',
      padding: '0'
    }),

    ui.Panel({
      widgets: [modeBtns.proximity, modeBtns.change],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        stretch: 'horizontal',
        padding: '0',
        margin: '0'
      }
    })

  ],

  style: {
    stretch: 'horizontal',
    padding: '16px',
    margin: '0 0 12px 0',
    backgroundColor: COLOR.card,
    border: '1px solid ' + COLOR.line,
    borderRadius: '12px'
  }

}));


// ---------- 6A. PROXIMITY PANEL — gauge-style thresholds -------------------
var METER_W = 120;   
var SLIDER_W = 190;  

var SLIDER_STYLE = {
  width: SLIDER_W + 'px',
  margin: '-12px 0 2px 0',
  fontSize: '0px',
  color: COLOR.porcelain
};

var rowT1 = {slider: ui.Slider({
  min: 0.5, max: CONFIG.maxT1,
  value: CONFIG.defaultT1, step: 0.1,
  style: SLIDER_STYLE
})};

var rowT2 = {slider: ui.Slider({
  min: 0.5, max: CONFIG.maxT2,
  value: CONFIG.defaultT2, step: 0.1,
  style: SLIDER_STYLE
})};

var rowT3 = {slider: ui.Slider({
  min: 1.0, max: CONFIG.maxT3,
  value: CONFIG.defaultT3, step: 0.2,
  style: SLIDER_STYLE
})};

// Gauge containers — chart is at index 0 of each, swapped on slider change
var gauge1Panel = ui.Panel({style: STYLE.gaugePanel});
var gauge2Panel = ui.Panel({style: STYLE.gaugePanel});
var gauge3Panel = ui.Panel({style: STYLE.gaugePanel});

gauge1Panel.add(makeIntegratedMeter(CONFIG.defaultT1, CONFIG.maxT1, '#F07167'));
gauge1Panel.add(rowT1.slider);
gauge1Panel.add(ui.Label('Optimal threshold (km)', STYLE.gaugeLabel));

gauge2Panel.add(makeIntegratedMeter(CONFIG.defaultT2, CONFIG.maxT2, '#00AFB9'));
gauge2Panel.add(rowT2.slider);
gauge2Panel.add(ui.Label('Sub-optimal threshold (km)', STYLE.gaugeLabel));

gauge3Panel.add(makeIntegratedMeter(CONFIG.defaultT3, CONFIG.maxT3, '#0081A7'));
gauge3Panel.add(rowT3.slider);
gauge3Panel.add(ui.Label('Marginal threshold (km)', STYLE.gaugeLabel));

// Live-update each gauge when its slider changes
rowT1.slider.onChange(function(v) {
  gauge1Panel.widgets().set(0, makeIntegratedMeter(v, CONFIG.maxT1, '#F07167'));
});

rowT2.slider.onChange(function(v) {
  gauge2Panel.widgets().set(0, makeIntegratedMeter(v, CONFIG.maxT2, '#00AFB9'));
});

rowT3.slider.onChange(function(v) {
  gauge3Panel.widgets().set(0, makeIntegratedMeter(v, CONFIG.maxT3, '#0081A7'));
});

var gaugesRow = ui.Panel({
  widgets: [gauge1Panel, gauge2Panel, gauge3Panel],
  layout: ui.Panel.Layout.Flow('horizontal'),
  style: {stretch: 'horizontal', padding: '0', margin: '10px 0 0 0'}
});

var btnProximity = ui.Button({
  label: ' ▶  Genetrate Scenario',
  style: {
    backgroundColor: '#ffffff',
    color: '#083D77',
    fontWeight: 'bold',
    fontSize: '12px',
    padding: '10px 24px',
    margin: '24px 0 4px 0',
    stretch: 'horizontal',
    border: '0px'
  }
});



var proxPanel = card([
  ui.Label('Ecological Movement Thresholds', STYLE.cardTitle),
  ui.Label(
    'Adjust the gauges to test how movement-distance assumptions ' +
    'reshape the habitat-accessibility classification. ' +
    'Defaults follow Ma et al. (2023) and Rogers et al. (2006).',
    STYLE.cardHint
  ),
  gaugesRow,
  btnProximity
]);
ctrlPanel.add(proxPanel);


// ---------- 6B. CHANGE PANEL (kept from previous redesign) -----------------

var dropA = {
  caption: ui.Label('Baseline year', STYLE.caption),
  select:  ui.Select({items: CONFIG.availableYears,
            value: CONFIG.availableYears[0], style: STYLE.select})
};
var dropB = {
  caption: ui.Label('Comparison year', STYLE.caption),
  select:  ui.Select({items: CONFIG.availableYears,
            value: CONFIG.availableYears[CONFIG.availableYears.length-1],
            style: STYLE.select})
};
var btnChange = ui.Button({
  label: '▶  Detect Habitat Change',
  style: {
    backgroundColor: '#ffffff',
    color: '#083D77',
    fontWeight: 'bold',
    fontSize: '12px',
    padding: '10px 24px',
    margin: '24px 0 4px 0',
    stretch: 'horizontal',
    border: '0px'
  }
});
var chgPanel = card([
  ui.Label('Compare Habitat Extent Over Time', STYLE.cardTitle),
  ui.Label(
    'Choose a baseline year and a comparison year. The map will reveal ' +
    'stable, newly gained, and lost tidal-flat areas.', STYLE.cardHint),
  ui.Panel({
    widgets: [
      ui.Panel({
        widgets: [dropA.caption, dropA.select],
        style: {
          width: '45%',
          margin: '0 50px 0 0',
          padding: '0'
        }
      }),
      ui.Panel({
        widgets: [dropB.caption, dropB.select],
        style: {
          width: '45%',
          margin: '0',
          padding: '0'
        }
      })
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {
      stretch: 'horizontal',
      margin: '8px 6 12px 6',
      padding: '0'
    }
  }),
  btnChange
]);
chgPanel.style().set('shown', false);
ctrlPanel.add(chgPanel);





// ---------- 6D. SCENARIO SUMMARY -------------------------------------------

var resultsPanel = ui.Panel({
  widgets: [
    ui.Label('SCENARIO SUMMARY', {
      fontSize: '13px',
      fontWeight: 'bold',
      color: COLOR.shadow,
      margin: '0 0 12px 0',
      padding: '0'
    })
  ],
  style: STYLE.card
});

ctrlPanel.add(resultsPanel);


// ---------- 6E. DYNAMIC LEGEND ---------------------------------------------

var legendPanel = ui.Panel({
  widgets: [
    ui.Label('DYNAMIC LEGEND', {
      fontSize: '13px',
      fontWeight: 'bold',
      color: COLOR.shadow,
      margin: '0 0 12px 0',
      padding: '0'
    })
  ],
  style: STYLE.card
});

ctrlPanel.add(legendPanel);


// ---------- 6F. INITIAL EMPTY STATE ----------------------------------------

resultsPanel.add(ui.Label('Ready to analyse.', STYLE.emptyTitle));
resultsPanel.add(ui.Label(
  'Select a module and run analysis.', STYLE.emptyState));

legendPanel.add(ui.Label(
  'Legend appears here once an analysis is run.', STYLE.emptyState));


// ---------- 7. LAYOUT -------------------------------------------------------

ui.root.add(ui.SplitPanel({
  firstPanel:  ctrlPanel,
  secondPanel: map,
  orientation: 'horizontal',
  wipe: false
}));


// ---------- 9A. PROXIMITY ANALYSIS (logic unchanged, output redesigned) ----

btnProximity.onClick(function() {

  var distToRoost = computeDistToRoost();
  var distToTidal = computeDistToTidal();

  var t1 = rowT1.slider.getValue() * 1000;
  var t2 = rowT2.slider.getValue() * 1000;
  var t3 = rowT3.slider.getValue() * 1000;
  t2 = Math.max(t2, t1 + 100);
  t3 = Math.max(t3, t2 + 100);

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

  clearLayers();

  var tidalPal = ['#0B3C5D','#328CC1','#7FB3D5','#D9EAF4'];
  var roostPal = ['#1B5E20','#43A047','#A5D6A7','#E8F5E9'];

  map.addLayer(tidalClass,
    {min: 1, max: 4, palette: tidalPal},
    'Tidal flat — distance to nearest roost');
  map.addLayer(roostClass,
    {min: 1, max: 4, palette: roostPal},
    'Roost — distance to nearest feeding');

  // Class range strings for the breakdown rows
  var t1km = (t1/1000).toFixed(1),
      t2km = (t2/1000).toFixed(1),
      t3km = (t3/1000).toFixed(1);
  var ranges = [
    '< ' + t1km + ' km',
    t1km + '–' + t2km + ' km',
    t2km + '–' + t3km + ' km',
    '> ' + t3km + ' km'
  ];
  var classNames = ['Optimal', 'Sub-optimal', 'Marginal', 'Beyond range'];

  resultsPanel.clear();
  resultsPanel.add(ui.Label('Habitat Accessibility', STYLE.cardTitle));
  resultsPanel.add(ui.Label(
    'Thresholds: ' + t1km + ' / ' + t2km + ' / ' + t3km + ' km',
    STYLE.cardHint));
  resultsPanel.add(ui.Label('Computing area statistics …', STYLE.emptyState));

  groupedArea(tidalClass, function(tAreas) {

    var tVals = [];
    for (var i = 1; i <= 4; i++) tVals.push(tAreas[i] || 0);

    groupedArea(roostClass, function(rAreas) {

      var rVals = [];
      for (var j = 1; j <= 4; j++) rVals.push(rAreas[j] || 0);

      // Rebuild results panel with both sub-blocks
      resultsPanel.clear();
      resultsPanel.add(ui.Label('Habitat Accessibility', STYLE.cardTitle));
      resultsPanel.add(ui.Label(
        'Thresholds: ' + t1km + ' / ' + t2km + ' / ' + t3km + ' km',
        STYLE.cardHint));

      // Block 1 — Feeding habitat accessibility
      resultsPanel.add(summaryBlock(
        'Feeding Habitat Accessibility',
        classNames, ranges, tVals, tidalPal,
        'Feeding habitat'));

      resultsPanel.add(makeDivider('6px 0'));

      // Block 2 — Roost-feeding connectivity
      resultsPanel.add(summaryBlock(
        'Roost-Feeding Connectivity',
        classNames, ranges, rVals, roostPal,
        'Roost area'));
    });
  });

  // Dynamic legend
    buildLegend(
    'Habitat Accessibility Classes',
    tidalPal.concat(roostPal),
    [
      'Tidal · Optimal',
      'Tidal · Sub-optimal',
      'Tidal · Marginal',
      'Tidal · Beyond range',
  
      'Roost · Optimal',
      'Roost · Sub-optimal',
      'Roost · Marginal',
      'Roost · Beyond range'
    ]
  );
});


// ---------- 9B. CHANGE ANALYSIS (logic unchanged) --------------------------

btnChange.onClick(function() {

  var yA = dropA.select.getValue();
  var yB = dropB.select.getValue();

  if (yA === yB) {
    resultsPanel.clear();
    resultsPanel.add(ui.Label('Temporal Habitat Change', STYLE.cardTitle));
    resultsPanel.add(ui.Label('Please select two different years.',
      {fontSize: '12px', color: COLOR.coralDark, fontWeight: 'bold',
       margin: '4px 0', padding: '0'}));
    return;
  }
  if (Number(yA) > Number(yB)) { var tmp = yA; yA = yB; yB = tmp; }

  var tfA = loadTidalFlat(yA).unmask(0);
  var tfB = loadTidalFlat(yB).unmask(0);

  var changeImg = ee.Image.constant(0)
    .where(tfA.eq(1).and(tfB.eq(1)), 1)
    .where(tfA.eq(0).and(tfB.eq(1)), 2)
    .where(tfA.eq(1).and(tfB.eq(0)), 3)
    .selfMask().clip(studyArea);

  clearLayers();
  var chgPal = ['#DDDDDD', '#2EC4B6', '#FF595E'];
  map.addLayer(changeImg, {min:1,max:3,palette:chgPal},
    'Tidal-flat change ' + yA + ' → ' + yB);
  map.addLayer(loadTidalFlat(yA), {palette:[COLOR.oceanLight]},
    'Tidal flat ' + yA, false);
  map.addLayer(loadTidalFlat(yB), {palette:[COLOR.ocean]},
    'Tidal flat ' + yB, false);

  resultsPanel.clear();
  resultsPanel.add(ui.Label('Temporal Habitat Change', STYLE.cardTitle));
  resultsPanel.add(ui.Label('Computing change …', STYLE.emptyState));

  groupedArea(changeImg, function(areas) {
    var stable = areas[1] || 0, gain = areas[2] || 0, loss = areas[3] || 0;
    var totA = stable + loss, totB = stable + gain;
    var net = gain - loss, pct = totA > 0 ? (net / totA) * 100 : 0;

    resultsPanel.clear();
    resultsPanel.add(ui.Label('Temporal Habitat Change', STYLE.cardTitle));
    resultsPanel.add(ui.Label(yA + '  →  ' + yB, STYLE.cardHint));
    resultsPanel.add(ui.Label('Tidal-flat extent', STYLE.subHeader));
    resultsPanel.add(ui.Label(yA+' baseline   '+totA.toFixed(2)+' km²', STYLE.resultRow));
    resultsPanel.add(ui.Label(yB+' comparison '+totB.toFixed(2)+' km²', STYLE.resultRow));
    resultsPanel.add(ui.Label('Change classes', STYLE.subHeader));
    resultsPanel.add(ui.Label('Stable   '+stable.toFixed(2)+' km²', STYLE.resultRow));
    resultsPanel.add(ui.Label('Gain   + '+gain.toFixed(2)+' km²', STYLE.resultGood));
    resultsPanel.add(ui.Label('Loss   − '+loss.toFixed(2)+' km²', STYLE.resultBad));
    resultsPanel.add(ui.Label(
      'Net change   '+(net>=0?'+':'')+net.toFixed(2)+' km²   ('+
      (net>=0?'+':'')+pct.toFixed(1)+' %)', STYLE.resultEm));
    resultsPanel.add(makeBarChart(
  ['Stable','Gain','Loss'], [stable,gain,loss], chgPal));
  });

  buildLegend('Tidal-flat change', chgPal,
    ['Stable · habitat in both years',
     'Gain · new in ' + yB,
     'Loss · lost from ' + yA]);
});



// ---------- 10. MAP CLICK INSPECTOR (kept disabled) ------------------------

var inspectorPanel = ui.Panel({style: STYLE.inspectorPanel});
inspectorPanel.add(ui.Label('POINT INSPECTOR', STYLE.inspectorTitle));
inspectorPanel.add(ui.Label(
  'Distance inspection runs only when you click a module button — ' +
  'keeps the app fast on first load.',
  STYLE.inspectorBody));
map.add(inspectorPanel);

map.onClick(function(coords) {
  inspectorPanel.clear();
  inspectorPanel.add(ui.Label('POINT INSPECTOR', STYLE.inspectorTitle));
  inspectorPanel.add(ui.Label(
    'Lat ' + coords.lat.toFixed(4) + '  ·  Lon ' + coords.lon.toFixed(4),
    {fontSize: '10.5px', color: COLOR.textMute,
     margin: '0 0 4px 0', padding: '0'}));
  inspectorPanel.add(ui.Label(
    'Run a module to enable on-map distance lookup.',
    STYLE.inspectorBody));
});


// END — initial state shows "Ready to analyse"; no auto-run.
