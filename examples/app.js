/**
 * Created by FDD on 2016/12/14.
 */
require.config({
  paths: {
    'ol':'public/ol-debug',
    'proj':'public/proj4',
    'truf':'public/truf',
    'jquery':'public/jquery',

    'index':'scripts/index',
    'appConfig':'public/map/mapConfig',
    'map':'public/map/map',
    'mapConfig':'public/map/mapConfig',
    'measure':'public/measure/measure',
    'switchLayer':'public/switchLayers/switchLayers',
  },
  shim: {
    'autocomplete': ['jquery'],
    'truf':['jquery'],
    'switchLayer':['ol'],
    'measure':['ol']
  },
  deps: ['index']
});