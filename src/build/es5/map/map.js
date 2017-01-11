'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HDMap = function () {
  function HDMap() {
    _classCallCheck(this, HDMap);

    this.mapTools = {
      addPoint: false, ljQuery: false,
      iQuery: false, drawPlot: false,
      toolsType: {
        addPoint: 'addPoint',
        ljQuery: 'ljQuery',
        iQuery: 'iQuery',
        drawPlot: 'drawPlot'
      }
    };
    this.addPointHandlerClick = null;
    this.plotDraw = null; //标绘工具
    this.plotEdit = null;
    this._lastDrawInteractionGeometry = null;
    this.wgs84Sphere = new ol.Sphere(6378137);
    window.ObservableObj = new ol.Object();

    this.currentMapLines = [];
    this.currentMapPoints = [];

    this.lineLayers = [];
    this.pointLayers = [];
    this.polygonLayers = [];

    this.circleSerachFeat = null;
  }

  /**
   * 获取地图参数
   * @param mapDiv
   * @param params
   */


  _createClass(HDMap, [{
    key: 'getMapParams',
    value: function getMapParams(mapDiv, params) {
      var that = this;
      var promise = new Promise(function (resolve, reject) {
        $.ajax({
          url: params['layerUrl'] + '?f=pjson',
          type: 'GET',
          dataType: 'jsonp',
          jsonp: 'callback',
          success: function success(data) {
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
    }

    /**
     * 初始化当前地图
     * @param mapDiv
     * @param params
     */

  }, {
    key: 'initMap',
    value: function initMap(mapDiv, params) {
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
        this.resolutions.push(options.lods[i].resolution);
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
        this.matrixIds[z] = z;
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
        tileUrlFunction: function tileUrlFunction(tileCoord) {
          var url = urlTemplate.replace('{z}', tileCoord[0].toString()).replace('{x}', tileCoord[1].toString()).replace('{y}', (-tileCoord[2] - 1).toString());
          return url;
        }
      });
      var baseLayer = new ol.layer.Tile({
        isBaseLayer: true,
        isCurrentBaseLayer: true,
        layerName: options.layerName,
        source: tileArcGISXYZ
      });
      this.map = new ol.Map({
        target: mapDiv,
        loadTilesWhileAnimating: true,
        interactions: ol.interaction.defaults({
          doubleClickZoom: true,
          keyboard: false
        }).extend([new app.Drag()]),
        controls: [new ol.control.ScaleLine({
          target: 'hdscalebar'
        })],
        layers: [baseLayer],
        view: new ol.View({
          center: ol.proj.fromLonLat(options.center, that.projection),
          zoom: options.zoom,
          projection: that.projection,
          extent: that.fullExtent,
          maxResolution: that._resolutions[0],
          minResolution: that._resolutions[18]
        })
      });

      this.addEvent();
    }

    /**
     * 添加地图事件
     */

  }, {
    key: 'addEvent',
    value: function addEvent() {
      var _this = this;

      this.map.on("click", function (event) {
        if (_this.mapTools.iQuery) {
          if (_this.queryparams != null && _this.queryparams.drawend != null) {
            _this.queryparams.drawend(event);
            _this.mapTools.iQuery = false;
          }
          return;
        } else if (_this.plotDraw && !_this.plotDraw.isDrawing()) {
          var feature = _this.map.forEachFeatureAtPixel(event.pixel, function (feature) {
            return feature;
          });
          if (feature && feature.getGeometry().isPlot) {
            _this.plotEdit.activate(feature); // 开始编辑
            window.ObservableObj.set('plotFeature', feature);
            window.ObservableObj.dispatchEvent('choosePlot');
          } else {
            _this.plotEdit.deactivate(); // 结束编辑
          }
        }
      }, this);
    }

    /**
     * 获取当前地图叠加图层
     * @param layername
     * @returns {*}
     */

  }, {
    key: 'getLayerByName',
    value: function getLayerByName(layername) {
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
    }

    /**
     * 获取临时图层
     * @param layerName
     * @param params
     * @returns {*}
     */

  }, {
    key: 'getTempVectorLayer',
    value: function getTempVectorLayer(layerName, params) {
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
    }

    /**
     * 工具类
     * @param toolType
     * @param params
     */

  }, {
    key: 'activeTool',
    value: function activeTool(toolType, params) {
      var _this2 = this;

      this.deactiveAll();
      if (this.mapTools.hasOwnProperty(toolType)) {
        this.mapTools[toolType] = true;
        switch (toolType) {
          case this.mapTools.toolsType.addPoint:
            //添加点
            this.addPointHandlerClick = this.map.once("singleclick", function (event) {
              _this2.addPoint({
                geometry: event.coordinate
              }, params);
            });
            break;
          case this.mapTools.toolsType.ljQuery:
            //路径分析
            this.queryparams = params;
            ol.Observable.unByKey(this.addPointHandlerClick); //移除对key的监听
            this.addPointHandlerClick = this.map.on("singleclick", function (event) {
              if (_this2.mapTools.ljQuery) {
                _this2.addPoint({
                  geometry: event.coordinate
                }, params);
              }
            });
            break;
          case this.mapTools.toolsType.drawPlot:
            //plot
            if (!this.plotEdit) {
              this.plotDraw = new P.PlotDraw(this.map);
              this.plotEdit = new P.PlotEdit(this.map);
              this.plotDraw.on(P.Event.PlotDrawEvent.DRAW_END, function (event) {
                var feature = event.feature;
                _this2.setLastDrawInteractionGeometry(feature.getGeometry().clone());
                _this2.plotEdit.activate(feature);
                _this2.getTempVectorLayer(params['layerName'], { create: true }).getSource().addFeature(feature);
                window.ObservableObj.set("PlotFeature", feature);
                window.ObservableObj.dispatchEvent("PlotFeatureEvt");
              }, false, this);
            }
            this.plotEdit.deactivate();
            this.plotDraw.activate(eval(params.plotType), params);
            break;
        }
      }
    }

    /**
     * 获取最后绘制空间信息
     * @returns {ol.geom.Geometry|*|null}
     */

  }, {
    key: 'getLastDrawInteractionGeometry',
    value: function getLastDrawInteractionGeometry() {
      return this._lastDrawInteractionGeometry;
    }
  }, {
    key: 'setLastDrawInteractionGeometry',


    /**
     * 设置最后绘制空间信息
     * @param geometry
     */
    value: function setLastDrawInteractionGeometry(geometry) {
      if (geometry instanceof ol.geom.Geometry) {
        this._lastDrawInteractionGeometry = geometry;
      } else {
        console.error(geometry, "不是几何对象");
      }
    }

    /**
     * 取消所有工具的激活
     */

  }, {
    key: 'deactiveAll',
    value: function deactiveAll() {
      for (var key in this.mapTools) {
        if (typeof this.mapTools[key] == 'boolean') this.mapTools[key] = false;
      }
      this.removeDrawInteraion();
    }

    /**
     * 移除绘制交互
     */

  }, {
    key: 'removeDrawInteraion',
    value: function removeDrawInteraion() {
      if (this.draw) {
        this.map.removeInteraction(this.draw);
      }
      delete this.draw;
      this.draw = null;
    }

    /**
     * 添加单个点
     * @param attr
     * @param params
     * @returns {ol.Feature}
     */

  }, {
    key: 'addPoint',
    value: function addPoint(attr, params) {
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

      if (params['layerName']) {
        var layer = this.getTempVectorLayer(params.layerName, {
          create: true
        });
        layer.getSource().addFeature(iconFeature);
        this.pointLayers.push(params.layerName);
      } else {
        this.tempVectorLayer.getSource().addFeature(iconFeature);
      }
      if (params.drawend && typeof params.drawend == "function") {
        params.drawend({
          feature: iconFeature
        });
      }
      if (this.addPointHandlerClick) {
        ol.Observable.unByKey(this.addPointHandlerClick); //移除对key的监听
      }
      this.deactiveAll(); //取消激活所有工具
      this.OrderLayerZindex();
      this.MovePointToView(geometry.getCoordinates());
      return iconFeature;
    }

    /**
     * 按类型添加点
     * @param array
     * @param drawType
     * @param params
     * @returns {*}
     */

  }, {
    key: 'addTypePoints',
    value: function addTypePoints(array, drawType, params) {
      if (!params) params = {};
      if (params['isClear']) {
        this.clearGraphics();
      }
      if (!array || array.length == 0) {
        return false;
      }

      var multiPoint = new ol.geom.MultiPoint([]);
      var addedPoints = [];
      for (var i = 0; i < array.length; i++) {
        var attr = array[i],
            geometry = null,
            imgSrcHover = void 0,
            imgSrc = void 0;

        if (!attr) {
          continue;
        }
        if (!attr.geometry) {
          continue;
        }
        if (attr instanceof ol.geom.Geometry) {
          geometry = attr;
        } else if ($.isArray(attr.geometry)) {
          geometry = new ol.geom.Point(attr.geometry);
        } else {
          geometry = new ol.format.WKT().readGeometry(attr.geometry);
        }

        var feature = new ol.Feature({
          geometry: geometry
        });
        multiPoint.appendPoint(geometry);

        //设置标识参数
        if (params) {
          feature.set("params", params);
          if (params['layerName']) {
            feature.set("layerName", params.layerName);
          }
        }
        if (!attr['attributes']) {
          attr['attributes'] = {};
        }
        if (attr.attributes['ID'] || attr.attributes['id']) {
          feature.setId(attr.attributes['ID'] ? attr.attributes['ID'] : attr.attributes['id']);
          feature.setProperties(attr.attributes);
        } else {
          console.info("传入的数据缺少id");
          continue;
        }
        //样式
        if (attr.attributes['imgSrc']) {
          imgSrc = attr.attributes.imgSrc;
          if (attr.attributes['imgSrcHover']) {
            imgSrcHover = attr.attributes["imgSrcHover"];
          } else {
            imgSrcHover = attr.attributes.imgSrc;
          }
        } else if (params['featureType']) {
          imgSrc = config.markConfig.getMarkConfigByType(params['featureType']).imgURL;
          imgSrcHover = config.markConfig.getMarkConfigByType(params['featureType']).imgURL;
        } else {
          imgSrc = config.markConfig.getDefaultMrakConfig().imgURL;
          imgSrcHover = config.markConfig.getDefaultMrakConfig().imgURL;
        }
        var selectStyle = void 0,
            normalStyle = void 0;
        if (params['orderBy']) {
          selectStyle = new ol.style.Style({
            image: new ol.style.Icon({ //标绘点的样式
              anchor: [0.5, 0.5],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: imgSrc
            }),
            text: new ol.style.Text({
              text: i + 1 + "",
              offsetX: 0.5,
              offsetY: -18,
              fill: new ol.style.Fill({
                color: "#fff"
              })
            })
          });
          normalStyle = new ol.style.Style({
            image: new ol.style.Icon({ //标绘点选中的样式
              anchor: [0.5, 0.5],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: imgSrcHover
            }),
            text: new ol.style.Text({
              text: i + 1 + "",
              offsetX: 0.5,
              offsetY: -18,
              fill: new ol.style.Fill({
                color: "#fff"
              })
            })
          });
        } else {
          selectStyle = new ol.style.Style({
            image: new ol.style.Icon({ //标绘点的样式
              anchor: [0.5, 0.5],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: imgSrcHover
            })
          });
          normalStyle = new ol.style.Style({
            image: new ol.style.Icon({ //标绘点选中的样式
              anchor: [0.5, 0.5],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: imgSrc
            })
          });
        }
        //是否存储样式
        if (params['showStyle']) {
          feature.set('normalStyle', normalStyle);
          feature.set('selectStyle', selectStyle);
        }
        if (normalStyle != null) {
          feature.setStyle(normalStyle); //设置样式
        }
        if (drawType && drawType == "overlay") {
          this.addTypeOverlay(feature, attr['attributes'], params, i);
        } else {
          if (params['layerName']) {
            var layer = this.getTempVectorLayer(params.layerName, {
              create: true
            });
            layer.getSource().addFeature(feature);
            this.pointLayers.push(params.layerName);
          } else {
            this.tempVectorLayer.getSource().addFeature(feature);
          }
        }
      }
      if (!params['disZoomToExtent']) {
        this._getExtent(multiPoint);
      }
      return addedPoints;
    }

    /**
     * 字体图标标绘
     * @param feature
     * @param attributes
     * @param params
     * @param i
     */

  }, {
    key: 'addTypeOverlay',
    value: function addTypeOverlay(feature, attributes, params, i) {
      try {
        var marker = document.createElement('div');
        marker.className = 'overlay-point iconfont';
        var color = '#EB4F38',
            fontSize = '31px',
            id = null,
            icon = null,
            coordinate = [],
            span = null,
            m = 0;
        if (attributes['icon']) {
          icon = attributes['icon'];
        } else if (params['icon']) {
          icon = params['icon'];
        }
        if (icon) {
          if (icon['className']) {
            $(marker).addClass(icon.className);
          }
          if (icon['color']) {
            color = icon.color;
          }
          if (icon['fontSize']) {
            fontSize = icon.fontSize;
          }
        }
        if (params['orderBy']) {
          m = i + 1;
          span = document.createElement('span');
        } else if (params["orderByNum"] && attributes['number']) {
          m = attributes.number + 1;
          span = document.createElement('span');
        }
        if (!!span) {
          span.innerHTML = m;
          marker.appendChild(span);
        }
        marker.style.color = color;
        marker.style.fontSize = fontSize;
        marker.selectColor = "#1b9de8";
        marker.normalColor = color;
        marker.onmousedown = function (ev) {
          if (ev.button == 2) {
            //鼠标右键
            window.ObservableObj.set("rightMenuFeature", feature);
            window.ObservableObj.dispatchEvent("rightMenuEvt");
          } else if (ev.button == 0) {
            //鼠标左键
            window.ObservableObj.set("overlay", feature);
            window.ObservableObj.dispatchEvent("overlayEvt");
          }
        };
        if (feature) {
          id = feature.getId();
          var overlaytemp = this.map.getOverlayById(id);
          if (!overlaytemp) {
            coordinate = feature.getGeometry().getCoordinates();
            var iconOverlay = new ol.Overlay({
              element: marker,
              positioning: 'center-center',
              id: id,
              offset: [0, -10],
              stopEvent: true
            });
            iconOverlay.set('feature', feature);
            iconOverlay.setPosition(coordinate);
            //设置标识参数
            if (params) {
              iconOverlay.set("params", params);
              if (params['layerName']) {
                iconOverlay.set("layerName", params.layerName);
              }
            }
            this.map.addOverlay(iconOverlay);
          }
        }
      } catch (e) {}
    }

    /**
     * 添加线要素
     * @param feature
     * @param params
     * @returns {*}
     */

  }, {
    key: 'addPolyline',
    value: function addPolyline(feature, params) {

      var features = [];
      if (feature instanceof Array) {
        features = feature;
      } else {
        features.push(feature);
      }

      var style = null,
          selectStyle = null,
          lineStyle = null,
          lineSelectStyle = null;
      if (params['style']) {
        style = params['style'];
      } else {
        style = { width: 4, color: '#0000EE' };
      }
      if (params['selectStyle']) {
        selectStyle = params['selectStyle'];
      } else {
        selectStyle = { width: 6, color: '#FF0000' };
      }
      lineStyle = new ol.style.Style({
        stroke: new ol.style.Stroke(style)
      });
      lineSelectStyle = new ol.style.Style({
        stroke: new ol.style.Stroke(selectStyle)
      });

      var linefeature;
      for (var i = 0; i < features.length; i++) {
        var _feat = features[i];
        if (_feat.geometry.hasOwnProperty('paths')) {
          var feat = {
            'type': 'Feature',
            'geometry': {
              'type': 'MultiLineString',
              'coordinates': _feat.geometry.paths
            }
          };
          this.currentMapLines = this.currentMapLines.concat(_feat.geometry.paths);
          linefeature = new ol.format.GeoJSON().readFeature(feat);
        } else {
          linefeature = new ol.Feature({
            geometry: new ol.format.WKT().readGeometry(_feat.geometry)
          });
          var extent = linefeature.getGeometry().getExtent();
          this.currentMapLines.push([[extent[0], extent[1]], [extent[2], extent[3]]]);
          this.zoomToExtent(extent, false);
        }

        if (params['showStyle']) {
          linefeature.set('normalStyle', lineStyle);
          linefeature.set('selectStyle', lineSelectStyle);
        }

        if (!_feat['attributes']) {
          _feat['attributes'] = {};
          _feat.attributes['layerName'] = params['layerName'];
        }

        if (_feat.attributes['ID'] || _feat.attributes['id']) {
          linefeature.setId(_feat.attributes['ID'] || _feat.attributes['id']);
          linefeature.set('layerName', params['layerName']);
          linefeature.setProperties(_feat.attributes);
        }

        if (lineStyle != null) {
          linefeature.setStyle(lineStyle); //设置线段样式
        }
        if (params['layerName']) {
          var layer = this.getTempVectorLayer(params.layerName, {
            create: true
          });
          layer.getSource().addFeature(linefeature);
          this.lineLayers.push(params.layerName);
        } else {
          this.tempVectorLayer.getSource().addFeature(linefeature);
        }
        this.OrderLayerZindex();
        return linefeature;
      }
    }
  }, {
    key: 'addPolylines',


    /**
     * 添加多条线要素
     * @param features
     * @param params
     */
    value: function addPolylines(features, params) {
      var _this3 = this;

      if (params['isclear']) {
        this.clearGraphics();
      }
      if (features != null && features.length > 0) {
        features.forEach(function (feat) {
          _this3.addPolyline(feat, params);
        });
        var extent = new ol.geom.MultiLineString(this.currentMapLines, null).getExtent();
        extent = this.adjustExtent(extent);
        this.zoomToExtent(extent, false);
      }
    }
  }, {
    key: 'createSreachCircle',


    /**
     * 创建查询circle
     * @param layerName
     * @param obj
     * @param radius
     * @returns {null|*}
     */
    value: function createSreachCircle(layerName, obj, radius) {
      if (!radius) {
        radius = 5000;
      }
      var style = new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(65,105,225, 0.5)'
        })
      });
      var config = {
        radius: radius,
        maxRadius: 500000,
        map: this.map,
        layerName: layerName,
        style: style
      };
      if (config.radius > config.maxRadius) {
        config.radius = config.maxRadius;
      }
      obj = $.extend(config, obj);
      if (!this.circleSerachFea) {
        this.circleSerachFeat = P.Plot.Circle.createCircleByCenterRadius(obj);
        var extent = this.circleSerachFeat.feature.getGeometry().getExtent();
        this.zoomToExtent(extent);
      } else {
        this.circleSerachFeat.setCenter(obj.center);
        this.circleSerachFeat.setRadius(obj.radius);
      }
      var circle = new ol.geom.Circle({
        center: this.circleSerachFeat.getCircle().getCenter(),
        radius: this.circleSerachFeat.getCircle().getRadius()
      });
      this.setLastDrawInteractionGeometry(circle);
      return this.circleSerachFeat;
    }

    /**
     * 通过id高亮overlay
     * @param id
     * @returns {ol.Overlay}
     */

  }, {
    key: 'highlightedOverlayById',
    value: function highlightedOverlayById(id) {
      if (this.map && !!id && id !== '') {
        var overlay = this.map.getOverlayById(id);
        overlay.getElement().style.color = overlay.getElement().selectColor;
        $(overlay.getElement()).addClass('marker-raise');
        return overlay;
      }
    }

    /**
     * 通过id取消高亮
     * @param id
     * @returns {ol.Overlay}
     */

  }, {
    key: 'unHighlightedOverlayById',
    value: function unHighlightedOverlayById(id) {
      if (this.map && !!id && id !== '') {
        var overlay = this.map.getOverlayById(id);
        overlay.getElement().style.color = overlay.getElement().normalColor;
        $(overlay.getElement()).removeClass('marker-raise');
        return overlay;
      }
    }

    /**
     * 调整当前要素范围
     * @param extent
     * @returns {*}
     */

  }, {
    key: 'adjustExtent',
    value: function adjustExtent(extent) {
      var width = ol.extent.getWidth(extent);
      var height = ol.extent.getHeight(extent);
      var adjust = 0.2;
      if (width < 0.05) {
        var bleft = ol.extent.getBottomLeft(extent); //获取xmin,ymin
        var tright = ol.extent.getTopRight(extent); //获取xmax,ymax
        var xmin = bleft[0] - adjust;
        var ymin = bleft[1] - adjust;
        var xmax = tright[0] + adjust;
        var ymax = tright[1] + adjust;
        extent = ol.extent.buffer(extent, adjust);
      }
      return extent;
    }

    /**
     * 获取当前范围
     * @param multiPoint
     * @returns {Array}
     * @private
     */

  }, {
    key: '_getExtent',
    value: function _getExtent(multiPoint) {
      var extent = [];
      if (multiPoint.getPoints().length > 0) {
        extent = multiPoint.getExtent();
        var bExtent = true;
        for (var m = 0; m < 4; m++) {
          if (extent[m] == Infinity || extent[m] == NaN) {
            bExtent = false;
            break;
          }
        }
        if (bExtent) {
          this.zoomToExtent(extent, true);
        }
      }
      return extent;
    }
  }, {
    key: 'zoomToExtent',


    /**
     * 缩放到当前范围
     * @param extent
     * @param isanimation
     * @param duration
     */
    value: function zoomToExtent(extent, isanimation, duration) {
      var view = this.map.getView();
      var size = this.map.getSize();
      /**
       *  @type {ol.Coordinate} center The center of the view.
       */
      var center = ol.extent.getCenter(extent);
      if (!isanimation) {
        view.fit(extent, size, {
          padding: [350, 200, 200, 350]
        });
        view.setCenter(center);
      } else {
        if (!duration) {
          duration = 100;
          var pan = ol.animation.pan({
            duration: duration,
            source: /** @type {ol.Coordinate} */view.getCenter()
          });
          var bounce = ol.animation.bounce({
            duration: duration,
            resolution: view.getResolution()
          });
          this.map.beforeRender(pan, bounce);
          view.setCenter(center);
          view.fit(extent, size, {
            padding: [200, 350, 200, 350]
          });
        }
      }
    }
  }, {
    key: 'zoomByLineFeature',


    /**
     * 根据当前线要素缩放
     * @param feature
     */
    value: function zoomByLineFeature(feature) {
      var linefeature = null;
      if (feature.geometry.hasOwnProperty('paths')) {
        var feat = {
          'type': 'Feature',
          'geometry': {
            'type': 'LineString',
            'coordinates': feature.geometry.paths[0]
          }
        };
        linefeature = new ol.format.GeoJSON().readFeature(feat);
      } else {
        linefeature = new ol.Feature({
          geometry: new ol.format.WKT().readGeometry(feature.geometry)
        });
      }
      if (linefeature != null) {
        var extent = linefeature.getGeometry().getExtent();
        this.zoomToExtent(extent, false);
      }
    }
  }, {
    key: 'OrderLayerZindex',


    /**
     * 调整图层
     * @constructor
     */
    value: function OrderLayerZindex() {
      var _this4 = this;

      if (this.map) {
        (function () {
          var layerindex = 5;
          var layers = _this4.map.getLayers();
          //调整面图层
          layers.forEach(function (layer) {
            var layerNameTemp = layer.get("layerName");
            if (_this4.polygonLayers.indexOf(layerNameTemp) >= 0) {
              layer.setZIndex(layerindex++);
            }
          }, _this4);
          //调整线图层
          layers.forEach(function (layer) {
            var layerNameTemp = layer.get("layerName");
            if (_this4.lineLayers.indexOf(layerNameTemp) >= 0) {
              layer.setZIndex(layerindex++);
            }
          }, _this4);
          //调整点图层
          layers.forEach(function (layer) {
            var layerNameTemp = layer.get("layerName");
            if (_this4.pointLayers.indexOf(layerNameTemp) >= 0) {
              layer.setZIndex(layerindex++);
            }
          }, _this4);
        })();
      }
    }
  }, {
    key: 'getMapCurrentExtent',


    /**
     * 获取当前地图的范围
     * @returns {ol.Extent}
     */
    value: function getMapCurrentExtent() {
      return this.map.getView().calculateExtent(this.map.getSize());
    }
  }, {
    key: 'MovePointToView',


    /**
     * 判断点是否在视图内，如果不在地图将自动平移
     */
    value: function MovePointToView(coord) {
      var extent = this.getMapCurrentExtent();
      if (!ol.extent.containsXY(extent, coord[0], coord[1])) {
        this.map.getView().setCenter([coord[0], coord[1]]);
      }
    }
  }, {
    key: 'setOverLayOpacityById',


    /**
     * 设置当前overLay不可见
     * @param id
     */
    value: function setOverLayOpacityById(id) {
      if (this.map && !!id) {
        var overLay = this.map.getOverlayById(id);
        if (overLay && overLay instanceof ol.Overlay) {
          var opacity = overLay.getElement().style.opacity === '0' ? 1 : 0;
          overLay.getElement().style.opacity = opacity;
        }
      }
    }

    /**
     * 标记当前overlay
     * @param id
     * @param layerName
     */

  }, {
    key: 'makeOverLayById',
    value: function makeOverLayById(id, layerName) {
      if (this.map && !!id) {
        var overLay = this.map.getOverlayById(id);
        if (overLay && overLay instanceof ol.Overlay) {
          overLay.set('layerName', layerName);
        }
      }
    }

    /**
     * 清除地图上所有东西
     */

  }, {
    key: 'clearGraphics',
    value: function clearGraphics() {
      this.removeDrawInteraion();
      this.deactiveAll();
      this.map.getOverlays().clear();
      this._lastDrawInteractionGeometry = null;
      this.clearTempLayers();
      this.removeAllTileLayer();
    }

    /**
     * 清除所有临时图层
     */

  }, {
    key: 'clearTempLayers',
    value: function clearTempLayers() {
      if (this.map) {
        var layers = this.map.getLayers();
        if (layers) {
          layers.forEach(function (layer) {
            if (layer instanceof ol.layer.Vector) {
              if (layer.getSource() && layer.getSource().clear) {
                layer.getSource().clear();
              }
            }
          }, this);
        }
      }
    }

    /**
     * 移除所有的专题图层
     */

  }, {
    key: 'removeAllTileLayer',
    value: function removeAllTileLayer() {
      var _this5 = this;

      if (this.map) {
        var layers = this.map.getLayers();
        layers.forEach(function (layer) {
          if (layer.get('title') && layer.get('isImageType')) {
            _this5.map.removeLayer(layer);
          }
        }, this);
      }
    }

    /**
     * 通过layerName移除要素
     * @param layerName
     */

  }, {
    key: 'removeFeatureByLayerName',
    value: function removeFeatureByLayerName(layerName) {
      if (this.map) {
        var layers = this.map.getLayers();
        layers.forEach(function (layer) {
          if (layer instanceof ol.layer.Vector) {
            if (layer.get('layerName') === layerName && layer.getSource() && layer.getSource().clear) {
              layer.getSource().clear();
            }
          }
        });
      }
    }

    /**
     * 通过layerNames移除要素
     * @param layerNames
     */

  }, {
    key: 'removeFeatureByLayerNames',
    value: function removeFeatureByLayerNames(layerNames) {
      if (layerNames && layerNames instanceof Array) {
        var layers = this.map.getLayers();
        layers.forEach(function (layer) {
          if (layer instanceof ol.layer.Vector) {
            if (layerNames.indexOf(layer.get('layerName')) >= 0) {
              if (layer.getSource() && layer.getSource().clear) {
                layer.getSource().clear();
              }
            }
          }
        });
      }
    }

    /**
     * 通过feature得到当前图层
     * @param feature
     * @returns {*}
     */

  }, {
    key: 'getLayerByFeatuer',
    value: function getLayerByFeatuer(feature) {
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
            });
          }
        });
      } else {
        console.info("传入的不是要素");
      }
      return tragetLayer;
    }

    /**
     * 移除当前feature
     * @param featuer
     */

  }, {
    key: 'removeFeature',
    value: function removeFeature(featuer) {
      if (featuer instanceof ol.Feature) {
        var tragetLayer = this.getLayerByFeatuer(featuer);
        if (tragetLayer) {
          var source = tragetLayer.getSource();
          if (source && source.removeFeature) {
            source.removeFeature(featuer);
            this.cursor_ = 'pointer';
          }
        }
      } else {
        console.info("传入的不是要素");
      }
    }

    /**
     * 通过layerName移除overLay
     * @param layerName
     */

  }, {
    key: 'removeOverlayByLayerName',
    value: function removeOverlayByLayerName(layerName) {
      if (this.map) {
        var overlays = this.map.getOverlays().getArray();
        var len = overlays.length;
        for (var i = 0; i < len; i++) {
          if (overlays[i] && overlays[i].get('layerName') === layerName) {
            this.map.removeOverlay(overlays[i]);
            i--;
          }
        }
      }
    }
  }]);

  return HDMap;
}();