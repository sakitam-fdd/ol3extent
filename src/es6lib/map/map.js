class HDMap {

  constructor () {
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
    this.plotDraw = null;//标绘工具
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
  getMapParams (mapDiv, params) {
    let that = this;
    let promise = new Promise(function (resolve, reject) {
      $.ajax({
        url: params['layerUrl'] + '?f=pjson',
        type: 'GET',
        dataType: 'jsonp',
        jsonp: 'callback',
        success: function (data) {
          if (data) {
            let res = {
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
  initMap (mapDiv, params) {
    let options = params || {};
    let that = this;
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
    let len = options.lods.length;
    for (let i = 0; i < len; i++) {
      this.resolutions.push(options.lods[i].resolution)
    }
    /**
     * 定义渲染参数
     */
    let size = ol.extent.getWidth(this.projection.getExtent()) / 256;
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
    for (let z = 0; z < 19; ++z) {
      this._resolutions[z] = size / Math.pow(2, z);
      this.matrixIds[z] = z
    }
    let tileUrl = options.tileUrl;
    let tileGrid = new ol.tilegrid.TileGrid({
      tileSize: that.tileSize,
      origin: that.origin,
      extent: that.fullExtent,
      resolutions: that.resolutions
    });
    let urlTemplate = tileUrl + '/tile/{z}/{y}/{x}';
    let tileArcGISXYZ = new ol.source.XYZ({
      wrapX: false,
      tileGrid: tileGrid,
      projection: that.projection,
      tileUrlFunction: function (tileCoord) {
        let url = urlTemplate.replace('{z}', (tileCoord[0]).toString())
          .replace('{x}', tileCoord[1].toString())
          .replace('{y}', (-tileCoord[2] - 1).toString());
        return url
      }
    });
    let baseLayer = new ol.layer.Tile({
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
    })

    this.addEvent();
  }

  /**
   * 添加地图事件
   */
  addEvent () {
    this.map.on("click", event => {
      if (this.mapTools.iQuery) {
        if (this.queryparams != null && this.queryparams.drawend != null) {
          this.queryparams.drawend(event);
          this.mapTools.iQuery = false;
        }
        return;
      } else if (this.plotDraw && !this.plotDraw.isDrawing()) {
        let feature = this.map.forEachFeatureAtPixel(event.pixel, feature => {
          return feature;
        });
        if (feature && feature.getGeometry().isPlot) {
          this.plotEdit.activate(feature);  // 开始编辑
          window.ObservableObj.set('plotFeature', feature);
          window.ObservableObj.dispatchEvent('choosePlot');
        } else {
          this.plotEdit.deactivate(); // 结束编辑
        }
      }
    }, this);
  }

  /**
   * 获取当前地图叠加图层
   * @param layername
   * @returns {*}
   */
  getLayerByName (layername) {
    let targetLayer = null;
    if (this.map) {
      let layers = this.map.getLayers();
      layers.forEach(function (layer) {
        let layernameTemp = layer.get("layerName");
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
  getTempVectorLayer (layerName, params) {
    let vectorLayer = this.getLayerByName(layerName);
    if (!(vectorLayer instanceof ol.layer.Vector)) {
      vectorLayer = null;
    }
    if (!vectorLayer) {
      if (params && params.create) {
        let vectorSource = new ol.source.Vector({
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
  activeTool (toolType, params) {
    this.deactiveAll();
    if (this.mapTools.hasOwnProperty(toolType)) {
      this.mapTools[toolType] = true;
      switch (toolType) {
        case this.mapTools.toolsType.addPoint: //添加点
          this.addPointHandlerClick = this.map.once("singleclick", event => {
            this.addPoint({
              geometry: event.coordinate
            }, params);
          });
          break;
        case this.mapTools.toolsType.ljQuery: //路径分析
          this.queryparams = params;
          ol.Observable.unByKey(this.addPointHandlerClick);//移除对key的监听
          this.addPointHandlerClick = this.map.on("singleclick", event => {
            if (this.mapTools.ljQuery) {
              this.addPoint({
                geometry: event.coordinate
              }, params);
            }
          });
          break;
        case this.mapTools.toolsType.drawPlot: //plot
          if (!this.plotEdit) {
            this.plotDraw = new P.PlotDraw(this.map);
            this.plotEdit = new P.PlotEdit(this.map);
            this.plotDraw.on(P.Event.PlotDrawEvent.DRAW_END, event => {
              let feature = event.feature;
              this.setLastDrawInteractionGeometry(feature.getGeometry().clone());
              this.plotEdit.activate(feature);
              this.getTempVectorLayer(params['layerName'], {create: true}).getSource().addFeature(feature);
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
  getLastDrawInteractionGeometry () {
    return this._lastDrawInteractionGeometry;
  };

  /**
   * 设置最后绘制空间信息
   * @param geometry
   */
  setLastDrawInteractionGeometry (geometry) {
    if (geometry instanceof ol.geom.Geometry) {
      this._lastDrawInteractionGeometry = geometry;
    } else {
      console.error(geometry, "不是几何对象");
    }
  }

  /**
   * 取消所有工具的激活
   */
  deactiveAll () {
    for (let key in this.mapTools) {
      if (typeof this.mapTools[key] == 'boolean')
        this.mapTools[key] = false;
    }
    this.removeDrawInteraion();
  }

  /**
   * 移除绘制交互
   */
  removeDrawInteraion () {
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
  addPoint (attr, params) {
    let geometry = null;
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
    let iconFeature = new ol.Feature({
      geometry: geometry,
      params: params
    });
    let featureType = params.featureType;
    let imgURL = null;
    if (featureType) {
      imgURL = config.markConfig.getMarkConfigByType(featureType).imgURL;
    } else {
      imgURL = config.markConfig.getDefaultMrakConfig().imgURL;
    }
    let iconStyle = new ol.style.Style({
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
      let layer = this.getTempVectorLayer(params.layerName, {
        create: true
      });
      layer.getSource().addFeature(iconFeature);
      this.pointLayers.push(params.layerName)
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
  addTypePoints (array, drawType, params) {
    if (!params) params = {};
    if (params['isClear']) {
      this.clearGraphics();
    }
    if (!array || array.length == 0) {
      return false
    }

    let multiPoint = new ol.geom.MultiPoint([]);
    let addedPoints = [];
    for (let i = 0; i < array.length; i++) {
      let attr = array[i], geometry = null, imgSrcHover, imgSrc;

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

      let feature = new ol.Feature({
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
        imgSrcHover = config.markConfig.getMarkConfigByType(params['featureType']).hover;
        if (!imgSrcHover) {
          imgSrcHover = imgSrc;
        }
      } else {
        imgSrc = config.markConfig.getDefaultMrakConfig().imgURL;
        imgSrcHover = config.markConfig.getDefaultMrakConfig().imgURL;
      }
      let selectStyle, normalStyle;
      if (params['orderBy']) {
        selectStyle = new ol.style.Style({
          image: new ol.style.Icon({//标绘点的样式
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
          image: new ol.style.Icon({//标绘点选中的样式
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
          image: new ol.style.Icon({//标绘点的样式
            anchor: [0.5, 0.5],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            src: imgSrcHover
          })
        });
        normalStyle = new ol.style.Style({
          image: new ol.style.Icon({//标绘点选中的样式
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
        feature.setStyle(normalStyle);//设置样式
      }
      if (drawType && drawType == "overlay") {
        this.addTypeOverlay(feature, attr['attributes'], params, i);
      } else {
        if (params['layerName']) {
          let layer = this.getTempVectorLayer(params.layerName, {
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
  addTypeOverlay (feature, attributes, params, i) {
    try {
      let marker = document.createElement('div');
      marker.className = 'overlay-point iconfont';
      let color = '#EB4F38', fontSize = '31px', id = null, icon = null, coordinate = [], span = null, m = 0;
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
        if (ev.button == 2) {//鼠标右键
          window.ObservableObj.set("rightMenuFeature", feature);
          window.ObservableObj.dispatchEvent("rightMenuEvt");
        } else if (ev.button == 0) {//鼠标左键
          window.ObservableObj.set("overlay", feature);
          window.ObservableObj.dispatchEvent("overlayEvt");
        }
      };
      if (feature) {
        id = feature.getId();
        let overlaytemp = this.map.getOverlayById(id);
        if (!overlaytemp) {
          coordinate = feature.getGeometry().getCoordinates();
          let iconOverlay = new ol.Overlay({
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
    } catch (e) {

    }
  }

  /**
   * 添加线要素
   * @param feature
   * @param params
   * @returns {*}
   */
  addPolyline (feature, params) {

    let features = [];
    if (feature instanceof Array) {
      features = feature;
    } else {
      features.push(feature);
    }

    let style = null, selectStyle = null, lineStyle = null, lineSelectStyle = null;
    if (params['style']) {
      style = params['style'];
    } else {
      style = {width: 4, color: '#0000EE'};
    }
    if (params['selectStyle']) {
      selectStyle = params['selectStyle'];
    } else {
      selectStyle = {width: 6, color: '#FF0000'}
    }
    lineStyle = new ol.style.Style({
      stroke: new ol.style.Stroke(style)
    });
    lineSelectStyle = new ol.style.Style({
      stroke: new ol.style.Stroke(selectStyle)
    });


    var linefeature;
    for (let i = 0; i < features.length; i++) {
      let _feat = features[i];
      if (_feat.geometry.hasOwnProperty('paths')) {
        let feat = {
          'type': 'Feature',
          'geometry': {
            'type': 'MultiLineString',
            'coordinates': _feat.geometry.paths
          }
        };
        this.currentMapLines = this.currentMapLines.concat(_feat.geometry.paths);
        linefeature = (new ol.format.GeoJSON()).readFeature(feat);
      } else {
        linefeature = new ol.Feature({
          geometry: new ol.format.WKT().readGeometry(_feat.geometry)
        });
        let extent = linefeature.getGeometry().getExtent();
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
        linefeature.setStyle(lineStyle);//设置线段样式
      }
      if (params['layerName']) {
        let layer = this.getTempVectorLayer(params.layerName, {
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

  };

  /**
   * 添加多条线要素
   * @param features
   * @param params
   */
  addPolylines (features, params) {
    if (params['isclear']) {
      this.clearGraphics();
    }
    if (features != null && features.length > 0) {
      features.forEach(feat => {
        this.addPolyline(feat, params);
      });
      let extent = new ol.geom.MultiLineString(this.currentMapLines, null).getExtent();
      extent = this.adjustExtent(extent);
      this.zoomToExtent(extent, false);
    }
  };

  /**
   * 创建查询circle
   * @param layerName
   * @param obj
   * @param radius
   * @returns {null|*}
   */
  createSreachCircle (layerName, obj, radius) {
    if (!radius) {
      radius = 5000;
    }
    let style = new ol.style.Style({
      fill: new ol.style.Fill({
        color: 'rgba(65,105,225, 0.5)'
      })
    });
    let config = {
      radius: radius,
      maxRadius: 500000,
      map: this.map,
      layerName: layerName,
      style: style
    };
    if (config.radius > config.maxRadius) {
      config.radius = config.maxRadius
    }
    obj = $.extend(config, obj);
    if (!this.circleSerachFea) {
      this.circleSerachFeat = P.Plot.Circle.createCircleByCenterRadius(obj);
      let extent = this.circleSerachFeat.feature.getGeometry().getExtent();
      this.zoomToExtent(extent);
    } else {
      this.circleSerachFeat.setCenter(obj.center);
      this.circleSerachFeat.setRadius(obj.radius);
    }
    let circle = new ol.geom.Circle({
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
  highlightedOverlayById (id) {
    if (this.map && !!id && id !== '') {
      let overlay = this.map.getOverlayById(id);
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
  unHighlightedOverlayById (id) {
    if (this.map && !!id && id !== '') {
      let overlay = this.map.getOverlayById(id);
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
  adjustExtent (extent) {
    let width = ol.extent.getWidth(extent);
    let height = ol.extent.getHeight(extent);
    let adjust = 0.2;
    if (width < 0.05) {
      let bleft = ol.extent.getBottomLeft(extent);//获取xmin,ymin
      let tright = ol.extent.getTopRight(extent);//获取xmax,ymax
      let xmin = bleft[0] - adjust;
      let ymin = bleft[1] - adjust;
      let xmax = tright[0] + adjust;
      let ymax = tright[1] + adjust;
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
  _getExtent (multiPoint) {
    let extent = [];
    if (multiPoint.getPoints().length > 0) {
      extent = multiPoint.getExtent();
      let bExtent = true;
      for (let m = 0; m < 4; m++) {
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
  };

  /**
   * 缩放到当前范围
   * @param extent
   * @param isanimation
   * @param duration
   */
  zoomToExtent (extent, isanimation, duration) {
    let view = this.map.getView();
    let size = this.map.getSize();
    /**
     *  @type {ol.Coordinate} center The center of the view.
     */
    let center = ol.extent.getCenter(extent);
    if (!isanimation) {
      view.fit(extent, size, {
        padding: [350, 200, 200, 350]
      });
      view.setCenter(center);
    } else {
      if (!duration) {
        duration = 100;
        let pan = ol.animation.pan({
          duration: duration,
          source: /** @type {ol.Coordinate} */ (view.getCenter())
        });
        let bounce = ol.animation.bounce({
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
  };

  /**
   * 根据当前线要素缩放
   * @param feature
   */
  zoomByLineFeature (feature) {
    let linefeature = null;
    if (feature.geometry.hasOwnProperty('paths')) {
      let feat = {
        'type': 'Feature',
        'geometry': {
          'type': 'LineString',
          'coordinates': feature.geometry.paths[0]
        }
      };
      linefeature = (new ol.format.GeoJSON()).readFeature(feat);
    } else {
      linefeature = new ol.Feature({
        geometry: new ol.format.WKT().readGeometry(feature.geometry)
      });
    }
    if (linefeature != null) {
      let extent = linefeature.getGeometry().getExtent();
      this.zoomToExtent(extent, false);
    }
  };

  /**
   * 调整图层
   * @constructor
   */
  OrderLayerZindex () {
    if (this.map) {
      let layerindex = 5;
      let layers = this.map.getLayers();
      //调整面图层
      layers.forEach(layer => {
        let layerNameTemp = layer.get("layerName");
        if (this.polygonLayers.indexOf(layerNameTemp) >= 0) {
          layer.setZIndex(layerindex++);
        }
      }, this);
      //调整线图层
      layers.forEach(layer => {
        let layerNameTemp = layer.get("layerName");
        if (this.lineLayers.indexOf(layerNameTemp) >= 0) {
          layer.setZIndex(layerindex++);
        }
      }, this);
      //调整点图层
      layers.forEach(layer => {
        let layerNameTemp = layer.get("layerName");
        if (this.pointLayers.indexOf(layerNameTemp) >= 0) {
          layer.setZIndex(layerindex++);
        }
      }, this);
    }
  };

  /**
   * 获取当前地图的范围
   * @returns {ol.Extent}
   */
  getMapCurrentExtent () {
    return this.map.getView().calculateExtent(this.map.getSize());
  };

  /**
   * 判断点是否在视图内，如果不在地图将自动平移
   */
  MovePointToView (coord) {
    let extent = this.getMapCurrentExtent();
    if (!(ol.extent.containsXY(extent, coord[0], coord[1]))) {
      this.map.getView().setCenter([coord[0], coord[1]]);
    }
  };

  /**
   * 设置当前overLay不可见
   * @param id
   */
  setOverLayOpacityById (id) {
    if (this.map && !!id) {
      let overLay = this.map.getOverlayById(id);
      if (overLay && overLay instanceof ol.Overlay) {
        let opacity = (overLay.getElement().style.opacity === '0') ? 1 : 0;
        overLay.getElement().style.opacity = opacity;
      }
    }
  }

  /**
   * 标记当前overlay
   * @param id
   * @param layerName
   */
  makeOverLayById (id, layerName) {
    if (this.map && !!id) {
      let overLay = this.map.getOverlayById(id);
      if (overLay && overLay instanceof ol.Overlay) {
        overLay.set('layerName', layerName)
      }
    }
  }

  /**
   * 清除地图上所有东西
   */
  clearGraphics () {
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
  clearTempLayers () {
    if (this.map) {
      let layers = this.map.getLayers();
      if (layers) {
        layers.forEach(layer => {
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
  removeAllTileLayer () {
    if (this.map) {
      let layers = this.map.getLayers();
      layers.forEach(layer => {
        if (layer.get('title') && layer.get('isImageType')) {
          this.map.removeLayer(layer);
        }
      }, this);
    }
  }

  /**
   * 通过layerName移除要素
   * @param layerName
   */
  removeFeatureByLayerName (layerName) {
    if (this.map) {
      let layers = this.map.getLayers();
      layers.forEach(layer => {
        if (layer instanceof ol.layer.Vector) {
          if (layer.get('layerName') === layerName && layer.getSource() && layer.getSource().clear) {
            layer.getSource().clear();
          }
        }
      })
    }
  }

  /**
   * 通过layerNames移除要素
   * @param layerNames
   */
  removeFeatureByLayerNames (layerNames) {
    if (layerNames && layerNames instanceof Array) {
      let layers = this.map.getLayers();
      layers.forEach(layer => {
        if (layer instanceof ol.layer.Vector) {
          if (layerNames.indexOf(layer.get('layerName')) >= 0) {
            if (layer.getSource() && layer.getSource().clear) {
              layer.getSource().clear();
            }
          }
        }
      })
    }
  }

  /**
   * 通过feature得到当前图层
   * @param feature
   * @returns {*}
   */
  getLayerByFeatuer (feature) {
    let tragetLayer = null;
    if (feature instanceof ol.Feature) {
      let source = null;
      let layers = this.map.getLayers();
      layers.forEach(layer => {
        let source = layer.getSource();
        if (source.getFeatures) {
          let features = source.getFeatures();
          features.forEach(feat => {
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
  }

  /**
   * 移除当前feature
   * @param featuer
   */
  removeFeature (featuer) {
    if (featuer instanceof ol.Feature) {
      let tragetLayer = this.getLayerByFeatuer(featuer);
      if (tragetLayer) {
        let source = tragetLayer.getSource();
        if (source && source.removeFeature) {
          source.removeFeature(featuer);
          this.cursor_ = 'pointer'
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
  removeOverlayByLayerName (layerName) {
    if (this.map) {
      let overlays = this.map.getOverlays().getArray();
      let len = overlays.length;
      for (let i = 0; i < len; i++) {
        if (overlays[i] && overlays[i].get('layerName') === layerName) {
          this.map.removeOverlay(overlays[i]);
          i--;
        }
      }
    }
  }
}

export default HDMap