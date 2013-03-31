(function() {
define("route-recognizer",
  [],
  function() {
    "use strict";
    var specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];

    var escapeRegex = new RegExp('(\\' + specials.join('|\\') + ')', 'g');

    // A Segment represents a segment in the original route description.
    // Each Segment type provides an `eachChar` and `regex` method.
    //
    // The `eachChar` method invokes the callback with one or more character
    // specifications. A character specification consumes one or more input
    // characters.
    //
    // The `regex` method returns a regex fragment for the segment. If the
    // segment is a dynamic of star segment, the regex fragment also includes
    // a capture.
    //
    // A character specification contains:
    //
    // * `validChars`: a String with a list of all valid characters, or
    // * `invalidChars`: a String with a list of all invalid characters
    // * `repeat`: true if the character specification can repeat

    function StaticSegment(string) { this.string = string; }
    StaticSegment.prototype = {
      eachChar: function(callback) {
        var string = this.string, char;

        for (var i=0, l=string.length; i<l; i++) {
          char = string.charAt(i);
          callback({ validChars: char });
        }
      },

      regex: function() {
        return this.string.replace(escapeRegex, '\\$1');
      },

      generate: function() {
        return this.string;
      }
    };

    function DynamicSegment(name) { this.name = name; }
    DynamicSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "/", repeat: true });
      },

      regex: function() {
        return "([^/]+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function StarSegment(name) { this.name = name; }
    StarSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "", repeat: true });
      },

      regex: function() {
        return "(.+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function EpsilonSegment() {}
    EpsilonSegment.prototype = {
      eachChar: function() {},
      regex: function() { return ""; },
      generate: function() { return ""; }
    };

    function parse(route, names, types) {
      // normalize route as not starting with a "/". Recognition will
      // also normalize.
      if (route.charAt(0) === "/") { route = route.substr(1); }

      var segments = route.split("/"), results = [];

      for (var i=0, l=segments.length; i<l; i++) {
        var segment = segments[i], match;

        if (match = segment.match(/^:([^\/]+)$/)) {
          results.push(new DynamicSegment(match[1]));
          names.push(match[1]);
          types.dynamics++;
        } else if (match = segment.match(/^\*([^\/]+)$/)) {
          results.push(new StarSegment(match[1]));
          names.push(match[1]);
          types.stars++;
        } else if(segment === "") {
          results.push(new EpsilonSegment());
        } else {
          results.push(new StaticSegment(segment));
          types.statics++;
        }
      }

      return results;
    }

    // A State has a character specification and (`charSpec`) and a list of possible
    // subsequent states (`nextStates`).
    //
    // If a State is an accepting state, it will also have several additional
    // properties:
    //
    // * `regex`: A regular expression that is used to extract parameters from paths
    //   that reached this accepting state.
    // * `handlers`: Information on how to convert the list of captures into calls
    //   to registered handlers with the specified parameters
    // * `types`: How many static, dynamic or star segments in this route. Used to
    //   decide which route to use if multiple registered routes match a path.
    //
    // Currently, State is implemented naively by looping over `nextStates` and
    // comparing a character specification against a character. A more efficient
    // implementation would use a hash of keys pointing at one or more next states.

    function State(charSpec) {
      this.charSpec = charSpec;
      this.nextStates = [];
    }

    State.prototype = {
      get: function(charSpec) {
        var nextStates = this.nextStates;

        for (var i=0, l=nextStates.length; i<l; i++) {
          var child = nextStates[i];

          var isEqual = child.charSpec.validChars === charSpec.validChars;
          isEqual = isEqual && child.charSpec.invalidChars === charSpec.invalidChars;

          if (isEqual) { return child; }
        }
      },

      put: function(charSpec) {
        var state;

        // If the character specification already exists in a child of the current
        // state, just return that state.
        if (state = this.get(charSpec)) { return state; }

        // Make a new state for the character spec
        state = new State(charSpec);

        // Insert the new state as a child of the current state
        this.nextStates.push(state);

        // If this character specification repeats, insert the new state as a child
        // of itself. Note that this will not trigger an infinite loop because each
        // transition during recognition consumes a character.
        if (charSpec.repeat) {
          state.nextStates.push(state);
        }

        // Return the new state
        return state;
      },

      // Find a list of child states matching the next character
      match: function(char) {
        // DEBUG "Processing `" + char + "`:"
        var nextStates = this.nextStates,
            child, charSpec, chars;

        // DEBUG "  " + debugState(this)
        var returned = [];

        for (var i=0, l=nextStates.length; i<l; i++) {
          child = nextStates[i];

          charSpec = child.charSpec;

          if (typeof (chars = charSpec.validChars) !== 'undefined') {
            if (chars.indexOf(char) !== -1) { returned.push(child); }
          } else if (typeof (chars = charSpec.invalidChars) !== 'undefined') {
            if (chars.indexOf(char) === -1) { returned.push(child); }
          }
        }

        return returned;
      }

      /** IF DEBUG
      , debug: function() {
        var charSpec = this.charSpec,
            debug = "[",
            chars = charSpec.validChars || charSpec.invalidChars;

        if (charSpec.invalidChars) { debug += "^"; }
        debug += chars;
        debug += "]";

        if (charSpec.repeat) { debug += "+"; }

        return debug;
      }
      END IF **/
    };

    /** IF DEBUG
    function debug(log) {
      console.log(log);
    }

    function debugState(state) {
      return state.nextStates.map(function(n) {
        if (n.nextStates.length === 0) { return "( " + n.debug() + " [accepting] )"; }
        return "( " + n.debug() + " <then> " + n.nextStates.map(function(s) { return s.debug() }).join(" or ") + " )";
      }).join(", ")
    }
    END IF **/

    // This is a somewhat naive strategy, but should work in a lot of cases
    // A better strategy would properly resolve /posts/:id/new and /posts/edit/:id
    function sortSolutions(states) {
      return states.sort(function(a, b) {
        if (a.types.stars !== b.types.stars) { return a.types.stars - b.types.stars; }
        if (a.types.dynamics !== b.types.dynamics) { return a.types.dynamics - b.types.dynamics; }
        if (a.types.statics !== b.types.statics) { return a.types.statics - b.types.statics; }

        return 0;
      });
    }

    function recognizeChar(states, char) {
      var nextStates = [];

      for (var i=0, l=states.length; i<l; i++) {
        var state = states[i];

        nextStates = nextStates.concat(state.match(char));
      }

      return nextStates;
    }

    function findHandler(state, path) {
      var handlers = state.handlers, regex = state.regex;
      var captures = path.match(regex), currentCapture = 1;
      var result = [];

      for (var i=0, l=handlers.length; i<l; i++) {
        var handler = handlers[i], names = handler.names, params = {};

        for (var j=0, m=names.length; j<m; j++) {
          params[names[j]] = captures[currentCapture++];
        }

        result.push({ handler: handler.handler, params: params, isDynamic: !!names.length });
      }

      return result;
    }

    function addSegment(currentState, segment) {
      segment.eachChar(function(char) {
        var state;

        currentState = currentState.put(char);
      });

      return currentState;
    }

    // The main interface

    var RouteRecognizer = function() {
      this.rootState = new State();
      this.names = {};
    };


    RouteRecognizer.prototype = {
      add: function(routes, options) {
        var currentState = this.rootState, regex = "^",
            types = { statics: 0, dynamics: 0, stars: 0 },
            handlers = [], allSegments = [], name;

        var isEmpty = true;

        for (var i=0, l=routes.length; i<l; i++) {
          var route = routes[i], names = [];

          var segments = parse(route.path, names, types);

          allSegments = allSegments.concat(segments);

          for (var j=0, m=segments.length; j<m; j++) {
            var segment = segments[j];

            if (segment instanceof EpsilonSegment) { continue; }

            isEmpty = false;

            // Add a "/" for the new segment
            currentState = currentState.put({ validChars: "/" });
            regex += "/";

            // Add a representation of the segment to the NFA and regex
            currentState = addSegment(currentState, segment);
            regex += segment.regex();
          }

          handlers.push({ handler: route.handler, names: names });
        }

        if (isEmpty) {
          currentState = currentState.put({ validChars: "/" });
          regex += "/";
        }

        currentState.handlers = handlers;
        currentState.regex = new RegExp(regex + "$");
        currentState.types = types;

        if (name = options && options.as) {
          this.names[name] = {
            segments: allSegments,
            handlers: handlers
          };
        }
      },

      handlersFor: function(name) {
        var route = this.names[name], result = [];
        if (!route) { throw new Error("There is no route named " + name); }

        for (var i=0, l=route.handlers.length; i<l; i++) {
          result.push(route.handlers[i]);
        }

        return result;
      },

      hasRoute: function(name) {
        return !!this.names[name];
      },

      generate: function(name, params) {
        var route = this.names[name], output = "";
        if (!route) { throw new Error("There is no route named " + name); }

        var segments = route.segments;

        for (var i=0, l=segments.length; i<l; i++) {
          var segment = segments[i];

          if (segment instanceof EpsilonSegment) { continue; }

          output += "/";
          output += segment.generate(params);
        }

        if (output.charAt(0) !== '/') { output = '/' + output; }

        return output;
      },

      recognize: function(path) {
        var states = [ this.rootState ], i, l;

        // DEBUG GROUP path

        var pathLen = path.length;

        if (path.charAt(0) !== "/") { path = "/" + path; }

        if (pathLen > 1 && path.charAt(pathLen - 1) === "/") {
          path = path.substr(0, pathLen - 1);
        }

        for (i=0, l=path.length; i<l; i++) {
          states = recognizeChar(states, path.charAt(i));
          if (!states.length) { break; }
        }

        // END DEBUG GROUP

        var solutions = [];
        for (i=0, l=states.length; i<l; i++) {
          if (states[i].handlers) { solutions.push(states[i]); }
        }

        states = sortSolutions(solutions);

        var state = solutions[0];

        if (state && state.handlers) {
          return findHandler(state, path);
        }
      }
    };

    function Target(path, matcher, delegate) {
      this.path = path;
      this.matcher = matcher;
      this.delegate = delegate;
    }

    Target.prototype = {
      to: function(target, callback) {
        var delegate = this.delegate;

        if (delegate && delegate.willAddRoute) {
          target = delegate.willAddRoute(this.matcher.target, target);
        }

        this.matcher.add(this.path, target);

        if (callback) {
          if (callback.length === 0) { throw new Error("You must have an argument in the function passed to `to`"); }
          this.matcher.addChild(this.path, target, callback, this.delegate);
        }
      }
    };

    function Matcher(target) {
      this.routes = {};
      this.children = {};
      this.target = target;
    }

    Matcher.prototype = {
      add: function(path, handler) {
        this.routes[path] = handler;
      },

      addChild: function(path, target, callback, delegate) {
        var matcher = new Matcher(target);
        this.children[path] = matcher;

        var match = generateMatch(path, matcher, delegate);

        if (delegate && delegate.contextEntered) {
          delegate.contextEntered(target, match);
        }

        callback(match);
      }
    };

    function generateMatch(startingPath, matcher, delegate) {
      return function(path, nestedCallback) {
        var fullPath = startingPath + path;

        if (nestedCallback) {
          nestedCallback(generateMatch(fullPath, matcher, delegate));
        } else {
          return new Target(startingPath + path, matcher, delegate);
        }
      };
    }

    function addRoute(routeArray, path, handler) {
      var len = 0;
      for (var i=0, l=routeArray.length; i<l; i++) {
        len += routeArray[i].path.length;
      }

      path = path.substr(len);
      routeArray.push({ path: path, handler: handler });
    }

    function eachRoute(baseRoute, matcher, callback, binding) {
      var routes = matcher.routes;

      for (var path in routes) {
        if (routes.hasOwnProperty(path)) {
          var routeArray = baseRoute.slice();
          addRoute(routeArray, path, routes[path]);

          if (matcher.children[path]) {
            eachRoute(routeArray, matcher.children[path], callback, binding);
          } else {
            callback.call(binding, routeArray);
          }
        }
      }
    }

    RouteRecognizer.prototype.map = function(callback, addRouteCallback) {
      var matcher = new Matcher();

      callback(generateMatch("", matcher, this.delegate));

      eachRoute([], matcher, function(route) {
        if (addRouteCallback) { addRouteCallback(this, route); }
        else { this.add(route); }
      }, this);
    };
    return RouteRecognizer;
  });

})();



(function() {
define("router",
  ["route-recognizer"],
  function(RouteRecognizer) {
    "use strict";
    /**
      @private

      This file references several internal structures:

      ## `RecognizedHandler`

      * `{String} handler`: A handler name
      * `{Object} params`: A hash of recognized parameters

      ## `UnresolvedHandlerInfo`

      * `{Boolean} isDynamic`: whether a handler has any dynamic segments
      * `{String} name`: the name of a handler
      * `{Object} context`: the active context for the handler

      ## `HandlerInfo`

      * `{Boolean} isDynamic`: whether a handler has any dynamic segments
      * `{String} name`: the original unresolved handler name
      * `{Object} handler`: a handler object
      * `{Object} context`: the active context for the handler
    */


    function Router() {
      this.recognizer = new RouteRecognizer();
    }


    Router.prototype = {
      /**
        The main entry point into the router. The API is essentially
        the same as the `map` method in `route-recognizer`.

        This method extracts the String handler at the last `.to()`
        call and uses it as the name of the whole route.

        @param {Function} callback
      */
      map: function(callback) {
        this.recognizer.delegate = this.delegate;

        this.recognizer.map(callback, function(recognizer, route) {
          var lastHandler = route[route.length - 1].handler;
          var args = [route, { as: lastHandler }];
          recognizer.add.apply(recognizer, args);
        });
      },

      hasRoute: function(route) {
        return this.recognizer.hasRoute(route);
      },

      /**
        The entry point for handling a change to the URL (usually
        via the back and forward button).

        Returns an Array of handlers and the parameters associated
        with those parameters.

        @param {String} url a URL to process

        @return {Array} an Array of `[handler, parameter]` tuples
      */
      handleURL: function(url) {
        var results = this.recognizer.recognize(url),
            objects = [];

        if (!results) {
          throw new Error("No route matched the URL '" + url + "'");
        }

        collectObjects(this, results, 0, []);
      },

      /**
        Hook point for updating the URL.

        @param {String} url a URL to update to
      */
      updateURL: function() {
        throw "updateURL is not implemented";
      },

      /**
        Hook point for replacing the current URL, i.e. with replaceState

        By default this behaves the same as `updateURL`

        @param {String} url a URL to update to
      */
      replaceURL: function(url) {
        this.updateURL(url);
      },

      /**
        Transition into the specified named route.

        If necessary, trigger the exit callback on any handlers
        that are no longer represented by the target route.

        @param {String} name the name of the route
      */
      transitionTo: function(name) {
        var args = Array.prototype.slice.call(arguments, 1);
        doTransition(this, name, this.updateURL, args);
      },

      /**
        Identical to `transitionTo` except that the current URL will be replaced
        if possible.

        This method is intended primarily for use with `replaceState`.

        @param {String} name the name of the route
      */
      replaceWith: function(name) {
        var args = Array.prototype.slice.call(arguments, 1);
        doTransition(this, name, this.replaceURL, args);
      },

      /**
        @private

        This method takes a handler name and a list of contexts and returns
        a serialized parameter hash suitable to pass to `recognizer.generate()`.

        @param {String} handlerName
        @param {Array[Object]} contexts
        @return {Object} a serialized parameter hash
      */
      paramsForHandler: function(handlerName, callback) {
        var output = this._paramsForHandler(handlerName, [].slice.call(arguments, 1));
        return output.params;
      },

      /**
        Take a named route and context objects and generate a
        URL.

        @param {String} name the name of the route to generate
          a URL for
        @param {...Object} objects a list of objects to serialize

        @return {String} a URL
      */
      generate: function(handlerName) {
        var params = this.paramsForHandler.apply(this, arguments);
        return this.recognizer.generate(handlerName, params);
      },

      /**
        @private

        Used internally by `generate` and `transitionTo`.
      */
      _paramsForHandler: function(handlerName, objects, doUpdate) {
        var handlers = this.recognizer.handlersFor(handlerName),
            params = {},
            toSetup = [],
            startIdx = handlers.length,
            objectsToMatch = objects.length,
            object, objectChanged, handlerObj, handler, names, i, len;

        // Find out which handler to start matching at
        for (i=handlers.length-1; i>=0 && objectsToMatch>0; i--) {
          if (handlers[i].names.length) {
            objectsToMatch--;
            startIdx = i;
          }
        }

        if (objectsToMatch > 0) {
          throw "More objects were passed than dynamic segments";
        }

        // Connect the objects to the routes
        for (i=0, len=handlers.length; i<len; i++) {
          handlerObj = handlers[i];
          handler = this.getHandler(handlerObj.handler);
          names = handlerObj.names;
          objectChanged = false;

          // If it's a dynamic segment
          if (names.length) {
            // If we have objects, use them
            if (i >= startIdx) {
              object = objects.shift();
              objectChanged = true;
            // Otherwise use existing context
            } else {
              object = handler.context;
            }

            // Serialize to generate params
            if (handler.serialize) {
              merge(params, handler.serialize(object, names));
            }
          // If it's not a dynamic segment and we're updating
          } else if (doUpdate) {
            // If we've passed the match point we need to deserialize again
            // or if we never had a context
            if (i > startIdx || !handler.hasOwnProperty('context')) {
              if (handler.deserialize) {
                object = handler.deserialize({});
                objectChanged = true;
              }
            // Otherwise use existing context
            } else {
              object = handler.context;
            }
          }

          // Make sure that we update the context here so it's available to
          // subsequent deserialize calls
          if (doUpdate && objectChanged) {
            // TODO: It's a bit awkward to set the context twice, see if we can DRY things up
            setContext(handler, object);
          }

          toSetup.push({
            isDynamic: !!handlerObj.names.length,
            handler: handlerObj.handler,
            name: handlerObj.name,
            context: object
          });
        }

        return { params: params, toSetup: toSetup };
      },

      isActive: function(handlerName) {
        var contexts = [].slice.call(arguments, 1);

        var currentHandlerInfos = this.currentHandlerInfos,
            found = false, names, object, handlerInfo, handlerObj;

        for (var i=currentHandlerInfos.length-1; i>=0; i--) {
          handlerInfo = currentHandlerInfos[i];
          if (handlerInfo.name === handlerName) { found = true; }

          if (found) {
            if (contexts.length === 0) { break; }

            if (handlerInfo.isDynamic) {
              object = contexts.pop();
              if (handlerInfo.context !== object) { return false; }
            }
          }
        }

        return contexts.length === 0 && found;
      },

      trigger: function(name) {
        var args = [].slice.call(arguments);
        trigger(this, args);
      }
    };

    function merge(hash, other) {
      for (var prop in other) {
        if (other.hasOwnProperty(prop)) { hash[prop] = other[prop]; }
      }
    }

    function isCurrent(currentHandlerInfos, handlerName) {
      return currentHandlerInfos[currentHandlerInfos.length - 1].name === handlerName;
    }

    /**
      @private

      This function is called the first time the `collectObjects`
      function encounters a promise while converting URL parameters
      into objects.

      It triggers the `enter` and `setup` methods on the `loading`
      handler.

      @param {Router} router
    */
    function loading(router) {
      if (!router.isLoading) {
        router.isLoading = true;
        var handler = router.getHandler('loading');

        if (handler) {
          if (handler.enter) { handler.enter(); }
          if (handler.setup) { handler.setup(); }
        }
      }
    }

    /**
      @private

      This function is called if a promise was previously
      encountered once all promises are resolved.

      It triggers the `exit` method on the `loading` handler.

      @param {Router} router
    */
    function loaded(router) {
      router.isLoading = false;
      var handler = router.getHandler('loading');
      if (handler && handler.exit) { handler.exit(); }
    }

    /**
      @private

      This function is called if any encountered promise
      is rejected.

      It triggers the `exit` method on the `loading` handler,
      the `enter` method on the `failure` handler, and the
      `setup` method on the `failure` handler with the
      `error`.

      @param {Router} router
      @param {Object} error the reason for the promise
        rejection, to pass into the failure handler's
        `setup` method.
    */
    function failure(router, error) {
      loaded(router);
      var handler = router.getHandler('failure');
      if (handler && handler.setup) { handler.setup(error); }
    }

    /**
      @private
    */
    function doTransition(router, name, method, args) {
      var output = router._paramsForHandler(name, args, true);
      var params = output.params, toSetup = output.toSetup;

      var url = router.recognizer.generate(name, params);
      method.call(router, url);

      setupContexts(router, toSetup);
    }

    /**
      @private

      This function is called after a URL change has been handled
      by `router.handleURL`.

      Takes an Array of `RecognizedHandler`s, and converts the raw
      params hashes into deserialized objects by calling deserialize
      on the handlers. This process builds up an Array of
      `HandlerInfo`s. It then calls `setupContexts` with the Array.

      If the `deserialize` method on a handler returns a promise
      (i.e. has a method called `then`), this function will pause
      building up the `HandlerInfo` Array until the promise is
      resolved. It will use the resolved value as the context of
      `HandlerInfo`.
    */
    function collectObjects(router, results, index, objects) {
      if (results.length === index) {
        loaded(router);
        setupContexts(router, objects);
        return;
      }

      var result = results[index];
      var handler = router.getHandler(result.handler);
      var object = handler.deserialize && handler.deserialize(result.params);

      if (object && typeof object.then === 'function') {
        loading(router);

        // The chained `then` means that we can also catch errors that happen in `proceed`
        object.then(proceed).then(null, function(error) {
          failure(router, error);
        });
      } else {
        proceed(object);
      }

      function proceed(value) {
        if (handler.context !== object) {
          setContext(handler, object);
        }

        var updatedObjects = objects.concat([{
          context: value,
          handler: result.handler,
          isDynamic: result.isDynamic
        }]);
        collectObjects(router, results, index + 1, updatedObjects);
      }
    }

    /**
      @private

      Takes an Array of `UnresolvedHandlerInfo`s, resolves the handler names
      into handlers, and then figures out what to do with each of the handlers.

      For example, consider the following tree of handlers. Each handler is
      followed by the URL segment it handles.

      ```
      |~index ("/")
      | |~posts ("/posts")
      | | |-showPost ("/:id")
      | | |-newPost ("/new")
      | | |-editPost ("/edit")
      | |~about ("/about/:id")
      ```

      Consider the following transitions:

      1. A URL transition to `/posts/1`.
         1. Triggers the `deserialize` callback on the
            `index`, `posts`, and `showPost` handlers
         2. Triggers the `enter` callback on the same
         3. Triggers the `setup` callback on the same
      2. A direct transition to `newPost`
         1. Triggers the `exit` callback on `showPost`
         2. Triggers the `enter` callback on `newPost`
         3. Triggers the `setup` callback on `newPost`
      3. A direct transition to `about` with a specified
         context object
         1. Triggers the `exit` callback on `newPost`
            and `posts`
         2. Triggers the `serialize` callback on `about`
         3. Triggers the `enter` callback on `about`
         4. Triggers the `setup` callback on `about`

      @param {Router} router
      @param {Array[UnresolvedHandlerInfo]} handlerInfos
    */
    function setupContexts(router, handlerInfos) {
      resolveHandlers(router, handlerInfos);

      var partition =
        partitionHandlers(router.currentHandlerInfos || [], handlerInfos);

      router.currentHandlerInfos = handlerInfos;

      eachHandler(partition.exited, function(handler, context) {
        delete handler.context;
        if (handler.exit) { handler.exit(); }
      });

      eachHandler(partition.updatedContext, function(handler, context) {
        setContext(handler, context);
        if (handler.setup) { handler.setup(context); }
      });

      var aborted = false;
      eachHandler(partition.entered, function(handler, context) {
        if (aborted) { return; }
        if (handler.enter) { handler.enter(); }
        setContext(handler, context);
        if (handler.setup) {
          if (false === handler.setup(context)) {
            aborted = true;
          }
        }
      });

      if (router.didTransition) {
        router.didTransition(handlerInfos);
      }
    }

    /**
      @private

      Iterates over an array of `HandlerInfo`s, passing the handler
      and context into the callback.

      @param {Array[HandlerInfo]} handlerInfos
      @param {Function(Object, Object)} callback
    */
    function eachHandler(handlerInfos, callback) {
      for (var i=0, l=handlerInfos.length; i<l; i++) {
        var handlerInfo = handlerInfos[i],
            handler = handlerInfo.handler,
            context = handlerInfo.context;

        callback(handler, context);
      }
    }

    /**
      @private

      Updates the `handler` field in each element in an Array of
      `UnresolvedHandlerInfo`s from a handler name to a resolved handler.

      When done, the Array will contain `HandlerInfo` structures.

      @param {Router} router
      @param {Array[UnresolvedHandlerInfo]} handlerInfos
    */
    function resolveHandlers(router, handlerInfos) {
      var handlerInfo;

      for (var i=0, l=handlerInfos.length; i<l; i++) {
        handlerInfo = handlerInfos[i];

        handlerInfo.name = handlerInfo.handler;
        handlerInfo.handler = router.getHandler(handlerInfo.handler);
      }
    }

    /**
      @private

      This function is called when transitioning from one URL to
      another to determine which handlers are not longer active,
      which handlers are newly active, and which handlers remain
      active but have their context changed.

      Take a list of old handlers and new handlers and partition
      them into four buckets:

      * unchanged: the handler was active in both the old and
        new URL, and its context remains the same
      * updated context: the handler was active in both the
        old and new URL, but its context changed. The handler's
        `setup` method, if any, will be called with the new
        context.
      * exited: the handler was active in the old URL, but is
        no longer active.
      * entered: the handler was not active in the old URL, but
        is now active.

      The PartitionedHandlers structure has three fields:

      * `updatedContext`: a list of `HandlerInfo` objects that
        represent handlers that remain active but have a changed
        context
      * `entered`: a list of `HandlerInfo` objects that represent
        handlers that are newly active
      * `exited`: a list of `HandlerInfo` objects that are no
        longer active.

      @param {Array[HandlerInfo]} oldHandlers a list of the handler
        information for the previous URL (or `[]` if this is the
        first handled transition)
      @param {Array[HandlerInfo]} newHandlers a list of the handler
        information for the new URL

      @return {Partition}
    */
    function partitionHandlers(oldHandlers, newHandlers) {
      var handlers = {
            updatedContext: [],
            exited: [],
            entered: []
          };

      var handlerChanged, contextChanged, i, l;

      for (i=0, l=newHandlers.length; i<l; i++) {
        var oldHandler = oldHandlers[i], newHandler = newHandlers[i];

        if (!oldHandler || oldHandler.handler !== newHandler.handler) {
          handlerChanged = true;
        }

        if (handlerChanged) {
          handlers.entered.push(newHandler);
          if (oldHandler) { handlers.exited.unshift(oldHandler); }
        } else if (contextChanged || oldHandler.context !== newHandler.context) {
          contextChanged = true;
          handlers.updatedContext.push(newHandler);
        }
      }

      for (i=newHandlers.length, l=oldHandlers.length; i<l; i++) {
        handlers.exited.unshift(oldHandlers[i]);
      }

      return handlers;
    }

    function trigger(router, args) {
      var currentHandlerInfos = router.currentHandlerInfos;

      var name = args.shift();

      if (!currentHandlerInfos) {
        throw new Error("Could not trigger event '" + name + "'. There are no active handlers");
      }

      for (var i=currentHandlerInfos.length-1; i>=0; i--) {
        var handlerInfo = currentHandlerInfos[i],
            handler = handlerInfo.handler;

        if (handler.events && handler.events[name]) {
          handler.events[name].apply(handler, args);
          return;
        }
      }

      throw new Error("Nothing handled the event '" + name + "'.");
    }

    function setContext(handler, context) {
      handler.context = context;
      if (handler.contextDidChange) { handler.contextDidChange(); }
    }
    return Router;
  });

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

function DSL(name) {
  this.parent = name;
  this.matches = [];
}

DSL.prototype = {
  resource: function(name, options, callback) {
    if (arguments.length === 2 && typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (arguments.length === 1) {
      options = {};
    }

    if (typeof options.path !== 'string') {
      options.path = "/" + name;
    }

    if (callback) {
      var dsl = new DSL(name);
      callback.call(dsl);
      this.push(options.path, name, dsl.generate());
    } else {
      this.push(options.path, name);
    }
  },

  push: function(url, name, callback) {
    var parts = name.split('.');
    if (url === "" || url === "/" || parts[parts.length-1] === "index") { this.explicitIndex = true; }

    this.matches.push([url, name, callback]);
  },

  route: function(name, options) {
    Ember.assert("You must use `this.resource` to nest", typeof options !== 'function');

    options = options || {};

    if (typeof options.path !== 'string') {
      options.path = "/" + name;
    }

    if (this.parent && this.parent !== 'application') {
      name = this.parent + "." + name;
    }

    this.push(options.path, name);
  },

  generate: function() {
    var dslMatches = this.matches;

    if (!this.explicitIndex) {
      this.route("index", { path: "/" });
    }

    return function(match) {
      for (var i=0, l=dslMatches.length; i<l; i++) {
        var dslMatch = dslMatches[i];
        match(dslMatch[0]).to(dslMatch[1], dslMatch[2]);
      }
    };
  }
};

DSL.map = function(callback) {
  var dsl = new DSL();
  callback.call(dsl);
  return dsl;
};

Ember.RouterDSL = DSL;

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

Ember.controllerFor = function(container, controllerName, context, lookupOptions) {
  return container.lookup('controller:' + controllerName, lookupOptions) ||
         Ember.generateController(container, controllerName, context);
};
/**
  Generates a controller automatically if none was provided.
  The type of generated controller depends on the context.
  You can customize your generated controllers by defining
  `App.ObjectController` and `App.ArrayController`
*/
Ember.generateController = function(container, controllerName, context) {
  var controller, DefaultController, fullName;

  if (context && Ember.isArray(context)) {
    DefaultController = container.resolve('controller:array');
    controller = DefaultController.extend({
      content: context
    });
  } else if (context) {
    DefaultController = container.resolve('controller:object');
    controller = DefaultController.extend({
      content: context
    });
  } else {
    DefaultController = container.resolve('controller:basic');
    controller = DefaultController.extend();
  }

  controller.toString = function() {
    return "(generated " + controllerName + " controller)";
  };


  fullName = 'controller:' + controllerName;
  container.register(fullName, controller);
  return container.lookup(fullName);
};

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var Router = requireModule("router");
var get = Ember.get, set = Ember.set;

var DefaultView = Ember._MetamorphView;
function setupLocation(router) {
  var location = get(router, 'location'),
      rootURL = get(router, 'rootURL');

  if ('string' === typeof location) {
    location = set(router, 'location', Ember.Location.create({
      implementation: location
    }));

    if (typeof rootURL === 'string') {
      set(location, 'rootURL', rootURL);
    }
  }
}

/**
  The `Ember.Router` class manages the application state and URLs. Refer to
  the [routing guide](http://emberjs.com/guides/routing/) for documentation.

  @class Router
  @namespace Ember
  @extends Ember.Object
*/
Ember.Router = Ember.Object.extend({
  location: 'hash',

  init: function() {
    this.router = this.constructor.router;
    this._activeViews = {};
    setupLocation(this);
  },

  url: Ember.computed(function() {
    return get(this, 'location').getURL();
  }),

  startRouting: function() {
    this.router = this.router || this.constructor.map(Ember.K);

    var router = this.router,
        location = get(this, 'location'),
        container = this.container,
        self = this;

    setupRouter(this, router, location);

    container.register('view:default', DefaultView);
    container.register('view:toplevel', Ember.View.extend());

    location.onUpdateURL(function(url) {
      self.handleURL(url);
    });

    this.handleURL(location.getURL());
  },

  didTransition: function(infos) {
    // Don't do any further action here if we redirected
    for (var i=0, l=infos.length; i<l; i++) {
      if (infos[i].handler.redirected) { return; }
    }

    var appController = this.container.lookup('controller:application'),
        path = routePath(infos);

    set(appController, 'currentPath', path);
    this.notifyPropertyChange('url');

    if (get(this, 'namespace').LOG_TRANSITIONS) {
      Ember.Logger.log("Transitioned into '" + path + "'");
    }
  },

  handleURL: function(url) {
    this.router.handleURL(url);
    this.notifyPropertyChange('url');
  },

  transitionTo: function(name) {
    var args = [].slice.call(arguments);
    doTransition(this, 'transitionTo', args);
  },

  replaceWith: function() {
    var args = [].slice.call(arguments);
    doTransition(this, 'replaceWith', args);
  },

  generate: function() {
    var url = this.router.generate.apply(this.router, arguments);
    return this.location.formatURL(url);
  },

  isActive: function(routeName) {
    var router = this.router;
    return router.isActive.apply(router, arguments);
  },

  send: function(name, context) {
    this.router.trigger.apply(this.router, arguments);
  },

  hasRoute: function(route) {
    return this.router.hasRoute(route);
  },

  _lookupActiveView: function(templateName) {
    var active = this._activeViews[templateName];
    return active && active[0];
  },

  _connectActiveView: function(templateName, view) {
    var existing = this._activeViews[templateName];

    if (existing) {
      existing[0].off('willDestroyElement', this, existing[1]);
    }

    var disconnect = function() {
      delete this._activeViews[templateName];
    };

    this._activeViews[templateName] = [view, disconnect];
    view.one('willDestroyElement', this, disconnect);
  }
});

Ember.Router.reopenClass({
  defaultFailureHandler: {
    setup: function(error) {
      Ember.Logger.error('Error while loading route:', error);

      // Using setTimeout allows us to escape from the Promise's try/catch block
      setTimeout(function() { throw error; });
    }
  }
});

function getHandlerFunction(router) {
  var seen = {}, container = router.container,
      DefaultRoute = container.resolve('route:basic');

  return function(name) {
    var routeName = 'route:' + name,
        handler = container.lookup(routeName);

    if (seen[name]) { return handler; }

    seen[name] = true;

    if (!handler) {
      if (name === 'loading') { return {}; }
      if (name === 'failure') { return router.constructor.defaultFailureHandler; }

      container.register(routeName, DefaultRoute.extend());
      handler = container.lookup(routeName);
    }

    handler.routeName = name;
    return handler;
  };
}

function routePath(handlerInfos) {
  var path = [];

  for (var i=1, l=handlerInfos.length; i<l; i++) {
    var name = handlerInfos[i].name,
        nameParts = name.split(".");

    path.push(nameParts[nameParts.length - 1]);
  }

  return path.join(".");
}

function setupRouter(emberRouter, router, location) {
  var lastURL;

  router.getHandler = getHandlerFunction(emberRouter);

  var doUpdateURL = function() {
    location.setURL(lastURL);
  };

  router.updateURL = function(path) {
    lastURL = path;
    Ember.run.once(doUpdateURL);
  };

  if (location.replaceURL) {
    var doReplaceURL = function() {
      location.replaceURL(lastURL);
    };

    router.replaceURL = function(path) {
      lastURL = path;
      Ember.run.once(doReplaceURL);
    };
  }

  router.didTransition = function(infos) {
    emberRouter.didTransition(infos);
  };
}

function doTransition(router, method, args) {
  var passedName = args[0], name;

  if (!router.router.hasRoute(args[0])) {
    name = args[0] = passedName + '.index';
  } else {
    name = passedName;
  }

  Ember.assert("The route " + passedName + " was not found", router.router.hasRoute(name));

  router.router[method].apply(router.router, args);
  router.notifyPropertyChange('url');
}

Ember.Router.reopenClass({
  map: function(callback) {
    var router = this.router = new Router();

    var dsl = Ember.RouterDSL.map(function() {
      this.resource('application', { path: "/" }, function() {
        callback.call(this);
      });
    });

    router.map(dsl.generate());
    return router;
  }
});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set,
    classify = Ember.String.classify;

/**
  The `Ember.Route` class is used to define individual routes. Refer to
  the [routing guide](http://emberjs.com/guides/routing/) for documentation.

  @class Route
  @namespace Ember
  @extends Ember.Object
*/
Ember.Route = Ember.Object.extend({
  /**
    @private

    @method exit
  */
  exit: function() {
    this.deactivate();
    teardownView(this);
  },

  /**
    @private

    @method enter
  */
  enter: function() {
    this.activate();
  },

  /**
    The collection of functions keyed by name available on this route as
    action targets.

    These functions will be invoked when a matching `{{action}}` is triggered
    from within a template and the application's current route is this route.

    Events can also be invoked from other parts of your application via `Route#send`.

    The context of event will be the this route.

    @see {Ember.Route#send}
    @see {Handlebars.helpers.action}

    @property events
    @type Hash
    @default null
  */
  events: null,

  /**
    This hook is executed when the router completely exits this route. It is
    not executed when the model for the route changes.

    @method deactivate
  */
  deactivate: Ember.K,

  /**
    This hook is executed when the router enters the route for the first time.
    It is not executed when the model for the route changes.

    @method activate
  */
  activate: Ember.K,

  /**
    Transition into another route. Optionally supply a model for the
    route in question. The model will be serialized into the URL
    using the `serialize` hook.

    @method transitionTo
    @param {String} name the name of the route
    @param {...Object} models the
  */
  transitionTo: function() {
    if (this._checkingRedirect) { this.redirected = true; }
    return this.router.transitionTo.apply(this.router, arguments);
  },

  /**
    Transition into another route while replacing the current URL if
    possible. Identical to `transitionTo` in all other respects.

    @method replaceWith
    @param {String} name the name of the route
    @param {...Object} models the
  */
  replaceWith: function() {
    if (this._checkingRedirect) { this.redirected = true; }
    return this.router.replaceWith.apply(this.router, arguments);
  },

  send: function() {
    return this.router.send.apply(this.router, arguments);
  },

  /**
    @private

    This hook is the entry point for router.js

    @method setup
  */
  setup: function(context) {
    this.redirected = false;
    this._checkingRedirect = true;

    if (context === undefined) {
      this.redirect();
    } else {
      this.redirect(context);
    }

    this._checkingRedirect = false;
    if (this.redirected) { return false; }

    var controller = this.controllerFor(this.routeName, context);

    if (controller) {
      this.controller = controller;
      set(controller, 'model', context);
    }

    if (this.setupControllers) {
      Ember.deprecate("Ember.Route.setupControllers is deprecated. Please use Ember.Route.setupController(controller, model) instead.");
      this.setupControllers(controller, context);
    } else {
      this.setupController(controller, context);
    }

    if (this.renderTemplates) {
      Ember.deprecate("Ember.Route.renderTemplates is deprecated. Please use Ember.Route.renderTemplate(controller, model) instead.");
      this.renderTemplates(context);
    } else {
      this.renderTemplate(controller, context);
    }
  },

  /**
    A hook you can implement to optionally redirect to another route.

    If you call `this.transitionTo` from inside of this hook, this route
    will not be entered in favor of the other hook.

    @method redirect
    @param {Object} model the model for this route
  */
  redirect: Ember.K,

  /**
    @private

    The hook called by `router.js` to convert parameters into the context
    for this handler. The public Ember hook is `model`.

    @method deserialize
  */
  deserialize: function(params) {
    var model = this.model(params);
    return this.currentModel = model;
  },

  /**
    @private

    Called when the context is changed by router.js.
  */
  contextDidChange: function() {
    this.currentModel = this.context;
  },

  /**
    A hook you can implement to convert the URL into the model for
    this route.

    ```js
    App.Router.map(function() {
      this.resource('post', {path: '/posts/:post_id'});
    });
    ```

    The model for the `post` route is `App.Post.find(params.post_id)`.

    By default, if your route has a dynamic segment ending in `_id`:

    * The model class is determined from the segment (`post_id`'s
      class is `App.Post`)
    * The find method is called on the model class with the value of
      the dynamic segment.

    Note that for routes with dynamic segments, this hook is only
    executed when entered via the URL. If the route is entered
    through a transition (e.g. when using the `linkTo` Handlebars
    helper), then a model context is already provided and this hook
    is not called. Routes without dynamic segments will always
    execute the model hook.

    @method model
    @param {Object} params the parameters extracted from the URL
  */
  model: function(params) {
    var match, name, sawParams, value;

    for (var prop in params) {
      if (match = prop.match(/^(.*)_id$/)) {
        name = match[1];
        value = params[prop];
      }
      sawParams = true;
    }

    if (!name && sawParams) { return params; }
    else if (!name) { return; }

    var className = classify(name),
        namespace = this.router.namespace,
        modelClass = namespace[className];

    Ember.assert("You used the dynamic segment " + name + "_id in your router, but " + namespace + "." + className + " did not exist and you did not override your route's `model` hook.", modelClass);
    return modelClass.find(value);
  },

  /**
    A hook you can implement to convert the route's model into parameters
    for the URL.

    ```js
    App.Router.map(function() {
      this.resource('post', {path: '/posts/:post_id'});
    });

    App.PostRoute = Ember.Route.extend({
      model: function(params) {
        // the server returns `{ id: 12 }`
        return jQuery.getJSON("/posts/" + params.post_id);
      },

      serialize: function(model) {
        // this will make the URL `/posts/12`
        return { post_id: model.id };
      }
    });
    ```

    The default `serialize` method inserts the model's `id` into the
    route's dynamic segment (in this case, `:post_id`).

    This method is called when `transitionTo` is called with a context
    in order to populate the URL.

    @method serialize
    @param {Object} model the route's model
    @param {Array} params an Array of parameter names for the current
      route (in the example, `['post_id']`.
    @return {Object} the serialized parameters
  */
  serialize: function(model, params) {
    if (params.length !== 1) { return; }

    var name = params[0], object = {};

    if (/_id$/.test(name)) {
      object[name] = get(model, 'id');
    } else {
      object[name] = model;
    }

    return object;
  },

  /**
    A hook you can use to setup the controller for the current route.

    This method is called with the controller for the current route and the
    model supplied by the `model` hook.

    ```js
    App.Router.map(function() {
      this.resource('post', {path: '/posts/:post_id'});
    });
    ```

    For the `post` route, the controller is `App.PostController`.

    By default, the `setupController` hook sets the `content` property of
    the controller to the `model`.

    If no explicit controller is defined, the route will automatically create
    an appropriate controller for the model:

    * if the model is an `Ember.Array` (including record arrays from Ember
      Data), the controller is an `Ember.ArrayController`.
    * otherwise, the controller is an `Ember.ObjectController`.

    This means that your template will get a proxy for the model as its
    context, and you can act as though the model itself was the context.

    @method setupController
  */
  setupController: Ember.K,

  /**
    Returns the controller for a particular route.

    ```js
    App.PostRoute = Ember.Route.extend({
      setupController: function(controller, post) {
        this._super(controller, post);
        this.controllerFor('posts').set('currentPost', post);
      }
    });
    ```

    By default, the controller for `post` is the shared instance of
    `App.PostController`.

    @method controllerFor
    @param {String} name the name of the route
    @param {Object} model the model associated with the route (optional)
    @return {Ember.Controller}
  */
  controllerFor: function(name, model) {
    var container = this.router.container,
        controller = container.lookup('controller:' + name);

    if (!controller) {
      model = model || this.modelFor(name);

      Ember.assert("You are trying to look up a controller that you did not define, and for which Ember does not know the model.\n\nThis is not a controller for a route, so you must explicitly define the controller ("+this.router.namespace.toString() + "." + Ember.String.capitalize(Ember.String.camelize(name))+"Controller) or pass a model as the second parameter to `controllerFor`, so that Ember knows which type of controller to create for you.", model || this.container.lookup('route:' + name));

      controller = Ember.generateController(container, name, model);
    }

    return controller;
  },

  /**
    Returns the current model for a given route.

    This is the object returned by the `model` hook of the route
    in question.

    @method modelFor
    @param {String} name the name of the route
    @return {Object} the model object
  */
  modelFor: function(name) {
    var route = this.container.lookup('route:' + name);
    return route && route.currentModel;
  },

  /**
    A hook you can use to render the template for the current route.

    This method is called with the controller for the current route and the
    model supplied by the `model` hook. By default, it renders the route's
    template, configured with the controller for the route.

    This method can be overridden to set up and render additional or
    alternative templates.

    @method renderTemplate
    @param {Object} controller the route's controller
    @param {Object} model the route's model
  */
  renderTemplate: function(controller, model) {
    this.render();
  },

  /**
    Renders a template into an outlet.

    This method has a number of defaults, based on the name of the
    route specified in the router.

    For example:

    ```js
    App.Router.map(function() {
      this.route('index');
      this.resource('post', {path: '/posts/:post_id'});
    });

    App.PostRoute = App.Route.extend({
      renderTemplate: function() {
        this.render();
      }
    });
    ```

    The name of the `PostRoute`, as defined by the router, is `post`.

    By default, render will:

    * render the `post` template
    * with the `post` view (`PostView`) for event handling, if one exists
    * and the `post` controller (`PostController`), if one exists
    * into the `main` outlet of the `application` template

    You can override this behavior:

    ```js
    App.PostRoute = App.Route.extend({
      renderTemplate: function() {
        this.render('myPost', {   // the template to render
          into: 'index',          // the template to render into
          outlet: 'detail',       // the name of the outlet in that template
          controller: 'blogPost'  // the controller to use for the template
        });
      }
    });
    ```

    Remember that the controller's `content` will be the route's model. In
    this case, the default model will be `App.Post.find(params.post_id)`.

    @method render
    @param {String} name the name of the template to render
    @param {Object} options the options
  */
  render: function(name, options) {
    Ember.assert("The name in the given arguments is undefined", arguments.length > 0 ? !Ember.isNone(arguments[0]) : true);

    if (typeof name === 'object' && !options) {
      options = name;
      name = this.routeName;
    }

    name = name ? name.replace(/\//g, '.') : this.routeName;

    var container = this.container,
        view = container.lookup('view:' + name),
        template = container.lookup('template:' + name);

    if (!view && !template) { return; }

    options = normalizeOptions(this, name, template, options);
    view = setupView(view, container, options);

    if (options.outlet === 'main') { this.lastRenderedTemplate = name; }

    appendView(this, view, options);
  },

  willDestroy: function() {
    teardownView(this);
  }
});

function parentRoute(route) {
  var handlerInfos = route.router.router.currentHandlerInfos;

  var parent, current;

  for (var i=0, l=handlerInfos.length; i<l; i++) {
    current = handlerInfos[i].handler;
    if (current === route) { return parent; }
    parent = current;
  }
}

function parentTemplate(route, isRecursive) {
  var parent = parentRoute(route), template;

  if (!parent) { return; }

  Ember.warn("The immediate parent route did not render into the main outlet and the default 'into' option may not be expected", !isRecursive);

  if (template = parent.lastRenderedTemplate) {
    return template;
  } else {
    return parentTemplate(parent, true);
  }
}

function normalizeOptions(route, name, template, options) {
  options = options || {};
  options.into = options.into ? options.into.replace(/\//g, '.') : parentTemplate(route);
  options.outlet = options.outlet || 'main';
  options.name = name;
  options.template = template;

  Ember.assert("An outlet ("+options.outlet+") was specified but this view will render at the root level.", options.outlet === 'main' || options.into);

  var controller = options.controller, namedController;

  if (options.controller) {
    controller = options.controller;
  } else if (namedController = route.container.lookup('controller:' + name)) {
    controller = namedController;
  } else {
    controller = route.routeName;
  }

  if (typeof controller === 'string') {
    controller = route.container.lookup('controller:' + controller);
  }

  options.controller = controller;

  return options;
}

function setupView(view, container, options) {
  var defaultView = options.into ? 'view:default' : 'view:toplevel';

  view = view || container.lookup(defaultView);

  if (!get(view, 'templateName')) {
    set(view, 'template', options.template);

    set(view, '_debugTemplateName', options.name);
  }

  set(view, 'renderedName', options.name);
  set(view, 'controller', options.controller);

  return view;
}

function appendView(route, view, options) {
  if (options.into) {
    var parentView = route.router._lookupActiveView(options.into);
    route.teardownView = teardownOutlet(parentView, options.outlet);
    parentView.connectOutlet(options.outlet, view);
  } else {
    var rootElement = get(route, 'router.namespace.rootElement');
    route.router._connectActiveView(options.name, view);
    route.teardownView = teardownTopLevel(view);
    view.appendTo(rootElement);
  }
}

function teardownTopLevel(view) {
  return function() { view.destroy(); };
}

function teardownOutlet(parentView, outlet) {
  return function() { parentView.disconnectOutlet(outlet); };
}

function teardownView(route) {
  if (route.teardownView) { route.teardownView(); }

  delete route.teardownView;
  delete route.lastRenderedTemplate;
}

})();



(function() {

})();



(function() {
Ember.onLoad('Ember.Handlebars', function() {
  var handlebarsResolve = Ember.Handlebars.resolveParams,
      map = Ember.ArrayPolyfills.map,
      get = Ember.get;

  function resolveParams(context, params, options) {
    var resolved = handlebarsResolve(context, params, options);
    return map.call(resolved, unwrap);

    function unwrap(object, i) {
      if (params[i] === 'controller') { return object; }

      if (Ember.ControllerMixin.detect(object)) {
        return unwrap(get(object, 'model'));
      } else {
        return object;
      }
    }
  }

  Ember.Router.resolveParams = resolveParams;
});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;
Ember.onLoad('Ember.Handlebars', function(Handlebars) {

  var resolveParams = Ember.Router.resolveParams,
      isSimpleClick = Ember.ViewUtils.isSimpleClick;

  function fullRouteName(router, name) {
    if (!router.hasRoute(name)) {
      name = name + '.index';
    }

    return name;
  }

  function resolvedPaths(options) {
    var types = options.options.types.slice(1),
        data = options.options.data;

    return resolveParams(options.context, options.params, { types: types, data: data });
  }

  function args(linkView, router, route) {
    var passedRouteName = route || linkView.namedRoute, routeName;

    routeName = fullRouteName(router, passedRouteName);

    Ember.assert("The route " + passedRouteName + " was not found", router.hasRoute(routeName));

    var ret = [ routeName ];
    return ret.concat(resolvedPaths(linkView.parameters));
  }

  /**
    Renders a link to the supplied route.

    When the rendered link matches the current route, and the same object instance is passed into the helper,
    then the link is given class="active" by default.

    You may re-open LinkView in order to change the default active class:

    ``` javascript
    Ember.LinkView.reopen({
      activeClass: "is-active"
    })
    ```

    @class LinkView
    @namespace Ember
    @extends Ember.View
  **/
  var LinkView = Ember.LinkView = Ember.View.extend({
    tagName: 'a',
    namedRoute: null,
    currentWhen: null,
    title: null,
    activeClass: 'active',
    replace: false,
    attributeBindings: ['href', 'title'],
    classNameBindings: 'active',

    // Even though this isn't a virtual view, we want to treat it as if it is
    // so that you can access the parent with {{view.prop}}
    concreteView: Ember.computed(function() {
      return get(this, 'parentView');
    }).property('parentView'),

    active: Ember.computed(function() {
      var router = this.get('router'),
          params = resolvedPaths(this.parameters),
          currentWithIndex = this.currentWhen + '.index',
          isActive = router.isActive.apply(router, [this.currentWhen].concat(params)) ||
                     router.isActive.apply(router, [currentWithIndex].concat(params));

      if (isActive) { return get(this, 'activeClass'); }
    }).property('namedRoute', 'router.url'),

    router: Ember.computed(function() {
      return this.get('controller').container.lookup('router:main');
    }),

    click: function(event) {
      if (!isSimpleClick(event)) { return true; }

      event.preventDefault();
      if (this.bubbles === false) { event.stopPropagation(); }

      var router = this.get('router');

      if (this.get('replace')) {
        router.replaceWith.apply(router, args(this, router));
      } else {
        router.transitionTo.apply(router, args(this, router));
      }
    },

    href: Ember.computed(function() {
      var router = this.get('router');
      return router.generate.apply(router, args(this, router));
    })
  });

  LinkView.toString = function() { return "LinkView"; };

  /**
    @method linkTo
    @for Ember.Handlebars.helpers
    @param {String} routeName
    @param {Object} [context]*
    @return {String} HTML string
  */
  Ember.Handlebars.registerHelper('linkTo', function(name) {
    var options = [].slice.call(arguments, -1)[0];
    var params = [].slice.call(arguments, 1, -1);

    var hash = options.hash;

    hash.namedRoute = name;
    hash.currentWhen = hash.currentWhen || name;

    hash.parameters = {
      context: this,
      options: options,
      params: params
    };

    return Ember.Handlebars.helpers.view.call(this, LinkView, options);
  });

});


})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;
Ember.onLoad('Ember.Handlebars', function(Handlebars) {
  /**
  @module ember
  @submodule ember-routing
  */

  Handlebars.OutletView = Ember.ContainerView.extend(Ember._Metamorph);

  /**
    The `outlet` helper is a placeholder that the router will fill in with
    the appropriate template based on the current state of the application.

    ``` handlebars
    {{outlet}}
    ```

    By default, a template based on Ember's naming conventions will be rendered
    into the `outlet` (e.g. `App.PostsRoute` will render the `posts` template).

    You can render a different template by using the `render()` method in the
    route's `renderTemplate` hook. The following will render the `favoritePost`
    template into the `outlet`.

    ``` javascript
    App.PostsRoute = Ember.Route.extend({
      renderTemplate: function() {
        this.render('favoritePost');
      }
    });
    ```

    You can create custom named outlets for more control.

    ``` handlebars
    {{outlet favoritePost}}
    {{outlet posts}}
    ```

    Then you can define what template is rendered into each outlet in your
    route.


    ``` javascript
    App.PostsRoute = Ember.Route.extend({
      renderTemplate: function() {
        this.render('favoritePost', { outlet: 'favoritePost' });
        this.render('posts', { outlet: 'posts' });
      }
    });
    ```

    @method outlet
    @for Ember.Handlebars.helpers
    @param {String} property the property on the controller
      that holds the view for this outlet
  */
  Handlebars.registerHelper('outlet', function(property, options) {
    var outletSource;

    if (property && property.data && property.data.isRenderData) {
      options = property;
      property = 'main';
    }

    outletSource = options.data.view;
    while (!(outletSource.get('template.isTop'))){
      outletSource = outletSource.get('_parentView');
    }

    options.data.view.set('outletSource', outletSource);
    options.hash.currentViewBinding = '_view.outletSource._outlets.' + property;

    return Handlebars.helpers.view.call(this, Handlebars.OutletView, options);
  });
});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;
Ember.onLoad('Ember.Handlebars', function(Handlebars) {

  /**
    Renders the named template in the current context using the singleton
    instance of the same-named controller.

    If a view class with the same name exists, uses the view class.

    If a `model` is specified, it becomes the model for that controller.

    The default target for `{{action}}`s in the rendered template is the
    named controller.

    @method render
    @for Ember.Handlebars.helpers
    @param {String} name
    @param {Object?} contextString
    @param {Hash} options
  */
  Ember.Handlebars.registerHelper('render', function(name, contextString, options) {
    Ember.assert("You must pass a template to render", arguments.length >= 2);
    var container, router, controller, view, context, lookupOptions;

    if (arguments.length === 2) {
      options = contextString;
      contextString = undefined;
    }

    if (typeof contextString === 'string') {
      context = Ember.Handlebars.get(options.contexts[1], contextString, options);
      lookupOptions = { singleton: false };
    }

    name = name.replace(/\//g, '.');
    container = options.data.keywords.controller.container;
    router = container.lookup('router:main');

    Ember.assert("You can only use the {{render}} helper once without a model object as its second argument, as in {{render \"post\" post}}.", context || !router || !router._lookupActiveView(name));

    view = container.lookup('view:' + name) || container.lookup('view:default');

    if (controller = options.hash.controller) {
      controller = container.lookup('controller:' + controller, lookupOptions);
    } else {
      controller = Ember.controllerFor(container, name, context, lookupOptions);
    }

    if (controller && context) {
      controller.set('model', context);
    }

    var root = options.contexts[1];

    if (root) {
      view.registerObserver(root, contextString, function() {
        controller.set('model', Ember.Handlebars.get(root, contextString, options));
      });
    }

    controller.set('target', options.data.keywords.controller);

    options.hash.viewName = Ember.String.camelize(name);
    options.hash.template = container.lookup('template:' + name);
    options.hash.controller = controller;

    if (router && !context) {
      router._connectActiveView(name, view);
    }

    Ember.Handlebars.helpers.view.call(this, view, options);
  });

});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/
Ember.onLoad('Ember.Handlebars', function(Handlebars) {

  var resolveParams = Ember.Router.resolveParams,
      isSimpleClick = Ember.ViewUtils.isSimpleClick;

  var EmberHandlebars = Ember.Handlebars,
      handlebarsGet = EmberHandlebars.get,
      SafeString = EmberHandlebars.SafeString,
      get = Ember.get,
      a_slice = Array.prototype.slice;

  function args(options, actionName) {
    var ret = [];
    if (actionName) { ret.push(actionName); }

    var types = options.options.types.slice(1),
        data = options.options.data;

    return ret.concat(resolveParams(options.context, options.params, { types: types, data: data }));
  }

  var ActionHelper = EmberHandlebars.ActionHelper = {
    registeredActions: {}
  };

  var keys = ["alt", "shift", "meta", "ctrl"];

  var isAllowedClick = function(event, allowedKeys) {
    if (typeof allowedKeys === "undefined") {
      return isSimpleClick(event);
    }

    var allowed = true;

    keys.forEach(function(key) {
      if (event[key + "Key"] && allowedKeys.indexOf(key) === -1) {
        allowed = false;
      }
    });

    return allowed;
  };

  ActionHelper.registerAction = function(actionName, options, allowedKeys) {
    var actionId = (++Ember.uuid).toString();

    ActionHelper.registeredActions[actionId] = {
      eventName: options.eventName,
      handler: function(event) {
        if (!isAllowedClick(event, allowedKeys)) { return true; }

        event.preventDefault();

        if (options.bubbles === false) {
          event.stopPropagation();
        }

        var target = options.target;

        if (target.target) {
          target = handlebarsGet(target.root, target.target, target.options);
        } else {
          target = target.root;
        }

        Ember.run(function() {
          if (target.send) {
            target.send.apply(target, args(options.parameters, actionName));
          } else {
            Ember.assert("The action '" + actionName + "' did not exist on " + target, typeof target[actionName] === 'function');
            target[actionName].apply(target, args(options.parameters));
          }
        });
      }
    };

    options.view.on('willClearRender', function() {
      delete ActionHelper.registeredActions[actionId];
    });

    return actionId;
  };

  /**
    The `{{action}}` helper registers an HTML element within a template for DOM
    event handling and forwards that interaction to the view's controller
    or supplied `target` option (see 'Specifying a Target').

    If the view's controller does not implement the event, the event is sent
    to the current route, and it bubbles up the route hierarchy from there.

    User interaction with that element will invoke the supplied action name on
    the appropriate target.

    Given the following Handlebars template on the page

    ```handlebars
    <script type="text/x-handlebars" data-template-name='a-template'>
      <div {{action anActionName}}>
        click me
      </div>
    </script>
    ```

    And application code

    ```javascript
    AController = Ember.Controller.extend({
      anActionName: function() {}
    });

    AView = Ember.View.extend({
      controller: AController.create(),
      templateName: 'a-template'
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

    Clicking "click me" will trigger the `anActionName` method of the
    `AController`. In this case, no additional parameters will be passed.

    If you provide additional parameters to the helper:

    ```handlebars
    <button {{action 'edit' post}}>Edit</button>
    ```

    Those parameters will be passed along as arguments to the JavaScript
    function implementing the action.

    ### Event Propagation

    Events triggered through the action helper will automatically have
    `.preventDefault()` called on them. You do not need to do so in your event
    handlers.

    To also disable bubbling, pass `bubbles=false` to the helper:

    ```handlebars
    <button {{action 'edit' post bubbles=false}}>Edit</button>
    ```

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

    NOTE: Because `{{action}}` depends on Ember's event dispatch system it will
    only function if an `Ember.EventDispatcher` instance is available. An
    `Ember.EventDispatcher` instance will be created when a new `Ember.Application`
    is created. Having an instance of `Ember.Application` will satisfy this
    requirement.

    ### Specifying whitelisted modifier keys

    By default the `{{action}}` helper will ignore click event with pressed modifier
    keys. You can supply an `allowedKeys` option to specify which keys should not be ignored.

    ```handlebars
    <script type="text/x-handlebars" data-template-name='a-template'>
      <div {{action anActionName allowedKeys="alt"}}>
        click me
      </div>
    </script>
    ```

    This way the `{{action}}` will fire when clicking with the alt key pressed down.

    ### Specifying a Target

    There are several possible target objects for `{{action}}` helpers:

    In a typical Ember application, where views are managed through use of the
    `{{outlet}}` helper, actions will bubble to the current controller, then
    to the current route, and then up the route hierarchy.

    Alternatively, a `target` option can be provided to the helper to change
    which object will receive the method call. This option must be a path
    path to an object, accessible in the current context:

    ```handlebars
    <script type="text/x-handlebars" data-template-name='a-template'>
      <div {{action anActionName target="MyApplication.someObject"}}>
        click me
      </div>
    </script>
    ```

    Clicking "click me" in the rendered HTML of the above template will trigger
    the  `anActionName` method of the object at `MyApplication.someObject`.

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
      anActionName: function(event) {}
    });

    aView = AView.create();
    aView.appendTo('body');
    ```

    Will throw `Uncaught TypeError: Cannot call method 'call' of undefined` when
    "click me" is clicked.

    ### Additional Parameters

    You may specify additional parameters to the `{{action}}` helper. These
    parameters are passed along as the arguments to the JavaScript function
    implementing the action.

    ```handlebars
    <script type="text/x-handlebars" data-template-name='a-template'>
      {{#each person in people}}
        <div {{action edit person}}>
          click me
        </div>
      {{/each}}
    </script>
    ```

    Clicking "click me" will trigger the `edit` method on the current view's
    controller with the current person as a parameter.

    @method action
    @for Ember.Handlebars.helpers
    @param {String} actionName
    @param {Object} [context]*
    @param {Hash} options
  */
  EmberHandlebars.registerHelper('action', function(actionName) {
    var options = arguments[arguments.length - 1],
        contexts = a_slice.call(arguments, 1, -1);

    var hash = options.hash,
        controller;

    // create a hash to pass along to registerAction
    var action = {
      eventName: hash.on || "click"
    };

    action.parameters = {
      context: this,
      options: options,
      params: contexts
    };

    action.view = options.data.view;

    var root, target;

    if (hash.target) {
      root = this;
      target = hash.target;
    } else if (controller = options.data.keywords.controller) {
      root = controller;
    }

    action.target = { root: root, target: target, options: options };
    action.bubbles = hash.bubbles;

    var actionId = ActionHelper.registerAction(actionName, action, hash.allowedKeys);
    return new SafeString('data-ember-action="' + actionId + '"');
  });

});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

if (Ember.ENV.EXPERIMENTAL_CONTROL_HELPER) {
  var get = Ember.get, set = Ember.set;

  /**
    The control helper is currently under development and is considered experimental.
    To enable it, set `ENV.EXPERIMENTAL_CONTROL_HELPER = true` before requiring Ember.

    @method control
    @for Ember.Handlebars.helpers
    @param {String} path
    @param {String} modelPath
    @param {Hash} options
    @return {String} HTML string
  */
  Ember.Handlebars.registerHelper('control', function(path, modelPath, options) {
    if (arguments.length === 2) {
      options = modelPath;
      modelPath = undefined;
    }

    var model;

    if (modelPath) {
      model = Ember.Handlebars.get(this, modelPath, options);
    }

    var controller = options.data.keywords.controller,
        view = options.data.keywords.view,
        children = get(controller, '_childContainers'),
        controlID = options.hash.controlID,
        container, subContainer;

    if (children.hasOwnProperty(controlID)) {
      subContainer = children[controlID];
    } else {
      container = get(controller, 'container'),
      subContainer = container.child();
      children[controlID] = subContainer;
    }

    var normalizedPath = path.replace(/\//g, '.');

    var childView = subContainer.lookup('view:' + normalizedPath) || subContainer.lookup('view:default'),
        childController = subContainer.lookup('controller:' + normalizedPath),
        childTemplate = subContainer.lookup('template:' + path);

    Ember.assert("Could not find controller for path: " + normalizedPath, childController);
    Ember.assert("Could not find view for path: " + normalizedPath, childView);

    set(childController, 'target', controller);
    set(childController, 'model', model);

    options.hash.template = childTemplate;
    options.hash.controller = childController;

    function observer() {
      var model = Ember.Handlebars.get(this, modelPath, options);
      set(childController, 'model', model);
      childView.rerender();
    }

    Ember.addObserver(this, modelPath, observer);
    childView.one('willDestroyElement', this, function() {
      Ember.removeObserver(this, modelPath, observer);
    });

    Ember.Handlebars.helpers.view.call(this, childView, options);
  });
}

})();



(function() {

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;

Ember.ControllerMixin.reopen({
  transitionToRoute: function() {
    // target may be either another controller or a router
    var target = get(this, 'target'),
        method = target.transitionToRoute || target.transitionTo;
    return method.apply(target, arguments);
  },

  transitionTo: function() {
    Ember.deprecate("transitionTo is deprecated. Please use transitionToRoute.");
    return this.transitionToRoute.apply(this, arguments);
  },

  replaceRoute: function() {
    // target may be either another controller or a router
    var target = get(this, 'target'),
        method = target.replaceRoute || target.replaceWith;
    return method.apply(target, arguments);
  },

  replaceWith: function() {
    Ember.deprecate("replaceWith is deprecated. Please use replaceRoute.");
    return this.replaceRoute.apply(this, arguments);
  }
});

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;

Ember.View.reopen({
  init: function() {
    set(this, '_outlets', {});
    this._super();
  },

  connectOutlet: function(outletName, view) {
    var outlets = get(this, '_outlets'),
        container = get(this, 'container'),
        router = container && container.lookup('router:main'),
        renderedName = get(view, 'renderedName');

    set(outlets, outletName, view);

    if (router && renderedName) {
      router._connectActiveView(renderedName, view);
    }
  },

  disconnectOutlet: function(outletName) {
    var outlets = get(this, '_outlets');

    set(outlets, outletName, null);
  }
});

})();



(function() {

})();



(function() {
/**
@module ember
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;

/*
  This file implements the `location` API used by Ember's router.

  That API is:

  getURL: returns the current URL
  setURL(path): sets the current URL
  replaceURL(path): replace the current URL (optional)
  onUpdateURL(callback): triggers the callback when the URL changes
  formatURL(url): formats `url` to be placed into `href` attribute

  Calling setURL or replaceURL will not trigger onUpdateURL callbacks.

  TODO: This should perhaps be moved so that it's visible in the doc output.
*/

/**
  Ember.Location returns an instance of the correct implementation of
  the `location` API.

  You can pass it a `implementation` ('hash', 'history', 'none') to force a
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
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;

/**
  Ember.NoneLocation does not interact with the browser. It is useful for
  testing, or when you need to manage state with your Router, but temporarily
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
    this.updateCallback = callback;
  },

  handleURL: function(url) {
    set(this, 'path', url);
    this.updateCallback(url);
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
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;

/**
  Ember.HashLocation implements the location API using the browser's
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
      Ember.run(function() {
        var path = location.hash.substr(1);
        if (get(self, 'lastSetURL') === path) { return; }

        set(self, 'lastSetURL', null);

        callback(path);
      });
    });
  },

  /**
    @private

    Given a URL, formats it to be placed into the page as part
    of an element's `href` attribute.

    This is used, for example, when using the {{action}} helper
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
@submodule ember-routing
*/

var get = Ember.get, set = Ember.set;
var popstateFired = false;

/**
  Ember.HistoryLocation implements the location API using the browser's
  history.pushState API.

  @class HistoryLocation
  @namespace Ember
  @extends Ember.Object
*/
Ember.HistoryLocation = Ember.Object.extend({

  init: function() {
    set(this, 'location', get(this, 'location') || window.location);
    this._initialUrl = this.getURL();
    this.initState();
  },

  /**
    @private

    Used to set state on first call to setURL

    @method initState
  */
  initState: function() {
    this.replaceState(this.formatURL(this.getURL()));
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

    Returns the current `location.pathname` without rootURL

    @method getURL
  */
  getURL: function() {
    var rootURL = get(this, 'rootURL'),
        url = get(this, 'location').pathname;

    rootURL = rootURL.replace(/\/$/, '');
    url = url.replace(rootURL, '');

    return url;
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
      this.pushState(path);
    }
  },

  /**
    @private

    Uses `history.replaceState` to update the url without a page reload
    or history modification.

    @method replaceURL
    @param path {String}
  */
  replaceURL: function(path) {
    path = this.formatURL(path);

    if (this.getState() && this.getState().path !== path) {
      this.replaceState(path);
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
    var guid = Ember.guidFor(this),
        self = this;

    Ember.$(window).bind('popstate.ember-location-'+guid, function(e) {
      // Ignore initial page load popstate event in Chrome
      if(!popstateFired) {
        popstateFired = true;
        if (self.getURL() === self._initialUrl) { return; }
      }
      callback(self.getURL());
    });
  },

  /**
    @private

    Used when using `{{action}}` helper.  The url is always appended to the rootURL.

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
/**
Ember Routing

@module ember
@submodule ember-routing
@requires ember-states
@requires ember-views
*/

})();

