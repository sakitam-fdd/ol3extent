/**
 * OpenLayers 3 ImageArcGISRestMethod.
 * author:https://github.com/smileFDD
 * @constructor
 * @extends {ol.source.ImageArcGISRest}
 */
/**
 * @classdesc
 * Layer source for tile data from ArcGIS Rest services. Map and Image
 * Services are supported.
 *
 * For cached ArcGIS services, better performance is available using the
 * {@link ol.source.XYZ} data source.
 *
 * @constructor
 * @extends {ol.source.TileImage}
 * @param {olx.source.TileArcGISRestOptions=} opt_options Tile ArcGIS Rest
 *     options.
 * @api
 */
ol.source.ImageArcGISRestMethod = function(opt_options) {

  var options = opt_options || {};

  ol.source.TileImage.call(this, {
    attributions: options.attributions,
    cacheSize: options.cacheSize,
    crossOrigin: options.crossOrigin,
    logo: options.logo,
    projection: options.projection,
    reprojectionErrorThreshold: options.reprojectionErrorThreshold,
    tileGrid: options.tileGrid,
    tileLoadFunction: options.tileLoadFunction,
    url: options.url,
    urls: options.urls,
    wrapX: options.wrapX !== undefined ? options.wrapX : true
  });

  /**
   * @private
   * @type {!Object}
   */
  this.params_ = options.params || {};

  /**
   * 请求方式
   * @type {string}
   */
  this.method = options.method || 'GET';

  /**
   * @private
   * @type {ol.Extent}
   */
  this.tmpExtent_ = ol.extent.createEmpty();

  this.setKey(this.getKeyForParams_());
};

ol.inherits(ol.source.ImageArcGISRestMethod, ol.source.TileImage);


/**
 * @private
 * @return {string} The key for the current params.
 */
ol.source.ImageArcGISRestMethod.prototype.getKeyForParams_ = function() {
  var i = 0;
  var res = [];
  for (var key in this.params_) {
    res[i++] = key + '-' + this.params_[key];
  }
  return res.join('/');
};


/**
 * Get the user-provided params, i.e. those passed to the constructor through
 * the "params" option, and possibly updated using the updateParams method.
 * @return {Object} Params.
 * @api
 */
ol.source.ImageArcGISRestMethod.prototype.getParams = function() {
  return this.params_;
};


/**
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.Size} tileSize Tile size.
 * @param {ol.Extent} tileExtent Tile extent.
 * @param {number} pixelRatio Pixel ratio.
 * @param {ol.proj.Projection} projection Projection.
 * @param {Object} params Params.
 * @return {string|undefined} Request URL.
 * @private
 */
ol.source.ImageArcGISRestMethod.prototype.getRequestUrl_ = function(tileCoord, tileSize, tileExtent,
                                                             pixelRatio, projection, params) {

  var urls = this.urls;
  if (!urls) {
    return undefined;
  }

  // ArcGIS Server only wants the numeric portion of the projection ID.
  var srid = projection.getCode().split(':').pop();

  params['SIZE'] = tileSize[0] + ',' + tileSize[1];
  params['BBOX'] = tileExtent.join(',');
  params['BBOXSR'] = srid;
  params['IMAGESR'] = srid;
  params['DPI'] = Math.round(
    params['DPI'] ? params['DPI'] * pixelRatio : 90 * pixelRatio
  );

  var url;
  if (urls.length == 1) {
    url = urls[0];
  } else {
    var index = ol.math.modulo(ol.tilecoord.hash(tileCoord), urls.length);
    url = urls[index];
  }

  var modifiedUrl = url
    .replace(/MapServer\/?$/, 'MapServer/export')
    .replace(/ImageServer\/?$/, 'ImageServer/exportImage');
  if (this.method === 'GET') {
    return ol.uri.appendParams(modifiedUrl, params);
  } else {
    var _params = {};
    for (var key in params) {
      if (key) {
        if (key.toLocaleLowerCase() === 'f') {
          _params[key.toLowerCase()] = 'pjson'
        } else {
          _params[key.toLowerCase()] = params[key]
        }
      }
    }
    this.getData(modifiedUrl, _params)
    return _params;
  }
};
/**
 * 执行ajax请求获取json数据
 */
ol.source.ImageArcGISRestMethod.prototype.getData = function (modifiedUrl, params) {
  var xmlhttp, that = this;
  var postData = (function(obj){ // 转成post需要的字符串.
    var str = "";
    for(var prop in obj){
      str += prop + "=" + obj[prop] + "&"
    }
    return str;
  })(params);
  if (window.XMLHttpRequest) {
    //  IE7+, Firefox, Chrome, Opera, Safari 浏览器执行代码
    xmlhttp=new XMLHttpRequest();
  } else {
    // IE6, IE5 浏览器执行代码
    xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
  }
  xmlhttp.onreadystatechange=function() {
    if (xmlhttp.readyState==4 && xmlhttp.status==200) {
      console.log(xmlhttp.responseText)
    }
  }
  xmlhttp.open(that.method, modifiedUrl, true);
  xmlhttp.send(postData);
}


/**
 * @inheritDoc
 */
ol.source.ImageArcGISRestMethod.prototype.getTilePixelRatio = function(pixelRatio) {
  return /** @type {number} */ (pixelRatio);
};


/**
 * @inheritDoc
 */
ol.source.ImageArcGISRestMethod.prototype.fixedTileUrlFunction = function(tileCoord, pixelRatio, projection) {

  var tileGrid = this.getTileGrid();
  if (!tileGrid) {
    tileGrid = this.getTileGridForProjection(projection);
  }

  if (tileGrid.getResolutions().length <= tileCoord[0]) {
    return undefined;
  }

  var tileExtent = tileGrid.getTileCoordExtent(
    tileCoord, this.tmpExtent_);
  var tileSize = ol.size.toSize(
    tileGrid.getTileSize(tileCoord[0]), this.tmpSize);

  if (pixelRatio != 1) {
    tileSize = ol.size.scale(tileSize, pixelRatio, this.tmpSize);
  }

  // Apply default params and override with user specified values.
  var baseParams = {
    'F': 'image',
    'FORMAT': 'PNG32',
    'TRANSPARENT': true
  };
  ol.obj.assign(baseParams, this.params_);

  return this.getRequestUrl_(tileCoord, tileSize, tileExtent,
    pixelRatio, projection, baseParams);
};


/**
 * Update the user-provided params.
 * @param {Object} params Params.
 * @api stable
 */
ol.source.ImageArcGISRestMethod.prototype.updateParams = function(params) {
  ol.obj.assign(this.params_, params);
  this.setKey(this.getKeyForParams_());
};
