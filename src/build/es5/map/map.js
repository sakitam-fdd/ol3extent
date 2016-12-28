"use strict";
var _createClass = function () {
  function defineProperties (target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

function _classCallCheck (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var HDMap = function () {
  function HDMap () {
    _classCallCheck(this, HDMap);


    /**
     * 获取地图参数
     * @param mapDiv
     * @param params
     */
    this.getParams = function (mapDiv, params) {
      var that = this;
      var promise = new Promise(function (resolve, reject) {
        $.ajax({
          url: params['layerUrl'] + '?f=pjson',
          type: 'GET',
          dataType: 'jsonp',
          jsonp: 'callback',
          success: function (data) {
            if (data) {
              var res = {
                projection: data.spatialReference.wkid,
                fullExtent: [data.fullExtent.xmin, data.fullExtent.ymin, data.fullExtent.xmax, data.fullExtent.ymax],
                origin: [data.tileInfo.origin.x, data.tileInfo.origin.y],
                tileSize: data.tileInfo.cols,
                lods: data.tileInfo.lods,
                tileUrl: params['layerUrl'],
                center: params['center'],
                zoom: params['zoom'],
                config: params['config']
              };
              that.initMap(mapDiv, res);
              resolve(res);
            } else {
              reject(data);
            }
          }
        });
      });
    };
    /**
     * 初始化地图
     * @param mapDiv
     * @param params
     */
    this.initMap = function (mapDiv, params) {
      var options = params || {};
      var that = this;
      /**
       * 投影
       * @type {ol.proj.Projection}
       */
      this.projection = ol.proj.get('EPSG:' + options.projection);
      this.projection.setExtent([-180, -90, 180, 90]);
      /**
       * 显示范围
       */
      this.fullExtent = options.fullExtent;
      /**
       * 瓦片原点
       */
      this.origin = options.origin;
      /**
       * 瓦片大小
       */
      this.tileSize = options.tileSize;
      /**
       * 分辨率
       * @type {Array}
       */
      this.resolutions = [];
      var len = options.lods.length;
      for (var i = 0; i < len; i++) {
        this.resolutions.push(options.lods[i].resolution)
      }
      /**
       * 定义渲染参数
       */
      var size = ol.extent.getWidth(this.projection.getExtent()) / 256;
      /**
       * 渲染分辨率
       * @type {Array}
       * @private
       */
      this._resolutions = new Array(19);
      /**
       * 层级
       * @type {Array}
       */
      this.matrixIds = new Array(19);
      for (var z = 0; z < 19; ++z) {
        this._resolutions[z] = size / Math.pow(2, z);
        this.matrixIds[z] = z
      }
      var tileUrl = options.tileUrl;
      var tileGrid = new ol.tilegrid.TileGrid({
        tileSize: that.tileSize,
        origin: that.origin,
        extent: that.fullExtent,
        resolutions: that.resolutions
      });
      var urlTemplate = tileUrl + '/tile/{z}/{y}/{x}';
      var tileArcGISXYZ = new ol.source.XYZ({
        wrapX: false,
        tileGrid: tileGrid,
        projection: that.projection,
        tileUrlFunction: function (tileCoord) {
          var url = urlTemplate.replace('{z}', (tileCoord[0]).toString())
            .replace('{x}', tileCoord[1].toString())
            .replace('{y}', (-tileCoord[2] - 1).toString());
          return url
        }
      });
      var baseLayer = new ol.layer.Tile({
        isBaseLayer: true,
        isCurrentBaseLayer: true,
        layerName: params.layerName,
        source: tileArcGISXYZ
      });
      this.map = new ol.Map({
        target: mapDiv,
        interactions: ol.interaction.defaults({
          doubleClickZoom: true,
          keyboard: false
        }).extend([]),
        controls: [new ol.control.ScaleLine({
          target: 'hdscalebar'
        })],
        layers: [baseLayer],
        view: new ol.View({
          center: ol.proj.fromLonLat(params.center, that.projection),
          zoom: params.zoom,
          projection: that.projection,
          extent: that.fullExtent,
          maxResolution: that._resolutions[0],
          minResolution: that._resolutions[18]
        })
      })
      this.addEvent();
      this.addParams();
    };
    /**
     * 初始化参数
     */
    this.addParams = function () {
      this.mapTools = {
        addPoint: false, ljQuery: false,
        toolsType: {
          addPoint: "addPoint",
          ljQuery: "ljQuery"
        }
      };
      this.addPointHandlerClick = null;
    };
    /**
     * 添加地图事件
     */
    this.addEvent = function () {
      this.map.on("click", function () {
        if (this.mapTools.iQuery) {
          if (this.queryparams != null && this.queryparams.drawend != null) {
            this.queryparams.drawend(evt);
            this.mapTools.iQuery = false;
          }
          return;
        }
      }, this)
    };

    /**
     * 工具类
     * @param toolType
     * @param params
     */
    this.activeTool = function (toolType, params) {
      var that = this;
      this.deactiveAll();
      if (this.mapTools.hasOwnProperty(toolType)) {
        this.mapTools[toolType] = true;
        switch (toolType) {
          case this.mapTools.toolsType.addPoint: //添加点
            this.addPointHandlerClick = this.map.once("singleclick", function (event) {
              that.addPoint({
                geometry: event.coordinate
              }, params);
            });
            break;
          case this.mapTools.toolsType.ljQuery: //路径分析
            this.queryparams = params;
            ol.Observable.unByKey(this.addPointHandlerClick);//移除对key的监听
            this.addPointHandlerClick = this.map.on("singleclick", function (event) {
              if (that.mapTools.ljQuery) {
                that.addPoint({
                  geometry: event.coordinate
                }, params);
              }
            });
            break;
        }
      }
    };

    /**
     * 取消所有工具的激活
     */
    this.deactiveAll = function () {
      for (var key in this.mapTools) {
        if (typeof this.mapTools[key] == 'boolean')
          this.mapTools[key] = false;
      }
      this.removeDrawInteraion();
    };

    /**
     * 移除绘制交互
     */
    this.removeDrawInteraion = function () {
      if (this.draw) {
        this.map.removeInteraction(this.draw);
      }
      delete this.draw;
      this.draw = null;
    };

    /**
     * 获取当前地图叠加图层
     * @param layername
     * @returns {*}
     */
    this.getLayerByName = function (layername) {
      var targetLayer = null;
      if (this.map) {
        var layers = this.map.getLayers();
        layers.forEach(function (layer) {
          var layernameTemp = layer.get("layerName");
          if (layernameTemp === layername) {
            targetLayer = layer;
          }
        }, this);
      }
      return targetLayer;
    };
    /**
     * 通过要素获取要素所在的图层
     * @param feature
     * @returns {*}
     */
    this.getLayerByFeatuer = function (feature) {
      var tragetLayer = null;
      if (feature instanceof ol.Feature) {
        var source = null;
        var layers = this.map.getLayers();
        layers.forEach(function (layer) {
          var source = layer.getSource();
          if (source.getFeatures) {
            var features = source.getFeatures();
            features.forEach(function (feat) {
              if (feat == feature) {
                tragetLayer = layer;
              }
            })
          }
        })
      } else {
        console.info("传入的不是要素");
      }
      return tragetLayer;
    };

    /**
     * 获取临时图层
     * @param layerName
     * @param params
     * @returns {*}
     */
    this.getTempVectorLayer = function (layerName, params) {
      var vectorLayer = this.getLayerByName(layerName);
      if (!(vectorLayer instanceof ol.layer.Vector)) {
        vectorLayer = null;
      }
      if (!vectorLayer) {
        if (params && params.create) {
          var vectorSource = new ol.source.Vector({
            wrapX: false
          });
          vectorLayer = new ol.layer.Vector({
            layerName: layerName,
            params: params,
            source: vectorSource,
            style: new ol.style.Style({
              fill: new ol.style.Fill({
                color: 'rgba(67, 110, 238, 0.4)'
              }),
              stroke: new ol.style.Stroke({
                color: '#4781d9',
                width: 2
              }),
              image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({
                  color: '#ffcc33'
                })
              })
            })
          });
        }
      }
      if (this.map && vectorLayer) {
        if (!this.getLayerByName(layerName)) {
          //图层是否可以选择
          if (params && params.hasOwnProperty('selectable')) {
            vectorLayer.set("selectable", params.selectable);
          }
          this.map.addLayer(vectorLayer);
        }
      }
      return vectorLayer;
    };

    /**
     * 添加单个点
     * @param attr
     * @param params
     * @returns {ol.Feature}
     */
    this.addPoint = function (attr, params) {
      var geometry = null;
      if (!params) {
        params = {};
      }
      if (attr instanceof ol.geom.Geometry) {
        geometry = attr;
      } else if ($.isArray(attr.geometry)) {
        geometry = new ol.geom.Point(attr.geometry);
      } else {
        geometry = new ol.format.WKT().readGeometry(attr.geometry);
      }
      var iconFeature = new ol.Feature({
        geometry: geometry,
        params: params
      });
      var featureType = params.featureType;
      var imgURL = null;
      if (featureType) {
        imgURL = config.markConfig.getMarkConfigByType(featureType).imgURL;
      } else {
        imgURL = config.markConfig.getDefaultMrakConfig().imgURL;
      }
      var iconStyle = new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 25],
          anchorXUnits: 'fraction',
          anchorYUnits: 'pixels',
          opacity: 0.75,
          src: imgURL
        })
      });

      iconFeature.setStyle(iconStyle);

      if (params.layerName) {
        var layer = this.getTempVectorLayer(params.layerName, {
          create: true
        });
        layer.getSource().addFeature(iconFeature);
      } else {
        this.tempVectorLayer.getSource().addFeature(iconFeature);
      }
      if (params.drawend && typeof(params.drawend) == "function") {
        params.drawend({
          feature: iconFeature
        });
      }
      if (this.addPointHandlerClick) {
        ol.Observable.unByKey(this.addPointHandlerClick);//移除对key的监听
      }
      this.deactiveAll(); //取消激活所有工具
      // this.OrderLayerZindex();
      return iconFeature;
    },

      /**
       * 移除当前feature
       * @param feature
       */
      this.removeFeature = function (feature) {
        if (feature instanceof ol.Feature) {
          var tragetLayer = this.getLayerByFeatuer(feature);
          if (tragetLayer) {
            var source = tragetLayer.getSource();
            if (source && source.removeFeature) {
              source.removeFeature(feature);
              this.cursor_ = 'pointer'
            }
          }
        } else {
          console.info("传入的不是要素");
        }
      }

  }

  return HDMap;
}();