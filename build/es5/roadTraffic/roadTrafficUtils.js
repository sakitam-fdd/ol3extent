'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var RoadTraffic = function () {
  function RoadTraffic(config) {
    _classCallCheck(this, RoadTraffic);

    this.version = '1.0.0';
    this.firstLoad = true;
    this.TRAFFIC_INTERVAL = null;
    this.layerName = '手机信令';
    this.trafficLayer = '实时路况'; // 浮动车
    this.config = config;
  }

  /**
   * Traffic自动刷新
   */


  _createClass(RoadTraffic, [{
    key: 'autoRefreshTraffic',
    value: function autoRefreshTraffic() {
      var _this = this;

      this.clearRefreshTrafficInterval();
      this.TRAFFIC_INTERVAL = window.setInterval(function () {
        var now = new Date();
        var min = now.getMinutes();
        if (min % 5 == 0) {
          _this.loadFdcTrafficData(true);
        }
      }, 60 * 1000);
    }

    /**
     * 清除自动刷新
     */

  }, {
    key: 'clearRefreshTrafficInterval',
    value: function clearRefreshTrafficInterval() {
      if (this.TRAFFIC_INTERVAL) {
        window.clearInterval(this.TRAFFIC_INTERVAL);
        this.TRAFFIC_INTERVAL = null;
      }
    }
  }, {
    key: 'clearTrafficLayer',
    value: function clearTrafficLayer() {
      if (this.trafficLayer) {
        this.tileLayer = this.config.Maps.getLayerByName(this.trafficLayer);
        if (this.tileLayer) {
          this.config.Maps.map.removeLayer(this.tileLayer);
        }
      }
    }

    /**
     * 实时路况
     * @param forceReload
     */

  }, {
    key: 'loadFdcTrafficData',
    value: function loadFdcTrafficData(forceReload) {
      this.forceReload = forceReload;
      this.tileLayer = this.config.Maps.getLayerByName(this.trafficLayer);
      if (this.tileLayer) {
        this.config.Maps.map.removeLayer(this.tileLayer);
        if (!this.forceReload) {
          this.clearRefreshTrafficInterval();
          return;
        }
      }
      var trafficServerUrl = this.config.service.trafficServerUrl;
      var timeFlag = new Date().getTime();
      var tileTrafficXYZ = new ol.source.XYZ({
        tileGrid: this.config.service.tileGrid,
        projection: this.config.service.projection,
        tileUrlFunction: function tileUrlFunction(tileCoord) {
          var url = trafficServerUrl.replace('{z}', tileCoord[0].toString()).replace('{x}', tileCoord[1].toString()).replace('{y}', (-tileCoord[2] - 1).toString());
          return url + "&time=" + timeFlag;
        }
      });
      var trafficLayer = new ol.layer.Tile({
        layerName: this.trafficLayer,
        source: tileTrafficXYZ,
        isImage: true
      });
      if (this.config.Maps.map) {
        this.config.Maps.map.addLayer(trafficLayer);
      }
      this.autoRefreshTraffic();
    }

    /**
     * loading
     */

  }, {
    key: 'loading',
    value: function loading() {
      if (this.firstLoad) {
        var html = '<div class="zhezhaos"></div>' + '<div class="loadChaXuns">' + '<div class="load-container load8">' + '<div class="loader"></div>' + '</div>' + '<div class="load1">正在加载。。。</div>' + '</div>';
        $(html).appendTo(document.getElementById('map'));
      }
      $(".iconfont.icon-guanbi.popup-guanbi-noImage").off("click");
    }

    /**
     * 添加feature选中监听
     */

  }, {
    key: 'selFeature',
    value: function selFeature() {
      var _this2 = this;

      window.ObservableObj.unByKey('mouseOnFeatureEvent');
      window.ObservableObj.on('mouseOnFeatureEvent', function (event) {
        var feature = event.value;
        var coordinate = event.originEvent.mapBrowserEvent.coordinate;
        if (feature instanceof ol.Feature) {
          var properties = feature.getProperties();
          var layer = feature.get('belongLayer');
          if (layer.get('layerName') == '手机信令') {
            _this2.traficflow(properties).then(function (res) {
              _this2.preMethod(res['data'], coordinate, properties, feature);
            });
          }
        }
      });
    }

    /**
     * 手机信令
     */

  }, {
    key: 'loadMobileMsg',
    value: function loadMobileMsg() {
      var _this3 = this;

      this.loading();
      this.tempLayer = this.config.Maps.getTempVectorLayer(this.layerName, {
        create: true
      });
      this.selFeature();
      this.tempLayer.set("selectable", true);
      this.loadMobileMsgData().then(function (res) {
        _this3.sucMethod(res['data']);
      });
    }

    /**
     * 手机信令数据
     * @returns {AxiosPromise}
     */

  }, {
    key: 'loadMobileMsgData',
    value: function loadMobileMsgData() {
      return _axios2.default.get('/traficflow/realtime', {
        baseURL: this.config.service.tnmsTrafficServiceUrl
      });
    }

    /**
     * 交通流量
     * @param properties
     * @returns {AxiosPromise}
     */

  }, {
    key: 'traficflow',
    value: function traficflow(properties) {
      var params = properties.ROADSEGMENTID;
      return _axios2.default.get('/traficflow/road?roadSegmentID=' + params, {
        baseURL: this.config.service.tnmsTrafficServiceUrl
      });
    }

    /**
     * 清除图层
     */

  }, {
    key: 'clearLayer',
    value: function clearLayer() {
      if (this.tileLayer) {
        this.tileLayer.getSource().clear();
      }
    }

    /**
     * 数据加载成功后方法
     * @param data
     */

  }, {
    key: 'sucMethod',
    value: function sucMethod(data) {
      if (!data) return;
      var filteredData = [],
          features = [],
          wkt = new ol.format.WKT();

      var style = new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(67, 110, 238, 0.4)'
        }),
        stroke: new ol.style.Stroke({
          color: '#C0C0C0',
          width: 5
        })
      });
      filteredData = data.filter(function (ele) {
        return ele.geometryType === 'LineString';
      });
      this.clearLayer();
      filteredData.map(function (ele) {
        var feature = new ol.Feature({
          geometry: wkt.readGeometry(ele.geometry)
        });
        feature.setProperties(ele.attributes);
        if (ele.attributes.SPEED && ele.attributes.SPEED !== '') {
          var speed = ele.attributes.SPEED;
          if (speed < 40) {
            style.getStroke().setColor("#F23030");
          } else if (speed >= 40 && speed <= 60) {
            style.getStroke().setColor("#FF9F1A");
          } else if (speed >= 60) {
            style.getStroke().setColor("#17BF00");
          }
        }
        feature.setStyle(style);
        features.push(feature);
      });
      this.tempLayer.getSource().addFeatures(features);
      if (this.firstLoad) {
        this.firstLoad = false;
        $(".loadChaXuns,.zhezhaos").remove();
      }
      if (!this.forceReload) {
        this.clearRefreshTrafficInterval();
      } else {
        this.autoRefreshTraffic();
      }
    }

    /**
     * 数据加载成功后方法
     * @param data
     * @param coordinate
     * @param properties
     * @param feature
     */

  }, {
    key: 'preMethod',
    value: function preMethod(data, coordinate, properties, feature) {
      var _ref = [data.startMilePost, data.endMilePost, data.roadName, properties.CREATETIME],
          roadStart = _ref[0],
          roadEnd = _ref[1],
          roadName = _ref[2],
          measureTime = _ref[3];

      var roadDirection = properties.ROADDIRECTION == 0 ? "上行" : "下行";
      var loadLength = Math.abs(roadStart - roadEnd).toFixed(5);
      var measureTimeTemp = new Date(measureTime.substr(0, 4), measureTime.substr(4, 2), measureTime.substr(6, 2), measureTime.substr(8, 2), measureTime.substr(10, 2), measureTime.substr(12, 2));
      var endTime = measureTimeTemp.getHours() + ':' + measureTimeTemp.getMinutes();
      var startTime = measureTimeTemp.getHours() + ':' + (measureTimeTemp.getMinutes() - 5);
      if (measureTimeTemp.getMinutes() - 5 == 55) {
        startTime = measureTimeTemp.getHours() - 1 + ':' + (measureTimeTemp.getMinutes() - 5);
      }
      var geometry = feature.getGeometry();
      coordinate = geometry.getClosestPoint(coordinate);
      var flag = Math.floor(Math.random() * 1000) + Math.floor(Math.random() * 1000 + 1);
      var c = '<div class="popupDetail-no-img">' + '<div class="popup-main-box-no-img">' + '<div class="popup-shadow-no-img">' + '<div class="popup-shadow-box-no-img">' + '</div>' + '<div class="popup-shadow-corner-no-img">' + '<img src="static/images/map_qipao_yingzi_jiao.png">' + '</div>' + '</div>' + '<div class="popup-content-no-img">' + '<div class="popup-content-box-no-img">' + '<div class="popup-warp">' + '<div class="popup-top">' + '<span>' + roadName + '</span>' + '<span class="iconfont icon-guanbi popup-guanbi-noImage" flag="' + flag + '" style="cursor: pointer" tooltip="关闭"></span>' + '</div>' + '<div class="popup-middle">' + '<ul>' + '<li><span>' + roadDirection + '：</span><span>' + properties.SPEED + '(km/h)/' + properties.SAMPLECONUT + '</span><span>' + properties.INDEX + '</span></li>' + '<li><span>路段起点：</span><span>经纬度(' + geometry.getFirstCoordinate()[0].toFixed(6) + ',' + geometry.getFirstCoordinate()[1].toFixed(6) + ')</span></li>' + '<li><span>路段止点：</span><span>经纬度(' + geometry.getLastCoordinate()[0].toFixed(6) + ',' + geometry.getLastCoordinate()[1].toFixed(6) + ')</span></li>' + '<li><span>路线长度：</span><span>' + loadLength + '(km)</span></li>' + '<li><span>测量时段：</span><span>' + startTime + '—' + endTime + '</span></li>' + '</ul>' + '</div>' + '</div>' + '</div>' + '<div class="popup-content-corner-no-img">' + '<img src="static/images/map_qipao_jiao.png">' + '</div>' + '</div>' + '</div>' + '</div>';
      this.config.Maps.showPopup({
        coordinate: coordinate,
        content: c,
        offset: [-40, 5],
        showBottom: false,
        id: flag
      });
      $(".iconfont.icon-guanbi.popup-guanbi-noImage").on('click', function () {
        var id = $(this).attr('flag') + 'overlay';
        this.config.Maps.closePopupById(id);
      });
    }
  }]);

  return RoadTraffic;
}();

exports.default = RoadTraffic;