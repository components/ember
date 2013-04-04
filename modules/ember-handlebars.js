(function() {
var slice = Array.prototype.slice;

/**
  @private

  If a path starts with a reserved keyword, returns the root
  that should be used.

  @method normalizePath
  @for Ember
  @param root {Object}
  @param path {String}
  @param data {Hash}
*/
var normalizePath = Ember.Handlebars.normalizePath = function(root, path, data) {
  var keywords = (data && data.keywords) || {},
      keyword, isKeyword;

  // Get the first segment of the path. For example, if the
  // path is "foo.bar.baz", returns "foo".
  keyword = path.split('.', 1)[0];

  // Test to see if the first path is a keyword that has been
  // passed along in the view's data hash. If so, we will treat
  // that object as the new root.
  if (keywords.hasOwnProperty(keyword)) {
    // Look up the value in the template's data hash.
    root = keywords[keyword];
    isKeyword = true;

    // Handle cases where the entire path is the reserved
    // word. In that case, return the object itself.
    if (path === keyword) {
      path = '';
    } else {
      // Strip the keyword from the path and look up
      // the remainder from the newly found root.
      path = path.substr(keyword.length+1);
    }
  }

  return { root: root, path: path, isKeyword: isKeyword };
};


/**
  Lookup both on root and on window. If the path starts with
  a keyword, the corresponding object will be looked up in the
  template's data hash and used to resolve the path.

  @method get
  @for Ember.Handlebars
  @param {Object} root The object to look up the property on
  @param {String} path The path to be lookedup
  @param {Object} options The template's option hash
*/
var handlebarsGet = Ember.Handlebars.get = function(root, path, options) {
  var data = options && options.data,
      normalizedPath = normalizePath(root, path, data),
      value;

  // In cases where the path begins with a keyword, change the
  // root to the value represented by that keyword, and ensure
  // the path is relative to it.
  root = normalizedPath.root;
  path = normalizedPath.path;

  value = Ember.get(root, path);

  // If the path starts with a capital letter, look it up on Ember.lookup,
  // which defaults to the `window` object in browsers.
  if (value === undefined && root !== Ember.lookup && Ember.isGlobalPath(path)) {
    value = Ember.get(Ember.lookup, path);
  }
  return value;
};
Ember.Handlebars.getPath = Ember.deprecateFunc('`Ember.Handlebars.getPath` has been changed to `Ember.Handlebars.get` for consistency.', Ember.Handlebars.get);

Ember.Handlebars.resolveParams = function(context, params, options) {
  var resolvedParams = [], types = options.types, param, type;

  for (var i=0, l=params.length; i<l; i++) {
    param = params[i];
    type = types[i];

    if (type === 'ID') {
      resolvedParams.push(handlebarsGet(context, param, options));
    } else {
      resolvedParams.push(param);
    }
  }

  return resolvedParams;
};

Ember.Handlebars.resolveHash = function(context, hash, options) {
  var resolvedHash = {}, types = options.hashTypes, type;

  for (var key in hash) {
    if (!hash.hasOwnProperty(key)) { continue; }

    type = types[key];

    if (type === 'ID') {
      resolvedHash[key] = handlebarsGet(context, hash[key], options);
    } else {
      resolvedHash[key] = hash[key];
    }
  }

  return resolvedHash;
};

/**
  @private

  Registers a helper in Handlebars that will be called if no property with the
  given name can be found on the current context object, and no helper with
  that name is registered.

  This throws an exception with a more helpful error message so the user can
  track down where the problem is happening.

  @method helperMissing
  @for Ember.Handlebars.helpers
  @param {String} path
  @param {Hash} options
*/
Ember.Handlebars.registerHelper('helperMissing', function(path, options) {
  var error, view = "";

  error = "%@ Handlebars error: Could not find property '%@' on object %@.";
  if (options.data){
    view = options.data.view;
  }
  throw new Ember.Error(Ember.String.fmt(error, [view, path, this]));
});

/**
  Register a bound handlebars helper. Bound helpers behave similarly to regular
  handlebars helpers, with the added ability to re-render when the underlying data
  changes.

  ## Simple example

  ```javascript
  Ember.Handlebars.registerBoundHelper('capitalize', function(value) {
    return value.toUpperCase();
  });
  ```

  The above bound helper can be used inside of templates as follows:

  ```handlebars
  {{capitalize name}}
  ```

  In this case, when the `name` property of the template's context changes,
  the rendered value of the helper will update to reflect this change.

  ## Example with options

  Like normal handlebars helpers, bound helpers have access to the options
  passed into the helper call.

  ```javascript
  Ember.Handlebars.registerBoundHelper('repeat', function(value, options) {
    var count = options.hash.count;
    var a = [];
    while(a.length < count){
        a.push(value);
    }
    return a.join('');
  });
  ```

  This helper could be used in a template as follows:

  ```handlebars
  {{repeat text count=3}}
  ```

  ## Example with bound options

  Bound hash options are also supported. Example:

  ```handlebars
  {{repeat text countBinding="numRepeats"}}
  ```

  In this example, count will be bound to the value of
  the `numRepeats` property on the context. If that property
  changes, the helper will be re-rendered.

  ## Example with extra dependencies

  The `Ember.Handlebars.registerBoundHelper` method takes a variable length
  third parameter which indicates extra dependencies on the passed in value.
  This allows the handlebars helper to update when these dependencies change.

  ```javascript
  Ember.Handlebars.registerBoundHelper('capitalizeName', function(value) {
    return value.get('name').toUpperCase();
  }, 'name');
  ```

  ## Example with multiple bound properties

  `Ember.Handlebars.registerBoundHelper` supports binding to
  multiple properties, e.g.:

  ```javascript
  Ember.Handlebars.registerBoundHelper('concatenate', function() {
    var values = arguments[arguments.length - 1];
    return values.join('||');
  });
  ```

  Which allows for template syntax such as {{concatenate prop1 prop2}} or
  {{concatenate prop1 prop2 prop3}}. If any of the properties change,
  the helpr will re-render.  Note that dependency keys cannot be
  using in conjunction with multi-property helpers, since it is ambiguous
  which property the dependent keys would belong to.

  ## Use with unbound helper

  The {{unbound}} helper can be used with bound helper invocations
  to render them in their unbound form, e.g.

  ```handlebars
  {{unbound capitalize name}}
  ```

  In this example, if the name property changes, the helper
  will not re-render.


  @method registerBoundHelper
  @for Ember.Handlebars
  @param {String} name
  @param {Function} function
  @param {String} dependentKeys*
*/
Ember.Handlebars.registerBoundHelper = function(name, fn) {
  var dependentKeys = slice.call(arguments, 2);

  function helper() {
    var properties = slice.call(arguments, 0, -1),
      numProperties = properties.length,
      options = arguments[arguments.length - 1],
      normalizedProperties = [],
      data = options.data,
      hash = options.hash,
      view = data.view,
      currentContext = (options.contexts && options.contexts[0]) || this,
      normalized,
      pathRoot, path,
      loc, hashOption;

    // Detect bound options (e.g. countBinding="otherCount")
    hash.boundOptions = {};
    for (hashOption in hash) {
      if (!hash.hasOwnProperty(hashOption)) { continue; }

      if (Ember.IS_BINDING.test(hashOption) && typeof hash[hashOption] === 'string') {
        // Lop off 'Binding' suffix.
        hash.boundOptions[hashOption.slice(0, -7)] = hash[hashOption];
      }
    }

    // Expose property names on data.properties object.
    data.properties = [];
    for (loc = 0; loc < numProperties; ++loc) {
      data.properties.push(properties[loc]);
      normalizedProperties.push(normalizePath(currentContext, properties[loc], data));
    }

    if (data.isUnbound) {
      return evaluateUnboundHelper(this, fn, normalizedProperties, options);
    }

    if (dependentKeys.length === 0) {
      return evaluateMultiPropertyBoundHelper(currentContext, fn, normalizedProperties, options);
    }

    Ember.assert("Dependent keys can only be used with single-property helpers.", properties.length === 1);

    normalized = normalizedProperties[0];

    pathRoot = normalized.root;
    path = normalized.path;

    var bindView = new Ember._SimpleHandlebarsView(
      path, pathRoot, !options.hash.unescaped, options.data
    );

    bindView.normalizedValue = function() {
      var value = Ember._SimpleHandlebarsView.prototype.normalizedValue.call(bindView);
      return fn.call(view, value, options);
    };

    view.appendChild(bindView);

    view.registerObserver(pathRoot, path, bindView, bindView.rerender);

    for (var i=0, l=dependentKeys.length; i<l; i++) {
      view.registerObserver(pathRoot, path + '.' + dependentKeys[i], bindView, bindView.rerender);
    }
  }

  helper._rawFunction = fn;
  Ember.Handlebars.registerHelper(name, helper);
};

/**
  @private

  Renders the unbound form of an otherwise bound helper function.

  @param {Function} fn
  @param {Object} context
  @param {Array} normalizedProperties
  @param {String} options
*/
function evaluateMultiPropertyBoundHelper(context, fn, normalizedProperties, options) {
  var numProperties = normalizedProperties.length,
      data = options.data,
      view = data.view,
      hash = options.hash,
      boundOptions = hash.boundOptions,
      watchedProperties,
      boundOption, bindView, loc, property, len;

  bindView = new Ember._SimpleHandlebarsView(null, null, !hash.unescaped, data);
  bindView.normalizedValue = function() {
    var args = [], value, boundOption;

    // Copy over bound options.
    for (boundOption in boundOptions) {
      if (!boundOptions.hasOwnProperty(boundOption)) { continue; }
      property = normalizePath(context, boundOptions[boundOption], data);
      bindView.path = property.path;
      bindView.pathRoot = property.root;
      hash[boundOption] = Ember._SimpleHandlebarsView.prototype.normalizedValue.call(bindView);
    }

    for (loc = 0; loc < numProperties; ++loc) {
      property = normalizedProperties[loc];
      bindView.path = property.path;
      bindView.pathRoot = property.root;
      args.push(Ember._SimpleHandlebarsView.prototype.normalizedValue.call(bindView));
    }
    args.push(options);
    return fn.apply(context, args);
  };

  view.appendChild(bindView);

  // Assemble liast of watched properties that'll re-render this helper.
  watchedProperties = [];
  for (boundOption in boundOptions) {
    if (boundOptions.hasOwnProperty(boundOption)) {
      watchedProperties.push(normalizePath(context, boundOptions[boundOption], data));
    }
  }
  watchedProperties = watchedProperties.concat(normalizedProperties);

  // Observe each property.
  for (loc = 0, len = watchedProperties.length; loc < len; ++loc) {
    property = watchedProperties[loc];
    view.registerObserver(property.root, property.path, bindView, bindView.rerender);
  }

}

/**
  @private

  Renders the unbound form of an otherwise bound helper function.

  @param {Function} fn
  @param {Object} context
  @param {Array} normalizedProperties
  @param {String} options
*/
function evaluateUnboundHelper(context, fn, normalizedProperties, options) {
  var args = [], hash = options.hash, boundOptions = hash.boundOptions, loc, len, property, boundOption;

  for (boundOption in boundOptions) {
    if (!boundOptions.hasOwnProperty(boundOption)) { continue; }
    hash[boundOption] = Ember.Handlebars.get(context, boundOptions[boundOption], options);
  }

  for(loc = 0, len = normalizedProperties.length; loc < len; ++loc) {
    property = normalizedProperties[loc];
    args.push(Ember.Handlebars.get(context, property.path, options));
  }
  args.push(options);
  return fn.apply(context, args);
}

/**
  @private

  Overrides Handlebars.template so that we can distinguish
  user-created, top-level templates from inner contexts.

  @method template
  @for Ember.Handlebars
  @param {String} template spec
*/
Ember.Handlebars.template = function(spec){
  var t = Handlebars.template(spec);
  t.isTop = true;
  return t;
};


})();



(function() {
/**
  @method htmlSafe
  @for Ember.String
  @static
*/
Ember.String.htmlSafe = function(str) {
  return new Handlebars.SafeString(str);
};

var htmlSafe = Ember.String.htmlSafe;

if (Ember.EXTEND_PROTOTYPES === true || Ember.EXTEND_PROTOTYPES.String) {

  /**
    See {{#crossLink "Ember.String/htmlSafe"}}{{/crossLink}}

    @method htmlSafe
    @for String
  */
  String.prototype.htmlSafe = function() {
    return htmlSafe(this);
  };
}

})();



(function() {
Ember.Handlebars.resolvePaths = function(options) {
  var ret = [],
      contexts = options.contexts,
      roots = options.roots,
      data = options.data;

  for (var i=0, l=contexts.length; i<l; i++) {
    ret.push( Ember.Handlebars.get(roots[i], contexts[i], { data: data }) );
  }

  return ret;
};

})();



(function() {
/*jshint newcap:false*/
/**
@module ember
@submodule ember-handlebars
*/

var set = Ember.set, get = Ember.get;
var Metamorph = requireModule('metamorph');

function notifyMutationListeners() {
  Ember.run.once(Ember.View, 'notifyMutationListeners');
}

// DOMManager should just abstract dom manipulation between jquery and metamorph
var DOMManager = {
  remove: function(view) {
    view.morph.remove();
    notifyMutationListeners();
  },

  prepend: function(view, html) {
    view.morph.prepend(html);
    notifyMutationListeners();
  },

  after: function(view, html) {
    view.morph.after(html);
    notifyMutationListeners();
  },

  html: function(view, html) {
    view.morph.html(html);
    notifyMutationListeners();
  },

  // This is messed up.
  replace: function(view) {
    var morph = view.morph;

    view.transitionTo('preRender');

    Ember.run.schedule('render', this, function() {
      if (view.isDestroying) { return; }

      view.clearRenderedChildren();
      var buffer = view.renderToBuffer();

      view.invokeRecursively(function(view) {
        view.propertyDidChange('element');
      });

      view.triggerRecursively('willInsertElement');
      morph.replaceWith(buffer.string());
      view.transitionTo('inDOM');
      view.triggerRecursively('didInsertElement');
      notifyMutationListeners();
    });
  },

  empty: function(view) {
    view.morph.html("");
    notifyMutationListeners();
  }
};

// The `morph` and `outerHTML` properties are internal only
// and not observable.

/**
  @class _Metamorph
  @namespace Ember
  @extends Ember.Mixin
  @private
*/
Ember._Metamorph = Ember.Mixin.create({
  isVirtual: true,
  tagName: '',

  instrumentName: 'render.metamorph',

  init: function() {
    this._super();
    this.morph = Metamorph();
    Ember.deprecate('Supplying a tagName to Metamorph views is unreliable and is deprecated. You may be setting the tagName on a Handlebars helper that creates a Metamorph.', !this.tagName);
  },

  beforeRender: function(buffer) {
    buffer.push(this.morph.startTag());
    buffer.pushOpeningTag();
  },

  afterRender: function(buffer) {
    buffer.pushClosingTag();
    buffer.push(this.morph.endTag());
  },

  createElement: function() {
    var buffer = this.renderToBuffer();
    this.outerHTML = buffer.string();
    this.clearBuffer();
  },

  domManager: DOMManager
});

/**
  @class _MetamorphView
  @namespace Ember
  @extends Ember.View
  @uses Ember._Metamorph
  @private
*/
Ember._MetamorphView = Ember.View.extend(Ember._Metamorph);

/**
  @class _SimpleMetamorphView
  @namespace Ember
  @extends Ember.View
  @uses Ember._Metamorph
  @private
*/
Ember._SimpleMetamorphView = Ember.CoreView.extend(Ember._Metamorph);


})();



(function() {
/*globals Handlebars */
/*jshint newcap:false*/
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set, handlebarsGet = Ember.Handlebars.get;
var Metamorph = requireModule('metamorph');
function SimpleHandlebarsView(path, pathRoot, isEscaped, templateData) {
  this.path = path;
  this.pathRoot = pathRoot;
  this.isEscaped = isEscaped;
  this.templateData = templateData;

  this.morph = Metamorph();
  this.state = 'preRender';
  this.updateId = null;
}

Ember._SimpleHandlebarsView = SimpleHandlebarsView;

SimpleHandlebarsView.prototype = {
  isVirtual: true,
  isView: true,

  destroy: function () {
    if (this.updateId) {
      Ember.run.cancel(this.updateId);
      this.updateId = null;
    }
    this.morph = null;
  },

  propertyDidChange: Ember.K,

  normalizedValue: function() {
    var path = this.path,
        pathRoot = this.pathRoot,
        result, templateData;

    // Use the pathRoot as the result if no path is provided. This
    // happens if the path is `this`, which gets normalized into
    // a `pathRoot` of the current Handlebars context and a path
    // of `''`.
    if (path === '') {
      result = pathRoot;
    } else {
      templateData = this.templateData;
      result = handlebarsGet(pathRoot, path, { data: templateData });
    }

    return result;
  },

  renderToBuffer: function(buffer) {
    var string = '';

    string += this.morph.startTag();
    string += this.render();
    string += this.morph.endTag();

    buffer.push(string);
  },

  render: function() {
    // If not invoked via a triple-mustache ({{{foo}}}), escape
    // the content of the template.
    var escape = this.isEscaped;
    var result = this.normalizedValue();

    if (result === null || result === undefined) {
      result = "";
    } else if (!(result instanceof Handlebars.SafeString)) {
      result = String(result);
    }

    if (escape) { result = Handlebars.Utils.escapeExpression(result); }
    return result;
  },

  rerender: function() {
    switch(this.state) {
      case 'preRender':
      case 'destroying':
        break;
      case 'inBuffer':
        throw new Ember.Error("Something you did tried to replace an {{expression}} before it was inserted into the DOM.");
      case 'hasElement':
      case 'inDOM':
        this.updateId = Ember.run.scheduleOnce('render', this, 'update');
        break;
    }

    return this;
  },

  update: function () {
    this.updateId = null;
    this.morph.html(this.render());
  },

  transitionTo: function(state) {
    this.state = state;
  }
};

var states = Ember.View.cloneStates(Ember.View.states), merge = Ember.merge;

merge(states._default, {
  rerenderIfNeeded: Ember.K
});

merge(states.inDOM, {
  rerenderIfNeeded: function(view) {
    if (view.normalizedValue() !== view._lastNormalizedValue) {
      view.rerender();
    }
  }
});

/**
  `Ember._HandlebarsBoundView` is a private view created by the Handlebars
  `{{bind}}` helpers that is used to keep track of bound properties.

  Every time a property is bound using a `{{mustache}}`, an anonymous subclass
  of `Ember._HandlebarsBoundView` is created with the appropriate sub-template
  and context set up. When the associated property changes, just the template
  for this view will re-render.

  @class _HandlebarsBoundView
  @namespace Ember
  @extends Ember._MetamorphView
  @private
*/
Ember._HandlebarsBoundView = Ember._MetamorphView.extend({
  instrumentName: 'render.boundHandlebars',
  states: states,

  /**
    The function used to determine if the `displayTemplate` or
    `inverseTemplate` should be rendered. This should be a function that takes
    a value and returns a Boolean.

    @property shouldDisplayFunc
    @type Function
    @default null
  */
  shouldDisplayFunc: null,

  /**
    Whether the template rendered by this view gets passed the context object
    of its parent template, or gets passed the value of retrieving `path`
    from the `pathRoot`.

    For example, this is true when using the `{{#if}}` helper, because the
    template inside the helper should look up properties relative to the same
    object as outside the block. This would be `false` when used with `{{#with
    foo}}` because the template should receive the object found by evaluating
    `foo`.

    @property preserveContext
    @type Boolean
    @default false
  */
  preserveContext: false,

  /**
    If `preserveContext` is true, this is the object that will be used
    to render the template.

    @property previousContext
    @type Object
  */
  previousContext: null,

  /**
    The template to render when `shouldDisplayFunc` evaluates to `true`.

    @property displayTemplate
    @type Function
    @default null
  */
  displayTemplate: null,

  /**
    The template to render when `shouldDisplayFunc` evaluates to `false`.

    @property inverseTemplate
    @type Function
    @default null
  */
  inverseTemplate: null,


  /**
    The path to look up on `pathRoot` that is passed to
    `shouldDisplayFunc` to determine which template to render.

    In addition, if `preserveContext` is `false,` the object at this path will
    be passed to the template when rendering.

    @property path
    @type String
    @default null
  */
  path: null,

  /**
    The object from which the `path` will be looked up. Sometimes this is the
    same as the `previousContext`, but in cases where this view has been
    generated for paths that start with a keyword such as `view` or
    `controller`, the path root will be that resolved object.

    @property pathRoot
    @type Object
  */
  pathRoot: null,

  normalizedValue: function() {
    var path = get(this, 'path'),
        pathRoot  = get(this, 'pathRoot'),
        valueNormalizer = get(this, 'valueNormalizerFunc'),
        result, templateData;

    // Use the pathRoot as the result if no path is provided. This
    // happens if the path is `this`, which gets normalized into
    // a `pathRoot` of the current Handlebars context and a path
    // of `''`.
    if (path === '') {
      result = pathRoot;
    } else {
      templateData = get(this, 'templateData');
      result = handlebarsGet(pathRoot, path, { data: templateData });
    }

    return valueNormalizer ? valueNormalizer(result) : result;
  },

  rerenderIfNeeded: function() {
    this.currentState.rerenderIfNeeded(this);
  },

  /**
    Determines which template to invoke, sets up the correct state based on
    that logic, then invokes the default `Ember.View` `render` implementation.

    This method will first look up the `path` key on `pathRoot`,
    then pass that value to the `shouldDisplayFunc` function. If that returns
    `true,` the `displayTemplate` function will be rendered to DOM. Otherwise,
    `inverseTemplate`, if specified, will be rendered.

    For example, if this `Ember._HandlebarsBoundView` represented the `{{#with
    foo}}` helper, it would look up the `foo` property of its context, and
    `shouldDisplayFunc` would always return true. The object found by looking
    up `foo` would be passed to `displayTemplate`.

    @method render
    @param {Ember.RenderBuffer} buffer
  */
  render: function(buffer) {
    // If not invoked via a triple-mustache ({{{foo}}}), escape
    // the content of the template.
    var escape = get(this, 'isEscaped');

    var shouldDisplay = get(this, 'shouldDisplayFunc'),
        preserveContext = get(this, 'preserveContext'),
        context = get(this, 'previousContext');

    var inverseTemplate = get(this, 'inverseTemplate'),
        displayTemplate = get(this, 'displayTemplate');

    var result = this.normalizedValue();
    this._lastNormalizedValue = result;

    // First, test the conditional to see if we should
    // render the template or not.
    if (shouldDisplay(result)) {
      set(this, 'template', displayTemplate);

      // If we are preserving the context (for example, if this
      // is an #if block, call the template with the same object.
      if (preserveContext) {
        set(this, '_context', context);
      } else {
      // Otherwise, determine if this is a block bind or not.
      // If so, pass the specified object to the template
        if (displayTemplate) {
          set(this, '_context', result);
        } else {
        // This is not a bind block, just push the result of the
        // expression to the render context and return.
          if (result === null || result === undefined) {
            result = "";
          } else if (!(result instanceof Handlebars.SafeString)) {
            result = String(result);
          }

          if (escape) { result = Handlebars.Utils.escapeExpression(result); }
          buffer.push(result);
          return;
        }
      }
    } else if (inverseTemplate) {
      set(this, 'template', inverseTemplate);

      if (preserveContext) {
        set(this, '_context', context);
      } else {
        set(this, '_context', result);
      }
    } else {
      set(this, 'template', function() { return ''; });
    }

    return this._super(buffer);
  }
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set, fmt = Ember.String.fmt;
var handlebarsGet = Ember.Handlebars.get, normalizePath = Ember.Handlebars.normalizePath;
var forEach = Ember.ArrayPolyfills.forEach;

var EmberHandlebars = Ember.Handlebars, helpers = EmberHandlebars.helpers;

// Binds a property into the DOM. This will create a hook in DOM that the
// KVO system will look for and update if the property changes.
function bind(property, options, preserveContext, shouldDisplay, valueNormalizer, childProperties) {
  var data = options.data,
      fn = options.fn,
      inverse = options.inverse,
      view = data.view,
      currentContext = this,
      normalized, observer, i;

  normalized = normalizePath(currentContext, property, data);

  // Set up observers for observable objects
  if ('object' === typeof this) {
    if (data.insideGroup) {
      observer = function() {
        Ember.run.once(view, 'rerender');
      };

      var template, context, result = handlebarsGet(currentContext, property, options);

      result = valueNormalizer(result);

      context = preserveContext ? currentContext : result;
      if (shouldDisplay(result)) {
        template = fn;
      } else if (inverse) {
        template = inverse;
      }

      template(context, { data: options.data });
    } else {
      // Create the view that will wrap the output of this template/property
      // and add it to the nearest view's childViews array.
      // See the documentation of Ember._HandlebarsBoundView for more.
      var bindView = view.createChildView(Ember._HandlebarsBoundView, {
        preserveContext: preserveContext,
        shouldDisplayFunc: shouldDisplay,
        valueNormalizerFunc: valueNormalizer,
        displayTemplate: fn,
        inverseTemplate: inverse,
        path: property,
        pathRoot: currentContext,
        previousContext: currentContext,
        isEscaped: !options.hash.unescaped,
        templateData: options.data
      });

      view.appendChild(bindView);

      observer = function() {
        Ember.run.scheduleOnce('render', bindView, 'rerenderIfNeeded');
      };
    }

    // Observes the given property on the context and
    // tells the Ember._HandlebarsBoundView to re-render. If property
    // is an empty string, we are printing the current context
    // object ({{this}}) so updating it is not our responsibility.
    if (normalized.path !== '') {
      view.registerObserver(normalized.root, normalized.path, observer);
      if (childProperties) {
        for (i=0; i<childProperties.length; i++) {
          view.registerObserver(normalized.root, normalized.path+'.'+childProperties[i], observer);
        }
      }
    }
  } else {
    // The object is not observable, so just render it out and
    // be done with it.
    data.buffer.push(handlebarsGet(currentContext, property, options));
  }
}

function simpleBind(property, options) {
  var data = options.data,
      view = data.view,
      currentContext = this,
      normalized, observer;

  normalized = normalizePath(currentContext, property, data);

  // Set up observers for observable objects
  if ('object' === typeof this) {
    if (data.insideGroup) {
      observer = function() {
        Ember.run.once(view, 'rerender');
      };

      var result = handlebarsGet(currentContext, property, options);
      if (result === null || result === undefined) { result = ""; }
      data.buffer.push(result);
    } else {
      var bindView = new Ember._SimpleHandlebarsView(
        property, currentContext, !options.hash.unescaped, options.data
      );

      bindView._parentView = view;
      view.appendChild(bindView);

      observer = function() {
        Ember.run.scheduleOnce('render', bindView, 'rerender');
      };
    }

    // Observes the given property on the context and
    // tells the Ember._HandlebarsBoundView to re-render. If property
    // is an empty string, we are printing the current context
    // object ({{this}}) so updating it is not our responsibility.
    if (normalized.path !== '') {
      view.registerObserver(normalized.root, normalized.path, observer);
    }
  } else {
    // The object is not observable, so just render it out and
    // be done with it.
    data.buffer.push(handlebarsGet(currentContext, property, options));
  }
}

/**
  @private

  '_triageMustache' is used internally select between a binding and helper for
  the given context. Until this point, it would be hard to determine if the
  mustache is a property reference or a regular helper reference. This triage
  helper resolves that.

  This would not be typically invoked by directly.

  @method _triageMustache
  @for Ember.Handlebars.helpers
  @param {String} property Property/helperID to triage
  @param {Function} fn Context to provide for rendering
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('_triageMustache', function(property, fn) {
  Ember.assert("You cannot pass more than one argument to the _triageMustache helper", arguments.length <= 2);
  if (helpers[property]) {
    return helpers[property].call(this, fn);
  }
  else {
    return helpers.bind.apply(this, arguments);
  }
});

/**
  @private

  `bind` can be used to display a value, then update that value if it
  changes. For example, if you wanted to print the `title` property of
  `content`:

  ```handlebars
  {{bind "content.title"}}
  ```

  This will return the `title` property as a string, then create a new observer
  at the specified path. If it changes, it will update the value in DOM. Note
  that if you need to support IE7 and IE8 you must modify the model objects
  properties using `Ember.get()` and `Ember.set()` for this to work as it
  relies on Ember's KVO system. For all other browsers this will be handled for
  you automatically.

  @method bind
  @for Ember.Handlebars.helpers
  @param {String} property Property to bind
  @param {Function} fn Context to provide for rendering
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('bind', function(property, options) {
  Ember.assert("You cannot pass more than one argument to the bind helper", arguments.length <= 2);

  var context = (options.contexts && options.contexts[0]) || this;

  if (!options.fn) {
    return simpleBind.call(context, property, options);
  }

  return bind.call(context, property, options, false, function(result) {
    return !Ember.isNone(result);
  });
});

/**
  @private

  Use the `boundIf` helper to create a conditional that re-evaluates
  whenever the truthiness of the bound value changes.

  ```handlebars
  {{#boundIf "content.shouldDisplayTitle"}}
    {{content.title}}
  {{/boundIf}}
  ```

  @method boundIf
  @for Ember.Handlebars.helpers
  @param {String} property Property to bind
  @param {Function} fn Context to provide for rendering
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('boundIf', function(property, fn) {
  var context = (fn.contexts && fn.contexts[0]) || this;
  var func = function(result) {
    var truthy = result && get(result, 'isTruthy');
    if (typeof truthy === 'boolean') { return truthy; }

    if (Ember.isArray(result)) {
      return get(result, 'length') !== 0;
    } else {
      return !!result;
    }
  };

  return bind.call(context, property, fn, true, func, func, ['isTruthy', 'length']);
});

/**
  @method with
  @for Ember.Handlebars.helpers
  @param {Function} context
  @param {Hash} options
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('with', function(context, options) {
  if (arguments.length === 4) {
    var keywordName, path, rootPath, normalized;

    Ember.assert("If you pass more than one argument to the with helper, it must be in the form #with foo as bar", arguments[1] === "as");
    options = arguments[3];
    keywordName = arguments[2];
    path = arguments[0];

    Ember.assert("You must pass a block to the with helper", options.fn && options.fn !== Handlebars.VM.noop);

    if (Ember.isGlobalPath(path)) {
      Ember.bind(options.data.keywords, keywordName, path);
    } else {
      normalized = normalizePath(this, path, options.data);
      path = normalized.path;
      rootPath = normalized.root;

      // This is a workaround for the fact that you cannot bind separate objects
      // together. When we implement that functionality, we should use it here.
      var contextKey = Ember.$.expando + Ember.guidFor(rootPath);
      options.data.keywords[contextKey] = rootPath;

      // if the path is '' ("this"), just bind directly to the current context
      var contextPath = path ? contextKey + '.' + path : contextKey;
      Ember.bind(options.data.keywords, keywordName, contextPath);
    }

    return bind.call(this, path, options, true, function(result) {
      return !Ember.isNone(result);
    });
  } else {
    Ember.assert("You must pass exactly one argument to the with helper", arguments.length === 2);
    Ember.assert("You must pass a block to the with helper", options.fn && options.fn !== Handlebars.VM.noop);
    return helpers.bind.call(options.contexts[0], context, options);
  }
});


/**
  See `boundIf`

  @method if
  @for Ember.Handlebars.helpers
  @param {Function} context
  @param {Hash} options
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('if', function(context, options) {
  Ember.assert("You must pass exactly one argument to the if helper", arguments.length === 2);
  Ember.assert("You must pass a block to the if helper", options.fn && options.fn !== Handlebars.VM.noop);

  return helpers.boundIf.call(options.contexts[0], context, options);
});

/**
  @method unless
  @for Ember.Handlebars.helpers
  @param {Function} context
  @param {Hash} options
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('unless', function(context, options) {
  Ember.assert("You must pass exactly one argument to the unless helper", arguments.length === 2);
  Ember.assert("You must pass a block to the unless helper", options.fn && options.fn !== Handlebars.VM.noop);

  var fn = options.fn, inverse = options.inverse;

  options.fn = inverse;
  options.inverse = fn;

  return helpers.boundIf.call(options.contexts[0], context, options);
});

/**
  `bindAttr` allows you to create a binding between DOM element attributes and
  Ember objects. For example:

  ```handlebars
  <img {{bindAttr src="imageUrl" alt="imageTitle"}}>
  ```

  The above handlebars template will fill the `<img>`'s `src` attribute will
  the value of the property referenced with `"imageUrl"` and its `alt`
  attribute with the value of the property referenced with `"imageTitle"`.

  If the rendering context of this template is the following object:

  ```javascript
  {
    imageUrl: 'http://lolcats.info/haz-a-funny',
    imageTitle: 'A humorous image of a cat'
  }
  ```

  The resulting HTML output will be:

  ```html
  <img src="http://lolcats.info/haz-a-funny" alt="A humorous image of a cat">
  ```

  `bindAttr` cannot redeclare existing DOM element attributes. The use of `src`
  in the following `bindAttr` example will be ignored and the hard coded value
  of `src="/failwhale.gif"` will take precedence:

  ```handlebars
  <img src="/failwhale.gif" {{bindAttr src="imageUrl" alt="imageTitle"}}>
  ```

  ### `bindAttr` and the `class` attribute

  `bindAttr` supports a special syntax for handling a number of cases unique
  to the `class` DOM element attribute. The `class` attribute combines
  multiple discreet values into a single attribute as a space-delimited
  list of strings. Each string can be:

  * a string return value of an object's property.
  * a boolean return value of an object's property
  * a hard-coded value

  A string return value works identically to other uses of `bindAttr`. The
  return value of the property will become the value of the attribute. For
  example, the following view and template:

  ```javascript
    AView = Ember.View.extend({
      someProperty: function(){
        return "aValue";
      }.property()
    })
  ```

  ```handlebars
  <img {{bindAttr class="view.someProperty}}>
  ```

  Result in the following rendered output:

  ```html
  <img class="aValue">
  ```

  A boolean return value will insert a specified class name if the property
  returns `true` and remove the class name if the property returns `false`.

  A class name is provided via the syntax
  `somePropertyName:class-name-if-true`.

  ```javascript
  AView = Ember.View.extend({
    someBool: true
  })
  ```

  ```handlebars
  <img {{bindAttr class="view.someBool:class-name-if-true"}}>
  ```

  Result in the following rendered output:

  ```html
  <img class="class-name-if-true">
  ```

  An additional section of the binding can be provided if you want to
  replace the existing class instead of removing it when the boolean
  value changes:

  ```handlebars
  <img {{bindAttr class="view.someBool:class-name-if-true:class-name-if-false"}}>
  ```

  A hard-coded value can be used by prepending `:` to the desired
  class name: `:class-name-to-always-apply`.

  ```handlebars
  <img {{bindAttr class=":class-name-to-always-apply"}}>
  ```

  Results in the following rendered output:

  ```html
  <img class=":class-name-to-always-apply">
  ```

  All three strategies - string return value, boolean return value, and
  hard-coded value – can be combined in a single declaration:

  ```handlebars
  <img {{bindAttr class=":class-name-to-always-apply view.someBool:class-name-if-true view.someProperty"}}>
  ```

  @method bindAttr
  @for Ember.Handlebars.helpers
  @param {Hash} options
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('bindAttr', function(options) {

  var attrs = options.hash;

  Ember.assert("You must specify at least one hash argument to bindAttr", !!Ember.keys(attrs).length);

  var view = options.data.view;
  var ret = [];
  var ctx = this;

  // Generate a unique id for this element. This will be added as a
  // data attribute to the element so it can be looked up when
  // the bound property changes.
  var dataId = ++Ember.uuid;

  // Handle classes differently, as we can bind multiple classes
  var classBindings = attrs['class'];
  if (classBindings !== null && classBindings !== undefined) {
    var classResults = EmberHandlebars.bindClasses(this, classBindings, view, dataId, options);

    ret.push('class="' + Handlebars.Utils.escapeExpression(classResults.join(' ')) + '"');
    delete attrs['class'];
  }

  var attrKeys = Ember.keys(attrs);

  // For each attribute passed, create an observer and emit the
  // current value of the property as an attribute.
  forEach.call(attrKeys, function(attr) {
    var path = attrs[attr],
        normalized;

    Ember.assert(fmt("You must provide a String for a bound attribute, not %@", [path]), typeof path === 'string');

    normalized = normalizePath(ctx, path, options.data);

    var value = (path === 'this') ? normalized.root : handlebarsGet(ctx, path, options),
        type = Ember.typeOf(value);

    Ember.assert(fmt("Attributes must be numbers, strings or booleans, not %@", [value]), value === null || value === undefined || type === 'number' || type === 'string' || type === 'boolean');

    var observer, invoker;

    observer = function observer() {
      var result = handlebarsGet(ctx, path, options);

      Ember.assert(fmt("Attributes must be numbers, strings or booleans, not %@", [result]), result === null || result === undefined || typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean');

      var elem = view.$("[data-bindattr-" + dataId + "='" + dataId + "']");

      // If we aren't able to find the element, it means the element
      // to which we were bound has been removed from the view.
      // In that case, we can assume the template has been re-rendered
      // and we need to clean up the observer.
      if (!elem || elem.length === 0) {
        Ember.removeObserver(normalized.root, normalized.path, invoker);
        return;
      }

      Ember.View.applyAttributeBindings(elem, attr, result);
    };

    // Add an observer to the view for when the property changes.
    // When the observer fires, find the element using the
    // unique data id and update the attribute to the new value.
    // Note: don't add observer when path is 'this' or path
    // is whole keyword e.g. {{#each x in list}} ... {{bindAttr attr="x"}}
    if (path !== 'this' && !(normalized.isKeyword && normalized.path === '' )) {
      view.registerObserver(normalized.root, normalized.path, observer);
    }

    // if this changes, also change the logic in ember-views/lib/views/view.js
    if ((type === 'string' || (type === 'number' && !isNaN(value)))) {
      ret.push(attr + '="' + Handlebars.Utils.escapeExpression(value) + '"');
    } else if (value && type === 'boolean') {
      // The developer controls the attr name, so it should always be safe
      ret.push(attr + '="' + attr + '"');
    }
  }, this);

  // Add the unique identifier
  // NOTE: We use all lower-case since Firefox has problems with mixed case in SVG
  ret.push('data-bindattr-' + dataId + '="' + dataId + '"');
  return new EmberHandlebars.SafeString(ret.join(' '));
});

/**
  @private

  Helper that, given a space-separated string of property paths and a context,
  returns an array of class names. Calling this method also has the side
  effect of setting up observers at those property paths, such that if they
  change, the correct class name will be reapplied to the DOM element.

  For example, if you pass the string "fooBar", it will first look up the
  "fooBar" value of the context. If that value is true, it will add the
  "foo-bar" class to the current element (i.e., the dasherized form of
  "fooBar"). If the value is a string, it will add that string as the class.
  Otherwise, it will not add any new class name.

  @method bindClasses
  @for Ember.Handlebars
  @param {Ember.Object} context The context from which to lookup properties
  @param {String} classBindings A string, space-separated, of class bindings
    to use
  @param {Ember.View} view The view in which observers should look for the
    element to update
  @param {Srting} bindAttrId Optional bindAttr id used to lookup elements
  @return {Array} An array of class names to add
*/
EmberHandlebars.bindClasses = function(context, classBindings, view, bindAttrId, options) {
  var ret = [], newClass, value, elem;

  // Helper method to retrieve the property from the context and
  // determine which class string to return, based on whether it is
  // a Boolean or not.
  var classStringForPath = function(root, parsedPath, options) {
    var val,
        path = parsedPath.path;

    if (path === 'this') {
      val = root;
    } else if (path === '') {
      val = true;
    } else {
      val = handlebarsGet(root, path, options);
    }

    return Ember.View._classStringForValue(path, val, parsedPath.className, parsedPath.falsyClassName);
  };

  // For each property passed, loop through and setup
  // an observer.
  forEach.call(classBindings.split(' '), function(binding) {

    // Variable in which the old class value is saved. The observer function
    // closes over this variable, so it knows which string to remove when
    // the property changes.
    var oldClass;

    var observer, invoker;

    var parsedPath = Ember.View._parsePropertyPath(binding),
        path = parsedPath.path,
        pathRoot = context,
        normalized;

    if (path !== '' && path !== 'this') {
      normalized = normalizePath(context, path, options.data);

      pathRoot = normalized.root;
      path = normalized.path;
    }

    // Set up an observer on the context. If the property changes, toggle the
    // class name.
    observer = function() {
      // Get the current value of the property
      newClass = classStringForPath(context, parsedPath, options);
      elem = bindAttrId ? view.$("[data-bindattr-" + bindAttrId + "='" + bindAttrId + "']") : view.$();

      // If we can't find the element anymore, a parent template has been
      // re-rendered and we've been nuked. Remove the observer.
      if (!elem || elem.length === 0) {
        Ember.removeObserver(pathRoot, path, invoker);
      } else {
        // If we had previously added a class to the element, remove it.
        if (oldClass) {
          elem.removeClass(oldClass);
        }

        // If necessary, add a new class. Make sure we keep track of it so
        // it can be removed in the future.
        if (newClass) {
          elem.addClass(newClass);
          oldClass = newClass;
        } else {
          oldClass = null;
        }
      }
    };

    if (path !== '' && path !== 'this') {
      view.registerObserver(pathRoot, path, observer);
    }

    // We've already setup the observer; now we just need to figure out the
    // correct behavior right now on the first pass through.
    value = classStringForPath(context, parsedPath, options);

    if (value) {
      ret.push(value);

      // Make sure we save the current value so that it can be removed if the
      // observer fires.
      oldClass = value;
    }
  });

  return ret;
};


})();



(function() {
/*globals Handlebars */

// TODO: Don't require the entire module
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;
var EmberHandlebars = Ember.Handlebars;

EmberHandlebars.ViewHelper = Ember.Object.create({

  propertiesFromHTMLOptions: function(options, thisContext) {
    var hash = options.hash, data = options.data;
    var extensions = {},
        classes = hash['class'],
        dup = false;

    if (hash.id) {
      extensions.elementId = hash.id;
      dup = true;
    }

    if (hash.tag) {
      extensions.tagName = hash.tag;
      dup = true;
    }

    if (classes) {
      classes = classes.split(' ');
      extensions.classNames = classes;
      dup = true;
    }

    if (hash.classBinding) {
      extensions.classNameBindings = hash.classBinding.split(' ');
      dup = true;
    }

    if (hash.classNameBindings) {
      if (extensions.classNameBindings === undefined) extensions.classNameBindings = [];
      extensions.classNameBindings = extensions.classNameBindings.concat(hash.classNameBindings.split(' '));
      dup = true;
    }

    if (hash.attributeBindings) {
      Ember.assert("Setting 'attributeBindings' via Handlebars is not allowed. Please subclass Ember.View and set it there instead.");
      extensions.attributeBindings = null;
      dup = true;
    }

    if (dup) {
      hash = Ember.$.extend({}, hash);
      delete hash.id;
      delete hash.tag;
      delete hash['class'];
      delete hash.classBinding;
    }

    // Set the proper context for all bindings passed to the helper. This applies to regular attribute bindings
    // as well as class name bindings. If the bindings are local, make them relative to the current context
    // instead of the view.
    var path;

    // Evaluate the context of regular attribute bindings:
    for (var prop in hash) {
      if (!hash.hasOwnProperty(prop)) { continue; }

      // Test if the property ends in "Binding"
      if (Ember.IS_BINDING.test(prop) && typeof hash[prop] === 'string') {
        path = this.contextualizeBindingPath(hash[prop], data);
        if (path) { hash[prop] = path; }
      }
    }

    // Evaluate the context of class name bindings:
    if (extensions.classNameBindings) {
      for (var b in extensions.classNameBindings) {
        var full = extensions.classNameBindings[b];
        if (typeof full === 'string') {
          // Contextualize the path of classNameBinding so this:
          //
          //     classNameBinding="isGreen:green"
          //
          // is converted to this:
          //
          //     classNameBinding="_parentView.context.isGreen:green"
          var parsedPath = Ember.View._parsePropertyPath(full);
          path = this.contextualizeBindingPath(parsedPath.path, data);
          if (path) { extensions.classNameBindings[b] = path + parsedPath.classNames; }
        }
      }
    }

    return Ember.$.extend(hash, extensions);
  },

  // Transform bindings from the current context to a context that can be evaluated within the view.
  // Returns null if the path shouldn't be changed.
  //
  // TODO: consider the addition of a prefix that would allow this method to return `path`.
  contextualizeBindingPath: function(path, data) {
    var normalized = Ember.Handlebars.normalizePath(null, path, data);
    if (normalized.isKeyword) {
      return 'templateData.keywords.' + path;
    } else if (Ember.isGlobalPath(path)) {
      return null;
    } else if (path === 'this') {
      return '_parentView.context';
    } else {
      return '_parentView.context.' + path;
    }
  },

  helper: function(thisContext, path, options) {
    var inverse = options.inverse,
        data = options.data,
        view = data.view,
        fn = options.fn,
        hash = options.hash,
        newView;

    if ('string' === typeof path) {
      newView = EmberHandlebars.get(thisContext, path, options);
      Ember.assert("Unable to find view at path '" + path + "'", !!newView);
    } else {
      newView = path;
    }

    Ember.assert(Ember.String.fmt('You must pass a view to the #view helper, not %@ (%@)', [path, newView]), Ember.View.detect(newView) || Ember.View.detectInstance(newView));

    var viewOptions = this.propertiesFromHTMLOptions(options, thisContext);
    var currentView = data.view;
    viewOptions.templateData = options.data;
    var newViewProto = newView.proto ? newView.proto() : newView;

    if (fn) {
      Ember.assert("You cannot provide a template block if you also specified a templateName", !get(viewOptions, 'templateName') && !get(newViewProto, 'templateName'));
      viewOptions.template = fn;
    }

    // We only want to override the `_context` computed property if there is
    // no specified controller. See View#_context for more information.
    if (!newViewProto.controller && !newViewProto.controllerBinding && !viewOptions.controller && !viewOptions.controllerBinding) {
      viewOptions._context = thisContext;
    }

    currentView.appendChild(newView, viewOptions);
  }
});

/**
  `{{view}}` inserts a new instance of `Ember.View` into a template passing its
  options to the `Ember.View`'s `create` method and using the supplied block as
  the view's own template.

  An empty `<body>` and the following template:

  ```handlebars
  A span:
  {{#view tagName="span"}}
    hello.
  {{/view}}
  ```

  Will result in HTML structure:

  ```html
  <body>
    <!-- Note: the handlebars template script
         also results in a rendered Ember.View
         which is the outer <div> here -->

    <div class="ember-view">
      A span:
      <span id="ember1" class="ember-view">
        Hello.
      </span>
    </div>
  </body>
  ```

  ### `parentView` setting

  The `parentView` property of the new `Ember.View` instance created through
  `{{view}}` will be set to the `Ember.View` instance of the template where
  `{{view}}` was called.

  ```javascript
  aView = Ember.View.create({
    template: Ember.Handlebars.compile("{{#view}} my parent: {{parentView.elementId}} {{/view}}")
  });

  aView.appendTo('body');
  ```

  Will result in HTML structure:

  ```html
  <div id="ember1" class="ember-view">
    <div id="ember2" class="ember-view">
      my parent: ember1
    </div>
  </div>
  ```

  ### Setting CSS id and class attributes

  The HTML `id` attribute can be set on the `{{view}}`'s resulting element with
  the `id` option. This option will _not_ be passed to `Ember.View.create`.

  ```handlebars
  {{#view tagName="span" id="a-custom-id"}}
    hello.
  {{/view}}
  ```

  Results in the following HTML structure:

  ```html
  <div class="ember-view">
    <span id="a-custom-id" class="ember-view">
      hello.
    </span>
  </div>
  ```

  The HTML `class` attribute can be set on the `{{view}}`'s resulting element
  with the `class` or `classNameBindings` options. The `class` option will
  directly set the CSS `class` attribute and will not be passed to
  `Ember.View.create`. `classNameBindings` will be passed to `create` and use
  `Ember.View`'s class name binding functionality:

  ```handlebars
  {{#view tagName="span" class="a-custom-class"}}
    hello.
  {{/view}}
  ```

  Results in the following HTML structure:

  ```html
  <div class="ember-view">
    <span id="ember2" class="ember-view a-custom-class">
      hello.
    </span>
  </div>
  ```

  ### Supplying a different view class

  `{{view}}` can take an optional first argument before its supplied options to
  specify a path to a custom view class.

  ```handlebars
  {{#view "MyApp.CustomView"}}
    hello.
  {{/view}}
  ```

  The first argument can also be a relative path. Ember will search for the
  view class starting at the `Ember.View` of the template where `{{view}}` was
  used as the root object:

  ```javascript
  MyApp = Ember.Application.create({});
  MyApp.OuterView = Ember.View.extend({
    innerViewClass: Ember.View.extend({
      classNames: ['a-custom-view-class-as-property']
    }),
    template: Ember.Handlebars.compile('{{#view "innerViewClass"}} hi {{/view}}')
  });

  MyApp.OuterView.create().appendTo('body');
  ```

  Will result in the following HTML:

  ```html
  <div id="ember1" class="ember-view">
    <div id="ember2" class="ember-view a-custom-view-class-as-property">
      hi
    </div>
  </div>
  ```

  ### Blockless use

  If you supply a custom `Ember.View` subclass that specifies its own template
  or provide a `templateName` option to `{{view}}` it can be used without
  supplying a block. Attempts to use both a `templateName` option and supply a
  block will throw an error.

  ```handlebars
  {{view "MyApp.ViewWithATemplateDefined"}}
  ```

  ### `viewName` property

  You can supply a `viewName` option to `{{view}}`. The `Ember.View` instance
  will be referenced as a property of its parent view by this name.

  ```javascript
  aView = Ember.View.create({
    template: Ember.Handlebars.compile('{{#view viewName="aChildByName"}} hi {{/view}}')
  });

  aView.appendTo('body');
  aView.get('aChildByName') // the instance of Ember.View created by {{view}} helper
  ```

  @method view
  @for Ember.Handlebars.helpers
  @param {String} path
  @param {Hash} options
  @return {String} HTML string
*/
EmberHandlebars.registerHelper('view', function(path, options) {
  Ember.assert("The view helper only takes a single argument", arguments.length <= 2);

  // If no path is provided, treat path param as options.
  if (path && path.data && path.data.isRenderData) {
    options = path;
    path = "Ember.View";
  }

  return EmberHandlebars.ViewHelper.helper(this, path, options);
});


})();



(function() {
/*globals Handlebars */

// TODO: Don't require all of this module
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, handlebarsGet = Ember.Handlebars.get, fmt = Ember.String.fmt;

/**
  `{{collection}}` is a `Ember.Handlebars` helper for adding instances of
  `Ember.CollectionView` to a template. See `Ember.CollectionView` for
  additional information on how a `CollectionView` functions.

  `{{collection}}`'s primary use is as a block helper with a `contentBinding`
  option pointing towards an `Ember.Array`-compatible object. An `Ember.View`
  instance will be created for each item in its `content` property. Each view
  will have its own `content` property set to the appropriate item in the
  collection.

  The provided block will be applied as the template for each item's view.

  Given an empty `<body>` the following template:

  ```handlebars
  {{#collection contentBinding="App.items"}}
    Hi {{view.content.name}}
  {{/collection}}
  ```

  And the following application code

  ```javascript
  App = Ember.Application.create()
  App.items = [
    Ember.Object.create({name: 'Dave'}),
    Ember.Object.create({name: 'Mary'}),
    Ember.Object.create({name: 'Sara'})
  ]
  ```

  Will result in the HTML structure below

  ```html
  <div class="ember-view">
    <div class="ember-view">Hi Dave</div>
    <div class="ember-view">Hi Mary</div>
    <div class="ember-view">Hi Sara</div>
  </div>
  ```

  ### Blockless Use

  If you provide an `itemViewClass` option that has its own `template` you can
  omit the block.

  The following template:

  ```handlebars
  {{collection contentBinding="App.items" itemViewClass="App.AnItemView"}}
  ```

  And application code

  ```javascript
  App = Ember.Application.create();
  App.items = [
    Ember.Object.create({name: 'Dave'}),
    Ember.Object.create({name: 'Mary'}),
    Ember.Object.create({name: 'Sara'})
  ];

  App.AnItemView = Ember.View.extend({
    template: Ember.Handlebars.compile("Greetings {{view.content.name}}")
  });
  ```

  Will result in the HTML structure below

  ```html
  <div class="ember-view">
    <div class="ember-view">Greetings Dave</div>
    <div class="ember-view">Greetings Mary</div>
    <div class="ember-view">Greetings Sara</div>
  </div>
  ```

  ### Specifying a CollectionView subclass

  By default the `{{collection}}` helper will create an instance of
  `Ember.CollectionView`. You can supply a `Ember.CollectionView` subclass to
  the helper by passing it as the first argument:

  ```handlebars
  {{#collection App.MyCustomCollectionClass contentBinding="App.items"}}
    Hi {{view.content.name}}
  {{/collection}}
  ```

  ### Forwarded `item.*`-named Options

  As with the `{{view}}`, helper options passed to the `{{collection}}` will be
  set on the resulting `Ember.CollectionView` as properties. Additionally,
  options prefixed with `item` will be applied to the views rendered for each
  item (note the camelcasing):

  ```handlebars
  {{#collection contentBinding="App.items"
                itemTagName="p"
                itemClassNames="greeting"}}
    Howdy {{view.content.name}}
  {{/collection}}
  ```

  Will result in the following HTML structure:

  ```html
  <div class="ember-view">
    <p class="ember-view greeting">Howdy Dave</p>
    <p class="ember-view greeting">Howdy Mary</p>
    <p class="ember-view greeting">Howdy Sara</p>
  </div>
  ```

  @method collection
  @for Ember.Handlebars.helpers
  @param {String} path
  @param {Hash} options
  @return {String} HTML string
  @deprecated Use `{{each}}` helper instead.
*/
Ember.Handlebars.registerHelper('collection', function(path, options) {
  Ember.deprecate("Using the {{collection}} helper without specifying a class has been deprecated as the {{each}} helper now supports the same functionality.", path !== 'collection');

  // If no path is provided, treat path param as options.
  if (path && path.data && path.data.isRenderData) {
    options = path;
    path = undefined;
    Ember.assert("You cannot pass more than one argument to the collection helper", arguments.length === 1);
  } else {
    Ember.assert("You cannot pass more than one argument to the collection helper", arguments.length === 2);
  }

  var fn = options.fn;
  var data = options.data;
  var inverse = options.inverse;
  var view = options.data.view;

  // If passed a path string, convert that into an object.
  // Otherwise, just default to the standard class.
  var collectionClass;
  collectionClass = path ? handlebarsGet(this, path, options) : Ember.CollectionView;
  Ember.assert(fmt("%@ #collection: Could not find collection class %@", [data.view, path]), !!collectionClass);

  var hash = options.hash, itemHash = {}, match;

  // Extract item view class if provided else default to the standard class
  var itemViewClass, itemViewPath = hash.itemViewClass;
  var collectionPrototype = collectionClass.proto();
  delete hash.itemViewClass;
  itemViewClass = itemViewPath ? handlebarsGet(collectionPrototype, itemViewPath, options) : collectionPrototype.itemViewClass;
  Ember.assert(fmt("%@ #collection: Could not find itemViewClass %@", [data.view, itemViewPath]), !!itemViewClass);

  // Go through options passed to the {{collection}} helper and extract options
  // that configure item views instead of the collection itself.
  for (var prop in hash) {
    if (hash.hasOwnProperty(prop)) {
      match = prop.match(/^item(.)(.*)$/);

      if(match && prop !== 'itemController') {
        // Convert itemShouldFoo -> shouldFoo
        itemHash[match[1].toLowerCase() + match[2]] = hash[prop];
        // Delete from hash as this will end up getting passed to the
        // {{view}} helper method.
        delete hash[prop];
      }
    }
  }

  var tagName = hash.tagName || collectionPrototype.tagName;

  if (fn) {
    itemHash.template = fn;
    delete options.fn;
  }

  var emptyViewClass;
  if (inverse && inverse !== Handlebars.VM.noop) {
    emptyViewClass = get(collectionPrototype, 'emptyViewClass');
    emptyViewClass = emptyViewClass.extend({
          template: inverse,
          tagName: itemHash.tagName
    });
  } else if (hash.emptyViewClass) {
    emptyViewClass = handlebarsGet(this, hash.emptyViewClass, options);
  }
  if (emptyViewClass) { hash.emptyView = emptyViewClass; }

  if(!hash.keyword){
    itemHash._context = Ember.computed.alias('content');
  }

  var viewString = view.toString();

  var viewOptions = Ember.Handlebars.ViewHelper.propertiesFromHTMLOptions({ data: data, hash: itemHash }, this);
  hash.itemViewClass = itemViewClass.extend(viewOptions);

  return Ember.Handlebars.helpers.view.call(this, collectionClass, options);
});


})();



(function() {
/*globals Handlebars */
/**
@module ember
@submodule ember-handlebars
*/

var handlebarsGet = Ember.Handlebars.get;

/**
  `unbound` allows you to output a property without binding. *Important:* The
  output will not be updated if the property changes. Use with caution.

  ```handlebars
  <div>{{unbound somePropertyThatDoesntChange}}</div>
  ```

  `unbound` can also be used in conjunction with a bound helper to
  render it in its unbound form:

  ```handlebars
  <div>{{unbound helperName somePropertyThatDoesntChange}}</div>
  ```

  @method unbound
  @for Ember.Handlebars.helpers
  @param {String} property
  @return {String} HTML string
*/
Ember.Handlebars.registerHelper('unbound', function(property, fn) {
  var options = arguments[arguments.length - 1], helper, context, out;

  if(arguments.length > 2) {
    // Unbound helper call.
    options.data.isUnbound = true;
    helper = Ember.Handlebars.helpers[arguments[0]] || Ember.Handlebars.helperMissing;
    out = helper.apply(this, Array.prototype.slice.call(arguments, 1));
    delete options.data.isUnbound;
    return out;
  }

  context = (fn.contexts && fn.contexts[0]) || this;
  return handlebarsGet(context, property, fn);
});

})();



(function() {
/*jshint debug:true*/
/**
@module ember
@submodule ember-handlebars
*/

var handlebarsGet = Ember.Handlebars.get, normalizePath = Ember.Handlebars.normalizePath;

/**
  `log` allows you to output the value of a value in the current rendering
  context.

  ```handlebars
  {{log myVariable}}
  ```

  @method log
  @for Ember.Handlebars.helpers
  @param {String} property
*/
Ember.Handlebars.registerHelper('log', function(property, options) {
  var context = (options.contexts && options.contexts[0]) || this,
      normalized = normalizePath(context, property, options.data),
      pathRoot = normalized.root,
      path = normalized.path,
      value = (path === 'this') ? pathRoot : handlebarsGet(pathRoot, path, options);
  Ember.Logger.log(value);
});

/**
  Execute the `debugger` statement in the current context.

  ```handlebars
  {{debugger}}
  ```

  @method debugger
  @for Ember.Handlebars.helpers
  @param {String} property
*/
Ember.Handlebars.registerHelper('debugger', function() {
  debugger;
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

Ember.Handlebars.EachView = Ember.CollectionView.extend(Ember._Metamorph, {
  init: function() {
    var itemController = get(this, 'itemController');
    var binding;

    if (itemController) {
      var controller = Ember.ArrayController.create();
      set(controller, 'itemController', itemController);
      set(controller, 'container', get(this, 'controller.container'));
      set(controller, '_eachView', this);
      set(controller, 'target', get(this, 'controller'));

      this.disableContentObservers(function() {
        set(this, 'content', controller);
        binding = new Ember.Binding('content', '_eachView.dataSource').oneWay();
        binding.connect(controller);
      });

      set(this, '_arrayController', controller);
    } else {
      this.disableContentObservers(function() {
        binding = new Ember.Binding('content', 'dataSource').oneWay();
        binding.connect(this);
      });
    }

    return this._super();
  },

  disableContentObservers: function(callback) {
    Ember.removeBeforeObserver(this, 'content', null, '_contentWillChange');
    Ember.removeObserver(this, 'content', null, '_contentDidChange');

    callback.call(this);

    Ember.addBeforeObserver(this, 'content', null, '_contentWillChange');
    Ember.addObserver(this, 'content', null, '_contentDidChange');
  },

  itemViewClass: Ember._MetamorphView,
  emptyViewClass: Ember._MetamorphView,

  createChildView: function(view, attrs) {
    view = this._super(view, attrs);

    // At the moment, if a container view subclass wants
    // to insert keywords, it is responsible for cloning
    // the keywords hash. This will be fixed momentarily.
    var keyword = get(this, 'keyword');
    var content = get(view, 'content');

    if (keyword) {
      var data = get(view, 'templateData');

      data = Ember.copy(data);
      data.keywords = view.cloneKeywords();
      set(view, 'templateData', data);

      // In this case, we do not bind, because the `content` of
      // a #each item cannot change.
      data.keywords[keyword] = content;
    }

    // If {{#each}} is looping over an array of controllers,
    // point each child view at their respective controller.
    if (content && get(content, 'isController')) {
      set(view, 'controller', content);
    }

    return view;
  },

  destroy: function() {
    if (!this._super()) { return; }

    var arrayController = get(this, '_arrayController');

    if (arrayController) {
      arrayController.destroy();
    }

    return this;
  }
});

var GroupedEach = Ember.Handlebars.GroupedEach = function(context, path, options) {
  var self = this,
      normalized = Ember.Handlebars.normalizePath(context, path, options.data);

  this.context = context;
  this.path = path;
  this.options = options;
  this.template = options.fn;
  this.containingView = options.data.view;
  this.normalizedRoot = normalized.root;
  this.normalizedPath = normalized.path;
  this.content = this.lookupContent();

  this.addContentObservers();
  this.addArrayObservers();

  this.containingView.on('willClearRender', function() {
    self.destroy();
  });
};

GroupedEach.prototype = {
  contentWillChange: function() {
    this.removeArrayObservers();
  },

  contentDidChange: function() {
    this.content = this.lookupContent();
    this.addArrayObservers();
    this.rerenderContainingView();
  },

  contentArrayWillChange: Ember.K,

  contentArrayDidChange: function() {
    this.rerenderContainingView();
  },

  lookupContent: function() {
    return Ember.Handlebars.get(this.normalizedRoot, this.normalizedPath, this.options);
  },

  addArrayObservers: function() {
    this.content.addArrayObserver(this, {
      willChange: 'contentArrayWillChange',
      didChange: 'contentArrayDidChange'
    });
  },

  removeArrayObservers: function() {
    this.content.removeArrayObserver(this, {
      willChange: 'contentArrayWillChange',
      didChange: 'contentArrayDidChange'
    });
  },

  addContentObservers: function() {
    Ember.addBeforeObserver(this.normalizedRoot, this.normalizedPath, this, this.contentWillChange);
    Ember.addObserver(this.normalizedRoot, this.normalizedPath, this, this.contentDidChange);
  },

  removeContentObservers: function() {
    Ember.removeBeforeObserver(this.normalizedRoot, this.normalizedPath, this.contentWillChange);
    Ember.removeObserver(this.normalizedRoot, this.normalizedPath, this.contentDidChange);
  },

  render: function() {
    var content = this.content,
        contentLength = get(content, 'length'),
        data = this.options.data,
        template = this.template;

    data.insideEach = true;
    for (var i = 0; i < contentLength; i++) {
      template(content.objectAt(i), { data: data });
    }
  },

  rerenderContainingView: function() {
    Ember.run.scheduleOnce('render', this.containingView, 'rerender');
  },

  destroy: function() {
    this.removeContentObservers();
    this.removeArrayObservers();
  }
};

/**
  The `{{#each}}` helper loops over elements in a collection, rendering its
  block once for each item. It is an extension of the base Handlebars `{{#each}}`
  helper:

  ```javascript
  Developers = [{name: 'Yehuda'},{name: 'Tom'}, {name: 'Paul'}];
  ```

  ```handlebars
  {{#each Developers}}
    {{name}}
  {{/each}}
  ```

  `{{each}}` supports an alternative syntax with element naming:

  ```handlebars
  {{#each person in Developers}}
    {{person.name}}
  {{/each}}
  ```

  When looping over objects that do not have properties, `{{this}}` can be used
  to render the object:

  ```javascript
  DeveloperNames = ['Yehuda', 'Tom', 'Paul']
  ```

  ```handlebars
  {{#each DeveloperNames}}
    {{this}}
  {{/each}}
  ```
  ### {{else}} condition
  `{{#each}}` can have a matching `{{else}}`. The contents of this block will render
  if the collection is empty.

  ```
  {{#each person in Developers}}
    {{person.name}}
  {{else}}
    <p>Sorry, nobody is available for this task.</p>
  {{/each}}
  ```
  ### Specifying a View class for items
  If you provide an `itemViewClass` option that references a view class
  with its own `template` you can omit the block.

  The following template:

  ```handlebars
  {{#view App.MyView }}
    {{each view.items itemViewClass="App.AnItemView"}}
  {{/view}}
  ```

  And application code

  ```javascript
  App = Ember.Application.create({
    MyView: Ember.View.extend({
      items: [
        Ember.Object.create({name: 'Dave'}),
        Ember.Object.create({name: 'Mary'}),
        Ember.Object.create({name: 'Sara'})
      ]
    })
  });

  App.AnItemView = Ember.View.extend({
    template: Ember.Handlebars.compile("Greetings {{name}}")
  });
  ```

  Will result in the HTML structure below

  ```html
  <div class="ember-view">
    <div class="ember-view">Greetings Dave</div>
    <div class="ember-view">Greetings Mary</div>
    <div class="ember-view">Greetings Sara</div>
  </div>
  ```

  ### Representing each item with a Controller.
  By default the controller lookup within an `{{#each}}` block will be
  the controller of the template where the `{{#each}}` was used. If each
  item needs to be presented by a custom controller you can provide a
  `itemController` option which references a controller by lookup name.
  Each item in the loop will be wrapped in an instance of this controller
  and the item itself will be set to the `content` property of that controller.

  This is useful in cases where properties of model objects need transformation
  or synthesis for display:

  ```javascript
  App.DeveloperController = Ember.ObjectController.extend({
    isAvailableForHire: function(){
      return !this.get('content.isEmployed') && this.get('content.isSeekingWork');
    }.property('isEmployed', 'isSeekingWork')
  })
  ```

  ```handlebars
  {{#each person in developers itemController="developer"}}
    {{person.name}} {{#if person.isAvailableForHire}}Hire me!{{/if}}
  {{/each}}
  ```

  @method each
  @for Ember.Handlebars.helpers
  @param [name] {String} name for item (used with `in`)
  @param [path] {String} path
  @param [options] {Object} Handlebars key/value pairs of options
  @param [options.itemViewClass] {String} a path to a view class used for each item
  @param [options.itemController] {String} name of a controller to be created for each item
*/
Ember.Handlebars.registerHelper('each', function(path, options) {
  if (arguments.length === 4) {
    Ember.assert("If you pass more than one argument to the each helper, it must be in the form #each foo in bar", arguments[1] === "in");

    var keywordName = arguments[0];

    options = arguments[3];
    path = arguments[2];
    if (path === '') { path = "this"; }

    options.hash.keyword = keywordName;
  }

  options.hash.dataSourceBinding = path;
  // Set up emptyView as a metamorph with no tag
  //options.hash.emptyViewClass = Ember._MetamorphView;

  if (options.data.insideGroup && !options.hash.groupedRows && !options.hash.itemViewClass) {
    new Ember.Handlebars.GroupedEach(this, path, options).render();
  } else {
    return Ember.Handlebars.helpers.collection.call(this, 'Ember.Handlebars.EachView', options);
  }
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

/**
  `template` allows you to render a template from inside another template.
  This allows you to re-use the same template in multiple places. For example:

  ```html
  <script type="text/x-handlebars" data-template-name="logged_in_user">
    {{#with loggedInUser}}
      Last Login: {{lastLogin}}
      User Info: {{template "user_info"}}
    {{/with}}
  </script>
  ```

  ```html
  <script type="text/x-handlebars" data-template-name="user_info">
    Name: <em>{{name}}</em>
    Karma: <em>{{karma}}</em>
  </script>
  ```

  ```handlebars
  {{#if isUser}}
    {{template "user_info"}}
  {{else}}
    {{template "unlogged_user_info"}}
  {{/if}}
  ```

  This helper looks for templates in the global `Ember.TEMPLATES` hash. If you
  add `<script>` tags to your page with the `data-template-name` attribute set,
  they will be compiled and placed in this hash automatically.

  You can also manually register templates by adding them to the hash:

  ```javascript
  Ember.TEMPLATES["my_cool_template"] = Ember.Handlebars.compile('<b>{{user}}</b>');
  ```

  @method template
  @for Ember.Handlebars.helpers
  @param {String} templateName the template to render
*/

Ember.Handlebars.registerHelper('template', function(name, options) {
  var view = options.data.view,
      template = view.templateForName(name);

  Ember.assert("Unable to find template with name '"+name+"'.", !!template);

  template(this, { data: options.data });
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

/**
  `partial` renders a template directly using the current context.
  If needed the context can be set using the `{{#with foo}}` helper.

  ```html
  <script type="text/x-handlebars" data-template-name="header_bar">
    {{#with currentUser}}
      {{partial user_info}}
    {{/with}}
  </script>

  The `data-template-name` attribute of a partial template
  is prefixed with an underscore.

  ```html
  <script type="text/x-handlebars" data-template-name="_user_info">
    <span>Hello {{username}}!</span>
  </script>
  ```

  @method partial
  @for Ember.Handlebars.helpers
  @param {String} partialName the name of the template to render minus the leading underscore
*/

Ember.Handlebars.registerHelper('partial', function(name, options) {
  var nameParts = name.split("/"),
      lastPart = nameParts[nameParts.length - 1];

  nameParts[nameParts.length - 1] = "_" + lastPart;

  var view = options.data.view,
      underscoredName = nameParts.join("/"),
      template = view.templateForName(underscoredName),
      deprecatedTemplate = view.templateForName(name);

  Ember.deprecate("You tried to render the partial " + name + ", which should be at '" + underscoredName + "', but Ember found '" + name + "'. Please use a leading underscore in your partials", template);
  Ember.assert("Unable to find partial with name '"+name+"'.", template || deprecatedTemplate);

  template = template || deprecatedTemplate;

  template(this, { data: options.data });
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

/**
  When used in a Handlebars template that is assigned to an `Ember.View`
  instance's `layout` property Ember will render the layout template first,
  inserting the view's own rendered output at the `{{yield}}` location.

  An empty `<body>` and the following application code:

  ```javascript
  AView = Ember.View.extend({
    classNames: ['a-view-with-layout'],
    layout: Ember.Handlebars.compile('<div class="wrapper">{{yield}}</div>'),
    template: Ember.Handlebars.compile('<span>I am wrapped</span>')
  });

  aView = AView.create();
  aView.appendTo('body');
  ```

  Will result in the following HTML output:

  ```html
  <body>
    <div class='ember-view a-view-with-layout'>
      <div class="wrapper">
        <span>I am wrapped</span>
      </div>
    </div>
  </body>
  ```

  The `yield` helper cannot be used outside of a template assigned to an
  `Ember.View`'s `layout` property and will throw an error if attempted.

  ```javascript
  BView = Ember.View.extend({
    classNames: ['a-view-with-layout'],
    template: Ember.Handlebars.compile('{{yield}}')
  });

  bView = BView.create();
  bView.appendTo('body');

  // throws
  // Uncaught Error: assertion failed: You called yield in a template that was not a layout
  ```

  @method yield
  @for Ember.Handlebars.helpers
  @param {Hash} options
  @return {String} HTML string
*/
Ember.Handlebars.registerHelper('yield', function(options) {
  var view = options.data.view, template;

  while (view && !get(view, 'layout')) {
    view = get(view, 'parentView');
  }

  Ember.assert("You called yield in a template that was not a layout", !!view);

  template = get(view, 'template');

  if (template) { template(this, options); }
});

})();



(function() {

})();



(function() {

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var set = Ember.set, get = Ember.get;

/**
  The `Ember.Checkbox` view class renders a checkbox
  [input](https://developer.mozilla.org/en/HTML/Element/Input) element. It
  allows for binding an Ember property (`checked`) to the status of the
  checkbox.

  Example:

  ```handlebars
  {{view Ember.Checkbox checkedBinding="receiveEmail"}}
  ```

  You can add a `label` tag yourself in the template where the `Ember.Checkbox`
  is being used.

  ```html
  <label>
    {{view Ember.Checkbox classNames="applicaton-specific-checkbox"}}
    Some Title
  </label>
  ```

  The `checked` attribute of an `Ember.Checkbox` object should always be set
  through the Ember object or by interacting with its rendered element
  representation via the mouse, keyboard, or touch. Updating the value of the
  checkbox via jQuery will result in the checked value of the object and its
  element losing synchronization.

  ## Layout and LayoutName properties

  Because HTML `input` elements are self closing `layout` and `layoutName`
  properties will not be applied. See `Ember.View`'s layout section for more
  information.

  @class Checkbox
  @namespace Ember
  @extends Ember.View
*/
Ember.Checkbox = Ember.View.extend({
  classNames: ['ember-checkbox'],

  tagName: 'input',

  attributeBindings: ['type', 'checked', 'disabled', 'tabindex', 'name'],

  type: "checkbox",
  checked: false,
  disabled: false,

  init: function() {
    this._super();
    this.on("change", this, this._updateElementValue);
  },

  _updateElementValue: function() {
    set(this, 'checked', this.$().prop('checked'));
  }
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

/**
  Shared mixin used by `Ember.TextField` and `Ember.TextArea`.

  @class TextSupport
  @namespace Ember
  @extends Ember.Mixin
  @private
*/
Ember.TextSupport = Ember.Mixin.create({
  value: "",

  attributeBindings: ['placeholder', 'disabled', 'maxlength', 'tabindex'],
  placeholder: null,
  disabled: false,
  maxlength: null,

  insertNewline: Ember.K,
  cancel: Ember.K,

  init: function() {
    this._super();
    this.on("focusOut", this, this._elementValueDidChange);
    this.on("change", this, this._elementValueDidChange);
    this.on("paste", this, this._elementValueDidChange);
    this.on("cut", this, this._elementValueDidChange);
    this.on("input", this, this._elementValueDidChange);
    this.on("keyUp", this, this.interpretKeyEvents);
  },

  interpretKeyEvents: function(event) {
    var map = Ember.TextSupport.KEY_EVENTS;
    var method = map[event.keyCode];

    this._elementValueDidChange();
    if (method) { return this[method](event); }
  },

  _elementValueDidChange: function() {
    set(this, 'value', this.$().val());
  }

});

Ember.TextSupport.KEY_EVENTS = {
  13: 'insertNewline',
  27: 'cancel'
};

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

/**
  The `Ember.TextField` view class renders a text
  [input](https://developer.mozilla.org/en/HTML/Element/Input) element. It
  allows for binding Ember properties to the text field contents (`value`),
  live-updating as the user inputs text.

  Example:

  ```handlebars
  {{view Ember.TextField valueBinding="firstName"}}
  ```

  ## Layout and LayoutName properties

  Because HTML `input` elements are self closing `layout` and `layoutName`
  properties will not be applied. See `Ember.View`'s layout section for more
  information.

  ## HTML Attributes

  By default `Ember.TextField` provides support for `type`, `value`, `size`,
  `pattern`, `placeholder`, `disabled`, `maxlength` and `tabindex` attributes
  on a test field. If you need to support more attributes have a look at the
  `attributeBindings` property in `Ember.View`'s HTML Attributes section.

  To globally add support for additional attributes you can reopen
  `Ember.TextField` or `Ember.TextSupport`.

  ```javascript
  Ember.TextSupport.reopen({
    attributeBindings: ["required"]
  })
  ```

  @class TextField
  @namespace Ember
  @extends Ember.View
  @uses Ember.TextSupport
*/
Ember.TextField = Ember.View.extend(Ember.TextSupport,
  /** @scope Ember.TextField.prototype */ {

  classNames: ['ember-text-field'],
  tagName: "input",
  attributeBindings: ['type', 'value', 'size', 'pattern', 'name'],

  /**
    The `value` attribute of the input element. As the user inputs text, this
    property is updated live.

    @property value
    @type String
    @default ""
  */
  value: "",

  /**
    The `type` attribute of the input element.

    @property type
    @type String
    @default "text"
  */
  type: "text",

  /**
    The `size` of the text field in characters.

    @property size
    @type String
    @default null
  */
  size: null,

  /**
    The `pattern` the pattern attribute of input element.

    @property pattern
    @type String
    @default null
  */
  pattern: null,

  /**
    The action to be sent when the user presses the return key.

    This is similar to the `{{action}}` helper, but is fired when
    the user presses the return key when editing a text field, and sends
    the value of the field as the context.

    @property action
    @type String
    @default null
  */
  action: null,

  /**
    Whether they `keyUp` event that triggers an `action` to be sent continues
    propagating to other views.

    By default, when the user presses the return key on their keyboard and
    the text field has an `action` set, the action will be sent to the view's
    controller and the key event will stop propagating.

    If you would like parent views to receive the `keyUp` event even after an
    action has been dispatched, set `bubbles` to true.

    @property bubbles
    @type Boolean
    @default false
  */
  bubbles: false,

  insertNewline: function(event) {
    var controller = get(this, 'controller'),
        action = get(this, 'action');

    if (action) {
      controller.send(action, get(this, 'value'), this);

      if (!get(this, 'bubbles')) {
        event.stopPropagation();
      }
    }
  }
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

/**
  @class Button
  @namespace Ember
  @extends Ember.View
  @uses Ember.TargetActionSupport
  @deprecated
*/
Ember.Button = Ember.View.extend(Ember.TargetActionSupport, {
  classNames: ['ember-button'],
  classNameBindings: ['isActive'],

  tagName: 'button',

  propagateEvents: false,

  attributeBindings: ['type', 'disabled', 'href', 'tabindex'],

  /**
    @private

    Overrides `TargetActionSupport`'s `targetObject` computed
    property to use Handlebars-specific path resolution.

    @property targetObject
  */
  targetObject: Ember.computed(function() {
    var target = get(this, 'target'),
        root = get(this, 'context'),
        data = get(this, 'templateData');

    if (typeof target !== 'string') { return target; }

    return Ember.Handlebars.get(root, target, { data: data });
  }).property('target'),

  // Defaults to 'button' if tagName is 'input' or 'button'
  type: Ember.computed(function(key) {
    var tagName = this.tagName;
    if (tagName === 'input' || tagName === 'button') { return 'button'; }
  }),

  disabled: false,

  // Allow 'a' tags to act like buttons
  href: Ember.computed(function() {
    return this.tagName === 'a' ? '#' : null;
  }),

  mouseDown: function() {
    if (!get(this, 'disabled')) {
      set(this, 'isActive', true);
      this._mouseDown = true;
      this._mouseEntered = true;
    }
    return get(this, 'propagateEvents');
  },

  mouseLeave: function() {
    if (this._mouseDown) {
      set(this, 'isActive', false);
      this._mouseEntered = false;
    }
  },

  mouseEnter: function() {
    if (this._mouseDown) {
      set(this, 'isActive', true);
      this._mouseEntered = true;
    }
  },

  mouseUp: function(event) {
    if (get(this, 'isActive')) {
      // Actually invoke the button's target and action.
      // This method comes from the Ember.TargetActionSupport mixin.
      this.triggerAction();
      set(this, 'isActive', false);
    }

    this._mouseDown = false;
    this._mouseEntered = false;
    return get(this, 'propagateEvents');
  },

  keyDown: function(event) {
    // Handle space or enter
    if (event.keyCode === 13 || event.keyCode === 32) {
      this.mouseDown();
    }
  },

  keyUp: function(event) {
    // Handle space or enter
    if (event.keyCode === 13 || event.keyCode === 32) {
      this.mouseUp();
    }
  },

  // TODO: Handle proper touch behavior. Including should make inactive when
  // finger moves more than 20x outside of the edge of the button (vs mouse
  // which goes inactive as soon as mouse goes out of edges.)

  touchStart: function(touch) {
    return this.mouseDown(touch);
  },

  touchEnd: function(touch) {
    return this.mouseUp(touch);
  },

  init: function() {
    Ember.deprecate("Ember.Button is deprecated and will be removed from future releases. Consider using the `{{action}}` helper.");
    this._super();
  }
});

})();



(function() {
/**
@module ember
@submodule ember-handlebars
*/

var get = Ember.get, set = Ember.set;

/**
  The `Ember.TextArea` view class renders a
  [textarea](https://developer.mozilla.org/en/HTML/Element/textarea) element.
  It allows for binding Ember properties to the text area contents (`value`),
  live-updating as the user inputs text.

  ## Layout and LayoutName properties

  Because HTML `textarea` elements do not contain inner HTML the `layout` and
  `layoutName` properties will not be applied. See `Ember.View`'s layout
  section for more information.

  ## HTML Attributes

  By default `Ember.TextArea` provides support for `rows`, `cols`,
  `placeholder`, `disabled`, `maxlength` and `tabindex` attributes on a
  textarea. If you need to support  more attributes have a look at the
  `attributeBindings` property in `Ember.View`'s HTML Attributes section.

  To globally add support for additional attributes you can reopen
  `Ember.TextArea` or `Ember.TextSupport`.

  ```javascript
  Ember.TextSupport.reopen({
    attributeBindings: ["required"]
  })
  ```

  @class TextArea
  @namespace Ember
  @extends Ember.View
  @uses Ember.TextSupport
*/
Ember.TextArea = Ember.View.extend(Ember.TextSupport, {
  classNames: ['ember-text-area'],

  tagName: "textarea",
  attributeBindings: ['rows', 'cols', 'name'],
  rows: null,
  cols: null,

  _updateElementValue: Ember.observer(function() {
    // We do this check so cursor position doesn't get affected in IE
    var value = get(this, 'value'),
        $el = this.$();
    if ($el && value !== $el.val()) {
      $el.val(value);
    }
  }, 'value'),

  init: function() {
    this._super();
    this.on("didInsertElement", this, this._updateElementValue);
  }

});

})();



(function() {
/*jshint eqeqeq:false */

/**
@module ember
@submodule ember-handlebars
*/

var set = Ember.set,
    get = Ember.get,
    indexOf = Ember.EnumerableUtils.indexOf,
    indexesOf = Ember.EnumerableUtils.indexesOf,
    replace = Ember.EnumerableUtils.replace,
    isArray = Ember.isArray,
    precompileTemplate = Ember.Handlebars.compile;

/**
  The `Ember.Select` view class renders a
  [select](https://developer.mozilla.org/en/HTML/Element/select) HTML element,
  allowing the user to choose from a list of options.

  The text and `value` property of each `<option>` element within the
  `<select>` element are populated from the objects in the `Element.Select`'s
  `content` property. The underlying data object of the selected `<option>` is
  stored in the `Element.Select`'s `value` property.

  ### `content` as an array of Strings

  The simplest version of an `Ember.Select` takes an array of strings as its
  `content` property. The string will be used as both the `value` property and
  the inner text of each `<option>` element inside the rendered `<select>`.

  Example:

  ```javascript
  App.names = ["Yehuda", "Tom"];
  ```

  ```handlebars
  {{view Ember.Select contentBinding="App.names"}}
  ```

  Would result in the following HTML:

  ```html
  <select class="ember-select">
    <option value="Yehuda">Yehuda</option>
    <option value="Tom">Tom</option>
  </select>
  ```

  You can control which `<option>` is selected through the `Ember.Select`'s
  `value` property directly or as a binding:

  ```javascript
  App.names = Ember.Object.create({
    selected: 'Tom',
    content: ["Yehuda", "Tom"]
  });
  ```

  ```handlebars
  {{view Ember.Select
         contentBinding="App.names.content"
         valueBinding="App.names.selected"
  }}
  ```

  Would result in the following HTML with the `<option>` for 'Tom' selected:

  ```html
  <select class="ember-select">
    <option value="Yehuda">Yehuda</option>
    <option value="Tom" selected="selected">Tom</option>
  </select>
  ```

  A user interacting with the rendered `<select>` to choose "Yehuda" would
  update the value of `App.names.selected` to "Yehuda".

  ### `content` as an Array of Objects

  An `Ember.Select` can also take an array of JavaScript or Ember objects as
  its `content` property.

  When using objects you need to tell the `Ember.Select` which property should
  be accessed on each object to supply the `value` attribute of the `<option>`
  and which property should be used to supply the element text.

  The `optionValuePath` option is used to specify the path on each object to
  the desired property for the `value` attribute. The `optionLabelPath`
  specifies the path on each object to the desired property for the
  element's text. Both paths must reference each object itself as `content`:

  ```javascript
  App.programmers = [
    Ember.Object.create({firstName: "Yehuda", id: 1}),
    Ember.Object.create({firstName: "Tom",    id: 2})
  ];
  ```

  ```handlebars
  {{view Ember.Select
         contentBinding="App.programmers"
         optionValuePath="content.id"
         optionLabelPath="content.firstName"}}
  ```

  Would result in the following HTML:

  ```html
  <select class="ember-select">
    <option value>Please Select</option>
    <option value="1">Yehuda</option>
    <option value="2">Tom</option>
  </select>
  ```

  The `value` attribute of the selected `<option>` within an `Ember.Select`
  can be bound to a property on another object by providing a
  `valueBinding` option:

  ```javascript
  App.programmers = [
    Ember.Object.create({firstName: "Yehuda", id: 1}),
    Ember.Object.create({firstName: "Tom",    id: 2})
  ];

  App.currentProgrammer = Ember.Object.create({
    id: 2
  });
  ```

  ```handlebars
  {{view Ember.Select
         contentBinding="App.programmers"
         optionValuePath="content.id"
         optionLabelPath="content.firstName"
         valueBinding="App.currentProgrammer.id"}}
  ```

  Would result in the following HTML with a selected option:

  ```html
  <select class="ember-select">
    <option value>Please Select</option>
    <option value="1">Yehuda</option>
    <option value="2" selected="selected">Tom</option>
  </select>
  ```

  Interacting with the rendered element by selecting the first option
  ('Yehuda') will update the `id` value of `App.currentProgrammer`
  to match the `value` property of the newly selected `<option>`.

  Alternatively, you can control selection through the underlying objects
  used to render each object providing a `selectionBinding`. When the selected
  `<option>` is changed, the property path provided to `selectionBinding`
  will be updated to match the content object of the rendered `<option>`
  element:

  ```javascript
  App.controller = Ember.Object.create({
    selectedPerson: null,
    content: [
      Ember.Object.create({firstName: "Yehuda", id: 1}),
      Ember.Object.create({firstName: "Tom",    id: 2})
    ]
  });
  ```

  ```handlebars
  {{view Ember.Select
         contentBinding="App.controller.content"
         optionValuePath="content.id"
         optionLabelPath="content.firstName"
         selectionBinding="App.controller.selectedPerson"}}
  ```

  Would result in the following HTML with a selected option:

  ```html
  <select class="ember-select">
    <option value>Please Select</option>
    <option value="1">Yehuda</option>
    <option value="2" selected="selected">Tom</option>
  </select>
  ```

  Interacting with the rendered element by selecting the first option
  ('Yehuda') will update the `selectedPerson` value of `App.controller`
  to match the content object of the newly selected `<option>`. In this
  case it is the first object in the `App.content.content`

  ### Supplying a Prompt

  A `null` value for the `Ember.Select`'s `value` or `selection` property
  results in there being no `<option>` with a `selected` attribute:

  ```javascript
  App.controller = Ember.Object.create({
    selected: null,
    content: [
      "Yehuda",
      "Tom"
    ]
  });
  ```

  ``` handlebars
  {{view Ember.Select
         contentBinding="App.controller.content"
         valueBinding="App.controller.selected"
  }}
  ```

  Would result in the following HTML:

  ```html
  <select class="ember-select">
    <option value="Yehuda">Yehuda</option>
    <option value="Tom">Tom</option>
  </select>
  ```

  Although `App.controller.selected` is `null` and no `<option>`
  has a `selected` attribute the rendered HTML will display the
  first item as though it were selected. You can supply a string
  value for the `Ember.Select` to display when there is no selection
  with the `prompt` option:

  ```javascript
  App.controller = Ember.Object.create({
    selected: null,
    content: [
      "Yehuda",
      "Tom"
    ]
  });
  ```

  ```handlebars
  {{view Ember.Select
         contentBinding="App.controller.content"
         valueBinding="App.controller.selected"
         prompt="Please select a name"
  }}
  ```

  Would result in the following HTML:

  ```html
  <select class="ember-select">
    <option>Please select a name</option>
    <option value="Yehuda">Yehuda</option>
    <option value="Tom">Tom</option>
  </select>
  ```

  @class Select
  @namespace Ember
  @extends Ember.View
*/
Ember.Select = Ember.View.extend(
  /** @scope Ember.Select.prototype */ {

  tagName: 'select',
  classNames: ['ember-select'],
  defaultTemplate: precompileTemplate('{{#if view.prompt}}<option value="">{{view.prompt}}</option>{{/if}}{{#each view.content}}{{view Ember.SelectOption contentBinding="this"}}{{/each}}'),
  attributeBindings: ['multiple', 'disabled', 'tabindex', 'name'],

  /**
    The `multiple` attribute of the select element. Indicates whether multiple
    options can be selected.

    @property multiple
    @type Boolean
    @default false
  */
  multiple: false,

  disabled: false,

  /**
    The list of options.

    If `optionLabelPath` and `optionValuePath` are not overridden, this should
    be a list of strings, which will serve simultaneously as labels and values.

    Otherwise, this should be a list of objects. For instance:

    ```javascript
    Ember.Select.create({
      content: Ember.A([
          { id: 1, firstName: 'Yehuda' },
          { id: 2, firstName: 'Tom' }
        ]),
      optionLabelPath: 'content.firstName',
      optionValuePath: 'content.id'
    });
    ```

    @property content
    @type Array
    @default null
  */
  content: null,

  /**
    When `multiple` is `false`, the element of `content` that is currently
    selected, if any.

    When `multiple` is `true`, an array of such elements.

    @property selection
    @type Object or Array
    @default null
  */
  selection: null,

  /**
    In single selection mode (when `multiple` is `false`), value can be used to
    get the current selection's value or set the selection by it's value.

    It is not currently supported in multiple selection mode.

    @property value
    @type String
    @default null
  */
  value: Ember.computed(function(key, value) {
    if (arguments.length === 2) { return value; }
    var valuePath = get(this, 'optionValuePath').replace(/^content\.?/, '');
    return valuePath ? get(this, 'selection.' + valuePath) : get(this, 'selection');
  }).property('selection'),

  /**
    If given, a top-most dummy option will be rendered to serve as a user
    prompt.

    @property prompt
    @type String
    @default null
  */
  prompt: null,

  /**
    The path of the option labels. See `content`.

    @property optionLabelPath
    @type String
    @default 'content'
  */
  optionLabelPath: 'content',

  /**
    The path of the option values. See `content`.

    @property optionValuePath
    @type String
    @default 'content'
  */
  optionValuePath: 'content',

  _change: function() {
    if (get(this, 'multiple')) {
      this._changeMultiple();
    } else {
      this._changeSingle();
    }
  },

  selectionDidChange: Ember.observer(function() {
    var selection = get(this, 'selection');
    if (get(this, 'multiple')) {
      if (!isArray(selection)) {
        set(this, 'selection', Ember.A([selection]));
        return;
      }
      this._selectionDidChangeMultiple();
    } else {
      this._selectionDidChangeSingle();
    }
  }, 'selection.@each'),

  valueDidChange: Ember.observer(function() {
    var content = get(this, 'content'),
        value = get(this, 'value'),
        valuePath = get(this, 'optionValuePath').replace(/^content\.?/, ''),
        selectedValue = (valuePath ? get(this, 'selection.' + valuePath) : get(this, 'selection')),
        selection;

    if (value !== selectedValue) {
      selection = content.find(function(obj) {
        return value === (valuePath ? get(obj, valuePath) : obj);
      });

      this.set('selection', selection);
    }
  }, 'value'),


  _triggerChange: function() {
    var selection = get(this, 'selection');
    var value = get(this, 'value');

    if (selection) { this.selectionDidChange(); }
    if (value) { this.valueDidChange(); }

    this._change();
  },

  _changeSingle: function() {
    var selectedIndex = this.$()[0].selectedIndex,
        content = get(this, 'content'),
        prompt = get(this, 'prompt');

    if (!get(content, 'length')) { return; }
    if (prompt && selectedIndex === 0) { set(this, 'selection', null); return; }

    if (prompt) { selectedIndex -= 1; }
    set(this, 'selection', content.objectAt(selectedIndex));
  },


  _changeMultiple: function() {
    var options = this.$('option:selected'),
        prompt = get(this, 'prompt'),
        offset = prompt ? 1 : 0,
        content = get(this, 'content'),
        selection = get(this, 'selection');

    if (!content){ return; }
    if (options) {
      var selectedIndexes = options.map(function(){
        return this.index - offset;
      }).toArray();
      var newSelection = content.objectsAt(selectedIndexes);

      if (isArray(selection)) {
        replace(selection, 0, get(selection, 'length'), newSelection);
      } else {
        set(this, 'selection', newSelection);
      }
    }
  },

  _selectionDidChangeSingle: function() {
    var el = this.get('element');
    if (!el) { return; }

    var content = get(this, 'content'),
        selection = get(this, 'selection'),
        selectionIndex = content ? indexOf(content, selection) : -1,
        prompt = get(this, 'prompt');

    if (prompt) { selectionIndex += 1; }
    if (el) { el.selectedIndex = selectionIndex; }
  },

  _selectionDidChangeMultiple: function() {
    var content = get(this, 'content'),
        selection = get(this, 'selection'),
        selectedIndexes = content ? indexesOf(content, selection) : [-1],
        prompt = get(this, 'prompt'),
        offset = prompt ? 1 : 0,
        options = this.$('option'),
        adjusted;

    if (options) {
      options.each(function() {
        adjusted = this.index > -1 ? this.index - offset : -1;
        this.selected = indexOf(selectedIndexes, adjusted) > -1;
      });
    }
  },

  init: function() {
    this._super();
    this.on("didInsertElement", this, this._triggerChange);
    this.on("change", this, this._change);
  }
});

Ember.SelectOption = Ember.View.extend({
  tagName: 'option',
  attributeBindings: ['value', 'selected'],

  defaultTemplate: function(context, options) {
    options = { data: options.data, hash: {} };
    Ember.Handlebars.helpers.bind.call(context, "view.label", options);
  },

  init: function() {
    this.labelPathDidChange();
    this.valuePathDidChange();

    this._super();
  },

  selected: Ember.computed(function() {
    var content = get(this, 'content'),
        selection = get(this, 'parentView.selection');
    if (get(this, 'parentView.multiple')) {
      return selection && indexOf(selection, content.valueOf()) > -1;
    } else {
      // Primitives get passed through bindings as objects... since
      // `new Number(4) !== 4`, we use `==` below
      return content == selection;
    }
  }).property('content', 'parentView.selection'),

  labelPathDidChange: Ember.observer(function() {
    var labelPath = get(this, 'parentView.optionLabelPath');

    if (!labelPath) { return; }

    Ember.defineProperty(this, 'label', Ember.computed(function() {
      return get(this, labelPath);
    }).property(labelPath));
  }, 'parentView.optionLabelPath'),

  valuePathDidChange: Ember.observer(function() {
    var valuePath = get(this, 'parentView.optionValuePath');

    if (!valuePath) { return; }

    Ember.defineProperty(this, 'value', Ember.computed(function() {
      return get(this, valuePath);
    }).property(valuePath));
  }, 'parentView.optionValuePath')
});

})();



(function() {
function normalizeHash(hash, hashTypes) {
  for (var prop in hash) {
    if (hashTypes[prop] === 'ID') {
      hash[prop + 'Binding'] = hash[prop];
      delete hash[prop];
    }
  }
}

Ember.Handlebars.registerHelper('input', function(options) {
  Ember.assert('You can only pass attributes to the `input` helper, not arguments', arguments.length < 2);

  var hash = options.hash,
      types = options.hashTypes,
      inputType = hash.type;

  delete hash.type;

  normalizeHash(hash, types);

  if (inputType === 'checkbox') {
    return Ember.Handlebars.helpers.view.call(this, Ember.Checkbox, options);
  } else {
    return Ember.Handlebars.helpers.view.call(this, Ember.TextField, options);
  }
});
})();



(function() {
/*globals Handlebars */
/**
@module ember
@submodule ember-handlebars
*/

/**
  @private

  Find templates stored in the head tag as script tags and make them available
  to `Ember.CoreView` in the global `Ember.TEMPLATES` object. This will be run
  as as jQuery DOM-ready callback.

  Script tags with `text/x-handlebars` will be compiled
  with Ember's Handlebars and are suitable for use as a view's template.
  Those with type `text/x-raw-handlebars` will be compiled with regular
  Handlebars and are suitable for use in views' computed properties.

  @method bootstrap
  @for Ember.Handlebars
  @static
  @param ctx
*/
Ember.Handlebars.bootstrap = function(ctx) {
  var selectors = 'script[type="text/x-handlebars"], script[type="text/x-raw-handlebars"]';

  Ember.$(selectors, ctx)
    .each(function() {
    // Get a reference to the script tag
    var script = Ember.$(this);

    var compile = (script.attr('type') === 'text/x-raw-handlebars') ?
                  Ember.$.proxy(Handlebars.compile, Handlebars) :
                  Ember.$.proxy(Ember.Handlebars.compile, Ember.Handlebars),
      // Get the name of the script, used by Ember.View's templateName property.
      // First look for data-template-name attribute, then fall back to its
      // id if no name is found.
      templateName = script.attr('data-template-name') || script.attr('id') || 'application',
      template = compile(script.html());

    // For templates which have a name, we save them and then remove them from the DOM
    Ember.TEMPLATES[templateName] = template;

    // Remove script tag from DOM
    script.remove();
  });
};

function bootstrap() {
  Ember.Handlebars.bootstrap( Ember.$(document) );
}

/*
  We tie this to application.load to ensure that we've at least
  attempted to bootstrap at the point that the application is loaded.

  We also tie this to document ready since we're guaranteed that all
  the inline templates are present at this point.

  There's no harm to running this twice, since we remove the templates
  from the DOM after processing.
*/

Ember.onLoad('application', bootstrap);

})();



(function() {
/**
Ember Handlebars

@module ember
@submodule ember-handlebars
@requires ember-views
*/

Ember.runLoadHooks('Ember.Handlebars', Ember.Handlebars);

})();

