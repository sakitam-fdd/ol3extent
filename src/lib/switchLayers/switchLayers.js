/**
 * OpenLayers 3 Layer Switcher Control.
 * @constructor
 * @extends {ol.control.Control}
 * @param {Object} opt_options Control options, extends olx.control.ControlOptions.
 */
ol.control.LayerSwitcher = function(opt_options) {

  var options = opt_options || {};
  var tipLabel = options.tipLabel ?
    options.tipLabel : 'Legend';

  this.mapListeners = [];

  this.hiddenClassName = 'ol-unselectable ol-control layer-switcher';
  if (ol.control.LayerSwitcher.isTouchDevice_()) {
    this.hiddenClassName += ' touch';
  }
  this.shownClassName = this.hiddenClassName + ' shown';

  var element = document.createElement('div');
  element.className = this.hiddenClassName;

  var button = document.createElement('button');
  button.setAttribute('title', tipLabel);
  element.appendChild(button);

  this.panel = document.createElement('div');
  this.panel.className = 'panel';
  element.appendChild(this.panel);
  ol.control.LayerSwitcher.enableTouchScroll_(this.panel);

  var this_ = this;

  button.onmouseover = function(e) {
    this_.showPanel();
  };

  button.onclick = function(e) {
    e = e || window.event;
    this_.showPanel();
    e.preventDefault();
  };

  this_.panel.onmouseout = function(e) {
    e = e || window.event;
    if (!this_.panel.contains(e.toElement || e.relatedTarget)) {
      this_.hidePanel();
    }
  };
  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });

};

ol.inherits(ol.control.LayerSwitcher, ol.control.Control);

/**
 * @private
 * @desc Apply workaround to enable scrolling of overflowing content within an
 */
ol.control.LayerSwitcher.enableTouchScroll_ = function(elm) {
  if(ol.control.LayerSwitcher.isTouchDevice_()){
    var scrollStartPos = 0;
    elm.addEventListener("touchstart", function(event) {
      scrollStartPos = this.scrollTop + event.touches[0].pageY;
    }, false);
    elm.addEventListener("touchmove", function(event) {
      this.scrollTop = scrollStartPos - event.touches[0].pageY;
    }, false);
  }
};

/**
 * @private
 * @desc Determine if the current browser supports touch events. Adapted from
 */
ol.control.LayerSwitcher.isTouchDevice_ = function() {
  try {
    document.createEvent("TouchEvent");
    return true;
  } catch(e) {
    return false;
  }
};