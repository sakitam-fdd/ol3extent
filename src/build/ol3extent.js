var app = {};
app.Drag = function () {
  ol.interaction.Pointer.call(this, {
    handleDownEvent: app.Drag.prototype.handleDownEvent,
    handleDragEvent: app.Drag.prototype.handleDragEvent,
    handleMoveEvent: app.Drag.prototype.handleMoveEvent,
    handleUpEvent: app.Drag.prototype.handleUpEvent
  });
  this.customType = "appDrag";
  /**
   * @type {ol.Pixel}
   * @private
   */
  this.coordinate_ = null;

  /**
   * @type {string|undefined}
   * @private
   */
  this.cursor_ = 'pointer';

  /**
   * @type {ol.Feature}
   * @private
   */
  this.feature_ = null;

  /**
   * @type {string|undefined}
   * @private
   */
  this.previousCursor_ = undefined;

};
ol.inherits(app.Drag, ol.interaction.Pointer);

/**
 * @param {ol.MapBrowserEvent} evt Map browser event.
 * @return {boolean} `true` to start the drag sequence.
 */
app.Drag.prototype.handleDownEvent = function (evt) {
  if (evt.originalEvent.button === 0/*鼠标左键*/) {
    var map = evt.map;
    var feature = map.forEachFeatureAtPixel(evt.pixel,
      function (feature) {
        return feature;
      });
    if (feature && feature.get("params") && feature.get("params").moveable) {
      this.coordinate_ = evt.coordinate;
      this.feature_ = feature;
    }
    return !!feature;
  }
};

/**
 * @param {ol.MapBrowserEvent} evt Map browser event.
 */
app.Drag.prototype.handleDragEvent = function (evt) {
  if (!this.coordinate_) {
    return;
  }
  var deltaX = evt.coordinate[0] - this.coordinate_[0];
  var deltaY = evt.coordinate[1] - this.coordinate_[1];
  var geometry = /** @type {ol.geom.SimpleGeometry} */
    (this.feature_.getGeometry());
  geometry.translate(deltaX, deltaY);
  this.coordinate_[0] = evt.coordinate[0];
  this.coordinate_[1] = evt.coordinate[1];
  this.feature_.dispatchEvent("featureMove");
};


/**
 * @param {ol.MapBrowserEvent} evt Event.
 */
app.Drag.prototype.handleMoveEvent = function (evt) {
  if (this.cursor_) {
    var map = evt.map;
    var feature = null;
    if (this.feature_) {
      feature = this.feature_;
    } else {
      feature = map.forEachFeatureAtPixel(evt.pixel,
        function (feature) {
          return feature;
        });
    }

    var element = evt.map.getTargetElement();
    if (feature) {
      if (element.style.cursor != this.cursor_) {
        this.previousCursor_ = element.style.cursor;
        element.style.cursor = this.cursor_;
      }
    } else if (this.previousCursor_ !== undefined) {
      element.style.cursor = this.previousCursor_;
      this.previousCursor_ = undefined;
    }
  }
};

/**
 * @return {boolean} `false` to stop the drag sequence.
 */
app.Drag.prototype.handleUpEvent = function () {
  window.testdrag = false;
  this.coordinate_ = null;
  this.feature_ = null;
  return false;
};
/**
 * @Description: 用于周边搜索circle
 * @author FDD
 * @date 2017/1/11
 * @version V1.0.0
 */

ol.Observable.CustomCircle = function (params) {
  /**
   * 当前配置
   * @type {*}
   */
  this.options = params || {};

  this.version = '1.0.0';

  if (!params['map']) {
    throw new goog.debug.Error
  }
  /**
   * 默认配置
   * @type {{radius: number, minRadius: number, maxRadius: number, layerName: string}}
   */
  this.defaultConfig = {
    radius: 5000,
    minRadius: 50,
    maxRadius: 50000,
    layerName: 'perimeterSerachLayer',
    showPolygonFeat: false
  };
  this.options = $.extend(this.defaultConfig, this.options);
  /**
   * 当前半径
   */
  this.currentMeterRadius = this.options.radius;
  /**
   * 线要素
   * @type {ol.Feature}
   */
  this.lineStringFeat = new ol.Feature({});
  /**
   * 中心点要素
   * @type {ol.Feature}
   */
  this.centerFeat = new ol.Feature({});
  /**
   * 面要素
   * @type {ol.Feature}
   */
  this.polygonFeat = new ol.Feature({});
  /**
   * 如果当前坐标不是米制单位需要计算获取长度
   * @type {ol.Sphere}
   */
  this.sphare = new ol.Sphere(6378137);
  /**
   * 获取当前地图
   */
  this.map = this.options.map;
  /**
   * 编辑按钮id
   * @type {string}
   */
  this.eidtId = "HandleLabel" + Math.floor((Math.random() + Math.random()) * 1000);
  this.ismousedown = false;
  this.circle = null;
  this.isMoving = false;
  this.circleObject = null;
  this.projection = this.getCurrentProjection()
  this.projectRadius = null;
  this.markerOverlay = null;
  /**
   * 最小半径
   * @type {number}
   */
  this.minProjectRadius = this.transformRadius(this.options.center, this.options.minRadius);
  /**
   * 最大半径
   * @type {number}
   */
  this.maxProjectRadius = this.transformRadius(this.options.center, this.options.maxRadius);

  this.addCircle(this.options.center, this.options.radius);

  return this.circleObject
};

/**
 * 创建circle
 * @param center
 * @param radius
 */
ol.Observable.CustomCircle.prototype.addCircle = function (center, radius) {
  var layer = this.getVectorLayer(this.options.layerName);
  var style = new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(71, 129, 217, 0.2)'
    }),
    stroke: new ol.style.Stroke({
      color: 'rgba(71, 129, 217, 1)',
      width: 1
    }),
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({
        color: 'rgba(71, 129, 217, 0.2)'
      })
    })
  });
  this.projectRadius = this.transformRadius(center, radius);
  this.circle = new ol.geom.Circle(center, this.projectRadius);

  var polygon = ol.geom.Polygon.fromCircle(this.circle);
  this.polygonFeat.setGeometry(polygon);
  if (this.options.showPolygonFeat) {
    layer.getSource().addFeature(this.polygonFeat);
    if(this.options.style && this.options.style instanceof ol.style.Style){
      this.polygonFeat.setStyle(this.options.style);
    }
  }
  var coordinates = polygon.getCoordinates();
  var multiLineString = new ol.geom.MultiLineString(coordinates);
  this.lineStringFeat.setGeometry(multiLineString);
  layer.getSource().addFeature(this.lineStringFeat);
  this.lineStringFeat.setStyle(style);

  this.addCircleFeat(layer); //添加中心点
  this.addMaker(); // 添加maker
  this.editCircle(); // 添加编辑
  this.getThis()
};
/**
 * 获取图层
 * @returns {*}
 */
ol.Observable.CustomCircle.prototype.getVectorLayer = function (layerName) {
  var vector = null;
  if (this.map) {
    var layers = this.map.getLayers();
    layers.forEach(function (layer) {
      var layernameTemp = layer.get("layerName");
      if (layernameTemp === layerName) {
        vector = layer;
      }
    }, this);
  }
  if (!vector) {
    vector = new ol.layer.Vector({
      layerName: layerName,
      source: new ol.source.Vector({
        wrapX: false,
      }),
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(71, 129, 217, 0.2)'
        }),
        stroke: new ol.style.Stroke({
          color: 'rgba(71, 129, 217, 1)',
          width: 1
        }),
        image: new ol.style.Circle({
          radius: 5,
          fill: new ol.style.Fill({
            color: 'rgba(71, 129, 217, 0.2)'
          })
        })
      })
    });
    this.map.addLayer(vector);
  }
  this.targetLayer = vector;
  return vector;
};
/**
 * 获取当前投影坐标
 */
ol.Observable.CustomCircle.prototype.getCurrentProjection = function () {
  return this.map.getView().getProjection();
}
/**
 * 添加中心点要素
 */
ol.Observable.CustomCircle.prototype.addCircleFeat = function (layer) {
  var centerStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: 5,
      stroke: new ol.style.Stroke({
        color: 'rgba(71, 129, 217, 1)',
        width: 1
      }),
      fill: new ol.style.Fill({
        color: 'rgba(255,255,255,0.5)'
      })
    })
  });
  this.centerFeat.setGeometry(new ol.geom.Point(this.circle.getCenter()));
  this.centerFeat.setStyle(centerStyle);
  layer.getSource().addFeature(this.centerFeat);
};
/**
 * 添加编辑按钮
 */
ol.Observable.CustomCircle.prototype.addMaker = function () {
  var vienna = "<div style='display: none; text-decoration: none;color: white;font-size: 14px;font-weight: bold;margin: 0px; padding: 0px; width: 31px; height: 19px; overflow: hidden;'>" +
    "<img src='data:img;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAUCAYAAABGUvnzAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjA2MDQwMkMzRDNGRTExRTJBQTNGRTNFMDhCOTA5NDczIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjA2MDQwMkM0RDNGRTExRTJBQTNGRTNFMDhCOTA5NDczIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MDYwNDAyQzFEM0ZFMTFFMkFBM0ZFM0UwOEI5MDk0NzMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MDYwNDAyQzJEM0ZFMTFFMkFBM0ZFM0UwOEI5MDk0NzMiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz5OfKcHAAAFT0lEQVRo3uWaS2wbRRjHTQOoRFTi0ZagVhQJiRO9AOoNCXEhnIpUwQXK49QTHJKmVbAbqkXiglTa3qmEVJWgIoJ4qChKiYBIDsRJlNj1I97Eid/xer2OHTtOYmf4f2Z3tbYn8dq1lMqO9FOkzOzM7P//zcw3O7EIgmDh8BB4WBgcPCqcP39a6O//AnwNhk3R1/cdfl8Dn4O3weFd+jFyEPRYLBZHu7Df2jLGLLzOHxFstmPo3IbG7D8PDy86Z2akBbc7lYjFcmZZ9PkUeu73kZEA2vkXfIbBPLWHwT2gl4RhbfDDMZir7bzDIblmZ1MBUcwtmYDqeebnlTk8V0/baoNpAI8JVuurqPzLX6OjocLGRnGnVGIlolhsHDynPr9jHx+PYCC/oe0XdzH4efBRmxpco+1qPF4Mrqww0e9nPq+Xedxu5jYB1aP69NzK8jKTJGlXbY0G0wC6haGhl1FpdGpiIkYGbW9ttYwi2kO0JjCQMfTxbAcZXKNtJBxmXo+HuZzO+4YMD4VCbG5qqkZbo8GPgheEgYFvJ8bGwtvb22yzUGg5ZDS9IAZyo4MMrtA2GonoM7ZVUHsUNNXaagYfAEexN3x44/p1N5mLpZlt5PNcXvvEUabRsjJol0z+8eZNEZH2egcYXKGtLMtMFEXm8/m4aPo1Wkb4sWQnEokKbTWDKXt9Sbhw4ZuZyck4mZBbX+eidUI0U06Q0aLHoyDSrnSAwbq203Z7nGbZIgzmYdSumXIiFAyyBZdL11Yz+EnwBjK7u4l4fGM9k2HZtbUajB3wys3Wo/ZhdAmD+LsDDNa1jYbDG2TAciBQg1EzXrnZepS0pWRZ11YzmDblM5jW9mwmU1xLp1laUSowNlxdxqNefVolvrLZZtHnoTY3WNcWwhfDmMGUEBkxalVdxqNe/TVMIk1bzeDnwHtw/Z9cNltSsE+kkskKjI1Wl/GoVz+fy7GrgjCHyD7S5gbr2mLilGKxGItGoxUYtaou41GvfgYrpKat0eD38Yc/pXi8kJIkllxdrcHYMK/cbD0ZiQCW6R289KSahLS7wWVtsf0VkghuSoSqMWrGKzdbD2ditp7N6tpqBh8D7yARGPHMz8syBrGKSONh7KCZciKJgUSCwRyWkO/VM2I7G6xr63U65TS2P8qkeRi1a6acULD9RUMhXVvNYPqW2StYrVd/unVLzGAQcZzVYtgveGidNFpGULvpVIqN37kTRFSf64Akq0Jbyj1ojySjeeh5S4NlBLWbw9Zn1FYzuBu8As6h4A+nwyHJmOqIBJppLYPak7BEL/p8aUTYGF76mQ4wuFLb6WmJTMYy2nLo+Lm0sFChrWZwFzgOTguXLn1JCQGZQGaEYUxoefm+CSN9xx70/9Lc1zeFJetM+Ual/Q2u0Tbg96c3NzdZHoa0ikKhwOLRaI22xk+VFGknwVm4f40GQrcclPHS0koGBXHOWllaMg/qk7k4/zFaEfxut1IewMWLn6KfQ1X7bzt/qqzRlm7Z6Nv81tZWGTK8GehZ+vIoer1cbY0GUzb7hLqcnC1HG5YU+uzlRuIFg/N0fqUjlFmoPoKjsHDvnvLr7dtLWDruCoODH6P9p9XI7pRv0btq63O5ZCSd+ZJ2Y9cASipVIGP30rb6urBLHcjJ8pJC+4bVeoUyQBoQIsTRMP3948LAwA/ofEi4fPnUHuZWGNyGF/77oi3vwv+AuqQcVyPuzXKaT5EH8RvgA/AueAucUs+Dj1ede7kX/g3286DSq77PvmrLM9gYcd1qmk9nuRPqDDPLCfW5I2rnXWb/ZafBfh5UetT32VdtyeD/AFqSV3weDOF9AAAAAElFTkSuQmCC'" +
    "style='left: 0px; top: 0px;'> <label unselectable='on' id=" + "'" + this.eidtId + "'" +
    "style='position: absolute; display: inline; cursor: inherit; border: none; padding: 0px;" +
    "white-space: nowrap; font-style: normal;" +
    "font-variant: normal; font-weight: normal;" +
    "font-stretch: normal; font-size: 12px;" +
    "line-height: 20px;font-family: arial, simsun; height: 20px;" +
    "color: black; text-indent: 5px;text-align: center; zoom: 1;" +
    "width: 56px; -webkit-user-select: none;left: 30px; top: 0px;" +
    "background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAUCAYAAABGUvnzAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjA2MDQwMkMzRDNGRTExRTJBQTNGRTNFMDhCOTA5NDczIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjA2MDQwMkM0RDNGRTExRTJBQTNGRTNFMDhCOTA5NDczIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MDYwNDAyQzFEM0ZFMTFFMkFBM0ZFM0UwOEI5MDk0NzMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MDYwNDAyQzJEM0ZFMTFFMkFBM0ZFM0UwOEI5MDk0NzMiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz5OfKcHAAAFT0lEQVRo3uWaS2wbRRjHTQOoRFTi0ZagVhQJiRO9AOoNCXEhnIpUwQXK49QTHJKmVbAbqkXiglTa3qmEVJWgIoJ4qChKiYBIDsRJlNj1I97Eid/xer2OHTtOYmf4f2Z3tbYn8dq1lMqO9FOkzOzM7P//zcw3O7EIgmDh8BB4WBgcPCqcP39a6O//AnwNhk3R1/cdfl8Dn4O3weFd+jFyEPRYLBZHu7Df2jLGLLzOHxFstmPo3IbG7D8PDy86Z2akBbc7lYjFcmZZ9PkUeu73kZEA2vkXfIbBPLWHwT2gl4RhbfDDMZir7bzDIblmZ1MBUcwtmYDqeebnlTk8V0/baoNpAI8JVuurqPzLX6OjocLGRnGnVGIlolhsHDynPr9jHx+PYCC/oe0XdzH4efBRmxpco+1qPF4Mrqww0e9nPq+Xedxu5jYB1aP69NzK8jKTJGlXbY0G0wC6haGhl1FpdGpiIkYGbW9ttYwi2kO0JjCQMfTxbAcZXKNtJBxmXo+HuZzO+4YMD4VCbG5qqkZbo8GPgheEgYFvJ8bGwtvb22yzUGg5ZDS9IAZyo4MMrtA2GonoM7ZVUHsUNNXaagYfAEexN3x44/p1N5mLpZlt5PNcXvvEUabRsjJol0z+8eZNEZH2egcYXKGtLMtMFEXm8/m4aPo1Wkb4sWQnEokKbTWDKXt9Sbhw4ZuZyck4mZBbX+eidUI0U06Q0aLHoyDSrnSAwbq203Z7nGbZIgzmYdSumXIiFAyyBZdL11Yz+EnwBjK7u4l4fGM9k2HZtbUajB3wys3Wo/ZhdAmD+LsDDNa1jYbDG2TAciBQg1EzXrnZepS0pWRZ11YzmDblM5jW9mwmU1xLp1laUSowNlxdxqNefVolvrLZZtHnoTY3WNcWwhfDmMGUEBkxalVdxqNe/TVMIk1bzeDnwHtw/Z9cNltSsE+kkskKjI1Wl/GoVz+fy7GrgjCHyD7S5gbr2mLilGKxGItGoxUYtaou41GvfgYrpKat0eD38Yc/pXi8kJIkllxdrcHYMK/cbD0ZiQCW6R289KSahLS7wWVtsf0VkghuSoSqMWrGKzdbD2ditp7N6tpqBh8D7yARGPHMz8syBrGKSONh7KCZciKJgUSCwRyWkO/VM2I7G6xr63U65TS2P8qkeRi1a6acULD9RUMhXVvNYPqW2StYrVd/unVLzGAQcZzVYtgveGidNFpGULvpVIqN37kTRFSf64Akq0Jbyj1ojySjeeh5S4NlBLWbw9Zn1FYzuBu8As6h4A+nwyHJmOqIBJppLYPak7BEL/p8aUTYGF76mQ4wuFLb6WmJTMYy2nLo+Lm0sFChrWZwFzgOTguXLn1JCQGZQGaEYUxoefm+CSN9xx70/9Lc1zeFJetM+Ual/Q2u0Tbg96c3NzdZHoa0ikKhwOLRaI22xk+VFGknwVm4f40GQrcclPHS0koGBXHOWllaMg/qk7k4/zFaEfxut1IewMWLn6KfQ1X7bzt/qqzRlm7Z6Nv81tZWGTK8GehZ+vIoer1cbY0GUzb7hLqcnC1HG5YU+uzlRuIFg/N0fqUjlFmoPoKjsHDvnvLr7dtLWDruCoODH6P9p9XI7pRv0btq63O5ZCSd+ZJ2Y9cASipVIGP30rb6urBLHcjJ8pJC+4bVeoUyQBoQIsTRMP3948LAwA/ofEi4fPnUHuZWGNyGF/77oi3vwv+AuqQcVyPuzXKaT5EH8RvgA/AueAucUs+Dj1ede7kX/g3286DSq77PvmrLM9gYcd1qmk9nuRPqDDPLCfW5I2rnXWb/ZafBfh5UetT32VdtyeD/AFqSV3weDOF9AAAAAElFTkSuQmCC) -31px 0px;'></label>" +
    "</div>";

  var markerOverlay = "<div title='Marker'></div>";
  markerOverlay = jQuery.parseHTML(markerOverlay)[0];
  vienna = jQuery.parseHTML(vienna)[0];
  $(this.map.getTargetElement()).append(vienna);
  $(this.map.getTargetElement()).append(markerOverlay);
  // 123
  var length = 0;
  switch (this.projection.getCode()) {
    case 'EPSG:4326':
      length = this.sphare.haversineDistance(this.circle.getCenter(), this.circle.getLastCoordinate());
      length = Math.floor(length) + 1;
      break;
    case 'EPSG:3857':
    case 'EPSG:102100':
      length = this.circle.getRadius();
      break;
  }

  length = Math.floor(length);
  if (length > this.options.maxRadius) {
    length = this.options.maxRadius;
  }
  $(("#" + this.eidtId)).html(length + "m");

  var markerPos = this.circle.getLastCoordinate();
  this.markerOverlay = new ol.Overlay({
    position: markerPos,
    positioning: 'center-center',
    element: vienna,
    offset: [0, 0]
  });
  this.map.addOverlay(this.markerOverlay);
  $(vienna).css("display", "block");
};
/**
 * 编辑当前circle
 */
ol.Observable.CustomCircle.prototype.editCircle = function () {
  var that = this;
  $(document).on('mouseup', function (event) {
    if (that.ismousedown && that.isMoving) {
      if (that.options.onRadiusChangeEnd) {
        that.options.onRadiusChangeEnd(that.circleObject);
      }
    }
    that.ismousedown = false;
    that.isMoving = false;
    $(document).off("mousemove");
    $(that.markerOverlay.getElement()).off('mousemove');
  });
  $(this.markerOverlay.getElement()).on("mouseup", function (event) {
    if (that.ismousedown && that.isMoving) {
      if (that.options.onRadiusChangeEnd) {
        that.options.onRadiusChangeEnd(that.circleObject);
      }
    }
    that.ismousedown = false;
    that.isMoving = false;
    $(that.markerOverlay.getElement()).off('mousemove');
  });
  $(this.markerOverlay.getElement()).on("mousedown", function (event) {
    that.ismousedown = true;
    event.preventDefault();
    that.map.on('pointermove', function (event) {
      that.isMoving = true;
      if (that.ismousedown) {
        if (event.preventDefault) {
          event.preventDefault();
        } else {
          event.returnValue = false;
        }
        var radius = that.getRadiusSquared(event);
        if (radius >= that.minProjectRadius && radius <= that.maxProjectRadius) {
          // TODO 注意要素坐标和半径之间转换关系
          that.circle.setRadius(radius);
          var polygon = ol.geom.Polygon.fromCircle(that.circle);
          that.polygonFeat.setGeometry(polygon);
          var coordinates = polygon.getCoordinates();
          var multiLineString = new ol.geom.MultiLineString(coordinates);
          that.lineStringFeat.setGeometry(multiLineString);
          switch (that.projection.getCode()) {
            case 'EPSG:4326':
              that.currentMeterRadius = that.sphare.haversineDistance(that.circle.getCenter(), that.circle.getLastCoordinate());
              that.currentMeterRadius = Math.floor(that.currentMeterRadius) + 1;
              break;
            case 'EPSG:3857':
            case 'EPSG:102100':
              that.currentMeterRadius = Math.floor(radius) + 1;
              break;
          }
          (that.currentMeterRadius > that.options.maxRadius) ? (that.currentMeterRadius = that.options.maxRadius) : (that.currentMeterRadius = that.currentMeterRadius)
          $(("#" + that.eidtId)).html(that.currentMeterRadius + "m");
          that.markerOverlay.setPosition(that.circle.getLastCoordinate());
        }
      }
    });
  });
};
/**
 * 获取半径的平方根
 * @param event
 * @returns {number}
 */
ol.Observable.CustomCircle.prototype.getRadiusSquared = function (event) {
  var center = this.circle.getCenter();
  var lastCoordinat = event.coordinate;
  var radius = Math.sqrt(Math.pow(lastCoordinat[0] - center[0], 2) + Math.pow(lastCoordinat[1] - center[1], 2));
  if (radius - this.maxProjectRadius > 0.0) {
    radius = this.maxProjectRadius;
  } else if (radius - this.minProjectRadius < 0) {
    radius = this.minProjectRadius;
  }
  return radius;
};
/**
 * 转换半径
 * @param center
 * @param meterRadius
 * @returns {number}
 */
ol.Observable.CustomCircle.prototype.transformRadius = function (center, meterRadius) {
  var transformRadiu = 0;
  switch (this.projection.getCode()) {
    case 'EPSG:4326':
      var lastcoord = this.sphare.offset(center, meterRadius, (270 / 360) * 2 * Math.PI);
      var dx = center[0] - lastcoord[0];
      var dy = center[1] - lastcoord[1];
      transformRadiu = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
      break;
    case 'EPSG:3857':
    case 'EPSG:102100':
      transformRadiu = meterRadius;
      break;
  }
  return transformRadiu
};
/**
 * 获取当前创建的circle
 */
ol.Observable.CustomCircle.prototype.getThis = function () {
  var that = this;
  this.circleObject = {
    feature: this.lineStringFeat,
    centerFeature: this.centerFeat,
    markerOverLay: this.markerOverlay,
    getRadius: function () {
      return that.currentMeterRadius;
    },
    setCenter: function (center) {
      var circle = this.getCircle();
      circle.setCenter(center);
      var polygon = ol.geom.Polygon.fromCircle(circle);
      var coordinates = polygon.getCoordinates();
      var multiLineString = new ol.geom.MultiLineString(coordinates);
      that.lineStringFeat.setGeometry(multiLineString);
      that.centerFeat.setGeometry(new ol.geom.Point(center));
      that.markerOverlay.setPosition(that.lineStringFeat.getGeometry().getLastCoordinate());
    },
    getCircle: function () {
      return that.circle;
    },
    setRadius: function (radius) {
      var circle = this.getCircle();
      var projRadius = that.transformRadius(circle.getCenter(), radius);
      circle.setRadius(projRadius);
      // TODO 注意转换关系 中新点任意 ， radius 为米制
      switch (that.projection.getCode()) {
        case 'EPSG:4326':
          that.currentMeterRadius = that.sphare.haversineDistance(that.circle.getCenter(), that.circle.getLastCoordinate());
          that.currentMeterRadius = Math.floor(that.currentMeterRadius) + 1;
          break;
        case 'EPSG:3857':
        case 'EPSG:102100':
          that.currentMeterRadius = radius;
          break;
      }
      if (projRadius >= that.minProjectRadius && projRadius <= that.maxProjectRadius) {
        var polygon = ol.geom.Polygon.fromCircle(circle);
        var coordinates = polygon.getCoordinates();
        var multiLineString = new ol.geom.MultiLineString(coordinates);
        that.lineStringFeat.setGeometry(multiLineString);
        that.currentMeterRadius = Math.floor(that.currentMeterRadius);
        if (that.currentMeterRadius > that.options.maxRadius) {
          that.currentMeterRadius = that.options.maxRadius;
        }
        $(("#" + that.eidtId)).html(that.currentMeterRadius + "m");
        that.markerOverlay.setPosition(circle.getLastCoordinate());
      }
      if (that.options.onRadiusChangeEnd) {
        that.options.onRadiusChangeEnd(that.circleObject);
      }
    },
    getExtent: function () {
      return this.getCircle().getExtent();
    },
    getWKT: function () {
      var polygon = ol.geom.Polygon.fromCircle(that.getCircle());
      var wkt = new ol.format.WKT().writeGeometry(polygon);
      return wkt;
    },
    destroy: function () {
      that.map.removeLayer(that.targetLayer);
      that.map.removeOverlay(that.markerOverlay);
    }
  };
  return this.circleObject;
};
/**
 * @classdesc
 * A control to display a loader image (typically an animated GIF) when
 * the map tiles are loading, and hide the loader image when tiles are
 * loaded
 *
 * @constructor
 * @extends {ol.control.Control}
 * @api stable
 * @author Emmanuel Blondel
 *
 */
ol.control.Loading = function (opt_options) {

  var options = opt_options || {};

  this.mapListeners = [];

  this.tileListeners = [];

  this.loadStatus_ = false;

  this.loadProgress_ = [0, 1];

  //widget type
  if (options.widget) if (['animatedgif', 'progressbar'].indexOf(options.widget) == -1) alert("invalid value for 'widget'");
  this.widget = (options.widget) ? options.widget : 'animatedgif';

  //progress mode
  if (options.progressMode) if (['tile', 'layer'].indexOf(options.progressMode) == -1) alert("invalid value for 'progressMode'");
  this.loadProgressByTile_ = ( options.progressMode == 'layer') ? false : true;

  //other options
  this.showPanel = (typeof options.showPanel == 'boolean') ? options.showPanel : true;

  //class name
  var className = options.className ? options.className : 'ol-loading-panel';

  //element
  var elementDom = (this.widget == 'animatedgif') ? 'span' : 'progress';
  var element = document.createElement(elementDom);
  element.className = className + ' ' + 'ol-unselectable';
  if (this.widget == 'progressbar') {
    //element progress bar for old browsers
    var div = document.createElement('div');
    div.className = 'ol-progress-bar';
    var span = document.createElement('span');
    div.appendChild(span);
  }

  //events
  this.oncustomstart = (options.onstart) ? options.onstart : false;
  this.oncustomprogress = (options.onprogress) ? options.onprogress : false;
  this.oncustomend = (options.onend) ? options.onend : false;

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
};

ol.inherits(ol.control.Loading, ol.control.Control);

/**
 * Setup the loading panel
 */
ol.control.Loading.prototype.setup = function () {
  var self = this;
  var size = this.getMap().getSize();
  this.element.style.left = String(Math.round(size[0] / 2)) + 'px';
  this.element.style.bottom = String(Math.round(size[1] / 2)) + 'px';

  this.mapListeners.push(this.getMap().on('pointerdown', function () {
    self.hide();
  }));

  //display loading panel before render
  this.mapListeners.push(this.getMap().beforeRender(function (map, framestate) {
    self.registerLayersLoadEvents_();
    self.show();
    if (self.oncustomstart) {
      self.oncustomstart.apply(self, []);
    }
    return false;
  }));

  //hide loading panel after render
  this.mapListeners.push(this.getMap().on("postrender", function (e) {
    self.updateLoadStatus_();
    if (self.loadStatus_) {
      if (self.oncustomend) {
        self.oncustomend.apply(self, []);
      }
      self.hide();
    }
  }));

};


/**
 * Reports load progress for a source
 * @param source
 * @return true if complete false otherwise
 */
ol.control.Loading.prototype.updateSourceLoadStatus_ = function (source) {
  return Math.round(source.loaded / source.loading * 100) == 100;
};

/**
 * Register layer load events
 * @param layer
 */
ol.control.Loading.prototype.registerLayerLoadEvents_ = function (layer) {
  var self = this;
  layer.getSource().on("tileloadstart", function (e) {
    if (self.loadStatus_) {
      self.loadStatus_ = false;
      self.loadProgress_ = [0, 1];
      if (self.widget == 'progressbar') {
        self.element.value = self.loadProgress_[0];
        self.element.max = self.loadProgress_[1];
      }
      self.show();
      if (self.oncustomstart) {
        self.oncustomstart.apply(self, []);
      }
    }
    this.loading = (this.loading) ? this.loading + 1 : 1;
    this.isLoaded = self.updateSourceLoadStatus_(this);
    if (self.loadProgressByTile_) {
      self.loadProgress_[1] += 1;
      if (self.widget == 'progressbar') {
        self.element.max = this.loadProgress_[1];
        var progressBarDiv = self.element.getElementsByClassName('ol-progress-bar');
        if (progressBarDiv.length > 0) progressBarDiv[0].children()[0].width = String(parseInt(100 * self.progress(), 0)) + '%';
      }
    }
  });
  layer.getSource().on(["tileloadend","tileloaderror"], function (e) {
    this.loaded = (this.loaded) ? this.loaded + 1 : 1;
    this.isLoaded = self.updateSourceLoadStatus_(this);
    if (self.loadProgressByTile_) {
      self.loadProgress_[0] += 1;
      if (self.widget == 'progressbar') {
        self.element.value = self.loadProgress_[0];
        var progressBarDiv = this.element.getElementsByClassName('ol-progress-bar');
        if (progressBarDiv.length > 0) {
          progressBarDiv[0].children()[0].width = String(parseInt(100 * self.progress(), 0)) + '%';
        }
      }
      if (self.oncustomprogress) self.oncustomprogress.apply(self, self.loadProgress_);
    }

  });
};

/**
 * Register layer load events
 *
 */
ol.control.Loading.prototype.registerLayersLoadEvents_ = function () {
  var groups = this.getMap().getLayers().getArray();
  for (var i = 0; i < groups.length; i++) {
    var layer = groups[i];
    if (layer instanceof ol.layer.Group) {
      var layers = layer.getLayers().getArray();
      for (var j = 0; j < layers.length; j++) {
        var l = layers[j];
        if (!(l instanceof ol.layer.Vector)) {
          this.tileListeners.push(this.registerLayerLoadEvents_(l));
        }
      }
    } else if (layer instanceof ol.layer.Layer) {
      if (!(layer instanceof ol.layer.Vector)) {
        this.tileListeners.push(this.registerLayerLoadEvents_(layer));
      }
    }
  }
};

/**
 * Gives a load status for the complete stack of layers
 *
 */
ol.control.Loading.prototype.updateLoadStatus_ = function () {
  var loadStatusArray = new Array();
  var groups = this.getMap().getLayers().getArray();
  for (var i = 0; i < groups.length; i++) {
    var layer = groups[i];
    if (layer instanceof ol.layer.Group) {
      var layers = layer.getLayers().getArray();
      for (var j = 0; j < layers.length; j++) {
        var l = layers[j];
        if (!(l instanceof ol.layer.Vector)) {
          loadStatusArray.push(l.getSource().isLoaded);
        }
      }
    } else {
      loadStatusArray.push(layer.getSource().isLoaded);
    }
  }

  //status
  this.loadStatus_ = (loadStatusArray.indexOf(false) == -1) && (loadStatusArray.indexOf(true) != -1);

  if (!this.loadProgressByTile_) {

    //progress
    var count = {};
    loadStatusArray.forEach(function (i) {
      count[i] = (count[i] || 0) + 1;
    });
    var loaded = (count[true]) ? count[true] : 0;

    //progress events
    if (loaded > this.loadProgress_[0]) {
      this.loadProgress_ = [loaded, loadStatusArray.length];
      if (this.widget == 'progressbar') {
        this.element.max = this.loadProgress_[1];
        this.element.value = this.loadProgress_[0];
      }
      if (this.oncustomprogress) this.oncustomprogress.apply(this, this.loadProgress_);
    }
  }
};

/**
 * Show the loading panel
 */
ol.control.Loading.prototype.show = function () {
  if (this.showPanel) this.element.style.display = 'block';
};

/**
 * Hide the loading panel
 */
ol.control.Loading.prototype.hide = function () {
  if (this.showPanel) this.element.style.display = 'none';
};

/**
 * Show the progress details
 */
ol.control.Loading.prototype.progressDetails = function () {
  return this.loadProgress_;
};

/**
 * Show the progress details
 */
ol.control.Loading.prototype.progress = function () {
  return this.loadProgress_[0] / this.loadProgress_[1];
};


/**
 * Set the map instance the control is associated with.
 * @param {ol.Map} map The map instance.
 */
ol.control.Loading.prototype.setMap = function (map) {

  // Clean up listeners associated with the previous map
  for (var i = 0, key; i < this.mapListeners.length; i++) {
    this.getMap().unByKey(this.mapListeners[i]);
  }

  this.mapListeners.length = 0;

  ol.control.Control.prototype.setMap.call(this, map);
  if (map) this.setup();
};
/**
 * OpenLayers 3 MeasureTool.
 * author:https://github.com/smileFDD
 * @constructor
 * @extends {ol.control.Control}
 * @param {Object} opt_options Control options, extends olx.control.ControlOptions.
 */
ol.control.Measure = function (opt_options) {

  var options = opt_options || {};

  this.wgs84Sphere = new ol.Sphere(6378137);
  /**
   * Currently drawn feature.
   * @type {ol.Feature}
   */
  this.drawSketch = null;
  /**
   * 监听
   * @type {null}
   */
  this.listener = null;

  /**
   * The help tooltip element.
   * @type {Element}
   */
  this.measureHelpTooltip = null;
  /**
   * 面积测量提示
   * @type {null}
   */
  this.measureAreaTooltip = null;
  /**
   * element
   * @type {null}
   */
  this.measureAreaTooltipElement = null;

  /**
   * 测量类型
   * @type {{measureLength: string, measureArea: string}}
   */
  this.measureTypes = {
    measureLength: "measureLength",
    measureArea: "measureArea"
  };
  /**
   * current active measureType
   * @type {null}
   */
  this.measureType = null;
  /**
   * drawTool
   * @type {null}
   */
  this.draw = null;
  /**
   * 工具是否被激活
   * @type {boolean}
   */
  this.active = false;
  /**
   * 点击次数
   * @type {number}
   */
  this.clickCount = 0;
  /**
   * 要素存放图层
   * @type {null}
   */
  this.layer = null;

  /**
   * getdragPanInteraction
   * @type {null}
   */
  this.dragPanInteraction = null;
  var that = this;
  var element = document.createElement('div');
  element.className = options.className ? options.className : "measure-tool";
  var measureLength = document.createElement('div');
  measureLength.innerHTML = "测距";
  measureLength.setAttribute('title', "测距");
  measureLength.setAttribute('type', this.measureTypes.measureLength);
  element.appendChild(measureLength);
  var measureArae = document.createElement('div');
  measureArae.innerHTML = "测面";
  measureArae.setAttribute('title', "测面");
  measureArae.setAttribute('type', this.measureTypes.measureArea);
  element.appendChild(measureArae);
  element.onclick = function (ev) {
    var ev = ev || window.event;
    var target = ev.target || ev.srcElement;
    if (target.nodeName.toLowerCase() == 'div') {
      that.setup(target.getAttribute('type'));
    }
  };
  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
};

ol.inherits(ol.control.Measure, ol.control.Control);
/**
 * 设置
 */
ol.control.Measure.prototype.setup = function (type) {
  var that = this;
  this.measureType = type;
  this.clickCount = 0;
  this.active = true;
  if (this.measureType == this.measureTypes.measureLength) {
    this.measureLengthClick = this.getMap().on("singleclick", function (event) {
      that.clickCount += 1;
      if (that.active) {
        if (that.clickCount == 1) {
          that.drawSketch.length = "起点";
        }
        that.addMeasureOverLay(event.coordinate, that.drawSketch.length);
        that.addMeasurecircle(event.coordinate);
      }
    });
    this.beforeMeasurePointerMoveHandler = this.getMap().on('pointermove', this.beforeDrawPointMoveHandler, this);
  } else if (this.measureType == this.measureTypes.measureArea) {
    that.measureAreaClick = that.getMap().on("singleclick", function (event) {

    });
  }
  if (this.active) {
    this.addDrawInteraction();
  }
};
/**
 * removeDrawInteraion
 */
ol.control.Measure.prototype.removeDrawInteraion = function () {
  if (this.draw) {
    this.getMap().removeInteraction(this.draw);
  }
  delete this.draw;
  this.draw = null;
};
/**
 * drawStart
 */
ol.control.Measure.prototype.drawOnStart = function () {
  var that = this;
  this.draw.on('drawstart', function (evt) {
    that.drawSketch = evt.feature;
    that.drawSketch.set("uuid", Math.floor(Math.random() * 100000000 + 1));
    if (that.measureTypes.measureLength == that.measureType) {
      ol.Observable.unByKey(that.beforeMeasurePointerMoveHandler);
      that.listener = that.drawSketch.getGeometry().on('change', function (evt) {
        var geom = evt.target;
        if (geom instanceof ol.geom.LineString) {
          var output = that.formatData(geom);
          that.drawSketch.length = output;
          that.measureHelpTooltip.getElement().firstElementChild.firstElementChild.innerHTML = output;
        }
      }, that);
      that.drawPointermove = that.getMap().on("pointermove", that.drawPointerMoveHandler, that);
    } else if (that.measureTypes.measureArea == that.measureType) {
      var uuid = Math.floor(Math.random() * 100000000 + 1);
      that.createMeasureAreaTooltip();
      that.drawSketch.set("uuid", uuid);
      that.measureAreaTooltip.set("uuid", uuid);
      that.listener = that.drawSketch.getGeometry().on('change', function (evt) {
        var geom = that.drawSketch.getGeometry();
        var area = that.formatData(geom);
        if (that.measureAreaTooltip) {
          that.measureAreaTooltipElement.innerHTML = "面积:" + area;
          that.measureAreaTooltip.setPosition(geom.getInteriorPoint().getCoordinates());
        }
      }, that);
    }
  }, this);
};
/**
 * drawEnd
 */
ol.control.Measure.prototype.drawEnd = function () {
  var that = this;
  this.draw.on("drawend", function (evt) {
    this.active = false;
    that.getDragPanInteraction().setActive(true);
    that.getMap().getTargetElement().style.cursor = "default";
    that.getMap().removeOverlay(that.measureHelpTooltip);
    that.measureHelpTooltip = null;
    if (that.measureTypes.measureLength == that.measureType) {
      that.addMeasureOverLay(evt.feature.getGeometry().getLastCoordinate(), that.drawSketch.length, "止点");
      that.addMeasurecircle(evt.feature.getGeometry().getLastCoordinate());
      ol.Observable.unByKey(that.listener);
      ol.Observable.unByKey(that.drawPointermove);
      ol.Observable.unByKey(that.measureLengthClick);
    } else if (that.measureType == that.measureTypes.measureArea) {
      ol.Observable.unByKey(that.listener);
      that.addMeasureRemoveButton(that.drawSketch.getGeometry().getCoordinates()[0][0]);
    }
    that.listener = null;
    that.drawSketch = null;
    that.removeDrawInteraion();
  }, this);
};
/**
 * 未draw之前提示信息
 * @param event
 */
ol.control.Measure.prototype.beforeDrawPointMoveHandler = function (event) {
  if (!this.measureHelpTooltip) {
    var helpTooltipElement = document.createElement('label');
    helpTooltipElement.className = "BMapLabel";
    helpTooltipElement.style.position = "absolute";
    helpTooltipElement.style.display = "inline";
    helpTooltipElement.style.cursor = "inherit";
    helpTooltipElement.style.border = "none";
    helpTooltipElement.style.padding = "0";
    helpTooltipElement.style.whiteSpace = "nowrap";
    helpTooltipElement.style.fontVariant = "normal";
    helpTooltipElement.style.fontWeight = "normal";
    helpTooltipElement.style.fontStretch = "normal";
    helpTooltipElement.style.fontSize = "12px";
    helpTooltipElement.style.lineHeight = "normal";
    helpTooltipElement.style.fontFamily = "arial,simsun";
    helpTooltipElement.style.color = "rgb(51, 51, 51)";
    helpTooltipElement.style.webkitUserSelect = "none";
    helpTooltipElement.innerHTML = "<span class='BMap_diso'><span class='BMap_disi'>单击确定起点</span></span>";
    this.measureHelpTooltip = new ol.Overlay({
      element: helpTooltipElement,
      offset: [55, 20],
      positioning: 'center-center'
    });
    this.getMap().addOverlay(this.measureHelpTooltip);
  }
  this.measureHelpTooltip.setPosition(event.coordinate);
};
/**
 * 添加移动处理
 * @param event
 */
ol.control.Measure.prototype.drawPointerMoveHandler = function (event) {
  if (this.measureTypes.measureLength == this.measureType) {
    if (event.dragging) {
      return;
    }
    var helpTooltipElement = this.measureHelpTooltip.getElement();
    helpTooltipElement.className = " BMapLabel BMap_disLabel";
    helpTooltipElement.style.position = "absolute";
    helpTooltipElement.style.display = "inline";
    helpTooltipElement.style.cursor = "inherit";
    helpTooltipElement.style.border = "1px solid rgb(255, 1, 3)";
    helpTooltipElement.style.padding = "3px 5px";
    helpTooltipElement.style.whiteSpace = "nowrap";
    helpTooltipElement.style.fontVariant = "normal";
    helpTooltipElement.style.fontWeight = "normal";
    helpTooltipElement.style.fontStretch = "normal";
    helpTooltipElement.style.fontSize = "12px";
    helpTooltipElement.style.lineHeight = "normal";
    helpTooltipElement.style.fontFamily = "arial,simsun";
    helpTooltipElement.style.color = "rgb(51, 51, 51)";
    helpTooltipElement.style.backgroundColor = "rgb(255, 255, 255)";
    helpTooltipElement.style.webkitUserSelect = "none";
    helpTooltipElement.innerHTML = "<span>总长:<span class='BMap_disBoxDis'></span></span><br><span style='color: #7a7a7a;'>单击确定地点,双击结束</span>";
    this.measureHelpTooltip.setPosition(event.coordinate);
  }
};
/**
 * 添加点击时的小圆圈
 */
ol.control.Measure.prototype.addMeasurecircle = function (coor) {
  var feature = new ol.Feature({
    uuid: this.drawSketch.get("uuid"),
    geometry: new ol.geom.Point(coor)
  });
  this.layer.getSource().addFeature(feature);
};

/**
 * addMeasureMsg
 * @param coordinate
 * @param length
 * @param type
 */
ol.control.Measure.prototype.addMeasureOverLay = function (coordinate, length, type) {
  var helpTooltipElement = document.createElement('label');
  helpTooltipElement.style.position = "absolute";
  helpTooltipElement.style.display = "inline";
  helpTooltipElement.style.cursor = "inherit";
  helpTooltipElement.style.border = "none";
  helpTooltipElement.style.padding = "0";
  helpTooltipElement.style.whiteSpace = "nowrap";
  helpTooltipElement.style.fontVariant = "normal";
  helpTooltipElement.style.fontWeight = "normal";
  helpTooltipElement.style.fontStretch = "normal";
  helpTooltipElement.style.fontSize = "12px";
  helpTooltipElement.style.lineHeight = "normal";
  helpTooltipElement.style.fontFamily = "arial,simsun";
  helpTooltipElement.style.color = "rgb(51, 51, 51)";
  helpTooltipElement.style.webkitUserSelect = "none";
  if (type == "止点") {
    helpTooltipElement.style.border = "1px solid rgb(255, 1, 3)";
    helpTooltipElement.style.padding = "3px 5px";
    helpTooltipElement.className = " BMapLabel BMap_disLabel";
    helpTooltipElement.innerHTML = "总长<span class='BMap_disBoxDis'>" + length + "</span>";
    this.addMeasureRemoveButton(coordinate);
  } else {
    helpTooltipElement.className = "BMapLabel";
    helpTooltipElement.innerHTML = "<span class='BMap_diso'><span class='BMap_disi'>" + length + "</span></span>";
  }
  var tempMeasureTooltip = new ol.Overlay({
    element: helpTooltipElement,
    offset: [10, -10],
    positioning: 'center-center'
  });
  this.getMap().addOverlay(tempMeasureTooltip);
  tempMeasureTooltip.setPosition(coordinate);
  tempMeasureTooltip.set("uuid", this.drawSketch.get("uuid"));
};
/**
 * 创建测面提示
 */
ol.control.Measure.prototype.createMeasureAreaTooltip = function () {
  this.measureAreaTooltipElement = document.createElement('div');
  this.measureAreaTooltipElement.style.marginLeft = "-6.25em";
  this.measureAreaTooltipElement.className = 'measureTooltip hidden';
  this.measureAreaTooltip = new ol.Overlay({
    element: this.measureAreaTooltipElement,
    offset: [15, 0],
    positioning: 'center-left'
  });
  this.getMap().addOverlay(this.measureAreaTooltip);
};

/**
 * addRemoveButton
 * @param coordinate
 */
ol.control.Measure.prototype.addMeasureRemoveButton = function (coordinate) {
  var that = this;
  //添加移除按钮
  var pos = [coordinate[0] - 5 * this.getMap().getView().getResolution(), coordinate[1]];
  var btnImg = document.createElement('img');
  btnImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NEYzMzc1RDY3RDU1MTFFNUFDNDJFNjQ4NUUwMzRDRDYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NEYzMzc1RDc3RDU1MTFFNUFDNDJFNjQ4NUUwMzRDRDYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0RjMzNzVENDdENTUxMUU1QUM0MkU2NDg1RTAzNENENiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo0RjMzNzVENTdENTUxMUU1QUM0MkU2NDg1RTAzNENENiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PsDx84AAAAC3SURBVHjavJIxDoMwDEV/ok5wDCbu0DvAdUBIwMLFSs/AxDXY6tZ2SCGVUikd+ifn20+2k5hHVd0AXJGmGQw+UyWMxY8KQGpbUNcB23aYHIsnuSgIy8dlAQ2DgwWSmD0YE5ReAq5pQOMIrKsDRByjKGC/dsxz2L7XQgU8JB7n4qDoY6SYF4J+p72T7/zeOXqr03SMx8XnsTUX7UgElKVCyDK3s8Tsae6sv/8ceceZ6jr1k99fAgwAsZy0Sa2HgDcAAAAASUVORK5CYII=";
  btnImg.style.cursor = "pointer";
  btnImg.title = "清除测量结果";
  btnImg.groupId = this.drawSketch.get("uuid");
  btnImg.pos = coordinate;
  btnImg.onclick = function (evt) {
    that.RemoveMeasure(this.groupId, this.pos);
  };
  var closeBtn = new ol.Overlay({
    element: btnImg,
    offset: [-2, -6],
    positioning: 'center-center'
  });
  this.getMap().addOverlay(closeBtn);
  closeBtn.setPosition(pos);
  closeBtn.set("uuid", this.drawSketch.get("uuid"));
};
/**
 * 移除当前测量
 * @param groupId
 * @param pos
 * @constructor
 */
ol.control.Measure.prototype.RemoveMeasure = function (groupId, pos) {
  var that = this;
  var overlays = this.getMap().getOverlays().getArray();
  $(overlays).each(function (i, overlay) {
    if (overlay.get("uuid") == groupId) {
      that.getMap().removeOverlay(overlay);
    }
  });
  if (this.layer) {
    var source = this.layer.getSource();
    var features = source.getFeatures();
    features.forEach(function (feat) {
      var lastCoord = feat.getGeometry().getLastCoordinate();
      if ((lastCoord[0] == pos[0] && lastCoord[1] == pos[1]) || feat.get('uuid') == groupId) {
        source.removeFeature(feat);
      }
    }, this);
  }
};

/**
 * addDrawInteraction
 */
ol.control.Measure.prototype.addDrawInteraction = function () {
  var that = this;
  this.removeDrawInteraion();
  var type = "";
  if (this.measureType == this.measureTypes.measureLength) {
    type = "LineString";
  } else if (this.measureType == this.measureTypes.measureArea) {
    type = "Polygon";
  }
  this.layer = this.getVectorLayer();
  this.draw = new ol.interaction.Draw({
    source: that.layer.getSource(),
    type: type,
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: 'rgba(254, 164, 164, 1)'
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(252, 129, 129, 1)',
        width: 3
      }),
      image: new ol.style.Circle({
        radius: 1,
        fill: new ol.style.Fill({
          color: '#ffcc33'
        })
      })
    })
  });
  if (this.draw) {
    this.getMap().addInteraction(this.draw);
    this.getDragPanInteraction().setActive(false);
    this.drawOnStart();
    this.drawEnd();
  }
};

/**
 * format measure data
 * @param geom
 * @returns {*}
 */
ol.control.Measure.prototype.formatData = function (geom) {
  var output;
  if (this.measureType == this.measureTypes.measureLength) {
    var coordinates = geom.getCoordinates(), length = 0;
    var sourceProj = this.getMap().getView().getProjection();
    for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
      var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:4326');
      var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
      length += this.wgs84Sphere.haversineDistance(c1, c2);
    }
    if (length > 100) {
      output = (Math.round(length / 1000 * 100) / 100) + ' ' + '公里';
    } else {
      output = (Math.round(length * 100) / 100) + ' ' + '米';
    }
  } else if (this.measureType == this.measureTypes.measureArea) {
    var sourceProj = this.getMap().getView().getProjection();
    var geom = /** @type {ol.geom.Polygon} */(geom.clone().transform(
      sourceProj, 'EPSG:4326'));
    var coordinates = geom.getLinearRing(0).getCoordinates();
    var area = Math.abs(this.wgs84Sphere.geodesicArea(coordinates));
    if (area > 10000000000) {
      output = (Math.round(area / (1000 * 1000 * 10000) * 100) / 100) + ' ' + '万平方公里';
    } else if (1000000 < area < 10000000000) {
      output = (Math.round(area / (1000 * 1000) * 100) / 100) + ' ' + '平方公里';
    } else {
      output = (Math.round(area * 100) / 100) + ' ' + '平方米';
    }
  }
  return output;
};
/**
 * 创建图层存放feature
 * @returns {*}
 */
ol.control.Measure.prototype.getVectorLayer = function () {
  var vector = null;
  if (this.getMap()) {
    var layers = this.getMap().getLayers();
    layers.forEach(function (layer) {
      var layernameTemp = layer.get("layerName");
      if (layernameTemp === "MeasureTool") {
        vector = layer;
      }
    }, this);
  }
  if (!vector) {
    vector = new ol.layer.Vector({
      layerName: "MeasureTool",
      source: new ol.source.Vector({
        wrapX: false,
      }),
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(67, 110, 238, 0.4)'
        }),
        stroke: new ol.style.Stroke({
          color: 'rgba(242,123,57,1)',
          width: 2
        }),
        image: new ol.style.Circle({
          radius: 4,
          stroke: new ol.style.Stroke({
            color: 'rgba(255,0,0,1)',
            width: 1
          }),
          fill: new ol.style.Fill({
            color: 'rgba(255,255,255,1)'
          })
        })
      })
    });
    this.getMap().addLayer(vector);
  }
  return vector;
};

/**
 * get dragPanInteraction tool
 * @returns {ol.interaction.DragPan|*}
 */
ol.control.Measure.prototype.getDragPanInteraction = function () {
  if (!this.dragPanInteraction) {
    var items = this.getMap().getInteractions().getArray();
    for (var i = 0; i < items.length; i++) {
      var interaction = items[i];
      if (interaction instanceof ol.interaction.DragPan) {
        this.dragPanInteraction = interaction;
        break;
      }
    }
  }
  return this.dragPanInteraction;
};

/**
 * Determine if the current browser supports touch events. Adapted from
 * https://gist.github.com/chrismbarr/4107472
 * @private
 */
ol.control.Measure.isTouchDevice_ = function () {
  try {
    document.createEvent("TouchEvent");
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * @private
 * @param{Element} elm
 */
ol.control.Measure.enableTouchScroll_ = function (elm) {
  if (ol.Overlay.Popup.isTouchDevice_()) {
    var scrollStartPos = 0;
    elm.addEventListener("touchstart", function (event) {
      scrollStartPos = this.scrollTop + event.touches[0].pageY;
    }, false);
    elm.addEventListener("touchmove", function (event) {
      this.scrollTop = scrollStartPos - event.touches[0].pageY;
    }, false);
  }
};
/**
 * Created by FDD on 2016/11/9.
 * 提出气泡功能
 * OpenLayers 3 Popup Overlay.
 * @constructor
 * @extends {ol.Overlay}
 */

/**
 * @param opt_options
 * @constructor
 */
ol.Overlay.Popup = function (opt_options) {
  this.options = opt_options || {};
  this.smallOverLay = null;
  this.myversion = 0;
  if (!this.options.offset) {
    this.options.offset = [0, 0];
  }
  if (!this.options.imgData) {
    this.imgData = "data:image;base64,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0p8zAAA7BWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS41LWMwMTQgNzkuMTUxNDgxLCAyMDEzLzAzLzEzLTEyOjA5OjE1ICAgICAgICAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgICAgICAgICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgICAgICAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgICAgICAgICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBQaG90b3Nob3AgQ0MgKE1hY2ludG9zaCk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIwMTYtMDQtMDdUMTE6MDM6MzkrMDg6MDA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAxNi0wNC0wN1QyMDozMDoxNSswODowMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMTYtMDQtMDdUMjA6MzA6MTUrMDg6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvcG5nPC9kYzpmb3JtYXQ+CiAgICAgICAgIDxwaG90b3Nob3A6Q29sb3JNb2RlPjM8L3Bob3Rvc2hvcDpDb2xvck1vZGU+CiAgICAgICAgIDxwaG90b3Nob3A6SUNDUHJvZmlsZT5zUkdCIElFQzYxOTY2LTIuMTwvcGhvdG9zaG9wOklDQ1Byb2ZpbGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6MDk1Y2NlYjctNjUzMC00YjlhLTkzMWMtZjFlNGVkMDFkMjNkPC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54bXAuZGlkOjU5MmJmNDUyLTlhOWEtNDBiYS04YWUzLWQxZTVlZDg4MDVmZjwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjU5MmJmNDUyLTlhOWEtNDBiYS04YWUzLWQxZTVlZDg4MDVmZjwveG1wTU06T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNyZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDo1OTJiZjQ1Mi05YTlhLTQwYmEtOGFlMy1kMWU1ZWQ4ODA1ZmY8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTYtMDQtMDdUMTE6MDM6MzkrMDg6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNvbnZlcnRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6cGFyYW1ldGVycz5mcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nPC9zdEV2dDpwYXJhbWV0ZXJzPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+c2F2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDowOTVjY2ViNy02NTMwLTRiOWEtOTMxYy1mMWU0ZWQwMWQyM2Q8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTYtMDQtMDdUMjA6MzA6MTUrMDg6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmNoYW5nZWQ+Lzwvc3RFdnQ6Y2hhbmdlZD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAgPC94bXBNTTpIaXN0b3J5PgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpYUmVzb2x1dGlvbj43MjAwMDAvMTAwMDA8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjcyMDAwMC8xMDAwMDwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4xMzwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4yODwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+u0hEhgAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAB/klEQVR42pSSP08UYRDGf89lAWNi4h/kOkxItCFqYSkQSipqPwAWgIXkEv0Wl1gctn4Tw3ImlBAqaA4t9DaSnMZEip13x+Levds7ciCTzCab93memXlm9Ht1FSRwB7SE2MZ9GfQQ8RN8H6eFaOMCOeqtrAAkDh+ALWLIwUU1doG3QJ5YMHB9BDY0M83M2hrh21fs8Ah3B0H8bOFMI3+dmIWXgg2A6acvmFlfxy8u6G1u4hHuw2obgk+JmW2XD8XxMVNHR+QnJ+RmA2SVKHijs+fPukAdNFCmBHn0aGQ0vid5bvVSQiVawqNEVSqSZxMLlgH1qpxiP16a4EOai/PEcvsMvOqrll6PzFDyUH9PqQ7nHy0h9hmZiMu/7kgCWK5ZYW2z0ApWEMwIIYymGRYCRREIZq0QrJ0UVoDYoW/f1rCnSyV3gR1wdFCfG6Lcl5C2gRVgFuccPEVqAe2BUQdz9cqh9W368u79jyzrdjuds/lGmj6o+o0cuY+urtlsAniWZZx1OnSzTHt7eyOYGhPCuXTl15N0BWsiaXhTNyH5mPP/RZpY50ojJpe6ZqabGoEm9leTRDWHFB9MNY6pVZq5Dyw0Go3F/hkKIdI0XQQW4rsAkkh6DNwZHynu9lbMe8AscFr282ScNCH+VEmKSneB28BUNKkAcuAv8AvoAf5vALfw5dErL2VFAAAAAElFTkSuQmCC";
  } else {
    this.imgData = this.options.imgData;
  }
  this.container = document.createElement('div');
  if (!this.options.className) {
    this.container.className = 'ol-popup';
  } else {
    this.container.className = this.options.className;
  }
  if (0 === this.options.opacity || this.options.opacity) {
    this.container.style.opacity = this.options.opacity;
  }
  if (this.options.id) {
    this.container.id = this.options.id;
  } else {
    this.container.id = "overlay" + Math.floor(Math.random() * 1000)+ Math.floor(Math.random() * 1000);
  }
  if (this.options.title) {
    var p = document.createElement('p');
    p.className = "iw_poi_title";
    p.title = this.options.title;
    p.innerText = this.options.title;
    this.title = document.createElement('div');
    this.title.className = 'ol-popup-title';
    this.title.appendChild(p);

    this.closer = document.createElement('div');
    this.closer.className = 'ol-popup-closer';
    this.closer.title = "关闭";
    this.container.appendChild(this.title);
    this.container.appendChild(this.closer);
  }
  this.center = document.createElement("div");
  this.center.className = 'ol-popup-center';

  this.content = document.createElement('div');
  this.content.className = 'ol-popup-content';

  this.center.appendChild(this.content);
  this.container.appendChild(this.center);

  this.bottom = document.createElement("div");
  this.bottom.className = this.options.bottomClass ? this.options.bottomClass : 'ol-popup-bottom';
  this.bottomDiv = document.createElement("div");
  if(this.options.isShowPic){
    this.bottomDiv.className = "ol-popup-bottom-fouce";
  }

  this.bottom.appendChild(this.bottomDiv);
  this.container.appendChild(this.bottom);
  if (this.options.showMarkFea) {
    var that = this;
    this.bottomMarkFea = new ol.Feature({
      geometry: new ol.geom.Point(this.options.coordinate)
    });
    this.style = new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        opacity: 1,
        src: that.imgData
      })
    });
    this.bottomMarkFea.setStyle(this.style);
  } else if (this.options.showMark) {
    this.bottomImgMark = document.createElement("img");
    this.bottomImgMark.setAttribute("src", this.imgData);
    this.bottomImgMark.style.zIndex = 1;
    this.bottomImgMark.style.position = "absolute";
    this.bottom.appendChild(this.bottomImgMark);
  }


  var that = this;
  if (this.closer) {
    this.closer.addEventListener('click', function (evt) {
      that.showMin();
    }, false);
  }

  if (this.options.maxHeight) {
    this.container.style.maxHeight = this.options.maxHeight;
  }


  if (this.options.titleWith) {
    if (this.title) {
      this.title.style.width = this.options.titleWith;
    }
  }
  if (this.options.titlebackgroundColor) {
    if (this.title) {
      this.title.style.backgroundColor = this.options.titlebackgroundColor;
    }
  }
  if (this.options.width) {
    this.container.style.width = this.options.width;
  }
  if (this.options.height) {
    this.container.style.height = this.options.height;
    this.container.style.bottomDiv = this.options.height;
  }


  // Apply workaround to enable scrolling of content div on touch devices
  ol.Overlay.Popup.enableTouchScroll_(this.content);
  this.options.element = this.container;
  ol.Overlay.call(this, {
    element: this.container,
    stopEvent: true,
    offset: this.options.offset,
    id: this.options.id,
    insertFirst: (this.options.hasOwnProperty('insertFirst')) ? this.options.insertFirst : true
  });
};

ol.inherits(ol.Overlay.Popup, ol.Overlay);

/**
 *
 * @param coord
 * @param content
 * @returns {ol.Overlay.Popup}
 */
ol.Overlay.Popup.prototype.show = function (coord, content) {
  var that = this;
  this.options.position = coord;
  this.setPosition(coord);
  this.set("layerName", (this.options.hasOwnProperty('layerType')) ? this.options.layerType : "");
  if (content instanceof Element) {
    this.content.appendChild(content);
  } else {
    this.content.innerHTML = content;
  }
  // var containerSize = goog.style.getSize(this.container);
  // var containerSize = this.container;
  if (this.options.showMarkFea && this.bottomMarkFea) {
    this.bottomMarkFea.on("featureMove", function (e) {
      if (that.bottomMarkFea) {
        that.options.position = that.bottomMarkFea.getGeometry().getCoordinates();
        that.setPosition(that.options.position);
        if (that.smallOverLay) {
          that.smallOverLay.setPosition(that.options.position);
        }
      }
    });
    this.getMap().getLayers().forEach(function (layer) {
      if ("tempVectorLayer" === layer.get("layerName")) {
        layer.getSource().addFeature(that.bottomMarkFea);
      }
    }, this);
  }
  this.container.style.marginTop = (-this.container.clientHeight - 58) + "px";
  this.container.style.marginLeft = (-this.container.clientWidth / 2) + (58 / 2) + "px";
  this.bottomDiv.style.left = ((this.container.clientWidth / 2 ) - 20 - 14) + "px";
  if (this.bottomImgMark) {
    this.bottomImgMark.style.top = (this.container.clientHeight + this.bottomImgMark.height / 2 + 1) + "px";
    this.bottomImgMark.style.left = ((this.container.clientWidth / 2 ) + 5) + "px";
  } else if (this.bottomMarkFea) {
    this.container.style.marginTop = (-this.container.clientHeight - 60 + 3) + "px";
  } else {
    this.container.style.marginTop = (-this.container.clientHeight - 29 + 3) + "px";
  }
  if (this.myversion === 0) {
    this.container.style.display = 'block';
    this.content.scrollTop = 0;
  } else {
    this.container.style.display = 'block';
    this.container.style.opacity = 1;
    this.content.scrollTop = 0;
  }
  this.myversion += 1;
  return this;
};
/**
 * 最小化显示.
 * @api
 */
ol.Overlay.Popup.prototype.showMin = function () {
  this.container.style.display = 'none';
  if (this.options.showMarkFea || this.options.showMark) {
    if (!this.smallOverLay) {
      var domTemp = "<span class='BMap_Marker' unselectable='on' style='position: absolute; padding: 0; margin: 0; border: 0; width: 0; height: 0; z-index: 1000;'>" +
        "<div style='position: absolute; margin: 0; padding: 0; width: 10px; height: 22px;'>" +
        "</div>" +
        "<label id=" + this.options.id + " class=' BMapLabel confirmOverlay'  unselectable='on' title='我的标记' style='position: absolute; cursor: pointer; border: 1px solid rgb(128, 128, 128); padding: 1px 2px; white-space: nowrap; font-style: normal; font-variant: normal; font-weight: normal; font-stretch: normal; font-size: 12px; line-height: normal; font-family: arial, simsun; z-index: 80; color: rgb(51, 51, 51); -webkit-user-select: none; max-width: 106px;overflow:hidden;left: 10px; top: -35px; background-color: rgb(255, 255, 255);'>我的标记</label>" +
        "</span>";

      var dom = document.createElement("div");
      dom.style.position = "absolute";
      dom.style.zIndex = "400";
      dom.innerHTML = domTemp;
      var map = this.getMap();
      map.getTargetElement().appendChild(dom);
      var overLay = new ol.Overlay({
        element: dom
      });

      overLay.setPosition(this.options.position);
      map.addOverlay(overLay);
      this.smallOverLay = overLay;
    } else {
      this.smallOverLay.getElement().style.display = "block";
      this.smallOverLay.setPosition(this.options.position);
    }
    var that = this;
    if (this.myversion == 0) {
      this.container.style.display = 'block';
      this.smallOverLay.getElement().style.display = "none";
    }
    this.smallOverLay.getElement().getElementsByTagName("label")[0].addEventListener("click", function (event) {
      that.container.style.display = 'block';
      that.smallOverLay.getElement().style.display = "none";
    });
    this.myversion = this.myversion + 1;
  }
};


/**
 * 设置最小化后显示的文本.
 * @param  {String}minText 最小化时候需要显示的文本
 * @api
 */
ol.Overlay.Popup.prototype.setMinText = function (minText) {
  var label = this.smallOverLay.getElement().getElementsByTagName("label")[0];
  label.setAttribute("title", minText + "");
  label.innerText = minText;
};

/**
 * Hide the Overlay.Popup.
 * @api
 */
ol.Overlay.Popup.prototype.hide = function () {
  this.container.style.display = 'none';
  this.container.style.opacity = 0;
  return this;
};
/**
 * 设置 Overlay.Popup 的高度
 * @param {string} height
 * @api
 */
ol.Overlay.Popup.prototype.setHeight = function (height) {
  //goog.style.setStyle(this.container, "height", height);
  this.container.style.height = height;
};


/**
 * 返回 Overlay.Popup的高度
 *  *@return {number}
 */
ol.Overlay.Popup.prototype.getHeight = function () {
  return this.container.height;
};


/**
 * 设置 Overlay.Popup的宽度
 * @param {string} width popup的宽度
 * @api
 */
ol.Overlay.Popup.prototype.setWidth = function (width) {
  // goog.style.setStyle(this.container, "width", width);
  this.container.style.width = width;
};


/**
 * 返回overlay的宽度。
 *@return {number}
 *@api
 */
ol.Overlay.Popup.prototype.getWidth = function () {
  return this.container.width;
};

/**
 *
 * @returns {ol.Feature}
 */
ol.Overlay.Popup.prototype.getBottomMarkFea = function () {
  if (this.bottomMarkFea && this.bottomMarkFea instanceof ol.Feature) {
    return this.bottomMarkFea;
  }
};


/**
 * 根据内容重新设置宽度高度
 *@api
 */
ol.Overlay.Popup.prototype.updateSize = function () {
  //获取新的高度和宽度
  // var containerSize = this.container;
  this.container.style.marginTop = (-this.container.clientHeight - 58) + "px";
  this.container.style.marginLeft = (-this.container.clientWidth / 2) + (58 / 2) + "px";
  this.bottomDiv.style.left = ((this.container.clientWidth / 2 ) - 20 - 14) + "px";
  if (this.bottomImgMark) {
    this.bottomImgMark.style.left = ((this.container.clientWidth / 2 ) - 28 - 8) + "px";
  } else {
    this.container.style.marginTop = (-this.container.clientHeight - 29 + 3) + "px";
  }
  this.container.style.display = 'block';
  this.container.style.opacity = 1;
  this.content.scrollTop = 0;
  return this;
};


/**
 * Determine if the current browser supports touch events. Adapted from
 * https://gist.github.com/chrismbarr/4107472
 * @private
 */
ol.Overlay.Popup.isTouchDevice_ = function () {
  try {
    document.createEvent("TouchEvent");
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * @private
 * @param{Element} elm
 */
ol.Overlay.Popup.enableTouchScroll_ = function (elm) {
  if (ol.Overlay.Popup.isTouchDevice_()) {
    var scrollStartPos = 0;
    elm.addEventListener("touchstart", function (event) {
      scrollStartPos = this.scrollTop + event.touches[0].pageY;
    }, false);
    elm.addEventListener("touchmove", function (event) {
      this.scrollTop = scrollStartPos - event.touches[0].pageY;
    }, false);
  }
};