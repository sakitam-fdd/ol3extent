/**
 * @Description: echarts ol3扩展，必须在echarts初始化前使用
 * @author FDD<https://github.com/smileFDD>
 * @date 2017/2/13
 * @version V1.0.0
 */

ol.Observable.ol3Echarts = function (params) {
  this.option = params || {};
  this._map = this.option.map;
  this.echartsOp = this.option.echartsOp;
  this._init();
};
/**
 * 初始化
 * @private
 */
ol.Observable.ol3Echarts.prototype._init = function () {
  this._mapOffset = [0, 0];
  this._geoCoord = [];
  var size = this._map.getSize();
  var div = this._echartsContainer = document.createElement('div');
  div.style.position = 'absolute';
  div.style.height = size[1] + 'px';
  div.style.width = size[0] + 'px';
  div.style.top = 0;
  div.style.left = 0;
  this._map.getViewport().appendChild(div);
};
/**
 * 初始化echarts
 * @param echartsVM
 * @returns {*}
 */
ol.Observable.ol3Echarts.prototype.initECharts = function () {
  this.echartsVM = this.echartsOp.init.apply(this, arguments);
  this._bindEvent();
  this._addMarkWrap();
  return this.echartsVM;
};
/**
 * 绑定echarts事件
 * @private
 */
ol.Observable.ol3Echarts.prototype._bindEvent = function () {
  //self._map.getView().on('change:resolution', _zoomChangeHandler('zoom'));
  this._map.getView().on('change:center', this._moveHandler('moving'));
  this._map.on('moveend', this._moveHandler('moveend'));
  /*(this.echartsVM.getZr || this.echartsVM.getZrender)*/
  this.echartsVM.getZr().on('dragstart', this._dragZrenderHandler(true));
  /*(this.echartsVM.getZr || this.echartsVM.getZrender)*/
  this.echartsVM.getZr().on('dragend', this._dragZrenderHandler(false));
};
/**
 * 添加标注
 * @private
 */
ol.Observable.ol3Echarts.prototype._addMarkWrap = function () {
  function _addMark (seriesIdx, markData, markType) {
    var data;
    if (markType == 'markPoint') {
      var data = markData.data;
      if (data && data.length) {
        for (var k = 0, len = data.length; k < len; k++) {
          this._addPos(data[k]);
        }
      }
    }
    else {
      data = markData.data;
      if (data && data.length) {
        for (var k = 0, len = data.length; k < len; k++) {
          this._addPos(data[k][0]);
          this._addPos(data[k][1]);
        }
      }
    }
    this.echartsVM._addMarkOri(seriesIdx, markData, markType);
  }

  this.echartsVM._addMarkOri = this.echartsVM._addMark;
  this.echartsVM._addMark = _addMark;
};
/**
 * 对echarts的setOption加一次处理
 * 用来为markPoint、markLine中添加x、y坐标，需要name与geoCoord对应
 * @param option
 * @param notMerge
 */
ol.Observable.ol3Echarts.prototype.setOption = function (option, notMerge) {
  this.echartsVM.setOption(option, notMerge);
  var series = option.series || {};
  // 记录所有的geoCoord
  for (var i = 0, item; item = series[i++];) {
    var geoCoord = item.geoCoord;
    if (geoCoord) {
      for (var k in geoCoord) {
        this._geoCoord[k] = geoCoord[k];
      }
    }
  }

  // 添加x、y
  for (var i = 0, item; item = series[i++];) {
    var markPoint = item.markPoint || {};
    var markLine = item.markLine || {};

    var data = markPoint.data;
    if (data && data.length) {
      for (var k = 0, len = data.length; k < len; k++) {
        this._addPos(data[k]);
      }
    }

    data = markLine.data;
    if (data && data.length) {
      for (var k = 0, len = data.length; k < len; k++) {
        this._addPos(data[k][0]);
        this._addPos(data[k][1]);
      }
    }
  }
  debugger
  // this.echartsVM.setOption(option, notMerge);
};
/**
 * 添加坐标处理
 * @param obj
 * @private
 */
ol.Observable.ol3Echarts.prototype._addPos = function (obj) {
  var coord = this._geoCoord[obj.name]
  var pos = this.coordToPixel(coord);
  obj.x = pos[0];//- self._mapOffset[0];
  obj.y = pos[1];//- self._mapOffset[1];
};
/**
 * Zrender拖拽触发事件
 * @param isStart
 * @returns {Function}
 * @private
 */
ol.Observable.ol3Echarts.prototype._dragZrenderHandler = function (isStart) {
  var that = this;
  return function () {
    that._map.dragging = isStart;
  }
};
/**
 * 移动事件处理
 * @returns {Function}
 * @private
 */
ol.Observable.ol3Echarts.prototype._moveHandler = function (type) {
  var that = this;
  return function (e) {
    // 记录偏移量
    var offsetEle = that._echartsContainer.parentNode.parentNode.parentNode;
    that._mapOffset = [
      -parseInt(offsetEle.style.left) || 0,
      -parseInt(offsetEle.style.top) || 0
    ];
    that._echartsContainer.style.left = that._mapOffset[0] + 'px';
    that._echartsContainer.style.top = that._mapOffset[1] + 'px';
    that._fireEvent(type);
  }
};
/**
 *
 * @param type
 * @private
 */
ol.Observable.ol3Echarts.prototype._fireEvent = function (type) {
  var func = this['on' + type];
  if (func) {
    func();
  } else {
    this.refresh();
  }
};

/**
 * canvas渲染刷新
 */
ol.Observable.ol3Echarts.prototype.refresh = function () {
  if (this.echartsVM) {
    var option = this.echartsVM.getOption() || {};
    var legend = option.legend;
    var dataRange = option.dataRange;
    // if (legend) {
    //   option.legend.selected = legend.getSelectedMap();
    // }
    // if (dataRange) {
    //   option.dataRange.range = dataRange._range;
    // }
    this.echartsVM.clear();
    this.echartsVM.setOption(option);
  }
};
/**
 * 获取echarts容器
 * @returns {Element|*}
 */
ol.Observable.ol3Echarts.prototype.getEchartsContainer = function () {
  return this._echartsContainer;
};
/**
 * 获取地图对象
 * @returns {{}}
 */
ol.Observable.ol3Echarts.prototype.getMap = function () {
  return this._map ? this._map : {}
};
/**
 * 经纬度转换为屏幕像素
 * @param coords
 * @returns {ol.Pixel|*}
 */
ol.Observable.ol3Echarts.prototype.coordToPixel = function (coords) {
  return this._map.getPixelFromCoordinate(ol.proj.fromLonLat(coords));
};
/**
 * 屏幕像素转换为经纬度
 * @param pixel
 * @returns {ol.Coordinate|*}
 */
ol.Observable.ol3Echarts.prototype.pixelToCoord = function (pixel) {
  return this._map.getCoordinateFromPixel(pixel);
};

/**
 * 获取创建的echarts实例
 * @param pixel
 * @returns {*}
 */
ol.Observable.ol3Echarts.prototype.getECharts = function (pixel) {
  return this.echartsVM;
};
/**
 * 获取地图偏移量
 * @param pixel
 * @returns {*}
 */
ol.Observable.ol3Echarts.prototype.getMapOffset = function (pixel) {
  return this._mapOffset;
};

