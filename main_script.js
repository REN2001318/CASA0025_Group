/**
 * 连云港候鸟栖息地识别系统 - 核心清洗脚本
 * 包含：NDWI/mNDWI 极值合成、Otsu 阈值、NDVI 筛选及多源数据整合
 */

// 1. 基础范围设置 (保留连云港,10km)

Map.setCenter(119.22, 34.60, 10);
var roi = ee.FeatureCollection("projects/my-project-20260224-488410/assets/LYG_Final");
var finalRegion2024 = roi.geometry();
Map.addLayer(roi, {color: 'red'}, "Study Area");


// --- 第一部分：调取 Sentinel-2 影像堆栈 ---
// 1. 定义 Sentinel-2 专用位掩膜去云函数 (适配老师的 cloudMask 逻辑)
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // 位 10 是云，位 11 是卷云
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // 两个标志都应为 0，表示清晰
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000)
  .copyProperties(image, ["system:time_start", "CLOUDY_PIXEL_PERCENTAGE"]); // 归一化到 0-1 范围，类似老师的 applyScaleFactors
}

//Loop 2016-2024

// 1. 将你的核心处理逻辑封装成一个“加工厂”
var processYearlyData = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds) // 使用老师的稳健去云
    .map(function(img) {
      // 在这里计算 NDVI, mNDWI 等指数（代码同你之前的）
      var ndwi = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
      var mndwi = img.normalizedDifference(['B3', 'B11']).rename('mNDWI');
      var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
      var ndbi = img.normalizedDifference(['B11', 'B8']).rename('NDBI');
      return img.addBands([ndwi, mndwi, ndvi, ndbi, img.select('B12')]);
    });
                  
  // 生成该年份的中值合成图
  var imgCount = col.size();
  var median = col.median()
  .clip(finalRegion2024)
  .set('year', year)
  .set('image_count', imgCount)
  .set('info_list', col.reduceColumns(ee.Reducer.toList(2), ['system:index', 'CLOUDY_PIXEL_PERCENTAGE']).get('list'));
  
  // 返回该年份的合成结果
  return median;
};

// 2. 执行循环（Map 循环）
var yearsList = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
var yearlyList = ee.List(yearsList).map(function(y) { return processYearlyData(y); });
// 将结果转回 ImageCollection 方便管理
var finalTimeSeries = ee.ImageCollection.fromImages(yearlyList);


// 3. 统计每年的影像张数 (使用 GEE 的 map 循环)
finalTimeSeries.select([]).evaluate(function(coll) {
  print('--- 2016-2024 影像工厂统计清单 ---');
  coll.features.forEach(function(f) {
    var props = f.properties;
    print('年份: ' + props.year + ' | 有效影像数: ' + props.image_count);
    if (props.image_count === 0) {
      print('  ⚠️ 警告：该年份在 20% 云量筛选下无可用数据！');
    }
  });
});

var counts = finalTimeSeries.map(function(img) {
  return ee.Feature(null, {
    'year': img.get('year'),
    'image_count': img.get('image_count')
  });
});
print('各年份影像张数明细 (2016-2024):', 
      ee.FeatureCollection(counts).aggregate_array('image_count'));
      
// 2. 批量加载图层 (这里需要把 ee.List 转回 JS Array 才能在循环里用 Map.addLayer)
// 我们使用 .getInfo() 或者是直接对你定义的 yearsList 进行循环
yearsList.forEach(function(year) {
  var img = finalTimeSeries.filter(ee.Filter.eq('year', year)).first();
  // 核心修复：检查影像波段数，如果是 0 就不 Map
  var bands = ee.Image(img).bandNames().size();
  
  // 如果波段数大于 0，才加载图层
  ee.Number(ee.Image(img).bandNames().size()).evaluate(function(bCount) {
    if (bCount > 0) {
      Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, year + ' 选样底图', false);
    }
  });
});



//2014-2017 landsat8
// --- 1. 定义 Landsat 8 专用缩放与去云函数 (严格遵循老师的 C2 L2 标准) ---
function maskL8clouds(image) {
  // 1. 按照老师的公式计算缩放因子 (Scale Factors)
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  
  // 2. 位运算逻辑定义 (Bitmask)
  var qa = image.select('QA_PIXEL');
  var cloudBitMask = (1 << 3);       // 第3位：云
  var cloudShadowBitMask = (1 << 4); // 第4位：云阴影
  
  // 3. 生成掩膜：云和阴影的标志位都必须为 0
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudShadowBitMask).eq(0));

  // 4. 返回处理后的影像：替换原波段、应用掩膜、保留核心时间属性
  return image.addBands(opticalBands, null, true)
    .updateMask(mask)
    .copyProperties(image, ["system:time_start"]); 
}

// --- 2. 定义 Landsat 8 年份加工厂 ---
var processYearlyLandsat = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20)) // 同样坚持 20% 严选
    .map(maskL8clouds);

  var imgCount = col.size();

  // 【核心步骤】：计算指数并进行 10m 插值
  var processed = col.map(function(img) {
    // 重新投影并插值到 10m，使其看起来和 S2 一样丝滑
    var resampled = img.resample('bicubic'); 
    
    var ndvi = resampled.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
    var mndwi = resampled.normalizedDifference(['SR_B3', 'SR_B6']).rename('mNDWI');
    var ndwi = resampled.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI');
    var ndbi = resampled.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');
    
    // 统一波段名称，方便后续机器学习通用
    return resampled.addBands([ndvi, mndwi, ndwi, ndbi])
      .select(['SR_B4', 'SR_B3', 'SR_B2', 'SR_B5', 'SR_B6', 'SR_B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI'], 
              ['B4', 'B3', 'B2', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI']);
  });

  return processed.median()
    .clip(finalRegion2024)
    .set('year', year)
    .set('image_count', imgCount)
    .set('source', 'Landsat 8');
};

// --- 3. 执行 Landsat 循环 (2014-2017) ---
var l8Years = [2014, 2015, 2016, 2017];
var l8List = ee.List(l8Years).map(function(y) { return processYearlyLandsat(y); });
var l8TimeSeries = ee.ImageCollection.fromImages(l8List);

// --- 4. 打印统计与批量加载 ---
l8TimeSeries.select([]).evaluate(function(coll) {
  print('--- 2014-2017 Landsat 8 统计清单 ---');
  coll.features.forEach(function(f) {
    print('年份: ' + f.properties.year + ' | 有效影像数: ' + f.properties.image_count);
  });
});

l8Years.forEach(function(year) {
  var img = l8TimeSeries.filter(ee.Filter.eq('year', year)).first();
  Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, year + ' L8 底图 (Bicubic 10m)', false);
});


//Landsat7+Landsat8 2016

// --- 2. 专门针对 2016 年的融合处理函数 (负责人重构版) ---

/**
 * 严格遵循老师逻辑的 Landsat 7 C2 L2 去云函数
 * 1. 处理反射率缩放
 * 2. 处理 L7 独有的波段偏移
 */
function maskL7clouds(image) {
  // 1. 按照老师的公式计算缩放因子 (L7 C2 L2 同样适用此系数)
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  
  // 2. 位运算逻辑 (Landsat 4-7 的 QA_PIXEL 结构与 L8 基本一致)
  var qa = image.select('QA_PIXEL');
  var cloudBitMask = (1 << 3);       // 第3位：云
  var cloudShadowBitMask = (1 << 4); // 第4位：云阴影
  
  // 3. 生成掩膜
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudShadowBitMask).eq(0));

  // 4. 特殊处理：将 L7 波段重命名为你的“母舰”标准名
  // L7: B1(B), B2(G), B3(R), B4(NIR), B5(SWIR1), B7(SWIR2)
  // 映射到标准: B2, B3, B4, B5, B6, B7
  return image.addBands(opticalBands, null, true)
    .updateMask(mask)
    .select(
      ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'],
      ['B2', 'B3', 'B4', 'B5', 'B6', 'B7']
    )
    .copyProperties(image, ["system:time_start"]);
}

var process2016Fusion = function() {
  var year = 2016;
  var startDate = '2016-01-01';
  var endDate = '2016-12-31';

  // 定义内部加工函数：负责插值和波段对齐
  var prepL8 = function(img) {
    return img.resample('bicubic') // 先插值
      .select(['SR_B4', 'SR_B3', 'SR_B2', 'SR_B5', 'SR_B6', 'SR_B7'], ['B4', 'B3', 'B2', 'B5', 'B6', 'B7']);
  };
  
  var prepL7 = function(img) {
    return img.resample('bicubic') // 先插值
};

  // 获取并预处理 L8 集合
  var l8Col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8clouds)
    .map(prepL8);
    
  var l8Median = l8Col.median();

  // 获取并预处理 L7 集合
  var l7Col = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 40))
    .map(maskL7clouds)
    .map(prepL7);
  
  var l7Median = l7Col.median();

  // 3. 【核心混合逻辑】
  // 使用 unmask：L8 有值用 L8，无值（洞）用 L7 补
  var fusedImage = l8Median.unmask(l7Median);
  
  // 4. 指数计算 (此时 fusedImage 已经是插值后的平滑底图)
  var ndvi = fusedImage.normalizedDifference(['B5', 'B4']).rename('NDVI');
  var mndwi = fusedImage.normalizedDifference(['B3', 'B6']).rename('mNDWI');
  var ndwi = fusedImage.normalizedDifference(['B3', 'B5']).rename('NDWI');
  var ndbi = fusedImage.normalizedDifference(['B6', 'B5']).rename('NDBI');
  
  var finalResult = fusedImage.addBands([ndvi, mndwi, ndwi, ndbi])
    .select(['B4', 'B3', 'B2', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI']); 

  return finalResult.clip(finalRegion2024)
    .set('year', 2016)
    .set('source', 'L8-Primary, L7-Filler');
};


var composite2016 = process2016Fusion();

print('2016年融合后影像信息:', composite2016);

Map.addLayer(composite2016, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, '2016 L7+L8 融合底图 (修复版)');



//数据包提取
// 1. 定义分类器死令：必须且仅有这 9 个特征
var commonBands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDBI'];

// 2. 修正 Sentinel-2 提取 (2018-2024)
var s2Standard = finalTimeSeries.filter(ee.Filter.gt('image_count', 0)).map(function(img) {
  return img.select(
    ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'mNDWI', 'NDBI'], // S2 原名
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDBI']   // 统一映射
  );
});

// 3. 修正 Landsat 8 提取 (2014-2015, 2017)
// 注意：你需要在之前的 processYearlyLandsat 函数里的 select 中补上 SR_B5, SR_B6, SR_B7
var l8Standard = l8TimeSeries.map(function(img) {
  return img.select(
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDBI'], // 此时名字已在工厂里改好
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDBI']
  );
});

// 4. 修正 2016 融合图 (同样强制 select 这 9 个名额)
var fusion2016Standard = ee.ImageCollection([
  composite2016.select(commonBands)
]);

// 5. 合并！现在这个 Collection 里的每一张图，波段数都是 9，绝不报错。
var fullDataPackage = s2Standard.merge(l8Standard).merge(fusion2016Standard);

print('全年度数据包结构确认:', fullDataPackage.map(function(img){
  return ee.Feature(null, {'year': img.get('year'), 'bands': img.bandNames().size()});
}));




// --- 第二部分：Otsu 自动阈值函数定义 ---
var otsu = function(histogram) {
  var counts = ee.Array(ee.Dictionary(histogram).get('histogram'));
  var means = ee.Array(ee.Dictionary(histogram).get('bucketMeans'));
  var size = counts.reduce(ee.Reducer.sum(), [0]);
  var bCnt = counts.length().get([0]);
  var indices = ee.Array(ee.List.sequence(0, bCnt.subtract(1))); 
  var totalMean = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).divide(size);
  var range = ee.List.sequence(1, bCnt.subtract(1));
  
  var bss = range.map(function(i) {
    i = ee.Number(i);
    var countC1 = counts.slice(0, 0, i).reduce(ee.Reducer.sum(), [0]);
    var meanC1 = means.slice(0, 0, i).multiply(counts.slice(0, 0, i))
                 .reduce(ee.Reducer.sum(), [0]).divide(countC1);
    return ee.Number(countC1.multiply(meanC1.subtract(totalMean).pow(2)).get([0]));
  });
  var thresholdIndex = ee.List(bss).indexOf(ee.List(bss).reduce(ee.Reducer.max()));
  return means.get([thresholdIndex]);
};

var s2Col2024 = finalTimeSeries.filter(ee.Filter.eq('year', 2024)).first();

// 提取 2024 潮滩
var histogram = s2Col2024.select('mNDWI').reduceRegion({
  reducer: ee.Reducer.histogram(255, 2),
  geometry: finalRegion2024,
  scale: 30,
  maxPixels: 1e13,
  bestEffort: true
}).get('mNDWI');

var thresholdValue = otsu(histogram);
print('2024 mNDWI Otsu 阈值:', thresholdValue);

var tidalFlat2024 = s2Col2024.select('mNDWI').gt(thresholdValue)
  .updateMask(s2Col2024.select('NDVI').lt(0.2))
  .clip(finalRegion2024)
  .selfMask();

Map.addLayer(tidalFlat2024, {palette: 'blue'}, 'Otsu 2024 潮滩');


// --- 科学调用 Murray 全球潮间带数据集 ---

// 1. 调用集合
var murrayCol = ee.ImageCollection('UQ/murray/Intertidal/v1_1/global_intertidal');

// 2. 筛选时间（选最接近现在的）并取中值/最大值，然后剪裁
// 该数据集分类码：1 代表潮间带 (Intertidal)
var murrayTidalFlat = murrayCol
  .filterBounds(finalRegion2024)
  .filterDate('2014-01-01', '2016-12-31') // 目前 v1.1 更新到 2016 左右，这是最可靠的基准
  .mode() // 取出现频率最高的分类结果
  .select('classification').eq(1) // 只要分类码等于 1 的部分（即潮滩）
  .clip(finalRegion2024)

// 3. 加载到地图，设置为黄色，方便与你的蓝色 Otsu 结果对比
Map.addLayer(murrayTidalFlat.selfMask(), {palette: 'yellow'}, 'Murray 官方参考潮滩');



// --- 第四部分：平均 NDVI 筛选 (<0.2) ---
var avgNDVI = s2Col2024.select('NDVI');
var sparseVeg = avgNDVI.lt(0.2)
    .updateMask(avgNDVI.lt(0.2))
    .clip(finalRegion2024);
    
Map.addLayer(sparseVeg, {palette: 'green'}, '2024低植被区 (NDVI < 0.2)');


//random forest
// --- 修改后的 RF 逻辑：直接挂载母舰 ---

// A. 提取 2024 年作为训练特征图
var trainingImg = fullDataPackage.filter(ee.Filter.eq('year', 2024)).first();

// B. 定义你的样本分类 (假设你已经在 Import 栏画好了 geometry1 和 geometry2)
// geometry1 代表 class 0 (背景/非栖息地)
// geometry2 代表 class 1 (目标栖息地)
var pts_0 = ee.FeatureCollection(geometry1).map(function(f){return f.set('class', 0)});
var pts_1 = ee.FeatureCollection(geometry2).map(function(f){return f.set('class', 1)});
var trainingPolys = pts_0.merge(pts_1);

// C. 采样特征
var bandNames = trainingImg.bandNames(); // 这里就是你选的那 9 个标准化波段
var training = trainingImg.sampleRegions({
  collection: trainingPolys,
  properties: ['class'],
  scale: 10, // 强制 10 米，让 Landsat 自动 bicubic 插值
  tileScale: 4
}).filter(ee.Filter.notNull(bandNames));

// D. 训练分类器
var classifier = ee.Classifier.smileRandomForest(100).train({
  features: training,
  classProperty: 'class',
  inputProperties: bandNames
});

// E. 【核心：全年度自动化分类】
// 现在可以用这个分类器跑遍这 11 年的所有图了！
var classifiedTimeSeries = fullDataPackage.map(function(img) {
  var result = img.classify(classifier);
  return result.set('year', img.get('year'));
});

// 展示 2024 年的分类结果
var result2024 = classifiedTimeSeries.filter(ee.Filter.eq('year', 2024)).first();
Map.addLayer(result2024, {min: 0, max: 1, palette: ['white', 'red']}, 'RF 2024 分类结果');



  
  