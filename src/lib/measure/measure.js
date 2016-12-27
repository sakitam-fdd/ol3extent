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