(function() {
/**
@module ember
@submodule ember-views
*/

var jQuery = Ember.imports.jQuery;
Ember.assert("Ember Views require jQuery 1.8, 1.9 or 2.0", jQuery && (jQuery().jquery.match(/^((1\.(8|9))|2.0)(\.\d+)?(pre|rc\d?)?/) || Ember.ENV.FORCE_JQUERY));

/**
  Alias for jQuery

  @method $
  @for Ember
*/
Ember.$ = jQuery;

})();



(function() {
/**
@module ember
@submodule ember-views
*/
if (Ember.$) {
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#dndevents
  var dragEvents = Ember.String.w('dragstart drag dragenter dragleave dragover drop dragend');

  // Copies the `dataTransfer` property from a browser event object onto the
  // jQuery event object for the specified events
  Ember.EnumerableUtils.forEach(dragEvents, function(eventName) {
    Ember.$.event.fixHooks[eventName] = { props: ['dataTransfer'] };
  });
}

})();



(function() {
/**
@module ember
@submodule ember-views
*/

/*** BEGIN METAMORPH HELPERS ***/

// Internet Explorer prior to 9 does not allow setting innerHTML if the first element
// is a "zero-scope" element. This problem can be worked around by making
// the first node an invisible text node. We, like Modernizr, use &shy;

var needsShy = this.document && (function(){
  var testEl = document.createElement('div');
  testEl.innerHTML = "<div></div>";
  testEl.firstChild.innerHTML = "<script></script>";
  return testEl.firstChild.innerHTML === '';
})();

// IE 8 (and likely earlier) likes to move whitespace preceeding
// a script tag to appear after it. This means that we can
// accidentally remove whitespace when updating a morph.
var movesWhitespace = this.document && (function() {
  var testEl = document.createElement('div');
  testEl.innerHTML = "Test: <script type='text/x-placeholder'></script>Value";
  return testEl.childNodes[0].nodeValue === 'Test:' &&
          testEl.childNodes[2].nodeValue === ' Value';
})();

// Use this to find children by ID instead of using jQuery
var findChildById = function(element, id) {
  if (element.getAttribute('id') === id) { return element; }

  var len = element.childNodes.length, idx, node, found;
  for (idx=0; idx<len; idx++) {
    node = element.childNodes[idx];
    found = node.nodeType === 1 && findChildById(node, id);
    if (found) { return found; }
  }
};

var setInnerHTMLWithoutFix = function(element, html) {
  if (needsShy) {
    html = '&shy;' + html;
  }

  var matches = [];
  if (movesWhitespace) {
    // Right now we only check for script tags with ids with the
    // goal of targeting morphs.
    html = html.replace(/(\s+)(<script id='([^']+)')/g, function(match, spaces, tag, id) {
      matches.push([id, spaces]);
      return tag;
    });
  }

  element.innerHTML = html;

  // If we have to do any whitespace adjustments do them now
  if (matches.length > 0) {
    var len = matches.length, idx;
    for (idx=0; idx<len; idx++) {
      var script = findChildById(element, matches[idx][0]),
          node = document.createTextNode(matches[idx][1]);
      script.parentNode.insertBefore(node, script);
    }
  }

  if (needsShy) {
    var shyElement = element.firstChild;
    while (shyElement.nodeType === 1 && !shyElement.nodeName) {
      shyElement = shyElement.firstChild;
    }
    if (shyElement.nodeType === 3 && shyElement.nodeValue.charAt(0) === "\u00AD") {
      shyElement.nodeValue = shyElement.nodeValue.slice(1);
    }
  }
};

/*** END METAMORPH HELPERS */


var innerHTMLTags = {};
var canSetInnerHTML = function(tagName) {
  if (innerHTMLTags[tagName] !== undefined) {
    return innerHTMLTags[tagName];
  }

  var canSet = true;

  // IE 8 and earlier don't allow us to do innerHTML on select
  if (tagName.toLowerCase() === 'select') {
    var el = document.createElement('select');
    setInnerHTMLWithoutFix(el, '<option value="test">Test</option>');
    canSet = el.options.length === 1;
  }

  innerHTMLTags[tagName] = canSet;

  return canSet;
};

var setInnerHTML = function(element, html) {
  var tagName = element.tagName;

  if (canSetInnerHTML(tagName)) {
    setInnerHTMLWithoutFix(element, html);
  } else {
    // Firefox versions < 11 do not have support for element.outerHTML.
    var outerHTML = element.outerHTML || new XMLSerializer().serializeToString(element);
    Ember.assert("Can't set innerHTML on "+element.tagName+" in this browser", outerHTML);

    var startTag = outerHTML.match(new RegExp("<"+tagName+"([^>]*)>", 'i'))[0],
        endTag = '</'+tagName+'>';

    var wrapper = document.createElement('div');
    setInnerHTMLWithoutFix(wrapper, startTag + html + endTag);
    element = wrapper.firstChild;
    while (element.tagName !== tagName) {
      element = element.nextSibling;
    }
  }

  return element;
};

function isSimpleClick(event) {
  var modifier = event.shiftKey || event.metaKey || event.altKey || event.ctrlKey,
      secondaryClick = event.which > 1; // IE9 may return undefined

  return !modifier && !secondaryClick;
}

Ember.ViewUtils = {
  setInnerHTML: setInnerHTML,
  isSimpleClick: isSimpleClick
};

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;

var ClassSet = function() {
  this.seen = {};
  this.list = [];
};

ClassSet.prototype = {
  add: function(string) {
    if (string in this.seen) { return; }
    this.seen[string] = true;

    this.list.push(string);
  },

  toDOM: function() {
    return this.list.join(" ");
  }
};

/**
  `Ember.RenderBuffer` gathers information regarding the a view and generates the
  final representation. `Ember.RenderBuffer` will generate HTML which can be pushed
  to the DOM.

  @class RenderBuffer
  @namespace Ember
  @constructor
*/
Ember.RenderBuffer = function(tagName) {
  return new Ember._RenderBuffer(tagName);
};

Ember._RenderBuffer = function(tagName) {
  this.tagNames = [tagName || null];
  this.buffer = [];
};

Ember._RenderBuffer.prototype =
/** @scope Ember.RenderBuffer.prototype */ {

  // The root view's element
  _element: null,

  _hasElement: true,

  /**
    @private

    An internal set used to de-dupe class names when `addClass()` is
    used. After each call to `addClass()`, the `classes` property
    will be updated.

    @property elementClasses
    @type Array
    @default []
  */
  elementClasses: null,

  /**
    Array of class names which will be applied in the class attribute.

    You can use `setClasses()` to set this property directly. If you
    use `addClass()`, it will be maintained for you.

    @property classes
    @type Array
    @default []
  */
  classes: null,

  /**
    The id in of the element, to be applied in the id attribute.

    You should not set this property yourself, rather, you should use
    the `id()` method of `Ember.RenderBuffer`.

    @property elementId
    @type String
    @default null
  */
  elementId: null,

  /**
    A hash keyed on the name of the attribute and whose value will be
    applied to that attribute. For example, if you wanted to apply a
    `data-view="Foo.bar"` property to an element, you would set the
    elementAttributes hash to `{'data-view':'Foo.bar'}`.

    You should not maintain this hash yourself, rather, you should use
    the `attr()` method of `Ember.RenderBuffer`.

    @property elementAttributes
    @type Hash
    @default {}
  */
  elementAttributes: null,

  /**
    A hash keyed on the name of the properties and whose value will be
    applied to that property. For example, if you wanted to apply a
    `checked=true` property to an element, you would set the
    elementProperties hash to `{'checked':true}`.

    You should not maintain this hash yourself, rather, you should use
    the `prop()` method of `Ember.RenderBuffer`.

    @property elementProperties
    @type Hash
    @default {}
  */
  elementProperties: null,

  /**
    The tagname of the element an instance of `Ember.RenderBuffer` represents.

    Usually, this gets set as the first parameter to `Ember.RenderBuffer`. For
    example, if you wanted to create a `p` tag, then you would call

    ```javascript
    Ember.RenderBuffer('p')
    ```

    @property elementTag
    @type String
    @default null
  */
  elementTag: null,

  /**
    A hash keyed on the name of the style attribute and whose value will
    be applied to that attribute. For example, if you wanted to apply a
    `background-color:black;` style to an element, you would set the
    elementStyle hash to `{'background-color':'black'}`.

    You should not maintain this hash yourself, rather, you should use
    the `style()` method of `Ember.RenderBuffer`.

    @property elementStyle
    @type Hash
    @default {}
  */
  elementStyle: null,

  /**
    Nested `RenderBuffers` will set this to their parent `RenderBuffer`
    instance.

    @property parentBuffer
    @type Ember._RenderBuffer
  */
  parentBuffer: null,

  /**
    Adds a string of HTML to the `RenderBuffer`.

    @method push
    @param {String} string HTML to push into the buffer
    @chainable
  */
  push: function(string) {
    this.buffer.push(string);
    return this;
  },

  /**
    Adds a class to the buffer, which will be rendered to the class attribute.

    @method addClass
    @param {String} className Class name to add to the buffer
    @chainable
  */
  addClass: function(className) {
    // lazily create elementClasses
    this.elementClasses = (this.elementClasses || new ClassSet());
    this.elementClasses.add(className);
    this.classes = this.elementClasses.list;

    return this;
  },

  setClasses: function(classNames) {
    this.classes = classNames;
  },

  /**
    Sets the elementID to be used for the element.

    @method id
    @param {String} id
    @chainable
  */
  id: function(id) {
    this.elementId = id;
    return this;
  },

  // duck type attribute functionality like jQuery so a render buffer
  // can be used like a jQuery object in attribute binding scenarios.

  /**
    Adds an attribute which will be rendered to the element.

    @method attr
    @param {String} name The name of the attribute
    @param {String} value The value to add to the attribute
    @chainable
    @return {Ember.RenderBuffer|String} this or the current attribute value
  */
  attr: function(name, value) {
    var attributes = this.elementAttributes = (this.elementAttributes || {});

    if (arguments.length === 1) {
      return attributes[name];
    } else {
      attributes[name] = value;
    }

    return this;
  },

  /**
    Remove an attribute from the list of attributes to render.

    @method removeAttr
    @param {String} name The name of the attribute
    @chainable
  */
  removeAttr: function(name) {
    var attributes = this.elementAttributes;
    if (attributes) { delete attributes[name]; }

    return this;
  },

  /**
    Adds an property which will be rendered to the element.

    @method prop
    @param {String} name The name of the property
    @param {String} value The value to add to the property
    @chainable
    @return {Ember.RenderBuffer|String} this or the current property value
  */
  prop: function(name, value) {
    var properties = this.elementProperties = (this.elementProperties || {});

    if (arguments.length === 1) {
      return properties[name];
    } else {
      properties[name] = value;
    }

    return this;
  },

  /**
    Remove an property from the list of properties to render.

    @method removeProp
    @param {String} name The name of the property
    @chainable
  */
  removeProp: function(name) {
    var properties = this.elementProperties;
    if (properties) { delete properties[name]; }

    return this;
  },

  /**
    Adds a style to the style attribute which will be rendered to the element.

    @method style
    @param {String} name Name of the style
    @param {String} value
    @chainable
  */
  style: function(name, value) {
    this.elementStyle = (this.elementStyle || {});

    this.elementStyle[name] = value;
    return this;
  },

  begin: function(tagName) {
    this.tagNames.push(tagName || null);
    return this;
  },

  pushOpeningTag: function() {
    var tagName = this.currentTagName();
    if (!tagName) { return; }

    if (this._hasElement && !this._element && this.buffer.length === 0) {
      this._element = this.generateElement();
      return;
    }

    var buffer = this.buffer,
        id = this.elementId,
        classes = this.classes,
        attrs = this.elementAttributes,
        props = this.elementProperties,
        style = this.elementStyle,
        attr, prop;

    buffer.push('<' + tagName);

    if (id) {
      buffer.push(' id="' + this._escapeAttribute(id) + '"');
      this.elementId = null;
    }
    if (classes) {
      buffer.push(' class="' + this._escapeAttribute(classes.join(' ')) + '"');
      this.classes = null;
    }

    if (style) {
      buffer.push(' style="');

      for (prop in style) {
        if (style.hasOwnProperty(prop)) {
          buffer.push(prop + ':' + this._escapeAttribute(style[prop]) + ';');
        }
      }

      buffer.push('"');

      this.elementStyle = null;
    }

    if (attrs) {
      for (attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          buffer.push(' ' + attr + '="' + this._escapeAttribute(attrs[attr]) + '"');
        }
      }

      this.elementAttributes = null;
    }

    if (props) {
      for (prop in props) {
        if (props.hasOwnProperty(prop)) {
          var value = props[prop];
          if (value || typeof(value) === 'number') {
            if (value === true) {
              buffer.push(' ' + prop + '="' + prop + '"');
            } else {
              buffer.push(' ' + prop + '="' + this._escapeAttribute(props[prop]) + '"');
            }
          }
        }
      }

      this.elementProperties = null;
    }

    buffer.push('>');
  },

  pushClosingTag: function() {
    var tagName = this.tagNames.pop();
    if (tagName) { this.buffer.push('</' + tagName + '>'); }
  },

  currentTagName: function() {
    return this.tagNames[this.tagNames.length-1];
  },

  generateElement: function() {
    var tagName = this.tagNames.pop(), // pop since we don't need to close
        element = document.createElement(tagName),
        $element = Ember.$(element),
        id = this.elementId,
        classes = this.classes,
        attrs = this.elementAttributes,
        props = this.elementProperties,
        style = this.elementStyle,
        styleBuffer = '', attr, prop;

    if (id) {
      $element.attr('id', id);
      this.elementId = null;
    }
    if (classes) {
      $element.attr('class', classes.join(' '));
      this.classes = null;
    }

    if (style) {
      for (prop in style) {
        if (style.hasOwnProperty(prop)) {
          styleBuffer += (prop + ':' + style[prop] + ';');
        }
      }

      $element.attr('style', styleBuffer);

      this.elementStyle = null;
    }

    if (attrs) {
      for (attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          $element.attr(attr, attrs[attr]);
        }
      }

      this.elementAttributes = null;
    }

    if (props) {
      for (prop in props) {
        if (props.hasOwnProperty(prop)) {
          $element.prop(prop, props[prop]);
        }
      }

      this.elementProperties = null;
    }

    return element;
  },

  /**
    @method element
    @return {DOMElement} The element corresponding to the generated HTML
      of this buffer
  */
  element: function() {
    var html = this.innerString();

    if (html) {
      this._element = Ember.ViewUtils.setInnerHTML(this._element, html);
    }

    return this._element;
  },

  /**
    Generates the HTML content for this buffer.

    @method string
    @return {String} The generated HTML
  */
  string: function() {
    if (this._hasElement && this._element) {
      // Firefox versions < 11 do not have support for element.outerHTML.
      return this.element().outerHTML ||
        new XMLSerializer().serializeToString(this.element());
    } else {
      return this.innerString();
    }
  },

  innerString: function() {
    return this.buffer.join('');
  },

  _escapeAttribute: function(value) {
    // Stolen shamelessly from Handlebars

    var escape = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "`": "&#x60;"
    };

    var badChars = /&(?!\w+;)|[<>"'`]/g;
    var possible = /[&<>"'`]/;

    var escapeChar = function(chr) {
      return escape[chr] || "&amp;";
    };

    var string = value.toString();

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  }

};

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set, fmt = Ember.String.fmt;

/**
  `Ember.EventDispatcher` handles delegating browser events to their
  corresponding `Ember.Views.` For example, when you click on a view,
  `Ember.EventDispatcher` ensures that that view's `mouseDown` method gets
  called.

  @class EventDispatcher
  @namespace Ember
  @private
  @extends Ember.Object
*/
Ember.EventDispatcher = Ember.Object.extend(
/** @scope Ember.EventDispatcher.prototype */{

  /**
    @private

    The root DOM element to which event listeners should be attached. Event
    listeners will be attached to the document unless this is overridden.

    Can be specified as a DOMElement or a selector string.

    The default body is a string since this may be evaluated before document.body
    exists in the DOM.

    @property rootElement
    @type DOMElement
    @default 'body'
  */
  rootElement: 'body',

  /**
    @private

    Sets up event listeners for standard browser events.

    This will be called after the browser sends a `DOMContentReady` event. By
    default, it will set up all of the listeners on the document body. If you
    would like to register the listeners on a different element, set the event
    dispatcher's `root` property.

    @method setup
    @param addedEvents {Hash}
  */
  setup: function(addedEvents) {
    var event, events = {
      touchstart  : 'touchStart',
      touchmove   : 'touchMove',
      touchend    : 'touchEnd',
      touchcancel : 'touchCancel',
      keydown     : 'keyDown',
      keyup       : 'keyUp',
      keypress    : 'keyPress',
      mousedown   : 'mouseDown',
      mouseup     : 'mouseUp',
      contextmenu : 'contextMenu',
      click       : 'click',
      dblclick    : 'doubleClick',
      mousemove   : 'mouseMove',
      focusin     : 'focusIn',
      focusout    : 'focusOut',
      mouseenter  : 'mouseEnter',
      mouseleave  : 'mouseLeave',
      submit      : 'submit',
      input       : 'input',
      change      : 'change',
      dragstart   : 'dragStart',
      drag        : 'drag',
      dragenter   : 'dragEnter',
      dragleave   : 'dragLeave',
      dragover    : 'dragOver',
      drop        : 'drop',
      dragend     : 'dragEnd'
    };

    Ember.$.extend(events, addedEvents || {});

    var rootElement = Ember.$(get(this, 'rootElement'));

    Ember.assert(fmt('You cannot use the same root element (%@) multiple times in an Ember.Application', [rootElement.selector || rootElement[0].tagName]), !rootElement.is('.ember-application'));
    Ember.assert('You cannot make a new Ember.Application using a root element that is a descendent of an existing Ember.Application', !rootElement.closest('.ember-application').length);
    Ember.assert('You cannot make a new Ember.Application using a root element that is an ancestor of an existing Ember.Application', !rootElement.find('.ember-application').length);

    rootElement.addClass('ember-application');

    Ember.assert('Unable to add "ember-application" class to rootElement. Make sure you set rootElement to the body or an element in the body.', rootElement.is('.ember-application'));

    for (event in events) {
      if (events.hasOwnProperty(event)) {
        this.setupHandler(rootElement, event, events[event]);
      }
    }
  },

  /**
    @private

    Registers an event listener on the document. If the given event is
    triggered, the provided event handler will be triggered on the target view.

    If the target view does not implement the event handler, or if the handler
    returns `false`, the parent view will be called. The event will continue to
    bubble to each successive parent view until it reaches the top.

    For example, to have the `mouseDown` method called on the target view when
    a `mousedown` event is received from the browser, do the following:

    ```javascript
    setupHandler('mousedown', 'mouseDown');
    ```

    @method setupHandler
    @param {Element} rootElement
    @param {String} event the browser-originated event to listen to
    @param {String} eventName the name of the method to call on the view
  */
  setupHandler: function(rootElement, event, eventName) {
    var self = this;

    rootElement.delegate('.ember-view', event + '.ember', function(evt, triggeringManager) {
      return Ember.handleErrors(function() {
        var view = Ember.View.views[this.id],
            result = true, manager = null;

        manager = self._findNearestEventManager(view,eventName);

        if (manager && manager !== triggeringManager) {
          result = self._dispatchEvent(manager, evt, eventName, view);
        } else if (view) {
          result = self._bubbleEvent(view,evt,eventName);
        } else {
          evt.stopPropagation();
        }

        return result;
      }, this);
    });

    rootElement.delegate('[data-ember-action]', event + '.ember', function(evt) {
      return Ember.handleErrors(function() {
        var actionId = Ember.$(evt.currentTarget).attr('data-ember-action'),
            action   = Ember.Handlebars.ActionHelper.registeredActions[actionId];

        // We have to check for action here since in some cases, jQuery will trigger
        // an event on `removeChild` (i.e. focusout) after we've already torn down the
        // action handlers for the view.
        if (action && action.eventName === eventName) {
          return action.handler(evt);
        }
      }, this);
    });
  },

  _findNearestEventManager: function(view, eventName) {
    var manager = null;

    while (view) {
      manager = get(view, 'eventManager');
      if (manager && manager[eventName]) { break; }

      view = get(view, 'parentView');
    }

    return manager;
  },

  _dispatchEvent: function(object, evt, eventName, view) {
    var result = true;

    var handler = object[eventName];
    if (Ember.typeOf(handler) === 'function') {
      result = handler.call(object, evt, view);
      // Do not preventDefault in eventManagers.
      evt.stopPropagation();
    }
    else {
      result = this._bubbleEvent(view, evt, eventName);
    }

    return result;
  },

  _bubbleEvent: function(view, evt, eventName) {
    return Ember.run(function() {
      return view.handleEvent(eventName, evt);
    });
  },

  destroy: function() {
    var rootElement = get(this, 'rootElement');
    Ember.$(rootElement).undelegate('.ember').removeClass('ember-application');
    return this._super();
  }
});

})();



(function() {
/**
@module ember
@submodule ember-views
*/

// Add a new named queue for rendering views that happens
// after bindings have synced, and a queue for scheduling actions
// that that should occur after view rendering.
var queues = Ember.run.queues,
    indexOf = Ember.ArrayPolyfills.indexOf;
queues.splice(indexOf.call(queues, 'actions')+1, 0, 'render', 'afterRender');

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;

// Original class declaration and documentation in runtime/lib/controllers/controller.js
// NOTE: It may be possible with YUIDoc to combine docs in two locations

/**
Additional methods for the ControllerMixin

@class ControllerMixin
@namespace Ember
*/
Ember.ControllerMixin.reopen({
  target: null,
  namespace: null,
  view: null,
  container: null,
  _childContainers: null,

  init: function() {
    this._super();
    set(this, '_childContainers', {});
  },

  _modelDidChange: Ember.observer(function() {
    var containers = get(this, '_childContainers');

    for (var prop in containers) {
      if (!containers.hasOwnProperty(prop)) { continue; }
      containers[prop].destroy();
    }

    set(this, '_childContainers', {});
  }, 'model')
});

})();



(function() {

})();



(function() {
var states = {};

/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;
var guidFor = Ember.guidFor;
var a_forEach = Ember.EnumerableUtils.forEach;
var a_addObject = Ember.EnumerableUtils.addObject;

var childViewsProperty = Ember.computed(function() {
  var childViews = this._childViews, ret = Ember.A(), view = this;

  a_forEach(childViews, function(view) {
    if (view.isVirtual) {
      ret.pushObjects(get(view, 'childViews'));
    } else {
      ret.push(view);
    }
  });

  ret.replace = function (idx, removedCount, addedViews) {
    if (view instanceof Ember.ContainerView) {
      Ember.deprecate("Manipulating an Ember.ContainerView through its childViews property is deprecated. Please use the ContainerView instance itself as an Ember.MutableArray.");
      return view.replace(idx, removedCount, addedViews);
    }
    throw new Error("childViews is immutable");
  };

  return ret;
});

Ember.warn("The VIEW_PRESERVES_CONTEXT flag has been removed and the functionality can no longer be disabled.", Ember.ENV.VIEW_PRESERVES_CONTEXT !== false);

/**
  Global hash of shared templates. This will automatically be populated
  by the build tools so that you can store your Handlebars templates in
  separate files that get loaded into JavaScript at buildtime.

  @property TEMPLATES
  @for Ember
  @type Hash
*/
Ember.TEMPLATES = {};

Ember.CoreView = Ember.Object.extend(Ember.Evented, {
  isView: true,

  states: states,

  init: function() {
    this._super();
    this.transitionTo('preRender');
  },

  /**
    If the view is currently inserted into the DOM of a parent view, this
    property will point to the parent of the view.

    @property parentView
    @type Ember.View
    @default null
  */
  parentView: Ember.computed(function() {
    var parent = this._parentView;

    if (parent && parent.isVirtual) {
      return get(parent, 'parentView');
    } else {
      return parent;
    }
  }).property('_parentView'),

  state: null,

  _parentView: null,

  // return the current view, not including virtual views
  concreteView: Ember.computed(function() {
    if (!this.isVirtual) { return this; }
    else { return get(this, 'parentView'); }
  }).property('parentView'),

  instrumentName: 'core_view',

  instrumentDetails: function(hash) {
    hash.object = this.toString();
  },

  /**
    @private

    Invoked by the view system when this view needs to produce an HTML
    representation. This method will create a new render buffer, if needed,
    then apply any default attributes, such as class names and visibility.
    Finally, the `render()` method is invoked, which is responsible for
    doing the bulk of the rendering.

    You should not need to override this method; instead, implement the
    `template` property, or if you need more control, override the `render`
    method.

    @method renderToBuffer
    @param {Ember.RenderBuffer} buffer the render buffer. If no buffer is
      passed, a default buffer, using the current view's `tagName`, will
      be used.
  */
  renderToBuffer: function(parentBuffer, bufferOperation) {
    var name = 'render.' + this.instrumentName,
        details = {};

    this.instrumentDetails(details);

    return Ember.instrument(name, details, function() {
      return this._renderToBuffer(parentBuffer, bufferOperation);
    }, this);
  },

  _renderToBuffer: function(parentBuffer, bufferOperation) {
    Ember.run.sync();

    // If this is the top-most view, start a new buffer. Otherwise,
    // create a new buffer relative to the original using the
    // provided buffer operation (for example, `insertAfter` will
    // insert a new buffer after the "parent buffer").
    var tagName = this.tagName;

    if (tagName === null || tagName === undefined) {
      tagName = 'div';
    }

    var buffer = this.buffer = parentBuffer && parentBuffer.begin(tagName) || Ember.RenderBuffer(tagName);
    this.transitionTo('inBuffer', false);

    this.beforeRender(buffer);
    this.render(buffer);
    this.afterRender(buffer);

    return buffer;
  },

  /**
    @private

    Override the default event firing from `Ember.Evented` to
    also call methods with the given name.

    @method trigger
    @param name {String}
  */
  trigger: function(name) {
    this._super.apply(this, arguments);
    var method = this[name];
    if (method) {
      var args = [], i, l;
      for (i = 1, l = arguments.length; i < l; i++) {
        args.push(arguments[i]);
      }
      return method.apply(this, args);
    }
  },

  has: function(name) {
    return Ember.typeOf(this[name]) === 'function' || this._super(name);
  },

  destroy: function() {
    var parent = this._parentView;

    if (!this._super()) { return; }

    // destroy the element -- this will avoid each child view destroying
    // the element over and over again...
    if (!this.removedFromDOM) { this.destroyElement(); }

    // remove from parent if found. Don't call removeFromParent,
    // as removeFromParent will try to remove the element from
    // the DOM again.
    if (parent) { parent.removeChild(this); }

    this.transitionTo('destroying', false);

    return this;
  },

  clearRenderedChildren: Ember.K,
  triggerRecursively: Ember.K,
  invokeRecursively: Ember.K,
  transitionTo: Ember.K,
  destroyElement: Ember.K
});

var ViewCollection = Ember._ViewCollection = function(initialViews) {
  var views = this.views = initialViews || [];
  this.length = views.length;
};

ViewCollection.prototype = {
  length: 0,

  trigger: function(eventName) {
    var views = this.views, view;
    for (var i = 0, l = views.length; i < l; i++) {
      view = views[i];
      if (view.trigger) { view.trigger(eventName); }
    }
  },

  triggerRecursively: function(eventName) {
    var views = this.views;
    for (var i = 0, l = views.length; i < l; i++) {
      views[i].triggerRecursively(eventName);
    }
  },

  transitionTo: function(state, children) {
    var views = this.views;
    for (var i = 0, l = views.length; i < l; i++) {
      views[i].transitionTo(state, children);
    }
  },

  push: function() {
    this.length += arguments.length;
    var views = this.views;
    return views.push.apply(views, arguments);
  },

  objectAt: function(idx) {
    return this.views[idx];
  },

  forEach: function() {
    var views = this.views;
    return views.forEach.apply(views, arguments);
  },

  clear: function() {
    this.length = 0;
    this.views.length = 0;
  }
};

var EMPTY_ARRAY = [];

/**
  `Ember.View` is the class in Ember responsible for encapsulating templates of
  HTML content, combining templates with data to render as sections of a page's
  DOM, and registering and responding to user-initiated events.

  ## HTML Tag

  The default HTML tag name used for a view's DOM representation is `div`. This
  can be customized by setting the `tagName` property. The following view
class:

  ```javascript
  ParagraphView = Ember.View.extend({
    tagName: 'em'
  });
  ```

  Would result in instances with the following HTML:

  ```html
  <em id="ember1" class="ember-view"></em>
  ```

  ## HTML `class` Attribute

  The HTML `class` attribute of a view's tag can be set by providing a
  `classNames` property that is set to an array of strings:

  ```javascript
  MyView = Ember.View.extend({
    classNames: ['my-class', 'my-other-class']
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view my-class my-other-class"></div>
  ```

  `class` attribute values can also be set by providing a `classNameBindings`
  property set to an array of properties names for the view. The return value
  of these properties will be added as part of the value for the view's `class`
  attribute. These properties can be computed properties:

  ```javascript
  MyView = Ember.View.extend({
    classNameBindings: ['propertyA', 'propertyB'],
    propertyA: 'from-a',
    propertyB: function(){
      if(someLogic){ return 'from-b'; }
    }.property()
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view from-a from-b"></div>
  ```

  If the value of a class name binding returns a boolean the property name
  itself will be used as the class name if the property is true. The class name
  will not be added if the value is `false` or `undefined`.

  ```javascript
  MyView = Ember.View.extend({
    classNameBindings: ['hovered'],
    hovered: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view hovered"></div>
  ```

  When using boolean class name bindings you can supply a string value other
  than the property name for use as the `class` HTML attribute by appending the
  preferred value after a ":" character when defining the binding:

  ```javascript
  MyView = Ember.View.extend({
    classNameBindings: ['awesome:so-very-cool'],
    awesome: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view so-very-cool"></div>
  ```

  Boolean value class name bindings whose property names are in a
  camelCase-style format will be converted to a dasherized format:

  ```javascript
  MyView = Ember.View.extend({
    classNameBindings: ['isUrgent'],
    isUrgent: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view is-urgent"></div>
  ```

  Class name bindings can also refer to object values that are found by
  traversing a path relative to the view itself:

  ```javascript
  MyView = Ember.View.extend({
    classNameBindings: ['messages.empty']
    messages: Ember.Object.create({
      empty: true
    })
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view empty"></div>
  ```

  If you want to add a class name for a property which evaluates to true and
  and a different class name if it evaluates to false, you can pass a binding
  like this:

  ```javascript
  // Applies 'enabled' class when isEnabled is true and 'disabled' when isEnabled is false
  Ember.View.create({
    classNameBindings: ['isEnabled:enabled:disabled']
    isEnabled: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view enabled"></div>
  ```

  When isEnabled is `false`, the resulting HTML reprensentation looks like
  this:

  ```html
  <div id="ember1" class="ember-view disabled"></div>
  ```

  This syntax offers the convenience to add a class if a property is `false`:

  ```javascript
  // Applies no class when isEnabled is true and class 'disabled' when isEnabled is false
  Ember.View.create({
    classNameBindings: ['isEnabled::disabled']
    isEnabled: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view"></div>
  ```

  When the `isEnabled` property on the view is set to `false`, it will result
  in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view disabled"></div>
  ```

  Updates to the the value of a class name binding will result in automatic
  update of the  HTML `class` attribute in the view's rendered HTML
  representation. If the value becomes `false` or `undefined` the class name
  will be removed.

  Both `classNames` and `classNameBindings` are concatenated properties. See
  `Ember.Object` documentation for more information about concatenated
  properties.

  ## HTML Attributes

  The HTML attribute section of a view's tag can be set by providing an
  `attributeBindings` property set to an array of property names on the view.
  The return value of these properties will be used as the value of the view's
  HTML associated attribute:

  ```javascript
  AnchorView = Ember.View.extend({
    tagName: 'a',
    attributeBindings: ['href'],
    href: 'http://google.com'
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <a id="ember1" class="ember-view" href="http://google.com"></a>
  ```

  If the return value of an `attributeBindings` monitored property is a boolean
  the property will follow HTML's pattern of repeating the attribute's name as
  its value:

  ```javascript
  MyTextInput = Ember.View.extend({
    tagName: 'input',
    attributeBindings: ['disabled'],
    disabled: true
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <input id="ember1" class="ember-view" disabled="disabled" />
  ```

  `attributeBindings` can refer to computed properties:

  ```javascript
  MyTextInput = Ember.View.extend({
    tagName: 'input',
    attributeBindings: ['disabled'],
    disabled: function(){
      if (someLogic) {
        return true;
      } else {
        return false;
      }
    }.property()
  });
  ```

  Updates to the the property of an attribute binding will result in automatic
  update of the  HTML attribute in the view's rendered HTML representation.

  `attributeBindings` is a concatenated property. See `Ember.Object`
  documentation for more information about concatenated properties.

  ## Templates

  The HTML contents of a view's rendered representation are determined by its
  template. Templates can be any function that accepts an optional context
  parameter and returns a string of HTML that will be inserted within the
  view's tag. Most typically in Ember this function will be a compiled
  `Ember.Handlebars` template.

  ```javascript
  AView = Ember.View.extend({
    template: Ember.Handlebars.compile('I am the template')
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view">I am the template</div>
  ```

  Within an Ember application is more common to define a Handlebars templates as
  part of a page:

  ```html
  <script type='text/x-handlebars' data-template-name='some-template'>
    Hello
  </script>
  ```

  And associate it by name using a view's `templateName` property:

  ```javascript
  AView = Ember.View.extend({
    templateName: 'some-template'
  });
  ```

  Using a value for `templateName` that does not have a Handlebars template
  with a matching `data-template-name` attribute will throw an error.

  Assigning a value to both `template` and `templateName` properties will throw
  an error.

  For views classes that may have a template later defined (e.g. as the block
  portion of a `{{view}}` Handlebars helper call in another template or in
  a subclass), you can provide a `defaultTemplate` property set to compiled
  template function. If a template is not later provided for the view instance
  the `defaultTemplate` value will be used:

  ```javascript
  AView = Ember.View.extend({
    defaultTemplate: Ember.Handlebars.compile('I was the default'),
    template: null,
    templateName: null
  });
  ```

  Will result in instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view">I was the default</div>
  ```

  If a `template` or `templateName` is provided it will take precedence over
  `defaultTemplate`:

  ```javascript
  AView = Ember.View.extend({
    defaultTemplate: Ember.Handlebars.compile('I was the default')
  });

  aView = AView.create({
    template: Ember.Handlebars.compile('I was the template, not default')
  });
  ```

  Will result in the following HTML representation when rendered:

  ```html
  <div id="ember1" class="ember-view">I was the template, not default</div>
  ```

  ## View Context

  The default context of the compiled template is the view's controller:

  ```javascript
  AView = Ember.View.extend({
    template: Ember.Handlebars.compile('Hello {{excitedGreeting}}')
  });

  aController = Ember.Object.create({
    firstName: 'Barry',
    excitedGreeting: function(){
      return this.get("content.firstName") + "!!!"
    }.property()
  });

  aView = AView.create({
    controller: aController,
  });
  ```

  Will result in an HTML representation of:

  ```html
  <div id="ember1" class="ember-view">Hello Barry!!!</div>
  ```

  A context can also be explicitly supplied through the view's `context`
  property. If the view has neither `context` nor `controller` properties, the
  `parentView`'s context will be used.

  ## Layouts

  Views can have a secondary template that wraps their main template. Like
  primary templates, layouts can be any function that  accepts an optional
  context parameter and returns a string of HTML that will be inserted inside
  view's tag. Views whose HTML element is self closing (e.g. `<input />`)
  cannot have a layout and this property will be ignored.

  Most typically in Ember a layout will be a compiled `Ember.Handlebars`
  template.

  A view's layout can be set directly with the `layout` property or reference
  an existing Handlebars template by name with the `layoutName` property.

  A template used as a layout must contain a single use of the Handlebars
  `{{yield}}` helper. The HTML contents of a view's rendered `template` will be
  inserted at this location:

  ```javascript
  AViewWithLayout = Ember.View.extend({
    layout: Ember.Handlebars.compile("<div class='my-decorative-class'>{{yield}}</div>")
    template: Ember.Handlebars.compile("I got wrapped"),
  });
  ```

  Will result in view instances with an HTML representation of:

  ```html
  <div id="ember1" class="ember-view">
    <div class="my-decorative-class">
      I got wrapped
    </div>
  </div>
  ```

  See `Handlebars.helpers.yield` for more information.

  ## Responding to Browser Events

  Views can respond to user-initiated events in one of three ways: method
  implementation, through an event manager, and through `{{action}}` helper use
  in their template or layout.

  ### Method Implementation

  Views can respond to user-initiated events by implementing a method that
  matches the event name. A `jQuery.Event` object will be passed as the
  argument to this method.

  ```javascript
  AView = Ember.View.extend({
    click: function(event){
      // will be called when when an instance's
      // rendered element is clicked
    }
  });
  ```

  ### Event Managers

  Views can define an object as their `eventManager` property. This object can
  then implement methods that match the desired event names. Matching events
  that occur on the view's rendered HTML or the rendered HTML of any of its DOM
  descendants will trigger this method. A `jQuery.Event` object will be passed
  as the first argument to the method and an  `Ember.View` object as the
  second. The `Ember.View` will be the view whose rendered HTML was interacted
  with. This may be the view with the `eventManager` property or one of its
  descendent views.

  ```javascript
  AView = Ember.View.extend({
    eventManager: Ember.Object.create({
      doubleClick: function(event, view){
        // will be called when when an instance's
        // rendered element or any rendering
        // of this views's descendent
        // elements is clicked
      }
    })
  });
  ```

  An event defined for an event manager takes precedence over events of the
  same name handled through methods on the view.

  ```javascript
  AView = Ember.View.extend({
    mouseEnter: function(event){
      // will never trigger.
    },
    eventManager: Ember.Object.create({
      mouseEnter: function(event, view){
        // takes presedence over AView#mouseEnter
      }
    })
  });
  ```

  Similarly a view's event manager will take precedence for events of any views
  rendered as a descendent. A method name that matches an event name will not
  be called if the view instance was rendered inside the HTML representation of
  a view that has an `eventManager` property defined that handles events of the
  name. Events not handled by the event manager will still trigger method calls
  on the descendent.

  ```javascript
  OuterView = Ember.View.extend({
    template: Ember.Handlebars.compile("outer {{#view InnerView}}inner{{/view}} outer"),
    eventManager: Ember.Object.create({
      mouseEnter: function(event, view){
        // view might be instance of either
        // OutsideView or InnerView depending on
        // where on the page the user interaction occured
      }
    })
  });

  InnerView = Ember.View.extend({
    click: function(event){
      // will be called if rendered inside
      // an OuterView because OuterView's
      // eventManager doesn't handle click events
    },
    mouseEnter: function(event){
      // will never be called if rendered inside
      // an OuterView.
    }
  });
  ```

  ### Handlebars `{{action}}` Helper

  See `Handlebars.helpers.action`.

  ### Event Names

  Possible events names for any of the responding approaches described above
  are:

  Touch events:

  * `touchStart`
  * `touchMove`
  * `touchEnd`
  * `touchCancel`

  Keyboard events

  * `keyDown`
  * `keyUp`
  * `keyPress`

  Mouse events

  * `mouseDown`
  * `mouseUp`
  * `contextMenu`
  * `click`
  * `doubleClick`
  * `mouseMove`
  * `focusIn`
  * `focusOut`
  * `mouseEnter`
  * `mouseLeave`

  Form events:

  * `submit`
  * `change`
  * `focusIn`
  * `focusOut`
  * `input`

  HTML5 drag and drop events:

  * `dragStart`
  * `drag`
  * `dragEnter`
  * `dragLeave`
  * `drop`
  * `dragEnd`

  ## Handlebars `{{view}}` Helper

  Other `Ember.View` instances can be included as part of a view's template by
  using the `{{view}}` Handlebars helper. See `Handlebars.helpers.view` for
  additional information.

  @class View
  @namespace Ember
  @extends Ember.Object
  @uses Ember.Evented
*/
Ember.View = Ember.CoreView.extend(
/** @scope Ember.View.prototype */ {

  concatenatedProperties: ['classNames', 'classNameBindings', 'attributeBindings'],

  /**
    @property isView
    @type Boolean
    @default true
    @final
  */
  isView: true,

  // ..........................................................
  // TEMPLATE SUPPORT
  //

  /**
    The name of the template to lookup if no template is provided.

    `Ember.View` will look for a template with this name in this view's
    `templates` object. By default, this will be a global object
    shared in `Ember.TEMPLATES`.

    @property templateName
    @type String
    @default null
  */
  templateName: null,

  /**
    The name of the layout to lookup if no layout is provided.

    `Ember.View` will look for a template with this name in this view's
    `templates` object. By default, this will be a global object
    shared in `Ember.TEMPLATES`.

    @property layoutName
    @type String
    @default null
  */
  layoutName: null,

  /**
    The hash in which to look for `templateName`.

    @property templates
    @type Ember.Object
    @default Ember.TEMPLATES
  */
  templates: Ember.TEMPLATES,

  /**
    The template used to render the view. This should be a function that
    accepts an optional context parameter and returns a string of HTML that
    will be inserted into the DOM relative to its parent view.

    In general, you should set the `templateName` property instead of setting
    the template yourself.

    @property template
    @type Function
  */
  template: Ember.computed(function(key, value) {
    if (value !== undefined) { return value; }

    var templateName = get(this, 'templateName'),
        template = this.templateForName(templateName, 'template');

    Ember.assert("You specified the templateName " + templateName + " for " + this + ", but it did not exist.", !templateName || template);

    return template || get(this, 'defaultTemplate');
  }).property('templateName'),

  container: Ember.computed(function() {
    var parentView = get(this, '_parentView');

    if (parentView) { return get(parentView, 'container'); }

    return Ember.Container && Ember.Container.defaultContainer;
  }),

  /**
    The controller managing this view. If this property is set, it will be
    made available for use by the template.

    @property controller
    @type Object
  */
  controller: Ember.computed(function(key) {
    var parentView = get(this, '_parentView');
    return parentView ? get(parentView, 'controller') : null;
  }).property('_parentView'),

  /**
    A view may contain a layout. A layout is a regular template but
    supersedes the `template` property during rendering. It is the
    responsibility of the layout template to retrieve the `template`
    property from the view (or alternatively, call `Handlebars.helpers.yield`,
    `{{yield}}`) to render it in the correct location.

    This is useful for a view that has a shared wrapper, but which delegates
    the rendering of the contents of the wrapper to the `template` property
    on a subclass.

    @property layout
    @type Function
  */
  layout: Ember.computed(function(key) {
    var layoutName = get(this, 'layoutName'),
        layout = this.templateForName(layoutName, 'layout');

    Ember.assert("You specified the layoutName " + layoutName + " for " + this + ", but it did not exist.", !layoutName || layout);

    return layout || get(this, 'defaultLayout');
  }).property('layoutName'),

  templateForName: function(name, type) {
    if (!name) { return; }

    Ember.assert("templateNames are not allowed to contain periods: "+name, name.indexOf('.') === -1);

    var container = get(this, 'container');

    if (container) {
      return container.lookup('template:' + name);
    }
  },

  /**
    The object from which templates should access properties.

    This object will be passed to the template function each time the render
    method is called, but it is up to the individual function to decide what
    to do with it.

    By default, this will be the view's controller.

    @property context
    @type Object
  */
  context: Ember.computed(function(key, value) {
    if (arguments.length === 2) {
      set(this, '_context', value);
      return value;
    } else {
      return get(this, '_context');
    }
  }).volatile(),

  /**
    @private

    Private copy of the view's template context. This can be set directly
    by Handlebars without triggering the observer that causes the view
    to be re-rendered.

    The context of a view is looked up as follows:

    1. Supplied context (usually by Handlebars)
    2. Specified controller
    3. `parentView`'s context (for a child of a ContainerView)

    The code in Handlebars that overrides the `_context` property first
    checks to see whether the view has a specified controller. This is
    something of a hack and should be revisited.

    @property _context
  */
  _context: Ember.computed(function(key) {
    var parentView, controller;

    if (controller = get(this, 'controller')) {
      return controller;
    }

    parentView = this._parentView;
    if (parentView) {
      return get(parentView, '_context');
    }

    return null;
  }),

  /**
    @private

    If a value that affects template rendering changes, the view should be
    re-rendered to reflect the new value.

    @method _displayPropertyDidChange
  */
  _contextDidChange: Ember.observer(function() {
    this.rerender();
  }, 'context'),

  /**
    If `false`, the view will appear hidden in DOM.

    @property isVisible
    @type Boolean
    @default null
  */
  isVisible: true,

  /**
    @private

    Array of child views. You should never edit this array directly.
    Instead, use `appendChild` and `removeFromParent`.

    @property childViews
    @type Array
    @default []
  */
  childViews: childViewsProperty,

  _childViews: EMPTY_ARRAY,

  // When it's a virtual view, we need to notify the parent that their
  // childViews will change.
  _childViewsWillChange: Ember.beforeObserver(function() {
    if (this.isVirtual) {
      var parentView = get(this, 'parentView');
      if (parentView) { Ember.propertyWillChange(parentView, 'childViews'); }
    }
  }, 'childViews'),

  // When it's a virtual view, we need to notify the parent that their
  // childViews did change.
  _childViewsDidChange: Ember.observer(function() {
    if (this.isVirtual) {
      var parentView = get(this, 'parentView');
      if (parentView) { Ember.propertyDidChange(parentView, 'childViews'); }
    }
  }, 'childViews'),

  /**
    Return the nearest ancestor that is an instance of the provided
    class.

    @property nearestInstanceOf
    @param {Class} klass Subclass of Ember.View (or Ember.View itself)
    @return Ember.View
    @deprecated
  */
  nearestInstanceOf: function(klass) {
    Ember.deprecate("nearestInstanceOf is deprecated and will be removed from future releases. Use nearestOfType.");
    var view = get(this, 'parentView');

    while (view) {
      if(view instanceof klass) { return view; }
      view = get(view, 'parentView');
    }
  },

  /**
    Return the nearest ancestor that is an instance of the provided
    class or mixin.

    @property nearestOfType
    @param {Class,Mixin} klass Subclass of Ember.View (or Ember.View itself),
           or an instance of Ember.Mixin.
    @return Ember.View
  */
  nearestOfType: function(klass) {
    var view = get(this, 'parentView'),
        isOfType = klass instanceof Ember.Mixin ?
                   function(view) { return klass.detect(view); } :
                   function(view) { return klass.detect(view.constructor); };

    while (view) {
      if( isOfType(view) ) { return view; }
      view = get(view, 'parentView');
    }
  },

  /**
    Return the nearest ancestor that has a given property.

    @property nearestWithProperty
    @param {String} property A property name
    @return Ember.View
  */
  nearestWithProperty: function(property) {
    var view = get(this, 'parentView');

    while (view) {
      if (property in view) { return view; }
      view = get(view, 'parentView');
    }
  },

  /**
    Return the nearest ancestor whose parent is an instance of
    `klass`.

    @property nearestChildOf
    @param {Class} klass Subclass of Ember.View (or Ember.View itself)
    @return Ember.View
  */
  nearestChildOf: function(klass) {
    var view = get(this, 'parentView');

    while (view) {
      if(get(view, 'parentView') instanceof klass) { return view; }
      view = get(view, 'parentView');
    }
  },

  /**
    @private

    When the parent view changes, recursively invalidate `controller`

    @method _parentViewDidChange
  */
  _parentViewDidChange: Ember.observer(function() {
    if (this.isDestroying) { return; }

    if (get(this, 'parentView.controller') && !get(this, 'controller')) {
      this.notifyPropertyChange('controller');
    }
  }, '_parentView'),

  _controllerDidChange: Ember.observer(function() {
    if (this.isDestroying) { return; }

    this.rerender();

    this.forEachChildView(function(view) {
      view.propertyDidChange('controller');
    });
  }, 'controller'),

  cloneKeywords: function() {
    var templateData = get(this, 'templateData');

    var keywords = templateData ? Ember.copy(templateData.keywords) : {};
    set(keywords, 'view', get(this, 'concreteView'));
    set(keywords, '_view', this);
    set(keywords, 'controller', get(this, 'controller'));

    return keywords;
  },

  /**
    Called on your view when it should push strings of HTML into a
    `Ember.RenderBuffer`. Most users will want to override the `template`
    or `templateName` properties instead of this method.

    By default, `Ember.View` will look for a function in the `template`
    property and invoke it with the value of `context`. The value of
    `context` will be the view's controller unless you override it.

    @method render
    @param {Ember.RenderBuffer} buffer The render buffer
  */
  render: function(buffer) {
    // If this view has a layout, it is the responsibility of the
    // the layout to render the view's template. Otherwise, render the template
    // directly.
    var template = get(this, 'layout') || get(this, 'template');

    if (template) {
      var context = get(this, 'context');
      var keywords = this.cloneKeywords();
      var output;

      var data = {
        view: this,
        buffer: buffer,
        isRenderData: true,
        keywords: keywords,
        insideGroup: get(this, 'templateData.insideGroup')
      };

      // Invoke the template with the provided template context, which
      // is the view's controller by default. A hash of data is also passed that provides
      // the template with access to the view and render buffer.

      Ember.assert('template must be a function. Did you mean to call Ember.Handlebars.compile("...") or specify templateName instead?', typeof template === 'function');
      // The template should write directly to the render buffer instead
      // of returning a string.
      output = template(context, { data: data });

      // If the template returned a string instead of writing to the buffer,
      // push the string onto the buffer.
      if (output !== undefined) { buffer.push(output); }
    }
  },

  /**
    Renders the view again. This will work regardless of whether the
    view is already in the DOM or not. If the view is in the DOM, the
    rendering process will be deferred to give bindings a chance
    to synchronize.

    If children were added during the rendering process using `appendChild`,
    `rerender` will remove them, because they will be added again
    if needed by the next `render`.

    In general, if the display of your view changes, you should modify
    the DOM element directly instead of manually calling `rerender`, which can
    be slow.

    @method rerender
  */
  rerender: function() {
    return this.currentState.rerender(this);
  },

  clearRenderedChildren: function() {
    var lengthBefore = this.lengthBeforeRender,
        lengthAfter  = this.lengthAfterRender;

    // If there were child views created during the last call to render(),
    // remove them under the assumption that they will be re-created when
    // we re-render.

    // VIEW-TODO: Unit test this path.
    var childViews = this._childViews;
    for (var i=lengthAfter-1; i>=lengthBefore; i--) {
      if (childViews[i]) { childViews[i].destroy(); }
    }
  },

  /**
    @private

    Iterates over the view's `classNameBindings` array, inserts the value
    of the specified property into the `classNames` array, then creates an
    observer to update the view's element if the bound property ever changes
    in the future.

    @method _applyClassNameBindings
  */
  _applyClassNameBindings: function(classBindings) {
    var classNames = this.classNames,
    elem, newClass, dasherizedClass;

    // Loop through all of the configured bindings. These will be either
    // property names ('isUrgent') or property paths relative to the view
    // ('content.isUrgent')
    a_forEach(classBindings, function(binding) {

      // Variable in which the old class value is saved. The observer function
      // closes over this variable, so it knows which string to remove when
      // the property changes.
      var oldClass;
      // Extract just the property name from bindings like 'foo:bar'
      var parsedPath = Ember.View._parsePropertyPath(binding);

      // Set up an observer on the context. If the property changes, toggle the
      // class name.
      var observer = function() {
        // Get the current value of the property
        newClass = this._classStringForProperty(binding);
        elem = this.$();

        // If we had previously added a class to the element, remove it.
        if (oldClass) {
          elem.removeClass(oldClass);
          // Also remove from classNames so that if the view gets rerendered,
          // the class doesn't get added back to the DOM.
          classNames.removeObject(oldClass);
        }

        // If necessary, add a new class. Make sure we keep track of it so
        // it can be removed in the future.
        if (newClass) {
          elem.addClass(newClass);
          oldClass = newClass;
        } else {
          oldClass = null;
        }
      };

      // Get the class name for the property at its current value
      dasherizedClass = this._classStringForProperty(binding);

      if (dasherizedClass) {
        // Ensure that it gets into the classNames array
        // so it is displayed when we render.
        a_addObject(classNames, dasherizedClass);

        // Save a reference to the class name so we can remove it
        // if the observer fires. Remember that this variable has
        // been closed over by the observer.
        oldClass = dasherizedClass;
      }

      this.registerObserver(this, parsedPath.path, observer);
      // Remove className so when the view is rerendered,
      // the className is added based on binding reevaluation
      this.one('willClearRender', function() {
        if (oldClass) {
          classNames.removeObject(oldClass);
          oldClass = null;
        }
      });

    }, this);
  },

  /**
    @private

    Iterates through the view's attribute bindings, sets up observers for each,
    then applies the current value of the attributes to the passed render buffer.

    @method _applyAttributeBindings
    @param {Ember.RenderBuffer} buffer
  */
  _applyAttributeBindings: function(buffer, attributeBindings) {
    var attributeValue, elem, type;

    a_forEach(attributeBindings, function(binding) {
      var split = binding.split(':'),
          property = split[0],
          attributeName = split[1] || property;

      // Create an observer to add/remove/change the attribute if the
      // JavaScript property changes.
      var observer = function() {
        elem = this.$();

        attributeValue = get(this, property);

        Ember.View.applyAttributeBindings(elem, attributeName, attributeValue);
      };

      this.registerObserver(this, property, observer);

      // Determine the current value and add it to the render buffer
      // if necessary.
      attributeValue = get(this, property);
      Ember.View.applyAttributeBindings(buffer, attributeName, attributeValue);
    }, this);
  },

  /**
    @private

    Given a property name, returns a dasherized version of that
    property name if the property evaluates to a non-falsy value.

    For example, if the view has property `isUrgent` that evaluates to true,
    passing `isUrgent` to this method will return `"is-urgent"`.

    @method _classStringForProperty
    @param property
  */
  _classStringForProperty: function(property) {
    var parsedPath = Ember.View._parsePropertyPath(property);
    var path = parsedPath.path;

    var val = get(this, path);
    if (val === undefined && Ember.isGlobalPath(path)) {
      val = get(Ember.lookup, path);
    }

    return Ember.View._classStringForValue(path, val, parsedPath.className, parsedPath.falsyClassName);
  },

  // ..........................................................
  // ELEMENT SUPPORT
  //

  /**
    Returns the current DOM element for the view.

    @property element
    @type DOMElement
  */
  element: Ember.computed(function(key, value) {
    if (value !== undefined) {
      return this.currentState.setElement(this, value);
    } else {
      return this.currentState.getElement(this);
    }
  }).property('_parentView'),

  /**
    Returns a jQuery object for this view's element. If you pass in a selector
    string, this method will return a jQuery object, using the current element
    as its buffer.

    For example, calling `view.$('li')` will return a jQuery object containing
    all of the `li` elements inside the DOM element of this view.

    @property $
    @param {String} [selector] a jQuery-compatible selector string
    @return {jQuery} the CoreQuery object for the DOM node
  */
  $: function(sel) {
    return this.currentState.$(this, sel);
  },

  mutateChildViews: function(callback) {
    var childViews = this._childViews,
        idx = childViews.length,
        view;

    while(--idx >= 0) {
      view = childViews[idx];
      callback.call(this, view, idx);
    }

    return this;
  },

  forEachChildView: function(callback) {
    var childViews = this._childViews;

    if (!childViews) { return this; }

    var len = childViews.length,
        view, idx;

    for(idx = 0; idx < len; idx++) {
      view = childViews[idx];
      callback.call(this, view);
    }

    return this;
  },

  /**
    Appends the view's element to the specified parent element.

    If the view does not have an HTML representation yet, `createElement()`
    will be called automatically.

    Note that this method just schedules the view to be appended; the DOM
    element will not be appended to the given element until all bindings have
    finished synchronizing.

    This is not typically a function that you will need to call directly when
    building your application. You might consider using `Ember.ContainerView`
    instead. If you do need to use `appendTo`, be sure that the target element
    you are providing is associated with an `Ember.Application` and does not
    have an ancestor element that is associated with an Ember view.

    @method appendTo
    @param {String|DOMElement|jQuery} A selector, element, HTML string, or jQuery object
    @return {Ember.View} receiver
  */
  appendTo: function(target) {
    // Schedule the DOM element to be created and appended to the given
    // element after bindings have synchronized.
    this._insertElementLater(function() {
      Ember.assert("You cannot append to an existing Ember.View. Consider using Ember.ContainerView instead.", !Ember.$(target).is('.ember-view') && !Ember.$(target).parents().is('.ember-view'));
      this.$().appendTo(target);
    });

    return this;
  },

  /**
    Replaces the content of the specified parent element with this view's
    element. If the view does not have an HTML representation yet,
    `createElement()` will be called automatically.

    Note that this method just schedules the view to be appended; the DOM
    element will not be appended to the given element until all bindings have
    finished synchronizing

    @method replaceIn
    @param {String|DOMElement|jQuery} A selector, element, HTML string, or jQuery object
    @return {Ember.View} received
  */
  replaceIn: function(target) {
    Ember.assert("You cannot replace an existing Ember.View. Consider using Ember.ContainerView instead.", !Ember.$(target).is('.ember-view') && !Ember.$(target).parents().is('.ember-view'));

    this._insertElementLater(function() {
      Ember.$(target).empty();
      this.$().appendTo(target);
    });

    return this;
  },

  /**
    @private

    Schedules a DOM operation to occur during the next render phase. This
    ensures that all bindings have finished synchronizing before the view is
    rendered.

    To use, pass a function that performs a DOM operation.

    Before your function is called, this view and all child views will receive
    the `willInsertElement` event. After your function is invoked, this view
    and all of its child views will receive the `didInsertElement` event.

    ```javascript
    view._insertElementLater(function() {
      this.createElement();
      this.$().appendTo('body');
    });
    ```

    @method _insertElementLater
    @param {Function} fn the function that inserts the element into the DOM
  */
  _insertElementLater: function(fn) {
    this._scheduledInsert = Ember.run.scheduleOnce('render', this, '_insertElement', fn);
  },

  _insertElement: function (fn) {
    this._scheduledInsert = null;
    this.currentState.insertElement(this, fn);
  },

  /**
    Appends the view's element to the document body. If the view does
    not have an HTML representation yet, `createElement()` will be called
    automatically.

    If your application uses the `rootElement` property, you must append
    the view within that element. Rendering views outside of the `rootElement`
    is not supported.

    Note that this method just schedules the view to be appended; the DOM
    element will not be appended to the document body until all bindings have
    finished synchronizing.

    @method append
    @return {Ember.View} receiver
  */
  append: function() {
    return this.appendTo(document.body);
  },

  /**
    Removes the view's element from the element to which it is attached.

    @method remove
    @return {Ember.View} receiver
  */
  remove: function() {
    // What we should really do here is wait until the end of the run loop
    // to determine if the element has been re-appended to a different
    // element.
    // In the interim, we will just re-render if that happens. It is more
    // important than elements get garbage collected.
    if (!this.removedFromDOM) { this.destroyElement(); }
    this.invokeRecursively(function(view) {
      if (view.clearRenderedChildren) { view.clearRenderedChildren(); }
    });
  },

  elementId: null,

  /**
    Attempts to discover the element in the parent element. The default
    implementation looks for an element with an ID of `elementId` (or the
    view's guid if `elementId` is null). You can override this method to
    provide your own form of lookup. For example, if you want to discover your
    element using a CSS class name instead of an ID.

    @method findElementInParentElement
    @param {DOMElement} parentElement The parent's DOM element
    @return {DOMElement} The discovered element
  */
  findElementInParentElement: function(parentElem) {
    var id = "#" + this.elementId;
    return Ember.$(id)[0] || Ember.$(id, parentElem)[0];
  },

  /**
    Creates a DOM representation of the view and all of its
    child views by recursively calling the `render()` method.

    After the element has been created, `didInsertElement` will
    be called on this view and all of its child views.

    @method createElement
    @return {Ember.View} receiver
  */
  createElement: function() {
    if (get(this, 'element')) { return this; }

    var buffer = this.renderToBuffer();
    set(this, 'element', buffer.element());

    return this;
  },

  /**
    Called when a view is going to insert an element into the DOM.

    @event willInsertElement
  */
  willInsertElement: Ember.K,

  /**
    Called when the element of the view has been inserted into the DOM
    or after the view was re-rendered. Override this function to do any
    set up that requires an element in the document body.

    @event didInsertElement
  */
  didInsertElement: Ember.K,

  /**
    Called when the view is about to rerender, but before anything has
    been torn down. This is a good opportunity to tear down any manual
    observers you have installed based on the DOM state

    @event willClearRender
  */
  willClearRender: Ember.K,

  /**
    @private

    Run this callback on the current view and recursively on child views.

    @method invokeRecursively
    @param fn {Function}
  */
  invokeRecursively: function(fn) {
    var childViews = [this], currentViews, view;

    while (childViews.length) {
      currentViews = childViews.slice();
      childViews = [];

      for (var i=0, l=currentViews.length; i<l; i++) {
        view = currentViews[i];
        fn.call(view, view);
        if (view._childViews) {
          childViews.push.apply(childViews, view._childViews);
        }
      }
    }
  },

  triggerRecursively: function(eventName) {
    var childViews = [this], currentViews, view;

    while (childViews.length) {
      currentViews = childViews.slice();
      childViews = [];

      for (var i=0, l=currentViews.length; i<l; i++) {
        view = currentViews[i];
        if (view.trigger) { view.trigger(eventName); }
        if (view._childViews) {
          childViews.push.apply(childViews, view._childViews);
        }
      }
    }
  },

  viewHierarchyCollection: function() {
    var currentView, viewCollection = new ViewCollection([this]);

    for (var i = 0; i < viewCollection.length; i++) {
      currentView = viewCollection.objectAt(i);
      if (currentView._childViews) {
        viewCollection.push.apply(viewCollection, currentView._childViews);
      }
    }

    return viewCollection;
  },

  /**
    Destroys any existing element along with the element for any child views
    as well. If the view does not currently have a element, then this method
    will do nothing.

    If you implement `willDestroyElement()` on your view, then this method will
    be invoked on your view before your element is destroyed to give you a
    chance to clean up any event handlers, etc.

    If you write a `willDestroyElement()` handler, you can assume that your
    `didInsertElement()` handler was called earlier for the same element.

    Normally you will not call or override this method yourself, but you may
    want to implement the above callbacks when it is run.

    @method destroyElement
    @return {Ember.View} receiver
  */
  destroyElement: function() {
    return this.currentState.destroyElement(this);
  },

  /**
    Called when the element of the view is going to be destroyed. Override
    this function to do any teardown that requires an element, like removing
    event listeners.

    @event willDestroyElement
  */
  willDestroyElement: function() {},

  /**
    @private

    Triggers the `willDestroyElement` event (which invokes the
    `willDestroyElement()` method if it exists) on this view and all child
    views.

    Before triggering `willDestroyElement`, it first triggers the
    `willClearRender` event recursively.

    @method _notifyWillDestroyElement
  */
  _notifyWillDestroyElement: function() {
    var viewCollection = this.viewHierarchyCollection();
    viewCollection.trigger('willClearRender');
    viewCollection.trigger('willDestroyElement');
    return viewCollection;
  },

  _elementWillChange: Ember.beforeObserver(function() {
    this.forEachChildView(function(view) {
      Ember.propertyWillChange(view, 'element');
    });
  }, 'element'),

  /**
    @private

    If this view's element changes, we need to invalidate the caches of our
    child views so that we do not retain references to DOM elements that are
    no longer needed.

    @method _elementDidChange
  */
  _elementDidChange: Ember.observer(function() {
    this.forEachChildView(function(view) {
      Ember.propertyDidChange(view, 'element');
    });
  }, 'element'),

  /**
    Called when the parentView property has changed.

    @event parentViewDidChange
  */
  parentViewDidChange: Ember.K,

  instrumentName: 'view',

  instrumentDetails: function(hash) {
    hash.template = get(this, 'templateName');
    this._super(hash);
  },

  _renderToBuffer: function(parentBuffer, bufferOperation) {
    this.lengthBeforeRender = this._childViews.length;
    var buffer = this._super(parentBuffer, bufferOperation);
    this.lengthAfterRender = this._childViews.length;

    return buffer;
  },

  renderToBufferIfNeeded: function (buffer) {
    return this.currentState.renderToBufferIfNeeded(this, buffer);
  },

  beforeRender: function(buffer) {
    this.applyAttributesToBuffer(buffer);
    buffer.pushOpeningTag();
  },

  afterRender: function(buffer) {
    buffer.pushClosingTag();
  },

  applyAttributesToBuffer: function(buffer) {
    // Creates observers for all registered class name and attribute bindings,
    // then adds them to the element.
    var classNameBindings = get(this, 'classNameBindings');
    if (classNameBindings.length) {
      this._applyClassNameBindings(classNameBindings);
    }

    // Pass the render buffer so the method can apply attributes directly.
    // This isn't needed for class name bindings because they use the
    // existing classNames infrastructure.
    var attributeBindings = get(this, 'attributeBindings');
    if (attributeBindings.length) {
      this._applyAttributeBindings(buffer, attributeBindings);
    }

    buffer.setClasses(this.classNames);
    buffer.id(this.elementId);

    var role = get(this, 'ariaRole');
    if (role) {
      buffer.attr('role', role);
    }

    if (get(this, 'isVisible') === false) {
      buffer.style('display', 'none');
    }
  },

  // ..........................................................
  // STANDARD RENDER PROPERTIES
  //

  /**
    Tag name for the view's outer element. The tag name is only used when an
    element is first created. If you change the `tagName` for an element, you
    must destroy and recreate the view element.

    By default, the render buffer will use a `<div>` tag for views.

    @property tagName
    @type String
    @default null
  */

  // We leave this null by default so we can tell the difference between
  // the default case and a user-specified tag.
  tagName: null,

  /**
    The WAI-ARIA role of the control represented by this view. For example, a
    button may have a role of type 'button', or a pane may have a role of
    type 'alertdialog'. This property is used by assistive software to help
    visually challenged users navigate rich web applications.

    The full list of valid WAI-ARIA roles is available at:
    http://www.w3.org/TR/wai-aria/roles#roles_categorization

    @property ariaRole
    @type String
    @default null
  */
  ariaRole: null,

  /**
    Standard CSS class names to apply to the view's outer element. This
    property automatically inherits any class names defined by the view's
    superclasses as well.

    @property classNames
    @type Array
    @default ['ember-view']
  */
  classNames: ['ember-view'],

  /**
    A list of properties of the view to apply as class names. If the property
    is a string value, the value of that string will be applied as a class
    name.

    ```javascript
    // Applies the 'high' class to the view element
    Ember.View.create({
      classNameBindings: ['priority']
      priority: 'high'
    });
    ```

    If the value of the property is a Boolean, the name of that property is
    added as a dasherized class name.

    ```javascript
    // Applies the 'is-urgent' class to the view element
    Ember.View.create({
      classNameBindings: ['isUrgent']
      isUrgent: true
    });
    ```

    If you would prefer to use a custom value instead of the dasherized
    property name, you can pass a binding like this:

    ```javascript
    // Applies the 'urgent' class to the view element
    Ember.View.create({
      classNameBindings: ['isUrgent:urgent']
      isUrgent: true
    });
    ```

    This list of properties is inherited from the view's superclasses as well.

    @property classNameBindings
    @type Array
    @default []
  */
  classNameBindings: EMPTY_ARRAY,

  /**
    A list of properties of the view to apply as attributes. If the property is
    a string value, the value of that string will be applied as the attribute.

    ```javascript
    // Applies the type attribute to the element
    // with the value "button", like <div type="button">
    Ember.View.create({
      attributeBindings: ['type'],
      type: 'button'
    });
    ```

    If the value of the property is a Boolean, the name of that property is
    added as an attribute.

    ```javascript
    // Renders something like <div enabled="enabled">
    Ember.View.create({
      attributeBindings: ['enabled'],
      enabled: true
    });
    ```

    @property attributeBindings
  */
  attributeBindings: EMPTY_ARRAY,

  // .......................................................
  // CORE DISPLAY METHODS
  //

  /**
    @private

    Setup a view, but do not finish waking it up.
    - configure `childViews`
    - register the view with the global views hash, which is used for event
      dispatch

    @method init
  */
  init: function() {
    this.elementId = this.elementId || guidFor(this);

    this._super();

    // setup child views. be sure to clone the child views array first
    this._childViews = this._childViews.slice();

    Ember.assert("Only arrays are allowed for 'classNameBindings'", Ember.typeOf(this.classNameBindings) === 'array');
    this.classNameBindings = Ember.A(this.classNameBindings.slice());

    Ember.assert("Only arrays are allowed for 'classNames'", Ember.typeOf(this.classNames) === 'array');
    this.classNames = Ember.A(this.classNames.slice());

    var viewController = get(this, 'viewController');
    if (viewController) {
      viewController = get(viewController);
      if (viewController) {
        set(viewController, 'view', this);
      }
    }
  },

  appendChild: function(view, options) {
    return this.currentState.appendChild(this, view, options);
  },

  /**
    Removes the child view from the parent view.

    @method removeChild
    @param {Ember.View} view
    @return {Ember.View} receiver
  */
  removeChild: function(view) {
    // If we're destroying, the entire subtree will be
    // freed, and the DOM will be handled separately,
    // so no need to mess with childViews.
    if (this.isDestroying) { return; }

    // update parent node
    set(view, '_parentView', null);

    // remove view from childViews array.
    var childViews = this._childViews;

    Ember.EnumerableUtils.removeObject(childViews, view);

    this.propertyDidChange('childViews'); // HUH?! what happened to will change?

    return this;
  },

  /**
    Removes all children from the `parentView`.

    @method removeAllChildren
    @return {Ember.View} receiver
  */
  removeAllChildren: function() {
    return this.mutateChildViews(function(view) {
      this.removeChild(view);
    });
  },

  destroyAllChildren: function() {
    return this.mutateChildViews(function(view) {
      view.destroy();
    });
  },

  /**
    Removes the view from its `parentView`, if one is found. Otherwise
    does nothing.

    @method removeFromParent
    @return {Ember.View} receiver
  */
  removeFromParent: function() {
    var parent = this._parentView;

    // Remove DOM element from parent
    this.remove();

    if (parent) { parent.removeChild(this); }
    return this;
  },

  /**
    You must call `destroy` on a view to destroy the view (and all of its
    child views). This will remove the view from any parent node, then make
    sure that the DOM element managed by the view can be released by the
    memory manager.

    @method destroy
  */
  destroy: function() {
    var childViews = this._childViews,
        parent = this._parentView,
        // get parentView before calling super because it'll be destroyed
        nonVirtualParentView = get(this, 'parentView'),
        viewName = this.viewName,
        childLen, i;

    if (!this._super()) { return; }

    childLen = childViews.length;
    for (i=childLen-1; i>=0; i--) {
      childViews[i].removedFromDOM = true;
    }

    // remove from non-virtual parent view if viewName was specified
    if (viewName && nonVirtualParentView) {
      nonVirtualParentView[viewName] = null;
    }

    childLen = childViews.length;
    for (i=childLen-1; i>=0; i--) {
      childViews[i].destroy();
    }

    return this;
  },

  /**
    Instantiates a view to be added to the childViews array during view
    initialization. You generally will not call this method directly unless
    you are overriding `createChildViews()`. Note that this method will
    automatically configure the correct settings on the new view instance to
    act as a child of the parent.

    @method createChildView
    @param {Class} viewClass
    @param {Hash} [attrs] Attributes to add
    @return {Ember.View} new instance
  */
  createChildView: function(view, attrs) {
    if (view.isView && view._parentView === this) { return view; }

    if (Ember.CoreView.detect(view)) {
      attrs = attrs || {};
      attrs._parentView = this;
      attrs.templateData = attrs.templateData || get(this, 'templateData');

      view = view.create(attrs);

      // don't set the property on a virtual view, as they are invisible to
      // consumers of the view API
      if (view.viewName) { set(get(this, 'concreteView'), view.viewName, view); }
    } else {
      Ember.assert('You must pass instance or subclass of View', view.isView);

      if (attrs) {
        view.setProperties(attrs);
      }

      if (!get(view, 'templateData')) {
        set(view, 'templateData', get(this, 'templateData'));
      }

      set(view, '_parentView', this);
    }

    return view;
  },

  becameVisible: Ember.K,
  becameHidden: Ember.K,

  /**
    @private

    When the view's `isVisible` property changes, toggle the visibility
    element of the actual DOM element.

    @method _isVisibleDidChange
  */
  _isVisibleDidChange: Ember.observer(function() {
    var $el = this.$();
    if (!$el) { return; }

    var isVisible = get(this, 'isVisible');

    $el.toggle(isVisible);

    if (this._isAncestorHidden()) { return; }

    if (isVisible) {
      this._notifyBecameVisible();
    } else {
      this._notifyBecameHidden();
    }
  }, 'isVisible'),

  _notifyBecameVisible: function() {
    this.trigger('becameVisible');

    this.forEachChildView(function(view) {
      var isVisible = get(view, 'isVisible');

      if (isVisible || isVisible === null) {
        view._notifyBecameVisible();
      }
    });
  },

  _notifyBecameHidden: function() {
    this.trigger('becameHidden');
    this.forEachChildView(function(view) {
      var isVisible = get(view, 'isVisible');

      if (isVisible || isVisible === null) {
        view._notifyBecameHidden();
      }
    });
  },

  _isAncestorHidden: function() {
    var parent = get(this, 'parentView');

    while (parent) {
      if (get(parent, 'isVisible') === false) { return true; }

      parent = get(parent, 'parentView');
    }

    return false;
  },

  clearBuffer: function() {
    this.invokeRecursively(function(view) {
      view.buffer = null;
    });
  },

  transitionTo: function(state, children) {
    var priorState = this.currentState,
        currentState = this.currentState = this.states[state];
    this.state = state;

    if (priorState && priorState.exit) { priorState.exit(this); }
    if (currentState.enter) { currentState.enter(this); }

    if (children !== false) {
      this.forEachChildView(function(view) {
        view.transitionTo(state);
      });
    }
  },

  // .......................................................
  // EVENT HANDLING
  //

  /**
    @private

    Handle events from `Ember.EventDispatcher`

    @method handleEvent
    @param eventName {String}
    @param evt {Event}
  */
  handleEvent: function(eventName, evt) {
    return this.currentState.handleEvent(this, eventName, evt);
  },

  registerObserver: function(root, path, target, observer) {
    if (!observer && 'function' === typeof target) {
      observer = target;
      target = null;
    }

    var view = this,
        stateCheckedObserver = function(){
          view.currentState.invokeObserver(this, observer);
        },
        scheduledObserver = function() {
          Ember.run.scheduleOnce('render', this, stateCheckedObserver);
        };

    Ember.addObserver(root, path, target, scheduledObserver);

    this.one('willClearRender', function() {
      Ember.removeObserver(root, path, target, scheduledObserver);
    });
  }

});

/*
  Describe how the specified actions should behave in the various
  states that a view can exist in. Possible states:

  * preRender: when a view is first instantiated, and after its
    element was destroyed, it is in the preRender state
  * inBuffer: once a view has been rendered, but before it has
    been inserted into the DOM, it is in the inBuffer state
  * inDOM: once a view has been inserted into the DOM it is in
    the inDOM state. A view spends the vast majority of its
    existence in this state.
  * destroyed: once a view has been destroyed (using the destroy
    method), it is in this state. No further actions can be invoked
    on a destroyed view.
*/

  // in the destroyed state, everything is illegal

  // before rendering has begun, all legal manipulations are noops.

  // inside the buffer, legal manipulations are done on the buffer

  // once the view has been inserted into the DOM, legal manipulations
  // are done on the DOM element.

function notifyMutationListeners() {
  Ember.run.once(Ember.View, 'notifyMutationListeners');
}

var DOMManager = {
  prepend: function(view, html) {
    view.$().prepend(html);
    notifyMutationListeners();
  },

  after: function(view, html) {
    view.$().after(html);
    notifyMutationListeners();
  },

  html: function(view, html) {
    view.$().html(html);
    notifyMutationListeners();
  },

  replace: function(view) {
    var element = get(view, 'element');

    set(view, 'element', null);

    view._insertElementLater(function() {
      Ember.$(element).replaceWith(get(view, 'element'));
      notifyMutationListeners();
    });
  },

  remove: function(view) {
    view.$().remove();
    notifyMutationListeners();
  },

  empty: function(view) {
    view.$().empty();
    notifyMutationListeners();
  }
};

Ember.View.reopen({
  domManager: DOMManager
});

Ember.View.reopenClass({

  /**
    @private

    Parse a path and return an object which holds the parsed properties.

    For example a path like "content.isEnabled:enabled:disabled" wil return the
    following object:

    ```javascript
    {
      path: "content.isEnabled",
      className: "enabled",
      falsyClassName: "disabled",
      classNames: ":enabled:disabled"
    }
    ```

    @method _parsePropertyPath
    @static
  */
  _parsePropertyPath: function(path) {
    var split = path.split(':'),
        propertyPath = split[0],
        classNames = "",
        className,
        falsyClassName;

    // check if the property is defined as prop:class or prop:trueClass:falseClass
    if (split.length > 1) {
      className = split[1];
      if (split.length === 3) { falsyClassName = split[2]; }

      classNames = ':' + className;
      if (falsyClassName) { classNames += ":" + falsyClassName; }
    }

    return {
      path: propertyPath,
      classNames: classNames,
      className: (className === '') ? undefined : className,
      falsyClassName: falsyClassName
    };
  },

  /**
    @private

    Get the class name for a given value, based on the path, optional
    `className` and optional `falsyClassName`.

    - if a `className` or `falsyClassName` has been specified:
      - if the value is truthy and `className` has been specified,
        `className` is returned
      - if the value is falsy and `falsyClassName` has been specified,
        `falsyClassName` is returned
      - otherwise `null` is returned
    - if the value is `true`, the dasherized last part of the supplied path
      is returned
    - if the value is not `false`, `undefined` or `null`, the `value`
      is returned
    - if none of the above rules apply, `null` is returned

    @method _classStringForValue
    @param path
    @param val
    @param className
    @param falsyClassName
    @static
  */
  _classStringForValue: function(path, val, className, falsyClassName) {
    // When using the colon syntax, evaluate the truthiness or falsiness
    // of the value to determine which className to return
    if (className || falsyClassName) {
      if (className && !!val) {
        return className;

      } else if (falsyClassName && !val) {
        return falsyClassName;

      } else {
        return null;
      }

    // If value is a Boolean and true, return the dasherized property
    // name.
    } else if (val === true) {
      // Normalize property path to be suitable for use
      // as a class name. For exaple, content.foo.barBaz
      // becomes bar-baz.
      var parts = path.split('.');
      return Ember.String.dasherize(parts[parts.length-1]);

    // If the value is not false, undefined, or null, return the current
    // value of the property.
    } else if (val !== false && val !== undefined && val !== null) {
      return val;

    // Nothing to display. Return null so that the old class is removed
    // but no new class is added.
    } else {
      return null;
    }
  }
});

var mutation = Ember.Object.extend(Ember.Evented).create();

Ember.View.addMutationListener = function(callback) {
  mutation.on('change', callback);
};

Ember.View.removeMutationListener = function(callback) {
  mutation.off('change', callback);
};

Ember.View.notifyMutationListeners = function() {
  mutation.trigger('change');
};

/**
  Global views hash

  @property views
  @static
  @type Hash
*/
Ember.View.views = {};

// If someone overrides the child views computed property when
// defining their class, we want to be able to process the user's
// supplied childViews and then restore the original computed property
// at view initialization time. This happens in Ember.ContainerView's init
// method.
Ember.View.childViewsProperty = childViewsProperty;

Ember.View.applyAttributeBindings = function(elem, name, value) {
  var type = Ember.typeOf(value);

  // if this changes, also change the logic in ember-handlebars/lib/helpers/binding.js
  if (name !== 'value' && (type === 'string' || (type === 'number' && !isNaN(value)))) {
    if (value !== elem.attr(name)) {
      elem.attr(name, value);
    }
  } else if (name === 'value' || type === 'boolean') {
    // We can't set properties to undefined
    if (value === undefined) { value = null; }

    if (value !== elem.prop(name)) {
      // value and booleans should always be properties
      elem.prop(name, value);
    }
  } else if (!value) {
    elem.removeAttr(name);
  }
};

Ember.View.states = states;

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;

Ember.View.states._default = {
  // appendChild is only legal while rendering the buffer.
  appendChild: function() {
    throw "You can't use appendChild outside of the rendering process";
  },

  $: function() {
    return undefined;
  },

  getElement: function() {
    return null;
  },

  // Handle events from `Ember.EventDispatcher`
  handleEvent: function() {
    return true; // continue event propagation
  },

  destroyElement: function(view) {
    set(view, 'element', null);
    if (view._scheduledInsert) {
      Ember.run.cancel(view._scheduledInsert);
      view._scheduledInsert = null;
    }
    return view;
  },

  renderToBufferIfNeeded: function () {
    return false;
  },

  rerender: Ember.K,
  invokeObserver: Ember.K
};

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var preRender = Ember.View.states.preRender = Ember.create(Ember.View.states._default);

Ember.merge(preRender, {
  // a view leaves the preRender state once its element has been
  // created (createElement).
  insertElement: function(view, fn) {
    view.createElement();
    var viewCollection = view.viewHierarchyCollection();

    viewCollection.trigger('willInsertElement');
    // after createElement, the view will be in the hasElement state.
    fn.call(view);
    viewCollection.transitionTo('inDOM', false);
    viewCollection.trigger('didInsertElement');
  },

  renderToBufferIfNeeded: function(view, buffer) {
    view.renderToBuffer(buffer);
    return true;
  },

  empty: Ember.K,

  setElement: function(view, value) {
    if (value !== null) {
      view.transitionTo('hasElement');
    }
    return value;
  }
});

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;

var inBuffer = Ember.View.states.inBuffer = Ember.create(Ember.View.states._default);

Ember.merge(inBuffer, {
  $: function(view, sel) {
    // if we don't have an element yet, someone calling this.$() is
    // trying to update an element that isn't in the DOM. Instead,
    // rerender the view to allow the render method to reflect the
    // changes.
    view.rerender();
    return Ember.$();
  },

  // when a view is rendered in a buffer, rerendering it simply
  // replaces the existing buffer with a new one
  rerender: function(view) {
    throw new Ember.Error("Something you did caused a view to re-render after it rendered but before it was inserted into the DOM.");
  },

  // when a view is rendered in a buffer, appending a child
  // view will render that view and append the resulting
  // buffer into its buffer.
  appendChild: function(view, childView, options) {
    var buffer = view.buffer, _childViews = view._childViews;

    childView = view.createChildView(childView, options);
    if (!_childViews.length) { _childViews = view._childViews = _childViews.slice(); }
    _childViews.push(childView);

    childView.renderToBuffer(buffer);

    view.propertyDidChange('childViews');

    return childView;
  },

  // when a view is rendered in a buffer, destroying the
  // element will simply destroy the buffer and put the
  // state back into the preRender state.
  destroyElement: function(view) {
    view.clearBuffer();
    var viewCollection = view._notifyWillDestroyElement();
    viewCollection.transitionTo('preRender', false);

    return view;
  },

  empty: function() {
    Ember.assert("Emptying a view in the inBuffer state is not allowed and should not happen under normal circumstances. Most likely there is a bug in your application. This may be due to excessive property change notifications.");
  },

  renderToBufferIfNeeded: function (view, buffer) {
    return false;
  },

  // It should be impossible for a rendered view to be scheduled for
  // insertion.
  insertElement: function() {
    throw "You can't insert an element that has already been rendered";
  },

  setElement: function(view, value) {
    if (value === null) {
      view.transitionTo('preRender');
    } else {
      view.clearBuffer();
      view.transitionTo('hasElement');
    }

    return value;
  },

  invokeObserver: function(target, observer) {
    observer.call(target);
  }
});


})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;

var hasElement = Ember.View.states.hasElement = Ember.create(Ember.View.states._default);

Ember.merge(hasElement, {
  $: function(view, sel) {
    var elem = get(view, 'element');
    return sel ? Ember.$(sel, elem) : Ember.$(elem);
  },

  getElement: function(view) {
    var parent = get(view, 'parentView');
    if (parent) { parent = get(parent, 'element'); }
    if (parent) { return view.findElementInParentElement(parent); }
    return Ember.$("#" + get(view, 'elementId'))[0];
  },

  setElement: function(view, value) {
    if (value === null) {
      view.transitionTo('preRender');
    } else {
      throw "You cannot set an element to a non-null value when the element is already in the DOM.";
    }

    return value;
  },

  // once the view has been inserted into the DOM, rerendering is
  // deferred to allow bindings to synchronize.
  rerender: function(view) {
    view.triggerRecursively('willClearRender');

    view.clearRenderedChildren();

    view.domManager.replace(view);
    return view;
  },

  // once the view is already in the DOM, destroying it removes it
  // from the DOM, nukes its element, and puts it back into the
  // preRender state if inDOM.

  destroyElement: function(view) {
    view._notifyWillDestroyElement();
    view.domManager.remove(view);
    set(view, 'element', null);
    if (view._scheduledInsert) {
      Ember.run.cancel(view._scheduledInsert);
      view._scheduledInsert = null;
    }
    return view;
  },

  empty: function(view) {
    var _childViews = view._childViews, len, idx;
    if (_childViews) {
      len = _childViews.length;
      for (idx = 0; idx < len; idx++) {
        _childViews[idx]._notifyWillDestroyElement();
      }
    }
    view.domManager.empty(view);
  },

  // Handle events from `Ember.EventDispatcher`
  handleEvent: function(view, eventName, evt) {
    if (view.has(eventName)) {
      // Handler should be able to re-dispatch events, so we don't
      // preventDefault or stopPropagation.
      return view.trigger(eventName, evt);
    } else {
      return true; // continue event propagation
    }
  },

  invokeObserver: function(target, observer) {
    observer.call(target);
  }
});

var inDOM = Ember.View.states.inDOM = Ember.create(hasElement);

Ember.merge(inDOM, {
  enter: function(view) {
    // Register the view for event handling. This hash is used by
    // Ember.EventDispatcher to dispatch incoming events.
    if (!view.isVirtual) {
      Ember.assert("Attempted to register a view with an id already in use: "+view.elementId, !Ember.View.views[view.elementId]);
      Ember.View.views[view.elementId] = view;
    }

    view.addBeforeObserver('elementId', function() {
      throw new Error("Changing a view's elementId after creation is not allowed");
    });
  },

  exit: function(view) {
    if (!this.isVirtual) delete Ember.View.views[view.elementId];
  },

  insertElement: function(view, fn) {
    throw "You can't insert an element into the DOM that has already been inserted";
  }
});

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var destroyingError = "You can't call %@ on a view being destroyed", fmt = Ember.String.fmt;

var destroying = Ember.View.states.destroying = Ember.create(Ember.View.states._default);

Ember.merge(destroying, {
  appendChild: function() {
    throw fmt(destroyingError, ['appendChild']);
  },
  rerender: function() {
    throw fmt(destroyingError, ['rerender']);
  },
  destroyElement: function() {
    throw fmt(destroyingError, ['destroyElement']);
  },
  empty: function() {
    throw fmt(destroyingError, ['empty']);
  },

  setElement: function() {
    throw fmt(destroyingError, ["set('element', ...)"]);
  },

  renderToBufferIfNeeded: function() {
    return false;
  },

  // Since element insertion is scheduled, don't do anything if
  // the view has been destroyed between scheduling and execution
  insertElement: Ember.K
});


})();



(function() {
Ember.View.cloneStates = function(from) {
  var into = {};

  into._default = {};
  into.preRender = Ember.create(into._default);
  into.destroying = Ember.create(into._default);
  into.inBuffer = Ember.create(into._default);
  into.hasElement = Ember.create(into._default);
  into.inDOM = Ember.create(into.hasElement);

  for (var stateName in from) {
    if (!from.hasOwnProperty(stateName)) { continue; }
    Ember.merge(into[stateName], from[stateName]);
  }

  return into;
};

})();



(function() {
var states = Ember.View.cloneStates(Ember.View.states);

/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set;
var forEach = Ember.EnumerableUtils.forEach;
var ViewCollection = Ember._ViewCollection;

/**
  A `ContainerView` is an `Ember.View` subclass that implements `Ember.MutableArray`
  allowing programatic management of its child views.

  ## Setting Initial Child Views

  The initial array of child views can be set in one of two ways. You can
  provide a `childViews` property at creation time that contains instance of
  `Ember.View`:

  ```javascript
  aContainer = Ember.ContainerView.create({
    childViews: [Ember.View.create(), Ember.View.create()]
  });
  ```

  You can also provide a list of property names whose values are instances of
  `Ember.View`:

  ```javascript
  aContainer = Ember.ContainerView.create({
    childViews: ['aView', 'bView', 'cView'],
    aView: Ember.View.create(),
    bView: Ember.View.create(),
    cView: Ember.View.create()
  });
  ```

  The two strategies can be combined:

  ```javascript
  aContainer = Ember.ContainerView.create({
    childViews: ['aView', Ember.View.create()],
    aView: Ember.View.create()
  });
  ```

  Each child view's rendering will be inserted into the container's rendered
  HTML in the same order as its position in the `childViews` property.

  ## Adding and Removing Child Views

  The container view implements `Ember.MutableArray` allowing programatic management of its child views.

  To remove a view, pass that view into a `removeObject` call on the container view.

  Given an empty `<body>` the following code

  ```javascript
  aContainer = Ember.ContainerView.create({
    classNames: ['the-container'],
    childViews: ['aView', 'bView'],
    aView: Ember.View.create({
      template: Ember.Handlebars.compile("A")
    }),
    bView: Ember.View.create({
      template: Ember.Handlebars.compile("B")
    })
  });

  aContainer.appendTo('body');
  ```

  Results in the HTML

  ```html
  <div class="ember-view the-container">
    <div class="ember-view">A</div>
    <div class="ember-view">B</div>
  </div>
  ```

  Removing a view

  ```javascript
  aContainer.toArray();  // [aContainer.aView, aContainer.bView]
  aContainer.removeObject(aContainer.get('bView'));
  aContainer.toArray();  // [aContainer.aView]
  ```

  Will result in the following HTML

  ```html
  <div class="ember-view the-container">
    <div class="ember-view">A</div>
  </div>
  ```

  Similarly, adding a child view is accomplished by adding `Ember.View` instances to the
  container view.

  Given an empty `<body>` the following code

  ```javascript
  aContainer = Ember.ContainerView.create({
    classNames: ['the-container'],
    childViews: ['aView', 'bView'],
    aView: Ember.View.create({
      template: Ember.Handlebars.compile("A")
    }),
    bView: Ember.View.create({
      template: Ember.Handlebars.compile("B")
    })
  });

  aContainer.appendTo('body');
  ```

  Results in the HTML

  ```html
  <div class="ember-view the-container">
    <div class="ember-view">A</div>
    <div class="ember-view">B</div>
  </div>
  ```

  Adding a view

  ```javascript
  AnotherViewClass = Ember.View.extend({
    template: Ember.Handlebars.compile("Another view")
  });

  aContainer.toArray();  // [aContainer.aView, aContainer.bView]
  aContainer.pushObject(AnotherViewClass.create());
  aContainer.toArray(); // [aContainer.aView, aContainer.bView, <AnotherViewClass instance>]
  ```

  Will result in the following HTML

  ```html
  <div class="ember-view the-container">
    <div class="ember-view">A</div>
    <div class="ember-view">B</div>
    <div class="ember-view">Another view</div>
  </div>
  ```

  ## Templates and Layout

  A `template`, `templateName`, `defaultTemplate`, `layout`, `layoutName` or
  `defaultLayout` property on a container view will not result in the template
  or layout being rendered. The HTML contents of a `Ember.ContainerView`'s DOM
  representation will only be the rendered HTML of its child views.

  ## Binding a View to Display

  If you would like to display a single view in your ContainerView, you can set
  its `currentView` property. When the `currentView` property is set to a view
  instance, it will be added to the ContainerView. If the `currentView` property
  is later changed to a different view, the new view will replace the old view.
  If `currentView` is set to `null`, the last `currentView` will be removed.

  This functionality is useful for cases where you want to bind the display of
  a ContainerView to a controller or state manager. For example, you can bind
  the `currentView` of a container to a controller like this:

  ```javascript
  App.appController = Ember.Object.create({
    view: Ember.View.create({
      templateName: 'person_template'
    })
  });
  ```

  ```handlebars
  {{view Ember.ContainerView currentViewBinding="App.appController.view"}}
  ```

  @class ContainerView
  @namespace Ember
  @extends Ember.View
*/
Ember.ContainerView = Ember.View.extend(Ember.MutableArray, {
  states: states,

  init: function() {
    this._super();

    var childViews = get(this, 'childViews');

    // redefine view's childViews property that was obliterated
    Ember.defineProperty(this, 'childViews', Ember.View.childViewsProperty);

    var _childViews = this._childViews;

    forEach(childViews, function(viewName, idx) {
      var view;

      if ('string' === typeof viewName) {
        view = get(this, viewName);
        view = this.createChildView(view);
        set(this, viewName, view);
      } else {
        view = this.createChildView(viewName);
      }

      _childViews[idx] = view;
    }, this);

    var currentView = get(this, 'currentView');
    if (currentView) {
      if (!_childViews.length) { _childViews = this._childViews = this._childViews.slice(); }
      _childViews.push(this.createChildView(currentView));
    }
  },

  replace: function(idx, removedCount, addedViews) {
    var addedCount = addedViews ? get(addedViews, 'length') : 0;

    this.arrayContentWillChange(idx, removedCount, addedCount);
    this.childViewsWillChange(this._childViews, idx, removedCount);

    if (addedCount === 0) {
      this._childViews.splice(idx, removedCount) ;
    } else {
      var args = [idx, removedCount].concat(addedViews);
      if (addedViews.length && !this._childViews.length) { this._childViews = this._childViews.slice(); }
      this._childViews.splice.apply(this._childViews, args);
    }

    this.arrayContentDidChange(idx, removedCount, addedCount);
    this.childViewsDidChange(this._childViews, idx, removedCount, addedCount);

    return this;
  },

  objectAt: function(idx) {
    return this._childViews[idx];
  },

  length: Ember.computed(function () {
    return this._childViews.length;
  }),

  /**
    @private

    Instructs each child view to render to the passed render buffer.

    @method render
    @param {Ember.RenderBuffer} buffer the buffer to render to
  */
  render: function(buffer) {
    this.forEachChildView(function(view) {
      view.renderToBuffer(buffer);
    });
  },

  instrumentName: 'render.container',

  /**
    @private

    When a child view is removed, destroy its element so that
    it is removed from the DOM.

    The array observer that triggers this action is set up in the
    `renderToBuffer` method.

    @method childViewsWillChange
    @param {Ember.Array} views the child views array before mutation
    @param {Number} start the start position of the mutation
    @param {Number} removed the number of child views removed
  **/
  childViewsWillChange: function(views, start, removed) {
    this.propertyWillChange('childViews');

    if (removed > 0) {
      var changedViews = views.slice(start, start+removed);
      // transition to preRender before clearing parentView
      this.currentState.childViewsWillChange(this, views, start, removed);
      this.initializeViews(changedViews, null, null);
    }
  },

  removeChild: function(child) {
    this.removeObject(child);
    return this;
  },

  /**
    @private

    When a child view is added, make sure the DOM gets updated appropriately.

    If the view has already rendered an element, we tell the child view to
    create an element and insert it into the DOM. If the enclosing container
    view has already written to a buffer, but not yet converted that buffer
    into an element, we insert the string representation of the child into the
    appropriate place in the buffer.

    @method childViewsDidChange
    @param {Ember.Array} views the array of child views afte the mutation has occurred
    @param {Number} start the start position of the mutation
    @param {Number} removed the number of child views removed
    @param {Number} the number of child views added
  */
  childViewsDidChange: function(views, start, removed, added) {
    if (added > 0) {
      var changedViews = views.slice(start, start+added);
      this.initializeViews(changedViews, this, get(this, 'templateData'));
      this.currentState.childViewsDidChange(this, views, start, added);
    }
    this.propertyDidChange('childViews');
  },

  initializeViews: function(views, parentView, templateData) {
    forEach(views, function(view) {
      set(view, '_parentView', parentView);

      if (!get(view, 'templateData')) {
        set(view, 'templateData', templateData);
      }
    });
  },

  currentView: null,

  _currentViewWillChange: Ember.beforeObserver(function() {
    var currentView = get(this, 'currentView');
    if (currentView) {
      currentView.destroy();
    }
  }, 'currentView'),

  _currentViewDidChange: Ember.observer(function() {
    var currentView = get(this, 'currentView');
    if (currentView) {
      this.pushObject(currentView);
    }
  }, 'currentView'),

  _ensureChildrenAreInDOM: function () {
    this.currentState.ensureChildrenAreInDOM(this);
  }
});

Ember.merge(states._default, {
  childViewsWillChange: Ember.K,
  childViewsDidChange: Ember.K,
  ensureChildrenAreInDOM: Ember.K
});

Ember.merge(states.inBuffer, {
  childViewsDidChange: function(parentView, views, start, added) {
    throw new Error('You cannot modify child views while in the inBuffer state');
  }
});

Ember.merge(states.hasElement, {
  childViewsWillChange: function(view, views, start, removed) {
    for (var i=start; i<start+removed; i++) {
      views[i].remove();
    }
  },

  childViewsDidChange: function(view, views, start, added) {
    Ember.run.scheduleOnce('render', view, '_ensureChildrenAreInDOM');
  },

  ensureChildrenAreInDOM: function(view) {
    var childViews = view._childViews, i, len, childView, previous, buffer, viewCollection = new ViewCollection();

    function insertViewCollection() {
      viewCollection.triggerRecursively('willInsertElement');
      if (previous) {
        previous.domManager.after(previous, buffer.string());
      } else {
        view.domManager.prepend(view, buffer.string());
      }
      buffer = null;
      viewCollection.forEach(function(v) {
        v.transitionTo('inDOM');
        v.propertyDidChange('element');
        v.triggerRecursively('didInsertElement');
      });
    }

    for (i = 0, len = childViews.length; i < len; i++) {
      childView = childViews[i];

      if (!buffer) { buffer = Ember.RenderBuffer(); buffer._hasElement = false; }

      if (childView.renderToBufferIfNeeded(buffer)) {
        viewCollection.push(childView);
      } else if (viewCollection.length) {
        insertViewCollection();
        previous = childView;
        viewCollection.clear();
      } else {
        previous = childView;
      }
    }

    if (viewCollection.length) { insertViewCollection(); }
  }
});

})();



(function() {
/**
@module ember
@submodule ember-views
*/

var get = Ember.get, set = Ember.set, fmt = Ember.String.fmt;

/**
  `Ember.CollectionView` is an `Ember.View` descendent responsible for managing
  a collection (an array or array-like object) by maintaing a child view object
  and associated DOM representation for each item in the array and ensuring
  that child views and their associated rendered HTML are updated when items in
  the array are added, removed, or replaced.

  ## Setting content

  The managed collection of objects is referenced as the `Ember.CollectionView`
  instance's `content` property.

  ```javascript
  someItemsView = Ember.CollectionView.create({
    content: ['A', 'B','C']
  })
  ```

  The view for each item in the collection will have its `content` property set
  to the item.

  ## Specifying itemViewClass

  By default the view class for each item in the managed collection will be an
  instance of `Ember.View`. You can supply a different class by setting the
  `CollectionView`'s `itemViewClass` property.

  Given an empty `<body>` and the following code:

  ```javascript
  someItemsView = Ember.CollectionView.create({
    classNames: ['a-collection'],
    content: ['A','B','C'],
    itemViewClass: Ember.View.extend({
      template: Ember.Handlebars.compile("the letter: {{view.content}}")
    })
  });

  someItemsView.appendTo('body');
  ```

  Will result in the following HTML structure

  ```html
  <div class="ember-view a-collection">
    <div class="ember-view">the letter: A</div>
    <div class="ember-view">the letter: B</div>
    <div class="ember-view">the letter: C</div>
  </div>
  ```

  ## Automatic matching of parent/child tagNames

  Setting the `tagName` property of a `CollectionView` to any of
  "ul", "ol", "table", "thead", "tbody", "tfoot", "tr", or "select" will result
  in the item views receiving an appropriately matched `tagName` property.

  Given an empty `<body>` and the following code:

  ```javascript
  anUndorderedListView = Ember.CollectionView.create({
    tagName: 'ul',
    content: ['A','B','C'],
    itemViewClass: Ember.View.extend({
      template: Ember.Handlebars.compile("the letter: {{view.content}}")
    })
  });

  anUndorderedListView.appendTo('body');
  ```

  Will result in the following HTML structure

  ```html
  <ul class="ember-view a-collection">
    <li class="ember-view">the letter: A</li>
    <li class="ember-view">the letter: B</li>
    <li class="ember-view">the letter: C</li>
  </ul>
  ```

  Additional `tagName` pairs can be provided by adding to
  `Ember.CollectionView.CONTAINER_MAP `

  ```javascript
  Ember.CollectionView.CONTAINER_MAP['article'] = 'section'
  ```

  ## Programatic creation of child views

  For cases where additional customization beyond the use of a single
  `itemViewClass` or `tagName` matching is required CollectionView's
  `createChildView` method can be overidden:

  ```javascript
  CustomCollectionView = Ember.CollectionView.extend({
    createChildView: function(viewClass, attrs) {
      if (attrs.content.kind == 'album') {
        viewClass = App.AlbumView;
      } else {
        viewClass = App.SongView;
      }
      return this._super(viewClass, attrs);
    }
  });
  ```

  ## Empty View

  You can provide an `Ember.View` subclass to the `Ember.CollectionView`
  instance as its `emptyView` property. If the `content` property of a
  `CollectionView` is set to `null` or an empty array, an instance of this view
  will be the `CollectionView`s only child.

  ```javascript
  aListWithNothing = Ember.CollectionView.create({
    classNames: ['nothing']
    content: null,
    emptyView: Ember.View.extend({
      template: Ember.Handlebars.compile("The collection is empty")
    })
  });

  aListWithNothing.appendTo('body');
  ```

  Will result in the following HTML structure

  ```html
  <div class="ember-view nothing">
    <div class="ember-view">
      The collection is empty
    </div>
  </div>
  ```

  ## Adding and Removing items

  The `childViews` property of a `CollectionView` should not be directly
  manipulated. Instead, add, remove, replace items from its `content` property.
  This will trigger appropriate changes to its rendered HTML.

  ## Use in templates via the `{{collection}}` `Ember.Handlebars` helper

  `Ember.Handlebars` provides a helper specifically for adding
  `CollectionView`s to templates. See `Ember.Handlebars.collection` for more
  details

  @class CollectionView
  @namespace Ember
  @extends Ember.ContainerView
  @since Ember 0.9
*/
Ember.CollectionView = Ember.ContainerView.extend(
/** @scope Ember.CollectionView.prototype */ {

  /**
    A list of items to be displayed by the `Ember.CollectionView`.

    @property content
    @type Ember.Array
    @default null
  */
  content: null,

  /**
    @private

    This provides metadata about what kind of empty view class this
    collection would like if it is being instantiated from another
    system (like Handlebars)

    @property emptyViewClass
  */
  emptyViewClass: Ember.View,

  /**
    An optional view to display if content is set to an empty array.

    @property emptyView
    @type Ember.View
    @default null
  */
  emptyView: null,

  /**
    @property itemViewClass
    @type Ember.View
    @default Ember.View
  */
  itemViewClass: Ember.View,

  init: function() {
    var ret = this._super();
    this._contentDidChange();
    return ret;
  },

  _contentWillChange: Ember.beforeObserver(function() {
    var content = this.get('content');

    if (content) { content.removeArrayObserver(this); }
    var len = content ? get(content, 'length') : 0;
    this.arrayWillChange(content, 0, len);
  }, 'content'),

  /**
    @private

    Check to make sure that the content has changed, and if so,
    update the children directly. This is always scheduled
    asynchronously, to allow the element to be created before
    bindings have synchronized and vice versa.

    @method _contentDidChange
  */
  _contentDidChange: Ember.observer(function() {
    var content = get(this, 'content');

    if (content) {
      Ember.assert(fmt("an Ember.CollectionView's content must implement Ember.Array. You passed %@", [content]), Ember.Array.detect(content));
      content.addArrayObserver(this);
    }

    var len = content ? get(content, 'length') : 0;
    this.arrayDidChange(content, 0, null, len);
  }, 'content'),

  destroy: function() {
    if (!this._super()) { return; }

    var content = get(this, 'content');
    if (content) { content.removeArrayObserver(this); }

    if (this._createdEmptyView) {
      this._createdEmptyView.destroy();
    }

    return this;
  },

  arrayWillChange: function(content, start, removedCount) {
    // If the contents were empty before and this template collection has an
    // empty view remove it now.
    var emptyView = get(this, 'emptyView');
    if (emptyView && emptyView instanceof Ember.View) {
      emptyView.removeFromParent();
    }

    // Loop through child views that correspond with the removed items.
    // Note that we loop from the end of the array to the beginning because
    // we are mutating it as we go.
    var childViews = this._childViews, childView, idx, len;

    len = this._childViews.length;

    var removingAll = removedCount === len;

    if (removingAll) {
      this.currentState.empty(this);
    }

    for (idx = start + removedCount - 1; idx >= start; idx--) {
      childView = childViews[idx];
      if (removingAll) { childView.removedFromDOM = true; }
      childView.destroy();
    }
  },

  /**
    Called when a mutation to the underlying content array occurs.

    This method will replay that mutation against the views that compose the
    `Ember.CollectionView`, ensuring that the view reflects the model.

    This array observer is added in `contentDidChange`.

    @method arrayDidChange
    @param {Array} addedObjects the objects that were added to the content
    @param {Array} removedObjects the objects that were removed from the content
    @param {Number} changeIndex the index at which the changes occurred
  */
  arrayDidChange: function(content, start, removed, added) {
    var itemViewClass = get(this, 'itemViewClass'),
        addedViews = [], view, item, idx, len;

    if ('string' === typeof itemViewClass) {
      itemViewClass = get(itemViewClass);
    }

    Ember.assert(fmt("itemViewClass must be a subclass of Ember.View, not %@", [itemViewClass]), Ember.View.detect(itemViewClass));

    len = content ? get(content, 'length') : 0;
    if (len) {
      for (idx = start; idx < start+added; idx++) {
        item = content.objectAt(idx);

        view = this.createChildView(itemViewClass, {
          content: item,
          contentIndex: idx
        });

        addedViews.push(view);
      }
    } else {
      var emptyView = get(this, 'emptyView');
      if (!emptyView) { return; }

      var isClass = Ember.CoreView.detect(emptyView);

      emptyView = this.createChildView(emptyView);
      addedViews.push(emptyView);
      set(this, 'emptyView', emptyView);

      if (isClass) { this._createdEmptyView = emptyView; }
    }
    this.replace(start, 0, addedViews);
  },

  createChildView: function(view, attrs) {
    view = this._super(view, attrs);

    var itemTagName = get(view, 'tagName');
    var tagName = (itemTagName === null || itemTagName === undefined) ? Ember.CollectionView.CONTAINER_MAP[get(this, 'tagName')] : itemTagName;

    set(view, 'tagName', tagName);

    return view;
  }
});

/**
  A map of parent tags to their default child tags. You can add
  additional parent tags if you want collection views that use
  a particular parent tag to default to a child tag.

  @property CONTAINER_MAP
  @type Hash
  @static
  @final
*/
Ember.CollectionView.CONTAINER_MAP = {
  ul: 'li',
  ol: 'li',
  table: 'tr',
  thead: 'tr',
  tbody: 'tr',
  tfoot: 'tr',
  tr: 'td',
  select: 'option'
};

})();



(function() {

})();



(function() {
/*globals jQuery*/
/**
Ember Views

@module ember
@submodule ember-views
@requires ember-runtime
@main ember-views
*/

})();

