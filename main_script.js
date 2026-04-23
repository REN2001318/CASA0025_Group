/**
 * 连云港候鸟栖息地识别系统 - 核心清洗脚本
 * 包含：NDWI/mNDWI 极值合成、Otsu 阈值、NDVI 筛选及多源数据整合
 */

// 1. 基础范围设置 (保留连云港,10km)

Map.setCenter(119.22, 34.60, 10);
var roi = ee.FeatureCollection("projects/my-project-20260224-488410/assets/LYG_Final");
var finalRegion2024 = roi.geometry();
Map.addLayer(roi, {color: 'red'}, "Study Area");

var dem = ee.Image('USGS/SRTMGL1_003')


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

//Loop 2016-2024 Sentinel-2

// 1. 将你的核心处理逻辑封装成一个“加工厂”
var processYearlyData = function(year) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds) // 使用老师的稳健去云
    
    // 1. 【核心动态特征】：对应组员 Step 6
  var waterCol = col.map(function(img) {
    return img.normalizedDifference(['B3', 'B11']).gt(0).rename('water_mask');
  });
  var inundationFrequency = waterCol.reduce(ee.Reducer.mean()).rename('inund_freq');
  
   // 生成该年份的中值合成图
  var imgCount = col.size();
  
  var median = col.median()
  .clip(finalRegion2024)
  .set('year', year)
  .set('image_count', imgCount)
  .set('info_list', col.reduceColumns(ee.Reducer.toList(2), ['system:index', 'CLOUDY_PIXEL_PERCENTAGE']).get('list'));
  
  // 3. 【空间纹理特征】：对应组员 Step 14
  // A. Edge Density
  var mndwi_rf = median.normalizedDifference(['B3', 'B11']);
  
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
  
  //D. NDWI, mNDWI, NDVI, NDBI
  var ndwi = median.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndvi = median.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndbi = median.normalizedDifference(['B11', 'B8']).rename('NDBI');
  
  return median.addBands([
    ndwi, mndwi, ndvi, ndbi, 
    inundationFrequency, edgeDensity, localStdDev, distToWater
  ]).select(
    ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water'],
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water']
  ).set('year', year);
};



// 2. 执行循环（Map 循环）
var yearsList = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
var yearlyList = ee.List(yearsList).map(function(y) { return processYearlyData(y); });
// 将结果转回 ImageCollection 方便管理
var finalTimeSeries = ee.ImageCollection.fromImages(yearlyList);




//Loop 2014-2017 landsat8
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
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8clouds);
    
  var imgCount = col.size();

// --- 【新增：淹没频率计算】 ---
  var waterCol = col.map(function(img) {
    // Landsat 8 的 mNDWI 使用 B3 和 B6
    return img.normalizedDifference(['SR_B3', 'SR_B6']).gt(0).rename('water_mask');
  });
  var inundationFrequency = waterCol.reduce(ee.Reducer.mean()).rename('inund_freq');

  // --- 【生成中值底图】 ---
  // 这里先 resample 再取 median，保证插值效果
  var median = col.map(function(img){ 
    return img.resample('bicubic');
  }).median().clip(finalRegion2024);

  // --- 【空间特征计算】 ---
  var mndwi_rf = median.normalizedDifference(['SR_B3', 'SR_B6']);
  
  // 1. 边缘密度
  var edge = ee.Algorithms.CannyEdgeDetector({image: mndwi_rf, threshold: 0.3, sigma: 1});
  var edgeDensity = edge.reduceNeighborhood({
    reducer: ee.Reducer.mean(), 
    kernel: ee.Kernel.circle(3)
  }).rename('edge_density');

  // 2. 粗糙度 (Landsat 8 的 NIR 是 SR_B5)
  var localStdDev = median.select('SR_B5').reduceNeighborhood({
    reducer: ee.Reducer.stdDev(), 
    kernel: ee.Kernel.square(2)
  }).rename('nir_stdDev');

  // 3. 离水距离
  var distToWater = mndwi_rf.gt(0.2).fastDistanceTransform(30).sqrt().rename('dist_water');

  var ndvi = median.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndwi = median.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI');
  var ndbi = median.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');
    
    // 统一波段名称，方便后续机器学习通用
  return median.addBands([
    ndvi, mndwi, ndwi, ndbi, 
    inundationFrequency, edgeDensity, localStdDev, distToWater
  ]).select(
    // 原始波段名 -> 映射后的标准名
    ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water'],
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water']
  )
  .set('year', year)
  .set('image_count', imgCount)
  .set('source', 'Landsat 8 (10m Bicubic)');
};

// --- 3. 执行 Landsat 循环 (2014-2017) ---
var l8Years = [2014, 2015, 2017];
var l8List = ee.List(l8Years).map(function(y) { return processYearlyLandsat(y); });
var l8TimeSeries = ee.ImageCollection.fromImages(l8List);


//2016 Landsat7+Landsat8

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

// --- 修正后的 2016 融合函数 ---
var process2016Fusion = function() {
  var year = 2016;
  var startDate = '2016-01-01';
  var endDate = '2016-12-31';

  // 1. 获取 L8 集合 (原 SR 名称)
  var l8ColRaw = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8clouds); // 这里的 maskL8clouds 内部要确保不做 resample

  // 2. 获取 L7 集合 (maskL7clouds 内部已经重命名为 B2-B7)
  var l7ColRaw = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterBounds(finalRegion2024)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 40))
    .map(maskL7clouds);

  // --- 【关键修正：跨集合淹没频率计算】 ---
  // 统一用各自集合原始波段算 MNDWI，rename 为 'w' 后合并
  var l8Water = l8ColRaw.map(function(img){ 
    return img.normalizedDifference(['SR_B3', 'SR_B6']).gt(0).rename('w'); 
  });
  var l7Water = l7ColRaw.map(function(img){ 
    // 注意：L7 在 mask 函数里已经把 SR_B2 映射给 B3 了吗？
    // 负责人建议：直接用 L7 的原始 SR 波段最稳
    return img.select('B3','B6').normalizedDifference(['B3', 'B6']).gt(0).rename('w'); 
  });
  var combinedWater = l8Water.merge(l7Water);
  var inundationFrequency = combinedWater.reduce(ee.Reducer.mean()).rename('inund_freq');

  // --- 【关键修正：先插值对齐，再生成底图】 ---
  // L8 底图处理 (重命名为标准 B2-B7)
  var l8Median = l8ColRaw.map(function(img) {
    return img.resample('bicubic').select(
      ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
      ['B2', 'B3', 'B4', 'B5', 'B6', 'B7']
    );
  }).median();

  // L7 底图处理 (maskL7 已经重命名过，只需 resample)
  var l7Median = l7ColRaw.map(function(img) {
    return img.resample('bicubic');
  }).median();

  // 融合：L8 为主，L7 补洞
  var fusedImage = l8Median.unmask(l7Median)
  .clip(finalRegion2024);

  // --- 【空间特征计算】 ---
  var mndwi_rf = fusedImage.normalizedDifference(['B3', 'B6']);
  var edge = ee.Algorithms.CannyEdgeDetector({image: mndwi_rf, threshold: 0.3, sigma: 1});
  var edgeDensity = edge.reduceNeighborhood({
    reducer: ee.Reducer.mean(), 
    kernel: ee.Kernel.circle(3)
  }).rename('edge_density');
  
  // 粗糙度 (在融合后的标准波段中 NIR 是 B5)
  var localStdDev = fusedImage.select('B5').reduceNeighborhood({
    reducer: ee.Reducer.stdDev(), 
    kernel: ee.Kernel.square(2)
  }).rename('nir_stdDev');
  
  // 离水距离
  var distToWater = mndwi_rf.gt(0.2).fastDistanceTransform(30).sqrt().rename('dist_water');
  
  // 4. 指数计算 (此时 fusedImage 已经是插值后的平滑底图)
  var ndvi = fusedImage.normalizedDifference(['B5', 'B4']).rename('NDVI');
  var mndwi = mndwi_rf.rename('mNDWI');
  var ndwi = fusedImage.normalizedDifference(['B3', 'B5']).rename('NDWI');
  var ndbi = fusedImage.normalizedDifference(['B6', 'B5']).rename('NDBI');
  
  // 最终封包
  return fusedImage.addBands([
    ndvi, mndwi, ndwi, ndbi, 
    inundationFrequency, edgeDensity, localStdDev, distToWater
  ]).select(
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'mNDWI', 'NDWI', 'NDBI', 'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water']
  ).set('year', 2016).set('source', 'L8-Primary, L7-Filler_10m');
};


var composite2016 = process2016Fusion();

print('2016年融合后影像信息:', composite2016);


//数据包提取
// --- 数据合体：将 S2, L8, 2016融合 缝合成一个 Collection ---
// 1. 将 2016 融合影像转为 Collection 格式
var fusion2016Col = ee.ImageCollection([composite2016]);

// 2. 合并所有数据集
var fullDataPackage = finalTimeSeries
  .merge(l8TimeSeries)
  .merge(fusion2016Col)
  .sort('year'); // 按年份排序

// 3. 最终检查：打印每一年的波段数，必须全是 14
print('全年度 14 波段数据包确认:', fullDataPackage.map(function(img){
  return ee.Feature(null, {
    'year': img.get('year'),
    'bands': img.bandNames().size(),
    'source': img.get('source')
  });
}));

// 4. 批量展示 (2014-2024 一键预览)
fullDataPackage.aggregate_array('year').evaluate(function(years) {
  years.forEach(function(year) {
    var img = fullDataPackage.filter(ee.Filter.eq('year', year)).first();
    Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Final_' + year, false);
  });
});


//output package
// ============================================================
// 最终版：全年度 14 波段超级数据包导出脚本
// ============================================================

// 1. 定义导出的标准波段顺序（必须与你加工厂中的 select 一致）
var exportBands = [
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 
  'NDVI', 'mNDWI', 'NDWI', 'NDBI', 
  'inund_freq', 'edge_density', 'nir_stdDev', 'dist_water'
];

// 2. 获取年份列表并执行异步导出
fullDataPackage.aggregate_array('year').evaluate(function(years) {
  // 这里的 evaluate 是为了把 GEE 内部列表转为普通 JS 数组，才能在客户端循环
  years.forEach(function(year) {
    // 获取该年份唯一的影像
    var imgToExport = fullDataPackage.filter(ee.Filter.eq('year', year)).first();
    
    // 确保只选择我们需要的 14 个波段，并转为浮点型以节省空间且保留精度
    var finalImg = imgToExport.select(exportBands).float();
    
    // 提交导出任务
    Export.image.toDrive({
      image: finalImg,
      description: 'LYG_FullFeatureStack_' + year, // 任务描述名
      folder: 'GEE_Lianyungang_Project',           // Google Drive 文件夹名
      fileNamePrefix: 'LYG_Stack_' + year,         // 文件名前缀
      region: finalRegion2024,                     // 导出范围（你的 roi.geometry()）
      scale: 10,                                   // 强制 10m 分辨率
      maxPixels: 1e13,                             // 调高上限防止报错
      crs: 'EPSG:4326',                            // WGS84 坐标系
      fileFormat: 'GeoTIFF'                        // 标准地理栅格格式
    });
  });
  
  print('🚀 成功提交 ' + years.length + ' 个年份的导出任务！');
  print('📌 请点击右侧 [Tasks] 选项卡，手动点击每一个年份旁的 [Run] 开始下载。');
});

