(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

Ember._PromiseChain = Ember.Object.extend({
  promises: null,
  failureCallback: Ember.K,
  successCallback: Ember.K,
  abortCallback: Ember.K,
  promiseSuccessCallback: Ember.K,

  runNextPromise: function() {
    if (get(this, 'isDestroyed')) { return; }

    var item = get(this, 'promises').shiftObject();
    if (item) {
      var promise = get(item, 'promise') || item;
      Ember.assert("Cannot find promise to invoke", Ember.canInvoke(promise, 'then'));

      var self = this;

      var successCallback = function() {
        self.promiseSuccessCallback.call(this, item, arguments);
        self.runNextPromise();
      };

      var failureCallback = get(self, 'failureCallback');

      promise.then(successCallback, failureCallback);
     } else {
      this.successCallback();
    }
  },

  start: function() {
    this.runNextPromise();
    return this;
  },

  abort: function() {
    this.abortCallback();
    this.destroy();
  },

  init: function() {
    set(this, 'promises', Ember.A(get(this, 'promises')));
    this._super();
  }
});


})();



(function() {
function visit(vertex, fn, visited, path) {
  var name = vertex.name,
    vertices = vertex.incoming,
    names = vertex.incomingNames,
    len = names.length,
    i;
  if (!visited) {
    visited = {};
  }
  if (!path) {
    path = [];
  }
  if (visited.hasOwnProperty(name)) {
    return;
  }
  path.push(name);
  visited[name] = true;
  for (i = 0; i < len; i++) {
    visit(vertices[names[i]], fn, visited, path);
  }
  fn(vertex, path);
  path.pop();
}

function DAG() {
  this.names = [];
  this.vertices = {};
}

DAG.prototype.add = function(name) {
  if (!name) { return; }
  if (this.vertices.hasOwnProperty(name)) {
    return this.vertices[name];
  }
  var vertex = {
    name: name, incoming: {}, incomingNames: [], hasOutgoing: false, value: null
  };
  this.vertices[name] = vertex;
  this.names.push(name);
  return vertex;
};

DAG.prototype.map = function(name, value) {
  this.add(name).value = value;
};

DAG.prototype.addEdge = function(fromName, toName) {
  if (!fromName || !toName || fromName === toName) {
    return;
  }
  var from = this.add(fromName), to = this.add(toName);
  if (to.incoming.hasOwnProperty(fromName)) {
    return;
  }
  function checkCycle(vertex, path) {
    if (vertex.name === toName) {
      throw new Error("cycle detected: " + toName + " <- " + path.join(" <- "));
    }
  }
  visit(from, checkCycle);
  from.hasOutgoing = true;
  to.incoming[fromName] = from;
  to.incomingNames.push(fromName);
};

DAG.prototype.topsort = function(fn) {
  var visited = {},
    vertices = this.vertices,
    names = this.names,
    len = names.length,
    i, vertex;
  for (i = 0; i < len; i++) {
    vertex = vertices[names[i]];
    if (!vertex.hasOutgoing) {
      visit(vertex, fn, visited);
    }
  }
};

DAG.prototype.addEdges = function(name, value, before, after) {
  var i;
  this.map(name, value);
  if (before) {
    if (typeof before === 'string') {
      this.addEdge(name, before);
    } else {
      for (i = 0; i < before.length; i++) {
        this.addEdge(name, before[i]);
      }
    }
  }
  if (after) {
    if (typeof after === 'string') {
      this.addEdge(after, name);
    } else {
      for (i = 0; i < after.length; i++) {
        this.addEdge(after[i], name);
      }
    }
  }
};

Ember.DAG = DAG;

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

/**
  An instance of `Ember.Application` is the starting point for every Ember
  application. It helps to instantiate, initialize and coordinate the many
  objects that make up your app.

  Each Ember app has one and only one `Ember.Application` object. In fact, the
  very first thing you should do in your application is create the instance:

  ```javascript
  window.App = Ember.Application.create();
  ```

  Typically, the application object is the only global variable. All other
  classes in your app should be properties on the `Ember.Application` instance,
  which highlights its first role: a global namespace.

  For example, if you define a view class, it might look like this:

  ```javascript
  App.MyView = Ember.View.extend();
  ```

  Calling `Ember.Application.create()` will automatically initialize your
  application by calling the `Ember.Application.initialize()` method. If you
  need to delay initialization, you can pass `{autoinit: false}` to the
  `Ember.Application.create()` method, and call `App.initialize()`
  later.

  Because `Ember.Application` inherits from `Ember.Namespace`, any classes
  you create will have useful string representations when calling `toString()`.
  See the `Ember.Namespace` documentation for more information.

  While you can think of your `Ember.Application` as a container that holds the
  other classes in your application, there are several other responsibilities
  going on under-the-hood that you may want to understand.

  ### Event Delegation

  Ember uses a technique called _event delegation_. This allows the framework
  to set up a global, shared event listener instead of requiring each view to
  do it manually. For example, instead of each view registering its own
  `mousedown` listener on its associated element, Ember sets up a `mousedown`
  listener on the `body`.

  If a `mousedown` event occurs, Ember will look at the target of the event and
  start walking up the DOM node tree, finding corresponding views and invoking
  their `mouseDown` method as it goes.

  `Ember.Application` has a number of default events that it listens for, as
  well as a mapping from lowercase events to camel-cased view method names. For
  example, the `keypress` event causes the `keyPress` method on the view to be
  called, the `dblclick` event causes `doubleClick` to be called, and so on.

  If there is a browser event that Ember does not listen for by default, you
  can specify custom events and their corresponding view method names by
  setting the application's `customEvents` property:

  ```javascript
  App = Ember.Application.create({
    customEvents: {
      // add support for the loadedmetadata media
      // player event
      'loadedmetadata': "loadedMetadata"
    }
  });
  ```

  By default, the application sets up these event listeners on the document
  body. However, in cases where you are embedding an Ember application inside
  an existing page, you may want it to set up the listeners on an element
  inside the body.

  For example, if only events inside a DOM element with the ID of `ember-app`
  should be delegated, set your application's `rootElement` property:

  ```javascript
  window.App = Ember.Application.create({
    rootElement: '#ember-app'
  });
  ```

  The `rootElement` can be either a DOM element or a jQuery-compatible selector
  string. Note that *views appended to the DOM outside the root element will
  not receive events.* If you specify a custom root element, make sure you only
  append views inside it!

  To learn more about the advantages of event delegation and the Ember view
  layer, and a list of the event listeners that are setup by default, visit the
  [Ember View Layer guide](http://emberjs.com/guides/understanding-ember/the-view-layer/#toc_event-delegation).

  ### Dependency Injection

  One thing you may have noticed while using Ember is that you define
  *classes*, not *instances*. When your application loads, all of the instances
  are created for you. Creating these instances is the responsibility of
  `Ember.Application`.

  When the `Ember.Application` initializes, it will look for an `Ember.Router`
  class defined on the applications's `Router` property, like this:

  ```javascript
  App.Router = Ember.Router.extend({
  // ...
  });
  ```

  If found, the router is instantiated and saved on the application's `router`
  property (note the lowercase 'r'). While you should *not* reference this
  router instance directly from your application code, having access to
  `App.router` from the console can be useful during debugging.

  After the router is created, the application loops through all of the
  registered _injections_ and invokes them once for each property on the
  `Ember.Application` object.

  An injection is a function that is responsible for instantiating objects from
  classes defined on the application. By default, the only injection registered
  instantiates controllers and makes them available on the router.

  For example, if you define a controller class:

  ```javascript
  App.MyController = Ember.Controller.extend({
    // ...
  });
  ```

  Your router will receive an instance of `App.MyController` saved on its
  `myController` property.

  Libraries on top of Ember can register additional injections. For example,
  if your application is using Ember Data, it registers an injection that
  instantiates `DS.Store`:

  ```javascript
  Ember.Application.registerInjection({
    name: 'store',
    before: 'controllers',

    injection: function(app, router, property) {
      if (property === 'Store') {
        set(router, 'store', app[property].create());
      }
    }
  });
  ```

  ### Routing

  In addition to creating your application's router, `Ember.Application` is
  also responsible for telling the router when to start routing.

  By default, the router will begin trying to translate the current URL into
  application state once the browser emits the `DOMContentReady` event. If you
  need to defer routing, you can call the application's `deferReadiness()`
  method. Once routing can begin, call the `advanceReadiness()` method.

  If there is any setup required before routing begins, you can implement a
  `ready()` method on your app that will be invoked immediately before routing
  begins:

  ```javascript
  window.App = Ember.Application.create({
    ready: function() {
      this.set('router.enableLogging', true);
    }
  });

  To begin routing, you must have at a minimum a top-level controller and view.
  You define these as `App.ApplicationController` and `App.ApplicationView`,
  respectively. Your application will not work if you do not define these two
  mandatory classes. For example:

  ```javascript
  App.ApplicationView = Ember.View.extend({
    templateName: 'application'
  });
  App.ApplicationController = Ember.Controller.extend();
  ```

  @class Application
  @namespace Ember
  @extends Ember.Namespace
*/
Ember.Application = Ember.Namespace.extend(
/** @scope Ember.Application.prototype */{

  /**
    The root DOM element of the Application. This can be specified as an
    element or a
    [jQuery-compatible selector string](http://api.jquery.com/category/selectors/).

    This is the element that will be passed to the Application's,
    `eventDispatcher`, which sets up the listeners for event delegation. Every
    view in your application should be a child of the element you specify here.

    @property rootElement
    @type DOMElement
    @default 'body'
  */
  rootElement: 'body',

  /**
    The `Ember.EventDispatcher` responsible for delegating events to this
    application's views.

    The event dispatcher is created by the application at initialization time
    and sets up event listeners on the DOM element described by the
    application's `rootElement` property.

    See the documentation for `Ember.EventDispatcher` for more information.

    @property eventDispatcher
    @type Ember.EventDispatcher
    @default null
  */
  eventDispatcher: null,

  /**
    The DOM events for which the event dispatcher should listen.

    By default, the application's `Ember.EventDispatcher` listens
    for a set of standard DOM events, such as `mousedown` and
    `keyup`, and delegates them to your application's `Ember.View`
    instances.

    If you would like additional events to be delegated to your
    views, set your `Ember.Application`'s `customEvents` property
    to a hash containing the DOM event name as the key and the
    corresponding view method name as the value. For example:

    ```javascript
    App = Ember.Application.create({
      customEvents: {
        // add support for the loadedmetadata media
        // player event
        'loadedmetadata': "loadedMetadata"
      }
    });
    ```

    @property customEvents
    @type Object
    @default null
  */
  customEvents: null,

  /**
    Should the application initialize itself after it's created. You can
    set this to `false` if you'd like to choose when to initialize your
    application. This defaults to `!Ember.testing`

    @property autoinit
    @type Boolean
  */
  autoinit: !Ember.testing,

  isInitialized: false,

  init: function() {
    if (!this.$) { this.$ = Ember.$; }

    this._super();

    this.createEventDispatcher();

    // Start off the number of deferrals at 1. This will be
    // decremented by the Application's own `initialize` method.
    this._readinessDeferrals = 1;

    this.waitForDOMContentLoaded();

    if (this.autoinit) {
      var self = this;
      this.$().ready(function() {
        if (self.isDestroyed || self.isInitialized) return;
        self.initialize();
      });
    }
  },

  /** @private */
  createEventDispatcher: function() {
    var rootElement = get(this, 'rootElement'),
        eventDispatcher = Ember.EventDispatcher.create({
          rootElement: rootElement
        });

    set(this, 'eventDispatcher', eventDispatcher);
  },

  waitForDOMContentLoaded: function() {
    this.deferReadiness();

    var self = this;
    this.$().ready(function() {
      self.advanceReadiness();
    });
  },

  deferReadiness: function() {
    Ember.assert("You cannot defer readiness since the `ready()` hook has already been called.", this._readinessDeferrals > 0);
    this._readinessDeferrals++;
  },

  advanceReadiness: function() {
    this._readinessDeferrals--;

    if (this._readinessDeferrals === 0) {
      Ember.run.once(this, this.didBecomeReady);
    }
  },

  /**
    Instantiate all controllers currently available on the namespace
    and inject them onto a router.

    Example:

    ```javascript
    App.PostsController = Ember.ArrayController.extend();
    App.CommentsController = Ember.ArrayController.extend();

    var router = Ember.Router.create({
      ...
    });

    App.initialize(router);

    router.get('postsController');     // <App.PostsController:ember1234>
    router.get('commentsController');  // <App.CommentsController:ember1235>
    ```

    @method initialize
    @param router {Ember.Router}
  */
  initialize: function(router) {
    Ember.assert("Application initialize may only be called once", !this.isInitialized);
    Ember.assert("Application not destroyed", !this.isDestroyed);

    router = this.setupRouter(router);

    this.runInjections(router);

    Ember.runLoadHooks('application', this);

    this.isInitialized = true;

    // At this point, any injections or load hooks that would have wanted
    // to defer readiness have fired.
    this.advanceReadiness();

    return this;
  },

  /** @private */
  runInjections: function(router) {
    var injections = get(this.constructor, 'injections'),
        graph = new Ember.DAG(),
        namespace = this,
        properties, i, injection;

    for (i=0; i<injections.length; i++) {
      injection = injections[i];
      graph.addEdges(injection.name, injection.injection, injection.before, injection.after);
    }

    graph.topsort(function (vertex) {
      var injection = vertex.value,
          properties = Ember.A(Ember.keys(namespace));
      properties.forEach(function(property) {
        injection(namespace, router, property);
      });
    });
  },

  /** @private */
  setupRouter: function(router) {
    if (!router && Ember.Router.detect(this.Router)) {
      router = this.Router.create();
      this._createdRouter = router;
    }

    if (router) {
      set(this, 'router', router);

      // By default, the router's namespace is the current application.
      //
      // This allows it to find model classes when a state has a
      // route like `/posts/:post_id`. In that case, it would first
      // convert `post_id` into `Post`, and then look it up on its
      // namespace.
      set(router, 'namespace', this);
    }

    return router;
  },

  /** @private */
  didBecomeReady: function() {
    var eventDispatcher = get(this, 'eventDispatcher'),
        customEvents    = get(this, 'customEvents'),
        router;

    eventDispatcher.setup(customEvents);

    this.ready();


    router = get(this, 'router');

    this.createApplicationView(router);

    if (router && router instanceof Ember.Router) {
      this.startRouting(router);
    }

    Ember.BOOTED = true;
  },

  createApplicationView: function (router) {
    var rootElement = get(this, 'rootElement'),
        applicationViewOptions = {},
        applicationViewClass = this.ApplicationView,
        applicationTemplate = Ember.TEMPLATES.application,
        applicationController, applicationView;

    // don't do anything unless there is an ApplicationView or application template
    if (!applicationViewClass && !applicationTemplate) return;

    if (router) {
      applicationController = get(router, 'applicationController');
      if (applicationController) {
        applicationViewOptions.controller = applicationController;
      }
    }

    if (applicationTemplate) {
      applicationViewOptions.template = applicationTemplate;
    }

    if (!applicationViewClass) {
      applicationViewClass = Ember.View;
    }

    applicationView = applicationViewClass.create(applicationViewOptions);

    this._createdApplicationView = applicationView;

    if (router) {
      set(router, 'applicationView', applicationView);
    }

    applicationView.appendTo(rootElement);
  },

  /**
    @private

    If the application has a router, use it to route to the current URL, and
    trigger a new call to `route` whenever the URL changes.

    @method startRouting
    @property router {Ember.Router}
  */
  startRouting: function(router) {
    var location = get(router, 'location');

    Ember.assert("You must have an application template or ApplicationView defined on your application", get(router, 'applicationView') );
    Ember.assert("You must have an ApplicationController defined on your application", get(router, 'applicationController') );

    router.route(location.getURL());
    location.onUpdateURL(function(url) {
      router.route(url);
    });
  },

  /**
    Called when the Application has become ready.
    The call will be delayed until the DOM has become ready.

    @event ready
  */
  ready: Ember.K,

  willDestroy: function() {
    get(this, 'eventDispatcher').destroy();
    if (this._createdRouter)          { this._createdRouter.destroy(); }
    if (this._createdApplicationView) { this._createdApplicationView.destroy(); }
  },

  registerInjection: function(options) {
    this.constructor.registerInjection(options);
  }
});

Ember.Application.reopenClass({
  concatenatedProperties: ['injections'],
  injections: Ember.A(),
  registerInjection: function(injection) {
    var injections = get(this, 'injections');

    Ember.assert("The injection '" + injection.name + "' has already been registered", !injections.findProperty('name', injection.name));
    Ember.assert("An injection cannot be registered with both a before and an after", !(injection.before && injection.after));
    Ember.assert("An injection cannot be registered without an injection function", Ember.canInvoke(injection, 'injection'));

    injections.push(injection);
  }
});

Ember.Application.registerInjection({
  name: 'controllers',
  injection: function(app, router, property) {
    if (!router) { return; }
    if (!/^[A-Z].*Controller$/.test(property)) { return; }

    var name = property.charAt(0).toLowerCase() + property.substr(1),
        controllerClass = app[property], controller;

    if(!Ember.Object.detect(controllerClass)){ return; }
    controller = app[property].create();

    router.set(name, controller);

    controller.setProperties({
      target: router,
      controllers: router,
      namespace: app
    });
  }
});

Ember.runLoadHooks('Ember.Application', Ember.Application);


})();



(function() {

})();



(function() {
/**
Ember Application

@module ember
@submodule ember-old-router
@requires ember-views, ember-states, ember-routing
*/

})();



(function() {
var get = Ember.get;

Ember._ResolvedState = Ember.Object.extend({
  manager: null,
  state: null,
  match: null,

  object: Ember.computed(function(key) {
    if (this._object) {
      return this._object;
    } else {
      var state = get(this, 'state'),
          match = get(this, 'match'),
          manager = get(this, 'manager');
      return state.deserialize(manager, match.hash);
    }
  }),

  hasPromise: Ember.computed(function() {
    return Ember.canInvoke(get(this, 'object'), 'then');
  }).property('object'),

  promise: Ember.computed(function() {
    var object = get(this, 'object');
    if (Ember.canInvoke(object, 'then')) {
      return object;
    } else {
      return {
        then: function(success) { success(object); }
      };
    }
  }).property('object'),

  transition: function() {
    var manager = get(this, 'manager'),
        path = get(this, 'state.path'),
        object = get(this, 'object');
    manager.transitionTo(path, object);
  }
});

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get;

// The Ember Routable mixin assumes the existance of a simple
// routing shim that supports the following three behaviors:
//
// * .getURL() - this is called when the page loads
// * .setURL(newURL) - this is called from within the state
//   manager when the state changes to a routable state
// * .onURLChange(callback) - this happens when the user presses
//   the back or forward button

var paramForClass = function(classObject) {
  var className = classObject.toString(),
      parts = className.split("."),
      last = parts[parts.length - 1];

  return Ember.String.underscore(last) + "_id";
};

var merge = function(original, hash) {
  for (var prop in hash) {
    if (!hash.hasOwnProperty(prop)) { continue; }
    if (original.hasOwnProperty(prop)) { continue; }

    original[prop] = hash[prop];
  }
};

/**
  @class Routable
  @namespace Ember
  @extends Ember.Mixin
*/
Ember.Routable = Ember.Mixin.create({
  init: function() {
    var redirection;
    this.on('setup', this, this.stashContext);

    if (redirection = get(this, 'redirectsTo')) {
      Ember.assert("You cannot use `redirectsTo` if you already have a `connectOutlets` method", this.connectOutlets === Ember.K);

      this.connectOutlets = function(router) {
        router.transitionTo(redirection);
      };
    }

    // normalize empty route to '/'
    var route = get(this, 'route');
    if (route === '') {
      route = '/';
    }

    this._super();

    Ember.assert("You cannot use `redirectsTo` on a state that has child states", !redirection || (!!redirection && !!get(this, 'isLeaf')));
  },

  setup: function() {
    return this.connectOutlets.apply(this, arguments);
  },

  /**
    @private

    Whenever a routable state is entered, the context it was entered with
    is stashed so that we can regenerate the state's `absoluteURL` on
    demand.

    @method stashContext
    @param manager {Ember.StateManager}
    @param context
  */
  stashContext: function(manager, context) {
    this.router = manager;

    var serialized = this.serialize(manager, context);
    Ember.assert('serialize must return a hash', !serialized || typeof serialized === 'object');

    manager.setStateMeta(this, 'context', context);
    manager.setStateMeta(this, 'serialized', serialized);

    if (get(this, 'isRoutable') && !get(manager, 'isRouting')) {
      this.updateRoute(manager, get(manager, 'location'));
    }
  },

  /**
    @private

    Whenever a routable state is entered, the router's location object
    is notified to set the URL to the current absolute path.

    In general, this will update the browser's URL.

    @method updateRoute
    @param manager {Ember.StateManager}
    @param location {Ember.Location}
  */
  updateRoute: function(manager, location) {
    if (get(this, 'isLeafRoute')) {
      var path = this.absoluteRoute(manager);
      location.setURL(path);
    }
  },

  /**
    @private

    Get the absolute route for the current state and a given
    hash.

    This method is private, as it expects a serialized hash,
    not the original context object.

    @method absoluteRoute
    @param manager {Ember.StateManager}
    @param hashes {Array}
  */
  absoluteRoute: function(manager, hashes) {
    var parentState = get(this, 'parentState'),
      path = '',
      generated,
      currentHash;

    // check if object passed instead of array
    // in this case set currentHash = hashes
    // this allows hashes to be a single hash
    // (it will be applied to state and all parents)
    currentHash = null;
    if (hashes) {
      if (hashes instanceof Array) {
        if (hashes.length > 0) {
          currentHash = hashes.shift();
        }
      } else {
        currentHash = hashes;
      }
    }

    // If the parent state is routable, use its current path
    // as this route's prefix.
    if (get(parentState, 'isRoutable')) {
      path = parentState.absoluteRoute(manager, hashes);
    }

    var matcher = get(this, 'routeMatcher'),
        serialized = manager.getStateMeta(this, 'serialized');

    // merge the existing serialized object in with the passed
    // in hash.
    currentHash = currentHash || {};
    merge(currentHash, serialized);

    generated = matcher && matcher.generate(currentHash);

    if (generated) {
      path = path + '/' + generated;
    }

    return path;
  },

  /**
    @private

    At the moment, a state is routable if it has a string `route`
    property. This heuristic may change.

    @property isRoutable
    @type Boolean
  */
  isRoutable: Ember.computed(function() {
    return typeof get(this, 'route') === 'string';
  }),

  /**
    @private

    Determine if this is the last routeable state

    @property isLeafRoute
    @type Boolean
  */
  isLeafRoute: Ember.computed(function() {
    if (get(this, 'isLeaf')) { return true; }
    return !get(this, 'childStates').findProperty('isRoutable');
  }),

  /**
    @private

    A `_RouteMatcher` object generated from the current route's `route`
    string property.

    @property routeMatcher
    @type Ember._RouteMatcher
  */
  routeMatcher: Ember.computed(function() {
    var route = get(this, 'route');
    if (route) {
      return Ember._RouteMatcher.create({ route: route });
    }
  }),

  /**
    @private

    Check whether the route has dynamic segments and therefore takes
    a context.

    @property hasContext
    @type Boolean
  */
  hasContext: Ember.computed(function() {
    var routeMatcher = get(this, 'routeMatcher');
    if (routeMatcher) {
      return routeMatcher.identifiers.length > 0;
    }
  }),

  /**
    @private

    The model class associated with the current state. This property
    uses the `modelType` property, in order to allow it to be
    specified as a String.

    @property modelClass
    @type Ember.Object
  */
  modelClass: Ember.computed(function() {
    var modelType = get(this, 'modelType');

    if (typeof modelType === 'string') {
      return Ember.get(Ember.lookup, modelType);
    } else {
      return modelType;
    }
  }),

  /**
    @private

    Get the model class for the state. The heuristic is:

    * The state must have a single dynamic segment
    * The dynamic segment must end in `_id`
    * A dynamic segment like `blog_post_id` is converted into `BlogPost`
    * The name is then looked up on the passed in namespace

    The process of initializing an application with a router will
    pass the application's namespace into the router, which will be
    used here.

    @method modelClassFor
    @param namespace {Ember.Namespace}
  */
  modelClassFor: function(namespace) {
    var modelClass, routeMatcher, identifiers, match, className;

    // if an explicit modelType was specified, use that
    if (modelClass = get(this, 'modelClass')) { return modelClass; }

    // if the router has no lookup namespace, we won't be able to guess
    // the modelType
    if (!namespace) { return; }

    // make sure this state is actually a routable state
    routeMatcher = get(this, 'routeMatcher');
    if (!routeMatcher) { return; }

    // only guess modelType for states with a single dynamic segment
    // (no more, no fewer)
    identifiers = routeMatcher.identifiers;
    if (identifiers.length !== 2) { return; }

    // extract the `_id` from the end of the dynamic segment; if the
    // dynamic segment does not end in `_id`, we can't guess the
    // modelType
    match = identifiers[1].match(/^(.*)_id$/);
    if (!match) { return; }

    // convert the underscored type into a class form and look it up
    // on the router's namespace
    className = Ember.String.classify(match[1]);
    return get(namespace, className);
  },

  /**
    The default method that takes a `params` object and converts
    it into an object.

    By default, a params hash that looks like `{ post_id: 1 }`
    will be looked up as `namespace.Post.find(1)`. This is
    designed to work seamlessly with Ember Data, but will work
    fine with any class that has a `find` method.

    @method deserialize
    @param manager {Ember.StateManager}
    @param params {Hash}
  */
  deserialize: function(manager, params) {
    var modelClass, routeMatcher, param;

    if (modelClass = this.modelClassFor(get(manager, 'namespace'))) {
      Ember.assert("Expected "+modelClass.toString()+" to implement `find` for use in '"+this.get('path')+"' `deserialize`. Please implement the `find` method or overwrite `deserialize`.", modelClass.find);
      return modelClass.find(params[paramForClass(modelClass)]);
    }

    return params;
  },

  /**
    The default method that takes an object and converts it into
    a params hash.

    By default, if there is a single dynamic segment named
    `blog_post_id` and the object is a `BlogPost` with an
    `id` of `12`, the serialize method will produce:

    ```javascript
    { blog_post_id: 12 }
    ```

    @method serialize
    @param manager {Ember.StateManager}
    @param context
  */
  serialize: function(manager, context) {
    var modelClass, routeMatcher, namespace, param, id;

    if (Ember.isEmpty(context)) { return ''; }

    if (modelClass = this.modelClassFor(get(manager, 'namespace'))) {
      param = paramForClass(modelClass);
      id = get(context, 'id');
      context = {};
      context[param] = id;
    }

    return context;
  },

  /**
    @private
    @method resolvePath
    @param manager {Ember.StateManager}
    @param path {String}
  */
  resolvePath: function(manager, path) {
    if (get(this, 'isLeafRoute')) { return Ember.A(); }

    var childStates = get(this, 'childStates'), match;

    childStates = Ember.A(childStates.filterProperty('isRoutable'));

    childStates = childStates.sort(function(a, b) {
      var aDynamicSegments = get(a, 'routeMatcher.identifiers.length'),
          bDynamicSegments = get(b, 'routeMatcher.identifiers.length'),
          aRoute = get(a, 'route'),
          bRoute = get(b, 'route');

      if (aRoute.indexOf(bRoute) === 0) {
        return -1;
      } else if (bRoute.indexOf(aRoute) === 0) {
        return 1;
      }

      if (aDynamicSegments !== bDynamicSegments) {
        return aDynamicSegments - bDynamicSegments;
      }

      return get(b, 'route.length') - get(a, 'route.length');
    });

    var state = childStates.find(function(state) {
      var matcher = get(state, 'routeMatcher');
      if (match = matcher.match(path)) { return true; }
    });

    Ember.assert("Could not find state for path " + path, !!state);

    var resolvedState = Ember._ResolvedState.create({
      manager: manager,
      state: state,
      match: match
    });

    var states = state.resolvePath(manager, match.remaining);

    return Ember.A([resolvedState]).pushObjects(states);
  },

  /**
    @private

    Once `unroute` has finished unwinding, `routePath` will be called
    with the remainder of the route.

    For example, if you were in the `/posts/1/comments` state, and you
    moved into the `/posts/2/comments` state, `routePath` will be called
    on the state whose path is `/posts` with the path `/2/comments`.

    @method routePath
    @param manager {Ember.StateManager}
    @param path {String}
  */
  routePath: function(manager, path) {
    if (get(this, 'isLeafRoute')) { return; }

    var resolvedStates = this.resolvePath(manager, path),
        hasPromises = resolvedStates.some(function(s) { return get(s, 'hasPromise'); });

    function runTransition() {
      resolvedStates.forEach(function(rs) { rs.transition(); });
    }

    if (hasPromises) {
      manager.transitionTo('loading');

      Ember.assert('Loading state should be the child of a route', Ember.Routable.detect(get(manager, 'currentState.parentState')));
      Ember.assert('Loading state should not be a route', !Ember.Routable.detect(get(manager, 'currentState')));

      manager.handleStatePromises(resolvedStates, runTransition);
    } else {
      runTransition();
    }
  },

  /**
    @private

    When you move to a new route by pressing the back
    or forward button, this method is called first.

    Its job is to move the state manager into a parent
    state of the state it will eventually move into.

    @method unroutePath
    @param router {Ember.Router}
    @param path {String}
  */
  unroutePath: function(router, path) {
    var parentState = get(this, 'parentState');

    // If we're at the root state, we're done
    if (parentState === router) {
      return;
    }

    path = path.replace(/^(?=[^\/])/, "/");
    var absolutePath = this.absoluteRoute(router);

    var route = get(this, 'route');

    // If the current path is empty, move up one state,
    // because the index ('/') state must be a leaf node.
    if (route !== '/') {
      // If the current path is a prefix of the path we're trying
      // to go to, we're done.
      var index = path.indexOf(absolutePath),
          next = path.charAt(absolutePath.length);

      if (index === 0 && (next === "/" || next === "")) {
        return;
      }
    }

    // Transition to the parent and call unroute again.
    router.enterState({
      exitStates: [this],
      enterStates: [],
      finalState: parentState
    });

    router.send('unroutePath', path);
  },

  parentTemplate: Ember.computed(function() {
    var state = this, parentState, template;

    while (state = get(state, 'parentState')) {
      if (template = get(state, 'template')) {
        return template;
      }
    }

    return 'application';
  }),

  _template: Ember.computed(function(key) {
    var value = get(this, 'template');

    if (value) { return value; }

    // If no template was explicitly supplied convert
    // the class name into a template name. For example,
    // App.PostRoute will return `post`.
    var className = this.constructor.toString(), baseName;
    if (/^[^\[].*Route$/.test(className)) {
      baseName = className.match(/([^\.]+\.)*([^\.]+)/)[2];
      baseName = baseName.replace(/Route$/, '');
      return baseName.charAt(0).toLowerCase() + baseName.substr(1);
    }
  }),

  render: function(options) {
    options = options || {};

    var template = options.template || get(this, '_template'),
        parentTemplate = options.into || get(this, 'parentTemplate'),
        controller = get(this.router, parentTemplate + "Controller");

    var viewName = Ember.String.classify(template) + "View",
        viewClass = get(get(this.router, 'namespace'), viewName);

    viewClass = (viewClass || Ember.View).extend({
      templateName: template
    });

    controller.set('view', viewClass.create());
  },

  /**
    The `connectOutlets` event will be triggered once a
    state has been entered. It will be called with the
    route's context.

    @event connectOutlets
    @param router {Ember.Router}
    @param [context*]
  */
  connectOutlets: Ember.K,

  /**
   The `navigateAway` event will be triggered when the
   URL changes due to the back/forward button

   @event navigateAway
  */
  navigateAway: Ember.K
});

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

/**
  @class Route
  @namespace Ember
  @extends Ember.State
  @uses Ember.Routable
*/
Ember.Route = Ember.State.extend(Ember.Routable);

})();



(function() {
var escapeForRegex = function(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^\$|#\s]/g, "\\$&");
};

/**
  @class _RouteMatcher
  @namespace Ember
  @private
  @extends Ember.Object
*/
Ember._RouteMatcher = Ember.Object.extend({
  state: null,

  init: function() {
    var route = this.route,
        identifiers = [],
        count = 1,
        escaped;

    // Strip off leading slash if present
    if (route.charAt(0) === '/') {
      route = this.route = route.substr(1);
    }

    escaped = escapeForRegex(route);

    var regex = escaped.replace(/(:|(?:\\\*))([a-z_]+)(?=$|\/)/gi, function(match, type, id) {
      identifiers[count++] = id;
      switch (type) {
        case ":":
          return "([^/]+)";
        case "\\*":
          return "(.+)";
      }
    });

    this.identifiers = identifiers;
    this.regex = new RegExp("^/?" + regex);
  },

  match: function(path) {
    var match = path.match(this.regex);

    if (match) {
      var identifiers = this.identifiers,
          hash = {};

      for (var i=1, l=identifiers.length; i<l; i++) {
        hash[identifiers[i]] = match[i];
      }

      return {
        remaining: path.substr(match[0].length),
        hash: identifiers.length > 0 ? hash : null
      };
    }
  },

  generate: function(hash) {
    var identifiers = this.identifiers, route = this.route, id;
    for (var i=1, l=identifiers.length; i<l; i++) {
      id = identifiers[i];
      route = route.replace(new RegExp("(:|(\\*))" + id), hash[id]);
    }
    return route;
  }
});

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

/*
  This file implements the `location` API used by Ember's router.

  That API is:

  getURL: returns the current URL
  setURL(path): sets the current URL
  onUpdateURL(callback): triggers the callback when the URL changes
  formatURL(url): formats `url` to be placed into `href` attribute

  Calling setURL will not trigger onUpdateURL callbacks.

  TODO: This should perhaps be moved so that it's visible in the doc output.
*/

/**
  Ember.Location returns an instance of the correct implementation of
  the `location` API.

  You can pass it a `implementation` (`hash`, `history`, `none`) to force a
  particular implementation.

  @class Location
  @namespace Ember
  @static
*/
Ember.Location = {
  create: function(options) {
    var implementation = options && options.implementation;
    Ember.assert("Ember.Location.create: you must specify a 'implementation' option", !!implementation);

    var implementationClass = this.implementations[implementation];
    Ember.assert("Ember.Location.create: " + implementation + " is not a valid implementation", !!implementationClass);

    return implementationClass.create.apply(implementationClass, arguments);
  },

  registerImplementation: function(name, implementation) {
    this.implementations[name] = implementation;
  },

  implementations: {}
};

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

/**
  `Ember.NoneLocation` does not interact with the browser. It is useful for
  testing, or when you need to manage state with your router, but temporarily
  don't want it to muck with the URL (for example when you embed your
  application in a larger page).

  @class NoneLocation
  @namespace Ember
  @extends Ember.Object
*/
Ember.NoneLocation = Ember.Object.extend({
  path: '',

  getURL: function() {
    return get(this, 'path');
  },

  setURL: function(path) {
    set(this, 'path', path);
  },

  onUpdateURL: function(callback) {
    // We are not wired up to the browser, so we'll never trigger the callback.
  },

  formatURL: function(url) {
    // The return value is not overly meaningful, but we do not want to throw
    // errors when test code renders templates containing {{action href=true}}
    // helpers.
    return url;
  }
});

Ember.Location.registerImplementation('none', Ember.NoneLocation);

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

/**
  `Ember.HashLocation` implements the location API using the browser's
  hash. At present, it relies on a hashchange event existing in the
  browser.

  @class HashLocation
  @namespace Ember
  @extends Ember.Object
*/
Ember.HashLocation = Ember.Object.extend({

  init: function() {
    set(this, 'location', get(this, 'location') || window.location);
  },

  /**
    @private

    Returns the current `location.hash`, minus the '#' at the front.

    @method getURL
  */
  getURL: function() {
    return get(this, 'location').hash.substr(1);
  },

  /**
    @private

    Set the `location.hash` and remembers what was set. This prevents
    `onUpdateURL` callbacks from triggering when the hash was set by
    `HashLocation`.

    @method setURL
    @param path {String}
  */
  setURL: function(path) {
    get(this, 'location').hash = path;
    set(this, 'lastSetURL', path);
  },

  /**
    @private

    Register a callback to be invoked when the hash changes. These
    callbacks will execute when the user presses the back or forward
    button, but not after `setURL` is invoked.

    @method onUpdateURL
    @param callback {Function}
  */
  onUpdateURL: function(callback) {
    var self = this;
    var guid = Ember.guidFor(this);

    Ember.$(window).bind('hashchange.ember-location-'+guid, function() {
      var path = location.hash.substr(1);
      if (get(self, 'lastSetURL') === path) { return; }

      set(self, 'lastSetURL', null);

      callback(location.hash.substr(1));
    });
  },

  /**
    @private

    Given a URL, formats it to be placed into the page as part
    of an element's `href` attribute.

    This is used, for example, when using the `{{action}}` helper
    to generate a URL based on an event.

    @method formatURL
    @param url {String}
  */
  formatURL: function(url) {
    return '#'+url;
  },

  willDestroy: function() {
    var guid = Ember.guidFor(this);

    Ember.$(window).unbind('hashchange.ember-location-'+guid);
  }
});

Ember.Location.registerImplementation('hash', Ember.HashLocation);

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;
var popstateReady = false;

/**
  `Ember.HistoryLocation` implements the location API using the browser's
  `history.pushState` API.

  @class HistoryLocation
  @namespace Ember
  @extends Ember.Object
*/
Ember.HistoryLocation = Ember.Object.extend({

  init: function() {
    set(this, 'location', get(this, 'location') || window.location);
    this.initState();
  },

  /**
    @private

    Used to set state on first call to `setURL`

    @method initState
  */
  initState: function() {
    this.replaceState(get(this, 'location').pathname);
    set(this, 'history', window.history);
  },

  /**
    Will be pre-pended to path upon state change

    @property rootURL
    @default '/'
  */
  rootURL: '/',

  /**
    @private

    Returns the current `location.pathname`.

    @method getURL
  */
  getURL: function() {
    return get(this, 'location').pathname;
  },

  /**
    @private

    Uses `history.pushState` to update the url without a page reload.

    @method setURL
    @param path {String}
  */
  setURL: function(path) {
    path = this.formatURL(path);

    if (this.getState() && this.getState().path !== path) {
      popstateReady = true;
      this.pushState(path);
    }
  },

  /**
   @private

   Get the current `history.state`

   @method getState
  */
  getState: function() {
    return get(this, 'history').state;
  },

  /**
   @private

   Pushes a new state

   @method pushState
   @param path {String}
  */
  pushState: function(path) {
    window.history.pushState({ path: path }, null, path);
  },

  /**
   @private

   Replaces the current state

   @method replaceState
   @param path {String}
  */
  replaceState: function(path) {
    window.history.replaceState({ path: path }, null, path);
  },

  /**
    @private

    Register a callback to be invoked whenever the browser
    history changes, including using forward and back buttons.

    @method onUpdateURL
    @param callback {Function}
  */
  onUpdateURL: function(callback) {
    var guid = Ember.guidFor(this);

    Ember.$(window).bind('popstate.ember-location-'+guid, function(e) {
      if(!popstateReady) {
        return;
      }
      callback(location.pathname);
    });
  },

  /**
    @private

    Used when using `{{action}}` helper. The url is always appended to the rootURL.

    @method formatURL
    @param url {String}
  */
  formatURL: function(url) {
    var rootURL = get(this, 'rootURL');

    if (url !== '') {
      rootURL = rootURL.replace(/\/$/, '');
    }

    return rootURL + url;
  },

  willDestroy: function() {
    var guid = Ember.guidFor(this);

    Ember.$(window).unbind('popstate.ember-location-'+guid);
  }
});

Ember.Location.registerImplementation('history', Ember.HistoryLocation);

})();



(function() {

})();



(function() {
// Ember.tryFinally

/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

var merge = function(original, hash) {
  for (var prop in hash) {
    if (!hash.hasOwnProperty(prop)) { continue; }
    if (original.hasOwnProperty(prop)) { continue; }

    original[prop] = hash[prop];
  }
};

/**
  `Ember.Router` is the subclass of `Ember.StateManager` responsible for
  providing URL-based application state detection. The `Ember.Router` instance
  of an application detects the browser URL at application load time and
  attempts to match it to a specific application state. Additionally the router
  will update the URL to reflect an application's state changes over time.

  ## Adding a Router Instance to Your Application

  An instance of `Ember.Router` can be associated with an instance of
  `Ember.Application` in one of two ways:

  You can provide a subclass of `Ember.Router` as the `Router` property of your
  application. An instance of this `Router` class will be instantiated and
  route detection will be enabled when the application's `initialize` method is
  called. The `Router` instance will be available as the `router` property of
  the application:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({ ... })
  });

  App.initialize();
  App.get('router') // an instance of App.Router
  ```

  If you want to define a `Router` instance elsewhere, you can pass the
  instance to the application's `initialize` method:

  ```javascript
  App = Ember.Application.create();
  aRouter = Ember.Router.create({ ... });

  App.initialize(aRouter);
  App.get('router') // aRouter
  ```

  ## Adding Routes to a Router

  The `initialState` property of `Ember.Router` instances is named `root`. The
  state stored in this property must be a subclass of `Ember.Route`. The `root`
  route acts as the container for the set of routable states but is not
  routable itself. It should have states that are also subclasses of
  `Ember.Route` which each have a `route` property describing the URL pattern
  you would like to detect.

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        index: Ember.Route.extend({
          route: '/'
        }),
        ... additional Ember.Routes ...
      })
    })
  });
  App.initialize();
  ```

  When an application loads, Ember will parse the URL and attempt to find an
  Ember.Route within the application's states that matches. (The example
  URL-matching below will use the default 'hash syntax' provided by
  `Ember.HashLocation`.)

  In the following route structure:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/'
        }),
        bRoute: Ember.Route.extend({
          route: '/alphabeta'
        })
      })
    })
  });
  App.initialize();
  ```

  Loading the page at the URL '#/' will detect the route property of
  `root.aRoute` ('/') and transition the router first to the state named `root`
  and then to the substate `aRoute`.

  Respectively, loading the page at the URL '#/alphabeta' would detect the
  route property of `root.bRoute` ('/alphabeta') and transition the router
  first to the state named `root` and then to the substate `bRoute`.

  ## Adding Nested Routes to a Router

  Routes can contain nested subroutes each with their own `route` property
  describing the nested portion of the URL they would like to detect and
  handle. `Router`, like all instances of `StateManager`, cannot call
  `transitonTo` with an intermediary state. To avoid transitioning the Router
  into an intermediary state when detecting URLs, a Route with nested routes
  must define both a base `route` property for itself and a child Route with a
  `route` property of `'/'` which will be transitioned to when the base route
  is detected in the URL:

  Given the following application code:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/theBaseRouteForThisSet',

          indexSubRoute: Ember.Route.extend({
            route: '/'
          }),

          subRouteOne: Ember.Route.extend({
            route: '/subroute1'
          }),

          subRouteTwo: Ember.Route.extend({
            route: '/subRoute2'
          })

        })
      })
    })
  });
  App.initialize();
  ```

  When the application is loaded at '/theBaseRouteForThisSet' the Router will
  transition to the route at path `root.aRoute` and then transition to state
  `indexSubRoute`.

  When the application is loaded at '/theBaseRouteForThisSet/subRoute1' the
  Router will transition to the route at path `root.aRoute` and then transition
  to state `subRouteOne`.

  ## Route Transition Events

  Transitioning between `Ember.Route` instances (including the transition into
  the detected route when loading the application) triggers the same
  transition events as state transitions for base `Ember.State`s. However, the
  default `setup` transition event is named `connectOutlets` on `Ember.Router`
  instances (see 'Changing View Hierarchy in Response To State Change').

  The following route structure when loaded with the URL "#/"

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/',
          enter: function(router) {
            console.log("entering root.aRoute from", router.get('currentState.name'));
          },
          connectOutlets: function(router) {
            console.log("entered root.aRoute, fully transitioned to", router.get('currentState.path'));
          }
        })
      })
    })
  });
  App.initialize();
  ```

  Will result in console output of:

  ```
  'entering root.aRoute from root'
  'entered root.aRoute, fully transitioned to root.aRoute '
  ```

  `Ember.Route` has two additional callbacks for handling URL serialization and
  deserialization. See 'Serializing/Deserializing URLs'

  ## Routes With Dynamic Segments

  An `Ember.Route`'s `route` property can reference dynamic sections of the URL
  by prefacing a URL segment with the ':' character. The values of these
  dynamic segments will be passed as a hash to the `deserialize` method of the
  matching `Route` (see 'Serializing/Deserializing URLs').

  ## Serializing/Deserializing URLs

  `Ember.Route` has two callbacks for associating a particular object context
  with a URL: `serialize` for converting an object into a parameters hash to
  fill dynamic segments of a URL and `deserialize` for converting a hash of
  dynamic segments from the URL into the appropriate object.

  ### Deserializing A URL's Dynamic Segments

  When an application is first loaded or the URL is changed manually (e.g.
  through the browser's back button) the `deserialize` method of the URL's
  matching `Ember.Route` will be called with the application's router as its
  first argument and a hash of the URL's dynamic segments and values as its
  second argument.

  The following route structure when loaded with the URL
  "#/fixed/thefirstvalue/anotherFixed/thesecondvalue":

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/fixed/:dynamicSectionA/anotherFixed/:dynamicSectionB',
          deserialize: function(router, params) {}
        })
      })
    })
  });
  App.initialize();
  ```

  Will call the `deserialize` method of the Route instance at the path
  `root.aRoute` with the following hash as its second argument:

  ```javascript
  {
    dynamicSectionA: 'thefirstvalue',
    dynamicSectionB: 'thesecondvalue'
  }
  ```

  Within `deserialize` you should use this information to retrieve or create an
  appropriate context object for the given URL (e.g. by loading from a remote
      API or accessing the browser's `localStorage`). This object must be the
  `return` value of `deserialize` and will be passed to the `Route`'s
  `connectOutlets` and `serialize` methods.

  When an application's state is changed from within the application itself,
  the context provided for the transition will be passed and `deserialize` is
  not called (see 'Transitions Between States').

  ### Serializing An Object For URLs with Dynamic Segments

  When transitioning into a Route whose `route` property contains dynamic
  segments the route's `serialize` method is called with the route's router as
  the first argument and the route's context as the second argument. The return
  value of `serialize` will be used to populate the dynamic segments and should
  be an object with keys that match the names of the dynamic sections.

  Given the following route structure:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/'
        }),
        bRoute: Ember.Route.extend({
          route: '/staticSection/:someDynamicSegment',
          serialize: function(router, context) {
            return {
              someDynamicSegment: context.get('name')
            }
          }
        })
      })
    })
  });
  App.initialize();
  ```

  Transitioning to `root.bRoute` with a context of
  `Object.create({name: 'Yehuda'})` will call the `Route`'s `serialize`
  method with the context as its second argument and update the URL to
  '#/staticSection/Yehuda'.

  ## Transitions Between States

  Once a routed application has initialized its state based on the entry URL,
  subsequent transitions to other states will update the URL if the entered
  Route has a `route` property. Given the following route structure loaded at
  the URL '#/':

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/',
          moveElsewhere: Ember.Route.transitionTo('bRoute')
        }),
        bRoute: Ember.Route.extend({
          route: '/someOtherLocation'
        })
      })
    })
  });
  App.initialize();
  ```

  And application code:

  ```javascript
  App.get('router').send('moveElsewhere');
  ```

  Will transition the application's state to `root.bRoute` and trigger an
  update of the URL to `#/someOtherLocation`.

  For URL patterns with dynamic segments a context can be supplied as the
  second argument to `send`. The router will match dynamic segments names to
  keys on this object and fill in the URL with the supplied values. Given the
  following state structure loaded at the URL `#/`:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/',
          moveElsewhere: Ember.Route.transitionTo('bRoute')
        }),
        bRoute: Ember.Route.extend({
          route: '/a/route/:dynamicSection/:anotherDynamicSection',
          connectOutlets: function(router, context) {},
        })
      })
    })
  });
  App.initialize();
  ```

  And application code:

  ```javascript
  App.get('router').send('moveElsewhere', {
    dynamicSection: '42',
    anotherDynamicSection: 'Life'
  });
  ```

  Will transition the application's state to `root.bRoute` and trigger an
  update of the URL to `#/a/route/42/Life`.

  The context argument will also be passed as the second argument to the
  `serialize` method call.

  ## Injection of Controller Singletons

  During application initialization Ember will detect properties of the
  application ending in 'Controller', create singleton instances of each class,
  and assign them as properties on the router. The property name will be the
  UpperCamel name converted to lowerCamel format. These controller classes
  should be subclasses of `Ember.ObjectController`, `Ember.ArrayController`,
  `Ember.Controller`, or a custom `Ember.Object` that includes the
  `Ember.ControllerMixin` mixin.

  ```javascript
  App = Ember.Application.create({
    FooController: Ember.Object.create(Ember.ControllerMixin),
    Router: Ember.Router.extend({ ... })
  });

  App.get('router.fooController'); // instance of App.FooController
  ```

  The controller singletons will have their `namespace` property set to the
  application and their `target` property set to the application's router
  singleton for easy integration with Ember's user event system. See 'Changing
  View Hierarchy in Response To State Change' and 'Responding to User-initiated
  Events.'

  ## Responding to User-initiated Events

  Controller instances injected into the router at application initialization
  have their `target` property set to the application's router instance. These
  controllers will also be the default `context` for their associated views.
  Uses of the `{{action}}` helper will automatically target the application's
  router.

  Given the following application entered at the URL `#/`:

  ```javascript
  App = Ember.Application.create({
    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/',
          anActionOnTheRouter: function(router, context) {
            router.transitionTo('anotherState', context);
          }
        })
        anotherState: Ember.Route.extend({
          route: '/differentUrl',
          connectOutlets: function(router, context) {

          }
        })
      })
    })
  });
  App.initialize();
  ```

  The following template:

  ```html
  <script type="text/x-handlebars" data-template-name="aView">
      <h1><a {{action anActionOnTheRouter}}>{{title}}</a></h1>
  </script>
  ```

  Will delegate `click` events on the rendered `h1` to the application's router
  instance. In this case the `anActionOnTheRouter` method of the state at
  'root.aRoute' will be called with the view's controller as the context
  argument. This context will be passed to the `connectOutlets` as its second
  argument.

  Different `context` can be supplied from within the `{{action}}` helper,
  allowing specific context passing between application states:

  ```html
  <script type="text/x-handlebars" data-template-name="photos">
    {{#each photo in controller}}
      <h1><a {{action showPhoto photo}}>{{title}}</a></h1>
    {{/each}}
  </script>
  ```

  See `Handlebars.helpers.action` for additional usage examples.

  ## Changing View Hierarchy in Response To State Change

  Changes in application state that change the URL should be accompanied by
  associated changes in view hierarchy. This can be accomplished by calling
  `connectOutlet` on the injected controller singletons from within the
  'connectOutlets' event of an `Ember.Route`:

  ```javascript
  App = Ember.Application.create({
    OneController: Ember.ObjectController.extend(),
    OneView: Ember.View.extend(),

    AnotherController: Ember.ObjectController.extend(),
    AnotherView: Ember.View.extend(),

    Router: Ember.Router.extend({
      root: Ember.Route.extend({
        aRoute: Ember.Route.extend({
          route: '/',
          connectOutlets: function(router, context) {
            router.get('oneController').connectOutlet('another');
          },
        })
      })
    })
  });
  App.initialize();
  ```

  This will detect the `{{outlet}}` portion of `oneController`'s view (an
  instance of `App.OneView`) and fill it with a rendered instance of
  `App.AnotherView` whose `context` will be the single instance of
  `App.AnotherController` stored on the router in the `anotherController`
  property.

  For more information about Outlets, see `Ember.Handlebars.helpers.outlet`.
  For additional information on the `connectOutlet` method, see
  `Ember.Controller.connectOutlet`. For more information on controller
  injections, see `Ember.Application#initialize()`. For additional information
  about view context, see `Ember.View`.

  @class Router
  @namespace Ember
  @extends Ember.StateManager
*/
Ember.Router = Ember.StateManager.extend(
/** @scope Ember.Router.prototype */ {

  /**
    @property initialState
    @type String
    @default 'root'
  */
  initialState: 'root',

  /**
    The `Ember.Location` implementation to be used to manage the application
    URL state. The following values are supported:

    * `hash`: Uses URL fragment identifiers (like #/blog/1) for routing.
    * `history`: Uses the browser's history.pushstate API for routing. Only
       works in modern browsers with pushstate support.
    * `none`: Does not read or set the browser URL, but still allows for
       routing to happen. Useful for testing.

    @property location
    @type String
    @default 'hash'
  */
  location: 'hash',

  /**
    This is only used when a history location is used so that applications that
    don't live at the root of the domain can append paths to their root.

    @property rootURL
    @type String
    @default '/'
  */

  rootURL: '/',

  transitionTo: function() {
    this.abortRoutingPromises();
    this._super.apply(this, arguments);
  },

  route: function(path) {
    this.abortRoutingPromises();

    set(this, 'isRouting', true);

    var routableState;
    function tryable() {
      path = path.replace(get(this, 'rootURL'), '');
      path = path.replace(/^(?=[^\/])/, "/");

      this.send('navigateAway');
      this.send('unroutePath', path);

      routableState = get(this, 'currentState');
      while (routableState && !routableState.get('isRoutable')) {
        routableState = get(routableState, 'parentState');
      }
      var currentURL = routableState ? routableState.absoluteRoute(this) : '';
      var rest = path.substr(currentURL.length);

      this.send('routePath', rest);
    }

    function finalizer() {
      set(this, 'isRouting', false);
    }

    Ember.tryFinally(tryable, finalizer, this);

    routableState = get(this, 'currentState');
    while (routableState && !routableState.get('isRoutable')) {
      routableState = get(routableState, 'parentState');
    }

    if (routableState) {
      routableState.updateRoute(this, get(this, 'location'));
    }
  },

  urlFor: function(path, hashes) {
    var currentState = get(this, 'currentState') || this,
        state = this.findStateByPath(currentState, path);

    Ember.assert(Ember.String.fmt("Could not find route with path '%@'", [path]), state);
    Ember.assert(Ember.String.fmt("To get a URL for the state '%@', it must have a `route` property.", [path]), get(state, 'routeMatcher'));

    var location = get(this, 'location'),
        absoluteRoute = state.absoluteRoute(this, hashes);

    return location.formatURL(absoluteRoute);
  },

  urlForEvent: function(eventName) {
    var contexts = Array.prototype.slice.call(arguments, 1),
      currentState = get(this, 'currentState'),
      targetStateName = currentState.lookupEventTransition(eventName),
      targetState,
      hashes;

    Ember.assert(Ember.String.fmt("You must specify a target state for event '%@' in order to link to it in the current state '%@'.", [eventName, get(currentState, 'path')]), targetStateName);

    targetState = this.findStateByPath(currentState, targetStateName);

    Ember.assert("Your target state name " + targetStateName + " for event " + eventName + " did not resolve to a state", targetState);


    hashes = this.serializeRecursively(targetState, contexts, []);

    return this.urlFor(targetStateName, hashes);
  },

  serializeRecursively: function(state, contexts, hashes) {
    var parentState,
			context = get(state, 'hasContext') ? contexts.pop() : null,
      hash = context ? state.serialize(this, context) : null;

		hashes.push(hash);
		parentState = state.get("parentState");

		if (parentState && parentState instanceof Ember.Route) {
      return this.serializeRecursively(parentState, contexts, hashes);
    } else {
      return hashes;
    }
  },

  abortRoutingPromises: function() {
    if (this._routingPromises) {
      this._routingPromises.abort();
      this._routingPromises = null;
    }
  },

  handleStatePromises: function(states, complete) {
    this.abortRoutingPromises();

    this.set('isLocked', true);

    var manager = this;

    this._routingPromises = Ember._PromiseChain.create({
      promises: states.slice(),

      successCallback: function() {
        manager.set('isLocked', false);
        complete();
      },

      failureCallback: function() {
        throw "Unable to load object";
      },

      promiseSuccessCallback: function(item, args) {
        set(item, 'object', args[0]);
      },

      abortCallback: function() {
        manager.set('isLocked', false);
      }
    }).start();
  },

  moveStatesIntoRoot: function() {
    this.root = Ember.Route.extend();

    for (var name in this) {
      if (name === "constructor") { continue; }

      var state = this[name];

      if (state instanceof Ember.Route || Ember.Route.detect(state)) {
        this.root[name] = state;
        delete this[name];
      }
    }
  },

  init: function() {
    if (!this.root) {
      this.moveStatesIntoRoot();
    }

    this._super();

    var location = get(this, 'location'),
        rootURL = get(this, 'rootURL');

    if ('string' === typeof location) {
      set(this, 'location', Ember.Location.create({
        implementation: location,
        rootURL: rootURL
      }));
    }

    this.assignRouter(this, this);
  },

  assignRouter: function(state, router) {
    state.router = router;

    var childStates = state.states;

    if (childStates) {
      for (var stateName in childStates) {
        if (!childStates.hasOwnProperty(stateName)) { continue; }
        this.assignRouter(childStates[stateName], router);
      }
    }
  },

  willDestroy: function() {
    get(this, 'location').destroy();
  }
});

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var EmberHandlebars = Ember.Handlebars,
    handlebarsGet = EmberHandlebars.get,
    get = Ember.get,
    a_slice = Array.prototype.slice;

var ActionHelper = EmberHandlebars.ActionHelper = {
  registeredActions: {}
};

ActionHelper.registerAction = function(actionName, options) {
  var actionId = (++Ember.uuid).toString();

  ActionHelper.registeredActions[actionId] = {
    eventName: options.eventName,
    handler: function(event) {
      var modifier = event.shiftKey || event.metaKey || event.altKey || event.ctrlKey,
          secondaryClick = event.which > 1, // IE9 may return undefined
          nonStandard = modifier || secondaryClick;

      if (options.link && nonStandard) {
        // Allow the browser to handle special link clicks normally
        return;
      }

      event.preventDefault();

      event.view = options.view;

      if (options.hasOwnProperty('context')) {
        event.context = options.context;
      }

      if (options.hasOwnProperty('contexts')) {
        event.contexts = options.contexts;
      }

      var target = options.target;

      // Check for StateManager (or compatible object)
      if (typeof target.send === 'function') {
        return target.send(actionName, event);
      } else {
        Ember.assert(Ember.String.fmt('Target %@ does not have action %@', [target, actionName]), target[actionName]);
        return target[actionName].call(target, event);
      }
    }
  };

  options.view.on('willClearRender', function() {
    delete ActionHelper.registeredActions[actionId];
  });

  return actionId;
};

/**
  The `{{action}}` helper registers an HTML element within a template for DOM
  event handling and forwards that interaction to the view's
  `controller.target` or supplied `target` option (see 'Specifying a Target').
  By default the `controller.target` is set to the application's router.

  User interaction with that element will invoke the supplied action name on
  the appropriate target.

  Given the following Handlebars template on the page

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    <div {{action anActionName target="view"}}>
      click me
    </div>
  </script>
  ```

  And application code

  ```javascript
  AView = Ember.View.extend({
    templateName: 'a-template',
    anActionName: function(event){}
  });

  aView = AView.create();
  aView.appendTo('body');
  ```

  Will results in the following rendered HTML

  ```html
  <div class="ember-view">
    <div data-ember-action="1">
      click me
    </div>
  </div>
  ```

  Clicking "click me" will trigger the `anActionName` method of the `aView`
  object with a  `jQuery.Event` object as its argument. The `jQuery.Event`
  object will be extended to include a `view` property that is set to the
  original view interacted with (in this case the `aView` object).

  ### Event Propagation

  Events triggered through the action helper will automatically have
  `.preventDefault()` called on them. You do not need to do so in your event
  handlers. To stop propagation of the event, simply return `false` from your
  handler.

  If you need the default handler to trigger you should either register your
  own event handler, or use event methods on your view class. See `Ember.View`
  'Responding to Browser Events' for more information.

  ### Specifying DOM event type

  By default the `{{action}}` helper registers for DOM `click` events. You can
  supply an `on` option to the helper to specify a different DOM event name:

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    <div {{action anActionName on="doubleClick"}}>
      click me
    </div>
  </script>
  ```

  See `Ember.View` 'Responding to Browser Events' for a list of
  acceptable DOM event names.

  Because `{{action}}` depends on Ember's event dispatch system it will only
  function if an `Ember.EventDispatcher` instance is available. An
  `Ember.EventDispatcher` instance will be created when a new
  `Ember.Application` is created. Having an instance of `Ember.Application`
  will satisfy this requirement.

  ### Specifying a Target

  There are several possible target objects for `{{action}}` helpers:

  In a typical `Ember.Router`-backed Application where views are managed
  through use of the `{{outlet}}` helper, actions will be forwarded to the
  current state of the Applications's Router. See `Ember.Router` 'Responding
  to User-initiated Events' for more information.

  If you manually set the `target` property on the controller of a template's
  `Ember.View` instance, the specifed `controller.target` will become the
  target for any actions. Likely custom values for a controller's `target` are
  the controller itself or a StateManager other than the Application's
  router.

  If the templates's view lacks a controller property the view itself is the
  target.

  Finally, a `target` option can be provided to the helper to change which
  object will receive the method call. This option must be a string
  representing a path to an object:

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    <div {{action anActionName target="MyApplication.someObject"}}>
      click me
    </div>
  </script>
  ```

  Clicking "click me" in the rendered HTML of the above template will trigger
  the  `anActionName` method of the object at `MyApplication.someObject`.
  The first argument to this method will be a `jQuery.Event` extended to
  include a `view` property that is set to the original view interacted with.

  A path relative to the template's `Ember.View` instance can also be used as
  a target:

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    <div {{action anActionName target="parentView"}}>
      click me
    </div>
  </script>
  ```

  Clicking "click me" in the rendered HTML of the above template will trigger
  the `anActionName` method of the view's parent view.

  The `{{action}}` helper is `Ember.StateManager` aware. If the target of the
  action is an `Ember.StateManager` instance `{{action}}` will use the `send`
  functionality of StateManagers. The documentation for `Ember.StateManager`
  has additional information about this use.

  If an action's target does not implement a method that matches the supplied
  action name an error will be thrown.

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    <div {{action aMethodNameThatIsMissing}}>
      click me
    </div>
  </script>
  ```

  With the following application code

  ```javascript
  AView = Ember.View.extend({
    templateName; 'a-template',
    // note: no method 'aMethodNameThatIsMissing'
    anActionName: function(event){}
  });

  aView = AView.create();
  aView.appendTo('body');
  ```

  Will throw `Uncaught TypeError: Cannot call method 'call' of undefined` when
  "click me" is clicked.

  ### Specifying a context

  You may optionally specify objects to pass as contexts to the `{{action}}`
  helper by providing property paths as the subsequent parameters. These
  objects are made available as the `contexts` (also `context` if there is only
  one) properties in the `jQuery.Event` object:

  ```handlebars
  <script type="text/x-handlebars" data-template-name='a-template'>
    {{#each person in people}}
      <div {{action edit person}}>
        click me
      </div>
    {{/each}}
  </script>
  ```

  Clicking "click me" will trigger the `edit` method of the view's context with
  a `jQuery.Event` object containing the person object as its context.

  @method action
  @for Ember.Handlebars.helpers
  @param {String} actionName
  @param {Object...} contexts
  @param {Hash} options
*/
EmberHandlebars.registerHelper('action', function(actionName) {
  var options = arguments[arguments.length - 1],
      contexts = a_slice.call(arguments, 1, -1);

  var hash = options.hash,
      view = options.data.view,
      target, controller, link;

  // create a hash to pass along to registerAction
  var action = {
    eventName: hash.on || "click"
  };

  action.view = view = get(view, 'concreteView');

  if (hash.target) {
    target = handlebarsGet(this, hash.target, options);
  } else if (controller = options.data.keywords.controller) {
    target = controller;
  }

  action.target = target = target || view;

  if (contexts.length) {
    action.contexts = contexts = Ember.EnumerableUtils.map(contexts, function(context) {
      return handlebarsGet(this, context, options);
    }, this);
    action.context = contexts[0];
  }

  var output = [], url;

  if (hash.href && target.urlForEvent) {
    url = target.urlForEvent.apply(target, [actionName].concat(contexts));
    output.push('href="' + url + '"');
    action.link = true;
  }

  var actionId = ActionHelper.registerAction(actionName, action);
  output.push('data-ember-action="' + actionId + '"');

  return new EmberHandlebars.SafeString(output.join(" "));
});

})();



(function() {

})();



(function() {
Ember.onLoad('Ember.Handlebars', function(Handlebars) {
  /**
  @module ember
  @submodule ember-old-router
  */

  Handlebars.OutletView = Ember.ContainerView.extend(Ember._Metamorph);

  /**
    The `outlet` helper allows you to specify that the current
    view's controller will fill in the view for a given area.

    ``` handlebars
    {{outlet}}
    ```

    By default, when the the current controller's `view` property changes, the
    outlet will replace its current view with the new view. You can set the
    `view` property directly, but it's normally best to use `connectOutlet`.

    ``` javascript
    # Instantiate App.PostsView and assign to `view`, so as to render into outlet.
    controller.connectOutlet('posts');
    ```

    You can also specify a particular name other than `view`:

    ``` handlebars
    {{outlet masterView}}
    {{outlet detailView}}
    ```

    Then, you can control several outlets from a single controller.

    ``` javascript
    # Instantiate App.PostsView and assign to controller.masterView.
    controller.connectOutlet('masterView', 'posts');
    # Also, instantiate App.PostInfoView and assign to controller.detailView.
    controller.connectOutlet('detailView', 'postInfo');
    ```

    @method outlet
    @for Ember.Handlebars.helpers
    @param {String} property the property on the controller
      that holds the view for this outlet
  */
  Handlebars.registerHelper('outlet', function(property, options) {
    if (property && property.data && property.data.isRenderData) {
      options = property;
      property = 'view';
    }

    options.hash.currentViewBinding = "view.context." + property;

    return Handlebars.helpers.view.call(this, Handlebars.OutletView, options);
  });

});

})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set;

/**
Additional methods for the ControllerMixin

@class ControllerMixin
@namespace Ember
*/
Ember.ControllerMixin.reopen({
  controllers: null,

  /**
    `connectOutlet` creates a new instance of a provided view
    class, wires it up to its associated controller, and
    assigns the new view to a property on the current controller.

    The purpose of this method is to enable views that use
    outlets to quickly assign new views for a given outlet.

    For example, an application view's template may look like
    this:

    ``` handlebars
    <h1>My Blog</h1>
    {{outlet}}
    ```

    The view for this outlet is specified by assigning a
    `view` property to the application's controller. The
    following code will assign a new `App.PostsView` to
    that outlet:

    ``` javascript
    applicationController.connectOutlet('posts');
    ```

    In general, you will also want to assign a controller
    to the newly created view. By convention, a controller
    named `postsController` will be assigned as the view's
    controller.

    In an application initialized using `app.initialize(router)`,
    `connectOutlet` will look for `postsController` on the
    router. The initialization process will automatically
    create an instance of `App.PostsController` called
    `postsController`, so you don't need to do anything
    beyond `connectOutlet` to assign your view and wire it
    up to its associated controller.

    You can supply a `content` for the controller by supplying
    a final argument after the view class:

    ``` javascript
    applicationController.connectOutlet('posts', App.Post.find());
    ```

    You can specify a particular outlet to use. For example, if your main
    template looks like:

    ``` handlebars
    <h1>My Blog</h1>
    {{outlet masterView}}
    {{outlet detailView}}
    ```

    You can assign an `App.PostsView` to the masterView outlet:

    ``` javascript
    applicationController.connectOutlet({
      outletName: 'masterView',
      name: 'posts',
      context: App.Post.find()
    });
    ```

    You can write this as:

    ``` javascript
    applicationController.connectOutlet('masterView', 'posts', App.Post.find());
    ```


    @method connectOutlet
    @param {String} outletName a name for the outlet to set
    @param {String} name a view/controller pair name
    @param {Object} context a context object to assign to the
      controller's `content` property, if a controller can be
      found (optional)
  */
  connectOutlet: function(name, context) {
    // Normalize arguments. Supported arguments:
    //
    // name
    // name, context
    // outletName, name
    // outletName, name, context
    // options
    //
    // The options hash has the following keys:
    //
    //   name: the name of the controller and view
    //     to use. If this is passed, the name
    //     determines the view and controller.
    //   outletName: the name of the outlet to
    //     fill in. default: 'view'
    //   viewClass: the class of the view to instantiate
    //   controller: the controller instance to pass
    //     to the view
    //   context: an object that should become the
    //     controller's `content` and thus the
    //     template's context.

    var outletName, viewClass, view, controller, options;

    if (Ember.typeOf(context) === 'string') {
      outletName = name;
      name = context;
      context = arguments[2];
    }

    if (arguments.length === 1) {
      if (Ember.typeOf(name) === 'object') {
        options = name;
        outletName = options.outletName;
        name = options.name;
        viewClass = options.viewClass;
        controller = options.controller;
        context = options.context;
      }
    } else {
      options = {};
    }

    outletName = outletName || 'view';

    Ember.assert("The viewClass is either missing or the one provided did not resolve to a view", !!name || (!name && !!viewClass));

    Ember.assert("You must supply a name or a viewClass to connectOutlet, but not both", (!!name && !viewClass && !controller) || (!name && !!viewClass));

    if (name) {
      var namespace = get(this, 'namespace'),
          controllers = get(this, 'controllers');

      var viewClassName = name.charAt(0).toUpperCase() + name.substr(1) + "View";
      viewClass = get(namespace, viewClassName);
      controller = get(controllers, name + 'Controller');

      Ember.assert("The name you supplied '" + name + "' did not resolve to a view " + viewClassName, !!viewClass);
      Ember.assert("The name you supplied '" + name + "' did not resolve to a controller " + name + 'Controller', (!!controller && !!context) || !context);
    }

    if (controller && context) { set(controller, 'content', context); }

    view = this.createOutletView(outletName, viewClass);

    if (controller) { set(view, 'controller', controller); }
    set(this, outletName, view);

    return view;
  },

  /**
    Convenience method to connect controllers. This method makes other controllers
    available on the controller the method was invoked on.

    For example, to make the `personController` and the `postController` available
    on the `overviewController`, you would call:

    ```javascript
    overviewController.connectControllers('person', 'post');
    ```

    @method connectControllers
    @param {String...} controllerNames the controllers to make available
  */
  connectControllers: function() {
    var controllers = get(this, 'controllers'),
        controllerNames = Array.prototype.slice.apply(arguments),
        controllerName;

    for (var i=0, l=controllerNames.length; i<l; i++) {
      controllerName = controllerNames[i] + 'Controller';
      set(this, controllerName, get(controllers, controllerName));
    }
  },

  /**
    `disconnectOutlet` removes previously attached view from given outlet.

    @method disconnectOutlet
    @param  {String} outletName the outlet name. (optional)
   */
  disconnectOutlet: function(outletName) {
    outletName = outletName || 'view';

    set(this, outletName, null);
  },

  /**
    `createOutletView` is a hook you may want to override if you need to do
    something special with the view created for the outlet. For example
    you may want to implement views sharing across outlets.

    @method createOutletView
    @param outletName {String}
    @param viewClass {Ember.View}
  */
  createOutletView: function(outletName, viewClass) {
    return viewClass.create();
  },

  urlForEvent: function(event, context) {
    var target = get(this, 'target');

    if (target) {
      return target.urlForEvent(event, context);
    }
  }
});


})();



(function() {
/**
@module ember
@submodule ember-old-router
*/

var get = Ember.get, set = Ember.set, fmt = Ember.String.fmt;

/**
Override functionality for Ember.View use in old-router

@class View
@namespace Ember
*/
Ember.View.reopen({
  templateForName: function(name, type) {
    if (!name) { return; }

    Ember.assert("templateNames are not allowed to contain periods: "+name, name.indexOf('.') === -1);

    var templates = get(this, 'templates'),
        template = get(templates, name);

    if (!template) {
      throw new Ember.Error(fmt('%@ - Unable to find %@ "%@".', [this, type, name]));
    }

    return template;
  }
});

})();



(function() {
/**
Ember Old Router

@module ember
@submodule ember-old-router
@requires ember-states
*/

})();

