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