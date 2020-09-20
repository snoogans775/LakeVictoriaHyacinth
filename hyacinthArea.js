//// ECO-WB Water Hyacinth Project ////
//// Full Gulf Final Script ////
//// By: Joshua Sumers ////
//// Edited 2020-07-05 Kevin Fredericks ////
//// Start Date: 06-25-2019 ////
//// Update Date: 09-12-2019 ////

//Set NE study Area
var FullGulf = LAKEVICTORIA;
Map.centerObject(FullGulf, 7);

//Constants
var DAYS_IN_WEEK = 7;
var CURRENT = Date.now();
var REPORT_START_DATE = '2016-01-01';

//Initial Values
var RANGE = 10;

//Currently Active function
function displayImage(date, range) {
  
  //Get sum of hyacinth for date range
  var hyacinthPresence = getLakeMaskedHyacinth(date, range);
  
  //Render objects on map
  display(hyacinthPresence);
  
  //Log the areas calculated using .multiply
  console.log(date, 'Hyacinth Area: ');
  var area = betterGetArea(hyacinthPresence.image);
  console.log(area.getInfo());

}

//Date slider to define temporal range
var dateSlider = ui.DateSlider('2016-08-01', Date.now(), CURRENT);
dateSlider.style().set({width: '300px', position: 'bottom-left'});

//Export button
var exportButton = ui.Button('Export');
exportButton.style().set({position: 'bottom-left'});

//Range selector
var rangeLabel = ui.Label('Range in Weeks');
var rangeSlider = ui.Slider(0, 48, 8);
rangeLabel.style().set({position: 'bottom-left'});
rangeSlider.style().set({width: '300px', position: 'bottom-left'});

//Attach event functions
dateSlider.onChange( function() {
  CURRENT = parseUTC( dateSlider.getValue()[0] );
  Map.layers().reset();
  displayImage(CURRENT, RANGE) 
});

exportButton.onClick( function() {
  exportImage( getLakeMaskedHyacinth(CURRENT, RANGE) );
});

rangeSlider.onChange( function() {
  RANGE = rangeSlider.getValue() * DAYS_IN_WEEK;
});

//Render Widgets
Map.add(dateSlider);
Map.add(exportButton);
Map.add(rangeLabel);
Map.add(rangeSlider);


//
// ------ BEGIN GIS FUNCTIONS ------ //
//

function getLakeMaskedHyacinth(date, range) {
  var hyacinthObj = getLandsatHyacinth(date, range);
  var waterMaskObj = getWaterMask(LAKEVICTORIA);
  var maskedImage = hyacinthObj.image.updateMask(waterMaskObj.image);
  
  return {image: maskedImage, vis: hyacinthObj.vis, name: 'Hyacinth Presence'};
}

function getLandsatHyacinth(date, range) {
  var startDate = addDays(date, -range);
  var endDate = date;
  
  // import landsat imagery
  var completeLandsat8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR");
  
  
  //filter landsat imagery
  var ls8 = completeLandsat8
   .filter(ee.Filter.date(startDate, endDate))
   //Clip Gulf Boundary
   .map( function(image){return image.clip(LAKEVICTORIA)} );
  
  //Create a band to serve as a Hyacinth Determination based on NDVI greater than 0.4
  // @params Image Landsat 8 Image
  // @returns Image Landsat 8 image with NDVI cutoff at 0.4
  //Create a band to serve as a Hyacinth Determination based on VH value greater than -23
  var HycDet = function(image){
    var cutoffNDVI = 0.4;
    var imageWithNDVI = addNDVI(image);
    var NDVI = imageWithNDVI.select(['NDVI']);
    return image.addBands(ee.Image(1).updateMask(NDVI.gte(cutoffNDVI)).rename('Hyacinth'));
  };
  
  //create new image collection with filtered NDVI
  var finalHyc = ls8.map(HycDet);
  
  
  //create sum presence of hyacinth
  var hycdet = finalHyc.sum();
  
  //set visualization parameters
  var visParm = {
    bands: 'Hyacinth',
    min: 0,
    max: 100,
    palette: ['green', 'white']
  };
  
  return {image: hycdet.select('Hyacinth'), vis: visParm, name: 'Presence of Hyacinth'};
  
}

function getSentinelHyacinth(date, range) {
  //set VH value for analysis
  var VHV = -23;
  
  // import sentinel imagery
  var Sent1 = ee.ImageCollection("COPERNICUS/S1_GRD");
  
  //filter sentinel imagery to include vv+vh
  var vvvh = Sent1
   //VV
   .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
   //VH
   .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  // set to IW mode
   .filter(ee.Filter.eq('instrumentMode', 'IW'))
   //Date
   .filter(ee.Filter.date(addDays(date, -range), date))
   //filter Gulf Boundary
   .filterBounds(FullGulf)
   //Clip Gulf Boundary
   .map(function(image){return image.clip(FullGulf)});
  
  //Create a band to serve as a Hyacinth Determination based on VH value greater than -23
  var HycDet = function(image){
    var VH = image.select(['VH']);
    return image.addBands(ee.Image(1).updateMask(VH.gte(VHV)).rename('Hyacinth'));
  };
  
  var imageCount = function(image){
    var ICV = 1;
    return image.addBands(ee.Image(1).updateMask(ICV).rename('imagecount'));
  };
  
  //create variable that has hyacinth band and image count
  var HyacinthDeter = vvvh.map(HycDet);
  var Imagecounting = HyacinthDeter.map(imageCount);
  
  //select hyacinth band
  var Hyc = Imagecounting.select('Hyacinth');
  
  //Select image number band
  var ICv = Imagecounting.select('imagecount');
  
  //create image collections
  var finalcolHyc = ee.ImageCollection(Hyc);
  var finalcolImageCount = ee.ImageCollection(ICv);
  
  //create count of images
  var totalimagecount = finalcolHyc.size();
  
  //print number of images in collection
  print('Number of images in collection', totalimagecount);
  
  //create sum presence of hyacinth
  var hycdet = finalcolHyc.sum();
  
  //create sum of imagecounts
  var ICV = finalcolImageCount.sum();
  
  //create frequency
  var FQI = hycdet.divide(ICV);
  
  //convert to percent coverage
  var PI = FQI.multiply(100);
  
  //set visualization parameters
  var visParm = {
    bands: 'Hyacinth',
    min: 0,
    max: 100,
    palette: ['white', 'green']
  };
  
  return {image: hycdet, vis: visParm, name: 'Distribution'};
  
}

function getWaterMask(feature) {
  var dataset = ee.Image('USGS/SRTMGL1_003');
  
  var waterMask = dataset.updateMask(dataset.eq(1134))
    .gt(0);
  
  var waterMaskVis = {
  palette: ['red', 'white']
  };
  
  return {image: waterMask, vis: waterMaskVis, name: 'waterMask'};
}

//
// ------ BEGIN CONVERSION FUNCTIONS ------ //
//

function exportImage(inputImage, name) {
  //export frequency image
  Export.image.toDrive({
    image: inputImage,
    description: name,
    maxPixels: 1e13,
    crs: "EPSG:4326",
    scale: 10,
    region: LAKEVICTORIA,
    fileFormat: 'GeoTIFF',
  })
}

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseUTC(timestamp) {
  var date = new Date(timestamp);
  return date;
}

function display(image) {
  Map.addLayer(image.image, image.vis, image.name);
}

function getArea(image) {
  var count = image.gt([0]);
  var total = count.multiply(ee.Image.pixelArea());
  var area = total.reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry:LAKEVICTORIA,
    scale:30,
    maxPixels: 1e9,
    bestEffort:true,
  });
  var areaPixels = ee.Number(area);
  return areaPixels;
}

function betterGetArea(image) {
  var area = image.reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry:LAKEVICTORIA,
    scale:30,
    maxPixels: 2e9
  });
  var areaPixels = ee.Number(area);
  return areaPixels;
}

var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};
