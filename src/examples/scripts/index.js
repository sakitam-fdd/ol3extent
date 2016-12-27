/**
 * Created by FDD on 2016/12/14.
 */
define(['map', 'appConfig'],
  function (myMap, appConfig) {
    var myMap = new myMap();
    myMap.initMap('map',appConfig.mapConfig);
    myMap.map.getLayers().insertAt(0,myMap.initTdtMap(appConfig.mapConfig.layerConfig.baseLayers[1]));
  });