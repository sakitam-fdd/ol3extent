import axios from 'axios'
export default class RoadTraffic {
  constructor (config) {
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
  autoRefreshTraffic () {
    this.clearRefreshTrafficInterval();
    this.TRAFFIC_INTERVAL = window.setInterval(() => {
      let now = new Date();
      let min = now.getMinutes();
      if (min % 5 == 0) {
        this.loadFdcTrafficData(true)
      }
    }, 60 * 1000)
  }

  /**
   * 清除自动刷新
   */
  clearRefreshTrafficInterval () {
    if (this.TRAFFIC_INTERVAL) {
      window.clearInterval(this.TRAFFIC_INTERVAL);
      this.TRAFFIC_INTERVAL = null
    }
  }

  clearTrafficLayer () {
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
  loadFdcTrafficData (forceReload) {
    this.forceReload = forceReload;
    this.tileLayer = this.config.Maps.getLayerByName(this.trafficLayer);
    if (this.tileLayer) {
      this.config.Maps.map.removeLayer(this.tileLayer);
      if (!this.forceReload) {
        this.clearRefreshTrafficInterval();
        return;
      }
    }
    let trafficServerUrl = this.config.service.trafficServerUrl;
    let timeFlag = new Date().getTime();
    let tileTrafficXYZ = new ol.source.XYZ({
      tileGrid: this.config.service.tileGrid,
      projection: this.config.service.projection,
      tileUrlFunction: function (tileCoord) {
        let url = trafficServerUrl.replace('{z}', (tileCoord[0]).toString())
          .replace('{x}', tileCoord[1].toString())
          .replace('{y}', (-tileCoord[2] - 1).toString());
        return url + "&time=" + timeFlag;
      }
    });
    let trafficLayer = new ol.layer.Tile({
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
  loading () {
    if (this.firstLoad) {
      let html = '<div class="zhezhaos"></div>' + '<div class="loadChaXuns">' +
        '<div class="load-container load8">' +
        '<div class="loader"></div>' +
        '</div>' +
        '<div class="load1">正在加载。。。</div>' +
        '</div>';
      $(html).appendTo(document.getElementById('map'));
    }
    $(".iconfont.icon-guanbi.popup-guanbi-noImage").off("click");
  }

  /**
   * 添加feature选中监听
   */
  selFeature () {
    window.ObservableObj.unByKey('mouseOnFeatureEvent');
    window.ObservableObj.on('mouseOnFeatureEvent', event => {
      let feature = event.value;
      let coordinate = event.originEvent.mapBrowserEvent.coordinate;
      if (feature instanceof ol.Feature) {
        let properties = feature.getProperties();
        let layer = feature.get('belongLayer');
        if (layer.get('layerName') == '手机信令') {
          this.traficflow(properties).then(res => {
            this.preMethod(res['data'], coordinate, properties, feature)
          })
        }
      }
    });
  }

  /**
   * 手机信令
   */
  loadMobileMsg () {
    this.loading();
    this.tempLayer = this.config.Maps.getTempVectorLayer(this.layerName, {
      create: true
    });
    this.selFeature();
    this.tempLayer.set("selectable", true);
    this.loadMobileMsgData().then(res => {
      this.sucMethod(res['data'])
    })
  }

  /**
   * 手机信令数据
   * @returns {AxiosPromise}
   */
  loadMobileMsgData () {
    return axios.get(`/traficflow/realtime`, {
      baseURL: this.config.service.tnmsTrafficServiceUrl
    })
  }

  /**
   * 交通流量
   * @param properties
   * @returns {AxiosPromise}
   */
  traficflow (properties) {
    let params = properties.ROADSEGMENTID;
    return axios.get(`/traficflow/road?roadSegmentID=${params}`, {
      baseURL: this.config.service.tnmsTrafficServiceUrl
    })
  }

  /**
   * 清除图层
   */
  clearLayer () {
    if (this.tileLayer) {
      this.tileLayer.getSource().clear();
    }
  }

  /**
   * 数据加载成功后方法
   * @param data
   */
  sucMethod (data) {
    if (!data) return;
    let [filteredData, features, wkt] = [[], [], (new ol.format.WKT())];
    let style = new ol.style.Style({
      fill: new ol.style.Fill({
        color: 'rgba(67, 110, 238, 0.4)'
      }),
      stroke: new ol.style.Stroke({
        color: '#C0C0C0',
        width: 5
      })
    });
    filteredData = data.filter(ele => {
      return ele.geometryType === 'LineString'
    });
    this.clearLayer();
    filteredData.map(ele => {
      let feature = new ol.Feature({
        geometry: wkt.readGeometry(ele.geometry)
      });
      feature.setProperties(ele.attributes);
      if (ele.attributes.SPEED && ele.attributes.SPEED !== '') {
        let speed = ele.attributes.SPEED;
        if (speed < 40) {
          style.getStroke().setColor("#F23030");
        } else if (speed >= 40 && speed <= 60) {
          style.getStroke().setColor("#FF9F1A");
        } else if (speed >= 60) {
          style.getStroke().setColor("#17BF00");
        }
      }
      feature.setStyle(style)
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
  preMethod (data, coordinate, properties, feature) {
    let [ roadStart, roadEnd, roadName, measureTime ] = [ data.startMilePost, data.endMilePost, data.roadName, properties.CREATETIME ];
    let roadDirection = properties.ROADDIRECTION == 0 ? "上行" : "下行";
    let loadLength = Math.abs(roadStart - roadEnd).toFixed(5);
    let measureTimeTemp = new Date(measureTime.substr(0, 4), measureTime.substr(4, 2), measureTime.substr(6, 2), measureTime.substr(8, 2), measureTime.substr(10, 2), measureTime.substr(12, 2));
    let endTime = measureTimeTemp.getHours() + ':' + measureTimeTemp.getMinutes();
    let startTime = measureTimeTemp.getHours() + ':' + (measureTimeTemp.getMinutes() - 5);
    if (measureTimeTemp.getMinutes() - 5 == 55) {
      startTime = measureTimeTemp.getHours() - 1 + ':' + (measureTimeTemp.getMinutes() - 5);
    }
    let geometry = feature.getGeometry();
    coordinate = geometry.getClosestPoint(coordinate);
    let flag = Math.floor(Math.random() * 1000) + Math.floor(Math.random() * 1000 + 1);
    let c = '<div class="popupDetail-no-img">' +
      '<div class="popup-main-box-no-img">' +
      '<div class="popup-shadow-no-img">' +
      '<div class="popup-shadow-box-no-img">' +
      '</div>' +
      '<div class="popup-shadow-corner-no-img">' +
      '<img src="static/images/map_qipao_yingzi_jiao.png">' +
      '</div>' +
      '</div>' +
      '<div class="popup-content-no-img">' +
      '<div class="popup-content-box-no-img">' +
      '<div class="popup-warp">' +
      '<div class="popup-top">' +
      '<span>' + roadName + '</span>' +
      '<span class="iconfont icon-guanbi popup-guanbi-noImage" flag="' + flag + '" style="cursor: pointer" tooltip="关闭"></span>' +
      '</div>' +
      '<div class="popup-middle">' +
      '<ul>' +
      '<li><span>' + roadDirection + '：</span><span>' + properties.SPEED + '(km/h)/' + properties.SAMPLECONUT + '</span><span>' + properties.INDEX + '</span></li>' +
      '<li><span>路段起点：</span><span>经纬度(' + geometry.getFirstCoordinate()[0].toFixed(6) + ',' + geometry.getFirstCoordinate()[1].toFixed(6) + ')</span></li>' +
      '<li><span>路段止点：</span><span>经纬度(' + geometry.getLastCoordinate()[0].toFixed(6) + ',' + geometry.getLastCoordinate()[1].toFixed(6) + ')</span></li>' +
      '<li><span>路线长度：</span><span>' + loadLength + '(km)</span></li>' +
      '<li><span>测量时段：</span><span>' + startTime + '—' + endTime + '</span></li>' +
      '</ul>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="popup-content-corner-no-img">' +
      '<img src="static/images/map_qipao_jiao.png">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
    this.config.Maps.showPopup({
      coordinate: coordinate,
      content: c,
      offset: [-40, 5],
      showBottom: false,
      id: flag
    });
    $(".iconfont.icon-guanbi.popup-guanbi-noImage").on('click', function () {
      let id = $(this).attr('flag') + 'overlay';
      this.config.Maps.closePopupById(id);
    });
  }
}
