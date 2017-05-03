ol.Observable.SnapToFeature = function (params) {
  this.options = params || {}
  if (!this.options['map'] || this.options['map'] instanceof ol.Map) {
    throw new Error('请传入正确的地图对象！')
  }

  ol.interaction.Pointer.call(this, {
    handleEvent: ol.Observable.SnapToFeature.prototype.handleEvent_,
    handleDownEvent: ol.Observable.SnapToFeature.prototype.handleDownEvent,
    handleDragEvent: ol.Observable.SnapToFeature.prototype.handleDragEvent,
    handleUpEvent: ol.Observable.SnapToFeature.prototype.handleUpEvent
  });

  /**
   * 当前地图对象
   * @type {ol.Map}
   */
  this.map = this.options['map'];

  /**
   * 吸附精度，默认10
   * @type {number}
   * @private
   */
  this.pixelTolerance_ = this.options['pixelTolerance'] !== undefined ? this.options.pixelTolerance : 10;

  /**
   * @type {Object.<number, ol.EventsKey>}
   * @private
   */
  this.featureChangeListenerKeys_ = {};

  /**
   * 处理要素绑定的事件
   * @type {Object.<number, ol.Extent>}
   * @private
   */
  this.indexedFeaturesExtents_ = {};

  this.rBush_ = new ol.structs.RBush();

  /**
   * @private
   * @type {number}
   */
  this.decay_ = decay;

  /**
   * @private
   * @type {number}
   */
  this.minVelocity_ = minVelocity;

  /**
   * @private
   * @type {number}
   */
  this.delay_ = delay;

  /**
   * @private
   * @type {Array.<number>}
   */
  this.points_ = [];

  /**
   * @private
   * @type {number}
   */
  this.angle_ = 0;

  /**
   * @private
   * @type {number}
   */
  this.initialVelocity_ = 0;
}

ol.inherits(ol.Observable.SnapToFeature, ol.interaction.Pointer);

/**
 * 获取要素
 * @returns {*}
 * @private
 */
ol.Observable.SnapToFeature.prototype.getFeatures_ = function() {
  var features = null
  if (this.features_) {
    features = this.features_;
  } else if (this.source_) {
    features = this.source_.getFeatures();
  }
  return (features);
};

/**
 * 处理要素移除事件
 * @param evt
 * @private
 */
ol.Observable.SnapToFeature.prototype.handleFeatureRemove_ = function(evt) {
  var feature = null;
  if (evt instanceof ol.source.Vector.Event) {
    feature = evt.feature;
  } else if (evt instanceof ol.Collection.Event) {
    feature = evt.element;
  }
  this.removeFeature(feature);
};


/**
 * 处理要素变化事件
 * @param evt
 * @private
 */
ol.Observable.SnapToFeature.prototype.handleFeatureChange_ = function(evt) {
  var feature = /** @type {ol.Feature} */ (evt.target);
  if (this.handlingDownUpSequence) {
    var uid = ol.getUid(feature);
    if (!(uid in this.pendingFeatures_)) {
      this.pendingFeatures_[uid] = feature;
    }
  } else {
    this.updateFeature_(feature);
  }
};

/**
 * 重写点空间信息
 * @param feature
 * @param geometry
 * @private
 */
ol.Observable.SnapToFeature.prototype.writePointGeometry_ = function(feature, geometry) {
  var coordinates = geometry.getCoordinates();
  var segmentData = ({
    feature: feature,
    segment: [coordinates, coordinates]
  });
  this.rBush_.insert(geometry.getExtent(), segmentData);
};

/**
 * 添加要素
 * @param feature
 * @param opt_listen
 */
ol.Observable.SnapToFeature.prototype.addFeature = function(feature, opt_listen) {
  var listen = opt_listen !== undefined ? opt_listen : true;
  var feature_uid = ol.getUid(feature);
  var geometry = feature.getGeometry();
  if (geometry) {
    var segmentWriter = this.writePointGeometry_();
    if (segmentWriter) {
      this.indexedFeaturesExtents_[feature_uid] = geometry.getExtent(
        ol.extent.createEmpty());
      segmentWriter.call(this, feature, geometry);
    }
  }

  if (listen) {
    this.featureChangeListenerKeys_[feature_uid] = ol.events.listen(
      feature,
      ol.events.EventType.CHANGE,
      this.handleFeatureChange_, this);
  }
};

/**
 * 移除要素
 * @param feature
 * @param opt_unlisten
 */
ol.Observable.SnapToFeature.prototype.removeFeature = function(feature, opt_unlisten) {
  var unlisten = opt_unlisten !== undefined ? opt_unlisten : true;
  var feature_uid = ol.getUid(feature);
  var extent = this.indexedFeaturesExtents_[feature_uid];
  if (extent) {
    var rBush = this.rBush_;
    var i, nodesToRemove = [];
    rBush.forEachInExtent(extent, function(node) {
      if (feature === node.feature) {
        nodesToRemove.push(node);
      }
    });
    for (i = nodesToRemove.length - 1; i >= 0; --i) {
      rBush.remove(nodesToRemove[i]);
    }
  }

  if (unlisten) {
    ol.events.unlistenByKey(this.featureChangeListenerKeys_[feature_uid]);
    delete this.featureChangeListenerKeys_[feature_uid];
  }
};

/**
 * 更新要素
 * @param feature
 * @private
 */
ol.Observable.SnapToFeature.prototype.updateFeature_ = function(feature) {
  this.removeFeature(feature, false);
  this.addFeature(feature, false);
};

/**
 * 处理事件
 * @param evt
 * @returns {*}
 * @private
 */
ol.Observable.SnapToFeature.prototype.handleEvent_ = function(evt) {
  var result = this.snapTo(evt.pixel, evt.coordinate, evt.map);
  if (result.snapped) {
    evt.coordinate = result.vertex.slice(0, 2);
    evt.pixel = result.vertexPixel;
  }
  return ol.interaction.Pointer.handleEvent.call(this, evt);
};


/**
 * 处理鼠标抬起事件
 * @param evt
 * @returns {boolean}
 */
ol.Observable.SnapToFeature.prototype.handleUpEvent = function(evt) {
  this.coordinate_ = null;
  this.feature_ = null;
  return false;
};

/**
 * 处理鼠标按下事件
 * @param evt
 * @returns {boolean}
 */
ol.Observable.SnapToFeature.prototype.handleDownEvent = function(evt) {
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
 * 处理拖拽事件
 * @param evt
 * @returns {boolean}
 */
ol.Observable.SnapToFeature.prototype.handleDragEvent = function(evt) {
  if (!this.coordinate_) {
    return false;
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

ol.Observable.SnapToFeature.prototype.begin = function() {
  this.points_.length = 0;
  this.angle_ = 0;
  this.initialVelocity_ = 0;
};


/**
 * @param {number} x X.
 * @param {number} y Y.
 */
ol.Observable.SnapToFeature.prototype.update = function(x, y) {
  this.points_.push(x, y, Date.now());
};


/**
 * @return {boolean} Whether we should do kinetic animation.
 */
ol.Observable.SnapToFeature.prototype.end = function() {
  if (this.points_.length < 6) {
    // at least 2 points are required (i.e. there must be at least 6 elements
    // in the array)
    return false;
  }
  var delay = Date.now() - this.delay_;
  var lastIndex = this.points_.length - 3;
  if (this.points_[lastIndex + 2] < delay) {
    // the last tracked point is too old, which means that the user stopped
    // panning before releasing the map
    return false;
  }

  // get the first point which still falls into the delay time
  var firstIndex = lastIndex - 3;
  while (firstIndex > 0 && this.points_[firstIndex + 2] > delay) {
    firstIndex -= 3;
  }
  var duration = this.points_[lastIndex + 2] - this.points_[firstIndex + 2];
  var dx = this.points_[lastIndex] - this.points_[firstIndex];
  var dy = this.points_[lastIndex + 1] - this.points_[firstIndex + 1];
  this.angle_ = Math.atan2(dy, dx);
  this.initialVelocity_ = Math.sqrt(dx * dx + dy * dy) / duration;
  return this.initialVelocity_ > this.minVelocity_;
};


/**
 * @return {number} Total distance travelled (pixels).
 */
ol.Observable.SnapToFeature.prototype.getDistance = function() {
  return (this.minVelocity_ - this.initialVelocity_) / this.decay_;
};


/**
 * @return {number} Angle of the kinetic panning animation (radians).
 */
ol.Observable.SnapToFeature.prototype.getAngle = function() {
  return this.angle_;
};