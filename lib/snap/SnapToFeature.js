class SnapToFeature {
  constructor () {
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
  }
}

export default SnapToFeature