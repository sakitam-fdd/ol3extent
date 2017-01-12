ol.Observable.CustomCircle = function (opt_options) {
  this.options = opt_options || {};
  this.version = '1.0.0';
}
ol.Observable.CustomCircle.prototype.setup = function () {
  console.log(this.version)
}