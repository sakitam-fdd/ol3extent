class SnapUtil {
  constructor (params) {
    this.desc = 'SnapUtil'
    this.options = params || {}
    if (!this.options['map'] || this.options['map'] instanceof ol.Map) {
      throw new Error('请传入正确的地图对象！')
    }
    /**
     * 当前地图对象
     * @type {ol.Map}
     */
    this.map = this.options['map']

    /**
     * 吸附精度，默认10
     * @type {number}
     * @private
     */
    this.pixelTolerance_ = this.options['pixelTolerance'] !== undefined ? this.options.pixelTolerance : 10

    this.rBush_ = new ol.structs.RBush()

    /**
     * @private
     * @type {boolean}
     */
    this.edge_ = this.options['edge'] !== undefined ? this.options.edge : true

    /**
     * @type {ol.source.Vector}
     * @private
     */
    this.source_ = this.options['source'] ? this.options.source : null

    /**
     * @private
     * @type {boolean}
     */
    this.vertex_ = this.options['vertex'] !== undefined ? this.options.vertex : true
  }

  snapTo (pixel, pixelCoordinate) {
    let lowerLeft = this.map.getCoordinateFromPixel([(pixel[0] - this.pixelTolerance_), (pixel[1] + this.pixelTolerance_)])
    let upperRight = this.map.getCoordinateFromPixel([(pixel[0] + this.pixelTolerance_), (pixel[1] - this.pixelTolerance_)])
    let box = ol.extent.boundingExtent([lowerLeft, upperRight])
    let [segments, snappedToVertex, snapped, vertex, vertexPixel] = [(this.rBush_.getInExtent(box)), false, false, null, null]
    let [dist, pixel1, pixel2, squaredDist1, squaredDist2] = []
    if (segments.length > 0) {
      this.pixelCoordinate_ = pixelCoordinate;
      segments.sort(this.sortByDistance);
      let closestSegment = segments[0].segment;
      if (this.vertex_ && !this.edge_) {
        pixel1 = this.map.getPixelFromCoordinate(closestSegment[0]);
        pixel2 = this.map.getPixelFromCoordinate(closestSegment[1]);
        squaredDist1 = ol.coordinate.squaredDistance(pixel, pixel1);
        squaredDist2 = ol.coordinate.squaredDistance(pixel, pixel2);
        dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
        snappedToVertex = dist <= this.pixelTolerance_;
        if (snappedToVertex) {
          snapped = true;
          vertex = squaredDist1 > squaredDist2 ?
            closestSegment[1] : closestSegment[0];
          vertexPixel = this.map.getPixelFromCoordinate(vertex);
        }
      } else if (this.edge_) {
        vertex = (ol.coordinate.closestOnSegment(pixelCoordinate,
          closestSegment));
        vertexPixel = this.map.getPixelFromCoordinate(vertex);
        if (ol.coordinate.distance(pixel, vertexPixel) <= this.pixelTolerance_) {
          snapped = true;
          if (this.vertex_) {
            pixel1 = this.map.getPixelFromCoordinate(closestSegment[0]);
            pixel2 = this.map.getPixelFromCoordinate(closestSegment[1]);
            squaredDist1 = ol.coordinate.squaredDistance(vertexPixel, pixel1);
            squaredDist2 = ol.coordinate.squaredDistance(vertexPixel, pixel2);
            dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
            snappedToVertex = dist <= this.pixelTolerance_;
            if (snappedToVertex) {
              vertex = squaredDist1 > squaredDist2 ?
                closestSegment[1] : closestSegment[0];
              vertexPixel = this.map.getPixelFromCoordinate(vertex);
            }
          }
        }
      }
      if (snapped) {
        vertexPixel = [Math.round(vertexPixel[0]), Math.round(vertexPixel[1])];
      }
    }
    return ({
      snapped: snapped,
      vertex: vertex,
      vertexPixel: vertexPixel
    });
  }

  sortByDistance (a, b) {
    return ol.coordinate.squaredDistanceToSegment(
        this.pixelCoordinate_, a.segment) -
      ol.coordinate.squaredDistanceToSegment(
        this.pixelCoordinate_, b.segment);
  }
}

export default SnapUtil