;(function() {
/*!
 * @overview  Ember - JavaScript Application Framework
 * @copyright Copyright 2011-2016 Tilde Inc. and contributors
 *            Portions Copyright 2006-2011 Strobe Inc.
 *            Portions Copyright 2008-2011 Apple Inc. All rights reserved.
 * @license   Licensed under MIT license
 *            See https://raw.github.com/emberjs/ember.js/master/LICENSE
 * @version   2.10.2-with-backtracking
 */

var enifed, requireModule, Ember;
var mainContext = this;

(function() {
  var isNode = typeof window === 'undefined' &&
    typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

  if (!isNode) {
    Ember = this.Ember = this.Ember || {};
  }

  if (typeof Ember === 'undefined') { Ember = {}; }

  if (typeof Ember.__loader === 'undefined') {
    var registry = {};
    var seen = {};

    enifed = function(name, deps, callback) {
      var value = { };

      if (!callback) {
        value.deps = [];
        value.callback = deps;
      } else {
        value.deps = deps;
        value.callback = callback;
      }

      registry[name] = value;
    };

    requireModule = function(name) {
      return internalRequire(name, null);
    };

    // setup `require` module
    requireModule['default'] = requireModule;

    requireModule.has = function registryHas(moduleName) {
      return !!registry[moduleName] || !!registry[moduleName + '/index'];
    };

    function missingModule(name, referrerName) {
      if (referrerName) {
        throw new Error('Could not find module ' + name + ' required by: ' + referrerName);
      } else {
        throw new Error('Could not find module ' + name);
      }
    }

    function internalRequire(_name, referrerName) {
      var name = _name;
      var mod = registry[name];

      if (!mod) {
        name = name + '/index';
        mod = registry[name];
      }

      var exports = seen[name];

      if (exports !== undefined) {
        return exports;
      }

      exports = seen[name] = {};

      if (!mod) {
        missingModule(_name, referrerName);
      }

      var deps = mod.deps;
      var callback = mod.callback;
      var reified = new Array(deps.length);

      for (var i = 0; i < deps.length; i++) {
        if (deps[i] === 'exports') {
          reified[i] = exports;
        } else if (deps[i] === 'require') {
          reified[i] = requireModule;
        } else {
          reified[i] = internalRequire(deps[i], name);
        }
      }

      callback.apply(this, reified);

      return exports;
    }

    requireModule._eak_seen = registry;

    Ember.__loader = {
      define: enifed,
      require: requireModule,
      registry: registry
    };
  } else {
    enifed = Ember.__loader.define;
    requireModule = Ember.__loader.require;
  }
})();

var babelHelpers;

function inherits(subClass, superClass) {
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });

  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : defaults(subClass, superClass);
}

function taggedTemplateLiteralLoose(strings, raw) {
  strings.raw = raw;
  return strings;
}

function defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ('value' in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function createClass(Constructor, protoProps, staticProps) {
  if (protoProps) defineProperties(Constructor.prototype, protoProps);
  if (staticProps) defineProperties(Constructor, staticProps);
  return Constructor;
}

function interopExportWildcard(obj, defaults) {
  var newObj = defaults({}, obj);
  delete newObj['default'];
  return newObj;
}

function defaults(obj, defaults) {
  var keys = Object.getOwnPropertyNames(defaults);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = Object.getOwnPropertyDescriptor(defaults, key);
    if (value && value.configurable && obj[key] === undefined) {
      Object.defineProperty(obj, key, value);
    }
  }
  return obj;
}

babelHelpers = {
  inherits: inherits,
  taggedTemplateLiteralLoose: taggedTemplateLiteralLoose,
  slice: Array.prototype.slice,
  createClass: createClass,
  interopExportWildcard: interopExportWildcard,
  defaults: defaults
};

enifed('backburner', ['exports'], function (exports) { 'use strict';

var NUMBER = /\d+/;

function each(collection, callback) {
  for (var i = 0; i < collection.length; i++) {
    callback(collection[i]);
  }
}

function isString(suspect) {
  return typeof suspect === 'string';
}

function isFunction(suspect) {
  return typeof suspect === 'function';
}

function isNumber(suspect) {
  return typeof suspect === 'number';
}

function isCoercableNumber(number) {
  return isNumber(number) || NUMBER.test(number);
}

function binarySearch(time, timers) {
  var start = 0;
  var end = timers.length - 2;
  var middle, l;

  while (start < end) {
    // since timers is an array of pairs 'l' will always
    // be an integer
    l = (end - start) / 2;

    // compensate for the index in case even number
    // of pairs inside timers
    middle = start + l - (l % 2);

    if (time >= timers[middle]) {
      start = middle + 2;
    } else {
      end = middle;
    }
  }

  return (time >= timers[start]) ? start + 2 : start;
}

function Queue(name, options, globalOptions) {
  this.name = name;
  this.globalOptions = globalOptions || {};
  this.options = options;
  this._queue = [];
  this.targetQueues = {};
  this._queueBeingFlushed = undefined;
}

Queue.prototype = {
  push: function(target, method, args, stack) {
    var queue = this._queue;
    queue.push(target, method, args, stack);

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  pushUniqueWithoutGuid: function(target, method, args, stack) {
    var queue = this._queue;

    for (var i = 0, l = queue.length; i < l; i += 4) {
      var currentTarget = queue[i];
      var currentMethod = queue[i+1];

      if (currentTarget === target && currentMethod === method) {
        queue[i+2] = args;  // replace args
        queue[i+3] = stack; // replace stack
        return;
      }
    }

    queue.push(target, method, args, stack);
  },

  targetQueue: function(targetQueue, target, method, args, stack) {
    var queue = this._queue;

    for (var i = 0, l = targetQueue.length; i < l; i += 2) {
      var currentMethod = targetQueue[i];
      var currentIndex  = targetQueue[i + 1];

      if (currentMethod === method) {
        queue[currentIndex + 2] = args;  // replace args
        queue[currentIndex + 3] = stack; // replace stack
        return;
      }
    }

    targetQueue.push(
      method,
      queue.push(target, method, args, stack) - 4
    );
  },

  pushUniqueWithGuid: function(guid, target, method, args, stack) {
    var hasLocalQueue = this.targetQueues[guid];

    if (hasLocalQueue) {
      this.targetQueue(hasLocalQueue, target, method, args, stack);
    } else {
      this.targetQueues[guid] = [
        method,
        this._queue.push(target, method, args, stack) - 4
      ];
    }

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  pushUnique: function(target, method, args, stack) {
    var KEY = this.globalOptions.GUID_KEY;

    if (target && KEY) {
      var guid = target[KEY];
      if (guid) {
        return this.pushUniqueWithGuid(guid, target, method, args, stack);
      }
    }

    this.pushUniqueWithoutGuid(target, method, args, stack);

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  invoke: function(target, method, args /*, onError, errorRecordedForStack */) {
    if (args && args.length > 0) {
      method.apply(target, args);
    } else {
      method.call(target);
    }
  },

  invokeWithOnError: function(target, method, args, onError, errorRecordedForStack) {
    try {
      if (args && args.length > 0) {
        method.apply(target, args);
      } else {
        method.call(target);
      }
    } catch(error) {
      onError(error, errorRecordedForStack);
    }
  },

  flush: function(sync) {
    var queue = this._queue;
    var length = queue.length;

    if (length === 0) {
      return;
    }

    var globalOptions = this.globalOptions;
    var options = this.options;
    var before = options && options.before;
    var after = options && options.after;
    var onError = globalOptions.onError || (globalOptions.onErrorTarget &&
                                            globalOptions.onErrorTarget[globalOptions.onErrorMethod]);
    var target, method, args, errorRecordedForStack;
    var invoke = onError ? this.invokeWithOnError : this.invoke;

    this.targetQueues = Object.create(null);
    var queueItems = this._queueBeingFlushed = this._queue.slice();
    this._queue = [];

    if (before) {
      before();
    }

    for (var i = 0; i < length; i += 4) {
      target                = queueItems[i];
      method                = queueItems[i+1];
      args                  = queueItems[i+2];
      errorRecordedForStack = queueItems[i+3]; // Debugging assistance

      if (isString(method)) {
        method = target[method];
      }

      // method could have been nullified / canceled during flush
      if (method) {
        //
        //    ** Attention intrepid developer **
        //
        //    To find out the stack of this task when it was scheduled onto
        //    the run loop, add the following to your app.js:
        //
        //    Ember.run.backburner.DEBUG = true; // NOTE: This slows your app, don't leave it on in production.
        //
        //    Once that is in place, when you are at a breakpoint and navigate
        //    here in the stack explorer, you can look at `errorRecordedForStack.stack`,
        //    which will be the captured stack when this job was scheduled.
        //
        //    One possible long-term solution is the following Chrome issue:
        //       https://bugs.chromium.org/p/chromium/issues/detail?id=332624
        //
        invoke(target, method, args, onError, errorRecordedForStack);
      }
    }

    if (after) {
      after();
    }

    this._queueBeingFlushed = undefined;

    if (sync !== false &&
        this._queue.length > 0) {
      // check if new items have been added
      this.flush(true);
    }
  },

  cancel: function(actionToCancel) {
    var queue = this._queue, currentTarget, currentMethod, i, l;
    var target = actionToCancel.target;
    var method = actionToCancel.method;
    var GUID_KEY = this.globalOptions.GUID_KEY;

    if (GUID_KEY && this.targetQueues && target) {
      var targetQueue = this.targetQueues[target[GUID_KEY]];

      if (targetQueue) {
        for (i = 0, l = targetQueue.length; i < l; i++) {
          if (targetQueue[i] === method) {
            targetQueue.splice(i, 1);
          }
        }
      }
    }

    for (i = 0, l = queue.length; i < l; i += 4) {
      currentTarget = queue[i];
      currentMethod = queue[i+1];

      if (currentTarget === target &&
          currentMethod === method) {
        queue.splice(i, 4);
        return true;
      }
    }

    // if not found in current queue
    // could be in the queue that is being flushed
    queue = this._queueBeingFlushed;

    if (!queue) {
      return;
    }

    for (i = 0, l = queue.length; i < l; i += 4) {
      currentTarget = queue[i];
      currentMethod = queue[i+1];

      if (currentTarget === target &&
          currentMethod === method) {
        // don't mess with array during flush
        // just nullify the method
        queue[i+1] = null;
        return true;
      }
    }
  }
};

function DeferredActionQueues(queueNames, options) {
  var queues = this.queues = {};
  this.queueNames = queueNames = queueNames || [];

  this.options = options;

  each(queueNames, function(queueName) {
    queues[queueName] = new Queue(queueName, options[queueName], options);
  });
}

function noSuchQueue(name) {
  throw new Error('You attempted to schedule an action in a queue (' + name + ') that doesn\'t exist');
}

function noSuchMethod(name) {
  throw new Error('You attempted to schedule an action in a queue (' + name + ') for a method that doesn\'t exist');
}

DeferredActionQueues.prototype = {
  schedule: function(name, target, method, args, onceFlag, stack) {
    var queues = this.queues;
    var queue = queues[name];

    if (!queue) {
      noSuchQueue(name);
    }

    if (!method) {
      noSuchMethod(name);
    }

    if (onceFlag) {
      return queue.pushUnique(target, method, args, stack);
    } else {
      return queue.push(target, method, args, stack);
    }
  },

  flush: function() {
    var queues = this.queues;
    var queueNames = this.queueNames;
    var queueName, queue;
    var queueNameIndex = 0;
    var numberOfQueues = queueNames.length;

    while (queueNameIndex < numberOfQueues) {
      queueName = queueNames[queueNameIndex];
      queue = queues[queueName];

      var numberOfQueueItems = queue._queue.length;

      if (numberOfQueueItems === 0) {
        queueNameIndex++;
      } else {
        queue.flush(false /* async */);
        queueNameIndex = 0;
      }
    }
  }
};

function Backburner(queueNames, options) {
  this.queueNames = queueNames;
  this.options = options || {};
  if (!this.options.defaultQueue) {
    this.options.defaultQueue = queueNames[0];
  }
  this.instanceStack = [];
  this._debouncees = [];
  this._throttlers = [];
  this._eventCallbacks = {
    end: [],
    begin: []
  };

  var _this = this;
  this._boundClearItems = function() {
    clearItems();
  };

  this._timerTimeoutId = undefined;
  this._timers = [];

  this._platform = this.options._platform || {
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      clearTimeout(id);
    }
  };

  this._boundRunExpiredTimers = function () {
    _this._runExpiredTimers();
  };
}

Backburner.prototype = {
  begin: function() {
    var options = this.options;
    var onBegin = options && options.onBegin;
    var previousInstance = this.currentInstance;

    if (previousInstance) {
      this.instanceStack.push(previousInstance);
    }

    this.currentInstance = new DeferredActionQueues(this.queueNames, options);
    this._trigger('begin', this.currentInstance, previousInstance);
    if (onBegin) {
      onBegin(this.currentInstance, previousInstance);
    }
  },

  end: function() {
    var options = this.options;
    var onEnd = options && options.onEnd;
    var currentInstance = this.currentInstance;
    var nextInstance = null;

    // Prevent double-finally bug in Safari 6.0.2 and iOS 6
    // This bug appears to be resolved in Safari 6.0.5 and iOS 7
    var finallyAlreadyCalled = false;
    try {
      currentInstance.flush();
    } finally {
      if (!finallyAlreadyCalled) {
        finallyAlreadyCalled = true;

        this.currentInstance = null;

        if (this.instanceStack.length) {
          nextInstance = this.instanceStack.pop();
          this.currentInstance = nextInstance;
        }
        this._trigger('end', currentInstance, nextInstance);
        if (onEnd) {
          onEnd(currentInstance, nextInstance);
        }
      }
    }
  },

  /**
   Trigger an event. Supports up to two arguments. Designed around
   triggering transition events from one run loop instance to the
   next, which requires an argument for the first instance and then
   an argument for the next instance.

   @private
   @method _trigger
   @param {String} eventName
   @param {any} arg1
   @param {any} arg2
   */
  _trigger: function(eventName, arg1, arg2) {
    var callbacks = this._eventCallbacks[eventName];
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i](arg1, arg2);
      }
    }
  },

  on: function(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    var callbacks = this._eventCallbacks[eventName];
    if (callbacks) {
      callbacks.push(callback);
    } else {
      throw new TypeError('Cannot on() event "' + eventName + '" because it does not exist');
    }
  },

  off: function(eventName, callback) {
    if (eventName) {
      var callbacks = this._eventCallbacks[eventName];
      var callbackFound = false;
      if (!callbacks) return;
      if (callback) {
        for (var i = 0; i < callbacks.length; i++) {
          if (callbacks[i] === callback) {
            callbackFound = true;
            callbacks.splice(i, 1);
            i--;
          }
        }
      }
      if (!callbackFound) {
        throw new TypeError('Cannot off() callback that does not exist');
      }
    } else {
      throw new TypeError('Cannot off() event "' + eventName + '" because it does not exist');
    }
  },

  run: function(/* target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 1) {
      method = arguments[0];
      target = null;
    } else {
      target = arguments[0];
      method = arguments[1];
    }

    if (isString(method)) {
      method = target[method];
    }

    if (length > 2) {
      args = new Array(length - 2);
      for (var i = 0, l = length - 2; i < l; i++) {
        args[i] = arguments[i + 2];
      }
    } else {
      args = [];
    }

    var onError = getOnError(this.options);

    this.begin();

    // guard against Safari 6's double-finally bug
    var didFinally = false;

    if (onError) {
      try {
        return method.apply(target, args);
      } catch(error) {
        onError(error);
      } finally {
        if (!didFinally) {
          didFinally = true;
          this.end();
        }
      }
    } else {
      try {
        return method.apply(target, args);
      } finally {
        if (!didFinally) {
          didFinally = true;
          this.end();
        }
      }
    }
  },

  /*
    Join the passed method with an existing queue and execute immediately,
    if there isn't one use `Backburner#run`.

    The join method is like the run method except that it will schedule into
    an existing queue if one already exists. In either case, the join method will
    immediately execute the passed in function and return its result.

    @method join
    @param {Object} target
    @param {Function} method The method to be executed
    @param {any} args The method arguments
    @return method result
  */
  join: function(/* target, method, args */) {
    if (!this.currentInstance) {
      return this.run.apply(this, arguments);
    }

    var length = arguments.length;
    var method, target;

    if (length === 1) {
      method = arguments[0];
      target = null;
    } else {
      target = arguments[0];
      method = arguments[1];
    }

    if (isString(method)) {
      method = target[method];
    }

    if (length === 1) {
      return method();
    } else if (length === 2) {
      return method.call(target);
    } else {
      var args = new Array(length - 2);
      for (var i = 0, l = length - 2; i < l; i++) {
        args[i] = arguments[i + 2];
      }
      return method.apply(target, args);
    }
  },


  /*
    Defer the passed function to run inside the specified queue.

    @method defer
    @param {String} queueName
    @param {Object} target
    @param {Function|String} method The method or method name to be executed
    @param {any} args The method arguments
    @return method result
  */
  defer: function(queueName /* , target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 2) {
      method = arguments[1];
      target = null;
    } else {
      target = arguments[1];
      method = arguments[2];
    }

    if (isString(method)) {
      method = target[method];
    }

    var stack = this.DEBUG ? new Error() : undefined;

    if (length > 3) {
      args = new Array(length - 3);
      for (var i = 3; i < length; i++) {
        args[i-3] = arguments[i];
      }
    } else {
      args = undefined;
    }

    if (!this.currentInstance) { createAutorun(this); }
    return this.currentInstance.schedule(queueName, target, method, args, false, stack);
  },

  deferOnce: function(queueName /* , target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 2) {
      method = arguments[1];
      target = null;
    } else {
      target = arguments[1];
      method = arguments[2];
    }

    if (isString(method)) {
      method = target[method];
    }

    var stack = this.DEBUG ? new Error() : undefined;

    if (length > 3) {
      args = new Array(length - 3);
      for (var i = 3; i < length; i++) {
        args[i-3] = arguments[i];
      }
    } else {
      args = undefined;
    }

    if (!this.currentInstance) {
      createAutorun(this);
    }
    return this.currentInstance.schedule(queueName, target, method, args, true, stack);
  },

  setTimeout: function() {
    var l = arguments.length;
    var args = new Array(l);

    for (var x = 0; x < l; x++) {
      args[x] = arguments[x];
    }

    var length = args.length,
        method, wait, target,
        methodOrTarget, methodOrWait, methodOrArgs;

    if (length === 0) {
      return;
    } else if (length === 1) {
      method = args.shift();
      wait = 0;
    } else if (length === 2) {
      methodOrTarget = args[0];
      methodOrWait = args[1];

      if (isFunction(methodOrWait) || isFunction(methodOrTarget[methodOrWait])) {
        target = args.shift();
        method = args.shift();
        wait = 0;
      } else if (isCoercableNumber(methodOrWait)) {
        method = args.shift();
        wait = args.shift();
      } else {
        method = args.shift();
        wait =  0;
      }
    } else {
      var last = args[args.length - 1];

      if (isCoercableNumber(last)) {
        wait = args.pop();
      } else {
        wait = 0;
      }

      methodOrTarget = args[0];
      methodOrArgs = args[1];

      if (isFunction(methodOrArgs) || (isString(methodOrArgs) &&
                                      methodOrTarget !== null &&
                                      methodOrArgs in methodOrTarget)) {
        target = args.shift();
        method = args.shift();
      } else {
        method = args.shift();
      }
    }

    var executeAt = Date.now() + parseInt(wait !== wait ? 0 : wait, 10);

    if (isString(method)) {
      method = target[method];
    }

    var onError = getOnError(this.options);

    function fn() {
      if (onError) {
        try {
          method.apply(target, args);
        } catch (e) {
          onError(e);
        }
      } else {
        method.apply(target, args);
      }
    }

    return this._setTimeout(fn, executeAt);
  },

  _setTimeout: function (fn, executeAt) {
    if (this._timers.length === 0) {
      this._timers.push(executeAt, fn);
      this._installTimerTimeout();
      return fn;
    }

    // find position to insert
    var i = binarySearch(executeAt, this._timers);

    this._timers.splice(i, 0, executeAt, fn);

    // we should be the new earliest timer if i == 0
    if (i === 0) {
      this._reinstallTimerTimeout();
    }

    return fn;
  },

  throttle: function(target, method /* , args, wait, [immediate] */) {
    var backburner = this;
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    var immediate = args.pop();
    var wait, throttler, index, timer;

    if (isNumber(immediate) || isString(immediate)) {
      wait = immediate;
      immediate = true;
    } else {
      wait = args.pop();
    }

    wait = parseInt(wait, 10);

    index = findThrottler(target, method, this._throttlers);
    if (index > -1) { return this._throttlers[index]; } // throttled

    timer = this._platform.setTimeout(function() {
      if (!immediate) {
        backburner.run.apply(backburner, args);
      }
      var index = findThrottler(target, method, backburner._throttlers);
      if (index > -1) {
        backburner._throttlers.splice(index, 1);
      }
    }, wait);

    if (immediate) {
      this.run.apply(this, args);
    }

    throttler = [target, method, timer];

    this._throttlers.push(throttler);

    return throttler;
  },

  debounce: function(target, method /* , args, wait, [immediate] */) {
    var backburner = this;
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    var immediate = args.pop();
    var wait, index, debouncee, timer;

    if (isNumber(immediate) || isString(immediate)) {
      wait = immediate;
      immediate = false;
    } else {
      wait = args.pop();
    }

    wait = parseInt(wait, 10);
    // Remove debouncee
    index = findDebouncee(target, method, this._debouncees);

    if (index > -1) {
      debouncee = this._debouncees[index];
      this._debouncees.splice(index, 1);
      this._platform.clearTimeout(debouncee[2]);
    }

    timer = this._platform.setTimeout(function() {
      if (!immediate) {
        backburner.run.apply(backburner, args);
      }
      var index = findDebouncee(target, method, backburner._debouncees);
      if (index > -1) {
        backburner._debouncees.splice(index, 1);
      }
    }, wait);

    if (immediate && index === -1) {
      backburner.run.apply(backburner, args);
    }

    debouncee = [
      target,
      method,
      timer
    ];

    backburner._debouncees.push(debouncee);

    return debouncee;
  },

  cancelTimers: function() {
    each(this._throttlers, this._boundClearItems);
    this._throttlers = [];

    each(this._debouncees, this._boundClearItems);
    this._debouncees = [];

    this._clearTimerTimeout();
    this._timers = [];

    if (this._autorun) {
      this._platform.clearTimeout(this._autorun);
      this._autorun = null;
    }
  },

  hasTimers: function() {
    return !!this._timers.length || !!this._debouncees.length || !!this._throttlers.length || this._autorun;
  },

  cancel: function (timer) {
    var timerType = typeof timer;

    if (timer && timerType === 'object' && timer.queue && timer.method) { // we're cancelling a deferOnce
      return timer.queue.cancel(timer);
    } else if (timerType === 'function') { // we're cancelling a setTimeout
      for (var i = 0, l = this._timers.length; i < l; i += 2) {
        if (this._timers[i + 1] === timer) {
          this._timers.splice(i, 2); // remove the two elements
          if (i === 0) {
            this._reinstallTimerTimeout();
          }
          return true;
        }
      }
    } else if (Object.prototype.toString.call(timer) === '[object Array]'){ // we're cancelling a throttle or debounce
      return this._cancelItem(findThrottler, this._throttlers, timer) ||
               this._cancelItem(findDebouncee, this._debouncees, timer);
    } else {
      return; // timer was null or not a timer
    }
  },

  _cancelItem: function(findMethod, array, timer){
    var item, index;

    if (timer.length < 3) { return false; }

    index = findMethod(timer[0], timer[1], array);

    if (index > -1) {

      item = array[index];

      if (item[2] === timer[2]) {
        array.splice(index, 1);
        this._platform.clearTimeout(timer[2]);
        return true;
      }
    }

    return false;
  },

  _runExpiredTimers: function () {
    this._timerTimeoutId = undefined;
    this.run(this, this._scheduleExpiredTimers);
  },

  _scheduleExpiredTimers: function () {
    var n = Date.now();
    var timers = this._timers;
    var i = 0;
    var l = timers.length;
    for (; i < l; i += 2) {
      var executeAt = timers[i];
      var fn = timers[i+1];
      if (executeAt <= n) {
        this.schedule(this.options.defaultQueue, null, fn);
      } else {
        break;
      }
    }
    timers.splice(0, i);
    this._installTimerTimeout();
  },

  _reinstallTimerTimeout: function () {
    this._clearTimerTimeout();
    this._installTimerTimeout();
  },

  _clearTimerTimeout: function () {
    if (!this._timerTimeoutId) {
      return;
    }
    this._platform.clearTimeout(this._timerTimeoutId);
    this._timerTimeoutId = undefined;
  },

  _installTimerTimeout: function () {
    if (!this._timers.length) {
      return;
    }
    var minExpiresAt = this._timers[0];
    var n = Date.now();
    var wait = Math.max(0, minExpiresAt - n);
    this._timerTimeoutId = this._platform.setTimeout(this._boundRunExpiredTimers, wait);
  }
};

Backburner.prototype.schedule = Backburner.prototype.defer;
Backburner.prototype.scheduleOnce = Backburner.prototype.deferOnce;
Backburner.prototype.later = Backburner.prototype.setTimeout;

function getOnError(options) {
  return options.onError || (options.onErrorTarget && options.onErrorTarget[options.onErrorMethod]);
}

function createAutorun(backburner) {
  var setTimeout = backburner._platform.setTimeout;
  backburner.begin();
  backburner._autorun = setTimeout(function() {
    backburner._autorun = null;
    backburner.end();
  }, 0);
}

function findDebouncee(target, method, debouncees) {
  return findItem(target, method, debouncees);
}

function findThrottler(target, method, throttlers) {
  return findItem(target, method, throttlers);
}

function findItem(target, method, collection) {
  var item;
  var index = -1;

  for (var i = 0, l = collection.length; i < l; i++) {
    item = collection[i];
    if (item[0] === target && item[1] === method) {
      index = i;
      break;
    }
  }

  return index;
}

function clearItems(item) {
  this._platform.clearTimeout(item[2]);
}

exports['default'] = Backburner;

Object.defineProperty(exports, '__esModule', { value: true });

});
enifed('container/container', ['exports', 'ember-utils', 'ember-environment', 'ember-metal'], function (exports, _emberUtils, _emberEnvironment, _emberMetal) {
  'use strict';

  exports.default = Container;
  exports.buildFakeContainerWithDeprecations = buildFakeContainerWithDeprecations;

  var CONTAINER_OVERRIDE = _emberUtils.symbol('CONTAINER_OVERRIDE');

  /**
   A container used to instantiate and cache objects.
  
   Every `Container` must be associated with a `Registry`, which is referenced
   to determine the factory and options that should be used to instantiate
   objects.
  
   The public API for `Container` is still in flux and should not be considered
   stable.
  
   @private
   @class Container
   */

  function Container(registry, options) {
    this.registry = registry;
    this.owner = options && options.owner ? options.owner : null;
    this.cache = _emberUtils.dictionary(options && options.cache ? options.cache : null);
    this.factoryCache = _emberUtils.dictionary(options && options.factoryCache ? options.factoryCache : null);
    this.validationCache = _emberUtils.dictionary(options && options.validationCache ? options.validationCache : null);
    this._fakeContainerToInject = buildFakeContainerWithDeprecations(this);
    this[CONTAINER_OVERRIDE] = undefined;
    this.isDestroyed = false;
  }

  Container.prototype = {
    /**
     @private
     @property owner
     @type Object
     */
    owner: null,

    /**
     @private
     @property registry
     @type Registry
     @since 1.11.0
     */
    registry: null,

    /**
     @private
     @property cache
     @type InheritingDict
     */
    cache: null,

    /**
     @private
     @property factoryCache
     @type InheritingDict
     */
    factoryCache: null,

    /**
     @private
     @property validationCache
     @type InheritingDict
     */
    validationCache: null,

    /**
     Given a fullName return a corresponding instance.
      The default behaviour is for lookup to return a singleton instance.
     The singleton is scoped to the container, allowing multiple containers
     to all have their own locally scoped singletons.
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('api:twitter', Twitter);
      let twitter = container.lookup('api:twitter');
      twitter instanceof Twitter; // => true
      // by default the container will return singletons
     let twitter2 = container.lookup('api:twitter');
     twitter2 instanceof Twitter; // => true
      twitter === twitter2; //=> true
     ```
      If singletons are not wanted, an optional flag can be provided at lookup.
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('api:twitter', Twitter);
      let twitter = container.lookup('api:twitter', { singleton: false });
     let twitter2 = container.lookup('api:twitter', { singleton: false });
      twitter === twitter2; //=> false
     ```
      @private
     @method lookup
     @param {String} fullName
     @param {Object} [options]
     @param {String} [options.source] The fullname of the request source (used for local lookup)
     @return {any}
     */
    lookup: function (fullName, options) {
      _emberMetal.assert('fullName must be a proper full name', this.registry.validateFullName(fullName));
      return lookup(this, this.registry.normalize(fullName), options);
    },

    /**
     Given a fullName, return the corresponding factory.
      @private
     @method lookupFactory
     @param {String} fullName
     @param {Object} [options]
     @param {String} [options.source] The fullname of the request source (used for local lookup)
     @return {any}
     */
    lookupFactory: function (fullName, options) {
      _emberMetal.assert('fullName must be a proper full name', this.registry.validateFullName(fullName));
      return factoryFor(this, this.registry.normalize(fullName), options);
    },

    /**
     A depth first traversal, destroying the container, its descendant containers and all
     their managed objects.
      @private
     @method destroy
     */
    destroy: function () {
      eachDestroyable(this, function (item) {
        if (item.destroy) {
          item.destroy();
        }
      });

      this.isDestroyed = true;
    },

    /**
     Clear either the entire cache or just the cache for a particular key.
      @private
     @method reset
     @param {String} fullName optional key to reset; if missing, resets everything
     */
    reset: function (fullName) {
      if (arguments.length > 0) {
        resetMember(this, this.registry.normalize(fullName));
      } else {
        resetCache(this);
      }
    },

    /**
     Returns an object that can be used to provide an owner to a
     manually created instance.
      @private
     @method ownerInjection
     @returns { Object }
    */
    ownerInjection: function () {
      var _ref;

      return _ref = {}, _ref[_emberUtils.OWNER] = this.owner, _ref;
    }
  };

  function isSingleton(container, fullName) {
    return container.registry.getOption(fullName, 'singleton') !== false;
  }

  function lookup(container, fullName) {
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    if (options.source) {
      fullName = container.registry.expandLocalLookup(fullName, options);

      // if expandLocalLookup returns falsey, we do not support local lookup
      if (!fullName) {
        return;
      }
    }

    if (container.cache[fullName] !== undefined && options.singleton !== false) {
      return container.cache[fullName];
    }

    var value = instantiate(container, fullName);

    if (value === undefined) {
      return;
    }

    if (isSingleton(container, fullName) && options.singleton !== false) {
      container.cache[fullName] = value;
    }

    return value;
  }

  function markInjectionsAsDynamic(injections) {
    injections._dynamic = true;
  }

  function areInjectionsDynamic(injections) {
    return !!injections._dynamic;
  }

  function buildInjections() /* container, ...injections */{
    var hash = {};

    if (arguments.length > 1) {
      var container = arguments[0];
      var injections = [];
      var injection = undefined;

      for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
          injections = injections.concat(arguments[i]);
        }
      }

      container.registry.validateInjections(injections);

      for (var i = 0; i < injections.length; i++) {
        injection = injections[i];
        hash[injection.property] = lookup(container, injection.fullName);
        if (!isSingleton(container, injection.fullName)) {
          markInjectionsAsDynamic(hash);
        }
      }
    }

    return hash;
  }

  function factoryFor(container, fullName) {
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    var registry = container.registry;

    if (options.source) {
      fullName = registry.expandLocalLookup(fullName, options);

      // if expandLocalLookup returns falsey, we do not support local lookup
      if (!fullName) {
        return;
      }
    }

    var cache = container.factoryCache;
    if (cache[fullName]) {
      return cache[fullName];
    }
    var factory = registry.resolve(fullName);
    if (factory === undefined) {
      return;
    }

    var type = fullName.split(':')[0];
    if (!factory || typeof factory.extend !== 'function' || !_emberEnvironment.ENV.MODEL_FACTORY_INJECTIONS && type === 'model') {
      if (factory && typeof factory._onLookup === 'function') {
        factory._onLookup(fullName);
      }

      // TODO: think about a 'safe' merge style extension
      // for now just fallback to create time injection
      cache[fullName] = factory;
      return factory;
    } else {
      var injections = injectionsFor(container, fullName);
      var factoryInjections = factoryInjectionsFor(container, fullName);
      var cacheable = !areInjectionsDynamic(injections) && !areInjectionsDynamic(factoryInjections);

      factoryInjections._toString = registry.makeToString(factory, fullName);

      var injectedFactory = factory.extend(injections);

      // TODO - remove all `container` injections when Ember reaches v3.0.0
      injectDeprecatedContainer(injectedFactory.prototype, container);
      injectedFactory.reopenClass(factoryInjections);

      if (factory && typeof factory._onLookup === 'function') {
        factory._onLookup(fullName);
      }

      if (cacheable) {
        cache[fullName] = injectedFactory;
      }

      return injectedFactory;
    }
  }

  function injectionsFor(container, fullName) {
    var registry = container.registry;
    var splitName = fullName.split(':');
    var type = splitName[0];

    var injections = buildInjections(container, registry.getTypeInjections(type), registry.getInjections(fullName));
    injections._debugContainerKey = fullName;

    _emberUtils.setOwner(injections, container.owner);

    return injections;
  }

  function factoryInjectionsFor(container, fullName) {
    var registry = container.registry;
    var splitName = fullName.split(':');
    var type = splitName[0];

    var factoryInjections = buildInjections(container, registry.getFactoryTypeInjections(type), registry.getFactoryInjections(fullName));
    factoryInjections._debugContainerKey = fullName;

    return factoryInjections;
  }

  function instantiate(container, fullName) {
    var factory = factoryFor(container, fullName);
    var lazyInjections = undefined,
        validationCache = undefined;

    if (container.registry.getOption(fullName, 'instantiate') === false) {
      return factory;
    }

    if (factory) {
      if (typeof factory.create !== 'function') {
        throw new Error('Failed to create an instance of \'' + fullName + '\'. Most likely an improperly defined class or' + ' an invalid module export.');
      }

      validationCache = container.validationCache;

      _emberMetal.runInDebug(function () {
        // Ensure that all lazy injections are valid at instantiation time
        if (!validationCache[fullName] && typeof factory._lazyInjections === 'function') {
          lazyInjections = factory._lazyInjections();
          lazyInjections = container.registry.normalizeInjectionsHash(lazyInjections);

          container.registry.validateInjections(lazyInjections);
        }
      });

      validationCache[fullName] = true;

      var obj = undefined;

      if (typeof factory.extend === 'function') {
        // assume the factory was extendable and is already injected
        obj = factory.create();
      } else {
        // assume the factory was extendable
        // to create time injections
        // TODO: support new'ing for instantiation and merge injections for pure JS Functions
        var injections = injectionsFor(container, fullName);

        // Ensure that a container is available to an object during instantiation.
        // TODO - remove when Ember reaches v3.0.0
        // This "fake" container will be replaced after instantiation with a
        // property that raises deprecations every time it is accessed.
        injections.container = container._fakeContainerToInject;
        obj = factory.create(injections);

        // TODO - remove when Ember reaches v3.0.0
        if (!Object.isFrozen(obj) && 'container' in obj) {
          injectDeprecatedContainer(obj, container);
        }
      }

      return obj;
    }
  }

  // TODO - remove when Ember reaches v3.0.0
  function injectDeprecatedContainer(object, container) {
    Object.defineProperty(object, 'container', {
      configurable: true,
      enumerable: false,
      get: function () {
        _emberMetal.deprecate('Using the injected `container` is deprecated. Please use the `getOwner` helper instead to access the owner of this object.', false, { id: 'ember-application.injected-container', until: '3.0.0', url: 'http://emberjs.com/deprecations/v2.x#toc_injected-container-access' });
        return this[CONTAINER_OVERRIDE] || container;
      },

      set: function (value) {
        _emberMetal.deprecate('Providing the `container` property to ' + this + ' is deprecated. Please use `Ember.setOwner` or `owner.ownerInjection()` instead to provide an owner to the instance being created.', false, { id: 'ember-application.injected-container', until: '3.0.0', url: 'http://emberjs.com/deprecations/v2.x#toc_injected-container-access' });

        this[CONTAINER_OVERRIDE] = value;

        return value;
      }
    });
  }

  function eachDestroyable(container, callback) {
    var cache = container.cache;
    var keys = Object.keys(cache);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = cache[key];

      if (container.registry.getOption(key, 'instantiate') !== false) {
        callback(value);
      }
    }
  }

  function resetCache(container) {
    eachDestroyable(container, function (value) {
      if (value.destroy) {
        value.destroy();
      }
    });

    container.cache.dict = _emberUtils.dictionary(null);
  }

  function resetMember(container, fullName) {
    var member = container.cache[fullName];

    delete container.factoryCache[fullName];

    if (member) {
      delete container.cache[fullName];

      if (member.destroy) {
        member.destroy();
      }
    }
  }

  function buildFakeContainerWithDeprecations(container) {
    var fakeContainer = {};
    var propertyMappings = {
      lookup: 'lookup',
      lookupFactory: '_lookupFactory'
    };

    for (var containerProperty in propertyMappings) {
      fakeContainer[containerProperty] = buildFakeContainerFunction(container, containerProperty, propertyMappings[containerProperty]);
    }

    return fakeContainer;
  }

  function buildFakeContainerFunction(container, containerProperty, ownerProperty) {
    return function () {
      _emberMetal.deprecate('Using the injected `container` is deprecated. Please use the `getOwner` helper to access the owner of this object and then call `' + ownerProperty + '` instead.', false, {
        id: 'ember-application.injected-container',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x#toc_injected-container-access'
      });
      return container[containerProperty].apply(container, arguments);
    };
  }
});
enifed('container/index', ['exports', 'container/registry', 'container/container'], function (exports, _containerRegistry, _containerContainer) {
  /*
  Public API for the container is still in flux.
  The public API, specified on the application namespace should be considered the stable API.
  // @module container
    @private
  */

  'use strict';

  exports.Registry = _containerRegistry.default;
  exports.privatize = _containerRegistry.privatize;
  exports.Container = _containerContainer.default;
  exports.buildFakeContainerWithDeprecations = _containerContainer.buildFakeContainerWithDeprecations;
});
enifed('container/registry', ['exports', 'ember-utils', 'ember-metal', 'container/container'], function (exports, _emberUtils, _emberMetal, _containerContainer) {
  'use strict';

  exports.default = Registry;
  exports.privatize = privatize;

  var VALID_FULL_NAME_REGEXP = /^[^:]+:[^:]+$/;

  /**
   A registry used to store factory and option information keyed
   by type.
  
   A `Registry` stores the factory and option information needed by a
   `Container` to instantiate and cache objects.
  
   The API for `Registry` is still in flux and should not be considered stable.
  
   @private
   @class Registry
   @since 1.11.0
  */

  function Registry(options) {
    this.fallback = options && options.fallback ? options.fallback : null;

    if (options && options.resolver) {
      this.resolver = options.resolver;

      if (typeof this.resolver === 'function') {
        deprecateResolverFunction(this);
      }
    }

    this.registrations = _emberUtils.dictionary(options && options.registrations ? options.registrations : null);

    this._typeInjections = _emberUtils.dictionary(null);
    this._injections = _emberUtils.dictionary(null);
    this._factoryTypeInjections = _emberUtils.dictionary(null);
    this._factoryInjections = _emberUtils.dictionary(null);

    this._localLookupCache = new _emberUtils.EmptyObject();
    this._normalizeCache = _emberUtils.dictionary(null);
    this._resolveCache = _emberUtils.dictionary(null);
    this._failCache = _emberUtils.dictionary(null);

    this._options = _emberUtils.dictionary(null);
    this._typeOptions = _emberUtils.dictionary(null);
  }

  Registry.prototype = {
    /**
     A backup registry for resolving registrations when no matches can be found.
      @private
     @property fallback
     @type Registry
     */
    fallback: null,

    /**
     An object that has a `resolve` method that resolves a name.
      @private
     @property resolver
     @type Resolver
     */
    resolver: null,

    /**
     @private
     @property registrations
     @type InheritingDict
     */
    registrations: null,

    /**
     @private
      @property _typeInjections
     @type InheritingDict
     */
    _typeInjections: null,

    /**
     @private
      @property _injections
     @type InheritingDict
     */
    _injections: null,

    /**
     @private
      @property _factoryTypeInjections
     @type InheritingDict
     */
    _factoryTypeInjections: null,

    /**
     @private
      @property _factoryInjections
     @type InheritingDict
     */
    _factoryInjections: null,

    /**
     @private
      @property _normalizeCache
     @type InheritingDict
     */
    _normalizeCache: null,

    /**
     @private
      @property _resolveCache
     @type InheritingDict
     */
    _resolveCache: null,

    /**
     @private
      @property _options
     @type InheritingDict
     */
    _options: null,

    /**
     @private
      @property _typeOptions
     @type InheritingDict
     */
    _typeOptions: null,

    /**
     Creates a container based on this registry.
      @private
     @method container
     @param {Object} options
     @return {Container} created container
     */
    container: function (options) {
      return new _containerContainer.default(this, options);
    },

    /**
     Registers a factory for later injection.
      Example:
      ```javascript
     let registry = new Registry();
      registry.register('model:user', Person, {singleton: false });
     registry.register('fruit:favorite', Orange);
     registry.register('communication:main', Email, {singleton: false});
     ```
      @private
     @method register
     @param {String} fullName
     @param {Function} factory
     @param {Object} options
     */
    register: function (fullName, factory) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));

      if (factory === undefined) {
        throw new TypeError('Attempting to register an unknown factory: \'' + fullName + '\'');
      }

      var normalizedName = this.normalize(fullName);

      if (this._resolveCache[normalizedName]) {
        throw new Error('Cannot re-register: \'' + fullName + '\', as it has already been resolved.');
      }

      delete this._failCache[normalizedName];
      this.registrations[normalizedName] = factory;
      this._options[normalizedName] = options;
    },

    /**
     Unregister a fullName
      ```javascript
     let registry = new Registry();
     registry.register('model:user', User);
      registry.resolve('model:user').create() instanceof User //=> true
      registry.unregister('model:user')
     registry.resolve('model:user') === undefined //=> true
     ```
      @private
     @method unregister
     @param {String} fullName
     */
    unregister: function (fullName) {
      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));

      var normalizedName = this.normalize(fullName);

      this._localLookupCache = new _emberUtils.EmptyObject();

      delete this.registrations[normalizedName];
      delete this._resolveCache[normalizedName];
      delete this._failCache[normalizedName];
      delete this._options[normalizedName];
    },

    /**
     Given a fullName return the corresponding factory.
      By default `resolve` will retrieve the factory from
     the registry.
      ```javascript
     let registry = new Registry();
     registry.register('api:twitter', Twitter);
      registry.resolve('api:twitter') // => Twitter
     ```
      Optionally the registry can be provided with a custom resolver.
     If provided, `resolve` will first provide the custom resolver
     the opportunity to resolve the fullName, otherwise it will fallback
     to the registry.
      ```javascript
     let registry = new Registry();
     registry.resolver = function(fullName) {
        // lookup via the module system of choice
      };
      // the twitter factory is added to the module system
     registry.resolve('api:twitter') // => Twitter
     ```
      @private
     @method resolve
     @param {String} fullName
     @param {Object} [options]
     @param {String} [options.source] the fullname of the request source (used for local lookups)
     @return {Function} fullName's factory
     */
    resolve: function (fullName, options) {
      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));
      var factory = resolve(this, this.normalize(fullName), options);
      if (factory === undefined && this.fallback) {
        var _fallback;

        factory = (_fallback = this.fallback).resolve.apply(_fallback, arguments);
      }
      return factory;
    },

    /**
     A hook that can be used to describe how the resolver will
     attempt to find the factory.
      For example, the default Ember `.describe` returns the full
     class name (including namespace) where Ember's resolver expects
     to find the `fullName`.
      @private
     @method describe
     @param {String} fullName
     @return {string} described fullName
     */
    describe: function (fullName) {
      if (this.resolver && this.resolver.lookupDescription) {
        return this.resolver.lookupDescription(fullName);
      } else if (this.fallback) {
        return this.fallback.describe(fullName);
      } else {
        return fullName;
      }
    },

    /**
     A hook to enable custom fullName normalization behaviour
      @private
     @method normalizeFullName
     @param {String} fullName
     @return {string} normalized fullName
     */
    normalizeFullName: function (fullName) {
      if (this.resolver && this.resolver.normalize) {
        return this.resolver.normalize(fullName);
      } else if (this.fallback) {
        return this.fallback.normalizeFullName(fullName);
      } else {
        return fullName;
      }
    },

    /**
     Normalize a fullName based on the application's conventions
      @private
     @method normalize
     @param {String} fullName
     @return {string} normalized fullName
     */
    normalize: function (fullName) {
      return this._normalizeCache[fullName] || (this._normalizeCache[fullName] = this.normalizeFullName(fullName));
    },

    /**
     @method makeToString
      @private
     @param {any} factory
     @param {string} fullName
     @return {function} toString function
     */
    makeToString: function (factory, fullName) {
      if (this.resolver && this.resolver.makeToString) {
        return this.resolver.makeToString(factory, fullName);
      } else if (this.fallback) {
        return this.fallback.makeToString(factory, fullName);
      } else {
        return factory.toString();
      }
    },

    /**
     Given a fullName check if the container is aware of its factory
     or singleton instance.
      @private
     @method has
     @param {String} fullName
     @param {Object} [options]
     @param {String} [options.source] the fullname of the request source (used for local lookups)
     @return {Boolean}
     */
    has: function (fullName, options) {
      if (!this.isValidFullName(fullName)) {
        return false;
      }

      var source = options && options.source && this.normalize(options.source);

      return has(this, this.normalize(fullName), source);
    },

    /**
     Allow registering options for all factories of a type.
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      // if all of type `connection` must not be singletons
     registry.optionsForType('connection', { singleton: false });
      registry.register('connection:twitter', TwitterConnection);
     registry.register('connection:facebook', FacebookConnection);
      let twitter = container.lookup('connection:twitter');
     let twitter2 = container.lookup('connection:twitter');
      twitter === twitter2; // => false
      let facebook = container.lookup('connection:facebook');
     let facebook2 = container.lookup('connection:facebook');
      facebook === facebook2; // => false
     ```
      @private
     @method optionsForType
     @param {String} type
     @param {Object} options
     */
    optionsForType: function (type, options) {
      this._typeOptions[type] = options;
    },

    getOptionsForType: function (type) {
      var optionsForType = this._typeOptions[type];
      if (optionsForType === undefined && this.fallback) {
        optionsForType = this.fallback.getOptionsForType(type);
      }
      return optionsForType;
    },

    /**
     @private
     @method options
     @param {String} fullName
     @param {Object} options
     */
    options: function (fullName) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var normalizedName = this.normalize(fullName);
      this._options[normalizedName] = options;
    },

    getOptions: function (fullName) {
      var normalizedName = this.normalize(fullName);
      var options = this._options[normalizedName];

      if (options === undefined && this.fallback) {
        options = this.fallback.getOptions(fullName);
      }
      return options;
    },

    getOption: function (fullName, optionName) {
      var options = this._options[fullName];

      if (options && options[optionName] !== undefined) {
        return options[optionName];
      }

      var type = fullName.split(':')[0];
      options = this._typeOptions[type];

      if (options && options[optionName] !== undefined) {
        return options[optionName];
      } else if (this.fallback) {
        return this.fallback.getOption(fullName, optionName);
      }
    },

    /**
     Used only via `injection`.
      Provides a specialized form of injection, specifically enabling
     all objects of one type to be injected with a reference to another
     object.
      For example, provided each object of type `controller` needed a `router`.
     one would do the following:
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('router:main', Router);
     registry.register('controller:user', UserController);
     registry.register('controller:post', PostController);
      registry.typeInjection('controller', 'router', 'router:main');
      let user = container.lookup('controller:user');
     let post = container.lookup('controller:post');
      user.router instanceof Router; //=> true
     post.router instanceof Router; //=> true
      // both controllers share the same router
     user.router === post.router; //=> true
     ```
      @private
     @method typeInjection
     @param {String} type
     @param {String} property
     @param {String} fullName
     */
    typeInjection: function (type, property, fullName) {
      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));

      var fullNameType = fullName.split(':')[0];
      if (fullNameType === type) {
        throw new Error('Cannot inject a \'' + fullName + '\' on other ' + type + '(s).');
      }

      var injections = this._typeInjections[type] || (this._typeInjections[type] = []);

      injections.push({
        property: property,
        fullName: fullName
      });
    },

    /**
     Defines injection rules.
      These rules are used to inject dependencies onto objects when they
     are instantiated.
      Two forms of injections are possible:
      * Injecting one fullName on another fullName
     * Injecting one fullName on a type
      Example:
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('source:main', Source);
     registry.register('model:user', User);
     registry.register('model:post', Post);
      // injecting one fullName on another fullName
     // eg. each user model gets a post model
     registry.injection('model:user', 'post', 'model:post');
      // injecting one fullName on another type
     registry.injection('model', 'source', 'source:main');
      let user = container.lookup('model:user');
     let post = container.lookup('model:post');
      user.source instanceof Source; //=> true
     post.source instanceof Source; //=> true
      user.post instanceof Post; //=> true
      // and both models share the same source
     user.source === post.source; //=> true
     ```
      @private
     @method injection
     @param {String} factoryName
     @param {String} property
     @param {String} injectionName
     */
    injection: function (fullName, property, injectionName) {
      this.validateFullName(injectionName);
      var normalizedInjectionName = this.normalize(injectionName);

      if (fullName.indexOf(':') === -1) {
        return this.typeInjection(fullName, property, normalizedInjectionName);
      }

      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));
      var normalizedName = this.normalize(fullName);

      var injections = this._injections[normalizedName] || (this._injections[normalizedName] = []);

      injections.push({
        property: property,
        fullName: normalizedInjectionName
      });
    },

    /**
     Used only via `factoryInjection`.
      Provides a specialized form of injection, specifically enabling
     all factory of one type to be injected with a reference to another
     object.
      For example, provided each factory of type `model` needed a `store`.
     one would do the following:
      ```javascript
     let registry = new Registry();
      registry.register('store:main', SomeStore);
      registry.factoryTypeInjection('model', 'store', 'store:main');
      let store = registry.lookup('store:main');
     let UserFactory = registry.lookupFactory('model:user');
      UserFactory.store instanceof SomeStore; //=> true
     ```
      @private
     @method factoryTypeInjection
     @param {String} type
     @param {String} property
     @param {String} fullName
     */
    factoryTypeInjection: function (type, property, fullName) {
      var injections = this._factoryTypeInjections[type] || (this._factoryTypeInjections[type] = []);

      injections.push({
        property: property,
        fullName: this.normalize(fullName)
      });
    },

    /**
     Defines factory injection rules.
      Similar to regular injection rules, but are run against factories, via
     `Registry#lookupFactory`.
      These rules are used to inject objects onto factories when they
     are looked up.
      Two forms of injections are possible:
      * Injecting one fullName on another fullName
     * Injecting one fullName on a type
      Example:
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('store:main', Store);
     registry.register('store:secondary', OtherStore);
     registry.register('model:user', User);
     registry.register('model:post', Post);
      // injecting one fullName on another type
     registry.factoryInjection('model', 'store', 'store:main');
      // injecting one fullName on another fullName
     registry.factoryInjection('model:post', 'secondaryStore', 'store:secondary');
      let UserFactory = container.lookupFactory('model:user');
     let PostFactory = container.lookupFactory('model:post');
     let store = container.lookup('store:main');
      UserFactory.store instanceof Store; //=> true
     UserFactory.secondaryStore instanceof OtherStore; //=> false
      PostFactory.store instanceof Store; //=> true
     PostFactory.secondaryStore instanceof OtherStore; //=> true
      // and both models share the same source instance
     UserFactory.store === PostFactory.store; //=> true
     ```
      @private
     @method factoryInjection
     @param {String} factoryName
     @param {String} property
     @param {String} injectionName
     */
    factoryInjection: function (fullName, property, injectionName) {
      var normalizedName = this.normalize(fullName);
      var normalizedInjectionName = this.normalize(injectionName);

      this.validateFullName(injectionName);

      if (fullName.indexOf(':') === -1) {
        return this.factoryTypeInjection(normalizedName, property, normalizedInjectionName);
      }

      var injections = this._factoryInjections[normalizedName] || (this._factoryInjections[normalizedName] = []);

      injections.push({
        property: property,
        fullName: normalizedInjectionName
      });
    },

    /**
     @private
     @method knownForType
     @param {String} type the type to iterate over
    */
    knownForType: function (type) {
      var fallbackKnown = undefined,
          resolverKnown = undefined;

      var localKnown = _emberUtils.dictionary(null);
      var registeredNames = Object.keys(this.registrations);
      for (var index = 0; index < registeredNames.length; index++) {
        var fullName = registeredNames[index];
        var itemType = fullName.split(':')[0];

        if (itemType === type) {
          localKnown[fullName] = true;
        }
      }

      if (this.fallback) {
        fallbackKnown = this.fallback.knownForType(type);
      }

      if (this.resolver && this.resolver.knownForType) {
        resolverKnown = this.resolver.knownForType(type);
      }

      return _emberUtils.assign({}, fallbackKnown, localKnown, resolverKnown);
    },

    validateFullName: function (fullName) {
      if (!this.isValidFullName(fullName)) {
        throw new TypeError('Invalid Fullname, expected: \'type:name\' got: ' + fullName);
      }

      return true;
    },

    isValidFullName: function (fullName) {
      return !!VALID_FULL_NAME_REGEXP.test(fullName);
    },

    validateInjections: function (injections) {
      if (!injections) {
        return;
      }

      var fullName = undefined;

      for (var i = 0; i < injections.length; i++) {
        fullName = injections[i].fullName;

        if (!this.has(fullName)) {
          throw new Error('Attempting to inject an unknown injection: \'' + fullName + '\'');
        }
      }
    },

    normalizeInjectionsHash: function (hash) {
      var injections = [];

      for (var key in hash) {
        if (hash.hasOwnProperty(key)) {
          _emberMetal.assert('Expected a proper full name, given \'' + hash[key] + '\'', this.validateFullName(hash[key]));

          injections.push({
            property: key,
            fullName: hash[key]
          });
        }
      }

      return injections;
    },

    getInjections: function (fullName) {
      var injections = this._injections[fullName] || [];
      if (this.fallback) {
        injections = injections.concat(this.fallback.getInjections(fullName));
      }
      return injections;
    },

    getTypeInjections: function (type) {
      var injections = this._typeInjections[type] || [];
      if (this.fallback) {
        injections = injections.concat(this.fallback.getTypeInjections(type));
      }
      return injections;
    },

    getFactoryInjections: function (fullName) {
      var injections = this._factoryInjections[fullName] || [];
      if (this.fallback) {
        injections = injections.concat(this.fallback.getFactoryInjections(fullName));
      }
      return injections;
    },

    getFactoryTypeInjections: function (type) {
      var injections = this._factoryTypeInjections[type] || [];
      if (this.fallback) {
        injections = injections.concat(this.fallback.getFactoryTypeInjections(type));
      }
      return injections;
    }
  };

  function deprecateResolverFunction(registry) {
    _emberMetal.deprecate('Passing a `resolver` function into a Registry is deprecated. Please pass in a Resolver object with a `resolve` method.', false, { id: 'ember-application.registry-resolver-as-function', until: '3.0.0', url: 'http://emberjs.com/deprecations/v2.x#toc_registry-resolver-as-function' });
    registry.resolver = {
      resolve: registry.resolver
    };
  }

  /**
   Given a fullName and a source fullName returns the fully resolved
   fullName. Used to allow for local lookup.
  
   ```javascript
   let registry = new Registry();
  
   // the twitter factory is added to the module system
   registry.expandLocalLookup('component:post-title', { source: 'template:post' }) // => component:post/post-title
   ```
  
   @private
   @method expandLocalLookup
   @param {String} fullName
   @param {Object} [options]
   @param {String} [options.source] the fullname of the request source (used for local lookups)
   @return {String} fullName
   */
  Registry.prototype.expandLocalLookup = function Registry_expandLocalLookup(fullName, options) {
    if (this.resolver && this.resolver.expandLocalLookup) {
      _emberMetal.assert('fullName must be a proper full name', this.validateFullName(fullName));
      _emberMetal.assert('options.source must be provided to expandLocalLookup', options && options.source);
      _emberMetal.assert('options.source must be a proper full name', this.validateFullName(options.source));

      var normalizedFullName = this.normalize(fullName);
      var normalizedSource = this.normalize(options.source);

      return expandLocalLookup(this, normalizedFullName, normalizedSource);
    } else if (this.fallback) {
      return this.fallback.expandLocalLookup(fullName, options);
    } else {
      return null;
    }
  };

  function expandLocalLookup(registry, normalizedName, normalizedSource) {
    var cache = registry._localLookupCache;
    var normalizedNameCache = cache[normalizedName];

    if (!normalizedNameCache) {
      normalizedNameCache = cache[normalizedName] = new _emberUtils.EmptyObject();
    }

    var cached = normalizedNameCache[normalizedSource];

    if (cached !== undefined) {
      return cached;
    }

    var expanded = registry.resolver.expandLocalLookup(normalizedName, normalizedSource);

    return normalizedNameCache[normalizedSource] = expanded;
  }

  function resolve(registry, normalizedName, options) {
    if (options && options.source) {
      // when `source` is provided expand normalizedName
      // and source into the full normalizedName
      normalizedName = registry.expandLocalLookup(normalizedName, options);

      // if expandLocalLookup returns falsey, we do not support local lookup
      if (!normalizedName) {
        return;
      }
    }

    var cached = registry._resolveCache[normalizedName];
    if (cached !== undefined) {
      return cached;
    }
    if (registry._failCache[normalizedName]) {
      return;
    }

    var resolved = undefined;

    if (registry.resolver) {
      resolved = registry.resolver.resolve(normalizedName);
    }

    if (resolved === undefined) {
      resolved = registry.registrations[normalizedName];
    }

    if (resolved === undefined) {
      registry._failCache[normalizedName] = true;
    } else {
      registry._resolveCache[normalizedName] = resolved;
    }

    return resolved;
  }

  function has(registry, fullName, source) {
    return registry.resolve(fullName, { source: source }) !== undefined;
  }

  var privateNames = _emberUtils.dictionary(null);
  var privateSuffix = '' + Math.random() + Date.now();

  function privatize(_ref) {
    var fullName = _ref[0];

    var name = privateNames[fullName];
    if (name) {
      return name;
    }

    var _fullName$split = fullName.split(':');

    var type = _fullName$split[0];
    var rawName = _fullName$split[1];

    return privateNames[fullName] = _emberUtils.intern(type + ':' + rawName + '-' + privateSuffix);
  }
});
enifed('ember-console/index', ['exports', 'ember-environment'], function (exports, _emberEnvironment) {
  'use strict';

  function K() {}

  function consoleMethod(name) {
    var consoleObj = undefined;
    if (_emberEnvironment.context.imports.console) {
      consoleObj = _emberEnvironment.context.imports.console;
    } else if (typeof console !== 'undefined') {
      consoleObj = console;
    }

    var method = typeof consoleObj === 'object' ? consoleObj[name] : null;

    if (typeof method !== 'function') {
      return;
    }

    if (typeof method.bind === 'function') {
      return method.bind(consoleObj);
    }

    return function () {
      method.apply(consoleObj, arguments);
    };
  }

  function assertPolyfill(test, message) {
    if (!test) {
      try {
        // attempt to preserve the stack
        throw new Error('assertion failed: ' + message);
      } catch (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      }
    }
  }

  /**
    Inside Ember-Metal, simply uses the methods from `imports.console`.
    Override this to provide more robust logging functionality.
  
    @class Logger
    @namespace Ember
    @public
  */
  exports.default = {
    /**
     Logs the arguments to the console.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.log('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method log
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    log: consoleMethod('log') || K,

    /**
     Prints the arguments to the console with a warning icon.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      Ember.Logger.warn('Something happened!');
      // "Something happened!" will be printed to the console with a warning icon.
      ```
      @method warn
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    warn: consoleMethod('warn') || K,

    /**
     Prints the arguments to the console with an error icon, red text and a stack trace.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      Ember.Logger.error('Danger! Danger!');
      // "Danger! Danger!" will be printed to the console in red text.
      ```
      @method error
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    error: consoleMethod('error') || K,

    /**
     Logs the arguments to the console.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.info('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method info
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    info: consoleMethod('info') || K,

    /**
     Logs the arguments to the console in blue text.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.debug('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method debug
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    debug: consoleMethod('debug') || consoleMethod('info') || K,

    /**
     If the value passed into `Ember.Logger.assert` is not truthy it will throw an error with a stack trace.
       ```javascript
      Ember.Logger.assert(true); // undefined
      Ember.Logger.assert(true === false); // Throws an Assertion failed error.
      Ember.Logger.assert(true === false, 'Something invalid'); // Throws an Assertion failed error with message.
      ```
      @method assert
     @for Ember.Logger
     @param {Boolean} bool Value to test
     @param {String} message Assertion message on failed
     @public
    */
    assert: consoleMethod('assert') || assertPolyfill
  };
});
enifed('ember-environment/global', ['exports'], function (exports) {
  /* globals global, window, self, mainContext */

  // from lodash to catch fake globals
  'use strict';

  function checkGlobal(value) {
    return value && value.Object === Object ? value : undefined;
  }

  // element ids can ruin global miss checks
  function checkElementIdShadowing(value) {
    return value && value.nodeType === undefined ? value : undefined;
  }

  // export real global
  exports.default = checkGlobal(checkElementIdShadowing(typeof global === 'object' && global)) || checkGlobal(typeof self === 'object' && self) || checkGlobal(typeof window === 'object' && window) || mainContext || // set before strict mode in Ember loader/wrapper
  new Function('return this')();
  // eval outside of strict mode
});
enifed('ember-environment/index', ['exports', 'ember-environment/global', 'ember-environment/utils'], function (exports, _emberEnvironmentGlobal, _emberEnvironmentUtils) {
  /* globals module */
  'use strict';

  /**
    The hash of environment variables used to control various configuration
    settings. To specify your own or override default settings, add the
    desired properties to a global hash named `EmberENV` (or `ENV` for
    backwards compatibility with earlier versions of Ember). The `EmberENV`
    hash must be created before loading Ember.
  
    @class EmberENV
    @type Object
    @public
  */
  var ENV = typeof _emberEnvironmentGlobal.default.EmberENV === 'object' && _emberEnvironmentGlobal.default.EmberENV || typeof _emberEnvironmentGlobal.default.ENV === 'object' && _emberEnvironmentGlobal.default.ENV || {};

  exports.ENV = ENV;
  // ENABLE_ALL_FEATURES was documented, but you can't actually enable non optional features.
  if (ENV.ENABLE_ALL_FEATURES) {
    ENV.ENABLE_OPTIONAL_FEATURES = true;
  }

  /**
    Determines whether Ember should add to `Array`, `Function`, and `String`
    native object prototypes, a few extra methods in order to provide a more
    friendly API.
  
    We generally recommend leaving this option set to true however, if you need
    to turn it off, you can add the configuration property
    `EXTEND_PROTOTYPES` to `EmberENV` and set it to `false`.
  
    Note, when disabled (the default configuration for Ember Addons), you will
    instead have to access all methods and functions from the Ember
    namespace.
  
    @property EXTEND_PROTOTYPES
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.EXTEND_PROTOTYPES = _emberEnvironmentUtils.normalizeExtendPrototypes(ENV.EXTEND_PROTOTYPES);

  /**
    The `LOG_STACKTRACE_ON_DEPRECATION` property, when true, tells Ember to log
    a full stack trace during deprecation warnings.
  
    @property LOG_STACKTRACE_ON_DEPRECATION
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.LOG_STACKTRACE_ON_DEPRECATION = _emberEnvironmentUtils.defaultTrue(ENV.LOG_STACKTRACE_ON_DEPRECATION);

  /**
    The `LOG_VERSION` property, when true, tells Ember to log versions of all
    dependent libraries in use.
  
    @property LOG_VERSION
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.LOG_VERSION = _emberEnvironmentUtils.defaultTrue(ENV.LOG_VERSION);

  // default false
  ENV.MODEL_FACTORY_INJECTIONS = _emberEnvironmentUtils.defaultFalse(ENV.MODEL_FACTORY_INJECTIONS);

  /**
    Debug parameter you can turn on. This will log all bindings that fire to
    the console. This should be disabled in production code. Note that you
    can also enable this from the console or temporarily.
  
    @property LOG_BINDINGS
    @for EmberENV
    @type Boolean
    @default false
    @public
  */
  ENV.LOG_BINDINGS = _emberEnvironmentUtils.defaultFalse(ENV.LOG_BINDINGS);

  ENV.RAISE_ON_DEPRECATION = _emberEnvironmentUtils.defaultFalse(ENV.RAISE_ON_DEPRECATION);

  // check if window exists and actually is the global
  var hasDOM = typeof window !== 'undefined' && window === _emberEnvironmentGlobal.default && window.document && window.document.createElement && !ENV.disableBrowserEnvironment; // is this a public thing?

  // legacy imports/exports/lookup stuff (should we keep this??)
  var originalContext = _emberEnvironmentGlobal.default.Ember || {};

  var context = {
    // import jQuery
    imports: originalContext.imports || _emberEnvironmentGlobal.default,
    // export Ember
    exports: originalContext.exports || _emberEnvironmentGlobal.default,
    // search for Namespaces
    lookup: originalContext.lookup || _emberEnvironmentGlobal.default
  };

  exports.context = context;
  // TODO: cleanup single source of truth issues with this stuff
  var environment = hasDOM ? {
    hasDOM: true,
    isChrome: !!window.chrome && !window.opera,
    isFirefox: typeof InstallTrigger !== 'undefined',
    isPhantom: !!window.callPhantom,
    location: window.location,
    history: window.history,
    userAgent: window.navigator.userAgent,
    window: window
  } : {
    hasDOM: false,
    isChrome: false,
    isFirefox: false,
    isPhantom: false,
    location: null,
    history: null,
    userAgent: 'Lynx (textmode)',
    window: null
  };
  exports.environment = environment;
});
enifed("ember-environment/utils", ["exports"], function (exports) {
  "use strict";

  exports.defaultTrue = defaultTrue;
  exports.defaultFalse = defaultFalse;
  exports.normalizeExtendPrototypes = normalizeExtendPrototypes;

  function defaultTrue(v) {
    return v === false ? false : true;
  }

  function defaultFalse(v) {
    return v === true ? true : false;
  }

  function normalizeExtendPrototypes(obj) {
    if (obj === false) {
      return { String: false, Array: false, Function: false };
    } else if (!obj || obj === true) {
      return { String: true, Array: true, Function: true };
    } else {
      return {
        String: defaultTrue(obj.String),
        Array: defaultTrue(obj.Array),
        Function: defaultTrue(obj.Function)
      };
    }
  }
});
enifed('ember-metal/alias', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/error', 'ember-metal/properties', 'ember-metal/computed', 'ember-metal/meta', 'ember-metal/dependent_keys'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalError, _emberMetalProperties, _emberMetalComputed, _emberMetalMeta, _emberMetalDependent_keys) {
  'use strict';

  exports.default = alias;
  exports.AliasedProperty = AliasedProperty;

  var CONSUMED = {};

  function alias(altKey) {
    return new AliasedProperty(altKey);
  }

  function AliasedProperty(altKey) {
    this.isDescriptor = true;
    this.altKey = altKey;
    this._dependentKeys = [altKey];
  }

  AliasedProperty.prototype = Object.create(_emberMetalProperties.Descriptor.prototype);

  AliasedProperty.prototype.setup = function (obj, keyName) {
    _emberMetalDebug.assert('Setting alias \'' + keyName + '\' on self', this.altKey !== keyName);
    var meta = _emberMetalMeta.meta(obj);
    if (meta.peekWatching(keyName)) {
      _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
    }
  };

  AliasedProperty.prototype.teardown = function (obj, keyName) {
    var meta = _emberMetalMeta.meta(obj);
    if (meta.peekWatching(keyName)) {
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
    }
  };

  AliasedProperty.prototype.willWatch = function (obj, keyName) {
    _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, _emberMetalMeta.meta(obj));
  };

  AliasedProperty.prototype.didUnwatch = function (obj, keyName) {
    _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, _emberMetalMeta.meta(obj));
  };

  AliasedProperty.prototype.get = function AliasedProperty_get(obj, keyName) {
    var ret = _emberMetalProperty_get.get(obj, this.altKey);
    var meta = _emberMetalMeta.meta(obj);
    var cache = meta.writableCache();
    if (cache[keyName] !== CONSUMED) {
      cache[keyName] = CONSUMED;
      _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
    }
    return ret;
  };

  AliasedProperty.prototype.set = function AliasedProperty_set(obj, keyName, value) {
    return _emberMetalProperty_set.set(obj, this.altKey, value);
  };

  AliasedProperty.prototype.readOnly = function () {
    this.set = AliasedProperty_readOnlySet;
    return this;
  };

  function AliasedProperty_readOnlySet(obj, keyName, value) {
    throw new _emberMetalError.default('Cannot set read-only property \'' + keyName + '\' on object: ' + _emberUtils.inspect(obj));
  }

  AliasedProperty.prototype.oneWay = function () {
    this.set = AliasedProperty_oneWaySet;
    return this;
  };

  function AliasedProperty_oneWaySet(obj, keyName, value) {
    _emberMetalProperties.defineProperty(obj, keyName, null);
    return _emberMetalProperty_set.set(obj, keyName, value);
  }

  // Backwards compatibility with Ember Data.
  AliasedProperty.prototype._meta = undefined;
  AliasedProperty.prototype.meta = _emberMetalComputed.ComputedProperty.prototype.meta;
});
enifed('ember-metal/binding', ['exports', 'ember-utils', 'ember-console', 'ember-environment', 'ember-metal/run_loop', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/events', 'ember-metal/observer', 'ember-metal/path_cache'], function (exports, _emberUtils, _emberConsole, _emberEnvironment, _emberMetalRun_loop, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalEvents, _emberMetalObserver, _emberMetalPath_cache) {
  'use strict';

  exports.bind = bind;

  /**
  @module ember
  @submodule ember-metal
  */

  // ..........................................................
  // BINDING
  //

  function Binding(toPath, fromPath) {
    // Configuration
    this._from = fromPath;
    this._to = toPath;
    this._oneWay = undefined;

    // State
    this._direction = undefined;
    this._readyToSync = undefined;
    this._fromObj = undefined;
    this._fromPath = undefined;
    this._toObj = undefined;
  }

  /**
    @class Binding
    @namespace Ember
    @deprecated See http://emberjs.com/deprecations/v2.x#toc_ember-binding
    @public
  */

  Binding.prototype = {
    /**
      This copies the Binding so it can be connected to another object.
       @method copy
      @return {Ember.Binding} `this`
      @public
    */
    copy: function () {
      var copy = new Binding(this._to, this._from);
      if (this._oneWay) {
        copy._oneWay = true;
      }
      return copy;
    },

    // ..........................................................
    // CONFIG
    //

    /**
      This will set `from` property path to the specified value. It will not
      attempt to resolve this property path to an actual object until you
      connect the binding.
       The binding will search for the property path starting at the root object
      you pass when you `connect()` the binding. It follows the same rules as
      `get()` - see that method for more information.
       @method from
      @param {String} path The property path to connect to.
      @return {Ember.Binding} `this`
      @public
    */
    from: function (path) {
      this._from = path;
      return this;
    },

    /**
      This will set the `to` property path to the specified value. It will not
      attempt to resolve this property path to an actual object until you
      connect the binding.
       The binding will search for the property path starting at the root object
      you pass when you `connect()` the binding. It follows the same rules as
      `get()` - see that method for more information.
       @method to
      @param {String|Tuple} path A property path or tuple.
      @return {Ember.Binding} `this`
      @public
    */
    to: function (path) {
      this._to = path;
      return this;
    },

    /**
      Configures the binding as one way. A one-way binding will relay changes
      on the `from` side to the `to` side, but not the other way around. This
      means that if you change the `to` side directly, the `from` side may have
      a different value.
       @method oneWay
      @return {Ember.Binding} `this`
      @public
    */
    oneWay: function () {
      this._oneWay = true;
      return this;
    },

    /**
      @method toString
      @return {String} string representation of binding
      @public
    */
    toString: function () {
      var oneWay = this._oneWay ? '[oneWay]' : '';
      return 'Ember.Binding<' + _emberUtils.guidFor(this) + '>(' + this._from + ' -> ' + this._to + ')' + oneWay;
    },

    // ..........................................................
    // CONNECT AND SYNC
    //

    /**
      Attempts to connect this binding instance so that it can receive and relay
      changes. This method will raise an exception if you have not set the
      from/to properties yet.
       @method connect
      @param {Object} obj The root object for this binding.
      @return {Ember.Binding} `this`
      @public
    */
    connect: function (obj) {
      _emberMetalDebug.assert('Must pass a valid object to Ember.Binding.connect()', !!obj);

      var fromObj = undefined,
          fromPath = undefined,
          possibleGlobal = undefined;

      // If the binding's "from" path could be interpreted as a global, verify
      // whether the path refers to a global or not by consulting `Ember.lookup`.
      if (_emberMetalPath_cache.isGlobalPath(this._from)) {
        var _name = _emberMetalPath_cache.getFirstKey(this._from);
        possibleGlobal = _emberEnvironment.context.lookup[_name];

        if (possibleGlobal) {
          fromObj = possibleGlobal;
          fromPath = _emberMetalPath_cache.getTailPath(this._from);
        }
      }

      if (fromObj === undefined) {
        fromObj = obj;
        fromPath = this._from;
      }

      _emberMetalProperty_set.trySet(obj, this._to, _emberMetalProperty_get.get(fromObj, fromPath));

      // Add an observer on the object to be notified when the binding should be updated.
      _emberMetalObserver.addObserver(fromObj, fromPath, this, 'fromDidChange');

      // If the binding is a two-way binding, also set up an observer on the target.
      if (!this._oneWay) {
        _emberMetalObserver.addObserver(obj, this._to, this, 'toDidChange');
      }

      _emberMetalEvents.addListener(obj, 'willDestroy', this, 'disconnect');

      fireDeprecations(obj, this._to, this._from, possibleGlobal, this._oneWay, !possibleGlobal && !this._oneWay);

      this._readyToSync = true;
      this._fromObj = fromObj;
      this._fromPath = fromPath;
      this._toObj = obj;

      return this;
    },

    /**
      Disconnects the binding instance. Changes will no longer be relayed. You
      will not usually need to call this method.
       @method disconnect
      @return {Ember.Binding} `this`
      @public
    */
    disconnect: function () {
      _emberMetalDebug.assert('Must pass a valid object to Ember.Binding.disconnect()', !!this._toObj);

      // Remove an observer on the object so we're no longer notified of
      // changes that should update bindings.
      _emberMetalObserver.removeObserver(this._fromObj, this._fromPath, this, 'fromDidChange');

      // If the binding is two-way, remove the observer from the target as well.
      if (!this._oneWay) {
        _emberMetalObserver.removeObserver(this._toObj, this._to, this, 'toDidChange');
      }

      this._readyToSync = false; // Disable scheduled syncs...
      return this;
    },

    // ..........................................................
    // PRIVATE
    //

    /* Called when the from side changes. */
    fromDidChange: function (target) {
      this._scheduleSync('fwd');
    },

    /* Called when the to side changes. */
    toDidChange: function (target) {
      this._scheduleSync('back');
    },

    _scheduleSync: function (dir) {
      var existingDir = this._direction;

      // If we haven't scheduled the binding yet, schedule it.
      if (existingDir === undefined) {
        _emberMetalRun_loop.default.schedule('sync', this, '_sync');
        this._direction = dir;
      }

      // If both a 'back' and 'fwd' sync have been scheduled on the same object,
      // default to a 'fwd' sync so that it remains deterministic.
      if (existingDir === 'back' && dir === 'fwd') {
        this._direction = 'fwd';
      }
    },

    _sync: function () {
      var log = _emberEnvironment.ENV.LOG_BINDINGS;

      var toObj = this._toObj;

      // Don't synchronize destroyed objects or disconnected bindings.
      if (toObj.isDestroyed || !this._readyToSync) {
        return;
      }

      // Get the direction of the binding for the object we are
      // synchronizing from.
      var direction = this._direction;

      var fromObj = this._fromObj;
      var fromPath = this._fromPath;

      this._direction = undefined;

      // If we're synchronizing from the remote object...
      if (direction === 'fwd') {
        var fromValue = _emberMetalProperty_get.get(fromObj, fromPath);
        if (log) {
          _emberConsole.default.log(' ', this.toString(), '->', fromValue, fromObj);
        }
        if (this._oneWay) {
          _emberMetalProperty_set.trySet(toObj, this._to, fromValue);
        } else {
          _emberMetalObserver._suspendObserver(toObj, this._to, this, 'toDidChange', function () {
            _emberMetalProperty_set.trySet(toObj, this._to, fromValue);
          });
        }
        // If we're synchronizing *to* the remote object.
      } else if (direction === 'back') {
          var toValue = _emberMetalProperty_get.get(toObj, this._to);
          if (log) {
            _emberConsole.default.log(' ', this.toString(), '<-', toValue, toObj);
          }
          _emberMetalObserver._suspendObserver(fromObj, fromPath, this, 'fromDidChange', function () {
            _emberMetalProperty_set.trySet(fromObj, fromPath, toValue);
          });
        }
    }

  };

  function fireDeprecations(obj, toPath, fromPath, deprecateGlobal, deprecateOneWay, deprecateAlias) {
    var deprecateGlobalMessage = '`Ember.Binding` is deprecated. Since you' + ' are binding to a global consider using a service instead.';
    var deprecateOneWayMessage = '`Ember.Binding` is deprecated. Since you' + ' are using a `oneWay` binding consider using a `readOnly` computed' + ' property instead.';
    var deprecateAliasMessage = '`Ember.Binding` is deprecated. Consider' + ' using an `alias` computed property instead.';

    var objectInfo = 'The `' + toPath + '` property of `' + obj + '` is an `Ember.Binding` connected to `' + fromPath + '`, but ';
    _emberMetalDebug.deprecate(objectInfo + deprecateGlobalMessage, !deprecateGlobal, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
    _emberMetalDebug.deprecate(objectInfo + deprecateOneWayMessage, !deprecateOneWay, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
    _emberMetalDebug.deprecate(objectInfo + deprecateAliasMessage, !deprecateAlias, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
  }

  function mixinProperties(to, from) {
    for (var key in from) {
      if (from.hasOwnProperty(key)) {
        to[key] = from[key];
      }
    }
  }

  mixinProperties(Binding, {

    /*
      See `Ember.Binding.from`.
       @method from
      @static
    */
    from: function (from) {
      var C = this;
      return new C(undefined, from);
    },

    /*
      See `Ember.Binding.to`.
       @method to
      @static
    */
    to: function (to) {
      var C = this;
      return new C(to, undefined);
    }
  });
  /**
    An `Ember.Binding` connects the properties of two objects so that whenever
    the value of one property changes, the other property will be changed also.
  
    ## Automatic Creation of Bindings with `/^*Binding/`-named Properties.
  
    You do not usually create Binding objects directly but instead describe
    bindings in your class or object definition using automatic binding
    detection.
  
    Properties ending in a `Binding` suffix will be converted to `Ember.Binding`
    instances. The value of this property should be a string representing a path
    to another object or a custom binding instance created using Binding helpers
    (see "One Way Bindings"):
  
    ```
    valueBinding: "MyApp.someController.title"
    ```
  
    This will create a binding from `MyApp.someController.title` to the `value`
    property of your object instance automatically. Now the two values will be
    kept in sync.
  
    ## One Way Bindings
  
    One especially useful binding customization you can use is the `oneWay()`
    helper. This helper tells Ember that you are only interested in
    receiving changes on the object you are binding from. For example, if you
    are binding to a preference and you want to be notified if the preference
    has changed, but your object will not be changing the preference itself, you
    could do:
  
    ```
    bigTitlesBinding: Ember.Binding.oneWay("MyApp.preferencesController.bigTitles")
    ```
  
    This way if the value of `MyApp.preferencesController.bigTitles` changes the
    `bigTitles` property of your object will change also. However, if you
    change the value of your `bigTitles` property, it will not update the
    `preferencesController`.
  
    One way bindings are almost twice as fast to setup and twice as fast to
    execute because the binding only has to worry about changes to one side.
  
    You should consider using one way bindings anytime you have an object that
    may be created frequently and you do not intend to change a property; only
    to monitor it for changes (such as in the example above).
  
    ## Adding Bindings Manually
  
    All of the examples above show you how to configure a custom binding, but the
    result of these customizations will be a binding template, not a fully active
    Binding instance. The binding will actually become active only when you
    instantiate the object the binding belongs to. It is useful, however, to
    understand what actually happens when the binding is activated.
  
    For a binding to function it must have at least a `from` property and a `to`
    property. The `from` property path points to the object/key that you want to
    bind from while the `to` path points to the object/key you want to bind to.
  
    When you define a custom binding, you are usually describing the property
    you want to bind from (such as `MyApp.someController.value` in the examples
    above). When your object is created, it will automatically assign the value
    you want to bind `to` based on the name of your binding key. In the
    examples above, during init, Ember objects will effectively call
    something like this on your binding:
  
    ```javascript
    binding = Ember.Binding.from("valueBinding").to("value");
    ```
  
    This creates a new binding instance based on the template you provide, and
    sets the to path to the `value` property of the new object. Now that the
    binding is fully configured with a `from` and a `to`, it simply needs to be
    connected to become active. This is done through the `connect()` method:
  
    ```javascript
    binding.connect(this);
    ```
  
    Note that when you connect a binding you pass the object you want it to be
    connected to. This object will be used as the root for both the from and
    to side of the binding when inspecting relative paths. This allows the
    binding to be automatically inherited by subclassed objects as well.
  
    This also allows you to bind between objects using the paths you declare in
    `from` and `to`:
  
    ```javascript
    // Example 1
    binding = Ember.Binding.from("App.someObject.value").to("value");
    binding.connect(this);
  
    // Example 2
    binding = Ember.Binding.from("parentView.value").to("App.someObject.value");
    binding.connect(this);
    ```
  
    Now that the binding is connected, it will observe both the from and to side
    and relay changes.
  
    If you ever needed to do so (you almost never will, but it is useful to
    understand this anyway), you could manually create an active binding by
    using the `Ember.bind()` helper method. (This is the same method used by
    to setup your bindings on objects):
  
    ```javascript
    Ember.bind(MyApp.anotherObject, "value", "MyApp.someController.value");
    ```
  
    Both of these code fragments have the same effect as doing the most friendly
    form of binding creation like so:
  
    ```javascript
    MyApp.anotherObject = Ember.Object.create({
      valueBinding: "MyApp.someController.value",
  
      // OTHER CODE FOR THIS OBJECT...
    });
    ```
  
    Ember's built in binding creation method makes it easy to automatically
    create bindings for you. You should always use the highest-level APIs
    available, even if you understand how it works underneath.
  
    @class Binding
    @namespace Ember
    @since Ember 0.9
    @public
  */
  // Ember.Binding = Binding; ES6TODO: where to put this?

  /**
    Global helper method to create a new binding. Just pass the root object
    along with a `to` and `from` path to create and connect the binding.
  
    @method bind
    @for Ember
    @param {Object} obj The root object of the transform.
    @param {String} to The path to the 'to' side of the binding.
      Must be relative to obj.
    @param {String} from The path to the 'from' side of the binding.
      Must be relative to obj or a global path.
    @return {Ember.Binding} binding instance
    @public
  */

  function bind(obj, to, from) {
    return new Binding(to, from).connect(obj);
  }

  exports.Binding = Binding;
});
enifed('ember-metal/cache', ['exports', 'ember-utils', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalMeta) {
  'use strict';

  var Cache = (function () {
    function Cache(limit, func, key, store) {
      this.size = 0;
      this.misses = 0;
      this.hits = 0;
      this.limit = limit;
      this.func = func;
      this.key = key;
      this.store = store || new DefaultStore();
    }

    Cache.prototype.get = function get(obj) {
      var key = this.key === undefined ? obj : this.key(obj);
      var value = this.store.get(key);
      if (value === undefined) {
        this.misses++;
        value = this._set(key, this.func(obj));
      } else if (value === _emberMetalMeta.UNDEFINED) {
        this.hits++;
        value = undefined;
      } else {
        this.hits++;
        // nothing to translate
      }

      return value;
    };

    Cache.prototype.set = function set(obj, value) {
      var key = this.key === undefined ? obj : this.key(obj);
      return this._set(key, value);
    };

    Cache.prototype._set = function _set(key, value) {
      if (this.limit > this.size) {
        this.size++;
        if (value === undefined) {
          this.store.set(key, _emberMetalMeta.UNDEFINED);
        } else {
          this.store.set(key, value);
        }
      }

      return value;
    };

    Cache.prototype.purge = function purge() {
      this.store.clear();
      this.size = 0;
      this.hits = 0;
      this.misses = 0;
    };

    return Cache;
  })();

  exports.default = Cache;

  var DefaultStore = (function () {
    function DefaultStore() {
      this.data = new _emberUtils.EmptyObject();
    }

    DefaultStore.prototype.get = function get(key) {
      return this.data[key];
    };

    DefaultStore.prototype.set = function set(key, value) {
      this.data[key] = value;
    };

    DefaultStore.prototype.clear = function clear() {
      this.data = new _emberUtils.EmptyObject();
    };

    return DefaultStore;
  })();
});
enifed('ember-metal/chains', ['exports', 'ember-utils', 'ember-metal/property_get', 'ember-metal/meta', 'ember-metal/watch_key', 'ember-metal/watch_path'], function (exports, _emberUtils, _emberMetalProperty_get, _emberMetalMeta, _emberMetalWatch_key, _emberMetalWatch_path) {
  'use strict';

  exports.finishChains = finishChains;

  var FIRST_KEY = /^([^\.]+)/;

  function firstKey(path) {
    return path.match(FIRST_KEY)[0];
  }

  function isObject(obj) {
    return typeof obj === 'object' && obj;
  }

  function isVolatile(obj) {
    return !(isObject(obj) && obj.isDescriptor && obj._volatile === false);
  }

  function ChainWatchers() {
    // chain nodes that reference a key in this obj by key
    // we only create ChainWatchers when we are going to add them
    // so create this upfront
    this.chains = new _emberUtils.EmptyObject();
  }

  ChainWatchers.prototype = {
    add: function (key, node) {
      var nodes = this.chains[key];
      if (nodes === undefined) {
        this.chains[key] = [node];
      } else {
        nodes.push(node);
      }
    },

    remove: function (key, node) {
      var nodes = this.chains[key];
      if (nodes) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] === node) {
            nodes.splice(i, 1);
            break;
          }
        }
      }
    },

    has: function (key, node) {
      var nodes = this.chains[key];
      if (nodes) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] === node) {
            return true;
          }
        }
      }
      return false;
    },

    revalidateAll: function () {
      for (var key in this.chains) {
        this.notify(key, true, undefined);
      }
    },

    revalidate: function (key) {
      this.notify(key, true, undefined);
    },

    // key: the string key that is part of a path changed
    // revalidate: boolean; the chains that are watching this value should revalidate
    // callback: function that will be called with the object and path that
    //           will be/are invalidated by this key change, depending on
    //           whether the revalidate flag is passed
    notify: function (key, revalidate, callback) {
      var nodes = this.chains[key];
      if (nodes === undefined || nodes.length === 0) {
        return;
      }

      var affected = undefined;

      if (callback) {
        affected = [];
      }

      for (var i = 0; i < nodes.length; i++) {
        nodes[i].notify(revalidate, affected);
      }

      if (callback === undefined) {
        return;
      }

      // we gather callbacks so we don't notify them during revalidation
      for (var i = 0; i < affected.length; i += 2) {
        var obj = affected[i];
        var path = affected[i + 1];
        callback(obj, path);
      }
    }
  };

  function makeChainWatcher() {
    return new ChainWatchers();
  }

  function addChainWatcher(obj, keyName, node) {
    var m = _emberMetalMeta.meta(obj);
    m.writableChainWatchers(makeChainWatcher).add(keyName, node);
    _emberMetalWatch_key.watchKey(obj, keyName, m);
  }

  function removeChainWatcher(obj, keyName, node, _meta) {
    if (!isObject(obj)) {
      return;
    }

    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (!meta || !meta.readableChainWatchers()) {
      return;
    }

    // make meta writable
    meta = _emberMetalMeta.meta(obj);

    meta.readableChainWatchers().remove(keyName, node);

    _emberMetalWatch_key.unwatchKey(obj, keyName, meta);
  }

  // A ChainNode watches a single key on an object. If you provide a starting
  // value for the key then the node won't actually watch it. For a root node
  // pass null for parent and key and object for value.
  function ChainNode(parent, key, value) {
    this._parent = parent;
    this._key = key;

    // _watching is true when calling get(this._parent, this._key) will
    // return the value of this node.
    //
    // It is false for the root of a chain (because we have no parent)
    // and for global paths (because the parent node is the object with
    // the observer on it)
    this._watching = value === undefined;

    this._chains = undefined;
    this._object = undefined;
    this.count = 0;

    this._value = value;
    this._paths = {};
    if (this._watching) {
      var obj = parent.value();

      if (!isObject(obj)) {
        return;
      }

      this._object = obj;

      addChainWatcher(this._object, this._key, this);
    }
  }

  function lazyGet(obj, key) {
    if (!isObject(obj)) {
      return;
    }

    var meta = _emberMetalMeta.peekMeta(obj);

    // check if object meant only to be a prototype
    if (meta && meta.proto === obj) {
      return;
    }

    // Use `get` if the return value is an EachProxy or an uncacheable value.
    if (isVolatile(obj[key])) {
      return _emberMetalProperty_get.get(obj, key);
      // Otherwise attempt to get the cached value of the computed property
    } else {
        var cache = meta.readableCache();
        if (cache && key in cache) {
          return cache[key];
        }
      }
  }

  ChainNode.prototype = {
    value: function () {
      if (this._value === undefined && this._watching) {
        var obj = this._parent.value();
        this._value = lazyGet(obj, this._key);
      }
      return this._value;
    },

    destroy: function () {
      if (this._watching) {
        var obj = this._object;
        if (obj) {
          removeChainWatcher(obj, this._key, this);
        }
        this._watching = false; // so future calls do nothing
      }
    },

    // copies a top level object only
    copy: function (obj) {
      var ret = new ChainNode(null, null, obj);
      var paths = this._paths;
      var path = undefined;

      for (path in paths) {
        // this check will also catch non-number vals.
        if (paths[path] <= 0) {
          continue;
        }
        ret.add(path);
      }
      return ret;
    },

    // called on the root node of a chain to setup watchers on the specified
    // path.
    add: function (path) {
      var paths = this._paths;
      paths[path] = (paths[path] || 0) + 1;

      var key = firstKey(path);
      var tail = path.slice(key.length + 1);

      this.chain(key, tail);
    },

    // called on the root node of a chain to teardown watcher on the specified
    // path
    remove: function (path) {
      var paths = this._paths;
      if (paths[path] > 0) {
        paths[path]--;
      }

      var key = firstKey(path);
      var tail = path.slice(key.length + 1);

      this.unchain(key, tail);
    },

    chain: function (key, path) {
      var chains = this._chains;
      var node = undefined;
      if (chains === undefined) {
        chains = this._chains = new _emberUtils.EmptyObject();
      } else {
        node = chains[key];
      }

      if (node === undefined) {
        node = chains[key] = new ChainNode(this, key, undefined);
      }

      node.count++; // count chains...

      // chain rest of path if there is one
      if (path) {
        key = firstKey(path);
        path = path.slice(key.length + 1);
        node.chain(key, path);
      }
    },

    unchain: function (key, path) {
      var chains = this._chains;
      var node = chains[key];

      // unchain rest of path first...
      if (path && path.length > 1) {
        var nextKey = firstKey(path);
        var nextPath = path.slice(nextKey.length + 1);
        node.unchain(nextKey, nextPath);
      }

      // delete node if needed.
      node.count--;
      if (node.count <= 0) {
        chains[node._key] = undefined;
        node.destroy();
      }
    },

    notify: function (revalidate, affected) {
      if (revalidate && this._watching) {
        var parentValue = this._parent.value();

        if (parentValue !== this._object) {
          if (this._object) {
            removeChainWatcher(this._object, this._key, this);
          }

          if (isObject(parentValue)) {
            this._object = parentValue;
            addChainWatcher(parentValue, this._key, this);
          } else {
            this._object = undefined;
          }
        }
        this._value = undefined;
      }

      // then notify chains...
      var chains = this._chains;
      var node = undefined;
      if (chains) {
        for (var key in chains) {
          node = chains[key];
          if (node !== undefined) {
            node.notify(revalidate, affected);
          }
        }
      }

      if (affected && this._parent) {
        this._parent.populateAffected(this._key, 1, affected);
      }
    },

    populateAffected: function (path, depth, affected) {
      if (this._key) {
        path = this._key + '.' + path;
      }

      if (this._parent) {
        this._parent.populateAffected(path, depth + 1, affected);
      } else {
        if (depth > 1) {
          affected.push(this.value(), path);
        }
      }
    }
  };

  function finishChains(obj) {
    // We only create meta if we really have to
    var m = _emberMetalMeta.peekMeta(obj);
    if (m) {
      m = _emberMetalMeta.meta(obj);

      // finish any current chains node watchers that reference obj
      var chainWatchers = m.readableChainWatchers();
      if (chainWatchers) {
        chainWatchers.revalidateAll();
      }
      // ensure that if we have inherited any chains they have been
      // copied onto our own meta.
      if (m.readableChains()) {
        m.writableChains(_emberMetalWatch_path.makeChainNode);
      }
    }
  }

  exports.removeChainWatcher = removeChainWatcher;
  exports.ChainNode = ChainNode;
});
enifed('ember-metal/computed', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/property_set', 'ember-metal/meta', 'ember-metal/expand_properties', 'ember-metal/error', 'ember-metal/properties', 'ember-metal/property_events', 'ember-metal/dependent_keys'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalProperty_set, _emberMetalMeta, _emberMetalExpand_properties, _emberMetalError, _emberMetalProperties, _emberMetalProperty_events, _emberMetalDependent_keys) {
  'use strict';

  exports.default = computed;

  /**
  @module ember
  @submodule ember-metal
  */

  var DEEP_EACH_REGEX = /\.@each\.[^.]+\./;

  /**
    A computed property transforms an object literal with object's accessor function(s) into a property.
  
    By default the function backing the computed property will only be called
    once and the result will be cached. You can specify various properties
    that your computed property depends on. This will force the cached
    result to be recomputed if the dependencies are modified.
  
    In the following example we declare a computed property - `fullName` - by calling
    `.Ember.computed()` with property dependencies (`firstName` and `lastName`) as leading arguments and getter accessor function. The `fullName` getter function
    will be called once (regardless of how many times it is accessed) as long
    as its dependencies have not changed. Once `firstName` or `lastName` are updated
    any future calls (or anything bound) to `fullName` will incorporate the new
    values.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', function() {
        let firstName = this.get('firstName'),
            lastName  = this.get('lastName');
  
        return firstName + ' ' + lastName;
      })
    });
  
    let tom = Person.create({
      firstName: 'Tom',
      lastName: 'Dale'
    });
  
    tom.get('fullName') // 'Tom Dale'
    ```
  
    You can also define what Ember should do when setting a computed property by providing additional function (`set`) in hash argument.
    If you try to set a computed property, it will try to invoke setter accessor function with the key and
    value you want to set it to as arguments.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          let firstName = this.get('firstName'),
              lastName  = this.get('lastName');
  
          return firstName + ' ' + lastName;
        },
        set(key, value) {
          let [firstName, lastName] = value.split(' ');
  
          this.set('firstName', firstName);
          this.set('lastName', lastName);
  
          return value;
        }
      })
    });
  
    let person = Person.create();
  
    person.set('fullName', 'Peter Wagenet');
    person.get('firstName'); // 'Peter'
    person.get('lastName');  // 'Wagenet'
    ```
  
    You can overwrite computed property with normal property (no longer computed), that won't change if dependencies change, if you set computed property and it won't have setter accessor function defined.
  
    You can also mark computed property as `.readOnly()` and block all attempts to set it.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          let firstName = this.get('firstName');
          let lastName  = this.get('lastName');
  
          return firstName + ' ' + lastName;
        }
      }).readOnly()
    });
  
    let person = Person.create();
    person.set('fullName', 'Peter Wagenet'); // Uncaught Error: Cannot set read-only property "fullName" on object: <(...):emberXXX>
    ```
  
    Additional resources:
    - [New CP syntax RFC](https://github.com/emberjs/rfcs/blob/master/text/0011-improved-cp-syntax.md)
    - [New computed syntax explained in "Ember 1.12 released" ](http://emberjs.com/blog/2015/05/13/ember-1-12-released.html#toc_new-computed-syntax)
  
    @class ComputedProperty
    @namespace Ember
    @public
  */
  function ComputedProperty(config, opts) {
    this.isDescriptor = true;
    if (typeof config === 'function') {
      this._getter = config;
    } else {
      _emberMetalDebug.assert('Ember.computed expects a function or an object as last argument.', typeof config === 'object' && !Array.isArray(config));
      _emberMetalDebug.assert('Config object passed to an Ember.computed can only contain `get` or `set` keys.', (function () {
        var keys = Object.keys(config);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] !== 'get' && keys[i] !== 'set') {
            return false;
          }
        }
        return true;
      })());
      this._getter = config.get;
      this._setter = config.set;
    }
    _emberMetalDebug.assert('Computed properties must receive a getter or a setter, you passed none.', !!this._getter || !!this._setter);
    this._dependentKeys = undefined;
    this._suspended = undefined;
    this._meta = undefined;
    this._volatile = false;
    this._dependentKeys = opts && opts.dependentKeys;
    this._readOnly = false;
  }

  ComputedProperty.prototype = new _emberMetalProperties.Descriptor();
  ComputedProperty.prototype.constructor = ComputedProperty;

  var ComputedPropertyPrototype = ComputedProperty.prototype;

  /**
    Call on a computed property to set it into non-cached mode. When in this
    mode the computed property will not automatically cache the return value.
  
    It also does not automatically fire any change events. You must manually notify
    any changes if you want to observe this property.
  
    Dependency keys have no effect on volatile properties as they are for cache
    invalidation and notification when cached value is invalidated.
  
    ```javascript
    let outsideService = Ember.Object.extend({
      value: Ember.computed(function() {
        return OutsideService.getValue();
      }).volatile()
    }).create();
    ```
  
    @method volatile
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.volatile = function () {
    this._volatile = true;
    return this;
  };

  /**
    Call on a computed property to set it into read-only mode. When in this
    mode the computed property will throw an error when set.
  
    ```javascript
    let Person = Ember.Object.extend({
      guid: Ember.computed(function() {
        return 'guid-guid-guid';
      }).readOnly()
    });
  
    let person = Person.create();
  
    person.set('guid', 'new-guid'); // will throw an exception
    ```
  
    @method readOnly
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.readOnly = function () {
    this._readOnly = true;
    _emberMetalDebug.assert('Computed properties that define a setter using the new syntax cannot be read-only', !(this._readOnly && this._setter && this._setter !== this._getter));
    return this;
  };

  /**
    Sets the dependent keys on this computed property. Pass any number of
    arguments containing key paths that this computed property depends on.
  
    ```javascript
    let President = Ember.Object.extend({
      fullName: Ember.computed(function() {
        return this.get('firstName') + ' ' + this.get('lastName');
  
        // Tell Ember that this computed property depends on firstName
        // and lastName
      }).property('firstName', 'lastName')
    });
  
    let president = President.create({
      firstName: 'Barack',
      lastName: 'Obama'
    });
  
    president.get('fullName'); // 'Barack Obama'
    ```
  
    @method property
    @param {String} path* zero or more property paths
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.property = function () {
    var args = [];

    function addArg(property) {
      _emberMetalDebug.warn('Dependent keys containing @each only work one level deep. ' + ('You used the key "' + property + '" which is invalid. ') + 'Please create an intermediary computed property.', DEEP_EACH_REGEX.test(property) === false, { id: 'ember-metal.computed-deep-each' });
      args.push(property);
    }

    for (var i = 0; i < arguments.length; i++) {
      _emberMetalExpand_properties.default(arguments[i], addArg);
    }

    this._dependentKeys = args;
    return this;
  };

  /**
    In some cases, you may want to annotate computed properties with additional
    metadata about how they function or what values they operate on. For example,
    computed property functions may close over variables that are then no longer
    available for introspection.
  
    You can pass a hash of these values to a computed property like this:
  
    ```
    person: Ember.computed(function() {
      let personId = this.get('personId');
      return App.Person.create({ id: personId });
    }).meta({ type: App.Person })
    ```
  
    The hash that you pass to the `meta()` function will be saved on the
    computed property descriptor under the `_meta` key. Ember runtime
    exposes a public API for retrieving these values from classes,
    via the `metaForProperty()` function.
  
    @method meta
    @param {Object} meta
    @chainable
    @public
  */
  ComputedPropertyPrototype.meta = function (meta) {
    if (arguments.length === 0) {
      return this._meta || {};
    } else {
      this._meta = meta;
      return this;
    }
  };

  // invalidate cache when CP key changes
  ComputedPropertyPrototype.didChange = function (obj, keyName) {
    // _suspended is set via a CP.set to ensure we don't clear
    // the cached value set by the setter
    if (this._volatile || this._suspended === obj) {
      return;
    }

    // don't create objects just to invalidate
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta || meta.source !== obj) {
      return;
    }

    var cache = meta.readableCache();
    if (cache && cache[keyName] !== undefined) {
      cache[keyName] = undefined;
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
    }
  };

  ComputedPropertyPrototype.get = function (obj, keyName) {
    if (this._volatile) {
      return this._getter.call(obj, keyName);
    }

    var meta = _emberMetalMeta.meta(obj);
    var cache = meta.writableCache();

    var result = cache[keyName];
    if (result === _emberMetalMeta.UNDEFINED) {
      return undefined;
    } else if (result !== undefined) {
      return result;
    }

    var ret = this._getter.call(obj, keyName);
    if (ret === undefined) {
      cache[keyName] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[keyName] = ret;
    }

    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.revalidate(keyName);
    }
    _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);

    return ret;
  };

  ComputedPropertyPrototype.set = function computedPropertySetEntry(obj, keyName, value) {
    if (this._readOnly) {
      this._throwReadOnlyError(obj, keyName);
    }

    if (!this._setter) {
      return this.clobberSet(obj, keyName, value);
    }

    if (this._volatile) {
      return this.volatileSet(obj, keyName, value);
    }

    return this.setWithSuspend(obj, keyName, value);
  };

  ComputedPropertyPrototype._throwReadOnlyError = function computedPropertyThrowReadOnlyError(obj, keyName) {
    throw new _emberMetalError.default('Cannot set read-only property "' + keyName + '" on object: ' + _emberUtils.inspect(obj));
  };

  ComputedPropertyPrototype.clobberSet = function computedPropertyClobberSet(obj, keyName, value) {
    var cachedValue = cacheFor(obj, keyName);
    _emberMetalProperties.defineProperty(obj, keyName, null, cachedValue);
    _emberMetalProperty_set.set(obj, keyName, value);
    return value;
  };

  ComputedPropertyPrototype.volatileSet = function computedPropertyVolatileSet(obj, keyName, value) {
    return this._setter.call(obj, keyName, value);
  };

  ComputedPropertyPrototype.setWithSuspend = function computedPropertySetWithSuspend(obj, keyName, value) {
    var oldSuspended = this._suspended;
    this._suspended = obj;
    try {
      return this._set(obj, keyName, value);
    } finally {
      this._suspended = oldSuspended;
    }
  };

  ComputedPropertyPrototype._set = function computedPropertySet(obj, keyName, value) {
    // cache requires own meta
    var meta = _emberMetalMeta.meta(obj);
    // either there is a writable cache or we need one to update
    var cache = meta.writableCache();
    var hadCachedValue = false;
    var cachedValue = undefined;
    if (cache[keyName] !== undefined) {
      if (cache[keyName] !== _emberMetalMeta.UNDEFINED) {
        cachedValue = cache[keyName];
      }
      hadCachedValue = true;
    }

    var ret = this._setter.call(obj, keyName, value, cachedValue);

    // allows setter to return the same value that is cached already
    if (hadCachedValue && cachedValue === ret) {
      return ret;
    }

    _emberMetalProperty_events.propertyWillChange(obj, keyName);

    if (hadCachedValue) {
      cache[keyName] = undefined;
    }

    if (!hadCachedValue) {
      _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
    }

    if (ret === undefined) {
      cache[keyName] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[keyName] = ret;
    }

    _emberMetalProperty_events.propertyDidChange(obj, keyName);

    return ret;
  };

  /* called before property is overridden */
  ComputedPropertyPrototype.teardown = function (obj, keyName) {
    if (this._volatile) {
      return;
    }
    var meta = _emberMetalMeta.meta(obj);
    var cache = meta.readableCache();
    if (cache && cache[keyName] !== undefined) {
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
      cache[keyName] = undefined;
    }
  };

  /**
    This helper returns a new property descriptor that wraps the passed
    computed property function. You can use this helper to define properties
    with mixins or via `Ember.defineProperty()`.
  
    If you pass a function as an argument, it will be used as a getter. A computed
    property defined in this way might look like this:
  
    ```js
    let Person = Ember.Object.extend({
      init() {
        this._super(...arguments);
  
        this.firstName = 'Betty';
        this.lastName = 'Jones';
      },
  
      fullName: Ember.computed('firstName', 'lastName', function() {
        return `${this.get('firstName')} ${this.get('lastName')}`;
      })
    });
  
    let client = Person.create();
  
    client.get('fullName'); // 'Betty Jones'
  
    client.set('lastName', 'Fuller');
    client.get('fullName'); // 'Betty Fuller'
    ```
  
    You can pass a hash with two functions, `get` and `set`, as an
    argument to provide both a getter and setter:
  
    ```js
    let Person = Ember.Object.extend({
      init() {
        this._super(...arguments);
  
        this.firstName = 'Betty';
        this.lastName = 'Jones';
      },
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          return `${this.get('firstName')} ${this.get('lastName')}`;
        },
        set(key, value) {
          let [firstName, lastName] = value.split(/\s+/);
          this.setProperties({ firstName, lastName });
          return value;
        }
      });
    })
  
    let client = Person.create();
    client.get('firstName'); // 'Betty'
  
    client.set('fullName', 'Carroll Fuller');
    client.get('firstName'); // 'Carroll'
    ```
  
    The `set` function should accept two parameters, `key` and `value`. The value
    returned from `set` will be the new value of the property.
  
    _Note: This is the preferred way to define computed properties when writing third-party
    libraries that depend on or use Ember, since there is no guarantee that the user
    will have [prototype Extensions](http://emberjs.com/guides/configuring-ember/disabling-prototype-extensions/) enabled._
  
    The alternative syntax, with prototype extensions, might look like:
  
    ```js
    fullName: function() {
      return this.get('firstName') + ' ' + this.get('lastName');
    }.property('firstName', 'lastName')
    ```
  
    @class computed
    @namespace Ember
    @constructor
    @static
    @param {String} [dependentKeys*] Optional dependent keys that trigger this computed property.
    @param {Function} func The computed property function.
    @return {Ember.ComputedProperty} property descriptor instance
    @public
  */

  function computed(func) {
    var args = undefined;

    if (arguments.length > 1) {
      args = [].slice.call(arguments);
      func = args.pop();
    }

    var cp = new ComputedProperty(func);

    if (args) {
      cp.property.apply(cp, args);
    }

    return cp;
  }

  /**
    Returns the cached value for a property, if one exists.
    This can be useful for peeking at the value of a computed
    property that is generated lazily, without accidentally causing
    it to be created.
  
    @method cacheFor
    @for Ember
    @param {Object} obj the object whose property you want to check
    @param {String} key the name of the property whose cached value you want
      to return
    @return {Object} the cached value
    @public
  */
  function cacheFor(obj, key) {
    var meta = _emberMetalMeta.peekMeta(obj);
    var cache = meta && meta.source === obj && meta.readableCache();
    var ret = cache && cache[key];

    if (ret === _emberMetalMeta.UNDEFINED) {
      return undefined;
    }
    return ret;
  }

  cacheFor.set = function (cache, key, value) {
    if (value === undefined) {
      cache[key] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[key] = value;
    }
  };

  cacheFor.get = function (cache, key) {
    var ret = cache[key];
    if (ret === _emberMetalMeta.UNDEFINED) {
      return undefined;
    }
    return ret;
  };

  cacheFor.remove = function (cache, key) {
    cache[key] = undefined;
  };

  exports.ComputedProperty = ComputedProperty;
  exports.computed = computed;
  exports.cacheFor = cacheFor;
});
enifed('ember-metal/core', ['exports', 'ember-environment'], function (exports, _emberEnvironment) {
  'use strict';

  /**
  @module ember
  @submodule ember-metal
  */

  /**
    This namespace contains all Ember methods and functions. Future versions of
    Ember may overwrite this namespace and therefore, you should avoid adding any
    new properties.
  
    At the heart of Ember is Ember-Runtime, a set of core functions that provide
    cross-platform compatibility and object property observing.  Ember-Runtime is
    small and performance-focused so you can use it alongside other
    cross-platform libraries such as jQuery. For more details, see
    [Ember-Runtime](http://emberjs.com/api/modules/ember-runtime.html).
  
    @class Ember
    @static
    @public
  */
  var Ember = typeof _emberEnvironment.context.imports.Ember === 'object' && _emberEnvironment.context.imports.Ember || {};

  // Make sure these are set whether Ember was already defined or not
  Ember.isNamespace = true;
  Ember.toString = function () {
    return 'Ember';
  };

  // ..........................................................
  // BOOTSTRAP
  //

  exports.default = Ember;
});
enifed("ember-metal/debug", ["exports"], function (exports) {
  "use strict";

  exports.getDebugFunction = getDebugFunction;
  exports.setDebugFunction = setDebugFunction;
  exports.assert = assert;
  exports.info = info;
  exports.warn = warn;
  exports.debug = debug;
  exports.deprecate = deprecate;
  exports.deprecateFunc = deprecateFunc;
  exports.runInDebug = runInDebug;
  exports.debugSeal = debugSeal;
  exports.debugFreeze = debugFreeze;
  var debugFunctions = {
    assert: function () {},
    info: function () {},
    warn: function () {},
    debug: function () {},
    deprecate: function () {},
    deprecateFunc: function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return args[args.length - 1];
    },
    runInDebug: function () {},
    debugSeal: function () {},
    debugFreeze: function () {}
  };

  exports.debugFunctions = debugFunctions;

  function getDebugFunction(name) {
    return debugFunctions[name];
  }

  function setDebugFunction(name, fn) {
    debugFunctions[name] = fn;
  }

  function assert() {
    return debugFunctions.assert.apply(undefined, arguments);
  }

  function info() {
    return debugFunctions.info.apply(undefined, arguments);
  }

  function warn() {
    return debugFunctions.warn.apply(undefined, arguments);
  }

  function debug() {
    return debugFunctions.debug.apply(undefined, arguments);
  }

  function deprecate() {
    return debugFunctions.deprecate.apply(undefined, arguments);
  }

  function deprecateFunc() {
    return debugFunctions.deprecateFunc.apply(undefined, arguments);
  }

  function runInDebug() {
    return debugFunctions.runInDebug.apply(undefined, arguments);
  }

  function debugSeal() {
    return debugFunctions.debugSeal.apply(undefined, arguments);
  }

  function debugFreeze() {
    return debugFunctions.debugFreeze.apply(undefined, arguments);
  }
});
enifed('ember-metal/dependent_keys', ['exports', 'ember-metal/watching'], function (exports, _emberMetalWatching) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  exports.addDependentKeys = addDependentKeys;
  exports.removeDependentKeys = removeDependentKeys;

  /**
  @module ember
  @submodule ember-metal
  */

  // ..........................................................
  // DEPENDENT KEYS
  //

  function addDependentKeys(desc, obj, keyName, meta) {
    // the descriptor has a list of dependent keys, so
    // add all of its dependent keys.
    var idx = undefined,
        depKey = undefined;
    var depKeys = desc._dependentKeys;
    if (!depKeys) {
      return;
    }

    for (idx = 0; idx < depKeys.length; idx++) {
      depKey = depKeys[idx];
      // Increment the number of times depKey depends on keyName.
      meta.writeDeps(depKey, keyName, (meta.peekDeps(depKey, keyName) || 0) + 1);
      // Watch the depKey
      _emberMetalWatching.watch(obj, depKey, meta);
    }
  }

  function removeDependentKeys(desc, obj, keyName, meta) {
    // the descriptor has a list of dependent keys, so
    // remove all of its dependent keys.
    var depKeys = desc._dependentKeys;
    if (!depKeys) {
      return;
    }

    for (var idx = 0; idx < depKeys.length; idx++) {
      var depKey = depKeys[idx];
      // Decrement the number of times depKey depends on keyName.
      meta.writeDeps(depKey, keyName, (meta.peekDeps(depKey, keyName) || 0) - 1);
      // Unwatch the depKey
      _emberMetalWatching.unwatch(obj, depKey, meta);
    }
  }
});
enifed('ember-metal/deprecate_property', ['exports', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set'], function (exports, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set) {
  /**
  @module ember
  @submodule ember-metal
  */

  'use strict';

  exports.deprecateProperty = deprecateProperty;

  /**
    Used internally to allow changing properties in a backwards compatible way, and print a helpful
    deprecation warning.
  
    @method deprecateProperty
    @param {Object} object The object to add the deprecated property to.
    @param {String} deprecatedKey The property to add (and print deprecation warnings upon accessing).
    @param {String} newKey The property that will be aliased.
    @private
    @since 1.7.0
  */

  function deprecateProperty(object, deprecatedKey, newKey, options) {
    function _deprecate() {
      _emberMetalDebug.deprecate('Usage of `' + deprecatedKey + '` is deprecated, use `' + newKey + '` instead.', false, options);
    }

    Object.defineProperty(object, deprecatedKey, {
      configurable: true,
      enumerable: false,
      set: function (value) {
        _deprecate();
        _emberMetalProperty_set.set(this, newKey, value);
      },
      get: function () {
        _deprecate();
        return _emberMetalProperty_get.get(this, newKey);
      }
    });
  }
});
enifed('ember-metal/descriptor', ['exports', 'ember-metal/properties'], function (exports, _emberMetalProperties) {
  'use strict';

  exports.default = descriptor;

  function descriptor(desc) {
    return new Descriptor(desc);
  }

  /**
    A wrapper for a native ES5 descriptor. In an ideal world, we wouldn't need
    this at all, however, the way we currently flatten/merge our mixins require
    a special value to denote a descriptor.
  
    @class Descriptor
    @private
  */

  var Descriptor = (function (_EmberDescriptor) {
    babelHelpers.inherits(Descriptor, _EmberDescriptor);

    function Descriptor(desc) {
      _EmberDescriptor.call(this);
      this.desc = desc;
    }

    Descriptor.prototype.setup = function setup(obj, key) {
      Object.defineProperty(obj, key, this.desc);
    };

    Descriptor.prototype.teardown = function teardown(obj, key) {};

    return Descriptor;
  })(_emberMetalProperties.Descriptor);
});
enifed("ember-metal/error", ["exports"], function (exports) {

  /**
    A subclass of the JavaScript Error object for use in Ember.
  
    @class Error
    @namespace Ember
    @extends Error
    @constructor
    @public
  */
  "use strict";

  exports.default = EmberError;

  function EmberError(message) {
    if (!(this instanceof EmberError)) {
      return new EmberError(message);
    }

    var error = Error.call(this, message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EmberError);
    } else {
      this.stack = error.stack;
    }

    this.description = error.description;
    this.fileName = error.fileName;
    this.lineNumber = error.lineNumber;
    this.message = error.message;
    this.name = error.name;
    this.number = error.number;
    this.code = error.code;
  }

  EmberError.prototype = Object.create(Error.prototype);
});
enifed('ember-metal/error_handler', ['exports', 'ember-console', 'ember-metal/testing'], function (exports, _emberConsole, _emberMetalTesting) {
  'use strict';

  exports.getOnerror = getOnerror;
  exports.setOnerror = setOnerror;
  exports.dispatchError = dispatchError;
  exports.setDispatchOverride = setDispatchOverride;

  // To maintain stacktrace consistency across browsers
  var getStack = function (error) {
    var stack = error.stack;
    var message = error.message;

    if (stack && stack.indexOf(message) === -1) {
      stack = message + '\n' + stack;
    }

    return stack;
  };

  var onerror = undefined;
  // Ember.onerror getter

  function getOnerror() {
    return onerror;
  }

  // Ember.onerror setter

  function setOnerror(handler) {
    onerror = handler;
  }

  var dispatchOverride = undefined;
  // dispatch error

  function dispatchError(error) {
    if (dispatchOverride) {
      dispatchOverride(error);
    } else {
      defaultDispatch(error);
    }
  }

  // allows testing adapter to override dispatch

  function setDispatchOverride(handler) {
    dispatchOverride = handler;
  }

  function defaultDispatch(error) {
    if (_emberMetalTesting.isTesting()) {
      throw error;
    }
    if (onerror) {
      onerror(error);
    } else {
      _emberConsole.default.error(getStack(error));
    }
  }
});
enifed('ember-metal/events', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/meta', 'ember-metal/meta_listeners'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalMeta, _emberMetalMeta_listeners) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  /**
  @module ember
  @submodule ember-metal
  */
  exports.accumulateListeners = accumulateListeners;
  exports.addListener = addListener;
  exports.removeListener = removeListener;
  exports.suspendListener = suspendListener;
  exports.suspendListeners = suspendListeners;
  exports.watchedEvents = watchedEvents;
  exports.sendEvent = sendEvent;
  exports.hasListeners = hasListeners;
  exports.listenersFor = listenersFor;
  exports.on = on;

  /*
    The event system uses a series of nested hashes to store listeners on an
    object. When a listener is registered, or when an event arrives, these
    hashes are consulted to determine which target and action pair to invoke.
  
    The hashes are stored in the object's meta hash, and look like this:
  
        // Object's meta hash
        {
          listeners: {       // variable name: `listenerSet`
            "foo:changed": [ // variable name: `actions`
              target, method, flags
            ]
          }
        }
  
  */

  function indexOf(array, target, method) {
    var index = -1;
    // hashes are added to the end of the event array
    // so it makes sense to start searching at the end
    // of the array and search in reverse
    for (var i = array.length - 3; i >= 0; i -= 3) {
      if (target === array[i] && method === array[i + 1]) {
        index = i;
        break;
      }
    }
    return index;
  }

  function accumulateListeners(obj, eventName, otherActions) {
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta) {
      return;
    }
    var actions = meta.matchingListeners(eventName);
    var newActions = [];

    for (var i = actions.length - 3; i >= 0; i -= 3) {
      var target = actions[i];
      var method = actions[i + 1];
      var flags = actions[i + 2];
      var actionIndex = indexOf(otherActions, target, method);

      if (actionIndex === -1) {
        otherActions.push(target, method, flags);
        newActions.push(target, method, flags);
      }
    }

    return newActions;
  }

  /**
    Add an event listener
  
    @method addListener
    @for Ember
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Boolean} once A flag whether a function should only be called once
    @public
  */

  function addListener(obj, eventName, target, method, once) {
    _emberMetalDebug.assert('You must pass at least an object and event name to Ember.addListener', !!obj && !!eventName);

    _emberMetalDebug.deprecate('didInitAttrs called in ' + (obj && obj.toString && obj.toString()) + '.', eventName !== 'didInitAttrs', {
      id: 'ember-views.did-init-attrs',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-component-didinitattrs'
    });

    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }

    var flags = 0;
    if (once) {
      flags |= _emberMetalMeta_listeners.ONCE;
    }

    _emberMetalMeta.meta(obj).addToListeners(eventName, target, method, flags);

    if ('function' === typeof obj.didAddListener) {
      obj.didAddListener(eventName, target, method);
    }
  }

  /**
    Remove an event listener
  
    Arguments should match those passed to `Ember.addListener`.
  
    @method removeListener
    @for Ember
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @public
  */

  function removeListener(obj, eventName, target, method) {
    _emberMetalDebug.assert('You must pass at least an object and event name to Ember.removeListener', !!obj && !!eventName);

    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }

    _emberMetalMeta.meta(obj).removeFromListeners(eventName, target, method, function () {
      if ('function' === typeof obj.didRemoveListener) {
        obj.didRemoveListener.apply(obj, arguments);
      }
    });
  }

  /**
    Suspend listener during callback.
  
    This should only be used by the target of the event listener
    when it is taking an action that would cause the event, e.g.
    an object might suspend its property change listener while it is
    setting that property.
  
    @method suspendListener
    @for Ember
  
    @private
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Function} callback
  */

  function suspendListener(obj, eventName, target, method, callback) {
    return suspendListeners(obj, [eventName], target, method, callback);
  }

  /**
    Suspends multiple listeners during a callback.
  
    @method suspendListeners
    @for Ember
  
    @private
    @param obj
    @param {Array} eventNames Array of event names
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Function} callback
  */

  function suspendListeners(obj, eventNames, target, method, callback) {
    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }
    return _emberMetalMeta.meta(obj).suspendListeners(eventNames, target, method, callback);
  }

  /**
    Return a list of currently watched events
  
    @private
    @method watchedEvents
    @for Ember
    @param obj
  */

  function watchedEvents(obj) {
    return _emberMetalMeta.meta(obj).watchedEvents();
  }

  /**
    Send an event. The execution of suspended listeners
    is skipped, and once listeners are removed. A listener without
    a target is executed on the passed object. If an array of actions
    is not passed, the actions stored on the passed object are invoked.
  
    @method sendEvent
    @for Ember
    @param obj
    @param {String} eventName
    @param {Array} params Optional parameters for each listener.
    @param {Array} actions Optional array of actions (listeners).
    @return true
    @public
  */

  function sendEvent(obj, eventName, params, actions) {
    if (!actions) {
      var meta = _emberMetalMeta.peekMeta(obj);
      actions = meta && meta.matchingListeners(eventName);
    }

    if (!actions || actions.length === 0) {
      return;
    }

    for (var i = actions.length - 3; i >= 0; i -= 3) {
      // looping in reverse for once listeners
      var target = actions[i];
      var method = actions[i + 1];
      var flags = actions[i + 2];

      if (!method) {
        continue;
      }
      if (flags & _emberMetalMeta_listeners.SUSPENDED) {
        continue;
      }
      if (flags & _emberMetalMeta_listeners.ONCE) {
        removeListener(obj, eventName, target, method);
      }
      if (!target) {
        target = obj;
      }
      if ('string' === typeof method) {
        if (params) {
          _emberUtils.applyStr(target, method, params);
        } else {
          target[method]();
        }
      } else {
        if (params) {
          method.apply(target, params);
        } else {
          method.call(target);
        }
      }
    }
    return true;
  }

  /**
    @private
    @method hasListeners
    @for Ember
    @param obj
    @param {String} eventName
  */

  function hasListeners(obj, eventName) {
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta) {
      return false;
    }
    return meta.matchingListeners(eventName).length > 0;
  }

  /**
    @private
    @method listenersFor
    @for Ember
    @param obj
    @param {String} eventName
  */

  function listenersFor(obj, eventName) {
    var ret = [];
    var meta = _emberMetalMeta.peekMeta(obj);
    var actions = meta && meta.matchingListeners(eventName);

    if (!actions) {
      return ret;
    }

    for (var i = 0; i < actions.length; i += 3) {
      var target = actions[i];
      var method = actions[i + 1];
      ret.push([target, method]);
    }

    return ret;
  }

  /**
    Define a property as a function that should be executed when
    a specified event or events are triggered.
  
  
    ``` javascript
    let Job = Ember.Object.extend({
      logCompleted: Ember.on('completed', function() {
        console.log('Job completed!');
      })
    });
  
    let job = Job.create();
  
    Ember.sendEvent(job, 'completed'); // Logs 'Job completed!'
   ```
  
    @method on
    @for Ember
    @param {String} eventNames*
    @param {Function} func
    @return func
    @public
  */

  function on() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var func = args.pop();
    var events = args;
    func.__ember_listens__ = events;
    return func;
  }
});
enifed('ember-metal/expand_properties', ['exports', 'ember-metal/debug'], function (exports, _emberMetalDebug) {
  'use strict';

  exports.default = expandProperties;

  /**
  @module ember
  @submodule ember-metal
  */

  var SPLIT_REGEX = /\{|\}/;
  var END_WITH_EACH_REGEX = /\.@each$/;

  /**
    Expands `pattern`, invoking `callback` for each expansion.
  
    The only pattern supported is brace-expansion, anything else will be passed
    once to `callback` directly.
  
    Example
  
    ```js
    function echo(arg){ console.log(arg); }
  
    Ember.expandProperties('foo.bar', echo);              //=> 'foo.bar'
    Ember.expandProperties('{foo,bar}', echo);            //=> 'foo', 'bar'
    Ember.expandProperties('foo.{bar,baz}', echo);        //=> 'foo.bar', 'foo.baz'
    Ember.expandProperties('{foo,bar}.baz', echo);        //=> 'foo.baz', 'bar.baz'
    Ember.expandProperties('foo.{bar,baz}.[]', echo)      //=> 'foo.bar.[]', 'foo.baz.[]'
    Ember.expandProperties('{foo,bar}.{spam,eggs}', echo) //=> 'foo.spam', 'foo.eggs', 'bar.spam', 'bar.eggs'
    Ember.expandProperties('{foo}.bar.{baz}')             //=> 'foo.bar.baz'
    ```
  
    @method expandProperties
    @for Ember
    @private
    @param {String} pattern The property pattern to expand.
    @param {Function} callback The callback to invoke.  It is invoked once per
    expansion, and is passed the expansion.
  */

  function expandProperties(pattern, callback) {
    _emberMetalDebug.assert('A computed property key must be a string', typeof pattern === 'string');
    _emberMetalDebug.assert('Brace expanded properties cannot contain spaces, e.g. "user.{firstName, lastName}" should be "user.{firstName,lastName}"', pattern.indexOf(' ') === -1);
    _emberMetalDebug.assert('Brace expanded properties have to be balanced and cannot be nested, pattern: ' + pattern, (function (str) {
      var inBrace = 0;
      var char = undefined;
      for (var i = 0; i < str.length; i++) {
        char = str.charAt(i);

        if (char === '{') {
          inBrace++;
        } else if (char === '}') {
          inBrace--;
        }

        if (inBrace > 1 || inBrace < 0) {
          return false;
        }
      }

      return true;
    })(pattern));

    var parts = pattern.split(SPLIT_REGEX);
    var properties = [parts];

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part.indexOf(',') >= 0) {
        properties = duplicateAndReplace(properties, part.split(','), i);
      }
    }

    for (var i = 0; i < properties.length; i++) {
      callback(properties[i].join('').replace(END_WITH_EACH_REGEX, '.[]'));
    }
  }

  function duplicateAndReplace(properties, currentParts, index) {
    var all = [];

    properties.forEach(function (property) {
      currentParts.forEach(function (part) {
        var current = property.slice(0);
        current[index] = part;
        all.push(current);
      });
    });

    return all;
  }
});
enifed('ember-metal/features', ['exports', 'ember-utils', 'ember-environment', 'ember/features'], function (exports, _emberUtils, _emberEnvironment, _emberFeatures) {
  'use strict';

  exports.default = isEnabled;

  /**
    The hash of enabled Canary features. Add to this, any canary features
    before creating your application.
  
    Alternatively (and recommended), you can also define `EmberENV.FEATURES`
    if you need to enable features flagged at runtime.
  
    @class FEATURES
    @namespace Ember
    @static
    @since 1.1.0
    @public
  */
  var FEATURES = _emberUtils.assign(_emberFeatures.default, _emberEnvironment.ENV.FEATURES);

  exports.FEATURES = FEATURES;
  /**
    Determine whether the specified `feature` is enabled. Used by Ember's
    build tools to exclude experimental features from beta/stable builds.
  
    You can define the following configuration options:
  
    * `EmberENV.ENABLE_OPTIONAL_FEATURES` - enable any features that have not been explicitly
      enabled/disabled.
  
    @method isEnabled
    @param {String} feature The feature to check
    @return {Boolean}
    @for Ember.FEATURES
    @since 1.1.0
    @public
  */

  function isEnabled(feature) {
    var featureValue = FEATURES[feature];

    if (featureValue === true || featureValue === false || featureValue === undefined) {
      return featureValue;
    } else if (_emberEnvironment.ENV.ENABLE_OPTIONAL_FEATURES) {
      return true;
    } else {
      return false;
    }
  }

  exports.DEFAULT_FEATURES = _emberFeatures.default;
});
enifed('ember-metal/get_properties', ['exports', 'ember-metal/property_get'], function (exports, _emberMetalProperty_get) {
  'use strict';

  exports.default = getProperties;

  /**
    To get multiple properties at once, call `Ember.getProperties`
    with an object followed by a list of strings or an array:
  
    ```javascript
    Ember.getProperties(record, 'firstName', 'lastName', 'zipCode');
    // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
    ```
  
    is equivalent to:
  
    ```javascript
    Ember.getProperties(record, ['firstName', 'lastName', 'zipCode']);
    // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
    ```
  
    @method getProperties
    @for Ember
    @param {Object} obj
    @param {String...|Array} list of keys to get
    @return {Object}
    @public
  */

  function getProperties(obj) {
    var ret = {};
    var propertyNames = arguments;
    var i = 1;

    if (arguments.length === 2 && Array.isArray(arguments[1])) {
      i = 0;
      propertyNames = arguments[1];
    }
    for (; i < propertyNames.length; i++) {
      ret[propertyNames[i]] = _emberMetalProperty_get.get(obj, propertyNames[i]);
    }
    return ret;
  }
});
enifed('ember-metal/index', ['exports', 'require', 'ember-metal/core', 'ember-metal/computed', 'ember-metal/alias', 'ember-metal/merge', 'ember-metal/debug', 'ember-metal/instrumentation', 'ember-metal/testing', 'ember-metal/error_handler', 'ember-metal/meta', 'ember-metal/error', 'ember-metal/cache', 'ember-metal/features', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/weak_map', 'ember-metal/events', 'ember-metal/is_none', 'ember-metal/is_empty', 'ember-metal/is_blank', 'ember-metal/is_present', 'ember-metal/run_loop', 'ember-metal/observer_set', 'ember-metal/property_events', 'ember-metal/properties', 'ember-metal/watch_key', 'ember-metal/chains', 'ember-metal/watch_path', 'ember-metal/watching', 'ember-metal/libraries', 'ember-metal/map', 'ember-metal/get_properties', 'ember-metal/set_properties', 'ember-metal/expand_properties', 'ember-metal/observer', 'ember-metal/mixin', 'ember-metal/binding', 'ember-metal/path_cache', 'ember-metal/injected_property', 'ember-metal/tags', 'ember-metal/replace', 'ember-metal/transaction', 'ember-metal/is_proxy', 'ember-metal/descriptor'], function (exports, _require, _emberMetalCore, _emberMetalComputed, _emberMetalAlias, _emberMetalMerge, _emberMetalDebug, _emberMetalInstrumentation, _emberMetalTesting, _emberMetalError_handler, _emberMetalMeta, _emberMetalError, _emberMetalCache, _emberMetalFeatures, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalWeak_map, _emberMetalEvents, _emberMetalIs_none, _emberMetalIs_empty, _emberMetalIs_blank, _emberMetalIs_present, _emberMetalRun_loop, _emberMetalObserver_set, _emberMetalProperty_events, _emberMetalProperties, _emberMetalWatch_key, _emberMetalChains, _emberMetalWatch_path, _emberMetalWatching, _emberMetalLibraries, _emberMetalMap, _emberMetalGet_properties, _emberMetalSet_properties, _emberMetalExpand_properties, _emberMetalObserver, _emberMetalMixin, _emberMetalBinding, _emberMetalPath_cache, _emberMetalInjected_property, _emberMetalTags, _emberMetalReplace, _emberMetalTransaction, _emberMetalIs_proxy, _emberMetalDescriptor) {
  /**
  @module ember
  @submodule ember-metal
  */

  'use strict';

  exports.default = _emberMetalCore.default;
  // reexports
  exports.computed = _emberMetalComputed.default;
  exports.cacheFor = _emberMetalComputed.cacheFor;
  exports.ComputedProperty = _emberMetalComputed.ComputedProperty;
  exports.alias = _emberMetalAlias.default;
  exports.merge = _emberMetalMerge.default;
  exports.assert = _emberMetalDebug.assert;
  exports.info = _emberMetalDebug.info;
  exports.warn = _emberMetalDebug.warn;
  exports.debug = _emberMetalDebug.debug;
  exports.deprecate = _emberMetalDebug.deprecate;
  exports.deprecateFunc = _emberMetalDebug.deprecateFunc;
  exports.runInDebug = _emberMetalDebug.runInDebug;
  exports.setDebugFunction = _emberMetalDebug.setDebugFunction;
  exports.getDebugFunction = _emberMetalDebug.getDebugFunction;
  exports.debugSeal = _emberMetalDebug.debugSeal;
  exports.debugFreeze = _emberMetalDebug.debugFreeze;
  exports.instrument = _emberMetalInstrumentation.instrument;
  exports.flaggedInstrument = _emberMetalInstrumentation.flaggedInstrument;
  exports._instrumentStart = _emberMetalInstrumentation._instrumentStart;
  exports.instrumentationReset = _emberMetalInstrumentation.reset;
  exports.instrumentationSubscribe = _emberMetalInstrumentation.subscribe;
  exports.instrumentationUnsubscribe = _emberMetalInstrumentation.unsubscribe;
  exports.isTesting = _emberMetalTesting.isTesting;
  exports.setTesting = _emberMetalTesting.setTesting;
  exports.getOnerror = _emberMetalError_handler.getOnerror;
  exports.setOnerror = _emberMetalError_handler.setOnerror;
  exports.dispatchError = _emberMetalError_handler.dispatchError;
  exports.setDispatchOverride = _emberMetalError_handler.setDispatchOverride;
  exports.META_DESC = _emberMetalMeta.META_DESC;
  exports.meta = _emberMetalMeta.meta;
  exports.peekMeta = _emberMetalMeta.peekMeta;
  exports.Error = _emberMetalError.default;
  exports.Cache = _emberMetalCache.default;
  exports.isFeatureEnabled = _emberMetalFeatures.default;
  exports.FEATURES = _emberMetalFeatures.FEATURES;
  exports.DEFAULT_FEATURES = _emberMetalFeatures.DEFAULT_FEATURES;
  exports._getPath = _emberMetalProperty_get._getPath;
  exports.get = _emberMetalProperty_get.get;
  exports.getWithDefault = _emberMetalProperty_get.getWithDefault;
  exports.set = _emberMetalProperty_set.set;
  exports.trySet = _emberMetalProperty_set.trySet;
  exports.WeakMap = _emberMetalWeak_map.default;
  exports.accumulateListeners = _emberMetalEvents.accumulateListeners;
  exports.addListener = _emberMetalEvents.addListener;
  exports.hasListeners = _emberMetalEvents.hasListeners;
  exports.listenersFor = _emberMetalEvents.listenersFor;
  exports.on = _emberMetalEvents.on;
  exports.removeListener = _emberMetalEvents.removeListener;
  exports.sendEvent = _emberMetalEvents.sendEvent;
  exports.suspendListener = _emberMetalEvents.suspendListener;
  exports.suspendListeners = _emberMetalEvents.suspendListeners;
  exports.watchedEvents = _emberMetalEvents.watchedEvents;
  exports.isNone = _emberMetalIs_none.default;
  exports.isEmpty = _emberMetalIs_empty.default;
  exports.isBlank = _emberMetalIs_blank.default;
  exports.isPresent = _emberMetalIs_present.default;
  exports.run = _emberMetalRun_loop.default;
  exports.ObserverSet = _emberMetalObserver_set.default;
  exports.beginPropertyChanges = _emberMetalProperty_events.beginPropertyChanges;
  exports.changeProperties = _emberMetalProperty_events.changeProperties;
  exports.endPropertyChanges = _emberMetalProperty_events.endPropertyChanges;
  exports.overrideChains = _emberMetalProperty_events.overrideChains;
  exports.propertyDidChange = _emberMetalProperty_events.propertyDidChange;
  exports.propertyWillChange = _emberMetalProperty_events.propertyWillChange;
  exports.PROPERTY_DID_CHANGE = _emberMetalProperty_events.PROPERTY_DID_CHANGE;
  exports.defineProperty = _emberMetalProperties.defineProperty;
  exports.Descriptor = _emberMetalProperties.Descriptor;
  exports.watchKey = _emberMetalWatch_key.watchKey;
  exports.unwatchKey = _emberMetalWatch_key.unwatchKey;
  exports.ChainNode = _emberMetalChains.ChainNode;
  exports.finishChains = _emberMetalChains.finishChains;
  exports.removeChainWatcher = _emberMetalChains.removeChainWatcher;
  exports.watchPath = _emberMetalWatch_path.watchPath;
  exports.unwatchPath = _emberMetalWatch_path.unwatchPath;
  exports.destroy = _emberMetalWatching.destroy;
  exports.isWatching = _emberMetalWatching.isWatching;
  exports.unwatch = _emberMetalWatching.unwatch;
  exports.watch = _emberMetalWatching.watch;
  exports.watcherCount = _emberMetalWatching.watcherCount;
  exports.libraries = _emberMetalLibraries.default;
  exports.Map = _emberMetalMap.Map;
  exports.MapWithDefault = _emberMetalMap.MapWithDefault;
  exports.OrderedSet = _emberMetalMap.OrderedSet;
  exports.getProperties = _emberMetalGet_properties.default;
  exports.setProperties = _emberMetalSet_properties.default;
  exports.expandProperties = _emberMetalExpand_properties.default;
  exports._suspendObserver = _emberMetalObserver._suspendObserver;
  exports._suspendObservers = _emberMetalObserver._suspendObservers;
  exports.addObserver = _emberMetalObserver.addObserver;
  exports.observersFor = _emberMetalObserver.observersFor;
  exports.removeObserver = _emberMetalObserver.removeObserver;
  exports._addBeforeObserver = _emberMetalObserver._addBeforeObserver;
  exports._removeBeforeObserver = _emberMetalObserver._removeBeforeObserver;
  exports.NAME_KEY = _emberMetalMixin.NAME_KEY;
  exports.Mixin = _emberMetalMixin.Mixin;
  exports.aliasMethod = _emberMetalMixin.aliasMethod;
  exports._immediateObserver = _emberMetalMixin._immediateObserver;
  exports._beforeObserver = _emberMetalMixin._beforeObserver;
  exports.mixin = _emberMetalMixin.mixin;
  exports.observer = _emberMetalMixin.observer;
  exports.required = _emberMetalMixin.required;
  exports.REQUIRED = _emberMetalMixin.REQUIRED;
  exports.hasUnprocessedMixins = _emberMetalMixin.hasUnprocessedMixins;
  exports.clearUnprocessedMixins = _emberMetalMixin.clearUnprocessedMixins;
  exports.detectBinding = _emberMetalMixin.detectBinding;
  exports.Binding = _emberMetalBinding.Binding;
  exports.bind = _emberMetalBinding.bind;
  exports.isGlobalPath = _emberMetalPath_cache.isGlobalPath;
  exports.InjectedProperty = _emberMetalInjected_property.default;
  exports.setHasViews = _emberMetalTags.setHasViews;
  exports.tagForProperty = _emberMetalTags.tagForProperty;
  exports.tagFor = _emberMetalTags.tagFor;
  exports.markObjectAsDirty = _emberMetalTags.markObjectAsDirty;
  exports.replace = _emberMetalReplace.default;
  exports.runInTransaction = _emberMetalTransaction.default;
  exports.didRender = _emberMetalTransaction.didRender;
  exports.assertNotRendered = _emberMetalTransaction.assertNotRendered;
  exports.isProxy = _emberMetalIs_proxy.isProxy;
  exports.descriptor = _emberMetalDescriptor.default;

  // TODO: this needs to be deleted once we refactor the build tooling
  // do this for side-effects of updating Ember.assert, warn, etc when
  // ember-debug is present
  // This needs to be called before any deprecateFunc

  if (_require.has('ember-debug')) {
    _require.default('ember-debug');
  }
});
enifed('ember-metal/injected_property', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/computed', 'ember-metal/alias', 'ember-metal/properties'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalComputed, _emberMetalAlias, _emberMetalProperties) {
  'use strict';

  exports.default = InjectedProperty;

  /**
    Read-only property that returns the result of a container lookup.
  
    @class InjectedProperty
    @namespace Ember
    @constructor
    @param {String} type The container type the property will lookup
    @param {String} name (optional) The name the property will lookup, defaults
           to the property's name
    @private
  */

  function InjectedProperty(type, name) {
    this.type = type;
    this.name = name;

    this._super$Constructor(injectedPropertyGet);
    AliasedPropertyPrototype.oneWay.call(this);
  }

  function injectedPropertyGet(keyName) {
    var desc = this[keyName];
    var owner = _emberUtils.getOwner(this) || this.container; // fallback to `container` for backwards compat

    _emberMetalDebug.assert('InjectedProperties should be defined with the Ember.inject computed property macros.', desc && desc.isDescriptor && desc.type);
    _emberMetalDebug.assert('Attempting to lookup an injected property on an object without a container, ensure that the object was instantiated via a container.', owner);

    return owner.lookup(desc.type + ':' + (desc.name || keyName));
  }

  InjectedProperty.prototype = Object.create(_emberMetalProperties.Descriptor.prototype);

  var InjectedPropertyPrototype = InjectedProperty.prototype;
  var ComputedPropertyPrototype = _emberMetalComputed.ComputedProperty.prototype;
  var AliasedPropertyPrototype = _emberMetalAlias.AliasedProperty.prototype;

  InjectedPropertyPrototype._super$Constructor = _emberMetalComputed.ComputedProperty;

  InjectedPropertyPrototype.get = ComputedPropertyPrototype.get;
  InjectedPropertyPrototype.readOnly = ComputedPropertyPrototype.readOnly;
  InjectedPropertyPrototype.teardown = ComputedPropertyPrototype.teardown;
});
enifed('ember-metal/instrumentation', ['exports', 'ember-environment', 'ember-metal/features'], function (exports, _emberEnvironment, _emberMetalFeatures) {
  'use strict';

  exports.instrument = instrument;
  exports._instrumentStart = _instrumentStart;
  exports.subscribe = subscribe;
  exports.unsubscribe = unsubscribe;
  exports.reset = reset;

  /**
    The purpose of the Ember Instrumentation module is
    to provide efficient, general-purpose instrumentation
    for Ember.
  
    Subscribe to a listener by using `Ember.subscribe`:
  
    ```javascript
    Ember.subscribe("render", {
      before(name, timestamp, payload) {
  
      },
  
      after(name, timestamp, payload) {
  
      }
    });
    ```
  
    If you return a value from the `before` callback, that same
    value will be passed as a fourth parameter to the `after`
    callback.
  
    Instrument a block of code by using `Ember.instrument`:
  
    ```javascript
    Ember.instrument("render.handlebars", payload, function() {
      // rendering logic
    }, binding);
    ```
  
    Event names passed to `Ember.instrument` are namespaced
    by periods, from more general to more specific. Subscribers
    can listen for events by whatever level of granularity they
    are interested in.
  
    In the above example, the event is `render.handlebars`,
    and the subscriber listened for all events beginning with
    `render`. It would receive callbacks for events named
    `render`, `render.handlebars`, `render.container`, or
    even `render.handlebars.layout`.
  
    @class Instrumentation
    @namespace Ember
    @static
    @private
  */
  var subscribers = [];
  exports.subscribers = subscribers;
  var cache = {};

  function populateListeners(name) {
    var listeners = [];
    var subscriber = undefined;

    for (var i = 0; i < subscribers.length; i++) {
      subscriber = subscribers[i];
      if (subscriber.regex.test(name)) {
        listeners.push(subscriber.object);
      }
    }

    cache[name] = listeners;
    return listeners;
  }

  var time = (function () {
    var perf = 'undefined' !== typeof window ? window.performance || {} : {};
    var fn = perf.now || perf.mozNow || perf.webkitNow || perf.msNow || perf.oNow;
    // fn.bind will be available in all the browsers that support the advanced window.performance... ;-)
    return fn ? fn.bind(perf) : function () {
      return +new Date();
    };
  })();

  /**
    Notifies event's subscribers, calls `before` and `after` hooks.
  
    @method instrument
    @namespace Ember.Instrumentation
  
    @param {String} [name] Namespaced event name.
    @param {Object} _payload
    @param {Function} callback Function that you're instrumenting.
    @param {Object} binding Context that instrument function is called with.
    @private
  */

  function instrument(name, _payload, callback, binding) {
    if (arguments.length <= 3 && typeof _payload === 'function') {
      binding = callback;
      callback = _payload;
      _payload = undefined;
    }
    if (subscribers.length === 0) {
      return callback.call(binding);
    }
    var payload = _payload || {};
    var finalizer = _instrumentStart(name, function () {
      return payload;
    });

    if (finalizer) {
      return withFinalizer(callback, finalizer, payload, binding);
    } else {
      return callback.call(binding);
    }
  }

  var flaggedInstrument = undefined;
  if (_emberMetalFeatures.default('ember-improved-instrumentation')) {
    exports.flaggedInstrument = flaggedInstrument = instrument;
  } else {
    exports.flaggedInstrument = flaggedInstrument = function (name, payload, callback) {
      return callback();
    };
  }
  exports.flaggedInstrument = flaggedInstrument;

  function withFinalizer(callback, finalizer, payload, binding) {
    var result = undefined;
    try {
      result = callback.call(binding);
    } catch (e) {
      payload.exception = e;
      result = payload;
    } finally {
      finalizer();
      return result;
    }
  }

  function NOOP() {}

  // private for now

  function _instrumentStart(name, _payload, _payloadParam) {
    if (subscribers.length === 0) {
      return NOOP;
    }

    var listeners = cache[name];

    if (!listeners) {
      listeners = populateListeners(name);
    }

    if (listeners.length === 0) {
      return NOOP;
    }

    var payload = _payload(_payloadParam);

    var STRUCTURED_PROFILE = _emberEnvironment.ENV.STRUCTURED_PROFILE;
    var timeName = undefined;
    if (STRUCTURED_PROFILE) {
      timeName = name + ': ' + payload.object;
      console.time(timeName);
    }

    var beforeValues = new Array(listeners.length);
    var i = undefined,
        listener = undefined;
    var timestamp = time();
    for (i = 0; i < listeners.length; i++) {
      listener = listeners[i];
      beforeValues[i] = listener.before(name, timestamp, payload);
    }

    return function _instrumentEnd() {
      var i = undefined,
          listener = undefined;
      var timestamp = time();
      for (i = 0; i < listeners.length; i++) {
        listener = listeners[i];
        if (typeof listener.after === 'function') {
          listener.after(name, timestamp, payload, beforeValues[i]);
        }
      }

      if (STRUCTURED_PROFILE) {
        console.timeEnd(timeName);
      }
    };
  }

  /**
    Subscribes to a particular event or instrumented block of code.
  
    @method subscribe
    @namespace Ember.Instrumentation
  
    @param {String} [pattern] Namespaced event name.
    @param {Object} [object] Before and After hooks.
  
    @return {Subscriber}
    @private
  */

  function subscribe(pattern, object) {
    var paths = pattern.split('.');
    var path = undefined;
    var regex = [];

    for (var i = 0; i < paths.length; i++) {
      path = paths[i];
      if (path === '*') {
        regex.push('[^\\.]*');
      } else {
        regex.push(path);
      }
    }

    regex = regex.join('\\.');
    regex = regex + '(\\..*)?';

    var subscriber = {
      pattern: pattern,
      regex: new RegExp('^' + regex + '$'),
      object: object
    };

    subscribers.push(subscriber);
    cache = {};

    return subscriber;
  }

  /**
    Unsubscribes from a particular event or instrumented block of code.
  
    @method unsubscribe
    @namespace Ember.Instrumentation
  
    @param {Object} [subscriber]
    @private
  */

  function unsubscribe(subscriber) {
    var index = undefined;

    for (var i = 0; i < subscribers.length; i++) {
      if (subscribers[i] === subscriber) {
        index = i;
      }
    }

    subscribers.splice(index, 1);
    cache = {};
  }

  /**
    Resets `Ember.Instrumentation` by flushing list of subscribers.
  
    @method reset
    @namespace Ember.Instrumentation
    @private
  */

  function reset() {
    subscribers.length = 0;
    cache = {};
  }
});
enifed('ember-metal/is_blank', ['exports', 'ember-metal/is_empty'], function (exports, _emberMetalIs_empty) {
  'use strict';

  exports.default = isBlank;

  /**
    A value is blank if it is empty or a whitespace string.
  
    ```javascript
    Ember.isBlank();                // true
    Ember.isBlank(null);            // true
    Ember.isBlank(undefined);       // true
    Ember.isBlank('');              // true
    Ember.isBlank([]);              // true
    Ember.isBlank('\n\t');          // true
    Ember.isBlank('  ');            // true
    Ember.isBlank({});              // false
    Ember.isBlank('\n\t Hello');    // false
    Ember.isBlank('Hello world');   // false
    Ember.isBlank([1,2,3]);         // false
    ```
  
    @method isBlank
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @since 1.5.0
    @public
  */

  function isBlank(obj) {
    return _emberMetalIs_empty.default(obj) || typeof obj === 'string' && obj.match(/\S/) === null;
  }
});
enifed('ember-metal/is_empty', ['exports', 'ember-metal/property_get', 'ember-metal/is_none'], function (exports, _emberMetalProperty_get, _emberMetalIs_none) {
  'use strict';

  exports.default = isEmpty;

  /**
    Verifies that a value is `null` or an empty string, empty array,
    or empty function.
  
    Constrains the rules on `Ember.isNone` by returning true for empty
    string and empty arrays.
  
    ```javascript
    Ember.isEmpty();                // true
    Ember.isEmpty(null);            // true
    Ember.isEmpty(undefined);       // true
    Ember.isEmpty('');              // true
    Ember.isEmpty([]);              // true
    Ember.isEmpty({});              // false
    Ember.isEmpty('Adam Hawkins');  // false
    Ember.isEmpty([0,1,2]);         // false
    Ember.isEmpty('\n\t');          // false
    Ember.isEmpty('  ');            // false
    ```
  
    @method isEmpty
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @public
  */

  function isEmpty(obj) {
    var none = _emberMetalIs_none.default(obj);
    if (none) {
      return none;
    }

    if (typeof obj.size === 'number') {
      return !obj.size;
    }

    var objectType = typeof obj;

    if (objectType === 'object') {
      var size = _emberMetalProperty_get.get(obj, 'size');
      if (typeof size === 'number') {
        return !size;
      }
    }

    if (typeof obj.length === 'number' && objectType !== 'function') {
      return !obj.length;
    }

    if (objectType === 'object') {
      var _length = _emberMetalProperty_get.get(obj, 'length');
      if (typeof _length === 'number') {
        return !_length;
      }
    }

    return false;
  }
});
enifed("ember-metal/is_none", ["exports"], function (exports) {
  /**
    Returns true if the passed value is null or undefined. This avoids errors
    from JSLint complaining about use of ==, which can be technically
    confusing.
  
    ```javascript
    Ember.isNone();              // true
    Ember.isNone(null);          // true
    Ember.isNone(undefined);     // true
    Ember.isNone('');            // false
    Ember.isNone([]);            // false
    Ember.isNone(function() {}); // false
    ```
  
    @method isNone
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @public
  */
  "use strict";

  exports.default = isNone;

  function isNone(obj) {
    return obj === null || obj === undefined;
  }
});
enifed('ember-metal/is_present', ['exports', 'ember-metal/is_blank'], function (exports, _emberMetalIs_blank) {
  'use strict';

  exports.default = isPresent;

  /**
    A value is present if it not `isBlank`.
  
    ```javascript
    Ember.isPresent();                // false
    Ember.isPresent(null);            // false
    Ember.isPresent(undefined);       // false
    Ember.isPresent('');              // false
    Ember.isPresent('  ');            // false
    Ember.isPresent('\n\t');          // false
    Ember.isPresent([]);              // false
    Ember.isPresent({ length: 0 })    // false
    Ember.isPresent(false);           // true
    Ember.isPresent(true);            // true
    Ember.isPresent('string');        // true
    Ember.isPresent(0);               // true
    Ember.isPresent(function() {})    // true
    Ember.isPresent({});              // true
    Ember.isPresent(false);           // true
    Ember.isPresent('\n\t Hello');    // true
    Ember.isPresent([1,2,3]);         // true
    ```
  
    @method isPresent
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @since 1.8.0
    @public
  */

  function isPresent(obj) {
    return !_emberMetalIs_blank.default(obj);
  }
});
enifed('ember-metal/is_proxy', ['exports', 'ember-metal/meta'], function (exports, _emberMetalMeta) {
  'use strict';

  exports.isProxy = isProxy;

  function isProxy(value) {
    if (typeof value === 'object' && value) {
      var meta = _emberMetalMeta.peekMeta(value);
      return meta && meta.isProxy();
    }

    return false;
  }
});
enifed('ember-metal/libraries', ['exports', 'ember-metal/debug', 'ember-metal/features'], function (exports, _emberMetalDebug, _emberMetalFeatures) {
  'use strict';

  exports.Libraries = Libraries;

  /**
    Helper class that allows you to register your library with Ember.
  
    Singleton created at `Ember.libraries`.
  
    @class Libraries
    @constructor
    @private
  */

  function Libraries() {
    this._registry = [];
    this._coreLibIndex = 0;
  }

  Libraries.prototype = {
    constructor: Libraries,

    _getLibraryByName: function (name) {
      var libs = this._registry;
      var count = libs.length;

      for (var i = 0; i < count; i++) {
        if (libs[i].name === name) {
          return libs[i];
        }
      }
    },

    register: function (name, version, isCoreLibrary) {
      var index = this._registry.length;

      if (!this._getLibraryByName(name)) {
        if (isCoreLibrary) {
          index = this._coreLibIndex++;
        }
        this._registry.splice(index, 0, { name: name, version: version });
      } else {
        _emberMetalDebug.warn('Library "' + name + '" is already registered with Ember.', false, { id: 'ember-metal.libraries-register' });
      }
    },

    registerCoreLibrary: function (name, version) {
      this.register(name, version, true);
    },

    deRegister: function (name) {
      var lib = this._getLibraryByName(name);
      var index = undefined;

      if (lib) {
        index = this._registry.indexOf(lib);
        this._registry.splice(index, 1);
      }
    }
  };

  if (_emberMetalFeatures.default('ember-libraries-isregistered')) {
    Libraries.prototype.isRegistered = function (name) {
      return !!this._getLibraryByName(name);
    };
  }

  exports.default = new Libraries();
});
enifed('ember-metal/map', ['exports', 'ember-utils'], function (exports, _emberUtils) {
  /**
  @module ember
  @submodule ember-metal
  */

  /*
    JavaScript (before ES6) does not have a Map implementation. Objects,
    which are often used as dictionaries, may only have Strings as keys.
  
    Because Ember has a way to get a unique identifier for every object
    via `Ember.guidFor`, we can implement a performant Map with arbitrary
    keys. Because it is commonly used in low-level bookkeeping, Map is
    implemented as a pure JavaScript object for performance.
  
    This implementation follows the current iteration of the ES6 proposal for
    maps (http://wiki.ecmascript.org/doku.php?id=harmony:simple_maps_and_sets),
    with one exception:  as we do not have the luxury of in-VM iteration, we implement a
    forEach method for iteration.
  
    Map is mocked out to look like an Ember object, so you can do
    `Ember.Map.create()` for symmetry with other Ember classes.
  */
  'use strict';

  function missingFunction(fn) {
    throw new TypeError(Object.prototype.toString.call(fn) + ' is not a function');
  }

  function missingNew(name) {
    throw new TypeError('Constructor ' + name + ' requires \'new\'');
  }

  function copyNull(obj) {
    var output = new _emberUtils.EmptyObject();

    for (var prop in obj) {
      // hasOwnPropery is not needed because obj is new EmptyObject();
      output[prop] = obj[prop];
    }

    return output;
  }

  function copyMap(original, newObject) {
    var keys = original._keys.copy();
    var values = copyNull(original._values);

    newObject._keys = keys;
    newObject._values = values;
    newObject.size = original.size;

    return newObject;
  }

  /**
    This class is used internally by Ember and Ember Data.
    Please do not use it at this time. We plan to clean it up
    and add many tests soon.
  
    @class OrderedSet
    @namespace Ember
    @constructor
    @private
  */
  function OrderedSet() {
    if (this instanceof OrderedSet) {
      this.clear();
      this._silenceRemoveDeprecation = false;
    } else {
      missingNew('OrderedSet');
    }
  }

  /**
    @method create
    @static
    @return {Ember.OrderedSet}
    @private
  */
  OrderedSet.create = function () {
    var Constructor = this;

    return new Constructor();
  };

  OrderedSet.prototype = {
    constructor: OrderedSet,
    /**
      @method clear
      @private
    */
    clear: function () {
      this.presenceSet = new _emberUtils.EmptyObject();
      this.list = [];
      this.size = 0;
    },

    /**
      @method add
      @param obj
      @param guid (optional, and for internal use)
      @return {Ember.OrderedSet}
      @private
    */
    add: function (obj, _guid) {
      var guid = _guid || _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;
      var list = this.list;

      if (presenceSet[guid] !== true) {
        presenceSet[guid] = true;
        this.size = list.push(obj);
      }

      return this;
    },

    /**
      @since 1.8.0
      @method delete
      @param obj
      @param _guid (optional and for internal use only)
      @return {Boolean}
      @private
    */
    delete: function (obj, _guid) {
      var guid = _guid || _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;
      var list = this.list;

      if (presenceSet[guid] === true) {
        delete presenceSet[guid];
        var index = list.indexOf(obj);
        if (index > -1) {
          list.splice(index, 1);
        }
        this.size = list.length;
        return true;
      } else {
        return false;
      }
    },

    /**
      @method isEmpty
      @return {Boolean}
      @private
    */
    isEmpty: function () {
      return this.size === 0;
    },

    /**
      @method has
      @param obj
      @return {Boolean}
      @private
    */
    has: function (obj) {
      if (this.size === 0) {
        return false;
      }

      var guid = _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;

      return presenceSet[guid] === true;
    },

    /**
      @method forEach
      @param {Function} fn
      @param self
      @private
    */
    forEach: function (fn /*, ...thisArg*/) {
      if (typeof fn !== 'function') {
        missingFunction(fn);
      }

      if (this.size === 0) {
        return;
      }

      var list = this.list;

      if (arguments.length === 2) {
        for (var i = 0; i < list.length; i++) {
          fn.call(arguments[1], list[i]);
        }
      } else {
        for (var i = 0; i < list.length; i++) {
          fn(list[i]);
        }
      }
    },

    /**
      @method toArray
      @return {Array}
      @private
    */
    toArray: function () {
      return this.list.slice();
    },

    /**
      @method copy
      @return {Ember.OrderedSet}
      @private
    */
    copy: function () {
      var Constructor = this.constructor;
      var set = new Constructor();

      set._silenceRemoveDeprecation = this._silenceRemoveDeprecation;
      set.presenceSet = copyNull(this.presenceSet);
      set.list = this.toArray();
      set.size = this.size;

      return set;
    }
  };

  /**
    A Map stores values indexed by keys. Unlike JavaScript's
    default Objects, the keys of a Map can be any JavaScript
    object.
  
    Internally, a Map has two data structures:
  
    1. `keys`: an OrderedSet of all of the existing keys
    2. `values`: a JavaScript Object indexed by the `Ember.guidFor(key)`
  
    When a key/value pair is added for the first time, we
    add the key to the `keys` OrderedSet, and create or
    replace an entry in `values`. When an entry is deleted,
    we delete its entry in `keys` and `values`.
  
    @class Map
    @namespace Ember
    @private
    @constructor
  */
  function Map() {
    if (this instanceof Map) {
      this._keys = OrderedSet.create();
      this._keys._silenceRemoveDeprecation = true;
      this._values = new _emberUtils.EmptyObject();
      this.size = 0;
    } else {
      missingNew('Map');
    }
  }

  /**
    @method create
    @static
    @private
  */
  Map.create = function () {
    var Constructor = this;
    return new Constructor();
  };

  Map.prototype = {
    constructor: Map,

    /**
      This property will change as the number of objects in the map changes.
       @since 1.8.0
      @property size
      @type number
      @default 0
      @private
    */
    size: 0,

    /**
      Retrieve the value associated with a given key.
       @method get
      @param {*} key
      @return {*} the value associated with the key, or `undefined`
      @private
    */
    get: function (key) {
      if (this.size === 0) {
        return;
      }

      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      return values[guid];
    },

    /**
      Adds a value to the map. If a value for the given key has already been
      provided, the new value will replace the old value.
       @method set
      @param {*} key
      @param {*} value
      @return {Ember.Map}
      @private
    */
    set: function (key, value) {
      var keys = this._keys;
      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      // ensure we don't store -0
      var k = key === -0 ? 0 : key;

      keys.add(k, guid);

      values[guid] = value;

      this.size = keys.size;

      return this;
    },

    /**
      Removes a value from the map for an associated key.
       @since 1.8.0
      @method delete
      @param {*} key
      @return {Boolean} true if an item was removed, false otherwise
      @private
    */
    delete: function (key) {
      if (this.size === 0) {
        return false;
      }
      // don't use ES6 "delete" because it will be annoying
      // to use in browsers that are not ES6 friendly;
      var keys = this._keys;
      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      if (keys.delete(key, guid)) {
        delete values[guid];
        this.size = keys.size;
        return true;
      } else {
        return false;
      }
    },

    /**
      Check whether a key is present.
       @method has
      @param {*} key
      @return {Boolean} true if the item was present, false otherwise
      @private
    */
    has: function (key) {
      return this._keys.has(key);
    },

    /**
      Iterate over all the keys and values. Calls the function once
      for each key, passing in value, key, and the map being iterated over,
      in that order.
       The keys are guaranteed to be iterated over in insertion order.
       @method forEach
      @param {Function} callback
      @param {*} self if passed, the `this` value inside the
        callback. By default, `this` is the map.
      @private
    */
    forEach: function (callback /*, ...thisArg*/) {
      if (typeof callback !== 'function') {
        missingFunction(callback);
      }

      if (this.size === 0) {
        return;
      }

      var map = this;
      var cb = undefined,
          thisArg = undefined;

      if (arguments.length === 2) {
        thisArg = arguments[1];
        cb = function (key) {
          return callback.call(thisArg, map.get(key), key, map);
        };
      } else {
        cb = function (key) {
          return callback(map.get(key), key, map);
        };
      }

      this._keys.forEach(cb);
    },

    /**
      @method clear
      @private
    */
    clear: function () {
      this._keys.clear();
      this._values = new _emberUtils.EmptyObject();
      this.size = 0;
    },

    /**
      @method copy
      @return {Ember.Map}
      @private
    */
    copy: function () {
      return copyMap(this, new Map());
    }
  };

  /**
    @class MapWithDefault
    @namespace Ember
    @extends Ember.Map
    @private
    @constructor
    @param [options]
      @param {*} [options.defaultValue]
  */
  function MapWithDefault(options) {
    this._super$constructor();
    this.defaultValue = options.defaultValue;
  }

  /**
    @method create
    @static
    @param [options]
      @param {*} [options.defaultValue]
    @return {Ember.MapWithDefault|Ember.Map} If options are passed, returns
      `Ember.MapWithDefault` otherwise returns `Ember.Map`
    @private
  */
  MapWithDefault.create = function (options) {
    if (options) {
      return new MapWithDefault(options);
    } else {
      return new Map();
    }
  };

  MapWithDefault.prototype = Object.create(Map.prototype);
  MapWithDefault.prototype.constructor = MapWithDefault;
  MapWithDefault.prototype._super$constructor = Map;
  MapWithDefault.prototype._super$get = Map.prototype.get;

  /**
    Retrieve the value associated with a given key.
  
    @method get
    @param {*} key
    @return {*} the value associated with the key, or the default value
    @private
  */
  MapWithDefault.prototype.get = function (key) {
    var hasValue = this.has(key);

    if (hasValue) {
      return this._super$get(key);
    } else {
      var defaultValue = this.defaultValue(key);
      this.set(key, defaultValue);
      return defaultValue;
    }
  };

  /**
    @method copy
    @return {Ember.MapWithDefault}
    @private
  */
  MapWithDefault.prototype.copy = function () {
    var Constructor = this.constructor;
    return copyMap(this, new Constructor({
      defaultValue: this.defaultValue
    }));
  };

  exports.default = Map;
  exports.OrderedSet = OrderedSet;
  exports.Map = Map;
  exports.MapWithDefault = MapWithDefault;
});
enifed('ember-metal/merge', ['exports'], function (exports) {
  /**
    Merge the contents of two objects together into the first object.
  
    ```javascript
    Ember.merge({ first: 'Tom' }, { last: 'Dale' }); // { first: 'Tom', last: 'Dale' }
    var a = { first: 'Yehuda' };
    var b = { last: 'Katz' };
    Ember.merge(a, b); // a == { first: 'Yehuda', last: 'Katz' }, b == { last: 'Katz' }
    ```
  
    @method merge
    @for Ember
    @param {Object} original The object to merge into
    @param {Object} updates The object to copy properties from
    @return {Object}
    @public
  */
  'use strict';

  exports.default = merge;

  function merge(original, updates) {
    if (!updates || typeof updates !== 'object') {
      return original;
    }

    var props = Object.keys(updates);
    var prop = undefined;

    for (var i = 0; i < props.length; i++) {
      prop = props[i];
      original[prop] = updates[prop];
    }

    return original;
  }
});
enifed('ember-metal/meta', ['exports', 'ember-utils', 'ember-metal/features', 'ember-metal/meta_listeners', 'ember-metal/debug', 'ember-metal/chains'], function (exports, _emberUtils, _emberMetalFeatures, _emberMetalMeta_listeners, _emberMetalDebug, _emberMetalChains) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  exports.Meta = Meta;
  exports.deleteMeta = deleteMeta;
  exports.meta = meta;

  var counters = {
    peekCalls: 0,
    peekParentCalls: 0,
    peekPrototypeWalks: 0,
    setCalls: 0,
    deleteCalls: 0,
    metaCalls: 0,
    metaInstantiated: 0
  };

  /**
  @module ember-metal
  */

  /*
   This declares several meta-programmed members on the Meta class. Such
   meta!
  
   In general, the `readable` variants will give you an object (if it
   already exists) that you can read but should not modify. The
   `writable` variants will give you a mutable object, and they will
   create it if it didn't already exist.
  
   The following methods will get generated metaprogrammatically, and
   I'm including them here for greppability:
  
   writableCache, readableCache, writeWatching,
   peekWatching, clearWatching, writeMixins,
   peekMixins, clearMixins, writeBindings,
   peekBindings, clearBindings, writeValues,
   peekValues, clearValues, writeDeps, forEachInDeps
   writableChainWatchers, readableChainWatchers, writableChains,
   readableChains, writableTag, readableTag, writableTags,
   readableTags
  */
  var members = {
    cache: ownMap,
    weak: ownMap,
    watching: inheritedMap,
    mixins: inheritedMap,
    bindings: inheritedMap,
    values: inheritedMap,
    chainWatchers: ownCustomObject,
    chains: inheritedCustomObject,
    tag: ownCustomObject,
    tags: ownMap
  };

  // FLAGS
  var SOURCE_DESTROYING = 1 << 1;
  var SOURCE_DESTROYED = 1 << 2;
  var META_DESTROYED = 1 << 3;
  var IS_PROXY = 1 << 4;

  if (_emberMetalFeatures.default('ember-glimmer-detect-backtracking-rerender') || _emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
    members.lastRendered = ownMap;
    members.lastRenderedFrom = ownMap; // FIXME: not used in production, remove me from prod builds
  }

  var memberNames = Object.keys(members);
  var META_FIELD = '__ember_meta__';

  function Meta(obj, parentMeta) {
    _emberMetalDebug.runInDebug(function () {
      return counters.metaInstantiated++;
    });

    this._cache = undefined;
    this._weak = undefined;
    this._watching = undefined;
    this._mixins = undefined;
    this._bindings = undefined;
    this._values = undefined;
    this._deps = undefined;
    this._chainWatchers = undefined;
    this._chains = undefined;
    this._tag = undefined;
    this._tags = undefined;

    // initial value for all flags right now is false
    // see FLAGS const for detailed list of flags used
    this._flags = 0;

    // used only internally
    this.source = obj;

    // when meta(obj).proto === obj, the object is intended to be only a
    // prototype and doesn't need to actually be observable itself
    this.proto = undefined;

    // The next meta in our inheritance chain. We (will) track this
    // explicitly instead of using prototypical inheritance because we
    // have detailed knowledge of how each property should really be
    // inherited, and we can optimize it much better than JS runtimes.
    this.parent = parentMeta;

    if (_emberMetalFeatures.default('ember-glimmer-detect-backtracking-rerender') || _emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
      this._lastRendered = undefined;
      this._lastRenderedFrom = undefined; // FIXME: not used in production, remove me from prod builds
    }

    this._initializeListeners();
  }

  Meta.prototype.isInitialized = function (obj) {
    return this.proto !== obj;
  };

  var NODE_STACK = [];

  Meta.prototype.destroy = function () {
    if (this.isMetaDestroyed()) {
      return;
    }

    // remove chainWatchers to remove circular references that would prevent GC
    var node = undefined,
        nodes = undefined,
        key = undefined,
        nodeObject = undefined;
    node = this.readableChains();
    if (node) {
      NODE_STACK.push(node);
      // process tree
      while (NODE_STACK.length > 0) {
        node = NODE_STACK.pop();
        // push children
        nodes = node._chains;
        if (nodes) {
          for (key in nodes) {
            if (nodes[key] !== undefined) {
              NODE_STACK.push(nodes[key]);
            }
          }
        }

        // remove chainWatcher in node object
        if (node._watching) {
          nodeObject = node._object;
          if (nodeObject) {
            var foreignMeta = peekMeta(nodeObject);
            // avoid cleaning up chain watchers when both current and
            // foreign objects are being destroyed
            // if both are being destroyed manual cleanup is not needed
            // as they will be GC'ed and no non-destroyed references will
            // be remaining
            if (foreignMeta && !foreignMeta.isSourceDestroying()) {
              _emberMetalChains.removeChainWatcher(nodeObject, node._key, node, foreignMeta);
            }
          }
        }
      }
    }

    this.setMetaDestroyed();
  };

  for (var _name in _emberMetalMeta_listeners.protoMethods) {
    Meta.prototype[_name] = _emberMetalMeta_listeners.protoMethods[_name];
  }
  memberNames.forEach(function (name) {
    return members[name](name, Meta);
  });

  Meta.prototype.isSourceDestroying = function isSourceDestroying() {
    return (this._flags & SOURCE_DESTROYING) !== 0;
  };

  Meta.prototype.setSourceDestroying = function setSourceDestroying() {
    this._flags |= SOURCE_DESTROYING;
  };

  Meta.prototype.isSourceDestroyed = function isSourceDestroyed() {
    return (this._flags & SOURCE_DESTROYED) !== 0;
  };

  Meta.prototype.setSourceDestroyed = function setSourceDestroyed() {
    this._flags |= SOURCE_DESTROYED;
  };

  Meta.prototype.isMetaDestroyed = function isMetaDestroyed() {
    return (this._flags & META_DESTROYED) !== 0;
  };

  Meta.prototype.setMetaDestroyed = function setMetaDestroyed() {
    this._flags |= META_DESTROYED;
  };

  Meta.prototype.isProxy = function isProxy() {
    return (this._flags & IS_PROXY) !== 0;
  };

  Meta.prototype.setProxy = function setProxy() {
    this._flags |= IS_PROXY;
  };

  // Implements a member that is a lazily created, non-inheritable
  // POJO.
  function ownMap(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function () {
      return this._getOrCreateOwnMap(key);
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this[key];
    };
  }

  Meta.prototype._getOrCreateOwnMap = function (key) {
    var ret = this[key];
    if (!ret) {
      ret = this[key] = new _emberUtils.EmptyObject();
    }
    return ret;
  };

  // Implements a member that is a lazily created POJO with inheritable
  // values.
  function inheritedMap(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);

    Meta.prototype['write' + capitalized] = function (subkey, value) {
      _emberMetalDebug.assert('Cannot call write' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var map = this._getOrCreateOwnMap(key);
      map[subkey] = value;
    };

    Meta.prototype['peek' + capitalized] = function (subkey) {
      return this._findInherited(key, subkey);
    };

    Meta.prototype['forEach' + capitalized] = function (fn) {
      var pointer = this;
      var seen = new _emberUtils.EmptyObject();
      while (pointer !== undefined) {
        var map = pointer[key];
        if (map) {
          for (var _key in map) {
            if (!seen[_key]) {
              seen[_key] = true;
              fn(_key, map[_key]);
            }
          }
        }
        pointer = pointer.parent;
      }
    };

    Meta.prototype['clear' + capitalized] = function () {
      _emberMetalDebug.assert('Cannot call clear' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      this[key] = undefined;
    };

    Meta.prototype['deleteFrom' + capitalized] = function (subkey) {
      delete this._getOrCreateOwnMap(key)[subkey];
    };

    Meta.prototype['hasIn' + capitalized] = function (subkey) {
      return this._findInherited(key, subkey) !== undefined;
    };
  }

  Meta.prototype._getInherited = function (key) {
    var pointer = this;
    while (pointer !== undefined) {
      if (pointer[key]) {
        return pointer[key];
      }
      pointer = pointer.parent;
    }
  };

  Meta.prototype._findInherited = function (key, subkey) {
    var pointer = this;
    while (pointer !== undefined) {
      var map = pointer[key];
      if (map) {
        var value = map[subkey];
        if (value !== undefined) {
          return value;
        }
      }
      pointer = pointer.parent;
    }
  };

  var UNDEFINED = _emberUtils.symbol('undefined');

  exports.UNDEFINED = UNDEFINED;
  // Implements a member that provides a lazily created map of maps,
  // with inheritance at both levels.
  Meta.prototype.writeDeps = function writeDeps(subkey, itemkey, value) {
    _emberMetalDebug.assert('Cannot call writeDeps after the object is destroyed.', !this.isMetaDestroyed());

    var outerMap = this._getOrCreateOwnMap('_deps');
    var innerMap = outerMap[subkey];
    if (!innerMap) {
      innerMap = outerMap[subkey] = new _emberUtils.EmptyObject();
    }
    innerMap[itemkey] = value;
  };

  Meta.prototype.peekDeps = function peekDeps(subkey, itemkey) {
    var pointer = this;
    while (pointer !== undefined) {
      var map = pointer._deps;
      if (map) {
        var value = map[subkey];
        if (value) {
          if (value[itemkey] !== undefined) {
            return value[itemkey];
          }
        }
      }
      pointer = pointer.parent;
    }
  };

  Meta.prototype.hasDeps = function hasDeps(subkey) {
    var pointer = this;
    while (pointer !== undefined) {
      if (pointer._deps && pointer._deps[subkey]) {
        return true;
      }
      pointer = pointer.parent;
    }
    return false;
  };

  Meta.prototype.forEachInDeps = function forEachInDeps(subkey, fn) {
    return this._forEachIn('_deps', subkey, fn);
  };

  Meta.prototype._forEachIn = function (key, subkey, fn) {
    var pointer = this;
    var seen = new _emberUtils.EmptyObject();
    var calls = [];
    while (pointer !== undefined) {
      var map = pointer[key];
      if (map) {
        var innerMap = map[subkey];
        if (innerMap) {
          for (var innerKey in innerMap) {
            if (!seen[innerKey]) {
              seen[innerKey] = true;
              calls.push([innerKey, innerMap[innerKey]]);
            }
          }
        }
      }
      pointer = pointer.parent;
    }
    for (var i = 0; i < calls.length; i++) {
      var _calls$i = calls[i];
      var innerKey = _calls$i[0];
      var value = _calls$i[1];

      fn(innerKey, value);
    }
  };

  // Implements a member that provides a non-heritable, lazily-created
  // object using the method you provide.
  function ownCustomObject(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function (create) {
      _emberMetalDebug.assert('Cannot call writable' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var ret = this[key];
      if (!ret) {
        ret = this[key] = create(this.source);
      }
      return ret;
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this[key];
    };
  }

  // Implements a member that provides an inheritable, lazily-created
  // object using the method you provide. We will derived children from
  // their parents by calling your object's `copy()` method.
  function inheritedCustomObject(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function (create) {
      _emberMetalDebug.assert('Cannot call writable' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var ret = this[key];
      if (!ret) {
        if (this.parent) {
          ret = this[key] = this.parent['writable' + capitalized](create).copy(this.source);
        } else {
          ret = this[key] = create(this.source);
        }
      }
      return ret;
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this._getInherited(key);
    };
  }

  function memberProperty(name) {
    return '_' + name;
  }

  // there's a more general-purpose capitalize in ember-runtime, but we
  // don't want to make ember-metal depend on ember-runtime.
  function capitalize(name) {
    return name.replace(/^\w/, function (m) {
      return m.toUpperCase();
    });
  }

  var META_DESC = {
    writable: true,
    configurable: true,
    enumerable: false,
    value: null
  };

  exports.META_DESC = META_DESC;
  var EMBER_META_PROPERTY = {
    name: META_FIELD,
    descriptor: META_DESC
  };

  if (_emberMetalFeatures.default('mandatory-setter')) {
    Meta.prototype.readInheritedValue = function (key, subkey) {
      var internalKey = '_' + key;

      var pointer = this;

      while (pointer !== undefined) {
        var map = pointer[internalKey];
        if (map) {
          var value = map[subkey];
          if (value !== undefined || subkey in map) {
            return map[subkey];
          }
        }
        pointer = pointer.parent;
      }

      return UNDEFINED;
    };

    Meta.prototype.writeValue = function (obj, key, value) {
      var descriptor = _emberUtils.lookupDescriptor(obj, key);
      var isMandatorySetter = descriptor && descriptor.set && descriptor.set.isMandatorySetter;

      if (isMandatorySetter) {
        this.writeValues(key, value);
      } else {
        obj[key] = value;
      }
    };
  }

  var HAS_NATIVE_WEAKMAP = (function () {
    // detect if `WeakMap` is even present
    var hasWeakMap = typeof WeakMap === 'function';
    if (!hasWeakMap) {
      return false;
    }

    var instance = new WeakMap();
    // use `Object`'s `.toString` directly to prevent us from detecting
    // polyfills as native weakmaps
    return Object.prototype.toString.call(instance) === '[object WeakMap]';
  })();

  var setMeta = undefined,
      peekMeta = undefined;

  // choose the one appropriate for given platform
  if (HAS_NATIVE_WEAKMAP) {
    (function () {
      var getPrototypeOf = Object.getPrototypeOf;
      var metaStore = new WeakMap();

      exports.setMeta = setMeta = function WeakMap_setMeta(obj, meta) {
        _emberMetalDebug.runInDebug(function () {
          return counters.setCalls++;
        });
        metaStore.set(obj, meta);
      };

      exports.peekMeta = peekMeta = function WeakMap_peekMeta(obj) {
        _emberMetalDebug.runInDebug(function () {
          return counters.peekCalls++;
        });

        return metaStore.get(obj);
      };

      exports.peekMeta = peekMeta = function WeakMap_peekParentMeta(obj) {
        var pointer = obj;
        var meta = undefined;
        while (pointer) {
          meta = metaStore.get(pointer);
          // jshint loopfunc:true
          _emberMetalDebug.runInDebug(function () {
            return counters.peekCalls++;
          });
          // stop if we find a `null` value, since
          // that means the meta was deleted
          // any other truthy value is a "real" meta
          if (meta === null || meta) {
            return meta;
          }

          pointer = getPrototypeOf(pointer);
          _emberMetalDebug.runInDebug(function () {
            return counters.peakPrototypeWalks++;
          });
        }
      };
    })();
  } else {
    exports.setMeta = setMeta = function Fallback_setMeta(obj, meta) {
      // if `null` already, just set it to the new value
      // otherwise define property first
      if (obj[META_FIELD] !== null) {
        if (obj.__defineNonEnumerable) {
          obj.__defineNonEnumerable(EMBER_META_PROPERTY);
        } else {
          Object.defineProperty(obj, META_FIELD, META_DESC);
        }
      }

      obj[META_FIELD] = meta;
    };

    exports.peekMeta = peekMeta = function Fallback_peekMeta(obj) {
      return obj[META_FIELD];
    };
  }

  function deleteMeta(obj) {
    _emberMetalDebug.runInDebug(function () {
      return counters.deleteCalls++;
    });

    var meta = peekMeta(obj);
    if (meta) {
      meta.destroy();
    }
  }

  /**
    Retrieves the meta hash for an object. If `writable` is true ensures the
    hash is writable for this object as well.
  
    The meta object contains information about computed property descriptors as
    well as any watched properties and other information. You generally will
    not access this information directly but instead work with higher level
    methods that manipulate this hash indirectly.
  
    @method meta
    @for Ember
    @private
  
    @param {Object} obj The object to retrieve meta for
    @param {Boolean} [writable=true] Pass `false` if you do not intend to modify
      the meta hash, allowing the method to avoid making an unnecessary copy.
    @return {Object} the meta hash for an object
  */

  function meta(obj) {
    _emberMetalDebug.runInDebug(function () {
      return counters.metaCalls++;
    });

    var maybeMeta = peekMeta(obj);
    var parent = undefined;

    // remove this code, in-favor of explicit parent
    if (maybeMeta) {
      if (maybeMeta.source === obj) {
        return maybeMeta;
      }
      parent = maybeMeta;
    }

    var newMeta = new Meta(obj, parent);
    setMeta(obj, newMeta);
    return newMeta;
  }

  exports.peekMeta = peekMeta;
  exports.setMeta = setMeta;
  exports.counters = counters;
});
enifed('ember-metal/meta_listeners', ['exports'], function (exports) {
  /*
   When we render a rich template hierarchy, the set of events that
   *might* happen tends to be much larger than the set of events that
   actually happen. This implies that we should make listener creation &
   destruction cheap, even at the cost of making event dispatch more
   expensive.
  
   Thus we store a new listener with a single push and no new
   allocations, without even bothering to do deduplication -- we can
   save that for dispatch time, if an event actually happens.
   */

  /* listener flags */
  'use strict';

  var ONCE = 1;
  exports.ONCE = ONCE;
  var SUSPENDED = 2;

  exports.SUSPENDED = SUSPENDED;
  var protoMethods = {

    addToListeners: function (eventName, target, method, flags) {
      if (!this._listeners) {
        this._listeners = [];
      }
      this._listeners.push(eventName, target, method, flags);
    },

    _finalizeListeners: function () {
      if (this._listenersFinalized) {
        return;
      }
      if (!this._listeners) {
        this._listeners = [];
      }
      var pointer = this.parent;
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          this._listeners = this._listeners.concat(listeners);
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      this._listenersFinalized = true;
    },

    removeFromListeners: function (eventName, target, method, didRemove) {
      var pointer = this;
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = listeners.length - 4; index >= 0; index -= 4) {
            if (listeners[index] === eventName && (!method || listeners[index + 1] === target && listeners[index + 2] === method)) {
              if (pointer === this) {
                // we are modifying our own list, so we edit directly
                if (typeof didRemove === 'function') {
                  didRemove(eventName, target, listeners[index + 2]);
                }
                listeners.splice(index, 4);
              } else {
                // we are trying to remove an inherited listener, so we do
                // just-in-time copying to detach our own listeners from
                // our inheritance chain.
                this._finalizeListeners();
                return this.removeFromListeners(eventName, target, method);
              }
            }
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
    },

    matchingListeners: function (eventName) {
      var pointer = this;
      var result = [];
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = 0; index < listeners.length - 3; index += 4) {
            if (listeners[index] === eventName) {
              pushUniqueListener(result, listeners, index);
            }
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      var sus = this._suspendedListeners;
      if (sus) {
        for (var susIndex = 0; susIndex < sus.length - 2; susIndex += 3) {
          if (eventName === sus[susIndex]) {
            for (var resultIndex = 0; resultIndex < result.length - 2; resultIndex += 3) {
              if (result[resultIndex] === sus[susIndex + 1] && result[resultIndex + 1] === sus[susIndex + 2]) {
                result[resultIndex + 2] |= SUSPENDED;
              }
            }
          }
        }
      }
      return result;
    },

    suspendListeners: function (eventNames, target, method, callback) {
      var sus = this._suspendedListeners;
      if (!sus) {
        sus = this._suspendedListeners = [];
      }
      for (var i = 0; i < eventNames.length; i++) {
        sus.push(eventNames[i], target, method);
      }
      try {
        return callback.call(target);
      } finally {
        if (sus.length === eventNames.length) {
          this._suspendedListeners = undefined;
        } else {
          for (var i = sus.length - 3; i >= 0; i -= 3) {
            if (sus[i + 1] === target && sus[i + 2] === method && eventNames.indexOf(sus[i]) !== -1) {
              sus.splice(i, 3);
            }
          }
        }
      }
    },

    watchedEvents: function () {
      var pointer = this;
      var names = {};
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = 0; index < listeners.length - 3; index += 4) {
            names[listeners[index]] = true;
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      return Object.keys(names);
    },

    _initializeListeners: function () {
      this._listeners = undefined;
      this._listenersFinalized = undefined;
      this._suspendedListeners = undefined;
    }
  };

  exports.protoMethods = protoMethods;
  function pushUniqueListener(destination, source, index) {
    var target = source[index + 1];
    var method = source[index + 2];
    for (var destinationIndex = 0; destinationIndex < destination.length - 2; destinationIndex += 3) {
      if (destination[destinationIndex] === target && destination[destinationIndex + 1] === method) {
        return;
      }
    }
    destination.push(target, method, source[index + 3]);
  }
});
enifed('ember-metal/mixin', ['exports', 'ember-utils', 'ember-metal/error', 'ember-metal/debug', 'ember-metal/meta', 'ember-metal/expand_properties', 'ember-metal/properties', 'ember-metal/computed', 'ember-metal/binding', 'ember-metal/observer', 'ember-metal/events'], function (exports, _emberUtils, _emberMetalError, _emberMetalDebug, _emberMetalMeta, _emberMetalExpand_properties, _emberMetalProperties, _emberMetalComputed, _emberMetalBinding, _emberMetalObserver, _emberMetalEvents) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  /**
  @module ember
  @submodule ember-metal
  */
  exports.detectBinding = detectBinding;
  exports.mixin = mixin;
  exports.default = Mixin;
  exports.hasUnprocessedMixins = hasUnprocessedMixins;
  exports.clearUnprocessedMixins = clearUnprocessedMixins;
  exports.required = required;
  exports.aliasMethod = aliasMethod;
  exports.observer = observer;
  exports._immediateObserver = _immediateObserver;
  exports._beforeObserver = _beforeObserver;

  function ROOT() {}
  ROOT.__hasSuper = false;

  var a_slice = [].slice;

  function isMethod(obj) {
    return 'function' === typeof obj && obj.isMethod !== false && obj !== Boolean && obj !== Object && obj !== Number && obj !== Array && obj !== Date && obj !== String;
  }

  var CONTINUE = {};

  function mixinProperties(mixinsMeta, mixin) {
    var guid = undefined;

    if (mixin instanceof Mixin) {
      guid = _emberUtils.guidFor(mixin);
      if (mixinsMeta.peekMixins(guid)) {
        return CONTINUE;
      }
      mixinsMeta.writeMixins(guid, mixin);
      return mixin.properties;
    } else {
      return mixin; // apply anonymous mixin properties
    }
  }

  function concatenatedMixinProperties(concatProp, props, values, base) {
    var concats = undefined;

    // reset before adding each new mixin to pickup concats from previous
    concats = values[concatProp] || base[concatProp];
    if (props[concatProp]) {
      concats = concats ? concats.concat(props[concatProp]) : props[concatProp];
    }

    return concats;
  }

  function giveDescriptorSuper(meta, key, property, values, descs, base) {
    var superProperty = undefined;

    // Computed properties override methods, and do not call super to them
    if (values[key] === undefined) {
      // Find the original descriptor in a parent mixin
      superProperty = descs[key];
    }

    // If we didn't find the original descriptor in a parent mixin, find
    // it on the original object.
    if (!superProperty) {
      var possibleDesc = base[key];
      var superDesc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      superProperty = superDesc;
    }

    if (superProperty === undefined || !(superProperty instanceof _emberMetalComputed.ComputedProperty)) {
      return property;
    }

    // Since multiple mixins may inherit from the same parent, we need
    // to clone the computed property so that other mixins do not receive
    // the wrapped version.
    property = Object.create(property);
    property._getter = _emberUtils.wrap(property._getter, superProperty._getter);
    if (superProperty._setter) {
      if (property._setter) {
        property._setter = _emberUtils.wrap(property._setter, superProperty._setter);
      } else {
        property._setter = superProperty._setter;
      }
    }

    return property;
  }

  function giveMethodSuper(obj, key, method, values, descs) {
    var superMethod = undefined;

    // Methods overwrite computed properties, and do not call super to them.
    if (descs[key] === undefined) {
      // Find the original method in a parent mixin
      superMethod = values[key];
    }

    // If we didn't find the original value in a parent mixin, find it in
    // the original object
    superMethod = superMethod || obj[key];

    // Only wrap the new method if the original method was a function
    if (superMethod === undefined || 'function' !== typeof superMethod) {
      return method;
    }

    return _emberUtils.wrap(method, superMethod);
  }

  function applyConcatenatedProperties(obj, key, value, values) {
    var baseValue = values[key] || obj[key];

    if (baseValue) {
      if ('function' === typeof baseValue.concat) {
        if (value === null || value === undefined) {
          return baseValue;
        } else {
          return baseValue.concat(value);
        }
      } else {
        return _emberUtils.makeArray(baseValue).concat(value);
      }
    } else {
      return _emberUtils.makeArray(value);
    }
  }

  function applyMergedProperties(obj, key, value, values) {
    var baseValue = values[key] || obj[key];

    _emberMetalDebug.runInDebug(function () {
      if (Array.isArray(value)) {
        // use conditional to avoid stringifying every time
        _emberMetalDebug.assert('You passed in `' + JSON.stringify(value) + '` as the value for `' + key + '` but `' + key + '` cannot be an Array', false);
      }
    });

    if (!baseValue) {
      return value;
    }

    var newBase = _emberUtils.assign({}, baseValue);
    var hasFunction = false;

    for (var prop in value) {
      if (!value.hasOwnProperty(prop)) {
        continue;
      }

      var propValue = value[prop];
      if (isMethod(propValue)) {
        // TODO: support for Computed Properties, etc?
        hasFunction = true;
        newBase[prop] = giveMethodSuper(obj, prop, propValue, baseValue, {});
      } else {
        newBase[prop] = propValue;
      }
    }

    if (hasFunction) {
      newBase._super = ROOT;
    }

    return newBase;
  }

  function addNormalizedProperty(base, key, value, meta, descs, values, concats, mergings) {
    if (value instanceof _emberMetalProperties.Descriptor) {
      if (value === REQUIRED && descs[key]) {
        return CONTINUE;
      }

      // Wrap descriptor function to implement
      // _super() if needed
      if (value._getter) {
        value = giveDescriptorSuper(meta, key, value, values, descs, base);
      }

      descs[key] = value;
      values[key] = undefined;
    } else {
      if (concats && concats.indexOf(key) >= 0 || key === 'concatenatedProperties' || key === 'mergedProperties') {
        value = applyConcatenatedProperties(base, key, value, values);
      } else if (mergings && mergings.indexOf(key) >= 0) {
        value = applyMergedProperties(base, key, value, values);
      } else if (isMethod(value)) {
        value = giveMethodSuper(base, key, value, values, descs);
      }

      descs[key] = undefined;
      values[key] = value;
    }
  }

  function mergeMixins(mixins, m, descs, values, base, keys) {
    var currentMixin = undefined,
        props = undefined,
        key = undefined,
        concats = undefined,
        mergings = undefined;

    function removeKeys(keyName) {
      delete descs[keyName];
      delete values[keyName];
    }

    for (var i = 0; i < mixins.length; i++) {
      currentMixin = mixins[i];
      _emberMetalDebug.assert('Expected hash or Mixin instance, got ' + Object.prototype.toString.call(currentMixin), typeof currentMixin === 'object' && currentMixin !== null && Object.prototype.toString.call(currentMixin) !== '[object Array]');

      props = mixinProperties(m, currentMixin);
      if (props === CONTINUE) {
        continue;
      }

      if (props) {
        if (base.willMergeMixin) {
          base.willMergeMixin(props);
        }
        concats = concatenatedMixinProperties('concatenatedProperties', props, values, base);
        mergings = concatenatedMixinProperties('mergedProperties', props, values, base);

        for (key in props) {
          if (!props.hasOwnProperty(key)) {
            continue;
          }
          keys.push(key);
          addNormalizedProperty(base, key, props[key], m, descs, values, concats, mergings);
        }

        // manually copy toString() because some JS engines do not enumerate it
        if (props.hasOwnProperty('toString')) {
          base.toString = props.toString;
        }
      } else if (currentMixin.mixins) {
        mergeMixins(currentMixin.mixins, m, descs, values, base, keys);
        if (currentMixin._without) {
          currentMixin._without.forEach(removeKeys);
        }
      }
    }
  }

  function detectBinding(key) {
    var length = key.length;

    return length > 7 && key.charCodeAt(length - 7) === 66 && key.indexOf('inding', length - 6) !== -1;
  }

  // warm both paths of above function
  detectBinding('notbound');
  detectBinding('fooBinding');

  function connectBindings(obj, m) {
    // TODO Mixin.apply(instance) should disconnect binding if exists
    m.forEachBindings(function (key, binding) {
      if (binding) {
        var to = key.slice(0, -7); // strip Binding off end
        if (binding instanceof _emberMetalBinding.Binding) {
          binding = binding.copy(); // copy prototypes' instance
          binding.to(to);
        } else {
          // binding is string path
          binding = new _emberMetalBinding.Binding(to, binding);
        }
        binding.connect(obj);
        obj[key] = binding;
      }
    });
    // mark as applied
    m.clearBindings();
  }

  function finishPartial(obj, m) {
    connectBindings(obj, m || _emberMetalMeta.meta(obj));
    return obj;
  }

  function followAlias(obj, desc, m, descs, values) {
    var altKey = desc.methodName;
    var value = undefined;
    var possibleDesc = undefined;
    if (descs[altKey] || values[altKey]) {
      value = values[altKey];
      desc = descs[altKey];
    } else if ((possibleDesc = obj[altKey]) && possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor) {
      desc = possibleDesc;
      value = undefined;
    } else {
      desc = undefined;
      value = obj[altKey];
    }

    return { desc: desc, value: value };
  }

  function updateObserversAndListeners(obj, key, observerOrListener, pathsKey, updateMethod) {
    var paths = observerOrListener[pathsKey];

    if (paths) {
      for (var i = 0; i < paths.length; i++) {
        updateMethod(obj, paths[i], null, key);
      }
    }
  }

  function replaceObserversAndListeners(obj, key, observerOrListener) {
    var prev = obj[key];

    if ('function' === typeof prev) {
      updateObserversAndListeners(obj, key, prev, '__ember_observesBefore__', _emberMetalObserver._removeBeforeObserver);
      updateObserversAndListeners(obj, key, prev, '__ember_observes__', _emberMetalObserver.removeObserver);
      updateObserversAndListeners(obj, key, prev, '__ember_listens__', _emberMetalEvents.removeListener);
    }

    if ('function' === typeof observerOrListener) {
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_observesBefore__', _emberMetalObserver._addBeforeObserver);
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_observes__', _emberMetalObserver.addObserver);
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_listens__', _emberMetalEvents.addListener);
    }
  }

  function applyMixin(obj, mixins, partial) {
    var descs = {};
    var values = {};
    var m = _emberMetalMeta.meta(obj);
    var keys = [];
    var key = undefined,
        value = undefined,
        desc = undefined;

    obj._super = ROOT;

    // Go through all mixins and hashes passed in, and:
    //
    // * Handle concatenated properties
    // * Handle merged properties
    // * Set up _super wrapping if necessary
    // * Set up computed property descriptors
    // * Copying `toString` in broken browsers
    mergeMixins(mixins, m, descs, values, obj, keys);

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      if (key === 'constructor' || !values.hasOwnProperty(key)) {
        continue;
      }

      desc = descs[key];
      value = values[key];

      if (desc === REQUIRED) {
        continue;
      }

      while (desc && desc instanceof Alias) {
        var followed = followAlias(obj, desc, m, descs, values);
        desc = followed.desc;
        value = followed.value;
      }

      if (desc === undefined && value === undefined) {
        continue;
      }

      replaceObserversAndListeners(obj, key, value);

      if (detectBinding(key)) {
        m.writeBindings(key, value);
      }

      _emberMetalProperties.defineProperty(obj, key, desc, value, m);
    }

    if (!partial) {
      // don't apply to prototype
      finishPartial(obj, m);
    }

    return obj;
  }

  /**
    @method mixin
    @for Ember
    @param obj
    @param mixins*
    @return obj
    @private
  */

  function mixin(obj) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    applyMixin(obj, args, false);
    return obj;
  }

  var NAME_KEY = _emberUtils.GUID_KEY + '_name';

  exports.NAME_KEY = NAME_KEY;
  /**
    The `Ember.Mixin` class allows you to create mixins, whose properties can be
    added to other classes. For instance,
  
    ```javascript
    const EditableMixin = Ember.Mixin.create({
      edit() {
        console.log('starting to edit');
        this.set('isEditing', true);
      },
      isEditing: false
    });
  
    // Mix mixins into classes by passing them as the first arguments to
    // `.extend.`
    const Comment = Ember.Object.extend(EditableMixin, {
      post: null
    });
  
    let comment = Comment.create(post: somePost);
    comment.edit(); // outputs 'starting to edit'
    ```
  
    Note that Mixins are created with `Ember.Mixin.create`, not
    `Ember.Mixin.extend`.
  
    Note that mixins extend a constructor's prototype so arrays and object literals
    defined as properties will be shared amongst objects that implement the mixin.
    If you want to define a property in a mixin that is not shared, you can define
    it either as a computed property or have it be created on initialization of the object.
  
    ```javascript
    // filters array will be shared amongst any object implementing mixin
    const FilterableMixin = Ember.Mixin.create({
      filters: Ember.A()
    });
  
    // filters will be a separate array for every object implementing the mixin
    const FilterableMixin = Ember.Mixin.create({
      filters: Ember.computed(function() {
        return Ember.A();
      })
    });
  
    // filters will be created as a separate array during the object's initialization
    const Filterable = Ember.Mixin.create({
      init() {
        this._super(...arguments);
        this.set("filters", Ember.A());
      }
    });
    ```
  
    @class Mixin
    @namespace Ember
    @public
  */

  function Mixin(args, properties) {
    this.properties = properties;

    var length = args && args.length;

    if (length > 0) {
      var m = new Array(length);

      for (var i = 0; i < length; i++) {
        var x = args[i];
        if (x instanceof Mixin) {
          m[i] = x;
        } else {
          m[i] = new Mixin(undefined, x);
        }
      }

      this.mixins = m;
    } else {
      this.mixins = undefined;
    }
    this.ownerConstructor = undefined;
    this._without = undefined;
    this[_emberUtils.GUID_KEY] = null;
    this[NAME_KEY] = null;
    _emberMetalDebug.debugSeal(this);
  }

  Mixin._apply = applyMixin;

  Mixin.applyPartial = function (obj) {
    var args = a_slice.call(arguments, 1);
    return applyMixin(obj, args, true);
  };

  Mixin.finishPartial = finishPartial;

  var unprocessedFlag = false;

  function hasUnprocessedMixins() {
    return unprocessedFlag;
  }

  function clearUnprocessedMixins() {
    unprocessedFlag = false;
  }

  /**
    @method create
    @static
    @param arguments*
    @public
  */
  Mixin.create = function () {
    // ES6TODO: this relies on a global state?
    unprocessedFlag = true;
    var M = this;

    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return new M(args, undefined);
  };

  var MixinPrototype = Mixin.prototype;

  /**
    @method reopen
    @param arguments*
    @private
  */
  MixinPrototype.reopen = function () {
    var currentMixin = undefined;

    if (this.properties) {
      currentMixin = new Mixin(undefined, this.properties);
      this.properties = undefined;
      this.mixins = [currentMixin];
    } else if (!this.mixins) {
      this.mixins = [];
    }

    var mixins = this.mixins;
    var idx = undefined;

    for (idx = 0; idx < arguments.length; idx++) {
      currentMixin = arguments[idx];
      _emberMetalDebug.assert('Expected hash or Mixin instance, got ' + Object.prototype.toString.call(currentMixin), typeof currentMixin === 'object' && currentMixin !== null && Object.prototype.toString.call(currentMixin) !== '[object Array]');

      if (currentMixin instanceof Mixin) {
        mixins.push(currentMixin);
      } else {
        mixins.push(new Mixin(undefined, currentMixin));
      }
    }

    return this;
  };

  /**
    @method apply
    @param obj
    @return applied object
    @private
  */
  MixinPrototype.apply = function (obj) {
    return applyMixin(obj, [this], false);
  };

  MixinPrototype.applyPartial = function (obj) {
    return applyMixin(obj, [this], true);
  };

  MixinPrototype.toString = Object.toString;

  function _detect(curMixin, targetMixin, seen) {
    var guid = _emberUtils.guidFor(curMixin);

    if (seen[guid]) {
      return false;
    }
    seen[guid] = true;

    if (curMixin === targetMixin) {
      return true;
    }
    var mixins = curMixin.mixins;
    var loc = mixins ? mixins.length : 0;
    while (--loc >= 0) {
      if (_detect(mixins[loc], targetMixin, seen)) {
        return true;
      }
    }
    return false;
  }

  /**
    @method detect
    @param obj
    @return {Boolean}
    @private
  */
  MixinPrototype.detect = function (obj) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    if (obj instanceof Mixin) {
      return _detect(obj, this, {});
    }
    var m = _emberMetalMeta.peekMeta(obj);
    if (!m) {
      return false;
    }
    return !!m.peekMixins(_emberUtils.guidFor(this));
  };

  MixinPrototype.without = function () {
    var ret = new Mixin([this]);

    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    ret._without = args;
    return ret;
  };

  function _keys(ret, mixin, seen) {
    if (seen[_emberUtils.guidFor(mixin)]) {
      return;
    }
    seen[_emberUtils.guidFor(mixin)] = true;

    if (mixin.properties) {
      var props = Object.keys(mixin.properties);
      for (var i = 0; i < props.length; i++) {
        var key = props[i];
        ret[key] = true;
      }
    } else if (mixin.mixins) {
      mixin.mixins.forEach(function (x) {
        return _keys(ret, x, seen);
      });
    }
  }

  MixinPrototype.keys = function () {
    var keys = {};
    var seen = {};

    _keys(keys, this, seen);
    var ret = Object.keys(keys);
    return ret;
  };

  _emberMetalDebug.debugSeal(MixinPrototype);

  // returns the mixins currently applied to the specified object
  // TODO: Make Ember.mixin
  Mixin.mixins = function (obj) {
    var m = _emberMetalMeta.peekMeta(obj);
    var ret = [];
    if (!m) {
      return ret;
    }

    m.forEachMixins(function (key, currentMixin) {
      // skip primitive mixins since these are always anonymous
      if (!currentMixin.properties) {
        ret.push(currentMixin);
      }
    });

    return ret;
  };

  var REQUIRED = new _emberMetalProperties.Descriptor();
  REQUIRED.toString = function () {
    return '(Required Property)';
  };

  /**
    Denotes a required property for a mixin
  
    @method required
    @for Ember
    @private
  */

  function required() {
    _emberMetalDebug.deprecate('Ember.required is deprecated as its behavior is inconsistent and unreliable.', false, { id: 'ember-metal.required', until: '3.0.0' });
    return REQUIRED;
  }

  function Alias(methodName) {
    this.isDescriptor = true;
    this.methodName = methodName;
  }

  Alias.prototype = new _emberMetalProperties.Descriptor();

  /**
    Makes a method available via an additional name.
  
    ```javascript
    App.Person = Ember.Object.extend({
      name: function() {
        return 'Tomhuda Katzdale';
      },
      moniker: Ember.aliasMethod('name')
    });
  
    let goodGuy = App.Person.create();
  
    goodGuy.name();    // 'Tomhuda Katzdale'
    goodGuy.moniker(); // 'Tomhuda Katzdale'
    ```
  
    @method aliasMethod
    @for Ember
    @param {String} methodName name of the method to alias
    @public
  */

  function aliasMethod(methodName) {
    return new Alias(methodName);
  }

  // ..........................................................
  // OBSERVER HELPER
  //

  /**
    Specify a method that observes property changes.
  
    ```javascript
    Ember.Object.extend({
      valueObserver: Ember.observer('value', function() {
        // Executes whenever the "value" property changes
      })
    });
    ```
  
    Also available as `Function.prototype.observes` if prototype extensions are
    enabled.
  
    @method observer
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @return func
    @public
  */

  function observer() {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    var func = args.slice(-1)[0];
    var paths = undefined;

    var addWatchedProperty = function (path) {
      paths.push(path);
    };
    var _paths = args.slice(0, -1);

    if (typeof func !== 'function') {
      // revert to old, soft-deprecated argument ordering
      _emberMetalDebug.deprecate('Passing the dependentKeys after the callback function in Ember.observer is deprecated. Ensure the callback function is the last argument.', false, { id: 'ember-metal.observer-argument-order', until: '3.0.0' });

      func = args[0];
      _paths = args.slice(1);
    }

    paths = [];

    for (var i = 0; i < _paths.length; ++i) {
      _emberMetalExpand_properties.default(_paths[i], addWatchedProperty);
    }

    if (typeof func !== 'function') {
      throw new _emberMetalError.default('Ember.observer called without a function');
    }

    func.__ember_observes__ = paths;
    return func;
  }

  /**
    Specify a method that observes property changes.
  
    ```javascript
    Ember.Object.extend({
      valueObserver: Ember.immediateObserver('value', function() {
        // Executes whenever the "value" property changes
      })
    });
    ```
  
    In the future, `Ember.observer` may become asynchronous. In this event,
    `Ember.immediateObserver` will maintain the synchronous behavior.
  
    Also available as `Function.prototype.observesImmediately` if prototype extensions are
    enabled.
  
    @method _immediateObserver
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @deprecated Use `Ember.observer` instead.
    @return func
    @private
  */

  function _immediateObserver() {
    _emberMetalDebug.deprecate('Usage of `Ember.immediateObserver` is deprecated, use `Ember.observer` instead.', false, { id: 'ember-metal.immediate-observer', until: '3.0.0' });

    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      _emberMetalDebug.assert('Immediate observers must observe internal properties only, not properties on other objects.', typeof arg !== 'string' || arg.indexOf('.') === -1);
    }

    return observer.apply(this, arguments);
  }

  /**
    When observers fire, they are called with the arguments `obj`, `keyName`.
  
    Note, `@each.property` observer is called per each add or replace of an element
    and it's not called with a specific enumeration item.
  
    A `_beforeObserver` fires before a property changes.
  
    @method beforeObserver
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @return func
    @deprecated
    @private
  */

  function _beforeObserver() {
    for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
      args[_key5] = arguments[_key5];
    }

    var func = args.slice(-1)[0];
    var paths = undefined;

    var addWatchedProperty = function (path) {
      paths.push(path);
    };

    var _paths = args.slice(0, -1);

    if (typeof func !== 'function') {
      // revert to old, soft-deprecated argument ordering

      func = args[0];
      _paths = args.slice(1);
    }

    paths = [];

    for (var i = 0; i < _paths.length; ++i) {
      _emberMetalExpand_properties.default(_paths[i], addWatchedProperty);
    }

    if (typeof func !== 'function') {
      throw new _emberMetalError.default('_beforeObserver called without a function');
    }

    func.__ember_observesBefore__ = paths;
    return func;
  }

  exports.Mixin = Mixin;
  exports.required = required;
  exports.REQUIRED = REQUIRED;
});
enifed('ember-metal/observer', ['exports', 'ember-metal/watching', 'ember-metal/events'], function (exports, _emberMetalWatching, _emberMetalEvents) {
  'use strict';

  exports.addObserver = addObserver;
  exports.observersFor = observersFor;
  exports.removeObserver = removeObserver;
  exports._addBeforeObserver = _addBeforeObserver;
  exports._suspendObserver = _suspendObserver;
  exports._suspendObservers = _suspendObservers;
  exports._removeBeforeObserver = _removeBeforeObserver;

  /**
  @module ember-metal
  */

  var AFTER_OBSERVERS = ':change';
  var BEFORE_OBSERVERS = ':before';

  function changeEvent(keyName) {
    return keyName + AFTER_OBSERVERS;
  }

  function beforeEvent(keyName) {
    return keyName + BEFORE_OBSERVERS;
  }

  /**
    @method addObserver
    @for Ember
    @param obj
    @param {String} _path
    @param {Object|Function} target
    @param {Function|String} [method]
    @public
  */

  function addObserver(obj, _path, target, method) {
    _emberMetalEvents.addListener(obj, changeEvent(_path), target, method);
    _emberMetalWatching.watch(obj, _path);

    return this;
  }

  function observersFor(obj, path) {
    return _emberMetalEvents.listenersFor(obj, changeEvent(path));
  }

  /**
    @method removeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @public
  */

  function removeObserver(obj, path, target, method) {
    _emberMetalWatching.unwatch(obj, path);
    _emberMetalEvents.removeListener(obj, changeEvent(path), target, method);

    return this;
  }

  /**
    @method _addBeforeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @deprecated
    @private
  */

  function _addBeforeObserver(obj, path, target, method) {
    _emberMetalEvents.addListener(obj, beforeEvent(path), target, method);
    _emberMetalWatching.watch(obj, path);

    return this;
  }

  // Suspend observer during callback.
  //
  // This should only be used by the target of the observer
  // while it is setting the observed path.

  function _suspendObserver(obj, path, target, method, callback) {
    return _emberMetalEvents.suspendListener(obj, changeEvent(path), target, method, callback);
  }

  function _suspendObservers(obj, paths, target, method, callback) {
    var events = paths.map(changeEvent);
    return _emberMetalEvents.suspendListeners(obj, events, target, method, callback);
  }

  /**
    @method removeBeforeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @deprecated
    @private
  */

  function _removeBeforeObserver(obj, path, target, method) {
    _emberMetalWatching.unwatch(obj, path);
    _emberMetalEvents.removeListener(obj, beforeEvent(path), target, method);

    return this;
  }
});
enifed('ember-metal/observer_set', ['exports', 'ember-utils', 'ember-metal/events'], function (exports, _emberUtils, _emberMetalEvents) {
  'use strict';

  exports.default = ObserverSet;

  /*
    this.observerSet = {
      [senderGuid]: { // variable name: `keySet`
        [keyName]: listIndex
      }
    },
    this.observers = [
      {
        sender: obj,
        keyName: keyName,
        eventName: eventName,
        listeners: [
          [target, method, flags]
        ]
      },
      ...
    ]
  */

  function ObserverSet() {
    this.clear();
  }

  ObserverSet.prototype.add = function (sender, keyName, eventName) {
    var observerSet = this.observerSet;
    var observers = this.observers;
    var senderGuid = _emberUtils.guidFor(sender);
    var keySet = observerSet[senderGuid];
    var index = undefined;

    if (!keySet) {
      observerSet[senderGuid] = keySet = {};
    }
    index = keySet[keyName];
    if (index === undefined) {
      index = observers.push({
        sender: sender,
        keyName: keyName,
        eventName: eventName,
        listeners: []
      }) - 1;
      keySet[keyName] = index;
    }
    return observers[index].listeners;
  };

  ObserverSet.prototype.flush = function () {
    var observers = this.observers;
    var i = undefined,
        observer = undefined,
        sender = undefined;
    this.clear();
    for (i = 0; i < observers.length; ++i) {
      observer = observers[i];
      sender = observer.sender;
      if (sender.isDestroying || sender.isDestroyed) {
        continue;
      }
      _emberMetalEvents.sendEvent(sender, observer.eventName, [sender, observer.keyName], observer.listeners);
    }
  };

  ObserverSet.prototype.clear = function () {
    this.observerSet = {};
    this.observers = [];
  };
});
enifed('ember-metal/path_cache', ['exports', 'ember-metal/cache'], function (exports, _emberMetalCache) {
  'use strict';

  exports.isGlobal = isGlobal;
  exports.isGlobalPath = isGlobalPath;
  exports.hasThis = hasThis;
  exports.isPath = isPath;
  exports.getFirstKey = getFirstKey;
  exports.getTailPath = getTailPath;

  var IS_GLOBAL = /^[A-Z$]/;
  var IS_GLOBAL_PATH = /^[A-Z$].*[\.]/;
  var HAS_THIS = 'this.';

  var isGlobalCache = new _emberMetalCache.default(1000, function (key) {
    return IS_GLOBAL.test(key);
  });
  var isGlobalPathCache = new _emberMetalCache.default(1000, function (key) {
    return IS_GLOBAL_PATH.test(key);
  });
  var hasThisCache = new _emberMetalCache.default(1000, function (key) {
    return key.lastIndexOf(HAS_THIS, 0) === 0;
  });
  var firstDotIndexCache = new _emberMetalCache.default(1000, function (key) {
    return key.indexOf('.');
  });

  var firstKeyCache = new _emberMetalCache.default(1000, function (path) {
    var index = firstDotIndexCache.get(path);
    if (index === -1) {
      return path;
    } else {
      return path.slice(0, index);
    }
  });

  var tailPathCache = new _emberMetalCache.default(1000, function (path) {
    var index = firstDotIndexCache.get(path);
    if (index !== -1) {
      return path.slice(index + 1);
    }
  });

  var caches = {
    isGlobalCache: isGlobalCache,
    isGlobalPathCache: isGlobalPathCache,
    hasThisCache: hasThisCache,
    firstDotIndexCache: firstDotIndexCache,
    firstKeyCache: firstKeyCache,
    tailPathCache: tailPathCache
  };

  exports.caches = caches;

  function isGlobal(path) {
    return isGlobalCache.get(path);
  }

  function isGlobalPath(path) {
    return isGlobalPathCache.get(path);
  }

  function hasThis(path) {
    return hasThisCache.get(path);
  }

  function isPath(path) {
    return firstDotIndexCache.get(path) !== -1;
  }

  function getFirstKey(path) {
    return firstKeyCache.get(path);
  }

  function getTailPath(path) {
    return tailPathCache.get(path);
  }
});
enifed('ember-metal/properties', ['exports', 'ember-metal/debug', 'ember-metal/features', 'ember-metal/meta', 'ember-metal/property_events'], function (exports, _emberMetalDebug, _emberMetalFeatures, _emberMetalMeta, _emberMetalProperty_events) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.Descriptor = Descriptor;
  exports.MANDATORY_SETTER_FUNCTION = MANDATORY_SETTER_FUNCTION;
  exports.DEFAULT_GETTER_FUNCTION = DEFAULT_GETTER_FUNCTION;
  exports.INHERITING_GETTER_FUNCTION = INHERITING_GETTER_FUNCTION;
  exports.defineProperty = defineProperty;

  // ..........................................................
  // DESCRIPTOR
  //

  /**
    Objects of this type can implement an interface to respond to requests to
    get and set. The default implementation handles simple properties.
  
    @class Descriptor
    @private
  */

  function Descriptor() {
    this.isDescriptor = true;
  }

  var REDEFINE_SUPPORTED = (function () {
    // https://github.com/spalger/kibana/commit/b7e35e6737df585585332857a4c397dc206e7ff9
    var a = Object.create(Object.prototype, {
      prop: {
        configurable: true,
        value: 1
      }
    });

    Object.defineProperty(a, 'prop', {
      configurable: true,
      value: 2
    });

    return a.prop === 2;
  })();
  // ..........................................................
  // DEFINING PROPERTIES API
  //

  function MANDATORY_SETTER_FUNCTION(name) {
    function SETTER_FUNCTION(value) {
      var m = _emberMetalMeta.peekMeta(this);
      if (!m.isInitialized(this)) {
        m.writeValues(name, value);
      } else {
        _emberMetalDebug.assert('You must use Ember.set() to set the `' + name + '` property (of ' + this + ') to `' + value + '`.', false);
      }
    }

    SETTER_FUNCTION.isMandatorySetter = true;
    return SETTER_FUNCTION;
  }

  function DEFAULT_GETTER_FUNCTION(name) {
    return function GETTER_FUNCTION() {
      var meta = _emberMetalMeta.peekMeta(this);
      return meta && meta.peekValues(name);
    };
  }

  function INHERITING_GETTER_FUNCTION(name) {
    function IGETTER_FUNCTION() {
      var meta = _emberMetalMeta.peekMeta(this);
      var val = meta && meta.readInheritedValue('values', name);

      if (val === _emberMetalMeta.UNDEFINED) {
        var proto = Object.getPrototypeOf(this);
        return proto && proto[name];
      } else {
        return val;
      }
    }

    IGETTER_FUNCTION.isInheritingGetter = true;
    return IGETTER_FUNCTION;
  }

  /**
    NOTE: This is a low-level method used by other parts of the API. You almost
    never want to call this method directly. Instead you should use
    `Ember.mixin()` to define new properties.
  
    Defines a property on an object. This method works much like the ES5
    `Object.defineProperty()` method except that it can also accept computed
    properties and other special descriptors.
  
    Normally this method takes only three parameters. However if you pass an
    instance of `Descriptor` as the third param then you can pass an
    optional value as the fourth parameter. This is often more efficient than
    creating new descriptor hashes for each property.
  
    ## Examples
  
    ```javascript
    // ES5 compatible mode
    Ember.defineProperty(contact, 'firstName', {
      writable: true,
      configurable: false,
      enumerable: true,
      value: 'Charles'
    });
  
    // define a simple property
    Ember.defineProperty(contact, 'lastName', undefined, 'Jolley');
  
    // define a computed property
    Ember.defineProperty(contact, 'fullName', Ember.computed('firstName', 'lastName', function() {
      return this.firstName+' '+this.lastName;
    }));
    ```
  
    @private
    @method defineProperty
    @for Ember
    @param {Object} obj the object to define this property on. This may be a prototype.
    @param {String} keyName the name of the property
    @param {Descriptor} [desc] an instance of `Descriptor` (typically a
      computed property) or an ES5 descriptor.
      You must provide this or `data` but not both.
    @param {*} [data] something other than a descriptor, that will
      become the explicit value of this property.
  */

  function defineProperty(obj, keyName, desc, data, meta) {
    var possibleDesc = undefined,
        existingDesc = undefined,
        watching = undefined,
        value = undefined;

    if (!meta) {
      meta = _emberMetalMeta.meta(obj);
    }
    var watchEntry = meta.peekWatching(keyName);
    possibleDesc = obj[keyName];
    existingDesc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    watching = watchEntry !== undefined && watchEntry > 0;

    if (existingDesc) {
      existingDesc.teardown(obj, keyName);
    }

    if (desc instanceof Descriptor) {
      value = desc;
      if (_emberMetalFeatures.default('mandatory-setter')) {
        if (watching) {
          Object.defineProperty(obj, keyName, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: value
          });
        } else {
          obj[keyName] = value;
        }
      } else {
        obj[keyName] = value;
      }
      if (desc.setup) {
        desc.setup(obj, keyName);
      }
    } else {
      if (desc == null) {
        value = data;

        if (_emberMetalFeatures.default('mandatory-setter')) {
          if (watching) {
            meta.writeValues(keyName, data);

            var defaultDescriptor = {
              configurable: true,
              enumerable: true,
              set: MANDATORY_SETTER_FUNCTION(keyName),
              get: DEFAULT_GETTER_FUNCTION(keyName)
            };

            if (REDEFINE_SUPPORTED) {
              Object.defineProperty(obj, keyName, defaultDescriptor);
            } else {
              handleBrokenPhantomDefineProperty(obj, keyName, defaultDescriptor);
            }
          } else {
            obj[keyName] = data;
          }
        } else {
          obj[keyName] = data;
        }
      } else {
        value = desc;

        // fallback to ES5
        Object.defineProperty(obj, keyName, desc);
      }
    }

    // if key is being watched, override chains that
    // were initialized with the prototype
    if (watching) {
      _emberMetalProperty_events.overrideChains(obj, keyName, meta);
    }

    // The `value` passed to the `didDefineProperty` hook is
    // either the descriptor or data, whichever was passed.
    if (obj.didDefineProperty) {
      obj.didDefineProperty(obj, keyName, value);
    }

    return this;
  }

  function handleBrokenPhantomDefineProperty(obj, keyName, desc) {
    // https://github.com/ariya/phantomjs/issues/11856
    Object.defineProperty(obj, keyName, { configurable: true, writable: true, value: 'iCry' });
    Object.defineProperty(obj, keyName, desc);
  }
});
enifed('ember-metal/property_events', ['exports', 'ember-utils', 'ember-metal/meta', 'ember-metal/events', 'ember-metal/tags', 'ember-metal/observer_set', 'ember-metal/features', 'ember-metal/transaction'], function (exports, _emberUtils, _emberMetalMeta, _emberMetalEvents, _emberMetalTags, _emberMetalObserver_set, _emberMetalFeatures, _emberMetalTransaction) {
  'use strict';

  var PROPERTY_DID_CHANGE = _emberUtils.symbol('PROPERTY_DID_CHANGE');

  exports.PROPERTY_DID_CHANGE = PROPERTY_DID_CHANGE;
  var beforeObserverSet = new _emberMetalObserver_set.default();
  var observerSet = new _emberMetalObserver_set.default();
  var deferred = 0;

  // ..........................................................
  // PROPERTY CHANGES
  //

  /**
    This function is called just before an object property is about to change.
    It will notify any before observers and prepare caches among other things.
  
    Normally you will not need to call this method directly but if for some
    reason you can't directly watch a property you can invoke this method
    manually along with `Ember.propertyDidChange()` which you should call just
    after the property value changes.
  
    @method propertyWillChange
    @for Ember
    @param {Object} obj The object with the property that will change
    @param {String} keyName The property key (or path) that will change.
    @return {void}
    @private
  */
  function propertyWillChange(obj, keyName, _meta) {
    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (meta && !meta.isInitialized(obj)) {
      return;
    }

    var watching = meta && meta.peekWatching(keyName) > 0;
    var possibleDesc = obj[keyName];
    var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    if (desc && desc.willChange) {
      desc.willChange(obj, keyName);
    }

    if (watching) {
      dependentKeysWillChange(obj, keyName, meta);
      chainsWillChange(obj, keyName, meta);
      notifyBeforeObservers(obj, keyName, meta);
    }
  }

  /**
    This function is called just after an object property has changed.
    It will notify any observers and clear caches among other things.
  
    Normally you will not need to call this method directly but if for some
    reason you can't directly watch a property you can invoke this method
    manually along with `Ember.propertyWillChange()` which you should call just
    before the property value changes.
  
    @method propertyDidChange
    @for Ember
    @param {Object} obj The object with the property that will change
    @param {String} keyName The property key (or path) that will change.
    @param {Meta} meta The objects meta.
    @return {void}
    @private
  */
  function propertyDidChange(obj, keyName, _meta) {
    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (meta && !meta.isInitialized(obj)) {
      return;
    }

    var watching = meta && meta.peekWatching(keyName) > 0;
    var possibleDesc = obj[keyName];
    var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    // shouldn't this mean that we're watching this key?
    if (desc && desc.didChange) {
      desc.didChange(obj, keyName);
    }

    if (watching) {
      if (meta.hasDeps(keyName)) {
        dependentKeysDidChange(obj, keyName, meta);
      }

      chainsDidChange(obj, keyName, meta, false);
      notifyObservers(obj, keyName, meta);
    }

    if (obj[PROPERTY_DID_CHANGE]) {
      obj[PROPERTY_DID_CHANGE](keyName);
    }

    if (meta && meta.isSourceDestroying()) {
      return;
    }

    _emberMetalTags.markObjectAsDirty(meta, keyName);

    if (_emberMetalFeatures.default('ember-glimmer-detect-backtracking-rerender') || _emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
      _emberMetalTransaction.assertNotRendered(obj, keyName, meta);
    }
  }

  var WILL_SEEN = undefined,
      DID_SEEN = undefined;
  // called whenever a property is about to change to clear the cache of any dependent keys (and notify those properties of changes, etc...)
  function dependentKeysWillChange(obj, depKey, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    if (meta && meta.hasDeps(depKey)) {
      var seen = WILL_SEEN;
      var _top = !seen;

      if (_top) {
        seen = WILL_SEEN = {};
      }

      iterDeps(propertyWillChange, obj, depKey, seen, meta);

      if (_top) {
        WILL_SEEN = null;
      }
    }
  }

  // called whenever a property has just changed to update dependent keys
  function dependentKeysDidChange(obj, depKey, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    if (meta && meta.hasDeps(depKey)) {
      var seen = DID_SEEN;
      var _top2 = !seen;

      if (_top2) {
        seen = DID_SEEN = {};
      }

      iterDeps(propertyDidChange, obj, depKey, seen, meta);

      if (_top2) {
        DID_SEEN = null;
      }
    }
  }

  function iterDeps(method, obj, depKey, seen, meta) {
    var possibleDesc = undefined,
        desc = undefined;
    var guid = _emberUtils.guidFor(obj);
    var current = seen[guid];

    if (!current) {
      current = seen[guid] = {};
    }

    if (current[depKey]) {
      return;
    }

    current[depKey] = true;

    meta.forEachInDeps(depKey, function (key, value) {
      if (!value) {
        return;
      }

      possibleDesc = obj[key];
      desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      if (desc && desc._suspended === obj) {
        return;
      }

      method(obj, key, meta);
    });
  }

  function chainsWillChange(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.notify(keyName, false, propertyWillChange);
    }
  }

  function chainsDidChange(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.notify(keyName, true, propertyDidChange);
    }
  }

  function overrideChains(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.revalidate(keyName);
    }
  }

  /**
    @method beginPropertyChanges
    @chainable
    @private
  */
  function beginPropertyChanges() {
    deferred++;
  }

  /**
    @method endPropertyChanges
    @private
  */
  function endPropertyChanges() {
    deferred--;
    if (deferred <= 0) {
      beforeObserverSet.clear();
      observerSet.flush();
    }
  }

  /**
    Make a series of property changes together in an
    exception-safe way.
  
    ```javascript
    Ember.changeProperties(function() {
      obj1.set('foo', mayBlowUpWhenSet);
      obj2.set('bar', baz);
    });
    ```
  
    @method changeProperties
    @param {Function} callback
    @param [binding]
    @private
  */
  function changeProperties(callback, binding) {
    beginPropertyChanges();
    try {
      callback.call(binding);
    } finally {
      endPropertyChanges.call(binding);
    }
  }

  function notifyBeforeObservers(obj, keyName, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    var eventName = keyName + ':before';
    var listeners = undefined,
        added = undefined;
    if (deferred) {
      listeners = beforeObserverSet.add(obj, keyName, eventName);
      added = _emberMetalEvents.accumulateListeners(obj, eventName, listeners);
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName], added);
    } else {
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName]);
    }
  }

  function notifyObservers(obj, keyName, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    var eventName = keyName + ':change';
    var listeners = undefined;
    if (deferred) {
      listeners = observerSet.add(obj, keyName, eventName);
      _emberMetalEvents.accumulateListeners(obj, eventName, listeners);
    } else {
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName]);
    }
  }

  exports.propertyWillChange = propertyWillChange;
  exports.propertyDidChange = propertyDidChange;
  exports.overrideChains = overrideChains;
  exports.beginPropertyChanges = beginPropertyChanges;
  exports.endPropertyChanges = endPropertyChanges;
  exports.changeProperties = changeProperties;
});
enifed('ember-metal/property_get', ['exports', 'ember-metal/debug', 'ember-metal/path_cache'], function (exports, _emberMetalDebug, _emberMetalPath_cache) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.get = get;
  exports._getPath = _getPath;
  exports.getWithDefault = getWithDefault;

  var ALLOWABLE_TYPES = {
    object: true,
    function: true,
    string: true
  };

  // ..........................................................
  // GET AND SET
  //
  // If we are on a platform that supports accessors we can use those.
  // Otherwise simulate accessors by looking up the property directly on the
  // object.

  /**
    Gets the value of a property on an object. If the property is computed,
    the function will be invoked. If the property is not defined but the
    object implements the `unknownProperty` method then that will be invoked.
  
    ```javascript
    Ember.get(obj, "name");
    ```
  
    If you plan to run on IE8 and older browsers then you should use this
    method anytime you want to retrieve a property on an object that you don't
    know for sure is private. (Properties beginning with an underscore '_'
    are considered private.)
  
    On all newer browsers, you only need to use this method to retrieve
    properties if the property might not be defined on the object and you want
    to respect the `unknownProperty` handler. Otherwise you can ignore this
    method.
  
    Note that if the object itself is `undefined`, this method will throw
    an error.
  
    @method get
    @for Ember
    @param {Object} obj The object to retrieve from.
    @param {String} keyName The property key to retrieve
    @return {Object} the property value or `null`.
    @public
  */

  function get(obj, keyName) {
    _emberMetalDebug.assert('Get must be called with two arguments; an object and a property key', arguments.length === 2);
    _emberMetalDebug.assert('Cannot call get with \'' + keyName + '\' on an undefined object.', obj !== undefined && obj !== null);
    _emberMetalDebug.assert('The key provided to get must be a string, you passed ' + keyName, typeof keyName === 'string');
    _emberMetalDebug.assert('\'this\' in paths is not supported', !_emberMetalPath_cache.hasThis(keyName));
    _emberMetalDebug.assert('Cannot call `Ember.get` with an empty string', keyName !== '');

    var value = obj[keyName];
    var desc = value !== null && typeof value === 'object' && value.isDescriptor ? value : undefined;
    var ret = undefined;

    if (desc === undefined && _emberMetalPath_cache.isPath(keyName)) {
      return _getPath(obj, keyName);
    }

    if (desc) {
      return desc.get(obj, keyName);
    } else {
      ret = value;

      if (ret === undefined && 'object' === typeof obj && !(keyName in obj) && 'function' === typeof obj.unknownProperty) {
        return obj.unknownProperty(keyName);
      }

      return ret;
    }
  }

  function _getPath(root, path) {
    var obj = root;
    var parts = path.split('.');

    for (var i = 0; i < parts.length; i++) {
      if (!isGettable(obj)) {
        return undefined;
      }

      obj = get(obj, parts[i]);

      if (obj && obj.isDestroyed) {
        return undefined;
      }
    }

    return obj;
  }

  function isGettable(obj) {
    if (obj == null) {
      return false;
    }

    return ALLOWABLE_TYPES[typeof obj];
  }

  /**
    Retrieves the value of a property from an Object, or a default value in the
    case that the property returns `undefined`.
  
    ```javascript
    Ember.getWithDefault(person, 'lastName', 'Doe');
    ```
  
    @method getWithDefault
    @for Ember
    @param {Object} obj The object to retrieve from.
    @param {String} keyName The name of the property to retrieve
    @param {Object} defaultValue The value to return if the property value is undefined
    @return {Object} The property value or the defaultValue.
    @public
  */

  function getWithDefault(root, key, defaultValue) {
    var value = get(root, key);

    if (value === undefined) {
      return defaultValue;
    }
    return value;
  }

  exports.default = get;
});
enifed('ember-metal/property_set', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/features', 'ember-metal/property_get', 'ember-metal/property_events', 'ember-metal/error', 'ember-metal/path_cache', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalFeatures, _emberMetalProperty_get, _emberMetalProperty_events, _emberMetalError, _emberMetalPath_cache, _emberMetalMeta) {
  'use strict';

  exports.set = set;
  exports.trySet = trySet;

  /**
    Sets the value of a property on an object, respecting computed properties
    and notifying observers and other listeners of the change. If the
    property is not defined but the object implements the `setUnknownProperty`
    method then that will be invoked as well.
  
    ```javascript
    Ember.set(obj, "name", value);
    ```
  
    @method set
    @for Ember
    @param {Object} obj The object to modify.
    @param {String} keyName The property key to set
    @param {Object} value The value to set
    @return {Object} the passed value.
    @public
  */

  function set(obj, keyName, value, tolerant) {
    _emberMetalDebug.assert('Set must be called with three or four arguments; an object, a property key, a value and tolerant true/false', arguments.length === 3 || arguments.length === 4);
    _emberMetalDebug.assert('Cannot call set with \'' + keyName + '\' on an undefined object.', obj && typeof obj === 'object' || typeof obj === 'function');
    _emberMetalDebug.assert('The key provided to set must be a string, you passed ' + keyName, typeof keyName === 'string');
    _emberMetalDebug.assert('\'this\' in paths is not supported', !_emberMetalPath_cache.hasThis(keyName));
    _emberMetalDebug.assert('calling set on destroyed object: ' + _emberUtils.toString(obj) + '.' + keyName + ' = ' + _emberUtils.toString(value), !obj.isDestroyed);

    if (_emberMetalPath_cache.isPath(keyName)) {
      return setPath(obj, keyName, value, tolerant);
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    var possibleDesc = obj[keyName];

    var desc = undefined,
        currentValue = undefined;
    if (possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor) {
      desc = possibleDesc;
    } else {
      currentValue = possibleDesc;
    }

    if (desc) {
      /* computed property */
      desc.set(obj, keyName, value);
    } else if (obj.setUnknownProperty && currentValue === undefined && !(keyName in obj)) {
      /* unknown property */
      _emberMetalDebug.assert('setUnknownProperty must be a function', typeof obj.setUnknownProperty === 'function');
      obj.setUnknownProperty(keyName, value);
    } else if (currentValue === value) {
      /* no change */
      return value;
    } else {
      _emberMetalProperty_events.propertyWillChange(obj, keyName);

      if (_emberMetalFeatures.default('mandatory-setter')) {
        setWithMandatorySetter(meta, obj, keyName, value);
      } else {
        obj[keyName] = value;
      }

      _emberMetalProperty_events.propertyDidChange(obj, keyName);
    }

    return value;
  }

  if (_emberMetalFeatures.default('mandatory-setter')) {
    var setWithMandatorySetter = function (meta, obj, keyName, value) {
      if (meta && meta.peekWatching(keyName) > 0) {
        makeEnumerable(obj, keyName);
        meta.writeValue(obj, keyName, value);
      } else {
        obj[keyName] = value;
      }
    };

    var makeEnumerable = function (obj, key) {
      var desc = Object.getOwnPropertyDescriptor(obj, key);

      if (desc && desc.set && desc.set.isMandatorySetter) {
        desc.enumerable = true;
        Object.defineProperty(obj, key, desc);
      }
    };
  }

  function setPath(root, path, value, tolerant) {
    // get the last part of the path
    var keyName = path.slice(path.lastIndexOf('.') + 1);

    // get the first part of the part
    path = path === keyName ? keyName : path.slice(0, path.length - (keyName.length + 1));

    // unless the path is this, look up the first part to
    // get the root
    if (path !== 'this') {
      root = _emberMetalProperty_get._getPath(root, path);
    }

    if (!keyName || keyName.length === 0) {
      throw new _emberMetalError.default('Property set failed: You passed an empty path');
    }

    if (!root) {
      if (tolerant) {
        return;
      } else {
        throw new _emberMetalError.default('Property set failed: object in path "' + path + '" could not be found or was destroyed.');
      }
    }

    return set(root, keyName, value);
  }

  /**
    Error-tolerant form of `Ember.set`. Will not blow up if any part of the
    chain is `undefined`, `null`, or destroyed.
  
    This is primarily used when syncing bindings, which may try to update after
    an object has been destroyed.
  
    @method trySet
    @for Ember
    @param {Object} root The object to modify.
    @param {String} path The property path to set
    @param {Object} value The value to set
    @public
  */

  function trySet(root, path, value) {
    return set(root, path, value, true);
  }
});
enifed("ember-metal/replace", ["exports"], function (exports) {
  "use strict";

  exports.default = replace;
  var splice = Array.prototype.splice;

  function replace(array, idx, amt, objects) {
    var args = [].concat(objects);
    var ret = [];
    // https://code.google.com/p/chromium/issues/detail?id=56588
    var size = 60000;
    var start = idx;
    var ends = amt;
    var count = undefined,
        chunk = undefined;

    while (args.length) {
      count = ends > size ? size : ends;
      if (count <= 0) {
        count = 0;
      }

      chunk = args.splice(0, size);
      chunk = [start, count].concat(chunk);

      start += size;
      ends -= count;

      ret = ret.concat(splice.apply(array, chunk));
    }
    return ret;
  }
});
enifed('ember-metal/run_loop', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/testing', 'ember-metal/error_handler', 'ember-metal/property_events', 'backburner'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalTesting, _emberMetalError_handler, _emberMetalProperty_events, _backburner) {
  'use strict';

  exports.default = run;

  function onBegin(current) {
    run.currentRunLoop = current;
  }

  function onEnd(current, next) {
    run.currentRunLoop = next;
  }

  var onErrorTarget = {
    get onerror() {
      return _emberMetalError_handler.getOnerror();
    },
    set onerror(handler) {
      return _emberMetalError_handler.setOnerror(handler);
    }
  };

  var backburner = new _backburner.default(['sync', 'actions', 'destroy'], {
    GUID_KEY: _emberUtils.GUID_KEY,
    sync: {
      before: _emberMetalProperty_events.beginPropertyChanges,
      after: _emberMetalProperty_events.endPropertyChanges
    },
    defaultQueue: 'actions',
    onBegin: onBegin,
    onEnd: onEnd,
    onErrorTarget: onErrorTarget,
    onErrorMethod: 'onerror'
  });

  // ..........................................................
  // run - this is ideally the only public API the dev sees
  //

  /**
    Runs the passed target and method inside of a RunLoop, ensuring any
    deferred actions including bindings and views updates are flushed at the
    end.
  
    Normally you should not need to invoke this method yourself. However if
    you are implementing raw event handlers when interfacing with other
    libraries or plugins, you should probably wrap all of your code inside this
    call.
  
    ```javascript
    run(function() {
      // code to be executed within a RunLoop
    });
    ```
  
    @class run
    @namespace Ember
    @static
    @constructor
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Object} return value from invoking the passed function.
    @public
  */

  function run() {
    return backburner.run.apply(backburner, arguments);
  }

  /**
    If no run-loop is present, it creates a new one. If a run loop is
    present it will queue itself to run on the existing run-loops action
    queue.
  
    Please note: This is not for normal usage, and should be used sparingly.
  
    If invoked when not within a run loop:
  
    ```javascript
    run.join(function() {
      // creates a new run-loop
    });
    ```
  
    Alternatively, if called within an existing run loop:
  
    ```javascript
    run(function() {
      // creates a new run-loop
      run.join(function() {
        // joins with the existing run-loop, and queues for invocation on
        // the existing run-loops action queue.
      });
    });
    ```
  
    @method join
    @namespace Ember
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Object} Return value from invoking the passed function. Please note,
    when called within an existing loop, no return value is possible.
    @public
  */
  run.join = function () {
    return backburner.join.apply(backburner, arguments);
  };

  /**
    Allows you to specify which context to call the specified function in while
    adding the execution of that function to the Ember run loop. This ability
    makes this method a great way to asynchronously integrate third-party libraries
    into your Ember application.
  
    `run.bind` takes two main arguments, the desired context and the function to
    invoke in that context. Any additional arguments will be supplied as arguments
    to the function that is passed in.
  
    Let's use the creation of a TinyMCE component as an example. Currently,
    TinyMCE provides a setup configuration option we can use to do some processing
    after the TinyMCE instance is initialized but before it is actually rendered.
    We can use that setup option to do some additional setup for our component.
    The component itself could look something like the following:
  
    ```javascript
    App.RichTextEditorComponent = Ember.Component.extend({
      initializeTinyMCE: Ember.on('didInsertElement', function() {
        tinymce.init({
          selector: '#' + this.$().prop('id'),
          setup: Ember.run.bind(this, this.setupEditor)
        });
      }),
  
      setupEditor: function(editor) {
        this.set('editor', editor);
  
        editor.on('change', function() {
          console.log('content changed!');
        });
      }
    });
    ```
  
    In this example, we use Ember.run.bind to bind the setupEditor method to the
    context of the App.RichTextEditorComponent and to have the invocation of that
    method be safely handled and executed by the Ember run loop.
  
    @method bind
    @namespace Ember
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Function} returns a new function that will always have a particular context
    @since 1.4.0
    @public
  */
  run.bind = function () {
    for (var _len = arguments.length, curried = Array(_len), _key = 0; _key < _len; _key++) {
      curried[_key] = arguments[_key];
    }

    return function () {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return run.join.apply(run, curried.concat(args));
    };
  };

  run.backburner = backburner;
  run.currentRunLoop = null;
  run.queues = backburner.queueNames;

  /**
    Begins a new RunLoop. Any deferred actions invoked after the begin will
    be buffered until you invoke a matching call to `run.end()`. This is
    a lower-level way to use a RunLoop instead of using `run()`.
  
    ```javascript
    run.begin();
    // code to be executed within a RunLoop
    run.end();
    ```
  
    @method begin
    @return {void}
    @public
  */
  run.begin = function () {
    backburner.begin();
  };

  /**
    Ends a RunLoop. This must be called sometime after you call
    `run.begin()` to flush any deferred actions. This is a lower-level way
    to use a RunLoop instead of using `run()`.
  
    ```javascript
    run.begin();
    // code to be executed within a RunLoop
    run.end();
    ```
  
    @method end
    @return {void}
    @public
  */
  run.end = function () {
    backburner.end();
  };

  /**
    Array of named queues. This array determines the order in which queues
    are flushed at the end of the RunLoop. You can define your own queues by
    simply adding the queue name to this array. Normally you should not need
    to inspect or modify this property.
  
    @property queues
    @type Array
    @default ['sync', 'actions', 'destroy']
    @private
  */

  /**
    Adds the passed target/method and any optional arguments to the named
    queue to be executed at the end of the RunLoop. If you have not already
    started a RunLoop when calling this method one will be started for you
    automatically.
  
    At the end of a RunLoop, any methods scheduled in this way will be invoked.
    Methods will be invoked in an order matching the named queues defined in
    the `run.queues` property.
  
    ```javascript
    run.schedule('sync', this, function() {
      // this will be executed in the first RunLoop queue, when bindings are synced
      console.log('scheduled on sync queue');
    });
  
    run.schedule('actions', this, function() {
      // this will be executed in the 'actions' queue, after bindings have synced.
      console.log('scheduled on actions queue');
    });
  
    // Note the functions will be run in order based on the run queues order.
    // Output would be:
    //   scheduled on sync queue
    //   scheduled on actions queue
    ```
  
    @method schedule
    @param {String} queue The name of the queue to schedule against.
      Default queues are 'sync' and 'actions'
    @param {Object} [target] target object to use as the context when invoking a method.
    @param {String|Function} method The method to invoke. If you pass a string it
      will be resolved on the target object at the time the scheduled item is
      invoked allowing you to change the target function.
    @param {Object} [arguments*] Optional arguments to be passed to the queued method.
    @return {*} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.schedule = function () /* queue, target, method */{
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());

    return backburner.schedule.apply(backburner, arguments);
  };

  // Used by global test teardown
  run.hasScheduledTimers = function () {
    return backburner.hasTimers();
  };

  // Used by global test teardown
  run.cancelTimers = function () {
    backburner.cancelTimers();
  };

  /**
    Immediately flushes any events scheduled in the 'sync' queue. Bindings
    use this queue so this method is a useful way to immediately force all
    bindings in the application to sync.
  
    You should call this method anytime you need any changed state to propagate
    throughout the app immediately without repainting the UI (which happens
    in the later 'render' queue added by the `ember-views` package).
  
    ```javascript
    run.sync();
    ```
  
    @method sync
    @return {void}
    @private
  */
  run.sync = function () {
    if (backburner.currentInstance) {
      backburner.currentInstance.queues.sync.flush();
    }
  };

  /**
    Invokes the passed target/method and optional arguments after a specified
    period of time. The last parameter of this method must always be a number
    of milliseconds.
  
    You should use this method whenever you need to run some action after a
    period of time instead of using `setTimeout()`. This method will ensure that
    items that expire during the same script execution cycle all execute
    together, which is often more efficient than using a real setTimeout.
  
    ```javascript
    run.later(myContext, function() {
      // code here will execute within a RunLoop in about 500ms with this == myContext
    }, 500);
    ```
  
    @method later
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} wait Number of milliseconds to wait.
    @return {*} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.later = function () /*target, method*/{
    return backburner.later.apply(backburner, arguments);
  };

  /**
    Schedule a function to run one time during the current RunLoop. This is equivalent
    to calling `scheduleOnce` with the "actions" queue.
  
    @method once
    @param {Object} [target] The target of the method to invoke.
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.once = function () {
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());

    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    args.unshift('actions');
    return backburner.scheduleOnce.apply(backburner, args);
  };

  /**
    Schedules a function to run one time in a given queue of the current RunLoop.
    Calling this method with the same queue/target/method combination will have
    no effect (past the initial call).
  
    Note that although you can pass optional arguments these will not be
    considered when looking for duplicates. New arguments will replace previous
    calls.
  
    ```javascript
    function sayHi() {
      console.log('hi');
    }
  
    run(function() {
      run.scheduleOnce('afterRender', myContext, sayHi);
      run.scheduleOnce('afterRender', myContext, sayHi);
      // sayHi will only be executed once, in the afterRender queue of the RunLoop
    });
    ```
  
    Also note that passing an anonymous function to `run.scheduleOnce` will
    not prevent additional calls with an identical anonymous function from
    scheduling the items multiple times, e.g.:
  
    ```javascript
    function scheduleIt() {
      run.scheduleOnce('actions', myContext, function() {
        console.log('Closure');
      });
    }
  
    scheduleIt();
    scheduleIt();
  
    // "Closure" will print twice, even though we're using `run.scheduleOnce`,
    // because the function we pass to it is anonymous and won't match the
    // previously scheduled operation.
    ```
  
    Available queues, and their order, can be found at `run.queues`
  
    @method scheduleOnce
    @param {String} [queue] The name of the queue to schedule against. Default queues are 'sync' and 'actions'.
    @param {Object} [target] The target of the method to invoke.
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.scheduleOnce = function () /*queue, target, method*/{
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());
    return backburner.scheduleOnce.apply(backburner, arguments);
  };

  /**
    Schedules an item to run from within a separate run loop, after
    control has been returned to the system. This is equivalent to calling
    `run.later` with a wait time of 1ms.
  
    ```javascript
    run.next(myContext, function() {
      // code to be executed in the next run loop,
      // which will be scheduled after the current one
    });
    ```
  
    Multiple operations scheduled with `run.next` will coalesce
    into the same later run loop, along with any other operations
    scheduled by `run.later` that expire right around the same
    time that `run.next` operations will fire.
  
    Note that there are often alternatives to using `run.next`.
    For instance, if you'd like to schedule an operation to happen
    after all DOM element operations have completed within the current
    run loop, you can make use of the `afterRender` run loop queue (added
    by the `ember-views` package, along with the preceding `render` queue
    where all the DOM element operations happen).
  
    Example:
  
    ```javascript
    export default Ember.Component.extend({
      didInsertElement() {
        this._super(...arguments);
        run.scheduleOnce('afterRender', this, 'processChildElements');
      },
  
      processChildElements() {
        // ... do something with component's child component
        // elements after they've finished rendering, which
        // can't be done within this component's
        // `didInsertElement` hook because that gets run
        // before the child elements have been added to the DOM.
      }
    });
    ```
  
    One benefit of the above approach compared to using `run.next` is
    that you will be able to perform DOM/CSS operations before unprocessed
    elements are rendered to the screen, which may prevent flickering or
    other artifacts caused by delaying processing until after rendering.
  
    The other major benefit to the above approach is that `run.next`
    introduces an element of non-determinism, which can make things much
    harder to test, due to its reliance on `setTimeout`; it's much harder
    to guarantee the order of scheduled operations when they are scheduled
    outside of the current run loop, i.e. with `run.next`.
  
    @method next
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.next = function () {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    args.push(1);
    return backburner.later.apply(backburner, args);
  };

  /**
    Cancels a scheduled item. Must be a value returned by `run.later()`,
    `run.once()`, `run.scheduleOnce()`, `run.next()`, `run.debounce()`, or
    `run.throttle()`.
  
    ```javascript
    let runNext = run.next(myContext, function() {
      // will not be executed
    });
  
    run.cancel(runNext);
  
    let runLater = run.later(myContext, function() {
      // will not be executed
    }, 500);
  
    run.cancel(runLater);
  
    let runScheduleOnce = run.scheduleOnce('afterRender', myContext, function() {
      // will not be executed
    });
  
    run.cancel(runScheduleOnce);
  
    let runOnce = run.once(myContext, function() {
      // will not be executed
    });
  
    run.cancel(runOnce);
  
    let throttle = run.throttle(myContext, function() {
      // will not be executed
    }, 1, false);
  
    run.cancel(throttle);
  
    let debounce = run.debounce(myContext, function() {
      // will not be executed
    }, 1);
  
    run.cancel(debounce);
  
    let debounceImmediate = run.debounce(myContext, function() {
      // will be executed since we passed in true (immediate)
    }, 100, true);
  
    // the 100ms delay until this method can be called again will be cancelled
    run.cancel(debounceImmediate);
    ```
  
    @method cancel
    @param {Object} timer Timer object to cancel
    @return {Boolean} true if cancelled or false/undefined if it wasn't found
    @public
  */
  run.cancel = function (timer) {
    return backburner.cancel(timer);
  };

  /**
    Delay calling the target method until the debounce period has elapsed
    with no additional debounce calls. If `debounce` is called again before
    the specified time has elapsed, the timer is reset and the entire period
    must pass again before the target method is called.
  
    This method should be used when an event may be called multiple times
    but the action should only be called once when the event is done firing.
    A common example is for scroll events where you only want updates to
    happen once scrolling has ceased.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'debounce' };
  
    run.debounce(myContext, whoRan, 150);
  
    // less than 150ms passes
    run.debounce(myContext, whoRan, 150);
  
    // 150ms passes
    // whoRan is invoked with context myContext
    // console logs 'debounce ran.' one time.
    ```
  
    Immediate allows you to run the function immediately, but debounce
    other calls for this function until the wait time has elapsed. If
    `debounce` is called again before the specified time has elapsed,
    the timer is reset and the entire period must pass again before
    the method can be called again.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'debounce' };
  
    run.debounce(myContext, whoRan, 150, true);
  
    // console logs 'debounce ran.' one time immediately.
    // 100ms passes
    run.debounce(myContext, whoRan, 150, true);
  
    // 150ms passes and nothing else is logged to the console and
    // the debouncee is no longer being watched
    run.debounce(myContext, whoRan, 150, true);
  
    // console logs 'debounce ran.' one time immediately.
    // 150ms passes and nothing else is logged to the console and
    // the debouncee is no longer being watched
  
    ```
  
    @method debounce
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} wait Number of milliseconds to wait.
    @param {Boolean} immediate Trigger the function on the leading instead
      of the trailing edge of the wait interval. Defaults to false.
    @return {Array} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.debounce = function () {
    return backburner.debounce.apply(backburner, arguments);
  };

  /**
    Ensure that the target method is never called more frequently than
    the specified spacing period. The target method is called immediately.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'throttle' };
  
    run.throttle(myContext, whoRan, 150);
    // whoRan is invoked with context myContext
    // console logs 'throttle ran.'
  
    // 50ms passes
    run.throttle(myContext, whoRan, 150);
  
    // 50ms passes
    run.throttle(myContext, whoRan, 150);
  
    // 150ms passes
    run.throttle(myContext, whoRan, 150);
    // whoRan is invoked with context myContext
    // console logs 'throttle ran.'
    ```
  
    @method throttle
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} spacing Number of milliseconds to space out requests.
    @param {Boolean} immediate Trigger the function on the leading instead
      of the trailing edge of the wait interval. Defaults to true.
    @return {Array} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.throttle = function () {
    return backburner.throttle.apply(backburner, arguments);
  };

  /**
    Add a new named queue after the specified queue.
  
    The queue to add will only be added once.
  
    @method _addQueue
    @param {String} name the name of the queue to add.
    @param {String} after the name of the queue to add after.
    @private
  */
  run._addQueue = function (name, after) {
    if (run.queues.indexOf(name) === -1) {
      run.queues.splice(run.queues.indexOf(after) + 1, 0, name);
    }
  };
});
enifed('ember-metal/set_properties', ['exports', 'ember-metal/property_events', 'ember-metal/property_set'], function (exports, _emberMetalProperty_events, _emberMetalProperty_set) {
  'use strict';

  exports.default = setProperties;

  /**
    Set a list of properties on an object. These properties are set inside
    a single `beginPropertyChanges` and `endPropertyChanges` batch, so
    observers will be buffered.
  
    ```javascript
    let anObject = Ember.Object.create();
  
    anObject.setProperties({
      firstName: 'Stanley',
      lastName: 'Stuart',
      age: 21
    });
    ```
  
    @method setProperties
    @param obj
    @param {Object} properties
    @return properties
    @public
  */

  function setProperties(obj, properties) {
    if (!properties || typeof properties !== 'object') {
      return properties;
    }
    _emberMetalProperty_events.changeProperties(function () {
      var props = Object.keys(properties);
      var propertyName = undefined;

      for (var i = 0; i < props.length; i++) {
        propertyName = props[i];

        _emberMetalProperty_set.set(obj, propertyName, properties[propertyName]);
      }
    });
    return properties;
  }
});
enifed('ember-metal/tags', ['exports', 'glimmer-reference', 'ember-metal/meta', 'require', 'ember-metal/is_proxy'], function (exports, _glimmerReference, _emberMetalMeta, _require, _emberMetalIs_proxy) {
  'use strict';

  exports.setHasViews = setHasViews;
  exports.tagForProperty = tagForProperty;
  exports.tagFor = tagFor;
  exports.markObjectAsDirty = markObjectAsDirty;

  var hasViews = function () {
    return false;
  };

  function setHasViews(fn) {
    hasViews = fn;
  }

  function makeTag() {
    return new _glimmerReference.DirtyableTag();
  }

  function tagForProperty(object, propertyKey, _meta) {
    if (_emberMetalIs_proxy.isProxy(object)) {
      return tagFor(object, _meta);
    }

    if (typeof object === 'object' && object) {
      var meta = _meta || _emberMetalMeta.meta(object);
      var tags = meta.writableTags();
      var tag = tags[propertyKey];
      if (tag) {
        return tag;
      }

      return tags[propertyKey] = makeTag();
    } else {
      return _glimmerReference.CONSTANT_TAG;
    }
  }

  function tagFor(object, _meta) {
    if (typeof object === 'object' && object) {
      var meta = _meta || _emberMetalMeta.meta(object);
      return meta.writableTag(makeTag);
    } else {
      return _glimmerReference.CONSTANT_TAG;
    }
  }

  function markObjectAsDirty(meta, propertyKey) {
    var objectTag = meta && meta.readableTag();

    if (objectTag) {
      objectTag.dirty();
    }

    var tags = meta && meta.readableTags();
    var propertyTag = tags && tags[propertyKey];

    if (propertyTag) {
      propertyTag.dirty();
    }

    if (objectTag || propertyTag) {
      ensureRunloop();
    }
  }

  var run = undefined;

  function K() {}

  function ensureRunloop() {
    if (!run) {
      run = _require.default('ember-metal/run_loop').default;
    }

    if (hasViews() && !run.backburner.currentInstance) {
      run.schedule('actions', K);
    }
  }
});
enifed("ember-metal/testing", ["exports"], function (exports) {
  "use strict";

  exports.isTesting = isTesting;
  exports.setTesting = setTesting;
  var testing = false;

  function isTesting() {
    return testing;
  }

  function setTesting(value) {
    testing = !!value;
  }
});
enifed('ember-metal/transaction', ['exports', 'ember-metal/meta', 'ember-metal/debug', 'ember-metal/features'], function (exports, _emberMetalMeta, _emberMetalDebug, _emberMetalFeatures) {
  'use strict';

  var runInTransaction = undefined,
      didRender = undefined,
      assertNotRendered = undefined;

  var raise = _emberMetalDebug.assert;
  if (_emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
    raise = function (message, test) {
      _emberMetalDebug.deprecate(message, test, { id: 'ember-views.render-double-modify', until: '3.0.0' });
    };
  }

  var implication = undefined;
  if (_emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
    implication = 'will be removed in Ember 3.0.';
  } else if (_emberMetalFeatures.default('ember-glimmer-detect-backtracking-rerender')) {
    implication = 'is no longer supported. See https://github.com/emberjs/ember.js/issues/13948 for more details.';
  }

  if (_emberMetalFeatures.default('ember-glimmer-detect-backtracking-rerender') || _emberMetalFeatures.default('ember-glimmer-allow-backtracking-rerender')) {
    (function () {
      var counter = 0;
      var inTransaction = false;
      var shouldReflush = undefined;

      exports.default = runInTransaction = function (context, methodName) {
        shouldReflush = false;
        inTransaction = true;
        context[methodName]();
        inTransaction = false;
        counter++;
        return shouldReflush;
      };

      exports.didRender = didRender = function (object, key, reference) {
        if (!inTransaction) {
          return;
        }
        var meta = _emberMetalMeta.meta(object);
        var lastRendered = meta.writableLastRendered();
        lastRendered[key] = counter;

        _emberMetalDebug.runInDebug(function () {
          var lastRenderedFrom = meta.writableLastRenderedFrom();
          lastRenderedFrom[key] = reference;
        });
      };

      exports.assertNotRendered = assertNotRendered = function (object, key, _meta) {
        var meta = _meta || _emberMetalMeta.meta(object);
        var lastRendered = meta.readableLastRendered();

        if (lastRendered && lastRendered[key] === counter) {
          raise((function () {
            var ref = meta.readableLastRenderedFrom();
            var parts = [];
            var lastRef = ref[key];

            var label = undefined;

            if (lastRef) {
              while (lastRef && lastRef._propertyKey) {
                parts.unshift(lastRef._propertyKey);
                lastRef = lastRef._parentReference;
              }

              label = parts.join();
            } else {
              label = 'the same value';
            }

            return 'You modified ' + parts.join('.') + ' twice on ' + object + ' in a single render. This was unreliable and slow in Ember 1.x and ' + implication;
          })(), false);

          shouldReflush = true;
        }
      };
    })();
  } else {
    exports.default = runInTransaction = function () {
      throw new Error('Cannot call runInTransaction without Glimmer');
    };

    exports.didRender = didRender = function () {
      throw new Error('Cannot call didRender without Glimmer');
    };

    exports.assertNotRendered = assertNotRendered = function () {
      throw new Error('Cannot call assertNotRendered without Glimmer');
    };
  }

  exports.default = runInTransaction;
  exports.didRender = didRender;
  exports.assertNotRendered = assertNotRendered;
});
enifed('ember-metal/watch_key', ['exports', 'ember-utils', 'ember-metal/features', 'ember-metal/meta', 'ember-metal/properties'], function (exports, _emberUtils, _emberMetalFeatures, _emberMetalMeta, _emberMetalProperties) {
  'use strict';

  exports.watchKey = watchKey;
  exports.unwatchKey = unwatchKey;

  var handleMandatorySetter = undefined;

  function watchKey(obj, keyName, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);

    // activate watching first time
    if (!m.peekWatching(keyName)) {
      m.writeWatching(keyName, 1);

      var possibleDesc = obj[keyName];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;
      if (desc && desc.willWatch) {
        desc.willWatch(obj, keyName);
      }

      if ('function' === typeof obj.willWatchProperty) {
        obj.willWatchProperty(keyName);
      }

      if (_emberMetalFeatures.default('mandatory-setter')) {
        // NOTE: this is dropped for prod + minified builds
        handleMandatorySetter(m, obj, keyName);
      }
    } else {
      m.writeWatching(keyName, (m.peekWatching(keyName) || 0) + 1);
    }
  }

  if (_emberMetalFeatures.default('mandatory-setter')) {
    (function () {
      var hasOwnProperty = function (obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      };

      var propertyIsEnumerable = function (obj, key) {
        return Object.prototype.propertyIsEnumerable.call(obj, key);
      };

      // Future traveler, although this code looks scary. It merely exists in
      // development to aid in development asertions. Production builds of
      // ember strip this entire block out
      handleMandatorySetter = function handleMandatorySetter(m, obj, keyName) {
        var descriptor = _emberUtils.lookupDescriptor(obj, keyName);
        var configurable = descriptor ? descriptor.configurable : true;
        var isWritable = descriptor ? descriptor.writable : true;
        var hasValue = descriptor ? 'value' in descriptor : true;
        var possibleDesc = descriptor && descriptor.value;
        var isDescriptor = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor;

        if (isDescriptor) {
          return;
        }

        // this x in Y deopts, so keeping it in this function is better;
        if (configurable && isWritable && hasValue && keyName in obj) {
          var desc = {
            configurable: true,
            set: _emberMetalProperties.MANDATORY_SETTER_FUNCTION(keyName),
            enumerable: propertyIsEnumerable(obj, keyName),
            get: undefined
          };

          if (hasOwnProperty(obj, keyName)) {
            m.writeValues(keyName, obj[keyName]);
            desc.get = _emberMetalProperties.DEFAULT_GETTER_FUNCTION(keyName);
          } else {
            desc.get = _emberMetalProperties.INHERITING_GETTER_FUNCTION(keyName);
          }

          Object.defineProperty(obj, keyName, desc);
        }
      };
    })();
  }

  function unwatchKey(obj, keyName, _meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var meta = _meta || _emberMetalMeta.meta(obj);

    // do nothing of this object has already been destroyed
    if (meta.isSourceDestroyed()) {
      return;
    }

    var count = meta.peekWatching(keyName);
    if (count === 1) {
      meta.writeWatching(keyName, 0);

      var possibleDesc = obj[keyName];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      if (desc && desc.didUnwatch) {
        desc.didUnwatch(obj, keyName);
      }

      if ('function' === typeof obj.didUnwatchProperty) {
        obj.didUnwatchProperty(keyName);
      }

      if (_emberMetalFeatures.default('mandatory-setter')) {
        // It is true, the following code looks quite WAT. But have no fear, It
        // exists purely to improve development ergonomics and is removed from
        // ember.min.js and ember.prod.js builds.
        //
        // Some further context: Once a property is watched by ember, bypassing `set`
        // for mutation, will bypass observation. This code exists to assert when
        // that occurs, and attempt to provide more helpful feedback. The alternative
        // is tricky to debug partially observable properties.
        if (!desc && keyName in obj) {
          var maybeMandatoryDescriptor = _emberUtils.lookupDescriptor(obj, keyName);

          if (maybeMandatoryDescriptor.set && maybeMandatoryDescriptor.set.isMandatorySetter) {
            if (maybeMandatoryDescriptor.get && maybeMandatoryDescriptor.get.isInheritingGetter) {
              var possibleValue = meta.readInheritedValue('values', keyName);
              if (possibleValue === _emberMetalMeta.UNDEFINED) {
                delete obj[keyName];
                return;
              }
            }

            Object.defineProperty(obj, keyName, {
              configurable: true,
              enumerable: Object.prototype.propertyIsEnumerable.call(obj, keyName),
              writable: true,
              value: meta.peekValues(keyName)
            });
            meta.deleteFromValues(keyName);
          }
        }
      }
    } else if (count > 1) {
      meta.writeWatching(keyName, count - 1);
    }
  }
});
enifed('ember-metal/watch_path', ['exports', 'ember-metal/meta', 'ember-metal/chains'], function (exports, _emberMetalMeta, _emberMetalChains) {
  'use strict';

  exports.makeChainNode = makeChainNode;
  exports.watchPath = watchPath;
  exports.unwatchPath = unwatchPath;

  // get the chains for the current object. If the current object has
  // chains inherited from the proto they will be cloned and reconfigured for
  // the current object.
  function chainsFor(obj, meta) {
    return (meta || _emberMetalMeta.meta(obj)).writableChains(makeChainNode);
  }

  function makeChainNode(obj) {
    return new _emberMetalChains.ChainNode(null, null, obj);
  }

  function watchPath(obj, keyPath, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);
    var counter = m.peekWatching(keyPath) || 0;
    if (!counter) {
      // activate watching first time
      m.writeWatching(keyPath, 1);
      chainsFor(obj, m).add(keyPath);
    } else {
      m.writeWatching(keyPath, counter + 1);
    }
  }

  function unwatchPath(obj, keyPath, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);
    var counter = m.peekWatching(keyPath) || 0;

    if (counter === 1) {
      m.writeWatching(keyPath, 0);
      chainsFor(obj, m).remove(keyPath);
    } else if (counter > 1) {
      m.writeWatching(keyPath, counter - 1);
    }
  }
});
enifed('ember-metal/watching', ['exports', 'ember-metal/watch_key', 'ember-metal/watch_path', 'ember-metal/path_cache', 'ember-metal/meta'], function (exports, _emberMetalWatch_key, _emberMetalWatch_path, _emberMetalPath_cache, _emberMetalMeta) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.isWatching = isWatching;
  exports.watcherCount = watcherCount;
  exports.unwatch = unwatch;
  exports.destroy = destroy;

  /**
    Starts watching a property on an object. Whenever the property changes,
    invokes `Ember.propertyWillChange` and `Ember.propertyDidChange`. This is the
    primitive used by observers and dependent keys; usually you will never call
    this method directly but instead use higher level methods like
    `Ember.addObserver()`
  
    @private
    @method watch
    @for Ember
    @param obj
    @param {String} _keyPath
  */
  function watch(obj, _keyPath, m) {
    if (!_emberMetalPath_cache.isPath(_keyPath)) {
      _emberMetalWatch_key.watchKey(obj, _keyPath, m);
    } else {
      _emberMetalWatch_path.watchPath(obj, _keyPath, m);
    }
  }

  exports.watch = watch;

  function isWatching(obj, key) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    var meta = _emberMetalMeta.peekMeta(obj);
    return (meta && meta.peekWatching(key)) > 0;
  }

  function watcherCount(obj, key) {
    var meta = _emberMetalMeta.peekMeta(obj);
    return meta && meta.peekWatching(key) || 0;
  }

  function unwatch(obj, _keyPath, m) {
    if (!_emberMetalPath_cache.isPath(_keyPath)) {
      _emberMetalWatch_key.unwatchKey(obj, _keyPath, m);
    } else {
      _emberMetalWatch_path.unwatchPath(obj, _keyPath, m);
    }
  }

  /**
    Tears down the meta on an object so that it can be garbage collected.
    Multiple calls will have no effect.
  
    @method destroy
    @for Ember
    @param {Object} obj  the object to destroy
    @return {void}
    @private
  */

  function destroy(obj) {
    _emberMetalMeta.deleteMeta(obj);
  }
});
enifed('ember-metal/weak_map', ['exports', 'ember-utils', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalMeta) {
  'use strict';

  exports.default = WeakMap;

  var id = 0;

  // Returns whether Type(value) is Object according to the terminology in the spec
  function isObject(value) {
    return typeof value === 'object' && value !== null || typeof value === 'function';
  }

  /*
   * @class Ember.WeakMap
   * @public
   * @category ember-metal-weakmap
   *
   * A partial polyfill for [WeakMap](http://www.ecma-international.org/ecma-262/6.0/#sec-weakmap-objects).
   *
   * There is a small but important caveat. This implementation assumes that the
   * weak map will live longer (in the sense of garbage collection) than all of its
   * keys, otherwise it is possible to leak the values stored in the weak map. In
   * practice, most use cases satisfy this limitation which is why it is included
   * in ember-metal.
   */

  function WeakMap(iterable) {
    if (!(this instanceof WeakMap)) {
      throw new TypeError('Constructor WeakMap requires \'new\'');
    }

    this._id = _emberUtils.GUID_KEY + id++;

    if (iterable === null || iterable === undefined) {
      return;
    } else if (Array.isArray(iterable)) {
      for (var i = 0; i < iterable.length; i++) {
        var _iterable$i = iterable[i];
        var key = _iterable$i[0];
        var value = _iterable$i[1];

        this.set(key, value);
      }
    } else {
      throw new TypeError('The weak map constructor polyfill only supports an array argument');
    }
  }

  /*
   * @method get
   * @param key {Object | Function}
   * @return {Any} stored value
   */
  WeakMap.prototype.get = function (obj) {
    if (!isObject(obj)) {
      return undefined;
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    if (meta) {
      var map = meta.readableWeak();
      if (map) {
        if (map[this._id] === _emberMetalMeta.UNDEFINED) {
          return undefined;
        }

        return map[this._id];
      }
    }
  };

  /*
   * @method set
   * @param key {Object | Function}
   * @param value {Any}
   * @return {WeakMap} the weak map
   */
  WeakMap.prototype.set = function (obj, value) {
    if (!isObject(obj)) {
      throw new TypeError('Invalid value used as weak map key');
    }

    if (value === undefined) {
      value = _emberMetalMeta.UNDEFINED;
    }

    _emberMetalMeta.meta(obj).writableWeak()[this._id] = value;

    return this;
  };

  /*
   * @method has
   * @param key {Object | Function}
   * @return {boolean} if the key exists
   */
  WeakMap.prototype.has = function (obj) {
    if (!isObject(obj)) {
      return false;
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    if (meta) {
      var map = meta.readableWeak();
      if (map) {
        return map[this._id] !== undefined;
      }
    }

    return false;
  };

  /*
   * @method delete
   * @param key {Object | Function}
   * @return {boolean} if the key was deleted
   */
  WeakMap.prototype.delete = function (obj) {
    if (this.has(obj)) {
      delete _emberMetalMeta.meta(obj).writableWeak()[this._id];
      return true;
    } else {
      return false;
    }
  };

  /*
   * @method toString
   * @return {String}
   */
  WeakMap.prototype.toString = function () {
    return '[object WeakMap]';
  };
});
enifed('ember-runtime/compare', ['exports', 'ember-runtime/utils', 'ember-runtime/mixins/comparable'], function (exports, _emberRuntimeUtils, _emberRuntimeMixinsComparable) {
  'use strict';

  exports.default = compare;

  var TYPE_ORDER = {
    'undefined': 0,
    'null': 1,
    'boolean': 2,
    'number': 3,
    'string': 4,
    'array': 5,
    'object': 6,
    'instance': 7,
    'function': 8,
    'class': 9,
    'date': 10
  };

  //
  // the spaceship operator
  //
  //                      `. ___
  //                     __,' __`.                _..----....____
  //         __...--.'``;.   ,.   ;``--..__     .'    ,-._    _.-'
  //   _..-''-------'   `'   `'   `'     O ``-''._   (,;') _,'
  // ,'________________                          \`-._`-','
  //  `._              ```````````------...___   '-.._'-:
  //     ```--.._      ,.                     ````--...__\-.
  //             `.--. `-` "INFINITY IS LESS     ____    |  |`
  //               `. `.   THAN BEYOND"        ,'`````.  ;  ;`
  //                 `._`.        __________   `.      \'__/`
  //                    `-:._____/______/___/____`.     \  `
  //                                |       `._    `.    \
  //                                `._________`-.   `.   `.___
  //                                              SSt  `------'`
  function spaceship(a, b) {
    var diff = a - b;
    return (diff > 0) - (diff < 0);
  }

  /**
   Compares two javascript values and returns:
  
    - -1 if the first is smaller than the second,
    - 0 if both are equal,
    - 1 if the first is greater than the second.
  
    ```javascript
    Ember.compare('hello', 'hello');  // 0
    Ember.compare('abc', 'dfg');      // -1
    Ember.compare(2, 1);              // 1
    ```
  
   If the types of the two objects are different precedence occurs in the
   following order, with types earlier in the list considered `<` types
   later in the list:
  
    - undefined
    - null
    - boolean
    - number
    - string
    - array
    - object
    - instance
    - function
    - class
    - date
  
    ```javascript
    Ember.compare('hello', 50);       // 1
    Ember.compare(50, 'hello');       // -1
    ```
  
   @method compare
   @for Ember
   @param {Object} v First value to compare
   @param {Object} w Second value to compare
   @return {Number} -1 if v < w, 0 if v = w and 1 if v > w.
   @public
  */

  function compare(v, w) {
    if (v === w) {
      return 0;
    }

    var type1 = _emberRuntimeUtils.typeOf(v);
    var type2 = _emberRuntimeUtils.typeOf(w);

    if (_emberRuntimeMixinsComparable.default) {
      if (type1 === 'instance' && _emberRuntimeMixinsComparable.default.detect(v) && v.constructor.compare) {
        return v.constructor.compare(v, w);
      }

      if (type2 === 'instance' && _emberRuntimeMixinsComparable.default.detect(w) && w.constructor.compare) {
        return w.constructor.compare(w, v) * -1;
      }
    }

    var res = spaceship(TYPE_ORDER[type1], TYPE_ORDER[type2]);

    if (res !== 0) {
      return res;
    }

    // types are equal - so we have to check values now
    switch (type1) {
      case 'boolean':
      case 'number':
        return spaceship(v, w);

      case 'string':
        return spaceship(v.localeCompare(w), 0);

      case 'array':
        var vLen = v.length;
        var wLen = w.length;
        var len = Math.min(vLen, wLen);

        for (var i = 0; i < len; i++) {
          var r = compare(v[i], w[i]);
          if (r !== 0) {
            return r;
          }
        }

        // all elements are equal now
        // shorter array should be ordered first
        return spaceship(vLen, wLen);

      case 'instance':
        if (_emberRuntimeMixinsComparable.default && _emberRuntimeMixinsComparable.default.detect(v)) {
          return v.compare(v, w);
        }
        return 0;

      case 'date':
        return spaceship(v.getTime(), w.getTime());

      default:
        return 0;
    }
  }
});
enifed('ember-runtime/computed/computed_macros', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  'use strict';

  exports.empty = empty;
  exports.notEmpty = notEmpty;
  exports.none = none;
  exports.not = not;
  exports.bool = bool;
  exports.match = match;
  exports.equal = equal;
  exports.gt = gt;
  exports.gte = gte;
  exports.lt = lt;
  exports.lte = lte;
  exports.oneWay = oneWay;
  exports.readOnly = readOnly;
  exports.deprecatingAlias = deprecatingAlias;

  /**
  @module ember
  @submodule ember-metal
  */

  function expandPropertiesToArray(predicateName, properties) {
    var expandedProperties = [];

    function extractProperty(entry) {
      expandedProperties.push(entry);
    }

    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      _emberMetal.assert('Dependent keys passed to Ember.computed.' + predicateName + '() can\'t have spaces.', property.indexOf(' ') < 0);

      _emberMetal.expandProperties(property, extractProperty);
    }

    return expandedProperties;
  }

  function generateComputedWithPredicate(name, predicate) {
    return function () {
      for (var _len = arguments.length, properties = Array(_len), _key = 0; _key < _len; _key++) {
        properties[_key] = arguments[_key];
      }

      var expandedProperties = expandPropertiesToArray(name, properties);

      var computedFunc = _emberMetal.computed(function () {
        var lastIdx = expandedProperties.length - 1;

        for (var i = 0; i < lastIdx; i++) {
          var value = _emberMetal.get(this, expandedProperties[i]);
          if (!predicate(value)) {
            return value;
          }
        }

        return _emberMetal.get(this, expandedProperties[lastIdx]);
      });

      return computedFunc.property.apply(computedFunc, expandedProperties);
    };
  }

  /**
    A computed property that returns true if the value of the dependent
    property is null, an empty string, empty array, or empty function.
  
    Example
  
    ```javascript
    let ToDoList = Ember.Object.extend({
      isDone: Ember.computed.empty('todos')
    });
  
    let todoList = ToDoList.create({
      todos: ['Unit Test', 'Documentation', 'Release']
    });
  
    todoList.get('isDone'); // false
    todoList.get('todos').clear();
    todoList.get('isDone'); // true
    ```
  
    @since 1.6.0
    @method empty
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which negate
    the original value for property
    @public
  */

  function empty(dependentKey) {
    return _emberMetal.computed(dependentKey + '.length', function () {
      return _emberMetal.isEmpty(_emberMetal.get(this, dependentKey));
    });
  }

  /**
    A computed property that returns true if the value of the dependent
    property is NOT null, an empty string, empty array, or empty function.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      hasStuff: Ember.computed.notEmpty('backpack')
    });
  
    let hamster = Hamster.create({ backpack: ['Food', 'Sleeping Bag', 'Tent'] });
  
    hamster.get('hasStuff');         // true
    hamster.get('backpack').clear(); // []
    hamster.get('hasStuff');         // false
    ```
  
    @method notEmpty
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which returns true if
    original value for property is not empty.
    @public
  */

  function notEmpty(dependentKey) {
    return _emberMetal.computed(dependentKey + '.length', function () {
      return !_emberMetal.isEmpty(_emberMetal.get(this, dependentKey));
    });
  }

  /**
    A computed property that returns true if the value of the dependent
    property is null or undefined. This avoids errors from JSLint complaining
    about use of ==, which can be technically confusing.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      isHungry: Ember.computed.none('food')
    });
  
    let hamster = Hamster.create();
  
    hamster.get('isHungry'); // true
    hamster.set('food', 'Banana');
    hamster.get('isHungry'); // false
    hamster.set('food', null);
    hamster.get('isHungry'); // true
    ```
  
    @method none
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which
    returns true if original value for property is null or undefined.
    @public
  */

  function none(dependentKey) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.isNone(_emberMetal.get(this, dependentKey));
    });
  }

  /**
    A computed property that returns the inverse boolean value
    of the original value for the dependent property.
  
    Example
  
    ```javascript
    let User = Ember.Object.extend({
      isAnonymous: Ember.computed.not('loggedIn')
    });
  
    let user = User.create({loggedIn: false});
  
    user.get('isAnonymous'); // true
    user.set('loggedIn', true);
    user.get('isAnonymous'); // false
    ```
  
    @method not
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which returns
    inverse of the original value for property
    @public
  */

  function not(dependentKey) {
    return _emberMetal.computed(dependentKey, function () {
      return !_emberMetal.get(this, dependentKey);
    });
  }

  /**
    A computed property that converts the provided dependent property
    into a boolean value.
  
    ```javascript
    let Hamster = Ember.Object.extend({
      hasBananas: Ember.computed.bool('numBananas')
    });
  
    let hamster = Hamster.create();
  
    hamster.get('hasBananas'); // false
    hamster.set('numBananas', 0);
    hamster.get('hasBananas'); // false
    hamster.set('numBananas', 1);
    hamster.get('hasBananas'); // true
    hamster.set('numBananas', null);
    hamster.get('hasBananas'); // false
    ```
  
    @method bool
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which converts
    to boolean the original value for property
    @public
  */

  function bool(dependentKey) {
    return _emberMetal.computed(dependentKey, function () {
      return !!_emberMetal.get(this, dependentKey);
    });
  }

  /**
    A computed property which matches the original value for the
    dependent property against a given RegExp, returning `true`
    if the value matches the RegExp and `false` if it does not.
  
    Example
  
    ```javascript
    let User = Ember.Object.extend({
      hasValidEmail: Ember.computed.match('email', /^.+@.+\..+$/)
    });
  
    let user = User.create({loggedIn: false});
  
    user.get('hasValidEmail'); // false
    user.set('email', '');
    user.get('hasValidEmail'); // false
    user.set('email', 'ember_hamster@example.com');
    user.get('hasValidEmail'); // true
    ```
  
    @method match
    @for Ember.computed
    @param {String} dependentKey
    @param {RegExp} regexp
    @return {Ember.ComputedProperty} computed property which match
    the original value for property against a given RegExp
    @public
  */

  function match(dependentKey, regexp) {
    return _emberMetal.computed(dependentKey, function () {
      var value = _emberMetal.get(this, dependentKey);

      return typeof value === 'string' ? regexp.test(value) : false;
    });
  }

  /**
    A computed property that returns true if the provided dependent property
    is equal to the given value.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      napTime: Ember.computed.equal('state', 'sleepy')
    });
  
    let hamster = Hamster.create();
  
    hamster.get('napTime'); // false
    hamster.set('state', 'sleepy');
    hamster.get('napTime'); // true
    hamster.set('state', 'hungry');
    hamster.get('napTime'); // false
    ```
  
    @method equal
    @for Ember.computed
    @param {String} dependentKey
    @param {String|Number|Object} value
    @return {Ember.ComputedProperty} computed property which returns true if
    the original value for property is equal to the given value.
    @public
  */

  function equal(dependentKey, value) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.get(this, dependentKey) === value;
    });
  }

  /**
    A computed property that returns true if the provided dependent property
    is greater than the provided value.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      hasTooManyBananas: Ember.computed.gt('numBananas', 10)
    });
  
    let hamster = Hamster.create();
  
    hamster.get('hasTooManyBananas'); // false
    hamster.set('numBananas', 3);
    hamster.get('hasTooManyBananas'); // false
    hamster.set('numBananas', 11);
    hamster.get('hasTooManyBananas'); // true
    ```
  
    @method gt
    @for Ember.computed
    @param {String} dependentKey
    @param {Number} value
    @return {Ember.ComputedProperty} computed property which returns true if
    the original value for property is greater than given value.
    @public
  */

  function gt(dependentKey, value) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.get(this, dependentKey) > value;
    });
  }

  /**
    A computed property that returns true if the provided dependent property
    is greater than or equal to the provided value.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      hasTooManyBananas: Ember.computed.gte('numBananas', 10)
    });
  
    let hamster = Hamster.create();
  
    hamster.get('hasTooManyBananas'); // false
    hamster.set('numBananas', 3);
    hamster.get('hasTooManyBananas'); // false
    hamster.set('numBananas', 10);
    hamster.get('hasTooManyBananas'); // true
    ```
  
    @method gte
    @for Ember.computed
    @param {String} dependentKey
    @param {Number} value
    @return {Ember.ComputedProperty} computed property which returns true if
    the original value for property is greater or equal then given value.
    @public
  */

  function gte(dependentKey, value) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.get(this, dependentKey) >= value;
    });
  }

  /**
    A computed property that returns true if the provided dependent property
    is less than the provided value.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      needsMoreBananas: Ember.computed.lt('numBananas', 3)
    });
  
    let hamster = Hamster.create();
  
    hamster.get('needsMoreBananas'); // true
    hamster.set('numBananas', 3);
    hamster.get('needsMoreBananas'); // false
    hamster.set('numBananas', 2);
    hamster.get('needsMoreBananas'); // true
    ```
  
    @method lt
    @for Ember.computed
    @param {String} dependentKey
    @param {Number} value
    @return {Ember.ComputedProperty} computed property which returns true if
    the original value for property is less then given value.
    @public
  */

  function lt(dependentKey, value) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.get(this, dependentKey) < value;
    });
  }

  /**
    A computed property that returns true if the provided dependent property
    is less than or equal to the provided value.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      needsMoreBananas: Ember.computed.lte('numBananas', 3)
    });
  
    let hamster = Hamster.create();
  
    hamster.get('needsMoreBananas'); // true
    hamster.set('numBananas', 5);
    hamster.get('needsMoreBananas'); // false
    hamster.set('numBananas', 3);
    hamster.get('needsMoreBananas'); // true
    ```
  
    @method lte
    @for Ember.computed
    @param {String} dependentKey
    @param {Number} value
    @return {Ember.ComputedProperty} computed property which returns true if
    the original value for property is less or equal than given value.
    @public
  */

  function lte(dependentKey, value) {
    return _emberMetal.computed(dependentKey, function () {
      return _emberMetal.get(this, dependentKey) <= value;
    });
  }

  /**
    A computed property that performs a logical `and` on the
    original values for the provided dependent properties.
  
    You may pass in more than two properties and even use
    property brace expansion.  The computed property will
    return the first falsy value or last truthy value
    just like JavaScript's `&&` operator.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      readyForCamp: Ember.computed.and('hasTent', 'hasBackpack'),
      readyForHike: Ember.computed.and('hasWalkingStick', 'hasBackpack')
    });
  
    let tomster = Hamster.create();
  
    tomster.get('readyForCamp'); // false
    tomster.set('hasTent', true);
    tomster.get('readyForCamp'); // false
    tomster.set('hasBackpack', true);
    tomster.get('readyForCamp'); // true
    tomster.set('hasBackpack', 'Yes');
    tomster.get('readyForCamp'); // 'Yes'
    tomster.set('hasWalkingStick', null);
    tomster.get('readyForHike'); // null
    ```
  
    @method and
    @for Ember.computed
    @param {String} dependentKey*
    @return {Ember.ComputedProperty} computed property which performs
    a logical `and` on the values of all the original values for properties.
    @public
  */
  var and = generateComputedWithPredicate('and', function (value) {
    return value;
  });

  exports.and = and;
  /**
    A computed property which performs a logical `or` on the
    original values for the provided dependent properties.
  
    You may pass in more than two properties and even use
    property brace expansion.  The computed property will
    return the first truthy value or last falsy value just
    like JavaScript's `||` operator.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      readyForRain: Ember.computed.or('hasJacket', 'hasUmbrella'),
      readyForBeach: Ember.computed.or('{hasSunscreen,hasUmbrella}')
    });
  
    let tomster = Hamster.create();
  
    tomster.get('readyForRain'); // undefined
    tomster.set('hasUmbrella', true);
    tomster.get('readyForRain'); // true
    tomster.set('hasJacket', 'Yes');
    tomster.get('readyForRain'); // 'Yes'
    tomster.set('hasSunscreen', 'Check');
    tomster.get('readyForBeach'); // 'Check'
    ```
  
    @method or
    @for Ember.computed
    @param {String} dependentKey*
    @return {Ember.ComputedProperty} computed property which performs
    a logical `or` on the values of all the original values for properties.
    @public
  */
  var or = generateComputedWithPredicate('or', function (value) {
    return !value;
  });

  exports.or = or;
  /**
    Creates a new property that is an alias for another property
    on an object. Calls to `get` or `set` this property behave as
    though they were called on the original property.
  
    ```javascript
    let Person = Ember.Object.extend({
      name: 'Alex Matchneer',
      nomen: Ember.computed.alias('name')
    });
  
    let alex = Person.create();
  
    alex.get('nomen'); // 'Alex Matchneer'
    alex.get('name');  // 'Alex Matchneer'
  
    alex.set('nomen', '@machty');
    alex.get('name');  // '@machty'
    ```
  
    @method alias
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which creates an
    alias to the original value for property.
    @public
  */

  /**
    Where `computed.alias` aliases `get` and `set`, and allows for bidirectional
    data flow, `computed.oneWay` only provides an aliased `get`. The `set` will
    not mutate the upstream property, rather causes the current property to
    become the value set. This causes the downstream property to permanently
    diverge from the upstream property.
  
    Example
  
    ```javascript
    let User = Ember.Object.extend({
      firstName: null,
      lastName: null,
      nickName: Ember.computed.oneWay('firstName')
    });
  
    let teddy = User.create({
      firstName: 'Teddy',
      lastName:  'Zeenny'
    });
  
    teddy.get('nickName');              // 'Teddy'
    teddy.set('nickName', 'TeddyBear'); // 'TeddyBear'
    teddy.get('firstName');             // 'Teddy'
    ```
  
    @method oneWay
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which creates a
    one way computed property to the original value for property.
    @public
  */

  function oneWay(dependentKey) {
    return _emberMetal.alias(dependentKey).oneWay();
  }

  /**
    This is a more semantically meaningful alias of `computed.oneWay`,
    whose name is somewhat ambiguous as to which direction the data flows.
  
    @method reads
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which creates a
      one way computed property to the original value for property.
    @public
   */

  /**
    Where `computed.oneWay` provides oneWay bindings, `computed.readOnly` provides
    a readOnly one way binding. Very often when using `computed.oneWay` one does
    not also want changes to propagate back up, as they will replace the value.
  
    This prevents the reverse flow, and also throws an exception when it occurs.
  
    Example
  
    ```javascript
    let User = Ember.Object.extend({
      firstName: null,
      lastName: null,
      nickName: Ember.computed.readOnly('firstName')
    });
  
    let teddy = User.create({
      firstName: 'Teddy',
      lastName:  'Zeenny'
    });
  
    teddy.get('nickName');              // 'Teddy'
    teddy.set('nickName', 'TeddyBear'); // throws Exception
    // throw new Ember.Error('Cannot Set: nickName on: <User:ember27288>' );`
    teddy.get('firstName');             // 'Teddy'
    ```
  
    @method readOnly
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computed property which creates a
    one way computed property to the original value for property.
    @since 1.5.0
    @public
  */

  function readOnly(dependentKey) {
    return _emberMetal.alias(dependentKey).readOnly();
  }

  /**
    Creates a new property that is an alias for another property
    on an object. Calls to `get` or `set` this property behave as
    though they were called on the original property, but also
    print a deprecation warning.
  
    ```javascript
    let Hamster = Ember.Object.extend({
      bananaCount: Ember.computed.deprecatingAlias('cavendishCount', {
        id: 'hamster.deprecate-banana',
        until: '3.0.0'
      })
    });
  
    let hamster = Hamster.create();
  
    hamster.set('bananaCount', 5); // Prints a deprecation warning.
    hamster.get('cavendishCount'); // 5
    ```
  
    @method deprecatingAlias
    @for Ember.computed
    @param {String} dependentKey
    @param {Object} options Options for `Ember.deprecate`.
    @return {Ember.ComputedProperty} computed property which creates an
    alias with a deprecation to the original value for property.
    @since 1.7.0
    @public
  */

  function deprecatingAlias(dependentKey, options) {
    return _emberMetal.computed(dependentKey, {
      get: function (key) {
        _emberMetal.deprecate('Usage of `' + key + '` is deprecated, use `' + dependentKey + '` instead.', false, options);
        return _emberMetal.get(this, dependentKey);
      },
      set: function (key, value) {
        _emberMetal.deprecate('Usage of `' + key + '` is deprecated, use `' + dependentKey + '` instead.', false, options);
        _emberMetal.set(this, dependentKey, value);
        return value;
      }
    });
  }
});
enifed('ember-runtime/computed/reduce_computed_macros', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/compare', 'ember-runtime/utils', 'ember-runtime/system/native_array'], function (exports, _emberUtils, _emberMetal, _emberRuntimeCompare, _emberRuntimeUtils, _emberRuntimeSystemNative_array) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.sum = sum;
  exports.max = max;
  exports.min = min;
  exports.map = map;
  exports.mapBy = mapBy;
  exports.filter = filter;
  exports.filterBy = filterBy;
  exports.uniq = uniq;
  exports.uniqBy = uniqBy;
  exports.intersect = intersect;
  exports.setDiff = setDiff;
  exports.collect = collect;
  exports.sort = sort;

  function reduceMacro(dependentKey, callback, initialValue) {
    return _emberMetal.computed(dependentKey + '.[]', function () {
      var _this = this;

      var arr = _emberMetal.get(this, dependentKey);

      if (arr === null || typeof arr !== 'object') {
        return initialValue;
      }

      return arr.reduce(function (previousValue, currentValue, index, array) {
        return callback.call(_this, previousValue, currentValue, index, array);
      }, initialValue);
    }).readOnly();
  }

  function arrayMacro(dependentKey, callback) {
    // This is a bit ugly
    var propertyName = undefined;
    if (/@each/.test(dependentKey)) {
      propertyName = dependentKey.replace(/\.@each.*$/, '');
    } else {
      propertyName = dependentKey;
      dependentKey += '.[]';
    }

    return _emberMetal.computed(dependentKey, function () {
      var value = _emberMetal.get(this, propertyName);
      if (_emberRuntimeUtils.isArray(value)) {
        return _emberRuntimeSystemNative_array.A(callback.call(this, value));
      } else {
        return _emberRuntimeSystemNative_array.A();
      }
    }).readOnly();
  }

  function multiArrayMacro(dependentKeys, callback) {
    var args = dependentKeys.map(function (key) {
      return key + '.[]';
    });

    args.push(function () {
      return _emberRuntimeSystemNative_array.A(callback.call(this, dependentKeys));
    });

    return _emberMetal.computed.apply(this, args).readOnly();
  }

  /**
    A computed property that returns the sum of the values
    in the dependent array.
  
    @method sum
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computes the sum of all values in the dependentKey's array
    @since 1.4.0
    @public
  */

  function sum(dependentKey) {
    return reduceMacro(dependentKey, function (sum, item) {
      return sum + item;
    }, 0);
  }

  /**
    A computed property that calculates the maximum value in the
    dependent array. This will return `-Infinity` when the dependent
    array is empty.
  
    ```javascript
    let Person = Ember.Object.extend({
      childAges: Ember.computed.mapBy('children', 'age'),
      maxChildAge: Ember.computed.max('childAges')
    });
  
    let lordByron = Person.create({ children: [] });
  
    lordByron.get('maxChildAge'); // -Infinity
    lordByron.get('children').pushObject({
      name: 'Augusta Ada Byron', age: 7
    });
    lordByron.get('maxChildAge'); // 7
    lordByron.get('children').pushObjects([{
      name: 'Allegra Byron',
      age: 5
    }, {
      name: 'Elizabeth Medora Leigh',
      age: 8
    }]);
    lordByron.get('maxChildAge'); // 8
    ```
  
    If the types of the arguments are not numbers,
    they will be converted to numbers and the type
    of the return value will always be `Number`.
    For example, the max of a list of Date objects will be
    the highest timestamp as a `Number`.
    This behavior is consistent with `Math.max`.
  
    @method max
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computes the largest value in the dependentKey's array
    @public
  */

  function max(dependentKey) {
    return reduceMacro(dependentKey, function (max, item) {
      return Math.max(max, item);
    }, -Infinity);
  }

  /**
    A computed property that calculates the minimum value in the
    dependent array. This will return `Infinity` when the dependent
    array is empty.
  
    ```javascript
    let Person = Ember.Object.extend({
      childAges: Ember.computed.mapBy('children', 'age'),
      minChildAge: Ember.computed.min('childAges')
    });
  
    let lordByron = Person.create({ children: [] });
  
    lordByron.get('minChildAge'); // Infinity
    lordByron.get('children').pushObject({
      name: 'Augusta Ada Byron', age: 7
    });
    lordByron.get('minChildAge'); // 7
    lordByron.get('children').pushObjects([{
      name: 'Allegra Byron',
      age: 5
    }, {
      name: 'Elizabeth Medora Leigh',
      age: 8
    }]);
    lordByron.get('minChildAge'); // 5
    ```
  
    If the types of the arguments are not numbers,
    they will be converted to numbers and the type
    of the return value will always be `Number`.
    For example, the min of a list of Date objects will be
    the lowest timestamp as a `Number`.
    This behavior is consistent with `Math.min`.
  
    @method min
    @for Ember.computed
    @param {String} dependentKey
    @return {Ember.ComputedProperty} computes the smallest value in the dependentKey's array
    @public
  */

  function min(dependentKey) {
    return reduceMacro(dependentKey, function (min, item) {
      return Math.min(min, item);
    }, Infinity);
  }

  /**
    Returns an array mapped via the callback
  
    The callback method you provide should have the following signature.
    `item` is the current item in the iteration.
    `index` is the integer index of the current item in the iteration.
  
    ```javascript
    function(item, index);
    ```
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      excitingChores: Ember.computed.map('chores', function(chore, index) {
        return chore.toUpperCase() + '!';
      })
    });
  
    let hamster = Hamster.create({
      chores: ['clean', 'write more unit tests']
    });
  
    hamster.get('excitingChores'); // ['CLEAN!', 'WRITE MORE UNIT TESTS!']
    ```
  
    @method map
    @for Ember.computed
    @param {String} dependentKey
    @param {Function} callback
    @return {Ember.ComputedProperty} an array mapped via the callback
    @public
  */

  function map(dependentKey, callback) {
    return arrayMacro(dependentKey, function (value) {
      return value.map(callback, this);
    });
  }

  /**
    Returns an array mapped to the specified key.
  
    ```javascript
    let Person = Ember.Object.extend({
      childAges: Ember.computed.mapBy('children', 'age')
    });
  
    let lordByron = Person.create({ children: [] });
  
    lordByron.get('childAges'); // []
    lordByron.get('children').pushObject({ name: 'Augusta Ada Byron', age: 7 });
    lordByron.get('childAges'); // [7]
    lordByron.get('children').pushObjects([{
      name: 'Allegra Byron',
      age: 5
    }, {
      name: 'Elizabeth Medora Leigh',
      age: 8
    }]);
    lordByron.get('childAges'); // [7, 5, 8]
    ```
  
    @method mapBy
    @for Ember.computed
    @param {String} dependentKey
    @param {String} propertyKey
    @return {Ember.ComputedProperty} an array mapped to the specified key
    @public
  */

  function mapBy(dependentKey, propertyKey) {
    _emberMetal.assert('Ember.computed.mapBy expects a property string for its second argument, ' + 'perhaps you meant to use "map"', typeof propertyKey === 'string');

    return map(dependentKey + '.@each.' + propertyKey, function (item) {
      return _emberMetal.get(item, propertyKey);
    });
  }

  /**
    Filters the array by the callback.
  
    The callback method you provide should have the following signature.
    `item` is the current item in the iteration.
    `index` is the integer index of the current item in the iteration.
    `array` is the dependant array itself.
  
    ```javascript
    function(item, index, array);
    ```
  
    ```javascript
    let Hamster = Ember.Object.extend({
      remainingChores: Ember.computed.filter('chores', function(chore, index, array) {
        return !chore.done;
      })
    });
  
    let hamster = Hamster.create({
      chores: [
        { name: 'cook', done: true },
        { name: 'clean', done: true },
        { name: 'write more unit tests', done: false }
      ]
    });
  
    hamster.get('remainingChores'); // [{name: 'write more unit tests', done: false}]
    ```
  
    @method filter
    @for Ember.computed
    @param {String} dependentKey
    @param {Function} callback
    @return {Ember.ComputedProperty} the filtered array
    @public
  */

  function filter(dependentKey, callback) {
    return arrayMacro(dependentKey, function (value) {
      return value.filter(callback, this);
    });
  }

  /**
    Filters the array by the property and value
  
    ```javascript
    let Hamster = Ember.Object.extend({
      remainingChores: Ember.computed.filterBy('chores', 'done', false)
    });
  
    let hamster = Hamster.create({
      chores: [
        { name: 'cook', done: true },
        { name: 'clean', done: true },
        { name: 'write more unit tests', done: false }
      ]
    });
  
    hamster.get('remainingChores'); // [{ name: 'write more unit tests', done: false }]
    ```
  
    @method filterBy
    @for Ember.computed
    @param {String} dependentKey
    @param {String} propertyKey
    @param {*} value
    @return {Ember.ComputedProperty} the filtered array
    @public
  */

  function filterBy(dependentKey, propertyKey, value) {
    var callback = undefined;

    if (arguments.length === 2) {
      callback = function (item) {
        return _emberMetal.get(item, propertyKey);
      };
    } else {
      callback = function (item) {
        return _emberMetal.get(item, propertyKey) === value;
      };
    }

    return filter(dependentKey + '.@each.' + propertyKey, callback);
  }

  /**
    A computed property which returns a new array with all the unique
    elements from one or more dependent arrays.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      uniqueFruits: Ember.computed.uniq('fruits')
    });
  
    let hamster = Hamster.create({
      fruits: [
        'banana',
        'grape',
        'kale',
        'banana'
      ]
    });
  
    hamster.get('uniqueFruits'); // ['banana', 'grape', 'kale']
    ```
  
    @method uniq
    @for Ember.computed
    @param {String} propertyKey*
    @return {Ember.ComputedProperty} computes a new array with all the
    unique elements from the dependent array
    @public
  */

  function uniq() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return multiArrayMacro(args, function (dependentKeys) {
      var _this2 = this;

      var uniq = _emberRuntimeSystemNative_array.A();

      dependentKeys.forEach(function (dependentKey) {
        var value = _emberMetal.get(_this2, dependentKey);
        if (_emberRuntimeUtils.isArray(value)) {
          value.forEach(function (item) {
            if (uniq.indexOf(item) === -1) {
              uniq.push(item);
            }
          });
        }
      });

      return uniq;
    });
  }

  /**
    A computed property which returns a new array with all the unique
    elements from an array, with uniqueness determined by specific key.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      uniqueFruits: Ember.computed.uniqBy('fruits', 'id')
    });
    let hamster = Hamster.create({
      fruits: [
        { id: 1, 'banana' },
        { id: 2, 'grape' },
        { id: 3, 'peach' },
        { id: 1, 'banana' }
      ]
    });
    hamster.get('uniqueFruits'); // [ { id: 1, 'banana' }, { id: 2, 'grape' }, { id: 3, 'peach' }]
    ```
  
    @method uniqBy
    @for Ember.computed
    @param {String} dependentKey
    @param {String} propertyKey
    @return {Ember.ComputedProperty} computes a new array with all the
    unique elements from the dependent array
    @public
  */

  function uniqBy(dependentKey, propertyKey) {
    return _emberMetal.computed(dependentKey + '.[]', function () {
      var uniq = _emberRuntimeSystemNative_array.A();
      var seen = new _emberUtils.EmptyObject();
      var list = _emberMetal.get(this, dependentKey);
      if (_emberRuntimeUtils.isArray(list)) {
        list.forEach(function (item) {
          var guid = _emberUtils.guidFor(_emberMetal.get(item, propertyKey));
          if (!(guid in seen)) {
            seen[guid] = true;
            uniq.push(item);
          }
        });
      }
      return uniq;
    }).readOnly();
  }

  /**
    Alias for [Ember.computed.uniq](/api/#method_computed_uniq).
  
    @method union
    @for Ember.computed
    @param {String} propertyKey*
    @return {Ember.ComputedProperty} computes a new array with all the
    unique elements from the dependent array
    @public
  */
  var union = uniq;

  exports.union = union;
  /**
    A computed property which returns a new array with all the duplicated
    elements from two or more dependent arrays.
  
    Example
  
    ```javascript
    let obj = Ember.Object.extend({
      friendsInCommon: Ember.computed.intersect('adaFriends', 'charlesFriends')
    }).create({
      adaFriends: ['Charles Babbage', 'John Hobhouse', 'William King', 'Mary Somerville'],
      charlesFriends: ['William King', 'Mary Somerville', 'Ada Lovelace', 'George Peacock']
    });
  
    obj.get('friendsInCommon'); // ['William King', 'Mary Somerville']
    ```
  
    @method intersect
    @for Ember.computed
    @param {String} propertyKey*
    @return {Ember.ComputedProperty} computes a new array with all the
    duplicated elements from the dependent arrays
    @public
  */

  function intersect() {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return multiArrayMacro(args, function (dependentKeys) {
      var _this3 = this;

      var arrays = dependentKeys.map(function (dependentKey) {
        var array = _emberMetal.get(_this3, dependentKey);

        return _emberRuntimeUtils.isArray(array) ? array : [];
      });

      var results = arrays.pop().filter(function (candidate) {
        for (var i = 0; i < arrays.length; i++) {
          var found = false;
          var array = arrays[i];
          for (var j = 0; j < array.length; j++) {
            if (array[j] === candidate) {
              found = true;
              break;
            }
          }

          if (found === false) {
            return false;
          }
        }

        return true;
      });

      return _emberRuntimeSystemNative_array.A(results);
    });
  }

  /**
    A computed property which returns a new array with all the
    properties from the first dependent array that are not in the second
    dependent array.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      likes: ['banana', 'grape', 'kale'],
      wants: Ember.computed.setDiff('likes', 'fruits')
    });
  
    let hamster = Hamster.create({
      fruits: [
        'grape',
        'kale',
      ]
    });
  
    hamster.get('wants'); // ['banana']
    ```
  
    @method setDiff
    @for Ember.computed
    @param {String} setAProperty
    @param {String} setBProperty
    @return {Ember.ComputedProperty} computes a new array with all the
    items from the first dependent array that are not in the second
    dependent array
    @public
  */

  function setDiff(setAProperty, setBProperty) {
    if (arguments.length !== 2) {
      throw new _emberMetal.Error('setDiff requires exactly two dependent arrays.');
    }

    return _emberMetal.computed(setAProperty + '.[]', setBProperty + '.[]', function () {
      var setA = this.get(setAProperty);
      var setB = this.get(setBProperty);

      if (!_emberRuntimeUtils.isArray(setA)) {
        return _emberRuntimeSystemNative_array.A();
      }
      if (!_emberRuntimeUtils.isArray(setB)) {
        return _emberRuntimeSystemNative_array.A(setA);
      }

      return setA.filter(function (x) {
        return setB.indexOf(x) === -1;
      });
    }).readOnly();
  }

  /**
    A computed property that returns the array of values
    for the provided dependent properties.
  
    Example
  
    ```javascript
    let Hamster = Ember.Object.extend({
      clothes: Ember.computed.collect('hat', 'shirt')
    });
  
    let hamster = Hamster.create();
  
    hamster.get('clothes'); // [null, null]
    hamster.set('hat', 'Camp Hat');
    hamster.set('shirt', 'Camp Shirt');
    hamster.get('clothes'); // ['Camp Hat', 'Camp Shirt']
    ```
  
    @method collect
    @for Ember.computed
    @param {String} dependentKey*
    @return {Ember.ComputedProperty} computed property which maps
    values of all passed in properties to an array.
    @public
  */

  function collect() {
    for (var _len3 = arguments.length, dependentKeys = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      dependentKeys[_key3] = arguments[_key3];
    }

    return multiArrayMacro(dependentKeys, function () {
      var properties = _emberMetal.getProperties(this, dependentKeys);
      var res = _emberRuntimeSystemNative_array.A();
      for (var key in properties) {
        if (properties.hasOwnProperty(key)) {
          if (_emberMetal.isNone(properties[key])) {
            res.push(null);
          } else {
            res.push(properties[key]);
          }
        }
      }
      return res;
    });
  }

  /**
    A computed property which returns a new array with all the
    properties from the first dependent array sorted based on a property
    or sort function.
  
    The callback method you provide should have the following signature:
  
    ```javascript
    function(itemA, itemB);
    ```
  
    - `itemA` the first item to compare.
    - `itemB` the second item to compare.
  
    This function should return negative number (e.g. `-1`) when `itemA` should come before
    `itemB`. It should return positive number (e.g. `1`) when `itemA` should come after
    `itemB`. If the `itemA` and `itemB` are equal this function should return `0`.
  
    Therefore, if this function is comparing some numeric values, simple `itemA - itemB` or
    `itemA.get( 'foo' ) - itemB.get( 'foo' )` can be used instead of series of `if`.
  
    Example
  
    ```javascript
    let ToDoList = Ember.Object.extend({
      // using standard ascending sort
      todosSorting: ['name'],
      sortedTodos: Ember.computed.sort('todos', 'todosSorting'),
  
      // using descending sort
      todosSortingDesc: ['name:desc'],
      sortedTodosDesc: Ember.computed.sort('todos', 'todosSortingDesc'),
  
      // using a custom sort function
      priorityTodos: Ember.computed.sort('todos', function(a, b){
        if (a.priority > b.priority) {
          return 1;
        } else if (a.priority < b.priority) {
          return -1;
        }
  
        return 0;
      })
    });
  
    let todoList = ToDoList.create({todos: [
      { name: 'Unit Test', priority: 2 },
      { name: 'Documentation', priority: 3 },
      { name: 'Release', priority: 1 }
    ]});
  
    todoList.get('sortedTodos');      // [{ name:'Documentation', priority:3 }, { name:'Release', priority:1 }, { name:'Unit Test', priority:2 }]
    todoList.get('sortedTodosDesc');  // [{ name:'Unit Test', priority:2 }, { name:'Release', priority:1 }, { name:'Documentation', priority:3 }]
    todoList.get('priorityTodos');    // [{ name:'Release', priority:1 }, { name:'Unit Test', priority:2 }, { name:'Documentation', priority:3 }]
    ```
  
    @method sort
    @for Ember.computed
    @param {String} itemsKey
    @param {String or Function} sortDefinition a dependent key to an
    array of sort properties (add `:desc` to the arrays sort properties to sort descending) or a function to use when sorting
    @return {Ember.ComputedProperty} computes a new sorted array based
    on the sort property array or callback function
    @public
  */

  function sort(itemsKey, sortDefinition) {
    _emberMetal.assert('Ember.computed.sort requires two arguments: an array key to sort and ' + 'either a sort properties key or sort function', arguments.length === 2);

    if (typeof sortDefinition === 'function') {
      return customSort(itemsKey, sortDefinition);
    } else {
      return propertySort(itemsKey, sortDefinition);
    }
  }

  function customSort(itemsKey, comparator) {
    return arrayMacro(itemsKey, function (value) {
      var _this4 = this;

      return value.slice().sort(function (x, y) {
        return comparator.call(_this4, x, y);
      });
    });
  }

  // This one needs to dynamically set up and tear down observers on the itemsKey
  // depending on the sortProperties
  function propertySort(itemsKey, sortPropertiesKey) {
    var cp = new _emberMetal.ComputedProperty(function (key) {
      var _this5 = this;

      var itemsKeyIsAtThis = itemsKey === '@this';
      var sortProperties = _emberMetal.get(this, sortPropertiesKey);

      _emberMetal.assert('The sort definition for \'' + key + '\' on ' + this + ' must be a function or an array of strings', _emberRuntimeUtils.isArray(sortProperties) && sortProperties.every(function (s) {
        return typeof s === 'string';
      }));

      var normalizedSortProperties = normalizeSortProperties(sortProperties);

      // Add/remove property observers as required.
      var activeObserversMap = cp._activeObserverMap || (cp._activeObserverMap = new _emberMetal.WeakMap());
      var activeObservers = activeObserversMap.get(this);

      if (activeObservers) {
        activeObservers.forEach(function (args) {
          return _emberMetal.removeObserver.apply(null, args);
        });
      }

      function sortPropertyDidChange() {
        this.notifyPropertyChange(key);
      }

      activeObservers = normalizedSortProperties.map(function (_ref) {
        var prop = _ref[0];

        var path = itemsKeyIsAtThis ? '@each.' + prop : itemsKey + '.@each.' + prop;
        var args = [_this5, path, sortPropertyDidChange];
        _emberMetal.addObserver.apply(null, args);
        return args;
      });

      activeObserversMap.set(this, activeObservers);

      // Sort and return the array.
      var items = itemsKeyIsAtThis ? this : _emberMetal.get(this, itemsKey);

      if (_emberRuntimeUtils.isArray(items)) {
        return sortByNormalizedSortProperties(items, normalizedSortProperties);
      } else {
        return _emberRuntimeSystemNative_array.A();
      }
    });

    cp._activeObserverMap = undefined;

    return cp.property(sortPropertiesKey + '.[]').readOnly();
  }

  function normalizeSortProperties(sortProperties) {
    return sortProperties.map(function (p) {
      var _p$split = p.split(':');

      var prop = _p$split[0];
      var direction = _p$split[1];

      direction = direction || 'asc';

      return [prop, direction];
    });
  }

  function sortByNormalizedSortProperties(items, normalizedSortProperties) {
    return _emberRuntimeSystemNative_array.A(items.slice().sort(function (itemA, itemB) {
      for (var i = 0; i < normalizedSortProperties.length; i++) {
        var _normalizedSortProperties$i = normalizedSortProperties[i];
        var prop = _normalizedSortProperties$i[0];
        var direction = _normalizedSortProperties$i[1];

        var result = _emberRuntimeCompare.default(_emberMetal.get(itemA, prop), _emberMetal.get(itemB, prop));
        if (result !== 0) {
          return direction === 'desc' ? -1 * result : result;
        }
      }

      return 0;
    }));
  }
});
enifed('ember-runtime/controllers/controller', ['exports', 'ember-metal', 'ember-runtime/system/object', 'ember-runtime/mixins/controller', 'ember-runtime/inject', 'ember-runtime/mixins/action_handler'], function (exports, _emberMetal, _emberRuntimeSystemObject, _emberRuntimeMixinsController, _emberRuntimeInject, _emberRuntimeMixinsAction_handler) {
  'use strict';

  /**
  @module ember
  @submodule ember-runtime
  */

  /**
    @class Controller
    @namespace Ember
    @extends Ember.Object
    @uses Ember.ControllerMixin
    @public
  */
  var Controller = _emberRuntimeSystemObject.default.extend(_emberRuntimeMixinsController.default);

  _emberRuntimeMixinsAction_handler.deprecateUnderscoreActions(Controller);

  function controllerInjectionHelper(factory) {
    _emberMetal.assert('Defining an injected controller property on a ' + 'non-controller is not allowed.', _emberRuntimeMixinsController.default.detect(factory.PrototypeMixin));
  }

  /**
    Creates a property that lazily looks up another controller in the container.
    Can only be used when defining another controller.
  
    Example:
  
    ```javascript
    App.PostController = Ember.Controller.extend({
      posts: Ember.inject.controller()
    });
    ```
  
    This example will create a `posts` property on the `post` controller that
    looks up the `posts` controller in the container, making it easy to
    reference other controllers. This is functionally equivalent to:
  
    ```javascript
    App.PostController = Ember.Controller.extend({
      needs: 'posts',
      posts: Ember.computed.alias('controllers.posts')
    });
    ```
  
    @method controller
    @since 1.10.0
    @for Ember.inject
    @param {String} name (optional) name of the controller to inject, defaults
           to the property's name
    @return {Ember.InjectedProperty} injection descriptor instance
    @public
  */
  _emberRuntimeInject.createInjectionHelper('controller', controllerInjectionHelper);

  exports.default = Controller;
});
enifed('ember-runtime/copy', ['exports', 'ember-metal', 'ember-runtime/system/object', 'ember-runtime/mixins/copyable'], function (exports, _emberMetal, _emberRuntimeSystemObject, _emberRuntimeMixinsCopyable) {
  'use strict';

  exports.default = copy;

  function _copy(obj, deep, seen, copies) {
    var ret = undefined,
        loc = undefined,
        key = undefined;

    // primitive data types are immutable, just return them.
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // avoid cyclical loops
    if (deep && (loc = seen.indexOf(obj)) >= 0) {
      return copies[loc];
    }

    _emberMetal.assert('Cannot clone an Ember.Object that does not implement Ember.Copyable', !(obj instanceof _emberRuntimeSystemObject.default) || _emberRuntimeMixinsCopyable.default && _emberRuntimeMixinsCopyable.default.detect(obj));

    // IMPORTANT: this specific test will detect a native array only. Any other
    // object will need to implement Copyable.
    if (Array.isArray(obj)) {
      ret = obj.slice();

      if (deep) {
        loc = ret.length;

        while (--loc >= 0) {
          ret[loc] = _copy(ret[loc], deep, seen, copies);
        }
      }
    } else if (_emberRuntimeMixinsCopyable.default && _emberRuntimeMixinsCopyable.default.detect(obj)) {
      ret = obj.copy(deep, seen, copies);
    } else if (obj instanceof Date) {
      ret = new Date(obj.getTime());
    } else {
      ret = {};

      for (key in obj) {
        // support Null prototype
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
          continue;
        }

        // Prevents browsers that don't respect non-enumerability from
        // copying internal Ember properties
        if (key.substring(0, 2) === '__') {
          continue;
        }

        ret[key] = deep ? _copy(obj[key], deep, seen, copies) : obj[key];
      }
    }

    if (deep) {
      seen.push(obj);
      copies.push(ret);
    }

    return ret;
  }

  /**
    Creates a shallow copy of the passed object. A deep copy of the object is
    returned if the optional `deep` argument is `true`.
  
    If the passed object implements the `Ember.Copyable` interface, then this
    function will delegate to the object's `copy()` method and return the
    result. See `Ember.Copyable` for further details.
  
    For primitive values (which are immutable in JavaScript), the passed object
    is simply returned.
  
    @method copy
    @for Ember
    @param {Object} obj The object to clone
    @param {Boolean} [deep=false] If true, a deep copy of the object is made.
    @return {Object} The copied object
    @public
  */

  function copy(obj, deep) {
    // fast paths
    if ('object' !== typeof obj || obj === null) {
      return obj; // can't copy primitives
    }

    if (_emberRuntimeMixinsCopyable.default && _emberRuntimeMixinsCopyable.default.detect(obj)) {
      return obj.copy(deep);
    }

    return _copy(obj, deep, deep ? [] : null, deep ? [] : null);
  }
});
enifed('ember-runtime/ext/function', ['exports', 'ember-environment', 'ember-metal'], function (exports, _emberEnvironment, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  var a_slice = Array.prototype.slice;
  var FunctionPrototype = Function.prototype;

  if (_emberEnvironment.ENV.EXTEND_PROTOTYPES.Function) {
    /**
      The `property` extension of Javascript's Function prototype is available
      when `EmberENV.EXTEND_PROTOTYPES` or `EmberENV.EXTEND_PROTOTYPES.Function` is
      `true`, which is the default.
       Computed properties allow you to treat a function like a property:
       ```javascript
      MyApp.President = Ember.Object.extend({
        firstName: '',
        lastName:  '',
         fullName: function() {
          return this.get('firstName') + ' ' + this.get('lastName');
        }.property() // Call this flag to mark the function as a property
      });
       let president = MyApp.President.create({
        firstName: 'Barack',
        lastName: 'Obama'
      });
       president.get('fullName'); // 'Barack Obama'
      ```
       Treating a function like a property is useful because they can work with
      bindings, just like any other property.
       Many computed properties have dependencies on other properties. For
      example, in the above example, the `fullName` property depends on
      `firstName` and `lastName` to determine its value. You can tell Ember
      about these dependencies like this:
       ```javascript
      MyApp.President = Ember.Object.extend({
        firstName: '',
        lastName:  '',
         fullName: function() {
          return this.get('firstName') + ' ' + this.get('lastName');
           // Tell Ember.js that this computed property depends on firstName
          // and lastName
        }.property('firstName', 'lastName')
      });
      ```
       Make sure you list these dependencies so Ember knows when to update
      bindings that connect to a computed property. Changing a dependency
      will not immediately trigger an update of the computed property, but
      will instead clear the cache so that it is updated when the next `get`
      is called on the property.
       See [Ember.ComputedProperty](/api/classes/Ember.ComputedProperty.html), [Ember.computed](/api/classes/Ember.computed.html).
       @method property
      @for Function
      @public
    */
    FunctionPrototype.property = function () {
      var ret = _emberMetal.computed(this);
      // ComputedProperty.prototype.property expands properties; no need for us to
      // do so here.
      return ret.property.apply(ret, arguments);
    };

    /**
      The `observes` extension of Javascript's Function prototype is available
      when `EmberENV.EXTEND_PROTOTYPES` or `EmberENV.EXTEND_PROTOTYPES.Function` is
      true, which is the default.
       You can observe property changes simply by adding the `observes`
      call to the end of your method declarations in classes that you write.
      For example:
       ```javascript
      Ember.Object.extend({
        valueObserver: function() {
          // Executes whenever the "value" property changes
        }.observes('value')
      });
      ```
       In the future this method may become asynchronous.
       See `Ember.observer`.
       @method observes
      @for Function
      @public
    */
    FunctionPrototype.observes = function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      args.push(this);
      return _emberMetal.observer.apply(this, args);
    };

    FunctionPrototype._observesImmediately = function () {
      _emberMetal.assert('Immediate observers must observe internal properties only, ' + 'not properties on other objects.', function checkIsInternalProperty() {
        for (var i = 0; i < arguments.length; i++) {
          if (arguments[i].indexOf('.') !== -1) {
            return false;
          }
        }
        return true;
      });

      // observes handles property expansion
      return this.observes.apply(this, arguments);
    };
    /**
      The `observesImmediately` extension of Javascript's Function prototype is
      available when `EmberENV.EXTEND_PROTOTYPES` or
      `EmberENV.EXTEND_PROTOTYPES.Function` is true, which is the default.
       You can observe property changes simply by adding the `observesImmediately`
      call to the end of your method declarations in classes that you write.
      For example:
       ```javascript
      Ember.Object.extend({
        valueObserver: function() {
          // Executes immediately after the "value" property changes
        }.observesImmediately('value')
      });
      ```
       In the future, `observes` may become asynchronous. In this event,
      `observesImmediately` will maintain the synchronous behavior.
       See `Ember.immediateObserver`.
       @method observesImmediately
      @for Function
      @deprecated
      @private
    */
    FunctionPrototype.observesImmediately = _emberMetal.deprecateFunc('Function#observesImmediately is deprecated. Use Function#observes instead', { id: 'ember-runtime.ext-function', until: '3.0.0' }, FunctionPrototype._observesImmediately);

    /**
      The `on` extension of Javascript's Function prototype is available
      when `EmberENV.EXTEND_PROTOTYPES` or `EmberENV.EXTEND_PROTOTYPES.Function` is
      true, which is the default.
       You can listen for events simply by adding the `on` call to the end of
      your method declarations in classes or mixins that you write. For example:
       ```javascript
      Ember.Mixin.create({
        doSomethingWithElement: function() {
          // Executes whenever the "didInsertElement" event fires
        }.on('didInsertElement')
      });
      ```
       See `Ember.on`.
       @method on
      @for Function
      @public
    */
    FunctionPrototype.on = function () {
      var events = a_slice.call(arguments);
      this.__ember_listens__ = events;

      return this;
    };
  }
});
enifed('ember-runtime/ext/rsvp', ['exports', 'rsvp', 'ember-metal'], function (exports, _rsvp, _emberMetal) {
  'use strict';

  exports.onerrorDefault = onerrorDefault;

  var backburner = _emberMetal.run.backburner;
  _emberMetal.run._addQueue('rsvpAfter', 'destroy');

  _rsvp.configure('async', function (callback, promise) {
    backburner.schedule('actions', null, callback, promise);
  });

  _rsvp.configure('after', function (cb) {
    backburner.schedule('rsvpAfter', null, cb);
  });

  _rsvp.on('error', onerrorDefault);

  function onerrorDefault(reason) {
    var error = errorFor(reason);
    if (error) {
      _emberMetal.dispatchError(error);
    }
  }

  function errorFor(reason) {
    if (!reason) return;

    if (reason.errorThrown) {
      return unwrapErrorThrown(reason);
    }

    if (reason.name === 'UnrecognizedURLError') {
      _emberMetal.assert('The URL \'' + reason.message + '\' did not match any routes in your application', false);
      return;
    }

    if (reason.name === 'TransitionAborted') {
      return;
    }

    return reason;
  }

  function unwrapErrorThrown(reason) {
    var error = reason.errorThrown;
    if (typeof error === 'string') {
      error = new Error(error);
    }
    Object.defineProperty(error, '__reason_with_error_thrown__', {
      value: reason,
      enumerable: false
    });
    return error;
  }

  exports.default = _rsvp;
});
enifed('ember-runtime/ext/string', ['exports', 'ember-environment', 'ember-runtime/system/string'], function (exports, _emberEnvironment, _emberRuntimeSystemString) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  var StringPrototype = String.prototype;

  if (_emberEnvironment.ENV.EXTEND_PROTOTYPES.String) {
    /**
      See [Ember.String.fmt](/api/classes/Ember.String.html#method_fmt).
       @method fmt
      @for String
      @private
      @deprecated
    */
    StringPrototype.fmt = function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _emberRuntimeSystemString.fmt(this, args);
    };

    /**
      See [Ember.String.w](/api/classes/Ember.String.html#method_w).
       @method w
      @for String
      @private
    */
    StringPrototype.w = function () {
      return _emberRuntimeSystemString.w(this);
    };

    /**
      See [Ember.String.loc](/api/classes/Ember.String.html#method_loc).
       @method loc
      @for String
      @private
    */
    StringPrototype.loc = function () {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return _emberRuntimeSystemString.loc(this, args);
    };

    /**
      See [Ember.String.camelize](/api/classes/Ember.String.html#method_camelize).
       @method camelize
      @for String
      @private
    */
    StringPrototype.camelize = function () {
      return _emberRuntimeSystemString.camelize(this);
    };

    /**
      See [Ember.String.decamelize](/api/classes/Ember.String.html#method_decamelize).
       @method decamelize
      @for String
      @private
    */
    StringPrototype.decamelize = function () {
      return _emberRuntimeSystemString.decamelize(this);
    };

    /**
      See [Ember.String.dasherize](/api/classes/Ember.String.html#method_dasherize).
       @method dasherize
      @for String
      @private
    */
    StringPrototype.dasherize = function () {
      return _emberRuntimeSystemString.dasherize(this);
    };

    /**
      See [Ember.String.underscore](/api/classes/Ember.String.html#method_underscore).
       @method underscore
      @for String
      @private
    */
    StringPrototype.underscore = function () {
      return _emberRuntimeSystemString.underscore(this);
    };

    /**
      See [Ember.String.classify](/api/classes/Ember.String.html#method_classify).
       @method classify
      @for String
      @private
    */
    StringPrototype.classify = function () {
      return _emberRuntimeSystemString.classify(this);
    };

    /**
      See [Ember.String.capitalize](/api/classes/Ember.String.html#method_capitalize).
       @method capitalize
      @for String
      @private
    */
    StringPrototype.capitalize = function () {
      return _emberRuntimeSystemString.capitalize(this);
    };
  }
});
enifed('ember-runtime/index', ['exports', 'ember-runtime/ext/string', 'ember-runtime/ext/function', 'ember-runtime/system/object', 'ember-runtime/system/string', 'ember-runtime/mixins/registry_proxy', 'ember-runtime/mixins/container_proxy', 'ember-runtime/copy', 'ember-runtime/inject', 'ember-runtime/compare', 'ember-runtime/is-equal', 'ember-runtime/mixins/array', 'ember-runtime/mixins/comparable', 'ember-runtime/system/namespace', 'ember-runtime/system/array_proxy', 'ember-runtime/system/object_proxy', 'ember-runtime/system/core_object', 'ember-runtime/system/native_array', 'ember-runtime/mixins/action_handler', 'ember-runtime/mixins/copyable', 'ember-runtime/mixins/enumerable', 'ember-runtime/mixins/freezable', 'ember-runtime/mixins/-proxy', 'ember-runtime/system/lazy_load', 'ember-runtime/mixins/observable', 'ember-runtime/mixins/mutable_enumerable', 'ember-runtime/mixins/mutable_array', 'ember-runtime/mixins/target_action_support', 'ember-runtime/mixins/evented', 'ember-runtime/mixins/promise_proxy', 'ember-runtime/computed/computed_macros', 'ember-runtime/computed/reduce_computed_macros', 'ember-runtime/controllers/controller', 'ember-runtime/mixins/controller', 'ember-runtime/system/service', 'ember-runtime/ext/rsvp', 'ember-runtime/utils', 'ember-runtime/string_registry'], function (exports, _emberRuntimeExtString, _emberRuntimeExtFunction, _emberRuntimeSystemObject, _emberRuntimeSystemString, _emberRuntimeMixinsRegistry_proxy, _emberRuntimeMixinsContainer_proxy, _emberRuntimeCopy, _emberRuntimeInject, _emberRuntimeCompare, _emberRuntimeIsEqual, _emberRuntimeMixinsArray, _emberRuntimeMixinsComparable, _emberRuntimeSystemNamespace, _emberRuntimeSystemArray_proxy, _emberRuntimeSystemObject_proxy, _emberRuntimeSystemCore_object, _emberRuntimeSystemNative_array, _emberRuntimeMixinsAction_handler, _emberRuntimeMixinsCopyable, _emberRuntimeMixinsEnumerable, _emberRuntimeMixinsFreezable, _emberRuntimeMixinsProxy, _emberRuntimeSystemLazy_load, _emberRuntimeMixinsObservable, _emberRuntimeMixinsMutable_enumerable, _emberRuntimeMixinsMutable_array, _emberRuntimeMixinsTarget_action_support, _emberRuntimeMixinsEvented, _emberRuntimeMixinsPromise_proxy, _emberRuntimeComputedComputed_macros, _emberRuntimeComputedReduce_computed_macros, _emberRuntimeControllersController, _emberRuntimeMixinsController, _emberRuntimeSystemService, _emberRuntimeExtRsvp, _emberRuntimeUtils, _emberRuntimeString_registry) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.Object = _emberRuntimeSystemObject.default;
  exports.FrameworkObject = _emberRuntimeSystemObject.FrameworkObject;
  exports.String = _emberRuntimeSystemString.default;
  exports.RegistryProxyMixin = _emberRuntimeMixinsRegistry_proxy.default;
  exports.buildFakeRegistryWithDeprecations = _emberRuntimeMixinsRegistry_proxy.buildFakeRegistryWithDeprecations;
  exports.ContainerProxyMixin = _emberRuntimeMixinsContainer_proxy.default;
  exports.copy = _emberRuntimeCopy.default;
  exports.inject = _emberRuntimeInject.default;
  exports.compare = _emberRuntimeCompare.default;
  exports.isEqual = _emberRuntimeIsEqual.default;
  exports.Array = _emberRuntimeMixinsArray.default;
  exports.objectAt = _emberRuntimeMixinsArray.objectAt;
  exports.isEmberArray = _emberRuntimeMixinsArray.isEmberArray;
  exports.addArrayObserver = _emberRuntimeMixinsArray.addArrayObserver;
  exports.removeArrayObserver = _emberRuntimeMixinsArray.removeArrayObserver;
  exports.Comparable = _emberRuntimeMixinsComparable.default;
  exports.Namespace = _emberRuntimeSystemNamespace.default;
  exports.isNamespaceSearchDisabled = _emberRuntimeSystemNamespace.isSearchDisabled;
  exports.setNamespaceSearchDisabled = _emberRuntimeSystemNamespace.setSearchDisabled;
  exports.ArrayProxy = _emberRuntimeSystemArray_proxy.default;
  exports.ObjectProxy = _emberRuntimeSystemObject_proxy.default;
  exports.CoreObject = _emberRuntimeSystemCore_object.default;
  exports.NativeArray = _emberRuntimeSystemNative_array.default;
  exports.A = _emberRuntimeSystemNative_array.A;
  exports.ActionHandler = _emberRuntimeMixinsAction_handler.default;
  exports.deprecateUnderscoreActions = _emberRuntimeMixinsAction_handler.deprecateUnderscoreActions;
  exports.Copyable = _emberRuntimeMixinsCopyable.default;
  exports.Enumerable = _emberRuntimeMixinsEnumerable.default;
  exports.Freezable = _emberRuntimeMixinsFreezable.Freezable;
  exports.FROZEN_ERROR = _emberRuntimeMixinsFreezable.FROZEN_ERROR;
  exports._ProxyMixin = _emberRuntimeMixinsProxy.default;
  exports.onLoad = _emberRuntimeSystemLazy_load.onLoad;
  exports.runLoadHooks = _emberRuntimeSystemLazy_load.runLoadHooks;
  exports._loaded = _emberRuntimeSystemLazy_load._loaded;
  exports.Observable = _emberRuntimeMixinsObservable.default;
  exports.MutableEnumerable = _emberRuntimeMixinsMutable_enumerable.default;
  exports.MutableArray = _emberRuntimeMixinsMutable_array.default;
  exports.removeAt = _emberRuntimeMixinsMutable_array.removeAt;
  exports.TargetActionSupport = _emberRuntimeMixinsTarget_action_support.default;
  exports.Evented = _emberRuntimeMixinsEvented.default;
  exports.PromiseProxyMixin = _emberRuntimeMixinsPromise_proxy.default;
  exports.empty = _emberRuntimeComputedComputed_macros.empty;
  exports.notEmpty = _emberRuntimeComputedComputed_macros.notEmpty;
  exports.none = _emberRuntimeComputedComputed_macros.none;
  exports.not = _emberRuntimeComputedComputed_macros.not;
  exports.bool = _emberRuntimeComputedComputed_macros.bool;
  exports.match = _emberRuntimeComputedComputed_macros.match;
  exports.equal = _emberRuntimeComputedComputed_macros.equal;
  exports.gt = _emberRuntimeComputedComputed_macros.gt;
  exports.gte = _emberRuntimeComputedComputed_macros.gte;
  exports.lt = _emberRuntimeComputedComputed_macros.lt;
  exports.lte = _emberRuntimeComputedComputed_macros.lte;
  exports.oneWay = _emberRuntimeComputedComputed_macros.oneWay;
  exports.readOnly = _emberRuntimeComputedComputed_macros.readOnly;
  exports.deprecatingAlias = _emberRuntimeComputedComputed_macros.deprecatingAlias;
  exports.and = _emberRuntimeComputedComputed_macros.and;
  exports.or = _emberRuntimeComputedComputed_macros.or;
  exports.sum = _emberRuntimeComputedReduce_computed_macros.sum;
  exports.min = _emberRuntimeComputedReduce_computed_macros.min;
  exports.max = _emberRuntimeComputedReduce_computed_macros.max;
  exports.map = _emberRuntimeComputedReduce_computed_macros.map;
  exports.sort = _emberRuntimeComputedReduce_computed_macros.sort;
  exports.setDiff = _emberRuntimeComputedReduce_computed_macros.setDiff;
  exports.mapBy = _emberRuntimeComputedReduce_computed_macros.mapBy;
  exports.filter = _emberRuntimeComputedReduce_computed_macros.filter;
  exports.filterBy = _emberRuntimeComputedReduce_computed_macros.filterBy;
  exports.uniq = _emberRuntimeComputedReduce_computed_macros.uniq;
  exports.uniqBy = _emberRuntimeComputedReduce_computed_macros.uniqBy;
  exports.union = _emberRuntimeComputedReduce_computed_macros.union;
  exports.intersect = _emberRuntimeComputedReduce_computed_macros.intersect;
  exports.collect = _emberRuntimeComputedReduce_computed_macros.collect;
  exports.Controller = _emberRuntimeControllersController.default;
  exports.ControllerMixin = _emberRuntimeMixinsController.default;
  exports.Service = _emberRuntimeSystemService.default;
  exports.RSVP = _emberRuntimeExtRsvp.default;
  exports.onerrorDefault = _emberRuntimeExtRsvp.onerrorDefault;
  // just for side effect of extending Ember.RSVP
  exports.isArray = _emberRuntimeUtils.isArray;
  exports.typeOf = _emberRuntimeUtils.typeOf;
  exports.getStrings = _emberRuntimeString_registry.getStrings;
  exports.setStrings = _emberRuntimeString_registry.setStrings;
});
// just for side effect of extending String.prototype
// just for side effect of extending Function.prototype
enifed('ember-runtime/inject', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  'use strict';

  exports.default = inject;
  exports.createInjectionHelper = createInjectionHelper;
  exports.validatePropertyInjections = validatePropertyInjections;

  /**
    Namespace for injection helper methods.
  
    @class inject
    @namespace Ember
    @static
    @public
  */

  function inject() {
    _emberMetal.assert('Injected properties must be created through helpers, see \'' + Object.keys(inject).join('"', '"') + '\'');
  }

  // Dictionary of injection validations by type, added to by `createInjectionHelper`
  var typeValidators = {};

  /**
    This method allows other Ember modules to register injection helpers for a
    given container type. Helpers are exported to the `inject` namespace as the
    container type itself.
  
    @private
    @method createInjectionHelper
    @since 1.10.0
    @for Ember
    @param {String} type The container type the helper will inject
    @param {Function} validator A validation callback that is executed at mixin-time
  */

  function createInjectionHelper(type, validator) {
    typeValidators[type] = validator;

    inject[type] = function (name) {
      return new _emberMetal.InjectedProperty(type, name);
    };
  }

  /**
    Validation function that runs per-type validation functions once for each
    injected type encountered.
  
    @private
    @method validatePropertyInjections
    @since 1.10.0
    @for Ember
    @param {Object} factory The factory object
  */

  function validatePropertyInjections(factory) {
    var proto = factory.proto();
    var types = [];

    for (var key in proto) {
      var desc = proto[key];
      if (desc instanceof _emberMetal.InjectedProperty && types.indexOf(desc.type) === -1) {
        types.push(desc.type);
      }
    }

    if (types.length) {
      for (var i = 0; i < types.length; i++) {
        var validator = typeValidators[types[i]];

        if (typeof validator === 'function') {
          validator(factory);
        }
      }
    }

    return true;
  }
});
enifed('ember-runtime/is-equal', ['exports'], function (exports) {
  /**
    Compares two objects, returning true if they are equal.
  
    ```javascript
    Ember.isEqual('hello', 'hello');                   // true
    Ember.isEqual(1, 2);                               // false
    ```
  
    `isEqual` is a more specific comparison than a triple equal comparison.
    It will call the `isEqual` instance method on the objects being
    compared, allowing finer control over when objects should be considered
    equal to each other.
  
    ```javascript
    let Person = Ember.Object.extend({
      isEqual(other) { return this.ssn == other.ssn; }
    });
  
    let personA = Person.create({name: 'Muhammad Ali', ssn: '123-45-6789'});
    let personB = Person.create({name: 'Cassius Clay', ssn: '123-45-6789'});
  
    Ember.isEqual(personA, personB); // true
    ```
  
    Due to the expense of array comparisons, collections will never be equal to
    each other even if each of their items are equal to each other.
  
    ```javascript
    Ember.isEqual([4, 2], [4, 2]);                     // false
    ```
  
    @method isEqual
    @for Ember
    @param {Object} a first object to compare
    @param {Object} b second object to compare
    @return {Boolean}
    @public
  */
  'use strict';

  exports.default = isEqual;

  function isEqual(a, b) {
    if (a && typeof a.isEqual === 'function') {
      return a.isEqual(b);
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    return a === b;
  }
});
enifed('ember-runtime/mixins/-proxy', ['exports', 'glimmer-reference', 'ember-metal', 'ember-runtime/computed/computed_macros'], function (exports, _glimmerReference, _emberMetal, _emberRuntimeComputedComputed_macros) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  function contentPropertyWillChange(content, contentKey) {
    var key = contentKey.slice(8); // remove "content."
    if (key in this) {
      return;
    } // if shadowed in proxy
    _emberMetal.propertyWillChange(this, key);
  }

  function contentPropertyDidChange(content, contentKey) {
    var key = contentKey.slice(8); // remove "content."
    if (key in this) {
      return;
    } // if shadowed in proxy
    _emberMetal.propertyDidChange(this, key);
  }

  var ProxyTag = (function (_CachedTag) {
    babelHelpers.inherits(ProxyTag, _CachedTag);

    function ProxyTag(proxy) {
      _CachedTag.call(this);

      var content = _emberMetal.get(proxy, 'content');

      this.proxy = proxy;
      this.proxyWrapperTag = new _glimmerReference.DirtyableTag();
      this.proxyContentTag = new _glimmerReference.UpdatableTag(_emberMetal.tagFor(content));
    }

    /**
      `Ember.ProxyMixin` forwards all properties not defined by the proxy itself
      to a proxied `content` object.  See Ember.ObjectProxy for more details.
    
      @class ProxyMixin
      @namespace Ember
      @private
    */

    ProxyTag.prototype.compute = function compute() {
      return Math.max(this.proxyWrapperTag.value(), this.proxyContentTag.value());
    };

    ProxyTag.prototype.dirty = function dirty() {
      this.proxyWrapperTag.dirty();
    };

    ProxyTag.prototype.contentDidChange = function contentDidChange() {
      var content = _emberMetal.get(this.proxy, 'content');
      this.proxyContentTag.update(_emberMetal.tagFor(content));
    };

    return ProxyTag;
  })(_glimmerReference.CachedTag);

  exports.default = _emberMetal.Mixin.create({
    /**
      The object whose properties will be forwarded.
       @property content
      @type Ember.Object
      @default null
      @private
    */
    content: null,

    init: function () {
      this._super.apply(this, arguments);
      _emberMetal.meta(this).setProxy();
    },

    _initializeTag: _emberMetal.on('init', function () {
      _emberMetal.meta(this)._tag = new ProxyTag(this);
    }),

    _contentDidChange: _emberMetal.observer('content', function () {
      _emberMetal.assert('Can\'t set Proxy\'s content to itself', _emberMetal.get(this, 'content') !== this);
      _emberMetal.tagFor(this).contentDidChange();
    }),

    isTruthy: _emberRuntimeComputedComputed_macros.bool('content'),

    _debugContainerKey: null,

    willWatchProperty: function (key) {
      var contentKey = 'content.' + key;
      _emberMetal._addBeforeObserver(this, contentKey, null, contentPropertyWillChange);
      _emberMetal.addObserver(this, contentKey, null, contentPropertyDidChange);
    },

    didUnwatchProperty: function (key) {
      var contentKey = 'content.' + key;
      _emberMetal._removeBeforeObserver(this, contentKey, null, contentPropertyWillChange);
      _emberMetal.removeObserver(this, contentKey, null, contentPropertyDidChange);
    },

    unknownProperty: function (key) {
      var content = _emberMetal.get(this, 'content');
      if (content) {
        _emberMetal.deprecate('You attempted to access `' + key + '` from `' + this + '`, but object proxying is deprecated. Please use `model.' + key + '` instead.', !this.isController, { id: 'ember-runtime.controller-proxy', until: '3.0.0' });
        return _emberMetal.get(content, key);
      }
    },

    setUnknownProperty: function (key, value) {
      var m = _emberMetal.meta(this);
      if (m.proto === this) {
        // if marked as prototype then just defineProperty
        // rather than delegate
        _emberMetal.defineProperty(this, key, null, value);
        return value;
      }

      var content = _emberMetal.get(this, 'content');
      _emberMetal.assert('Cannot delegate set(\'' + key + '\', ' + value + ') to the \'content\' property of object proxy ' + this + ': its \'content\' is undefined.', content);

      _emberMetal.deprecate('You attempted to set `' + key + '` from `' + this + '`, but object proxying is deprecated. Please use `model.' + key + '` instead.', !this.isController, { id: 'ember-runtime.controller-proxy', until: '3.0.0' });
      return _emberMetal.set(content, key, value);
    }
  });
});
enifed('ember-runtime/mixins/action_handler', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.deprecateUnderscoreActions = deprecateUnderscoreActions;

  /**
    `Ember.ActionHandler` is available on some familiar classes including
    `Ember.Route`, `Ember.Component`, and `Ember.Controller`.
    (Internally the mixin is used by `Ember.CoreView`, `Ember.ControllerMixin`,
    and `Ember.Route` and available to the above classes through
    inheritance.)
  
    @class ActionHandler
    @namespace Ember
    @private
  */
  var ActionHandler = _emberMetal.Mixin.create({
    mergedProperties: ['actions'],

    /**
      The collection of functions, keyed by name, available on this
      `ActionHandler` as action targets.
       These functions will be invoked when a matching `{{action}}` is triggered
      from within a template and the application's current route is this route.
       Actions can also be invoked from other parts of your application
      via `ActionHandler#send`.
       The `actions` hash will inherit action handlers from
      the `actions` hash defined on extended parent classes
      or mixins rather than just replace the entire hash, e.g.:
       ```js
      App.CanDisplayBanner = Ember.Mixin.create({
        actions: {
          displayBanner(msg) {
            // ...
          }
        }
      });
       App.WelcomeRoute = Ember.Route.extend(App.CanDisplayBanner, {
        actions: {
          playMusic() {
            // ...
          }
        }
      });
       // `WelcomeRoute`, when active, will be able to respond
      // to both actions, since the actions hash is merged rather
      // then replaced when extending mixins / parent classes.
      this.send('displayBanner');
      this.send('playMusic');
      ```
       Within a Controller, Route or Component's action handler,
      the value of the `this` context is the Controller, Route or
      Component object:
       ```js
      App.SongRoute = Ember.Route.extend({
        actions: {
          myAction() {
            this.controllerFor("song");
            this.transitionTo("other.route");
            ...
          }
        }
      });
      ```
       It is also possible to call `this._super(...arguments)` from within an
      action handler if it overrides a handler defined on a parent
      class or mixin:
       Take for example the following routes:
       ```js
      App.DebugRoute = Ember.Mixin.create({
        actions: {
          debugRouteInformation() {
            console.debug("trololo");
          }
        }
      });
       App.AnnoyingDebugRoute = Ember.Route.extend(App.DebugRoute, {
        actions: {
          debugRouteInformation() {
            // also call the debugRouteInformation of mixed in App.DebugRoute
            this._super(...arguments);
             // show additional annoyance
            window.alert(...);
          }
        }
      });
      ```
       ## Bubbling
       By default, an action will stop bubbling once a handler defined
      on the `actions` hash handles it. To continue bubbling the action,
      you must return `true` from the handler:
       ```js
      App.Router.map(function() {
        this.route("album", function() {
          this.route("song");
        });
      });
       App.AlbumRoute = Ember.Route.extend({
        actions: {
          startPlaying: function() {
          }
        }
      });
       App.AlbumSongRoute = Ember.Route.extend({
        actions: {
          startPlaying() {
            // ...
             if (actionShouldAlsoBeTriggeredOnParentRoute) {
              return true;
            }
          }
        }
      });
      ```
       @property actions
      @type Object
      @default null
      @public
    */

    /**
      Triggers a named action on the `ActionHandler`. Any parameters
      supplied after the `actionName` string will be passed as arguments
      to the action target function.
       If the `ActionHandler` has its `target` property set, actions may
      bubble to the `target`. Bubbling happens when an `actionName` can
      not be found in the `ActionHandler`'s `actions` hash or if the
      action target function returns `true`.
       Example
       ```js
      App.WelcomeRoute = Ember.Route.extend({
        actions: {
          playTheme() {
             this.send('playMusic', 'theme.mp3');
          },
          playMusic(track) {
            // ...
          }
        }
      });
      ```
       @method send
      @param {String} actionName The action to trigger
      @param {*} context a context to send with the action
      @public
    */
    send: function (actionName) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var target = undefined;

      if (this.actions && this.actions[actionName]) {
        var shouldBubble = this.actions[actionName].apply(this, args) === true;
        if (!shouldBubble) {
          return;
        }
      }

      if (target = _emberMetal.get(this, 'target')) {
        var _target;

        _emberMetal.assert('The `target` for ' + this + ' (' + target + ') does not have a `send` method', typeof target.send === 'function');
        (_target = target).send.apply(_target, arguments);
      }
    },

    willMergeMixin: function (props) {
      _emberMetal.assert('Specifying `_actions` and `actions` in the same mixin is not supported.', !props.actions || !props._actions);

      if (props._actions) {
        _emberMetal.deprecate('Specifying actions in `_actions` is deprecated, please use `actions` instead.', false, { id: 'ember-runtime.action-handler-_actions', until: '3.0.0' });

        props.actions = props._actions;
        delete props._actions;
      }
    }
  });

  exports.default = ActionHandler;

  function deprecateUnderscoreActions(factory) {
    Object.defineProperty(factory.prototype, '_actions', {
      configurable: true,
      enumerable: false,
      set: function (value) {
        _emberMetal.assert('You cannot set `_actions` on ' + this + ', please use `actions` instead.');
      },
      get: function () {
        _emberMetal.deprecate('Usage of `_actions` is deprecated, use `actions` instead.', false, { id: 'ember-runtime.action-handler-_actions', until: '3.0.0' });
        return _emberMetal.get(this, 'actions');
      }
    });
  }
});
enifed('ember-runtime/mixins/array', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/mixins/enumerable', 'ember-runtime/system/each_proxy'], function (exports, _emberUtils, _emberMetal, _emberRuntimeMixinsEnumerable, _emberRuntimeSystemEach_proxy) {
  /**
  @module ember
  @submodule ember-runtime
  */

  // ..........................................................
  // HELPERS
  //
  'use strict';

  var _Mixin$create;

  exports.addArrayObserver = addArrayObserver;
  exports.removeArrayObserver = removeArrayObserver;
  exports.objectAt = objectAt;
  exports.arrayContentWillChange = arrayContentWillChange;
  exports.arrayContentDidChange = arrayContentDidChange;
  exports.isEmberArray = isEmberArray;

  function arrayObserversHelper(obj, target, opts, operation, notify) {
    var willChange = opts && opts.willChange || 'arrayWillChange';
    var didChange = opts && opts.didChange || 'arrayDidChange';
    var hasObservers = _emberMetal.get(obj, 'hasArrayObservers');

    if (hasObservers === notify) {
      _emberMetal.propertyWillChange(obj, 'hasArrayObservers');
    }

    operation(obj, '@array:before', target, willChange);
    operation(obj, '@array:change', target, didChange);

    if (hasObservers === notify) {
      _emberMetal.propertyDidChange(obj, 'hasArrayObservers');
    }

    return obj;
  }

  function addArrayObserver(array, target, opts) {
    return arrayObserversHelper(array, target, opts, _emberMetal.addListener, false);
  }

  function removeArrayObserver(array, target, opts) {
    return arrayObserversHelper(array, target, opts, _emberMetal.removeListener, true);
  }

  function objectAt(content, idx) {
    if (content.objectAt) {
      return content.objectAt(idx);
    }

    return content[idx];
  }

  function arrayContentWillChange(array, startIdx, removeAmt, addAmt) {
    var removing = undefined,
        lim = undefined;

    // if no args are passed assume everything changes
    if (startIdx === undefined) {
      startIdx = 0;
      removeAmt = addAmt = -1;
    } else {
      if (removeAmt === undefined) {
        removeAmt = -1;
      }

      if (addAmt === undefined) {
        addAmt = -1;
      }
    }

    if (array.__each) {
      array.__each.arrayWillChange(array, startIdx, removeAmt, addAmt);
    }

    _emberMetal.sendEvent(array, '@array:before', [array, startIdx, removeAmt, addAmt]);

    if (startIdx >= 0 && removeAmt >= 0 && _emberMetal.get(array, 'hasEnumerableObservers')) {
      removing = [];
      lim = startIdx + removeAmt;

      for (var idx = startIdx; idx < lim; idx++) {
        removing.push(objectAt(array, idx));
      }
    } else {
      removing = removeAmt;
    }

    array.enumerableContentWillChange(removing, addAmt);

    return array;
  }

  function arrayContentDidChange(array, startIdx, removeAmt, addAmt) {
    // if no args are passed assume everything changes
    if (startIdx === undefined) {
      startIdx = 0;
      removeAmt = addAmt = -1;
    } else {
      if (removeAmt === undefined) {
        removeAmt = -1;
      }

      if (addAmt === undefined) {
        addAmt = -1;
      }
    }

    var adding = undefined;
    if (startIdx >= 0 && addAmt >= 0 && _emberMetal.get(array, 'hasEnumerableObservers')) {
      adding = [];
      var lim = startIdx + addAmt;

      for (var idx = startIdx; idx < lim; idx++) {
        adding.push(objectAt(array, idx));
      }
    } else {
      adding = addAmt;
    }

    array.enumerableContentDidChange(removeAmt, adding);

    if (array.__each) {
      array.__each.arrayDidChange(array, startIdx, removeAmt, addAmt);
    }

    _emberMetal.sendEvent(array, '@array:change', [array, startIdx, removeAmt, addAmt]);

    var meta = _emberMetal.peekMeta(array);
    var cache = meta && meta.readableCache();

    if (cache) {
      if (cache.firstObject !== undefined && objectAt(array, 0) !== _emberMetal.cacheFor.get(cache, 'firstObject')) {
        _emberMetal.propertyWillChange(array, 'firstObject');
        _emberMetal.propertyDidChange(array, 'firstObject');
      }
      if (cache.lastObject !== undefined && objectAt(array, _emberMetal.get(array, 'length') - 1) !== _emberMetal.cacheFor.get(cache, 'lastObject')) {
        _emberMetal.propertyWillChange(array, 'lastObject');
        _emberMetal.propertyDidChange(array, 'lastObject');
      }
    }
    return array;
  }

  var EMBER_ARRAY = _emberUtils.symbol('EMBER_ARRAY');

  function isEmberArray(obj) {
    return obj && !!obj[EMBER_ARRAY];
  }

  // ..........................................................
  // ARRAY
  //
  /**
    This mixin implements Observer-friendly Array-like behavior. It is not a
    concrete implementation, but it can be used up by other classes that want
    to appear like arrays.
  
    For example, ArrayProxy is a concrete classes that can
    be instantiated to implement array-like behavior. Both of these classes use
    the Array Mixin by way of the MutableArray mixin, which allows observable
    changes to be made to the underlying array.
  
    Unlike `Ember.Enumerable,` this mixin defines methods specifically for
    collections that provide index-ordered access to their contents. When you
    are designing code that needs to accept any kind of Array-like object, you
    should use these methods instead of Array primitives because these will
    properly notify observers of changes to the array.
  
    Although these methods are efficient, they do add a layer of indirection to
    your application so it is a good idea to use them only when you need the
    flexibility of using both true JavaScript arrays and "virtual" arrays such
    as controllers and collections.
  
    You can use the methods defined in this module to access and modify array
    contents in a KVO-friendly way. You can also be notified whenever the
    membership of an array changes by using `.observes('myArray.[]')`.
  
    To support `Ember.Array` in your own class, you must override two
    primitives to use it: `length()` and `objectAt()`.
  
    Note that the Ember.Array mixin also incorporates the `Ember.Enumerable`
    mixin. All `Ember.Array`-like objects are also enumerable.
  
    @class Array
    @namespace Ember
    @uses Ember.Enumerable
    @since Ember 0.9.0
    @public
  */
  var ArrayMixin = _emberMetal.Mixin.create(_emberRuntimeMixinsEnumerable.default, (_Mixin$create = {}, _Mixin$create[EMBER_ARRAY] = true, _Mixin$create.length = null, _Mixin$create.objectAt = function (idx) {
    if (idx < 0 || idx >= _emberMetal.get(this, 'length')) {
      return undefined;
    }

    return _emberMetal.get(this, idx);
  }, _Mixin$create.objectsAt = function (indexes) {
    var _this = this;

    return indexes.map(function (idx) {
      return objectAt(_this, idx);
    });
  }, _Mixin$create.nextObject = function (idx) {
    return objectAt(this, idx);
  }, _Mixin$create['[]'] = _emberMetal.computed({
    get: function (key) {
      return this;
    },
    set: function (key, value) {
      this.replace(0, _emberMetal.get(this, 'length'), value);
      return this;
    }
  }), _Mixin$create.firstObject = _emberMetal.computed(function () {
    return objectAt(this, 0);
  }).readOnly(), _Mixin$create.lastObject = _emberMetal.computed(function () {
    return objectAt(this, _emberMetal.get(this, 'length') - 1);
  }).readOnly(), _Mixin$create.contains = function (obj) {
    if (_emberMetal.isFeatureEnabled('ember-runtime-enumerable-includes')) {
      _emberMetal.deprecate('`Enumerable#contains` is deprecated, use `Enumerable#includes` instead.', false, { id: 'ember-runtime.enumerable-contains', until: '3.0.0', url: 'http://emberjs.com/deprecations/v2.x#toc_enumerable-contains' });
    }

    return this.indexOf(obj) >= 0;
  }, _Mixin$create.slice = function (beginIndex, endIndex) {
    var ret = _emberMetal.default.A();
    var length = _emberMetal.get(this, 'length');

    if (_emberMetal.isNone(beginIndex)) {
      beginIndex = 0;
    }

    if (_emberMetal.isNone(endIndex) || endIndex > length) {
      endIndex = length;
    }

    if (beginIndex < 0) {
      beginIndex = length + beginIndex;
    }

    if (endIndex < 0) {
      endIndex = length + endIndex;
    }

    while (beginIndex < endIndex) {
      ret[ret.length] = objectAt(this, beginIndex++);
    }

    return ret;
  }, _Mixin$create.indexOf = function (object, startAt) {
    var len = _emberMetal.get(this, 'length');

    if (startAt === undefined) {
      startAt = 0;
    }

    if (startAt < 0) {
      startAt += len;
    }

    for (var idx = startAt; idx < len; idx++) {
      if (objectAt(this, idx) === object) {
        return idx;
      }
    }

    return -1;
  }, _Mixin$create.lastIndexOf = function (object, startAt) {
    var len = _emberMetal.get(this, 'length');

    if (startAt === undefined || startAt >= len) {
      startAt = len - 1;
    }

    if (startAt < 0) {
      startAt += len;
    }

    for (var idx = startAt; idx >= 0; idx--) {
      if (objectAt(this, idx) === object) {
        return idx;
      }
    }

    return -1;
  }, _Mixin$create.addArrayObserver = function (target, opts) {
    return addArrayObserver(this, target, opts);
  }, _Mixin$create.removeArrayObserver = function (target, opts) {
    return removeArrayObserver(this, target, opts);
  }, _Mixin$create.hasArrayObservers = _emberMetal.computed(function () {
    return _emberMetal.hasListeners(this, '@array:change') || _emberMetal.hasListeners(this, '@array:before');
  }), _Mixin$create.arrayContentWillChange = function (startIdx, removeAmt, addAmt) {
    return arrayContentWillChange(this, startIdx, removeAmt, addAmt);
  }, _Mixin$create.arrayContentDidChange = function (startIdx, removeAmt, addAmt) {
    return arrayContentDidChange(this, startIdx, removeAmt, addAmt);
  }, _Mixin$create['@each'] = _emberMetal.computed(function () {
    // TODO use Symbol or add to meta
    if (!this.__each) {
      this.__each = new _emberRuntimeSystemEach_proxy.default(this);
    }

    return this.__each;
  }).volatile().readOnly(), _Mixin$create));

  if (_emberMetal.isFeatureEnabled('ember-runtime-enumerable-includes')) {
    ArrayMixin.reopen({
      /**
        Returns `true` if the passed object can be found in the array.
        This method is a Polyfill for ES 2016 Array.includes.
        If no `startAt` argument is given, the starting location to
        search is 0. If it's negative, searches from the index of
        `this.length + startAt` by asc.
         ```javascript
        [1, 2, 3].includes(2);     // true
        [1, 2, 3].includes(4);     // false
        [1, 2, 3].includes(3, 2);  // true
        [1, 2, 3].includes(3, 3);  // false
        [1, 2, 3].includes(3, -1); // true
        [1, 2, 3].includes(1, -1); // false
        [1, 2, 3].includes(1, -4); // true
        [1, 2, NaN].includes(NaN); // true
        ```
         @method includes
        @param {Object} obj The object to search for.
        @param {Number} startAt optional starting location to search, default 0
        @return {Boolean} `true` if object is found in the array.
        @public
      */
      includes: function (obj, startAt) {
        var len = _emberMetal.get(this, 'length');

        if (startAt === undefined) {
          startAt = 0;
        }

        if (startAt < 0) {
          startAt += len;
        }

        for (var idx = startAt; idx < len; idx++) {
          var currentObj = objectAt(this, idx);

          // SameValueZero comparison (NaN !== NaN)
          if (obj === currentObj || obj !== obj && currentObj !== currentObj) {
            return true;
          }
        }

        return false;
      }
    });
  }

  exports.default = ArrayMixin;
});
// ES6TODO: Ember.A

/**
  __Required.__ You must implement this method to apply this mixin.
   Your array must support the `length` property. Your replace methods should
  set this property whenever it changes.
   @property {Number} length
  @public
*/

/**
  Returns the object at the given `index`. If the given `index` is negative
  or is greater or equal than the array length, returns `undefined`.
   This is one of the primitives you must implement to support `Ember.Array`.
  If your object supports retrieving the value of an array item using `get()`
  (i.e. `myArray.get(0)`), then you do not need to implement this method
  yourself.
   ```javascript
  let arr = ['a', 'b', 'c', 'd'];
   arr.objectAt(0);   // 'a'
  arr.objectAt(3);   // 'd'
  arr.objectAt(-1);  // undefined
  arr.objectAt(4);   // undefined
  arr.objectAt(5);   // undefined
  ```
   @method objectAt
  @param {Number} idx The index of the item to return.
  @return {*} item at index or undefined
  @public
*/

/**
  This returns the objects at the specified indexes, using `objectAt`.
   ```javascript
  let arr = ['a', 'b', 'c', 'd'];
   arr.objectsAt([0, 1, 2]);  // ['a', 'b', 'c']
  arr.objectsAt([2, 3, 4]);  // ['c', 'd', undefined]
  ```
   @method objectsAt
  @param {Array} indexes An array of indexes of items to return.
  @return {Array}
  @public
 */

// overrides Ember.Enumerable version

/**
  This is the handler for the special array content property. If you get
  this property, it will return this. If you set this property to a new
  array, it will replace the current content.
   This property overrides the default property defined in `Ember.Enumerable`.
   @property []
  @return this
  @public
*/

// optimized version from Enumerable

// Add any extra methods to Ember.Array that are native to the built-in Array.
/**
  Returns a new array that is a slice of the receiver. This implementation
  uses the observable array methods to retrieve the objects for the new
  slice.
   ```javascript
  let arr = ['red', 'green', 'blue'];
   arr.slice(0);       // ['red', 'green', 'blue']
  arr.slice(0, 2);    // ['red', 'green']
  arr.slice(1, 100);  // ['green', 'blue']
  ```
   @method slice
  @param {Number} beginIndex (Optional) index to begin slicing from.
  @param {Number} endIndex (Optional) index to end the slice at (but not included).
  @return {Array} New array with specified slice
  @public
*/

/**
  Returns the index of the given object's first occurrence.
  If no `startAt` argument is given, the starting location to
  search is 0. If it's negative, will count backward from
  the end of the array. Returns -1 if no match is found.
   ```javascript
  let arr = ['a', 'b', 'c', 'd', 'a'];
   arr.indexOf('a');       //  0
  arr.indexOf('z');       // -1
  arr.indexOf('a', 2);    //  4
  arr.indexOf('a', -1);   //  4
  arr.indexOf('b', 3);    // -1
  arr.indexOf('a', 100);  // -1
  ```
   @method indexOf
  @param {Object} object the item to search for
  @param {Number} startAt optional starting location to search, default 0
  @return {Number} index or -1 if not found
  @public
*/

/**
  Returns the index of the given object's last occurrence.
  If no `startAt` argument is given, the search starts from
  the last position. If it's negative, will count backward
  from the end of the array. Returns -1 if no match is found.
   ```javascript
  let arr = ['a', 'b', 'c', 'd', 'a'];
   arr.lastIndexOf('a');       //  4
  arr.lastIndexOf('z');       // -1
  arr.lastIndexOf('a', 2);    //  0
  arr.lastIndexOf('a', -1);   //  4
  arr.lastIndexOf('b', 3);    //  1
  arr.lastIndexOf('a', 100);  //  4
  ```
   @method lastIndexOf
  @param {Object} object the item to search for
  @param {Number} startAt optional starting location to search, default 0
  @return {Number} index or -1 if not found
  @public
*/

// ..........................................................
// ARRAY OBSERVERS
//

/**
  Adds an array observer to the receiving array. The array observer object
  normally must implement two methods:
   * `arrayWillChange(observedObj, start, removeCount, addCount)` - This method will be
    called just before the array is modified.
  * `arrayDidChange(observedObj, start, removeCount, addCount)` - This method will be
    called just after the array is modified.
   Both callbacks will be passed the observed object, starting index of the
  change as well as a count of the items to be removed and added. You can use
  these callbacks to optionally inspect the array during the change, clear
  caches, or do any other bookkeeping necessary.
   In addition to passing a target, you can also include an options hash
  which you can use to override the method names that will be invoked on the
  target.
   @method addArrayObserver
  @param {Object} target The observer object.
  @param {Object} opts Optional hash of configuration options including
    `willChange` and `didChange` option.
  @return {Ember.Array} receiver
  @public
*/

/**
  Removes an array observer from the object if the observer is current
  registered. Calling this method multiple times with the same object will
  have no effect.
   @method removeArrayObserver
  @param {Object} target The object observing the array.
  @param {Object} opts Optional hash of configuration options including
    `willChange` and `didChange` option.
  @return {Ember.Array} receiver
  @public
*/

/**
  Becomes true whenever the array currently has observers watching changes
  on the array.
   @property {Boolean} hasArrayObservers
  @public
*/

/**
  If you are implementing an object that supports `Ember.Array`, call this
  method just before the array content changes to notify any observers and
  invalidate any related properties. Pass the starting index of the change
  as well as a delta of the amounts to change.
   @method arrayContentWillChange
  @param {Number} startIdx The starting index in the array that will change.
  @param {Number} removeAmt The number of items that will be removed. If you
    pass `null` assumes 0
  @param {Number} addAmt The number of items that will be added. If you
    pass `null` assumes 0.
  @return {Ember.Array} receiver
  @public
*/

/**
  If you are implementing an object that supports `Ember.Array`, call this
  method just after the array content changes to notify any observers and
  invalidate any related properties. Pass the starting index of the change
  as well as a delta of the amounts to change.
   @method arrayContentDidChange
  @param {Number} startIdx The starting index in the array that did change.
  @param {Number} removeAmt The number of items that were removed. If you
    pass `null` assumes 0
  @param {Number} addAmt The number of items that were added. If you
    pass `null` assumes 0.
  @return {Ember.Array} receiver
  @public
*/

/**
  Returns a special object that can be used to observe individual properties
  on the array. Just get an equivalent property on this object and it will
  return an enumerable that maps automatically to the named key on the
  member objects.
   `@each` should only be used in a non-terminal context. Example:
   ```javascript
  myMethod: computed('posts.@each.author', function(){
    ...
  });
  ```
   If you merely want to watch for the array being changed, like an object being
  replaced, added or removed, use `[]` instead of `@each`.
   ```javascript
  myMethod: computed('posts.[]', function(){
    ...
  });
  ```
   @property @each
  @public
*/
enifed('ember-runtime/mixins/comparable', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  'use strict';

  /**
  @module ember
  @submodule ember-runtime
  */

  /**
    Implements some standard methods for comparing objects. Add this mixin to
    any class you create that can compare its instances.
  
    You should implement the `compare()` method.
  
    @class Comparable
    @namespace Ember
    @since Ember 0.9
    @private
  */
  exports.default = _emberMetal.Mixin.create({

    /**
      __Required.__ You must implement this method to apply this mixin.
       Override to return the result of the comparison of the two parameters. The
      compare method should return:
       - `-1` if `a < b`
      - `0` if `a == b`
      - `1` if `a > b`
       Default implementation raises an exception.
       @method compare
      @param a {Object} the first object to compare
      @param b {Object} the second object to compare
      @return {Number} the result of the comparison
      @private
    */
    compare: null
  });
});
enifed('ember-runtime/mixins/container_proxy', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */
  'use strict';

  /**
    ContainerProxyMixin is used to provide public access to specific
    container functionality.
  
    @class ContainerProxyMixin
    @private
  */
  exports.default = _emberMetal.Mixin.create({
    /**
     The container stores state.
      @private
     @property {Ember.Container} __container__
     */
    __container__: null,

    /**
     Returns an object that can be used to provide an owner to a
     manually created instance.
      Example:
      ```
     let owner = Ember.getOwner(this);
      User.create(
       owner.ownerInjection(),
       { username: 'rwjblue' }
     )
     ```
      @public
     @method ownerInjection
     @return {Object}
    */
    ownerInjection: function () {
      return this.__container__.ownerInjection();
    },

    /**
     Given a fullName return a corresponding instance.
      The default behaviour is for lookup to return a singleton instance.
     The singleton is scoped to the container, allowing multiple containers
     to all have their own locally scoped singletons.
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('api:twitter', Twitter);
      let twitter = container.lookup('api:twitter');
      twitter instanceof Twitter; // => true
      // by default the container will return singletons
     let twitter2 = container.lookup('api:twitter');
     twitter2 instanceof Twitter; // => true
      twitter === twitter2; //=> true
     ```
      If singletons are not wanted an optional flag can be provided at lookup.
      ```javascript
     let registry = new Registry();
     let container = registry.container();
      registry.register('api:twitter', Twitter);
      let twitter = container.lookup('api:twitter', { singleton: false });
     let twitter2 = container.lookup('api:twitter', { singleton: false });
      twitter === twitter2; //=> false
     ```
      @public
     @method lookup
     @param {String} fullName
     @param {Object} options
     @return {any}
     */
    lookup: function (fullName, options) {
      return this.__container__.lookup(fullName, options);
    },

    /**
     Given a fullName return the corresponding factory.
      @private
     @method _lookupFactory
     @param {String} fullName
     @return {any}
     */
    _lookupFactory: function (fullName, options) {
      return this.__container__.lookupFactory(fullName, options);
    },

    /**
     Given a name and a source path, resolve the fullName
      @private
     @method _resolveLocalLookupName
     @param {String} fullName
     @param {String} source
     @return {String}
     */
    _resolveLocalLookupName: function (name, source) {
      return this.__container__.registry.expandLocalLookup('component:' + name, {
        source: source
      });
    },

    /**
     @private
     */
    willDestroy: function () {
      this._super.apply(this, arguments);

      if (this.__container__) {
        _emberMetal.run(this.__container__, 'destroy');
      }
    }
  });
});
enifed('ember-runtime/mixins/controller', ['exports', 'ember-metal', 'ember-runtime/mixins/action_handler', 'ember-runtime/mixins/controller_content_model_alias_deprecation'], function (exports, _emberMetal, _emberRuntimeMixinsAction_handler, _emberRuntimeMixinsController_content_model_alias_deprecation) {
  'use strict';

  /**
    @class ControllerMixin
    @namespace Ember
    @uses Ember.ActionHandler
    @private
  */
  exports.default = _emberMetal.Mixin.create(_emberRuntimeMixinsAction_handler.default, _emberRuntimeMixinsController_content_model_alias_deprecation.default, {
    /* ducktype as a controller */
    isController: true,

    /**
      The object to which actions from the view should be sent.
       For example, when a Handlebars template uses the `{{action}}` helper,
      it will attempt to send the action to the view's controller's `target`.
       By default, the value of the target property is set to the router, and
      is injected when a controller is instantiated. This injection is applied
      as part of the application's initialization process. In most cases the
      `target` property will automatically be set to the logical consumer of
      actions for the controller.
       @property target
      @default null
      @public
    */
    target: null,

    store: null,

    /**
      The controller's current model. When retrieving or modifying a controller's
      model, this property should be used instead of the `content` property.
       @property model
      @public
     */
    model: null,

    /**
      @private
    */
    content: _emberMetal.alias('model')

  });
});
enifed('ember-runtime/mixins/controller_content_model_alias_deprecation', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  'use strict';

  /*
    The ControllerContentModelAliasDeprecation mixin is used to provide a useful
    deprecation warning when specifying `content` directly on a `Ember.Controller`
    (without also specifying `model`).
  
    Ember versions prior to 1.7 used `model` as an alias of `content`, but due to
    much confusion this alias was reversed (so `content` is now an alias of `model).
  
    This change reduces many caveats with model/content, and also sets a
    simple ground rule: Never set a controllers content, rather always set
    its model and ember will do the right thing.
  
    Used internally by Ember in `Ember.Controller`.
  */
  exports.default = _emberMetal.Mixin.create({
    /**
      @private
       Moves `content` to `model`  at extend time if a `model` is not also specified.
       Note that this currently modifies the mixin themselves, which is technically
      dubious but is practically of little consequence. This may change in the
      future.
       @method willMergeMixin
      @since 1.4.0
    */
    willMergeMixin: function (props) {
      // Calling super is only OK here since we KNOW that
      // there is another Mixin loaded first.
      this._super.apply(this, arguments);

      var modelSpecified = !!props.model;

      if (props.content && !modelSpecified) {
        props.model = props.content;
        delete props['content'];

        _emberMetal.deprecate('Do not specify `content` on a Controller, use `model` instead.', false, { id: 'ember-runtime.will-merge-mixin', until: '3.0.0' });
      }
    }
  });
});
enifed('ember-runtime/mixins/copyable', ['exports', 'ember-metal', 'ember-runtime/mixins/freezable'], function (exports, _emberMetal, _emberRuntimeMixinsFreezable) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  /**
    Implements some standard methods for copying an object. Add this mixin to
    any object you create that can create a copy of itself. This mixin is
    added automatically to the built-in array.
  
    You should generally implement the `copy()` method to return a copy of the
    receiver.
  
    Note that `frozenCopy()` will only work if you also implement
    `Ember.Freezable`.
  
    @class Copyable
    @namespace Ember
    @since Ember 0.9
    @private
  */
  exports.default = _emberMetal.Mixin.create({
    /**
      __Required.__ You must implement this method to apply this mixin.
       Override to return a copy of the receiver. Default implementation raises
      an exception.
       @method copy
      @param {Boolean} deep if `true`, a deep copy of the object should be made
      @return {Object} copy of receiver
      @private
    */
    copy: null,

    /**
      If the object implements `Ember.Freezable`, then this will return a new
      copy if the object is not frozen and the receiver if the object is frozen.
       Raises an exception if you try to call this method on a object that does
      not support freezing.
       You should use this method whenever you want a copy of a freezable object
      since a freezable object can simply return itself without actually
      consuming more memory.
       @method frozenCopy
      @return {Object} copy of receiver or receiver
      @deprecated Use `Object.freeze` instead.
      @private
    */
    frozenCopy: function () {
      _emberMetal.deprecate('`frozenCopy` is deprecated, use `Object.freeze` instead.', false, { id: 'ember-runtime.frozen-copy', until: '3.0.0' });
      if (_emberRuntimeMixinsFreezable.Freezable && _emberRuntimeMixinsFreezable.Freezable.detect(this)) {
        return _emberMetal.get(this, 'isFrozen') ? this : this.copy().freeze();
      } else {
        throw new _emberMetal.Error(this + ' does not support freezing');
      }
    }
  });
});
enifed('ember-runtime/mixins/enumerable', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/compare', 'require'], function (exports, _emberUtils, _emberMetal, _emberRuntimeCompare, _require) {
  /**
  @module ember
  @submodule ember-runtime
  */

  // ..........................................................
  // HELPERS
  //

  'use strict';

  var _emberA = undefined;

  function emberA() {
    return (_emberA || (_emberA = _require.default('ember-runtime/system/native_array').A))();
  }

  var contexts = [];

  function popCtx() {
    return contexts.length === 0 ? {} : contexts.pop();
  }

  function pushCtx(ctx) {
    contexts.push(ctx);
    return null;
  }

  function iter(key, value) {
    var valueProvided = arguments.length === 2;

    function i(item) {
      var cur = _emberMetal.get(item, key);
      return valueProvided ? value === cur : !!cur;
    }

    return i;
  }

  /**
    This mixin defines the common interface implemented by enumerable objects
    in Ember. Most of these methods follow the standard Array iteration
    API defined up to JavaScript 1.8 (excluding language-specific features that
    cannot be emulated in older versions of JavaScript).
  
    This mixin is applied automatically to the Array class on page load, so you
    can use any of these methods on simple arrays. If Array already implements
    one of these methods, the mixin will not override them.
  
    ## Writing Your Own Enumerable
  
    To make your own custom class enumerable, you need two items:
  
    1. You must have a length property. This property should change whenever
       the number of items in your enumerable object changes. If you use this
       with an `Ember.Object` subclass, you should be sure to change the length
       property using `set().`
  
    2. You must implement `nextObject().` See documentation.
  
    Once you have these two methods implemented, apply the `Ember.Enumerable` mixin
    to your class and you will be able to enumerate the contents of your object
    like any other collection.
  
    ## Using Ember Enumeration with Other Libraries
  
    Many other libraries provide some kind of iterator or enumeration like
    facility. This is often where the most common API conflicts occur.
    Ember's API is designed to be as friendly as possible with other
    libraries by implementing only methods that mostly correspond to the
    JavaScript 1.8 API.
  
    @class Enumerable
    @namespace Ember
    @since Ember 0.9
    @private
  */
  var Enumerable = _emberMetal.Mixin.create({

    /**
      __Required.__ You must implement this method to apply this mixin.
       Implement this method to make your class enumerable.
       This method will be called repeatedly during enumeration. The index value
      will always begin with 0 and increment monotonically. You don't have to
      rely on the index value to determine what object to return, but you should
      always check the value and start from the beginning when you see the
      requested index is 0.
       The `previousObject` is the object that was returned from the last call
      to `nextObject` for the current iteration. This is a useful way to
      manage iteration if you are tracing a linked list, for example.
       Finally the context parameter will always contain a hash you can use as
      a "scratchpad" to maintain any other state you need in order to iterate
      properly. The context object is reused and is not reset between
      iterations so make sure you setup the context with a fresh state whenever
      the index parameter is 0.
       Generally iterators will continue to call `nextObject` until the index
      reaches the current length-1. If you run out of data before this
      time for some reason, you should simply return undefined.
       The default implementation of this method simply looks up the index.
      This works great on any Array-like objects.
       @method nextObject
      @param {Number} index the current index of the iteration
      @param {Object} previousObject the value returned by the last call to
        `nextObject`.
      @param {Object} context a context object you can use to maintain state.
      @return {Object} the next object in the iteration or undefined
      @private
    */
    nextObject: null,

    /**
      Helper method returns the first object from a collection. This is usually
      used by bindings and other parts of the framework to extract a single
      object if the enumerable contains only one item.
       If you override this method, you should implement it so that it will
      always return the same value each time it is called. If your enumerable
      contains only one object, this method should always return that object.
      If your enumerable is empty, this method should return `undefined`.
       ```javascript
      let arr = ['a', 'b', 'c'];
      arr.get('firstObject');  // 'a'
       let arr = [];
      arr.get('firstObject');  // undefined
      ```
       @property firstObject
      @return {Object} the object or undefined
      @readOnly
      @public
    */
    firstObject: _emberMetal.computed('[]', function () {
      if (_emberMetal.get(this, 'length') === 0) {
        return undefined;
      }

      // handle generic enumerables
      var context = popCtx();
      var ret = this.nextObject(0, null, context);

      pushCtx(context);

      return ret;
    }).readOnly(),

    /**
      Helper method returns the last object from a collection. If your enumerable
      contains only one object, this method should always return that object.
      If your enumerable is empty, this method should return `undefined`.
       ```javascript
      let arr = ['a', 'b', 'c'];
      arr.get('lastObject');  // 'c'
       let arr = [];
      arr.get('lastObject');  // undefined
      ```
       @property lastObject
      @return {Object} the last object or undefined
      @readOnly
      @public
    */
    lastObject: _emberMetal.computed('[]', function () {
      var len = _emberMetal.get(this, 'length');

      if (len === 0) {
        return undefined;
      }

      var context = popCtx();
      var idx = 0;
      var last = null;
      var cur = undefined;

      do {
        last = cur;
        cur = this.nextObject(idx++, last, context);
      } while (cur !== undefined);

      pushCtx(context);

      return last;
    }).readOnly(),

    /**
      Returns `true` if the passed object can be found in the receiver. The
      default version will iterate through the enumerable until the object
      is found. You may want to override this with a more efficient version.
       ```javascript
      let arr = ['a', 'b', 'c'];
       arr.contains('a'); // true
      arr.contains('z'); // false
      ```
       @method contains
      @deprecated Use `Enumerable#includes` instead. See http://emberjs.com/deprecations/v2.x#toc_enumerable-contains
      @param {Object} obj The object to search for.
      @return {Boolean} `true` if object is found in enumerable.
      @public
    */
    contains: function (obj) {
      if (_emberMetal.isFeatureEnabled('ember-runtime-enumerable-includes')) {
        _emberMetal.deprecate('`Enumerable#contains` is deprecated, use `Enumerable#includes` instead.', false, { id: 'ember-runtime.enumerable-contains', until: '3.0.0', url: 'http://emberjs.com/deprecations/v2.x#toc_enumerable-contains' });
      }

      var found = this.find(function (item) {
        return item === obj;
      });

      return found !== undefined;
    },

    /**
      Iterates through the enumerable, calling the passed function on each
      item. This method corresponds to the `forEach()` method defined in
      JavaScript 1.6.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       @method forEach
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Object} receiver
      @public
    */
    forEach: function (callback, target) {
      if (typeof callback !== 'function') {
        throw new TypeError();
      }

      var context = popCtx();
      var len = _emberMetal.get(this, 'length');
      var last = null;

      if (target === undefined) {
        target = null;
      }

      for (var idx = 0; idx < len; idx++) {
        var next = this.nextObject(idx, last, context);
        callback.call(target, next, idx, this);
        last = next;
      }

      last = null;
      context = pushCtx(context);

      return this;
    },

    /**
      Alias for `mapBy`
       @method getEach
      @param {String} key name of the property
      @return {Array} The mapped array.
      @public
    */
    getEach: _emberMetal.aliasMethod('mapBy'),

    /**
      Sets the value on the named property for each member. This is more
      ergonomic than using other methods defined on this helper. If the object
      implements Ember.Observable, the value will be changed to `set(),` otherwise
      it will be set directly. `null` objects are skipped.
       @method setEach
      @param {String} key The key to set
      @param {Object} value The object to set
      @return {Object} receiver
      @public
    */
    setEach: function (key, value) {
      return this.forEach(function (item) {
        return _emberMetal.set(item, key, value);
      });
    },

    /**
      Maps all of the items in the enumeration to another value, returning
      a new array. This method corresponds to `map()` defined in JavaScript 1.6.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       It should return the mapped value.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       @method map
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Array} The mapped array.
      @public
    */
    map: function (callback, target) {
      var ret = emberA();

      this.forEach(function (x, idx, i) {
        return ret[idx] = callback.call(target, x, idx, i);
      });

      return ret;
    },

    /**
      Similar to map, this specialized function returns the value of the named
      property on all items in the enumeration.
       @method mapBy
      @param {String} key name of the property
      @return {Array} The mapped array.
      @public
    */
    mapBy: function (key) {
      return this.map(function (next) {
        return _emberMetal.get(next, key);
      });
    },

    /**
      Returns an array with all of the items in the enumeration that the passed
      function returns true for. This method corresponds to `filter()` defined in
      JavaScript 1.6.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       It should return `true` to include the item in the results, `false`
      otherwise.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       @method filter
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Array} A filtered array.
      @public
    */
    filter: function (callback, target) {
      var ret = emberA();

      this.forEach(function (x, idx, i) {
        if (callback.call(target, x, idx, i)) {
          ret.push(x);
        }
      });

      return ret;
    },

    /**
      Returns an array with all of the items in the enumeration where the passed
      function returns false. This method is the inverse of filter().
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - *item* is the current item in the iteration.
      - *index* is the current index in the iteration
      - *enumerable* is the enumerable object itself.
       It should return a falsey value to include the item in the results.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as "this" on the context. This is a good way
      to give your iterator function access to the current object.
       @method reject
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Array} A rejected array.
      @public
    */
    reject: function (callback, target) {
      return this.filter(function () {
        return !callback.apply(target, arguments);
      });
    },

    /**
      Returns an array with just the items with the matched property. You
      can pass an optional second argument with the target value. Otherwise
      this will match any property that evaluates to `true`.
       @method filterBy
      @param {String} key the property to test
      @param {*} [value] optional value to test against.
      @return {Array} filtered array
      @public
    */
    filterBy: function (key, value) {
      return this.filter(iter.apply(this, arguments));
    },

    /**
      Returns an array with the items that do not have truthy values for
      key.  You can pass an optional second argument with the target value.  Otherwise
      this will match any property that evaluates to false.
       @method rejectBy
      @param {String} key the property to test
      @param {String} [value] optional value to test against.
      @return {Array} rejected array
      @public
    */
    rejectBy: function (key, value) {
      var exactValue = function (item) {
        return _emberMetal.get(item, key) === value;
      };
      var hasValue = function (item) {
        return !!_emberMetal.get(item, key);
      };
      var use = arguments.length === 2 ? exactValue : hasValue;

      return this.reject(use);
    },

    /**
      Returns the first item in the array for which the callback returns true.
      This method works similar to the `filter()` method defined in JavaScript 1.6
      except that it will stop working on the array once a match is found.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       It should return the `true` to include the item in the results, `false`
      otherwise.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       @method find
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Object} Found item or `undefined`.
      @public
    */
    find: function (callback, target) {
      var len = _emberMetal.get(this, 'length');

      if (target === undefined) {
        target = null;
      }

      var context = popCtx();
      var found = false;
      var last = null;
      var next = undefined,
          ret = undefined;

      for (var idx = 0; idx < len && !found; idx++) {
        next = this.nextObject(idx, last, context);

        if (found = callback.call(target, next, idx, this)) {
          ret = next;
        }

        last = next;
      }

      next = last = null;
      context = pushCtx(context);

      return ret;
    },

    /**
      Returns the first item with a property matching the passed value. You
      can pass an optional second argument with the target value. Otherwise
      this will match any property that evaluates to `true`.
       This method works much like the more generic `find()` method.
       @method findBy
      @param {String} key the property to test
      @param {String} [value] optional value to test against.
      @return {Object} found item or `undefined`
      @public
    */
    findBy: function (key, value) {
      return this.find(iter.apply(this, arguments));
    },

    /**
      Returns `true` if the passed function returns true for every item in the
      enumeration. This corresponds with the `every()` method in JavaScript 1.6.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       It should return the `true` or `false`.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       Example Usage:
       ```javascript
      if (people.every(isEngineer)) {
        Paychecks.addBigBonus();
      }
      ```
       @method every
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Boolean}
      @public
    */
    every: function (callback, target) {
      return !this.find(function (x, idx, i) {
        return !callback.call(target, x, idx, i);
      });
    },

    /**
      Returns `true` if the passed property resolves to the value of the second
      argument for all items in the enumerable. This method is often simpler/faster
      than using a callback.
       @method isEvery
      @param {String} key the property to test
      @param {String} [value] optional value to test against. Defaults to `true`
      @return {Boolean}
      @since 1.3.0
      @public
    */
    isEvery: function (key, value) {
      return this.every(iter.apply(this, arguments));
    },

    /**
      Returns `true` if the passed function returns true for any item in the
      enumeration. This corresponds with the `some()` method in JavaScript 1.6.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(item, index, enumerable);
      ```
       - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       It should return the `true` to include the item in the results, `false`
      otherwise.
       Note that in addition to a callback, you can also pass an optional target
      object that will be set as `this` on the context. This is a good way
      to give your iterator function access to the current object.
       Usage Example:
       ```javascript
      if (people.any(isManager)) {
        Paychecks.addBiggerBonus();
      }
      ```
       @method any
      @param {Function} callback The callback to execute
      @param {Object} [target] The target object to use
      @return {Boolean} `true` if the passed function returns `true` for any item
      @public
    */
    any: function (callback, target) {
      var len = _emberMetal.get(this, 'length');
      var context = popCtx();
      var found = false;
      var last = null;
      var next = undefined;

      if (target === undefined) {
        target = null;
      }

      for (var idx = 0; idx < len && !found; idx++) {
        next = this.nextObject(idx, last, context);
        found = callback.call(target, next, idx, this);
        last = next;
      }

      next = last = null;
      context = pushCtx(context);
      return found;
    },

    /**
      Returns `true` if the passed property resolves to the value of the second
      argument for any item in the enumerable. This method is often simpler/faster
      than using a callback.
       @method isAny
      @param {String} key the property to test
      @param {String} [value] optional value to test against. Defaults to `true`
      @return {Boolean}
      @since 1.3.0
      @public
    */
    isAny: function (key, value) {
      return this.any(iter.apply(this, arguments));
    },

    /**
      This will combine the values of the enumerator into a single value. It
      is a useful way to collect a summary value from an enumeration. This
      corresponds to the `reduce()` method defined in JavaScript 1.8.
       The callback method you provide should have the following signature (all
      parameters are optional):
       ```javascript
      function(previousValue, item, index, enumerable);
      ```
       - `previousValue` is the value returned by the last call to the iterator.
      - `item` is the current item in the iteration.
      - `index` is the current index in the iteration.
      - `enumerable` is the enumerable object itself.
       Return the new cumulative value.
       In addition to the callback you can also pass an `initialValue`. An error
      will be raised if you do not pass an initial value and the enumerator is
      empty.
       Note that unlike the other methods, this method does not allow you to
      pass a target object to set as this for the callback. It's part of the
      spec. Sorry.
       @method reduce
      @param {Function} callback The callback to execute
      @param {Object} initialValue Initial value for the reduce
      @param {String} reducerProperty internal use only.
      @return {Object} The reduced value.
      @public
    */
    reduce: function (callback, initialValue, reducerProperty) {
      if (typeof callback !== 'function') {
        throw new TypeError();
      }

      var ret = initialValue;

      this.forEach(function (item, i) {
        ret = callback(ret, item, i, this, reducerProperty);
      }, this);

      return ret;
    },

    /**
      Invokes the named method on every object in the receiver that
      implements it. This method corresponds to the implementation in
      Prototype 1.6.
       @method invoke
      @param {String} methodName the name of the method
      @param {Object...} args optional arguments to pass as well.
      @return {Array} return values from calling invoke.
      @public
    */
    invoke: function (methodName) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var ret = emberA();

      this.forEach(function (x, idx) {
        var method = x && x[methodName];

        if ('function' === typeof method) {
          ret[idx] = args ? method.apply(x, args) : x[methodName]();
        }
      }, this);

      return ret;
    },

    /**
      Simply converts the enumerable into a genuine array. The order is not
      guaranteed. Corresponds to the method implemented by Prototype.
       @method toArray
      @return {Array} the enumerable as an array.
      @public
    */
    toArray: function () {
      var ret = emberA();

      this.forEach(function (o, idx) {
        return ret[idx] = o;
      });

      return ret;
    },

    /**
      Returns a copy of the array with all `null` and `undefined` elements removed.
       ```javascript
      let arr = ['a', null, 'c', undefined];
      arr.compact();  // ['a', 'c']
      ```
       @method compact
      @return {Array} the array without null and undefined elements.
      @public
    */
    compact: function () {
      return this.filter(function (value) {
        return value != null;
      });
    },

    /**
      Returns a new enumerable that excludes the passed value. The default
      implementation returns an array regardless of the receiver type.
      If the receiver does not contain the value it returns the original enumerable.
       ```javascript
      let arr = ['a', 'b', 'a', 'c'];
      arr.without('a');  // ['b', 'c']
      ```
       @method without
      @param {Object} value
      @return {Ember.Enumerable}
      @public
    */
    without: function (value) {
      if (!this.contains(value)) {
        return this; // nothing to do
      }

      var ret = emberA();

      this.forEach(function (k) {
        if (k !== value) {
          ret[ret.length] = k;
        }
      });

      return ret;
    },

    /**
      Returns a new enumerable that contains only unique values. The default
      implementation returns an array regardless of the receiver type.
       ```javascript
      let arr = ['a', 'a', 'b', 'b'];
      arr.uniq();  // ['a', 'b']
      ```
       This only works on primitive data types, e.g. Strings, Numbers, etc.
       @method uniq
      @return {Ember.Enumerable}
      @public
    */
    uniq: function () {
      var ret = emberA();

      this.forEach(function (k) {
        if (ret.indexOf(k) < 0) {
          ret.push(k);
        }
      });

      return ret;
    },

    /**
      This property will trigger anytime the enumerable's content changes.
      You can observe this property to be notified of changes to the enumerable's
      content.
       For plain enumerables, this property is read only. `Array` overrides
      this method.
       @property []
      @type Array
      @return this
      @private
    */
    '[]': _emberMetal.computed({
      get: function (key) {
        return this;
      }
    }),

    // ..........................................................
    // ENUMERABLE OBSERVERS
    //

    /**
      Registers an enumerable observer. Must implement `Ember.EnumerableObserver`
      mixin.
       @method addEnumerableObserver
      @param {Object} target
      @param {Object} [opts]
      @return this
      @private
    */
    addEnumerableObserver: function (target, opts) {
      var willChange = opts && opts.willChange || 'enumerableWillChange';
      var didChange = opts && opts.didChange || 'enumerableDidChange';
      var hasObservers = _emberMetal.get(this, 'hasEnumerableObservers');

      if (!hasObservers) {
        _emberMetal.propertyWillChange(this, 'hasEnumerableObservers');
      }

      _emberMetal.addListener(this, '@enumerable:before', target, willChange);
      _emberMetal.addListener(this, '@enumerable:change', target, didChange);

      if (!hasObservers) {
        _emberMetal.propertyDidChange(this, 'hasEnumerableObservers');
      }

      return this;
    },

    /**
      Removes a registered enumerable observer.
       @method removeEnumerableObserver
      @param {Object} target
      @param {Object} [opts]
      @return this
      @private
    */
    removeEnumerableObserver: function (target, opts) {
      var willChange = opts && opts.willChange || 'enumerableWillChange';
      var didChange = opts && opts.didChange || 'enumerableDidChange';
      var hasObservers = _emberMetal.get(this, 'hasEnumerableObservers');

      if (hasObservers) {
        _emberMetal.propertyWillChange(this, 'hasEnumerableObservers');
      }

      _emberMetal.removeListener(this, '@enumerable:before', target, willChange);
      _emberMetal.removeListener(this, '@enumerable:change', target, didChange);

      if (hasObservers) {
        _emberMetal.propertyDidChange(this, 'hasEnumerableObservers');
      }

      return this;
    },

    /**
      Becomes true whenever the array currently has observers watching changes
      on the array.
       @property hasEnumerableObservers
      @type Boolean
      @private
    */
    hasEnumerableObservers: _emberMetal.computed(function () {
      return _emberMetal.hasListeners(this, '@enumerable:change') || _emberMetal.hasListeners(this, '@enumerable:before');
    }),

    /**
      Invoke this method just before the contents of your enumerable will
      change. You can either omit the parameters completely or pass the objects
      to be removed or added if available or just a count.
       @method enumerableContentWillChange
      @param {Ember.Enumerable|Number} removing An enumerable of the objects to
        be removed or the number of items to be removed.
      @param {Ember.Enumerable|Number} adding An enumerable of the objects to be
        added or the number of items to be added.
      @chainable
      @private
    */
    enumerableContentWillChange: function (removing, adding) {
      var removeCnt = undefined,
          addCnt = undefined,
          hasDelta = undefined;

      if ('number' === typeof removing) {
        removeCnt = removing;
      } else if (removing) {
        removeCnt = _emberMetal.get(removing, 'length');
      } else {
        removeCnt = removing = -1;
      }

      if ('number' === typeof adding) {
        addCnt = adding;
      } else if (adding) {
        addCnt = _emberMetal.get(adding, 'length');
      } else {
        addCnt = adding = -1;
      }

      hasDelta = addCnt < 0 || removeCnt < 0 || addCnt - removeCnt !== 0;

      if (removing === -1) {
        removing = null;
      }

      if (adding === -1) {
        adding = null;
      }

      _emberMetal.propertyWillChange(this, '[]');

      if (hasDelta) {
        _emberMetal.propertyWillChange(this, 'length');
      }

      _emberMetal.sendEvent(this, '@enumerable:before', [this, removing, adding]);

      return this;
    },

    /**
      Invoke this method when the contents of your enumerable has changed.
      This will notify any observers watching for content changes. If you are
      implementing an ordered enumerable (such as an array), also pass the
      start and end values where the content changed so that it can be used to
      notify range observers.
       @method enumerableContentDidChange
      @param {Ember.Enumerable|Number} removing An enumerable of the objects to
        be removed or the number of items to be removed.
      @param {Ember.Enumerable|Number} adding  An enumerable of the objects to
        be added or the number of items to be added.
      @chainable
      @private
    */
    enumerableContentDidChange: function (removing, adding) {
      var removeCnt = undefined,
          addCnt = undefined,
          hasDelta = undefined;

      if ('number' === typeof removing) {
        removeCnt = removing;
      } else if (removing) {
        removeCnt = _emberMetal.get(removing, 'length');
      } else {
        removeCnt = removing = -1;
      }

      if ('number' === typeof adding) {
        addCnt = adding;
      } else if (adding) {
        addCnt = _emberMetal.get(adding, 'length');
      } else {
        addCnt = adding = -1;
      }

      hasDelta = addCnt < 0 || removeCnt < 0 || addCnt - removeCnt !== 0;

      if (removing === -1) {
        removing = null;
      }

      if (adding === -1) {
        adding = null;
      }

      _emberMetal.sendEvent(this, '@enumerable:change', [this, removing, adding]);

      if (hasDelta) {
        _emberMetal.propertyDidChange(this, 'length');
      }

      _emberMetal.propertyDidChange(this, '[]');

      return this;
    },

    /**
      Converts the enumerable into an array and sorts by the keys
      specified in the argument.
       You may provide multiple arguments to sort by multiple properties.
       @method sortBy
      @param {String} property name(s) to sort on
      @return {Array} The sorted array.
      @since 1.2.0
      @public
    */
    sortBy: function () {
      var sortKeys = arguments;

      return this.toArray().sort(function (a, b) {
        for (var i = 0; i < sortKeys.length; i++) {
          var key = sortKeys[i];
          var propA = _emberMetal.get(a, key);
          var propB = _emberMetal.get(b, key);
          // return 1 or -1 else continue to the next sortKey
          var compareValue = _emberRuntimeCompare.default(propA, propB);

          if (compareValue) {
            return compareValue;
          }
        }
        return 0;
      });
    }
  });

  if (_emberMetal.isFeatureEnabled('ember-runtime-computed-uniq-by')) {
    Enumerable.reopen({
      /**
        Returns a new enumerable that contains only items containing a unique property value.
        The default implementation returns an array regardless of the receiver type.
         ```javascript
        let arr = [{ value: 'a' }, { value: 'a' }, { value: 'b' }, { value: 'b' }];
        arr.uniqBy('value');  // [{ value: 'a' }, { value: 'b' }]
        ```
         @method uniqBy
        @return {Ember.Enumerable}
        @public
      */

      uniqBy: function (key) {
        var ret = emberA();
        var seen = new _emberUtils.EmptyObject();

        this.forEach(function (item) {
          var guid = _emberUtils.guidFor(_emberMetal.get(item, key));
          if (!(guid in seen)) {
            seen[guid] = true;
            ret.push(item);
          }
        });

        return ret;
      }
    });
  }

  if (_emberMetal.isFeatureEnabled('ember-runtime-enumerable-includes')) {
    Enumerable.reopen({
      /**
        Returns `true` if the passed object can be found in the enumerable.
         ```javascript
        [1, 2, 3].includes(2);                     // true
        [1, 2, 3].includes(4);                     // false
        [1, 2, undefined].includes(undefined);     // true
        [1, 2, null].includes(null);               // true
        [1, 2, NaN].includes(NaN);                 // true
        ```
         @method includes
        @param {Object} obj The object to search for.
        @return {Boolean} `true` if object is found in the enumerable.
        @public
      */
      includes: function (obj) {
        _emberMetal.assert('Enumerable#includes cannot accept a second argument "startAt" as enumerable items are unordered.', arguments.length === 1);

        var len = _emberMetal.get(this, 'length');
        var idx = undefined,
            next = undefined;
        var last = null;
        var found = false;

        var context = popCtx();

        for (idx = 0; idx < len && !found; idx++) {
          next = this.nextObject(idx, last, context);

          found = obj === next || obj !== obj && next !== next;

          last = next;
        }

        next = last = null;
        context = pushCtx(context);

        return found;
      },

      without: function (value) {
        if (!this.includes(value)) {
          return this; // nothing to do
        }

        var ret = emberA();

        this.forEach(function (k) {
          // SameValueZero comparison (NaN !== NaN)
          if (!(k === value || k !== k && value !== value)) {
            ret[ret.length] = k;
          }
        });

        return ret;
      }
    });
  }

  exports.default = Enumerable;
});
enifed('ember-runtime/mixins/evented', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  'use strict';

  /**
  @module ember
  @submodule ember-runtime
  */

  /**
    This mixin allows for Ember objects to subscribe to and emit events.
  
    ```javascript
    App.Person = Ember.Object.extend(Ember.Evented, {
      greet: function() {
        // ...
        this.trigger('greet');
      }
    });
  
    var person = App.Person.create();
  
    person.on('greet', function() {
      console.log('Our person has greeted');
    });
  
    person.greet();
  
    // outputs: 'Our person has greeted'
    ```
  
    You can also chain multiple event subscriptions:
  
    ```javascript
    person.on('greet', function() {
      console.log('Our person has greeted');
    }).one('greet', function() {
      console.log('Offer one-time special');
    }).off('event', this, forgetThis);
    ```
  
    @class Evented
    @namespace Ember
    @public
   */
  exports.default = _emberMetal.Mixin.create({

    /**
     Subscribes to a named event with given function.
      ```javascript
     person.on('didLoad', function() {
       // fired once the person has loaded
     });
     ```
      An optional target can be passed in as the 2nd argument that will
     be set as the "this" for the callback. This is a good way to give your
     function access to the object triggering the event. When the target
     parameter is used the callback becomes the third argument.
      @method on
     @param {String} name The name of the event
     @param {Object} [target] The "this" binding for the callback
     @param {Function} method The callback to execute
     @return this
     @public
    */
    on: function (name, target, method) {
      _emberMetal.addListener(this, name, target, method);
      return this;
    },

    /**
      Subscribes a function to a named event and then cancels the subscription
      after the first time the event is triggered. It is good to use ``one`` when
      you only care about the first time an event has taken place.
       This function takes an optional 2nd argument that will become the "this"
      value for the callback. If this argument is passed then the 3rd argument
      becomes the function.
       @method one
      @param {String} name The name of the event
      @param {Object} [target] The "this" binding for the callback
      @param {Function} method The callback to execute
      @return this
      @public
    */
    one: function (name, target, method) {
      if (!method) {
        method = target;
        target = null;
      }

      _emberMetal.addListener(this, name, target, method, true);
      return this;
    },

    /**
      Triggers a named event for the object. Any additional arguments
      will be passed as parameters to the functions that are subscribed to the
      event.
       ```javascript
      person.on('didEat', function(food) {
        console.log('person ate some ' + food);
      });
       person.trigger('didEat', 'broccoli');
       // outputs: person ate some broccoli
      ```
      @method trigger
      @param {String} name The name of the event
      @param {Object...} args Optional arguments to pass on
      @public
    */
    trigger: function (name) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      _emberMetal.sendEvent(this, name, args);
    },

    /**
      Cancels subscription for given name, target, and method.
       @method off
      @param {String} name The name of the event
      @param {Object} target The target of the subscription
      @param {Function} method The function of the subscription
      @return this
      @public
    */
    off: function (name, target, method) {
      _emberMetal.removeListener(this, name, target, method);
      return this;
    },

    /**
      Checks to see if object has any subscriptions for named event.
       @method has
      @param {String} name The name of the event
      @return {Boolean} does the object have a subscription for event
      @public
     */
    has: function (name) {
      return _emberMetal.hasListeners(this, name);
    }
  });
});
enifed('ember-runtime/mixins/freezable', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  /**
    The `Ember.Freezable` mixin implements some basic methods for marking an
    object as frozen. Once an object is frozen it should be read only. No changes
    may be made the internal state of the object.
  
    ## Enforcement
  
    To fully support freezing in your subclass, you must include this mixin and
    override any method that might alter any property on the object to instead
    raise an exception. You can check the state of an object by checking the
    `isFrozen` property.
  
    Although future versions of JavaScript may support language-level freezing
    object objects, that is not the case today. Even if an object is freezable,
    it is still technically possible to modify the object, even though it could
    break other parts of your application that do not expect a frozen object to
    change. It is, therefore, very important that you always respect the
    `isFrozen` property on all freezable objects.
  
    ## Example Usage
  
    The example below shows a simple object that implement the `Ember.Freezable`
    protocol.
  
    ```javascript
    Contact = Ember.Object.extend(Ember.Freezable, {
      firstName: null,
      lastName: null,
  
      // swaps the names
      swapNames: function() {
        if (this.get('isFrozen')) throw Ember.FROZEN_ERROR;
        var tmp = this.get('firstName');
        this.set('firstName', this.get('lastName'));
        this.set('lastName', tmp);
        return this;
      }
  
    });
  
    c = Contact.create({ firstName: "John", lastName: "Doe" });
    c.swapNames();  // returns c
    c.freeze();
    c.swapNames();  // EXCEPTION
    ```
  
    ## Copying
  
    Usually the `Ember.Freezable` protocol is implemented in cooperation with the
    `Ember.Copyable` protocol, which defines a `frozenCopy()` method that will
    return a frozen object, if the object implements this method as well.
  
    @class Freezable
    @namespace Ember
    @since Ember 0.9
    @deprecated Use `Object.freeze` instead.
    @private
  */
  var Freezable = _emberMetal.Mixin.create({

    init: function () {
      _emberMetal.deprecate('`Ember.Freezable` is deprecated, use `Object.freeze` instead.', false, { id: 'ember-runtime.freezable-init', until: '3.0.0' });
      this._super.apply(this, arguments);
    },

    /**
      Set to `true` when the object is frozen. Use this property to detect
      whether your object is frozen or not.
       @property isFrozen
      @type Boolean
      @private
    */
    isFrozen: false,

    /**
      Freezes the object. Once this method has been called the object should
      no longer allow any properties to be edited.
       @method freeze
      @return {Object} receiver
      @private
    */
    freeze: function () {
      if (_emberMetal.get(this, 'isFrozen')) {
        return this;
      }

      _emberMetal.set(this, 'isFrozen', true);
      return this;
    }

  });

  exports.Freezable = Freezable;
  var FROZEN_ERROR = 'Frozen object cannot be modified.';
  exports.FROZEN_ERROR = FROZEN_ERROR;
});
enifed('ember-runtime/mixins/mutable_array', ['exports', 'ember-metal', 'ember-runtime/mixins/array', 'ember-runtime/mixins/mutable_enumerable', 'ember-runtime/mixins/enumerable'], function (exports, _emberMetal, _emberRuntimeMixinsArray, _emberRuntimeMixinsMutable_enumerable, _emberRuntimeMixinsEnumerable) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.removeAt = removeAt;
  var OUT_OF_RANGE_EXCEPTION = 'Index out of range';
  var EMPTY = [];

  // ..........................................................
  // HELPERS
  //

  function removeAt(array, start, len) {
    if ('number' === typeof start) {
      if (start < 0 || start >= _emberMetal.get(array, 'length')) {
        throw new _emberMetal.Error(OUT_OF_RANGE_EXCEPTION);
      }

      // fast case
      if (len === undefined) {
        len = 1;
      }

      array.replace(start, len, EMPTY);
    }

    return array;
  }

  /**
    This mixin defines the API for modifying array-like objects. These methods
    can be applied only to a collection that keeps its items in an ordered set.
    It builds upon the Array mixin and adds methods to modify the array.
    One concrete implementations of this class include ArrayProxy.
  
    It is important to use the methods in this class to modify arrays so that
    changes are observable. This allows the binding system in Ember to function
    correctly.
  
  
    Note that an Array can change even if it does not implement this mixin.
    For example, one might implement a SparseArray that cannot be directly
    modified, but if its underlying enumerable changes, it will change also.
  
    @class MutableArray
    @namespace Ember
    @uses Ember.Array
    @uses Ember.MutableEnumerable
    @public
  */
  exports.default = _emberMetal.Mixin.create(_emberRuntimeMixinsArray.default, _emberRuntimeMixinsMutable_enumerable.default, {

    /**
      __Required.__ You must implement this method to apply this mixin.
       This is one of the primitives you must implement to support `Ember.Array`.
      You should replace amt objects started at idx with the objects in the
      passed array. You should also call `this.enumerableContentDidChange()`
       @method replace
      @param {Number} idx Starting index in the array to replace. If
        idx >= length, then append to the end of the array.
      @param {Number} amt Number of elements that should be removed from
        the array, starting at *idx*.
      @param {Array} objects An array of zero or more objects that should be
        inserted into the array at *idx*
      @public
    */
    replace: null,

    /**
      Remove all elements from the array. This is useful if you
      want to reuse an existing array without having to recreate it.
       ```javascript
      let colors = ['red', 'green', 'blue'];
       color.length();   //  3
      colors.clear();   //  []
      colors.length();  //  0
      ```
       @method clear
      @return {Ember.Array} An empty Array.
      @public
    */
    clear: function () {
      var len = _emberMetal.get(this, 'length');
      if (len === 0) {
        return this;
      }

      this.replace(0, len, EMPTY);
      return this;
    },

    /**
      This will use the primitive `replace()` method to insert an object at the
      specified index.
       ```javascript
      let colors = ['red', 'green', 'blue'];
       colors.insertAt(2, 'yellow');  // ['red', 'green', 'yellow', 'blue']
      colors.insertAt(5, 'orange');  // Error: Index out of range
      ```
       @method insertAt
      @param {Number} idx index of insert the object at.
      @param {Object} object object to insert
      @return {Ember.Array} receiver
      @public
    */
    insertAt: function (idx, object) {
      if (idx > _emberMetal.get(this, 'length')) {
        throw new _emberMetal.Error(OUT_OF_RANGE_EXCEPTION);
      }

      this.replace(idx, 0, [object]);
      return this;
    },

    /**
      Remove an object at the specified index using the `replace()` primitive
      method. You can pass either a single index, or a start and a length.
       If you pass a start and length that is beyond the
      length this method will throw an `OUT_OF_RANGE_EXCEPTION`.
       ```javascript
      let colors = ['red', 'green', 'blue', 'yellow', 'orange'];
       colors.removeAt(0);     // ['green', 'blue', 'yellow', 'orange']
      colors.removeAt(2, 2);  // ['green', 'blue']
      colors.removeAt(4, 2);  // Error: Index out of range
      ```
       @method removeAt
      @param {Number} start index, start of range
      @param {Number} len length of passing range
      @return {Ember.Array} receiver
      @public
    */
    removeAt: function (start, len) {
      return removeAt(this, start, len);
    },

    /**
      Push the object onto the end of the array. Works just like `push()` but it
      is KVO-compliant.
       ```javascript
      let colors = ['red', 'green'];
       colors.pushObject('black');     // ['red', 'green', 'black']
      colors.pushObject(['yellow']);  // ['red', 'green', ['yellow']]
      ```
       @method pushObject
      @param {*} obj object to push
      @return object same object passed as a param
      @public
    */
    pushObject: function (obj) {
      this.insertAt(_emberMetal.get(this, 'length'), obj);
      return obj;
    },

    /**
      Add the objects in the passed numerable to the end of the array. Defers
      notifying observers of the change until all objects are added.
       ```javascript
      let colors = ['red'];
       colors.pushObjects(['yellow', 'orange']);  // ['red', 'yellow', 'orange']
      ```
       @method pushObjects
      @param {Ember.Enumerable} objects the objects to add
      @return {Ember.Array} receiver
      @public
    */
    pushObjects: function (objects) {
      if (!(_emberRuntimeMixinsEnumerable.default.detect(objects) || Array.isArray(objects))) {
        throw new TypeError('Must pass Ember.Enumerable to Ember.MutableArray#pushObjects');
      }
      this.replace(_emberMetal.get(this, 'length'), 0, objects);
      return this;
    },

    /**
      Pop object from array or nil if none are left. Works just like `pop()` but
      it is KVO-compliant.
       ```javascript
      let colors = ['red', 'green', 'blue'];
       colors.popObject();   // 'blue'
      console.log(colors);  // ['red', 'green']
      ```
       @method popObject
      @return object
      @public
    */
    popObject: function () {
      var len = _emberMetal.get(this, 'length');
      if (len === 0) {
        return null;
      }

      var ret = _emberRuntimeMixinsArray.objectAt(this, len - 1);
      this.removeAt(len - 1, 1);
      return ret;
    },

    /**
      Shift an object from start of array or nil if none are left. Works just
      like `shift()` but it is KVO-compliant.
       ```javascript
      let colors = ['red', 'green', 'blue'];
       colors.shiftObject();  // 'red'
      console.log(colors);   // ['green', 'blue']
      ```
       @method shiftObject
      @return object
      @public
    */
    shiftObject: function () {
      if (_emberMetal.get(this, 'length') === 0) {
        return null;
      }

      var ret = _emberRuntimeMixinsArray.objectAt(this, 0);
      this.removeAt(0);
      return ret;
    },

    /**
      Unshift an object to start of array. Works just like `unshift()` but it is
      KVO-compliant.
       ```javascript
      let colors = ['red'];
       colors.unshiftObject('yellow');    // ['yellow', 'red']
      colors.unshiftObject(['black']);   // [['black'], 'yellow', 'red']
      ```
       @method unshiftObject
      @param {*} obj object to unshift
      @return object same object passed as a param
      @public
    */
    unshiftObject: function (obj) {
      this.insertAt(0, obj);
      return obj;
    },

    /**
      Adds the named objects to the beginning of the array. Defers notifying
      observers until all objects have been added.
       ```javascript
      let colors = ['red'];
       colors.unshiftObjects(['black', 'white']);   // ['black', 'white', 'red']
      colors.unshiftObjects('yellow'); // Type Error: 'undefined' is not a function
      ```
       @method unshiftObjects
      @param {Ember.Enumerable} objects the objects to add
      @return {Ember.Array} receiver
      @public
    */
    unshiftObjects: function (objects) {
      this.replace(0, 0, objects);
      return this;
    },

    /**
      Reverse objects in the array. Works just like `reverse()` but it is
      KVO-compliant.
       @method reverseObjects
      @return {Ember.Array} receiver
       @public
    */
    reverseObjects: function () {
      var len = _emberMetal.get(this, 'length');
      if (len === 0) {
        return this;
      }

      var objects = this.toArray().reverse();
      this.replace(0, len, objects);
      return this;
    },

    /**
      Replace all the receiver's content with content of the argument.
      If argument is an empty array receiver will be cleared.
       ```javascript
      let colors = ['red', 'green', 'blue'];
       colors.setObjects(['black', 'white']);  // ['black', 'white']
      colors.setObjects([]);                  // []
      ```
       @method setObjects
      @param {Ember.Array} objects array whose content will be used for replacing
          the content of the receiver
      @return {Ember.Array} receiver with the new content
      @public
    */
    setObjects: function (objects) {
      if (objects.length === 0) {
        return this.clear();
      }

      var len = _emberMetal.get(this, 'length');
      this.replace(0, len, objects);
      return this;
    },

    // ..........................................................
    // IMPLEMENT Ember.MutableEnumerable
    //

    /**
      Remove all occurrences of an object in the array.
       ```javascript
      let cities = ['Chicago', 'Berlin', 'Lima', 'Chicago'];
       cities.removeObject('Chicago');  // ['Berlin', 'Lima']
      cities.removeObject('Lima');     // ['Berlin']
      cities.removeObject('Tokyo')     // ['Berlin']
      ```
       @method removeObject
      @param {*} obj object to remove
      @return {Ember.Array} receiver
      @public
    */
    removeObject: function (obj) {
      var loc = _emberMetal.get(this, 'length') || 0;
      while (--loc >= 0) {
        var curObject = _emberRuntimeMixinsArray.objectAt(this, loc);

        if (curObject === obj) {
          this.removeAt(loc);
        }
      }
      return this;
    },

    /**
      Push the object onto the end of the array if it is not already
      present in the array.
       ```javascript
      let cities = ['Chicago', 'Berlin'];
       cities.addObject('Lima');    // ['Chicago', 'Berlin', 'Lima']
      cities.addObject('Berlin');  // ['Chicago', 'Berlin', 'Lima']
      ```
       @method addObject
      @param {*} obj object to add, if not already present
      @return {Ember.Array} receiver
      @public
    */
    addObject: function (obj) {
      var included = undefined;

      if (_emberMetal.isFeatureEnabled('ember-runtime-enumerable-includes')) {
        included = this.includes(obj);
      } else {
        included = this.contains(obj);
      }

      if (!included) {
        this.pushObject(obj);
      }

      return this;
    }
  });
});
enifed('ember-runtime/mixins/mutable_enumerable', ['exports', 'ember-runtime/mixins/enumerable', 'ember-metal'], function (exports, _emberRuntimeMixinsEnumerable, _emberMetal) {
  'use strict';

  /**
  @module ember
  @submodule ember-runtime
  */

  /**
    This mixin defines the API for modifying generic enumerables. These methods
    can be applied to an object regardless of whether it is ordered or
    unordered.
  
    Note that an Enumerable can change even if it does not implement this mixin.
    For example, a MappedEnumerable cannot be directly modified but if its
    underlying enumerable changes, it will change also.
  
    ## Adding Objects
  
    To add an object to an enumerable, use the `addObject()` method. This
    method will only add the object to the enumerable if the object is not
    already present and is of a type supported by the enumerable.
  
    ```javascript
    set.addObject(contact);
    ```
  
    ## Removing Objects
  
    To remove an object from an enumerable, use the `removeObject()` method. This
    will only remove the object if it is present in the enumerable, otherwise
    this method has no effect.
  
    ```javascript
    set.removeObject(contact);
    ```
  
    ## Implementing In Your Own Code
  
    If you are implementing an object and want to support this API, just include
    this mixin in your class and implement the required methods. In your unit
    tests, be sure to apply the Ember.MutableEnumerableTests to your object.
  
    @class MutableEnumerable
    @namespace Ember
    @uses Ember.Enumerable
    @public
  */
  exports.default = _emberMetal.Mixin.create(_emberRuntimeMixinsEnumerable.default, {

    /**
      __Required.__ You must implement this method to apply this mixin.
       Attempts to add the passed object to the receiver if the object is not
      already present in the collection. If the object is present, this method
      has no effect.
       If the passed object is of a type not supported by the receiver,
      then this method should raise an exception.
       @method addObject
      @param {Object} object The object to add to the enumerable.
      @return {Object} the passed object
      @public
    */
    addObject: null,

    /**
      Adds each object in the passed enumerable to the receiver.
       @method addObjects
      @param {Ember.Enumerable} objects the objects to add.
      @return {Object} receiver
      @public
    */
    addObjects: function (objects) {
      var _this = this;

      _emberMetal.beginPropertyChanges(this);
      objects.forEach(function (obj) {
        return _this.addObject(obj);
      });
      _emberMetal.endPropertyChanges(this);
      return this;
    },

    /**
      __Required.__ You must implement this method to apply this mixin.
       Attempts to remove the passed object from the receiver collection if the
      object is present in the collection. If the object is not present,
      this method has no effect.
       If the passed object is of a type not supported by the receiver,
      then this method should raise an exception.
       @method removeObject
      @param {Object} object The object to remove from the enumerable.
      @return {Object} the passed object
      @public
    */
    removeObject: null,

    /**
      Removes each object in the passed enumerable from the receiver.
       @method removeObjects
      @param {Ember.Enumerable} objects the objects to remove
      @return {Object} receiver
      @public
    */
    removeObjects: function (objects) {
      _emberMetal.beginPropertyChanges(this);
      for (var i = objects.length - 1; i >= 0; i--) {
        this.removeObject(objects[i]);
      }
      _emberMetal.endPropertyChanges(this);
      return this;
    }
  });
});
enifed('ember-runtime/mixins/observable', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  /**
    ## Overview
  
    This mixin provides properties and property observing functionality, core
    features of the Ember object model.
  
    Properties and observers allow one object to observe changes to a
    property on another object. This is one of the fundamental ways that
    models, controllers and views communicate with each other in an Ember
    application.
  
    Any object that has this mixin applied can be used in observer
    operations. That includes `Ember.Object` and most objects you will
    interact with as you write your Ember application.
  
    Note that you will not generally apply this mixin to classes yourself,
    but you will use the features provided by this module frequently, so it
    is important to understand how to use it.
  
    ## Using `get()` and `set()`
  
    Because of Ember's support for bindings and observers, you will always
    access properties using the get method, and set properties using the
    set method. This allows the observing objects to be notified and
    computed properties to be handled properly.
  
    More documentation about `get` and `set` are below.
  
    ## Observing Property Changes
  
    You typically observe property changes simply by using the `Ember.observer`
    function in classes that you write.
  
    For example:
  
    ```javascript
    Ember.Object.extend({
      valueObserver: Ember.observer('value', function(sender, key, value, rev) {
        // Executes whenever the "value" property changes
        // See the addObserver method for more information about the callback arguments
      })
    });
    ```
  
    Although this is the most common way to add an observer, this capability
    is actually built into the `Ember.Object` class on top of two methods
    defined in this mixin: `addObserver` and `removeObserver`. You can use
    these two methods to add and remove observers yourself if you need to
    do so at runtime.
  
    To add an observer for a property, call:
  
    ```javascript
    object.addObserver('propertyKey', targetObject, targetAction)
    ```
  
    This will call the `targetAction` method on the `targetObject` whenever
    the value of the `propertyKey` changes.
  
    Note that if `propertyKey` is a computed property, the observer will be
    called when any of the property dependencies are changed, even if the
    resulting value of the computed property is unchanged. This is necessary
    because computed properties are not computed until `get` is called.
  
    @class Observable
    @namespace Ember
    @public
  */
  exports.default = _emberMetal.Mixin.create({

    /**
      Retrieves the value of a property from the object.
       This method is usually similar to using `object[keyName]` or `object.keyName`,
      however it supports both computed properties and the unknownProperty
      handler.
       Because `get` unifies the syntax for accessing all these kinds
      of properties, it can make many refactorings easier, such as replacing a
      simple property with a computed property, or vice versa.
       ### Computed Properties
       Computed properties are methods defined with the `property` modifier
      declared at the end, such as:
       ```javascript
      fullName: Ember.computed('firstName', 'lastName', function() {
        return this.get('firstName') + ' ' + this.get('lastName');
      })
      ```
       When you call `get` on a computed property, the function will be
      called and the return value will be returned instead of the function
      itself.
       ### Unknown Properties
       Likewise, if you try to call `get` on a property whose value is
      `undefined`, the `unknownProperty()` method will be called on the object.
      If this method returns any value other than `undefined`, it will be returned
      instead. This allows you to implement "virtual" properties that are
      not defined upfront.
       @method get
      @param {String} keyName The property to retrieve
      @return {Object} The property value or undefined.
      @public
    */
    get: function (keyName) {
      return _emberMetal.get(this, keyName);
    },

    /**
      To get the values of multiple properties at once, call `getProperties`
      with a list of strings or an array:
       ```javascript
      record.getProperties('firstName', 'lastName', 'zipCode');
      // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
      ```
       is equivalent to:
       ```javascript
      record.getProperties(['firstName', 'lastName', 'zipCode']);
      // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
      ```
       @method getProperties
      @param {String...|Array} list of keys to get
      @return {Object}
      @public
    */
    getProperties: function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _emberMetal.getProperties.apply(null, [this].concat(args));
    },

    /**
      Sets the provided key or path to the value.
       ```javascript
      record.set("key", value);
      ```
       This method is generally very similar to calling `object["key"] = value` or
      `object.key = value`, except that it provides support for computed
      properties, the `setUnknownProperty()` method and property observers.
       ### Computed Properties
       If you try to set a value on a key that has a computed property handler
      defined (see the `get()` method for an example), then `set()` will call
      that method, passing both the value and key instead of simply changing
      the value itself. This is useful for those times when you need to
      implement a property that is composed of one or more member
      properties.
       ### Unknown Properties
       If you try to set a value on a key that is undefined in the target
      object, then the `setUnknownProperty()` handler will be called instead. This
      gives you an opportunity to implement complex "virtual" properties that
      are not predefined on the object. If `setUnknownProperty()` returns
      undefined, then `set()` will simply set the value on the object.
       ### Property Observers
       In addition to changing the property, `set()` will also register a property
      change with the object. Unless you have placed this call inside of a
      `beginPropertyChanges()` and `endPropertyChanges(),` any "local" observers
      (i.e. observer methods declared on the same object), will be called
      immediately. Any "remote" observers (i.e. observer methods declared on
      another object) will be placed in a queue and called at a later time in a
      coalesced manner.
       @method set
      @param {String} keyName The property to set
      @param {Object} value The value to set or `null`.
      @return {Object} The passed value
      @public
    */
    set: function (keyName, value) {
      return _emberMetal.set(this, keyName, value);
    },

    /**
      Sets a list of properties at once. These properties are set inside
      a single `beginPropertyChanges` and `endPropertyChanges` batch, so
      observers will be buffered.
       ```javascript
      record.setProperties({ firstName: 'Charles', lastName: 'Jolley' });
      ```
       @method setProperties
      @param {Object} hash the hash of keys and values to set
      @return {Object} The passed in hash
      @public
    */
    setProperties: function (hash) {
      return _emberMetal.setProperties(this, hash);
    },

    /**
      Begins a grouping of property changes.
       You can use this method to group property changes so that notifications
      will not be sent until the changes are finished. If you plan to make a
      large number of changes to an object at one time, you should call this
      method at the beginning of the changes to begin deferring change
      notifications. When you are done making changes, call
      `endPropertyChanges()` to deliver the deferred change notifications and end
      deferring.
       @method beginPropertyChanges
      @return {Ember.Observable}
      @private
    */
    beginPropertyChanges: function () {
      _emberMetal.beginPropertyChanges();
      return this;
    },

    /**
      Ends a grouping of property changes.
       You can use this method to group property changes so that notifications
      will not be sent until the changes are finished. If you plan to make a
      large number of changes to an object at one time, you should call
      `beginPropertyChanges()` at the beginning of the changes to defer change
      notifications. When you are done making changes, call this method to
      deliver the deferred change notifications and end deferring.
       @method endPropertyChanges
      @return {Ember.Observable}
      @private
    */
    endPropertyChanges: function () {
      _emberMetal.endPropertyChanges();
      return this;
    },

    /**
      Notify the observer system that a property is about to change.
       Sometimes you need to change a value directly or indirectly without
      actually calling `get()` or `set()` on it. In this case, you can use this
      method and `propertyDidChange()` instead. Calling these two methods
      together will notify all observers that the property has potentially
      changed value.
       Note that you must always call `propertyWillChange` and `propertyDidChange`
      as a pair. If you do not, it may get the property change groups out of
      order and cause notifications to be delivered more often than you would
      like.
       @method propertyWillChange
      @param {String} keyName The property key that is about to change.
      @return {Ember.Observable}
      @private
    */
    propertyWillChange: function (keyName) {
      _emberMetal.propertyWillChange(this, keyName);
      return this;
    },

    /**
      Notify the observer system that a property has just changed.
       Sometimes you need to change a value directly or indirectly without
      actually calling `get()` or `set()` on it. In this case, you can use this
      method and `propertyWillChange()` instead. Calling these two methods
      together will notify all observers that the property has potentially
      changed value.
       Note that you must always call `propertyWillChange` and `propertyDidChange`
      as a pair. If you do not, it may get the property change groups out of
      order and cause notifications to be delivered more often than you would
      like.
       @method propertyDidChange
      @param {String} keyName The property key that has just changed.
      @return {Ember.Observable}
      @private
    */
    propertyDidChange: function (keyName) {
      _emberMetal.propertyDidChange(this, keyName);
      return this;
    },

    /**
      Convenience method to call `propertyWillChange` and `propertyDidChange` in
      succession.
       @method notifyPropertyChange
      @param {String} keyName The property key to be notified about.
      @return {Ember.Observable}
      @public
    */
    notifyPropertyChange: function (keyName) {
      this.propertyWillChange(keyName);
      this.propertyDidChange(keyName);
      return this;
    },

    /**
      Adds an observer on a property.
       This is the core method used to register an observer for a property.
       Once you call this method, any time the key's value is set, your observer
      will be notified. Note that the observers are triggered any time the
      value is set, regardless of whether it has actually changed. Your
      observer should be prepared to handle that.
       You can also pass an optional context parameter to this method. The
      context will be passed to your observer method whenever it is triggered.
      Note that if you add the same target/method pair on a key multiple times
      with different context parameters, your observer will only be called once
      with the last context you passed.
       ### Observer Methods
       Observer methods you pass should generally have the following signature if
      you do not pass a `context` parameter:
       ```javascript
      fooDidChange: function(sender, key, value, rev) { };
      ```
       The sender is the object that changed. The key is the property that
      changes. The value property is currently reserved and unused. The rev
      is the last property revision of the object when it changed, which you can
      use to detect if the key value has really changed or not.
       If you pass a `context` parameter, the context will be passed before the
      revision like so:
       ```javascript
      fooDidChange: function(sender, key, value, context, rev) { };
      ```
       Usually you will not need the value, context or revision parameters at
      the end. In this case, it is common to write observer methods that take
      only a sender and key value as parameters or, if you aren't interested in
      any of these values, to write an observer that has no parameters at all.
       @method addObserver
      @param {String} key The key to observer
      @param {Object} target The target object to invoke
      @param {String|Function} method The method to invoke.
      @public
    */
    addObserver: function (key, target, method) {
      _emberMetal.addObserver(this, key, target, method);
    },

    /**
      Remove an observer you have previously registered on this object. Pass
      the same key, target, and method you passed to `addObserver()` and your
      target will no longer receive notifications.
       @method removeObserver
      @param {String} key The key to observer
      @param {Object} target The target object to invoke
      @param {String|Function} method The method to invoke.
      @public
    */
    removeObserver: function (key, target, method) {
      _emberMetal.removeObserver(this, key, target, method);
    },

    /**
      Returns `true` if the object currently has observers registered for a
      particular key. You can use this method to potentially defer performing
      an expensive action until someone begins observing a particular property
      on the object.
       @method hasObserverFor
      @param {String} key Key to check
      @return {Boolean}
      @private
    */
    hasObserverFor: function (key) {
      return _emberMetal.hasListeners(this, key + ':change');
    },

    /**
      Retrieves the value of a property, or a default value in the case that the
      property returns `undefined`.
       ```javascript
      person.getWithDefault('lastName', 'Doe');
      ```
       @method getWithDefault
      @param {String} keyName The name of the property to retrieve
      @param {Object} defaultValue The value to return if the property value is undefined
      @return {Object} The property value or the defaultValue.
      @public
    */
    getWithDefault: function (keyName, defaultValue) {
      return _emberMetal.getWithDefault(this, keyName, defaultValue);
    },

    /**
      Set the value of a property to the current value plus some amount.
       ```javascript
      person.incrementProperty('age');
      team.incrementProperty('score', 2);
      ```
       @method incrementProperty
      @param {String} keyName The name of the property to increment
      @param {Number} increment The amount to increment by. Defaults to 1
      @return {Number} The new property value
      @public
    */
    incrementProperty: function (keyName, increment) {
      if (_emberMetal.isNone(increment)) {
        increment = 1;
      }
      _emberMetal.assert('Must pass a numeric value to incrementProperty', !isNaN(parseFloat(increment)) && isFinite(increment));
      return _emberMetal.set(this, keyName, (parseFloat(_emberMetal.get(this, keyName)) || 0) + increment);
    },

    /**
      Set the value of a property to the current value minus some amount.
       ```javascript
      player.decrementProperty('lives');
      orc.decrementProperty('health', 5);
      ```
       @method decrementProperty
      @param {String} keyName The name of the property to decrement
      @param {Number} decrement The amount to decrement by. Defaults to 1
      @return {Number} The new property value
      @public
    */
    decrementProperty: function (keyName, decrement) {
      if (_emberMetal.isNone(decrement)) {
        decrement = 1;
      }
      _emberMetal.assert('Must pass a numeric value to decrementProperty', !isNaN(parseFloat(decrement)) && isFinite(decrement));
      return _emberMetal.set(this, keyName, (_emberMetal.get(this, keyName) || 0) - decrement);
    },

    /**
      Set the value of a boolean property to the opposite of its
      current value.
       ```javascript
      starship.toggleProperty('warpDriveEngaged');
      ```
       @method toggleProperty
      @param {String} keyName The name of the property to toggle
      @return {Boolean} The new property value
      @public
    */
    toggleProperty: function (keyName) {
      return _emberMetal.set(this, keyName, !_emberMetal.get(this, keyName));
    },

    /**
      Returns the cached value of a computed property, if it exists.
      This allows you to inspect the value of a computed property
      without accidentally invoking it if it is intended to be
      generated lazily.
       @method cacheFor
      @param {String} keyName
      @return {Object} The cached value of the computed property, if any
      @public
    */
    cacheFor: function (keyName) {
      return _emberMetal.cacheFor(this, keyName);
    },

    // intended for debugging purposes
    observersForKey: function (keyName) {
      return _emberMetal.observersFor(this, keyName);
    }
  });
});
enifed('ember-runtime/mixins/promise_proxy', ['exports', 'ember-metal', 'ember-runtime/computed/computed_macros'], function (exports, _emberMetal, _emberRuntimeComputedComputed_macros) {
  'use strict';

  /**
    @module ember
    @submodule ember-runtime
  */

  function tap(proxy, promise) {
    _emberMetal.setProperties(proxy, {
      isFulfilled: false,
      isRejected: false
    });

    return promise.then(function (value) {
      if (!proxy.isDestroyed && !proxy.isDestroying) {
        _emberMetal.setProperties(proxy, {
          content: value,
          isFulfilled: true
        });
      }
      return value;
    }, function (reason) {
      if (!proxy.isDestroyed && !proxy.isDestroying) {
        _emberMetal.setProperties(proxy, {
          reason: reason,
          isRejected: true
        });
      }
      throw reason;
    }, 'Ember: PromiseProxy');
  }

  /**
    A low level mixin making ObjectProxy promise-aware.
  
    ```javascript
    let ObjectPromiseProxy = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin);
  
    let proxy = ObjectPromiseProxy.create({
      promise: Ember.RSVP.cast($.getJSON('/some/remote/data.json'))
    });
  
    proxy.then(function(json){
       // the json
    }, function(reason) {
       // the reason why you have no json
    });
    ```
  
    the proxy has bindable attributes which
    track the promises life cycle
  
    ```javascript
    proxy.get('isPending')   //=> true
    proxy.get('isSettled')  //=> false
    proxy.get('isRejected')  //=> false
    proxy.get('isFulfilled') //=> false
    ```
  
    When the $.getJSON completes, and the promise is fulfilled
    with json, the life cycle attributes will update accordingly.
    Note that $.getJSON doesn't return an ECMA specified promise,
    it is useful to wrap this with an `RSVP.cast` so that it behaves
    as a spec compliant promise.
  
    ```javascript
    proxy.get('isPending')   //=> false
    proxy.get('isSettled')   //=> true
    proxy.get('isRejected')  //=> false
    proxy.get('isFulfilled') //=> true
    ```
  
    As the proxy is an ObjectProxy, and the json now its content,
    all the json properties will be available directly from the proxy.
  
    ```javascript
    // Assuming the following json:
    {
      firstName: 'Stefan',
      lastName: 'Penner'
    }
  
    // both properties will accessible on the proxy
    proxy.get('firstName') //=> 'Stefan'
    proxy.get('lastName')  //=> 'Penner'
    ```
  
    @class Ember.PromiseProxyMixin
    @public
  */
  exports.default = _emberMetal.Mixin.create({
    /**
      If the proxied promise is rejected this will contain the reason
      provided.
       @property reason
      @default null
      @public
    */
    reason: null,

    /**
      Once the proxied promise has settled this will become `false`.
       @property isPending
      @default true
      @public
    */
    isPending: _emberRuntimeComputedComputed_macros.not('isSettled').readOnly(),

    /**
      Once the proxied promise has settled this will become `true`.
       @property isSettled
      @default false
      @public
    */
    isSettled: _emberRuntimeComputedComputed_macros.or('isRejected', 'isFulfilled').readOnly(),

    /**
      Will become `true` if the proxied promise is rejected.
       @property isRejected
      @default false
      @public
    */
    isRejected: false,

    /**
      Will become `true` if the proxied promise is fulfilled.
       @property isFulfilled
      @default false
      @public
    */
    isFulfilled: false,

    /**
      The promise whose fulfillment value is being proxied by this object.
       This property must be specified upon creation, and should not be
      changed once created.
       Example:
       ```javascript
      Ember.ObjectProxy.extend(Ember.PromiseProxyMixin).create({
        promise: <thenable>
      });
      ```
       @property promise
      @public
    */
    promise: _emberMetal.computed({
      get: function () {
        throw new _emberMetal.Error('PromiseProxy\'s promise must be set');
      },
      set: function (key, promise) {
        return tap(this, promise);
      }
    }),

    /**
      An alias to the proxied promise's `then`.
       See RSVP.Promise.then.
       @method then
      @param {Function} callback
      @return {RSVP.Promise}
      @public
    */
    then: promiseAlias('then'),

    /**
      An alias to the proxied promise's `catch`.
       See RSVP.Promise.catch.
       @method catch
      @param {Function} callback
      @return {RSVP.Promise}
      @since 1.3.0
      @public
    */
    'catch': promiseAlias('catch'),

    /**
      An alias to the proxied promise's `finally`.
       See RSVP.Promise.finally.
       @method finally
      @param {Function} callback
      @return {RSVP.Promise}
      @since 1.3.0
      @public
    */
    'finally': promiseAlias('finally')

  });

  function promiseAlias(name) {
    return function () {
      var promise = _emberMetal.get(this, 'promise');
      return promise[name].apply(promise, arguments);
    };
  }
});
enifed('ember-runtime/mixins/registry_proxy', ['exports', 'ember-metal'], function (exports, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.buildFakeRegistryWithDeprecations = buildFakeRegistryWithDeprecations;

  /**
    RegistryProxyMixin is used to provide public access to specific
    registry functionality.
  
    @class RegistryProxyMixin
    @private
  */
  exports.default = _emberMetal.Mixin.create({
    __registry__: null,

    /**
     Given a fullName return the corresponding factory.
      @public
     @method resolveRegistration
     @param {String} fullName
     @return {Function} fullName's factory
     */
    resolveRegistration: registryAlias('resolve'),

    /**
      Registers a factory that can be used for dependency injection (with
      `inject`) or for service lookup. Each factory is registered with
      a full name including two parts: `type:name`.
       A simple example:
       ```javascript
      let App = Ember.Application.create();
       App.Orange = Ember.Object.extend();
      App.register('fruit:favorite', App.Orange);
      ```
       Ember will resolve factories from the `App` namespace automatically.
      For example `App.CarsController` will be discovered and returned if
      an application requests `controller:cars`.
       An example of registering a controller with a non-standard name:
       ```javascript
      let App = Ember.Application.create();
      let Session = Ember.Controller.extend();
       App.register('controller:session', Session);
       // The Session controller can now be treated like a normal controller,
      // despite its non-standard name.
      App.ApplicationController = Ember.Controller.extend({
        needs: ['session']
      });
      ```
       Registered factories are **instantiated** by having `create`
      called on them. Additionally they are **singletons**, each time
      they are looked up they return the same instance.
       Some examples modifying that default behavior:
       ```javascript
      let App = Ember.Application.create();
       App.Person = Ember.Object.extend();
      App.Orange = Ember.Object.extend();
      App.Email = Ember.Object.extend();
      App.session = Ember.Object.create();
       App.register('model:user', App.Person, { singleton: false });
      App.register('fruit:favorite', App.Orange);
      App.register('communication:main', App.Email, { singleton: false });
      App.register('session', App.session, { instantiate: false });
      ```
       @method register
      @param  fullName {String} type:name (e.g., 'model:user')
      @param  factory {Function} (e.g., App.Person)
      @param  options {Object} (optional) disable instantiation or singleton usage
      @public
     */
    register: registryAlias('register'),

    /**
     Unregister a factory.
      ```javascript
     let App = Ember.Application.create();
     let User = Ember.Object.extend();
     App.register('model:user', User);
      App.resolveRegistration('model:user').create() instanceof User //=> true
      App.unregister('model:user')
     App.resolveRegistration('model:user') === undefined //=> true
     ```
      @public
     @method unregister
     @param {String} fullName
     */
    unregister: registryAlias('unregister'),

    /**
     Check if a factory is registered.
      @public
     @method hasRegistration
     @param {String} fullName
     @return {Boolean}
     */
    hasRegistration: registryAlias('has'),

    /**
     Register an option for a particular factory.
      @public
     @method registerOption
     @param {String} fullName
     @param {String} optionName
     @param {Object} options
     */
    registerOption: registryAlias('option'),

    /**
     Return a specific registered option for a particular factory.
      @public
     @method registeredOption
     @param  {String} fullName
     @param  {String} optionName
     @return {Object} options
     */
    registeredOption: registryAlias('getOption'),

    /**
     Register options for a particular factory.
      @public
     @method registerOptions
     @param {String} fullName
     @param {Object} options
     */
    registerOptions: registryAlias('options'),

    /**
     Return registered options for a particular factory.
      @public
     @method registeredOptions
     @param  {String} fullName
     @return {Object} options
     */
    registeredOptions: registryAlias('getOptions'),

    /**
     Allow registering options for all factories of a type.
      ```javascript
     let App = Ember.Application.create();
     let appInstance = App.buildInstance();
      // if all of type `connection` must not be singletons
     appInstance.optionsForType('connection', { singleton: false });
      appInstance.register('connection:twitter', TwitterConnection);
     appInstance.register('connection:facebook', FacebookConnection);
      let twitter = appInstance.lookup('connection:twitter');
     let twitter2 = appInstance.lookup('connection:twitter');
      twitter === twitter2; // => false
      let facebook = appInstance.lookup('connection:facebook');
     let facebook2 = appInstance.lookup('connection:facebook');
      facebook === facebook2; // => false
     ```
      @public
     @method registerOptionsForType
     @param {String} type
     @param {Object} options
     */
    registerOptionsForType: registryAlias('optionsForType'),

    /**
     Return the registered options for all factories of a type.
      @public
     @method registeredOptionsForType
     @param {String} type
     @return {Object} options
     */
    registeredOptionsForType: registryAlias('getOptionsForType'),

    /**
      Define a dependency injection onto a specific factory or all factories
      of a type.
       When Ember instantiates a controller, view, or other framework component
      it can attach a dependency to that component. This is often used to
      provide services to a set of framework components.
       An example of providing a session object to all controllers:
       ```javascript
      let App = Ember.Application.create();
      let Session = Ember.Object.extend({ isAuthenticated: false });
       // A factory must be registered before it can be injected
      App.register('session:main', Session);
       // Inject 'session:main' onto all factories of the type 'controller'
      // with the name 'session'
      App.inject('controller', 'session', 'session:main');
       App.IndexController = Ember.Controller.extend({
        isLoggedIn: Ember.computed.alias('session.isAuthenticated')
      });
      ```
       Injections can also be performed on specific factories.
       ```javascript
      App.inject(<full_name or type>, <property name>, <full_name>)
      App.inject('route', 'source', 'source:main')
      App.inject('route:application', 'email', 'model:email')
      ```
       It is important to note that injections can only be performed on
      classes that are instantiated by Ember itself. Instantiating a class
      directly (via `create` or `new`) bypasses the dependency injection
      system.
       **Note:** Ember-Data instantiates its models in a unique manner, and consequently
      injections onto models (or all models) will not work as expected. Injections
      on models can be enabled by setting `EmberENV.MODEL_FACTORY_INJECTIONS`
      to `true`.
       @public
      @method inject
      @param  factoryNameOrType {String}
      @param  property {String}
      @param  injectionName {String}
    **/
    inject: registryAlias('injection')
  });

  function registryAlias(name) {
    return function () {
      var _registry__;

      return (_registry__ = this.__registry__)[name].apply(_registry__, arguments);
    };
  }

  function buildFakeRegistryWithDeprecations(instance, typeForMessage) {
    var fakeRegistry = {};
    var registryProps = {
      resolve: 'resolveRegistration',
      register: 'register',
      unregister: 'unregister',
      has: 'hasRegistration',
      option: 'registerOption',
      options: 'registerOptions',
      getOptions: 'registeredOptions',
      optionsForType: 'registerOptionsForType',
      getOptionsForType: 'registeredOptionsForType',
      injection: 'inject'
    };

    for (var deprecatedProperty in registryProps) {
      fakeRegistry[deprecatedProperty] = buildFakeRegistryFunction(instance, typeForMessage, deprecatedProperty, registryProps[deprecatedProperty]);
    }

    return fakeRegistry;
  }

  function buildFakeRegistryFunction(instance, typeForMessage, deprecatedProperty, nonDeprecatedProperty) {
    return function () {
      _emberMetal.deprecate('Using `' + typeForMessage + '.registry.' + deprecatedProperty + '` is deprecated. Please use `' + typeForMessage + '.' + nonDeprecatedProperty + '` instead.', false, {
        id: 'ember-application.app-instance-registry',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-application-registry-ember-applicationinstance-registry'
      });
      return instance[nonDeprecatedProperty].apply(instance, arguments);
    };
  }
});
enifed('ember-runtime/mixins/target_action_support', ['exports', 'ember-environment', 'ember-metal'], function (exports, _emberEnvironment, _emberMetal) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  /**
  `Ember.TargetActionSupport` is a mixin that can be included in a class
  to add a `triggerAction` method with semantics similar to the Handlebars
  `{{action}}` helper. In normal Ember usage, the `{{action}}` helper is
  usually the best choice. This mixin is most often useful when you are
  doing more complex event handling in Components.
  
  @class TargetActionSupport
  @namespace Ember
  @extends Ember.Mixin
  @private
  */
  exports.default = _emberMetal.Mixin.create({
    target: null,
    action: null,
    actionContext: null,

    actionContextObject: _emberMetal.computed('actionContext', function () {
      var actionContext = _emberMetal.get(this, 'actionContext');

      if (typeof actionContext === 'string') {
        var value = _emberMetal.get(this, actionContext);
        if (value === undefined) {
          value = _emberMetal.get(_emberEnvironment.context.lookup, actionContext);
        }
        return value;
      } else {
        return actionContext;
      }
    }),

    /**
    Send an `action` with an `actionContext` to a `target`. The action, actionContext
    and target will be retrieved from properties of the object. For example:
     ```javascript
    App.SaveButtonView = Ember.View.extend(Ember.TargetActionSupport, {
      target: Ember.computed.alias('controller'),
      action: 'save',
      actionContext: Ember.computed.alias('context'),
      click() {
        this.triggerAction(); // Sends the `save` action, along with the current context
                              // to the current controller
      }
    });
    ```
     The `target`, `action`, and `actionContext` can be provided as properties of
    an optional object argument to `triggerAction` as well.
     ```javascript
    App.SaveButtonView = Ember.View.extend(Ember.TargetActionSupport, {
      click() {
        this.triggerAction({
          action: 'save',
          target: this.get('controller'),
          actionContext: this.get('context')
        }); // Sends the `save` action, along with the current context
            // to the current controller
      }
    });
    ```
     The `actionContext` defaults to the object you are mixing `TargetActionSupport` into.
    But `target` and `action` must be specified either as properties or with the argument
    to `triggerAction`, or a combination:
     ```javascript
    App.SaveButtonView = Ember.View.extend(Ember.TargetActionSupport, {
      target: Ember.computed.alias('controller'),
      click() {
        this.triggerAction({
          action: 'save'
        }); // Sends the `save` action, along with a reference to `this`,
            // to the current controller
      }
    });
    ```
     @method triggerAction
    @param opts {Object} (optional, with the optional keys action, target and/or actionContext)
    @return {Boolean} true if the action was sent successfully and did not return false
    @private
    */
    triggerAction: function () {
      var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var action = opts.action || _emberMetal.get(this, 'action');
      var target = opts.target;

      if (!target) {
        target = getTarget(this);
      }

      var actionContext = opts.actionContext;

      function args(options, actionName) {
        var ret = [];
        if (actionName) {
          ret.push(actionName);
        }

        return ret.concat(options);
      }

      if (typeof actionContext === 'undefined') {
        actionContext = _emberMetal.get(this, 'actionContextObject') || this;
      }

      if (target && action) {
        var ret = undefined;

        if (target.send) {
          ret = target.send.apply(target, args(actionContext, action));
        } else {
          _emberMetal.assert('The action \'' + action + '\' did not exist on ' + target, typeof target[action] === 'function');
          ret = target[action].apply(target, args(actionContext));
        }

        if (ret !== false) {
          ret = true;
        }

        return ret;
      } else {
        return false;
      }
    }
  });

  function getTarget(instance) {
    // TODO: Deprecate specifying `targetObject`
    var target = _emberMetal.get(instance, 'targetObject');

    // if a `targetObject` CP was provided, use it
    if (target) {
      return target;
    }

    // if _targetObject use it
    if (instance._targetObject) {
      return instance._targetObject;
    }

    target = _emberMetal.get(instance, 'target');
    if (target) {
      if (typeof target === 'string') {
        var value = _emberMetal.get(instance, target);
        if (value === undefined) {
          value = _emberMetal.get(_emberEnvironment.context.lookup, target);
        }

        return value;
      } else {
        return target;
      }
    }

    return null;
  }
});
enifed("ember-runtime/string_registry", ["exports"], function (exports) {
  // STATE within a module is frowned apon, this exists
  // to support Ember.STRINGS but shield ember internals from this legacy global
  // API.
  "use strict";

  exports.setStrings = setStrings;
  exports.getStrings = getStrings;
  exports.get = get;
  var STRINGS = {};

  function setStrings(strings) {
    STRINGS = strings;
  }

  function getStrings() {
    return STRINGS;
  }

  function get(name) {
    return STRINGS[name];
  }
});
enifed('ember-runtime/system/application', ['exports', 'ember-runtime/system/namespace'], function (exports, _emberRuntimeSystemNamespace) {
  'use strict';

  exports.default = _emberRuntimeSystemNamespace.default.extend();
});
enifed('ember-runtime/system/array_proxy', ['exports', 'ember-metal', 'ember-runtime/utils', 'ember-runtime/system/object', 'ember-runtime/mixins/mutable_array', 'ember-runtime/mixins/enumerable', 'ember-runtime/mixins/array'], function (exports, _emberMetal, _emberRuntimeUtils, _emberRuntimeSystemObject, _emberRuntimeMixinsMutable_array, _emberRuntimeMixinsEnumerable, _emberRuntimeMixinsArray) {
  'use strict';

  /**
  @module ember
  @submodule ember-runtime
  */

  var OUT_OF_RANGE_EXCEPTION = 'Index out of range';
  var EMPTY = [];

  function K() {
    return this;
  }

  /**
    An ArrayProxy wraps any other object that implements `Ember.Array` and/or
    `Ember.MutableArray,` forwarding all requests. This makes it very useful for
    a number of binding use cases or other cases where being able to swap
    out the underlying array is useful.
  
    A simple example of usage:
  
    ```javascript
    let pets = ['dog', 'cat', 'fish'];
    let ap = Ember.ArrayProxy.create({ content: Ember.A(pets) });
  
    ap.get('firstObject');                        // 'dog'
    ap.set('content', ['amoeba', 'paramecium']);
    ap.get('firstObject');                        // 'amoeba'
    ```
  
    This class can also be useful as a layer to transform the contents of
    an array, as they are accessed. This can be done by overriding
    `objectAtContent`:
  
    ```javascript
    let pets = ['dog', 'cat', 'fish'];
    let ap = Ember.ArrayProxy.create({
        content: Ember.A(pets),
        objectAtContent: function(idx) {
            return this.get('content').objectAt(idx).toUpperCase();
        }
    });
  
    ap.get('firstObject'); // . 'DOG'
    ```
  
    @class ArrayProxy
    @namespace Ember
    @extends Ember.Object
    @uses Ember.MutableArray
    @public
  */
  exports.default = _emberRuntimeSystemObject.default.extend(_emberRuntimeMixinsMutable_array.default, {

    /**
      The content array. Must be an object that implements `Ember.Array` and/or
      `Ember.MutableArray.`
       @property content
      @type Ember.Array
      @private
    */
    content: null,

    /**
     The array that the proxy pretends to be. In the default `ArrayProxy`
     implementation, this and `content` are the same. Subclasses of `ArrayProxy`
     can override this property to provide things like sorting and filtering.
      @property arrangedContent
     @private
    */
    arrangedContent: _emberMetal.alias('content'),

    /**
      Should actually retrieve the object at the specified index from the
      content. You can override this method in subclasses to transform the
      content item to something new.
       This method will only be called if content is non-`null`.
       @method objectAtContent
      @param {Number} idx The index to retrieve.
      @return {Object} the value or undefined if none found
      @public
    */
    objectAtContent: function (idx) {
      return _emberRuntimeMixinsArray.objectAt(_emberMetal.get(this, 'arrangedContent'), idx);
    },

    /**
      Should actually replace the specified objects on the content array.
      You can override this method in subclasses to transform the content item
      into something new.
       This method will only be called if content is non-`null`.
       @method replaceContent
      @param {Number} idx The starting index
      @param {Number} amt The number of items to remove from the content.
      @param {Array} objects Optional array of objects to insert or null if no
        objects.
      @return {void}
      @private
    */
    replaceContent: function (idx, amt, objects) {
      _emberMetal.get(this, 'content').replace(idx, amt, objects);
    },

    /**
      Invoked when the content property is about to change. Notifies observers that the
      entire array content will change.
       @private
      @method _contentWillChange
    */
    _contentWillChange: _emberMetal._beforeObserver('content', function () {
      this._teardownContent();
    }),

    _teardownContent: function () {
      var content = _emberMetal.get(this, 'content');

      if (content) {
        _emberRuntimeMixinsArray.removeArrayObserver(content, this, {
          willChange: 'contentArrayWillChange',
          didChange: 'contentArrayDidChange'
        });
      }
    },

    /**
      Override to implement content array `willChange` observer.
       @method contentArrayWillChange
       @param {Ember.Array} contentArray the content array
      @param {Number} start starting index of the change
      @param {Number} removeCount count of items removed
      @param {Number} addCount count of items added
      @private
    */
    contentArrayWillChange: K,
    /**
      Override to implement content array `didChange` observer.
       @method contentArrayDidChange
       @param {Ember.Array} contentArray the content array
      @param {Number} start starting index of the change
      @param {Number} removeCount count of items removed
      @param {Number} addCount count of items added
      @private
    */
    contentArrayDidChange: K,

    /**
      Invoked when the content property changes. Notifies observers that the
      entire array content has changed.
       @private
      @method _contentDidChange
    */
    _contentDidChange: _emberMetal.observer('content', function () {
      var content = _emberMetal.get(this, 'content');

      _emberMetal.assert('Can\'t set ArrayProxy\'s content to itself', content !== this);

      this._setupContent();
    }),

    _setupContent: function () {
      var content = _emberMetal.get(this, 'content');

      if (content) {
        _emberMetal.assert('ArrayProxy expects an Array or Ember.ArrayProxy, but you passed ' + typeof content, _emberRuntimeUtils.isArray(content) || content.isDestroyed);

        _emberRuntimeMixinsArray.addArrayObserver(content, this, {
          willChange: 'contentArrayWillChange',
          didChange: 'contentArrayDidChange'
        });
      }
    },

    _arrangedContentWillChange: _emberMetal._beforeObserver('arrangedContent', function () {
      var arrangedContent = _emberMetal.get(this, 'arrangedContent');
      var len = arrangedContent ? _emberMetal.get(arrangedContent, 'length') : 0;

      this.arrangedContentArrayWillChange(this, 0, len, undefined);
      this.arrangedContentWillChange(this);

      this._teardownArrangedContent(arrangedContent);
    }),

    _arrangedContentDidChange: _emberMetal.observer('arrangedContent', function () {
      var arrangedContent = _emberMetal.get(this, 'arrangedContent');
      var len = arrangedContent ? _emberMetal.get(arrangedContent, 'length') : 0;

      _emberMetal.assert('Can\'t set ArrayProxy\'s content to itself', arrangedContent !== this);

      this._setupArrangedContent();

      this.arrangedContentDidChange(this);
      this.arrangedContentArrayDidChange(this, 0, undefined, len);
    }),

    _setupArrangedContent: function () {
      var arrangedContent = _emberMetal.get(this, 'arrangedContent');

      if (arrangedContent) {
        _emberMetal.assert('ArrayProxy expects an Array or Ember.ArrayProxy, but you passed ' + typeof arrangedContent, _emberRuntimeUtils.isArray(arrangedContent) || arrangedContent.isDestroyed);

        _emberRuntimeMixinsArray.addArrayObserver(arrangedContent, this, {
          willChange: 'arrangedContentArrayWillChange',
          didChange: 'arrangedContentArrayDidChange'
        });
      }
    },

    _teardownArrangedContent: function () {
      var arrangedContent = _emberMetal.get(this, 'arrangedContent');

      if (arrangedContent) {
        _emberRuntimeMixinsArray.removeArrayObserver(arrangedContent, this, {
          willChange: 'arrangedContentArrayWillChange',
          didChange: 'arrangedContentArrayDidChange'
        });
      }
    },

    arrangedContentWillChange: K,
    arrangedContentDidChange: K,

    objectAt: function (idx) {
      return _emberMetal.get(this, 'content') && this.objectAtContent(idx);
    },

    length: _emberMetal.computed(function () {
      var arrangedContent = _emberMetal.get(this, 'arrangedContent');
      return arrangedContent ? _emberMetal.get(arrangedContent, 'length') : 0;
      // No dependencies since Enumerable notifies length of change
    }),

    _replace: function (idx, amt, objects) {
      var content = _emberMetal.get(this, 'content');
      _emberMetal.assert('The content property of ' + this.constructor + ' should be set before modifying it', content);
      if (content) {
        this.replaceContent(idx, amt, objects);
      }

      return this;
    },

    replace: function () {
      if (_emberMetal.get(this, 'arrangedContent') === _emberMetal.get(this, 'content')) {
        this._replace.apply(this, arguments);
      } else {
        throw new _emberMetal.Error('Using replace on an arranged ArrayProxy is not allowed.');
      }
    },

    _insertAt: function (idx, object) {
      if (idx > _emberMetal.get(this, 'content.length')) {
        throw new _emberMetal.Error(OUT_OF_RANGE_EXCEPTION);
      }

      this._replace(idx, 0, [object]);
      return this;
    },

    insertAt: function (idx, object) {
      if (_emberMetal.get(this, 'arrangedContent') === _emberMetal.get(this, 'content')) {
        return this._insertAt(idx, object);
      } else {
        throw new _emberMetal.Error('Using insertAt on an arranged ArrayProxy is not allowed.');
      }
    },

    removeAt: function (start, len) {
      if ('number' === typeof start) {
        var content = _emberMetal.get(this, 'content');
        var arrangedContent = _emberMetal.get(this, 'arrangedContent');
        var indices = [];

        if (start < 0 || start >= _emberMetal.get(this, 'length')) {
          throw new _emberMetal.Error(OUT_OF_RANGE_EXCEPTION);
        }

        if (len === undefined) {
          len = 1;
        }

        // Get a list of indices in original content to remove
        for (var i = start; i < start + len; i++) {
          // Use arrangedContent here so we avoid confusion with objects transformed by objectAtContent
          indices.push(content.indexOf(_emberRuntimeMixinsArray.objectAt(arrangedContent, i)));
        }

        // Replace in reverse order since indices will change
        indices.sort(function (a, b) {
          return b - a;
        });

        _emberMetal.beginPropertyChanges();
        for (var i = 0; i < indices.length; i++) {
          this._replace(indices[i], 1, EMPTY);
        }
        _emberMetal.endPropertyChanges();
      }

      return this;
    },

    pushObject: function (obj) {
      this._insertAt(_emberMetal.get(this, 'content.length'), obj);
      return obj;
    },

    pushObjects: function (objects) {
      if (!(_emberRuntimeMixinsEnumerable.default.detect(objects) || _emberRuntimeUtils.isArray(objects))) {
        throw new TypeError('Must pass Ember.Enumerable to Ember.MutableArray#pushObjects');
      }
      this._replace(_emberMetal.get(this, 'length'), 0, objects);
      return this;
    },

    setObjects: function (objects) {
      if (objects.length === 0) {
        return this.clear();
      }

      var len = _emberMetal.get(this, 'length');
      this._replace(0, len, objects);
      return this;
    },

    unshiftObject: function (obj) {
      this._insertAt(0, obj);
      return obj;
    },

    unshiftObjects: function (objects) {
      this._replace(0, 0, objects);
      return this;
    },

    slice: function () {
      var arr = this.toArray();
      return arr.slice.apply(arr, arguments);
    },

    arrangedContentArrayWillChange: function (item, idx, removedCnt, addedCnt) {
      this.arrayContentWillChange(idx, removedCnt, addedCnt);
    },

    arrangedContentArrayDidChange: function (item, idx, removedCnt, addedCnt) {
      this.arrayContentDidChange(idx, removedCnt, addedCnt);
    },

    init: function () {
      this._super.apply(this, arguments);
      this._setupContent();
      this._setupArrangedContent();
    },

    willDestroy: function () {
      this._teardownArrangedContent();
      this._teardownContent();
    }
  });
});
enifed('ember-runtime/system/core_object', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/mixins/action_handler', 'ember-runtime/inject'], function (exports, _emberUtils, _emberMetal, _emberRuntimeMixinsAction_handler, _emberRuntimeInject) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  /**
    @module ember
    @submodule ember-runtime
  */

  // using ember-metal/lib/main here to ensure that ember-debug is setup
  // if present

  var _Mixin$create;

  var _templateObject = babelHelpers.taggedTemplateLiteralLoose(['.'], ['.']);

  var schedule = _emberMetal.run.schedule;
  var applyMixin = _emberMetal.Mixin._apply;
  var finishPartial = _emberMetal.Mixin.finishPartial;
  var reopen = _emberMetal.Mixin.prototype.reopen;
  var hasCachedComputedProperties = false;

  var POST_INIT = _emberUtils.symbol('POST_INIT');

  exports.POST_INIT = POST_INIT;
  function makeCtor() {
    // Note: avoid accessing any properties on the object since it makes the
    // method a lot faster. This is glue code so we want it to be as fast as
    // possible.

    var wasApplied = false;
    var initProperties;

    var Class = function () {
      if (!wasApplied) {
        Class.proto(); // prepare prototype...
      }

      if (arguments.length > 0) {
        initProperties = [arguments[0]];
      }

      this.__defineNonEnumerable(_emberUtils.GUID_KEY_PROPERTY);
      var m = _emberMetal.meta(this);
      var proto = m.proto;
      m.proto = this;
      if (initProperties) {
        // capture locally so we can clear the closed over variable
        var props = initProperties;
        initProperties = null;

        var concatenatedProperties = this.concatenatedProperties;
        var mergedProperties = this.mergedProperties;

        for (var i = 0; i < props.length; i++) {
          var properties = props[i];

          _emberMetal.assert('Ember.Object.create no longer supports mixing in other ' + 'definitions, use .extend & .create separately instead.', !(properties instanceof _emberMetal.Mixin));

          if (typeof properties !== 'object' && properties !== undefined) {
            throw new _emberMetal.Error('Ember.Object.create only accepts objects.');
          }

          if (!properties) {
            continue;
          }

          var keyNames = Object.keys(properties);

          for (var j = 0; j < keyNames.length; j++) {
            var keyName = keyNames[j];
            var value = properties[keyName];

            if (_emberMetal.detectBinding(keyName)) {
              m.writeBindings(keyName, value);
            }

            var possibleDesc = this[keyName];
            var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

            _emberMetal.assert('Ember.Object.create no longer supports defining computed ' + 'properties. Define computed properties using extend() or reopen() ' + 'before calling create().', !(value instanceof _emberMetal.ComputedProperty));
            _emberMetal.assert('Ember.Object.create no longer supports defining methods that call _super.', !(typeof value === 'function' && value.toString().indexOf('._super') !== -1));
            _emberMetal.assert('`actions` must be provided at extend time, not at create time, ' + 'when Ember.ActionHandler is used (i.e. views, controllers & routes).', !(keyName === 'actions' && _emberRuntimeMixinsAction_handler.default.detect(this)));

            if (concatenatedProperties && concatenatedProperties.length > 0 && concatenatedProperties.indexOf(keyName) >= 0) {
              var baseValue = this[keyName];

              if (baseValue) {
                if ('function' === typeof baseValue.concat) {
                  value = baseValue.concat(value);
                } else {
                  value = _emberUtils.makeArray(baseValue).concat(value);
                }
              } else {
                value = _emberUtils.makeArray(value);
              }
            }

            if (mergedProperties && mergedProperties.length && mergedProperties.indexOf(keyName) >= 0) {
              var originalValue = this[keyName];

              value = _emberUtils.assign({}, originalValue, value);
            }

            if (desc) {
              desc.set(this, keyName, value);
            } else {
              if (typeof this.setUnknownProperty === 'function' && !(keyName in this)) {
                this.setUnknownProperty(keyName, value);
              } else {
                if (_emberMetal.isFeatureEnabled('mandatory-setter')) {
                  _emberMetal.defineProperty(this, keyName, null, value); // setup mandatory setter
                } else {
                    this[keyName] = value;
                  }
              }
            }
          }
        }
      }

      finishPartial(this, m);

      this.init.apply(this, arguments);

      this[POST_INIT]();

      m.proto = proto;
      _emberMetal.finishChains(this);
      _emberMetal.sendEvent(this, 'init');
    };

    Class.toString = _emberMetal.Mixin.prototype.toString;
    Class.willReopen = function () {
      if (wasApplied) {
        Class.PrototypeMixin = _emberMetal.Mixin.create(Class.PrototypeMixin);
      }

      wasApplied = false;
    };

    Class._initProperties = function (args) {
      initProperties = args;
    };

    Class.proto = function () {
      var superclass = Class.superclass;
      if (superclass) {
        superclass.proto();
      }

      if (!wasApplied) {
        wasApplied = true;
        Class.PrototypeMixin.applyPartial(Class.prototype);
      }

      return this.prototype;
    };

    return Class;
  }

  /**
    @class CoreObject
    @namespace Ember
    @public
  */
  var CoreObject = makeCtor();
  CoreObject.toString = function () {
    return 'Ember.CoreObject';
  };
  CoreObject.PrototypeMixin = _emberMetal.Mixin.create((_Mixin$create = {
    reopen: function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      applyMixin(this, args, true);
      return this;
    },

    /**
      An overridable method called when objects are instantiated. By default,
      does nothing unless it is overridden during class definition.
       Example:
       ```javascript
      const Person = Ember.Object.extend({
        init() {
          alert(`Name is ${this.get('name')}`);
        }
      });
       let steve = Person.create({
        name: "Steve"
      });
       // alerts 'Name is Steve'.
      ```
       NOTE: If you do override `init` for a framework class like `Ember.View`,
      be sure to call `this._super(...arguments)` in your
      `init` declaration! If you don't, Ember may not have an opportunity to
      do important setup work, and you'll see strange behavior in your
      application.
       @method init
      @public
    */
    init: function () {}

  }, _Mixin$create[POST_INIT] = function () {}, _Mixin$create.__defineNonEnumerable = function (property) {
    Object.defineProperty(this, property.name, property.descriptor);
    //this[property.name] = property.descriptor.value;
  }, _Mixin$create.concatenatedProperties = null, _Mixin$create.mergedProperties = null, _Mixin$create.isDestroyed = _emberMetal.descriptor({
    get: function () {
      return _emberMetal.meta(this).isSourceDestroyed();
    },

    set: function (value) {
      // prevent setting while applying mixins
      if (typeof value === 'object' && value !== null && value.isDescriptor) {
        return;
      }

      _emberMetal.assert(('You cannot set `' + this + '.isDestroyed` directly, please use ').destroy()(_templateObject), false);
    }
  }), _Mixin$create.isDestroying = _emberMetal.descriptor({
    get: function () {
      return _emberMetal.meta(this).isSourceDestroying();
    },

    set: function (value) {
      // prevent setting while applying mixins
      if (typeof value === 'object' && value !== null && value.isDescriptor) {
        return;
      }

      _emberMetal.assert(('You cannot set `' + this + '.isDestroying` directly, please use ').destroy()(_templateObject), false);
    }
  }), _Mixin$create.destroy = function () {
    var m = _emberMetal.meta(this);
    if (m.isSourceDestroying()) {
      return;
    }

    m.setSourceDestroying();

    schedule('actions', this, this.willDestroy);
    schedule('destroy', this, this._scheduledDestroy, m);

    return this;
  }, _Mixin$create.willDestroy = function () {}, _Mixin$create._scheduledDestroy = function (m) {
    if (m.isSourceDestroyed()) {
      return;
    }
    _emberMetal.destroy(this);
    m.setSourceDestroyed();
  }, _Mixin$create.bind = function (to, from) {
    if (!(from instanceof _emberMetal.Binding)) {
      from = _emberMetal.Binding.from(from);
    }
    from.to(to).connect(this);
    return from;
  }, _Mixin$create.toString = function () {
    var hasToStringExtension = typeof this.toStringExtension === 'function';
    var extension = hasToStringExtension ? ':' + this.toStringExtension() : '';
    var ret = '<' + this.constructor.toString() + ':' + _emberUtils.guidFor(this) + extension + '>';

    return ret;
  }, _Mixin$create));

  CoreObject.PrototypeMixin.ownerConstructor = CoreObject;

  CoreObject.__super__ = null;

  var ClassMixinProps = {

    ClassMixin: _emberMetal.REQUIRED,

    PrototypeMixin: _emberMetal.REQUIRED,

    isClass: true,

    isMethod: false,
    /**
      Creates a new subclass.
       ```javascript
      const Person = Ember.Object.extend({
        say(thing) {
          alert(thing);
         }
      });
      ```
       This defines a new subclass of Ember.Object: `Person`. It contains one method: `say()`.
       You can also create a subclass from any existing class by calling its `extend()` method.
      For example, you might want to create a subclass of Ember's built-in `Ember.Component` class:
       ```javascript
      const PersonComponent = Ember.Component.extend({
        tagName: 'li',
        classNameBindings: ['isAdministrator']
      });
      ```
       When defining a subclass, you can override methods but still access the
      implementation of your parent class by calling the special `_super()` method:
       ```javascript
      const Person = Ember.Object.extend({
        say(thing) {
          var name = this.get('name');
          alert(`${name} says: ${thing}`);
        }
      });
       const Soldier = Person.extend({
        say(thing) {
          this._super(`${thing}, sir!`);
        },
        march(numberOfHours) {
          alert(`${this.get('name')} marches for ${numberOfHours} hours.`);
        }
      });
       let yehuda = Soldier.create({
        name: "Yehuda Katz"
      });
       yehuda.say("Yes");  // alerts "Yehuda Katz says: Yes, sir!"
      ```
       The `create()` on line #17 creates an *instance* of the `Soldier` class.
      The `extend()` on line #8 creates a *subclass* of `Person`. Any instance
      of the `Person` class will *not* have the `march()` method.
       You can also pass `Mixin` classes to add additional properties to the subclass.
       ```javascript
      const Person = Ember.Object.extend({
        say(thing) {
          alert(`${this.get('name')} says: ${thing}`);
        }
      });
       const SingingMixin = Mixin.create({
        sing(thing){
          alert(`${this.get('name')} sings: la la la ${thing}`);
        }
      });
       const BroadwayStar = Person.extend(SingingMixin, {
        dance() {
          alert(`${this.get('name')} dances: tap tap tap tap `);
        }
      });
      ```
       The `BroadwayStar` class contains three methods: `say()`, `sing()`, and `dance()`.
       @method extend
      @static
       @param {Mixin} [mixins]* One or more Mixin classes
      @param {Object} [arguments]* Object containing values to use within the new class
      @public
    */
    extend: function () {
      var Class = makeCtor();
      var proto;
      Class.ClassMixin = _emberMetal.Mixin.create(this.ClassMixin);
      Class.PrototypeMixin = _emberMetal.Mixin.create(this.PrototypeMixin);

      Class.ClassMixin.ownerConstructor = Class;
      Class.PrototypeMixin.ownerConstructor = Class;

      reopen.apply(Class.PrototypeMixin, arguments);

      Class.superclass = this;
      Class.__super__ = this.prototype;

      proto = Class.prototype = Object.create(this.prototype);
      proto.constructor = Class;
      _emberUtils.generateGuid(proto);
      _emberMetal.meta(proto).proto = proto; // this will disable observers on prototype

      Class.ClassMixin.apply(Class);
      return Class;
    },

    /**
      Creates an instance of a class. Accepts either no arguments, or an object
      containing values to initialize the newly instantiated object with.
       ```javascript
      const Person = Ember.Object.extend({
        helloWorld() {
          alert(`Hi, my name is ${this.get('name')}`);
        }
      });
       let tom = Person.create({
        name: 'Tom Dale'
      });
       tom.helloWorld(); // alerts "Hi, my name is Tom Dale".
      ```
       `create` will call the `init` function if defined during
      `Ember.AnyObject.extend`
       If no arguments are passed to `create`, it will not set values to the new
      instance during initialization:
       ```javascript
      let noName = Person.create();
      noName.helloWorld(); // alerts undefined
      ```
       NOTE: For performance reasons, you cannot declare methods or computed
      properties during `create`. You should instead declare methods and computed
      properties when using `extend`.
       @method create
      @static
      @param [arguments]*
      @public
    */
    create: function () {
      var C = this;

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      if (args.length > 0) {
        this._initProperties(args);
      }
      return new C();
    },

    /**
      Augments a constructor's prototype with additional
      properties and functions:
       ```javascript
      const MyObject = Ember.Object.extend({
        name: 'an object'
      });
       o = MyObject.create();
      o.get('name'); // 'an object'
       MyObject.reopen({
        say(msg){
          console.log(msg);
        }
      })
       o2 = MyObject.create();
      o2.say("hello"); // logs "hello"
       o.say("goodbye"); // logs "goodbye"
      ```
       To add functions and properties to the constructor itself,
      see `reopenClass`
       @method reopen
      @public
    */
    reopen: function () {
      this.willReopen();
      reopen.apply(this.PrototypeMixin, arguments);
      return this;
    },

    /**
      Augments a constructor's own properties and functions:
       ```javascript
      const MyObject = Ember.Object.extend({
        name: 'an object'
      });
       MyObject.reopenClass({
        canBuild: false
      });
       MyObject.canBuild; // false
      o = MyObject.create();
      ```
       In other words, this creates static properties and functions for the class.
      These are only available on the class and not on any instance of that class.
       ```javascript
      const Person = Ember.Object.extend({
        name: "",
        sayHello() {
          alert("Hello. My name is " + this.get('name'));
        }
      });
       Person.reopenClass({
        species: "Homo sapiens",
        createPerson(newPersonsName){
          return Person.create({
            name:newPersonsName
          });
        }
      });
       let tom = Person.create({
        name: "Tom Dale"
      });
      let yehuda = Person.createPerson("Yehuda Katz");
       tom.sayHello(); // "Hello. My name is Tom Dale"
      yehuda.sayHello(); // "Hello. My name is Yehuda Katz"
      alert(Person.species); // "Homo sapiens"
      ```
       Note that `species` and `createPerson` are *not* valid on the `tom` and `yehuda`
      variables. They are only valid on `Person`.
       To add functions and properties to instances of
      a constructor by extending the constructor's prototype
      see `reopen`
       @method reopenClass
      @public
    */
    reopenClass: function () {
      reopen.apply(this.ClassMixin, arguments);
      applyMixin(this, arguments, false);
      return this;
    },

    detect: function (obj) {
      if ('function' !== typeof obj) {
        return false;
      }
      while (obj) {
        if (obj === this) {
          return true;
        }
        obj = obj.superclass;
      }
      return false;
    },

    detectInstance: function (obj) {
      return obj instanceof this;
    },

    /**
      In some cases, you may want to annotate computed properties with additional
      metadata about how they function or what values they operate on. For
      example, computed property functions may close over variables that are then
      no longer available for introspection.
       You can pass a hash of these values to a computed property like this:
       ```javascript
      person: Ember.computed(function() {
        var personId = this.get('personId');
        return Person.create({ id: personId });
      }).meta({ type: Person })
      ```
       Once you've done this, you can retrieve the values saved to the computed
      property from your class like this:
       ```javascript
      MyClass.metaForProperty('person');
      ```
       This will return the original hash that was passed to `meta()`.
       @static
      @method metaForProperty
      @param key {String} property name
      @private
    */
    metaForProperty: function (key) {
      var proto = this.proto();
      var possibleDesc = proto[key];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      _emberMetal.assert('metaForProperty() could not find a computed property ' + 'with key \'' + key + '\'.', !!desc && desc instanceof _emberMetal.ComputedProperty);
      return desc._meta || {};
    },

    _computedProperties: _emberMetal.computed(function () {
      hasCachedComputedProperties = true;
      var proto = this.proto();
      var property;
      var properties = [];

      for (var name in proto) {
        property = proto[name];

        if (property && property.isDescriptor) {
          properties.push({
            name: name,
            meta: property._meta
          });
        }
      }
      return properties;
    }).readOnly(),

    /**
      Iterate over each computed property for the class, passing its name
      and any associated metadata (see `metaForProperty`) to the callback.
       @static
      @method eachComputedProperty
      @param {Function} callback
      @param {Object} binding
      @private
    */
    eachComputedProperty: function (callback, binding) {
      var property;
      var empty = {};

      var properties = _emberMetal.get(this, '_computedProperties');

      for (var i = 0; i < properties.length; i++) {
        property = properties[i];
        callback.call(binding || this, property.name, property.meta || empty);
      }
    }
  };

  function injectedPropertyAssertion() {
    _emberMetal.assert('Injected properties are invalid', _emberRuntimeInject.validatePropertyInjections(this));
  }

  _emberMetal.runInDebug(function () {
    /**
      Provides lookup-time type validation for injected properties.
       @private
      @method _onLookup
    */
    ClassMixinProps._onLookup = injectedPropertyAssertion;
  });

  /**
    Returns a hash of property names and container names that injected
    properties will lookup on the container lazily.
  
    @method _lazyInjections
    @return {Object} Hash of all lazy injected property keys to container names
    @private
  */
  ClassMixinProps._lazyInjections = function () {
    var injections = {};
    var proto = this.proto();
    var key, desc;

    for (key in proto) {
      desc = proto[key];
      if (desc instanceof _emberMetal.InjectedProperty) {
        injections[key] = desc.type + ':' + (desc.name || key);
      }
    }

    return injections;
  };

  var ClassMixin = _emberMetal.Mixin.create(ClassMixinProps);

  ClassMixin.ownerConstructor = CoreObject;

  CoreObject.ClassMixin = ClassMixin;

  ClassMixin.apply(CoreObject);

  CoreObject.reopen({
    didDefineProperty: function (proto, key, value) {
      if (hasCachedComputedProperties === false) {
        return;
      }
      if (value instanceof _emberMetal.ComputedProperty) {
        var cache = _emberMetal.meta(this.constructor).readableCache();

        if (cache && cache._computedProperties !== undefined) {
          cache._computedProperties = undefined;
        }
      }
    }
  });

  exports.default = CoreObject;
});
// Private, and only for didInitAttrs willRecieveAttrs

/**
  Defines the properties that will be concatenated from the superclass
  (instead of overridden).
   By default, when you extend an Ember class a property defined in
  the subclass overrides a property with the same name that is defined
  in the superclass. However, there are some cases where it is preferable
  to build up a property's value by combining the superclass' property
  value with the subclass' value. An example of this in use within Ember
  is the `classNames` property of `Ember.View`.
   Here is some sample code showing the difference between a concatenated
  property and a normal one:
   ```javascript
  const Bar = Ember.Object.extend({
    // Configure which properties to concatenate
    concatenatedProperties: ['concatenatedProperty'],
     someNonConcatenatedProperty: ['bar'],
    concatenatedProperty: ['bar']
  });
   const FooBar = Bar.extend({
    someNonConcatenatedProperty: ['foo'],
    concatenatedProperty: ['foo']
  });
   let fooBar = FooBar.create();
  fooBar.get('someNonConcatenatedProperty'); // ['foo']
  fooBar.get('concatenatedProperty'); // ['bar', 'foo']
  ```
   This behavior extends to object creation as well. Continuing the
  above example:
   ```javascript
  let fooBar = FooBar.create({
    someNonConcatenatedProperty: ['baz'],
    concatenatedProperty: ['baz']
  })
  fooBar.get('someNonConcatenatedProperty'); // ['baz']
  fooBar.get('concatenatedProperty'); // ['bar', 'foo', 'baz']
  ```
   Adding a single property that is not an array will just add it in the array:
   ```javascript
  let fooBar = FooBar.create({
    concatenatedProperty: 'baz'
  })
  view.get('concatenatedProperty'); // ['bar', 'foo', 'baz']
  ```
   Using the `concatenatedProperties` property, we can tell Ember to mix the
  content of the properties.
   In `Ember.Component` the `classNames`, `classNameBindings` and
  `attributeBindings` properties are concatenated.
   This feature is available for you to use throughout the Ember object model,
  although typical app developers are likely to use it infrequently. Since
  it changes expectations about behavior of properties, you should properly
  document its usage in each individual concatenated property (to not
  mislead your users to think they can override the property in a subclass).
   @property concatenatedProperties
  @type Array
  @default null
  @public
*/

/**
  Defines the properties that will be merged from the superclass
  (instead of overridden).
   By default, when you extend an Ember class a property defined in
  the subclass overrides a property with the same name that is defined
  in the superclass. However, there are some cases where it is preferable
  to build up a property's value by merging the superclass property value
  with the subclass property's value. An example of this in use within Ember
  is the `queryParams` property of routes.
   Here is some sample code showing the difference between a merged
  property and a normal one:
   ```javascript
  const Bar = Ember.Object.extend({
    // Configure which properties are to be merged
    mergedProperties: ['mergedProperty'],
     someNonMergedProperty: {
      nonMerged: 'superclass value of nonMerged'
    },
    mergedProperty: {
      page: {replace: false},
      limit: {replace: true}
    }
  });
   const FooBar = Bar.extend({
    someNonMergedProperty: {
      completelyNonMerged: 'subclass value of nonMerged'
    },
    mergedProperty: {
      limit: {replace: false}
    }
  });
   let fooBar = FooBar.create();
   fooBar.get('someNonMergedProperty');
  // => { completelyNonMerged: 'subclass value of nonMerged' }
  //
  // Note the entire object, including the nonMerged property of
  // the superclass object, has been replaced
   fooBar.get('mergedProperty');
  // => {
  //   page: {replace: false},
  //   limit: {replace: false}
  // }
  //
  // Note the page remains from the superclass, and the
  // `limit` property's value of `false` has been merged from
  // the subclass.
  ```
   This behavior is not available during object `create` calls. It is only
  available at `extend` time.
   In `Ember.Route` the `queryParams` property is merged.
   This feature is available for you to use throughout the Ember object model,
  although typical app developers are likely to use it infrequently. Since
  it changes expectations about behavior of properties, you should properly
  document its usage in each individual merged property (to not
  mislead your users to think they can override the property in a subclass).
   @property mergedProperties
  @type Array
  @default null
  @public
*/

/**
  Destroyed object property flag.
   if this property is `true` the observers and bindings were already
  removed by the effect of calling the `destroy()` method.
   @property isDestroyed
  @default false
  @public
*/

/**
  Destruction scheduled flag. The `destroy()` method has been called.
   The object stays intact until the end of the run loop at which point
  the `isDestroyed` flag is set.
   @property isDestroying
  @default false
  @public
*/

/**
  Destroys an object by setting the `isDestroyed` flag and removing its
  metadata, which effectively destroys observers and bindings.
   If you try to set a property on a destroyed object, an exception will be
  raised.
   Note that destruction is scheduled for the end of the run loop and does not
  happen immediately.  It will set an isDestroying flag immediately.
   @method destroy
  @return {Ember.Object} receiver
  @public
*/

/**
  Override to implement teardown.
   @method willDestroy
  @public
*/

/**
  Invoked by the run loop to actually destroy the object. This is
  scheduled for execution by the `destroy` method.
   @private
  @method _scheduledDestroy
*/

/**
  Returns a string representation which attempts to provide more information
  than Javascript's `toString` typically does, in a generic way for all Ember
  objects.
   ```javascript
  const Person = Ember.Object.extend()
  person = Person.create()
  person.toString() //=> "<Person:ember1024>"
  ```
   If the object's class is not defined on an Ember namespace, it will
  indicate it is a subclass of the registered superclass:
  ```javascript
  const Student = Person.extend()
  let student = Student.create()
  student.toString() //=> "<(subclass of Person):ember1025>"
  ```
   If the method `toStringExtension` is defined, its return value will be
  included in the output.
   ```javascript
  const Teacher = Person.extend({
    toStringExtension() {
      return this.get('fullName');
    }
  });
  teacher = Teacher.create()
  teacher.toString(); //=> "<Teacher:ember1026:Tom Dale>"
  ```
   @method toString
  @return {String} string representation
  @public
*/
enifed('ember-runtime/system/each_proxy', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/mixins/array'], function (exports, _emberUtils, _emberMetal, _emberRuntimeMixinsArray) {
  'use strict';

  exports.default = EachProxy;

  /**
    This is the object instance returned when you get the `@each` property on an
    array. It uses the unknownProperty handler to automatically create
    EachArray instances for property names.
    @class EachProxy
    @private
  */

  function EachProxy(content) {
    this._content = content;
    this._keys = undefined;
    this.__ember_meta__ = null;
  }

  EachProxy.prototype = {
    __defineNonEnumerable: function (property) {
      this[property.name] = property.descriptor.value;
    },

    // ..........................................................
    // ARRAY CHANGES
    // Invokes whenever the content array itself changes.

    arrayWillChange: function (content, idx, removedCnt, addedCnt) {
      var keys = this._keys;
      var lim = removedCnt > 0 ? idx + removedCnt : -1;
      for (var key in keys) {
        if (lim > 0) {
          removeObserverForContentKey(content, key, this, idx, lim);
        }
        _emberMetal.propertyWillChange(this, key);
      }
    },

    arrayDidChange: function (content, idx, removedCnt, addedCnt) {
      var keys = this._keys;
      var lim = addedCnt > 0 ? idx + addedCnt : -1;
      for (var key in keys) {
        if (lim > 0) {
          addObserverForContentKey(content, key, this, idx, lim);
        }
        _emberMetal.propertyDidChange(this, key);
      }
    },

    // ..........................................................
    // LISTEN FOR NEW OBSERVERS AND OTHER EVENT LISTENERS
    // Start monitoring keys based on who is listening...

    willWatchProperty: function (property) {
      this.beginObservingContentKey(property);
    },

    didUnwatchProperty: function (property) {
      this.stopObservingContentKey(property);
    },

    // ..........................................................
    // CONTENT KEY OBSERVING
    // Actual watch keys on the source content.

    beginObservingContentKey: function (keyName) {
      var keys = this._keys;
      if (!keys) {
        keys = this._keys = new _emberUtils.EmptyObject();
      }

      if (!keys[keyName]) {
        keys[keyName] = 1;
        var content = this._content;
        var len = _emberMetal.get(content, 'length');

        addObserverForContentKey(content, keyName, this, 0, len);
      } else {
        keys[keyName]++;
      }
    },

    stopObservingContentKey: function (keyName) {
      var keys = this._keys;
      if (keys && keys[keyName] > 0 && --keys[keyName] <= 0) {
        var content = this._content;
        var len = _emberMetal.get(content, 'length');

        removeObserverForContentKey(content, keyName, this, 0, len);
      }
    },

    contentKeyWillChange: function (obj, keyName) {
      _emberMetal.propertyWillChange(this, keyName);
    },

    contentKeyDidChange: function (obj, keyName) {
      _emberMetal.propertyDidChange(this, keyName);
    }
  };

  function addObserverForContentKey(content, keyName, proxy, idx, loc) {
    while (--loc >= idx) {
      var item = _emberRuntimeMixinsArray.objectAt(content, loc);
      if (item) {
        _emberMetal.assert('When using @each to observe the array ' + content + ', the array must return an object', typeof item === 'object');
        _emberMetal._addBeforeObserver(item, keyName, proxy, 'contentKeyWillChange');
        _emberMetal.addObserver(item, keyName, proxy, 'contentKeyDidChange');
      }
    }
  }

  function removeObserverForContentKey(content, keyName, proxy, idx, loc) {
    while (--loc >= idx) {
      var item = _emberRuntimeMixinsArray.objectAt(content, loc);
      if (item) {
        _emberMetal._removeBeforeObserver(item, keyName, proxy, 'contentKeyWillChange');
        _emberMetal.removeObserver(item, keyName, proxy, 'contentKeyDidChange');
      }
    }
  }
});
enifed('ember-runtime/system/lazy_load', ['exports', 'ember-environment'], function (exports, _emberEnvironment) {
  /*globals CustomEvent */

  'use strict';

  exports.onLoad = onLoad;
  exports.runLoadHooks = runLoadHooks;

  /**
    @module ember
    @submodule ember-runtime
  */

  var loadHooks = _emberEnvironment.ENV.EMBER_LOAD_HOOKS || {};
  var loaded = {};
  var _loaded = loaded;

  exports._loaded = _loaded;
  /**
    Detects when a specific package of Ember (e.g. 'Ember.Application')
    has fully loaded and is available for extension.
  
    The provided `callback` will be called with the `name` passed
    resolved from a string into the object:
  
    ``` javascript
    Ember.onLoad('Ember.Application' function(hbars) {
      hbars.registerHelper(...);
    });
    ```
  
    @method onLoad
    @for Ember
    @param name {String} name of hook
    @param callback {Function} callback to be called
    @private
  */

  function onLoad(name, callback) {
    var object = loaded[name];

    loadHooks[name] = loadHooks[name] || [];
    loadHooks[name].push(callback);

    if (object) {
      callback(object);
    }
  }

  /**
    Called when an Ember.js package (e.g Ember.Application) has finished
    loading. Triggers any callbacks registered for this event.
  
    @method runLoadHooks
    @for Ember
    @param name {String} name of hook
    @param object {Object} object to pass to callbacks
    @private
  */

  function runLoadHooks(name, object) {
    loaded[name] = object;
    var window = _emberEnvironment.environment.window;

    if (window && typeof CustomEvent === 'function') {
      var _event = new CustomEvent(name, { detail: object, name: name });
      window.dispatchEvent(_event);
    }

    if (loadHooks[name]) {
      loadHooks[name].forEach(function (callback) {
        return callback(object);
      });
    }
  }
});
enifed('ember-runtime/system/namespace', ['exports', 'ember-utils', 'ember-metal', 'ember-environment', 'ember-runtime/system/object'], function (exports, _emberUtils, _emberMetal, _emberEnvironment, _emberRuntimeSystemObject) {
  /**
  @module ember
  @submodule ember-runtime
  */
  'use strict';

  exports.isSearchDisabled = isSearchDisabled;
  exports.setSearchDisabled = setSearchDisabled;

  var searchDisabled = false;

  function isSearchDisabled() {
    return searchDisabled;
  }

  function setSearchDisabled(flag) {
    searchDisabled = !!flag;
  }

  /**
    A Namespace is an object usually used to contain other objects or methods
    such as an application or framework. Create a namespace anytime you want
    to define one of these new containers.
  
    # Example Usage
  
    ```javascript
    MyFramework = Ember.Namespace.create({
      VERSION: '1.0.0'
    });
    ```
  
    @class Namespace
    @namespace Ember
    @extends Ember.Object
    @public
  */
  var Namespace = _emberRuntimeSystemObject.default.extend({
    isNamespace: true,

    init: function () {
      Namespace.NAMESPACES.push(this);
      Namespace.PROCESSED = false;
    },

    toString: function () {
      var name = _emberMetal.get(this, 'name') || _emberMetal.get(this, 'modulePrefix');
      if (name) {
        return name;
      }

      findNamespaces();
      return this[_emberMetal.NAME_KEY];
    },

    nameClasses: function () {
      processNamespace([this.toString()], this, {});
    },

    destroy: function () {
      var namespaces = Namespace.NAMESPACES;
      var toString = this.toString();

      if (toString) {
        _emberEnvironment.context.lookup[toString] = undefined;
        delete Namespace.NAMESPACES_BY_ID[toString];
      }
      namespaces.splice(namespaces.indexOf(this), 1);
      this._super.apply(this, arguments);
    }
  });

  Namespace.reopenClass({
    NAMESPACES: [_emberMetal.default],
    NAMESPACES_BY_ID: {
      Ember: _emberMetal.default
    },
    PROCESSED: false,
    processAll: processAllNamespaces,
    byName: function (name) {
      if (!searchDisabled) {
        processAllNamespaces();
      }

      return NAMESPACES_BY_ID[name];
    }
  });

  var NAMESPACES_BY_ID = Namespace.NAMESPACES_BY_ID;

  var hasOwnProp = ({}).hasOwnProperty;

  function processNamespace(paths, root, seen) {
    var idx = paths.length;

    NAMESPACES_BY_ID[paths.join('.')] = root;

    // Loop over all of the keys in the namespace, looking for classes
    for (var key in root) {
      if (!hasOwnProp.call(root, key)) {
        continue;
      }
      var obj = root[key];

      // If we are processing the `Ember` namespace, for example, the
      // `paths` will start with `["Ember"]`. Every iteration through
      // the loop will update the **second** element of this list with
      // the key, so processing `Ember.View` will make the Array
      // `['Ember', 'View']`.
      paths[idx] = key;

      // If we have found an unprocessed class
      if (obj && obj.toString === classToString && !obj[_emberMetal.NAME_KEY]) {
        // Replace the class' `toString` with the dot-separated path
        // and set its `NAME_KEY`
        obj[_emberMetal.NAME_KEY] = paths.join('.');

        // Support nested namespaces
      } else if (obj && obj.isNamespace) {
          // Skip aliased namespaces
          if (seen[_emberUtils.guidFor(obj)]) {
            continue;
          }
          seen[_emberUtils.guidFor(obj)] = true;

          // Process the child namespace
          processNamespace(paths, obj, seen);
        }
    }

    paths.length = idx; // cut out last item
  }

  function isUppercase(code) {
    return code >= 65 && // A
    code <= 90; // Z
  }

  function tryIsNamespace(lookup, prop) {
    try {
      var obj = lookup[prop];
      return obj && obj.isNamespace && obj;
    } catch (e) {
      // continue
    }
  }

  function findNamespaces() {
    if (Namespace.PROCESSED) {
      return;
    }
    var lookup = _emberEnvironment.context.lookup;
    var keys = Object.keys(lookup);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      // Only process entities that start with uppercase A-Z
      if (!isUppercase(key.charCodeAt(0))) {
        continue;
      }
      var obj = tryIsNamespace(lookup, key);
      if (obj) {
        obj[_emberMetal.NAME_KEY] = key;
      }
    }
  }

  function superClassString(mixin) {
    var superclass = mixin.superclass;
    if (superclass) {
      if (superclass[_emberMetal.NAME_KEY]) {
        return superclass[_emberMetal.NAME_KEY];
      }
      return superClassString(superclass);
    }
  }

  function classToString() {
    if (!searchDisabled && !this[_emberMetal.NAME_KEY]) {
      processAllNamespaces();
    }

    var ret = undefined;

    if (this[_emberMetal.NAME_KEY]) {
      ret = this[_emberMetal.NAME_KEY];
    } else if (this._toString) {
      ret = this._toString;
    } else {
      var str = superClassString(this);
      if (str) {
        ret = '(subclass of ' + str + ')';
      } else {
        ret = '(unknown mixin)';
      }
      this.toString = makeToString(ret);
    }

    return ret;
  }

  function processAllNamespaces() {
    var unprocessedNamespaces = !Namespace.PROCESSED;
    var unprocessedMixins = _emberMetal.hasUnprocessedMixins();

    if (unprocessedNamespaces) {
      findNamespaces();
      Namespace.PROCESSED = true;
    }

    if (unprocessedNamespaces || unprocessedMixins) {
      var namespaces = Namespace.NAMESPACES;
      var namespace = undefined;

      for (var i = 0; i < namespaces.length; i++) {
        namespace = namespaces[i];
        processNamespace([namespace.toString()], namespace, {});
      }

      _emberMetal.clearUnprocessedMixins();
    }
  }

  function makeToString(ret) {
    return function () {
      return ret;
    };
  }

  _emberMetal.Mixin.prototype.toString = classToString; // ES6TODO: altering imported objects. SBB.

  exports.default = Namespace;
});
// Preloaded into namespaces
enifed('ember-runtime/system/native_array', ['exports', 'ember-metal', 'ember-environment', 'ember-runtime/mixins/array', 'ember-runtime/mixins/mutable_array', 'ember-runtime/mixins/observable', 'ember-runtime/mixins/copyable', 'ember-runtime/mixins/freezable', 'ember-runtime/copy'], function (exports, _emberMetal, _emberEnvironment, _emberRuntimeMixinsArray, _emberRuntimeMixinsMutable_array, _emberRuntimeMixinsObservable, _emberRuntimeMixinsCopyable, _emberRuntimeMixinsFreezable, _emberRuntimeCopy) {
  /**
  @module ember
  @submodule ember-runtime
  */
  'use strict';

  // Add Ember.Array to Array.prototype. Remove methods with native
  // implementations and supply some more optimized versions of generic methods
  // because they are so common.

  /**
    The NativeArray mixin contains the properties needed to make the native
    Array support Ember.MutableArray and all of its dependent APIs. Unless you
    have `EmberENV.EXTEND_PROTOTYPES` or `EmberENV.EXTEND_PROTOTYPES.Array` set to
    false, this will be applied automatically. Otherwise you can apply the mixin
    at anytime by calling `Ember.NativeArray.apply(Array.prototype)`.
  
    @class NativeArray
    @namespace Ember
    @uses Ember.MutableArray
    @uses Ember.Observable
    @uses Ember.Copyable
    @public
  */
  var NativeArray = _emberMetal.Mixin.create(_emberRuntimeMixinsMutable_array.default, _emberRuntimeMixinsObservable.default, _emberRuntimeMixinsCopyable.default, {

    // because length is a built-in property we need to know to just get the
    // original property.
    get: function (key) {
      if ('number' === typeof key) {
        return this[key];
      } else {
        return this._super(key);
      }
    },

    objectAt: function (idx) {
      return this[idx];
    },

    // primitive for array support.
    replace: function (idx, amt, objects) {
      if (this.isFrozen) {
        throw _emberRuntimeMixinsFreezable.FROZEN_ERROR;
      }

      // if we replaced exactly the same number of items, then pass only the
      // replaced range. Otherwise, pass the full remaining array length
      // since everything has shifted
      var len = objects ? _emberMetal.get(objects, 'length') : 0;
      _emberRuntimeMixinsArray.arrayContentWillChange(this, idx, amt, len);

      if (len === 0) {
        this.splice(idx, amt);
      } else {
        _emberMetal.replace(this, idx, amt, objects);
      }

      _emberRuntimeMixinsArray.arrayContentDidChange(this, idx, amt, len);
      return this;
    },

    // If you ask for an unknown property, then try to collect the value
    // from member items.
    unknownProperty: function (key, value) {
      var ret = undefined; // = this.reducedProperty(key, value);
      if (value !== undefined && ret === undefined) {
        ret = this[key] = value;
      }
      return ret;
    },

    indexOf: Array.prototype.indexOf,
    lastIndexOf: Array.prototype.lastIndexOf,

    copy: function (deep) {
      if (deep) {
        return this.map(function (item) {
          return _emberRuntimeCopy.default(item, true);
        });
      }

      return this.slice();
    }
  });

  // Remove any methods implemented natively so we don't override them
  var ignore = ['length'];
  NativeArray.keys().forEach(function (methodName) {
    if (Array.prototype[methodName]) {
      ignore.push(methodName);
    }
  });

  exports.NativeArray // TODO: only use default export
   = NativeArray = NativeArray.without.apply(NativeArray, ignore);

  /**
    Creates an `Ember.NativeArray` from an Array like object.
    Does not modify the original object. Ember.A is not needed if
    `EmberENV.EXTEND_PROTOTYPES` is `true` (the default value). However,
    it is recommended that you use Ember.A when creating addons for
    ember or when you can not guarantee that `EmberENV.EXTEND_PROTOTYPES`
    will be `true`.
  
    Example
  
    ```js
    export default Ember.Component.extend({
      tagName: 'ul',
      classNames: ['pagination'],
  
      init() {
        this._super(...arguments);
  
        if (!this.get('content')) {
          this.set('content', Ember.A());
        }
      }
    });
    ```
  
    @method A
    @for Ember
    @return {Ember.NativeArray}
    @public
  */
  var A = undefined;

  if (_emberEnvironment.ENV.EXTEND_PROTOTYPES.Array) {
    NativeArray.apply(Array.prototype);
    exports.A = A = function (arr) {
      return arr || [];
    };
  } else {
    exports.A = A = function (arr) {
      if (!arr) {
        arr = [];
      }
      return _emberRuntimeMixinsArray.default.detect(arr) ? arr : NativeArray.apply(arr);
    };
  }

  _emberMetal.default.A = A;
  exports.A = A;
  exports.NativeArray = NativeArray;
  exports.default = NativeArray;
});
// Ember.A circular
enifed('ember-runtime/system/object', ['exports', 'ember-utils', 'ember-metal', 'ember-runtime/system/core_object', 'ember-runtime/mixins/observable'], function (exports, _emberUtils, _emberMetal, _emberRuntimeSystemCore_object, _emberRuntimeMixinsObservable) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  /**
    `Ember.Object` is the main base class for all Ember objects. It is a subclass
    of `Ember.CoreObject` with the `Ember.Observable` mixin applied. For details,
    see the documentation for each of these.
  
    @class Object
    @namespace Ember
    @extends Ember.CoreObject
    @uses Ember.Observable
    @public
  */
  var EmberObject = _emberRuntimeSystemCore_object.default.extend(_emberRuntimeMixinsObservable.default);
  EmberObject.toString = function () {
    return 'Ember.Object';
  };

  var FrameworkObject = EmberObject;

  exports.FrameworkObject = FrameworkObject;
  _emberMetal.runInDebug(function () {
    var _EmberObject$extend;

    var INIT_WAS_CALLED = _emberUtils.symbol('INIT_WAS_CALLED');
    var ASSERT_INIT_WAS_CALLED = _emberUtils.symbol('ASSERT_INIT_WAS_CALLED');

    exports.FrameworkObject = FrameworkObject = EmberObject.extend((_EmberObject$extend = {
      init: function () {
        this._super.apply(this, arguments);
        this[INIT_WAS_CALLED] = true;
      }

    }, _EmberObject$extend[ASSERT_INIT_WAS_CALLED] = _emberMetal.on('init', function () {
      _emberMetal.assert('You must call `this._super(...arguments);` when overriding `init` on a framework object. Please update ' + this + ' to call `this._super(...arguments);` from `init`.', this[INIT_WAS_CALLED]);
    }), _EmberObject$extend));
  });

  exports.default = EmberObject;
});
enifed('ember-runtime/system/object_proxy', ['exports', 'ember-runtime/system/object', 'ember-runtime/mixins/-proxy'], function (exports, _emberRuntimeSystemObject, _emberRuntimeMixinsProxy) {
  'use strict';

  /**
    `Ember.ObjectProxy` forwards all properties not defined by the proxy itself
    to a proxied `content` object.
  
    ```javascript
    object = Ember.Object.create({
      name: 'Foo'
    });
  
    proxy = Ember.ObjectProxy.create({
      content: object
    });
  
    // Access and change existing properties
    proxy.get('name')          // 'Foo'
    proxy.set('name', 'Bar');
    object.get('name')         // 'Bar'
  
    // Create new 'description' property on `object`
    proxy.set('description', 'Foo is a whizboo baz');
    object.get('description')  // 'Foo is a whizboo baz'
    ```
  
    While `content` is unset, setting a property to be delegated will throw an
    Error.
  
    ```javascript
    proxy = Ember.ObjectProxy.create({
      content: null,
      flag: null
    });
    proxy.set('flag', true);
    proxy.get('flag');         // true
    proxy.get('foo');          // undefined
    proxy.set('foo', 'data');  // throws Error
    ```
  
    Delegated properties can be bound to and will change when content is updated.
  
    Computed properties on the proxy itself can depend on delegated properties.
  
    ```javascript
    ProxyWithComputedProperty = Ember.ObjectProxy.extend({
      fullName: Ember.computed('firstName', 'lastName', function() {
        var firstName = this.get('firstName'),
            lastName = this.get('lastName');
        if (firstName && lastName) {
          return firstName + ' ' + lastName;
        }
        return firstName || lastName;
      })
    });
  
    proxy = ProxyWithComputedProperty.create();
  
    proxy.get('fullName');  // undefined
    proxy.set('content', {
      firstName: 'Tom', lastName: 'Dale'
    }); // triggers property change for fullName on proxy
  
    proxy.get('fullName');  // 'Tom Dale'
    ```
  
    @class ObjectProxy
    @namespace Ember
    @extends Ember.Object
    @extends Ember._ProxyMixin
    @public
  */

  exports.default = _emberRuntimeSystemObject.default.extend(_emberRuntimeMixinsProxy.default);
});
enifed('ember-runtime/system/service', ['exports', 'ember-runtime/system/object', 'ember-runtime/inject'], function (exports, _emberRuntimeSystemObject, _emberRuntimeInject) {
  'use strict';

  /**
    Creates a property that lazily looks up a service in the container. There
    are no restrictions as to what objects a service can be injected into.
  
    Example:
  
    ```javascript
    App.ApplicationRoute = Ember.Route.extend({
      authManager: Ember.inject.service('auth'),
  
      model: function() {
        return this.get('authManager').findCurrentUser();
      }
    });
    ```
  
    This example will create an `authManager` property on the application route
    that looks up the `auth` service in the container, making it easily
    accessible in the `model` hook.
  
    @method service
    @since 1.10.0
    @for Ember.inject
    @param {String} name (optional) name of the service to inject, defaults to
           the property's name
    @return {Ember.InjectedProperty} injection descriptor instance
    @public
  */
  _emberRuntimeInject.createInjectionHelper('service');

  /**
    @class Service
    @namespace Ember
    @extends Ember.Object
    @since 1.10.0
    @public
  */
  var Service = _emberRuntimeSystemObject.default.extend();

  Service.reopenClass({
    isServiceFactory: true
  });

  exports.default = Service;
});
enifed('ember-runtime/system/string', ['exports', 'ember-metal', 'ember-utils', 'ember-runtime/utils', 'ember-runtime/string_registry'], function (exports, _emberMetal, _emberUtils, _emberRuntimeUtils, _emberRuntimeString_registry) {
  /**
  @module ember
  @submodule ember-runtime
  */
  'use strict';

  var STRING_DASHERIZE_REGEXP = /[ _]/g;

  var STRING_DASHERIZE_CACHE = new _emberMetal.Cache(1000, function (key) {
    return decamelize(key).replace(STRING_DASHERIZE_REGEXP, '-');
  });

  var STRING_CAMELIZE_REGEXP_1 = /(\-|\_|\.|\s)+(.)?/g;
  var STRING_CAMELIZE_REGEXP_2 = /(^|\/)([A-Z])/g;

  var CAMELIZE_CACHE = new _emberMetal.Cache(1000, function (key) {
    return key.replace(STRING_CAMELIZE_REGEXP_1, function (match, separator, chr) {
      return chr ? chr.toUpperCase() : '';
    }).replace(STRING_CAMELIZE_REGEXP_2, function (match, separator, chr) {
      return match.toLowerCase();
    });
  });

  var STRING_CLASSIFY_REGEXP_1 = /^(\-|_)+(.)?/;
  var STRING_CLASSIFY_REGEXP_2 = /(.)(\-|\_|\.|\s)+(.)?/g;
  var STRING_CLASSIFY_REGEXP_3 = /(^|\/|\.)([a-z])/g;

  var CLASSIFY_CACHE = new _emberMetal.Cache(1000, function (str) {
    var replace1 = function (match, separator, chr) {
      return chr ? '_' + chr.toUpperCase() : '';
    };
    var replace2 = function (match, initialChar, separator, chr) {
      return initialChar + (chr ? chr.toUpperCase() : '');
    };
    var parts = str.split('/');
    for (var i = 0; i < parts.length; i++) {
      parts[i] = parts[i].replace(STRING_CLASSIFY_REGEXP_1, replace1).replace(STRING_CLASSIFY_REGEXP_2, replace2);
    }
    return parts.join('/').replace(STRING_CLASSIFY_REGEXP_3, function (match, separator, chr) {
      return match.toUpperCase();
    });
  });

  var STRING_UNDERSCORE_REGEXP_1 = /([a-z\d])([A-Z]+)/g;
  var STRING_UNDERSCORE_REGEXP_2 = /\-|\s+/g;

  var UNDERSCORE_CACHE = new _emberMetal.Cache(1000, function (str) {
    return str.replace(STRING_UNDERSCORE_REGEXP_1, '$1_$2').replace(STRING_UNDERSCORE_REGEXP_2, '_').toLowerCase();
  });

  var STRING_CAPITALIZE_REGEXP = /(^|\/)([a-z])/g;

  var CAPITALIZE_CACHE = new _emberMetal.Cache(1000, function (str) {
    return str.replace(STRING_CAPITALIZE_REGEXP, function (match, separator, chr) {
      return match.toUpperCase();
    });
  });

  var STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;

  var DECAMELIZE_CACHE = new _emberMetal.Cache(1000, function (str) {
    return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
  });

  function _fmt(str, formats) {
    var cachedFormats = formats;

    if (!_emberRuntimeUtils.isArray(cachedFormats) || arguments.length > 2) {
      cachedFormats = new Array(arguments.length - 1);

      for (var i = 1; i < arguments.length; i++) {
        cachedFormats[i - 1] = arguments[i];
      }
    }

    // first, replace any ORDERED replacements.
    var idx = 0; // the current index for non-numerical replacements
    return str.replace(/%@([0-9]+)?/g, function (s, argIndex) {
      argIndex = argIndex ? parseInt(argIndex, 10) - 1 : idx++;
      s = cachedFormats[argIndex];
      return s === null ? '(null)' : s === undefined ? '' : _emberUtils.inspect(s);
    });
  }

  function fmt(str, formats) {
    _emberMetal.deprecate('Ember.String.fmt is deprecated, use ES6 template strings instead.', false, { id: 'ember-string-utils.fmt', until: '3.0.0', url: 'http://babeljs.io/docs/learn-es2015/#template-strings' });
    return _fmt.apply(undefined, arguments);
  }

  function loc(str, formats) {
    if (!_emberRuntimeUtils.isArray(formats) || arguments.length > 2) {
      formats = Array.prototype.slice.call(arguments, 1);
    }

    str = _emberRuntimeString_registry.get(str) || str;
    return _fmt(str, formats);
  }

  function w(str) {
    return str.split(/\s+/);
  }

  function decamelize(str) {
    return DECAMELIZE_CACHE.get(str);
  }

  function dasherize(str) {
    return STRING_DASHERIZE_CACHE.get(str);
  }

  function camelize(str) {
    return CAMELIZE_CACHE.get(str);
  }

  function classify(str) {
    return CLASSIFY_CACHE.get(str);
  }

  function underscore(str) {
    return UNDERSCORE_CACHE.get(str);
  }

  function capitalize(str) {
    return CAPITALIZE_CACHE.get(str);
  }

  /**
    Defines string helper methods including string formatting and localization.
    Unless `EmberENV.EXTEND_PROTOTYPES.String` is `false` these methods will also be
    added to the `String.prototype` as well.
  
    @class String
    @namespace Ember
    @static
    @public
  */
  exports.default = {
    /**
      Apply formatting options to the string. This will look for occurrences
      of "%@" in your string and substitute them with the arguments you pass into
      this method. If you want to control the specific order of replacement,
      you can add a number after the key as well to indicate which argument
      you want to insert.
       Ordered insertions are most useful when building loc strings where values
      you need to insert may appear in different orders.
       ```javascript
      "Hello %@ %@".fmt('John', 'Doe');     // "Hello John Doe"
      "Hello %@2, %@1".fmt('John', 'Doe');  // "Hello Doe, John"
      ```
       @method fmt
      @param {String} str The string to format
      @param {Array} formats An array of parameters to interpolate into string.
      @return {String} formatted string
      @public
      @deprecated Use ES6 template strings instead: http://babeljs.io/docs/learn-es2015/#template-strings
    */
    fmt: fmt,

    /**
      Formats the passed string, but first looks up the string in the localized
      strings hash. This is a convenient way to localize text. See
      `Ember.String.fmt()` for more information on formatting.
       Note that it is traditional but not required to prefix localized string
      keys with an underscore or other character so you can easily identify
      localized strings.
       ```javascript
      Ember.STRINGS = {
        '_Hello World': 'Bonjour le monde',
        '_Hello %@ %@': 'Bonjour %@ %@'
      };
       Ember.String.loc("_Hello World");  // 'Bonjour le monde';
      Ember.String.loc("_Hello %@ %@", ["John", "Smith"]);  // "Bonjour John Smith";
      ```
       @method loc
      @param {String} str The string to format
      @param {Array} formats Optional array of parameters to interpolate into string.
      @return {String} formatted string
      @public
    */
    loc: loc,

    /**
      Splits a string into separate units separated by spaces, eliminating any
      empty strings in the process. This is a convenience method for split that
      is mostly useful when applied to the `String.prototype`.
       ```javascript
      Ember.String.w("alpha beta gamma").forEach(function(key) {
        console.log(key);
      });
       // > alpha
      // > beta
      // > gamma
      ```
       @method w
      @param {String} str The string to split
      @return {Array} array containing the split strings
      @public
    */
    w: w,

    /**
      Converts a camelized string into all lower case separated by underscores.
       ```javascript
      'innerHTML'.decamelize();           // 'inner_html'
      'action_name'.decamelize();        // 'action_name'
      'css-class-name'.decamelize();     // 'css-class-name'
      'my favorite items'.decamelize();  // 'my favorite items'
      ```
       @method decamelize
      @param {String} str The string to decamelize.
      @return {String} the decamelized string.
      @public
    */
    decamelize: decamelize,

    /**
      Replaces underscores, spaces, or camelCase with dashes.
       ```javascript
      'innerHTML'.dasherize();          // 'inner-html'
      'action_name'.dasherize();        // 'action-name'
      'css-class-name'.dasherize();     // 'css-class-name'
      'my favorite items'.dasherize();  // 'my-favorite-items'
      'privateDocs/ownerInvoice'.dasherize(); // 'private-docs/owner-invoice'
      ```
       @method dasherize
      @param {String} str The string to dasherize.
      @return {String} the dasherized string.
      @public
    */
    dasherize: dasherize,

    /**
      Returns the lowerCamelCase form of a string.
       ```javascript
      'innerHTML'.camelize();          // 'innerHTML'
      'action_name'.camelize();        // 'actionName'
      'css-class-name'.camelize();     // 'cssClassName'
      'my favorite items'.camelize();  // 'myFavoriteItems'
      'My Favorite Items'.camelize();  // 'myFavoriteItems'
      'private-docs/owner-invoice'.camelize(); // 'privateDocs/ownerInvoice'
      ```
       @method camelize
      @param {String} str The string to camelize.
      @return {String} the camelized string.
      @public
    */
    camelize: camelize,

    /**
      Returns the UpperCamelCase form of a string.
       ```javascript
      'innerHTML'.classify();          // 'InnerHTML'
      'action_name'.classify();        // 'ActionName'
      'css-class-name'.classify();     // 'CssClassName'
      'my favorite items'.classify();  // 'MyFavoriteItems'
      'private-docs/owner-invoice'.classify(); // 'PrivateDocs/OwnerInvoice'
      ```
       @method classify
      @param {String} str the string to classify
      @return {String} the classified string
      @public
    */
    classify: classify,

    /**
      More general than decamelize. Returns the lower\_case\_and\_underscored
      form of a string.
       ```javascript
      'innerHTML'.underscore();          // 'inner_html'
      'action_name'.underscore();        // 'action_name'
      'css-class-name'.underscore();     // 'css_class_name'
      'my favorite items'.underscore();  // 'my_favorite_items'
      'privateDocs/ownerInvoice'.underscore(); // 'private_docs/owner_invoice'
      ```
       @method underscore
      @param {String} str The string to underscore.
      @return {String} the underscored string.
      @public
    */
    underscore: underscore,

    /**
      Returns the Capitalized form of a string
       ```javascript
      'innerHTML'.capitalize()         // 'InnerHTML'
      'action_name'.capitalize()       // 'Action_name'
      'css-class-name'.capitalize()    // 'Css-class-name'
      'my favorite items'.capitalize() // 'My favorite items'
      'privateDocs/ownerInvoice'.capitalize(); // 'PrivateDocs/ownerInvoice'
      ```
       @method capitalize
      @param {String} str The string to capitalize.
      @return {String} The capitalized string.
      @public
    */
    capitalize: capitalize
  };
  exports.fmt = fmt;
  exports.loc = loc;
  exports.w = w;
  exports.decamelize = decamelize;
  exports.dasherize = dasherize;
  exports.camelize = camelize;
  exports.classify = classify;
  exports.underscore = underscore;
  exports.capitalize = capitalize;
});
enifed('ember-runtime/utils', ['exports', 'ember-runtime/mixins/array', 'ember-runtime/system/object'], function (exports, _emberRuntimeMixinsArray, _emberRuntimeSystemObject) {
  'use strict';

  exports.isArray = isArray;
  exports.typeOf = typeOf;

  // ........................................
  // TYPING & ARRAY MESSAGING
  //
  var TYPE_MAP = {
    '[object Boolean]': 'boolean',
    '[object Number]': 'number',
    '[object String]': 'string',
    '[object Function]': 'function',
    '[object Array]': 'array',
    '[object Date]': 'date',
    '[object RegExp]': 'regexp',
    '[object Object]': 'object',
    '[object FileList]': 'filelist'
  };

  var toString = Object.prototype.toString;

  /**
    Returns true if the passed object is an array or Array-like.
  
    Objects are considered Array-like if any of the following are true:
  
      - the object is a native Array
      - the object has an objectAt property
      - the object is an Object, and has a length property
  
    Unlike `Ember.typeOf` this method returns true even if the passed object is
    not formally an array but appears to be array-like (i.e. implements `Ember.Array`)
  
    ```javascript
    Ember.isArray();                                          // false
    Ember.isArray([]);                                        // true
    Ember.isArray(Ember.ArrayProxy.create({ content: [] }));  // true
    ```
  
    @method isArray
    @for Ember
    @param {Object} obj The object to test
    @return {Boolean} true if the passed object is an array or Array-like
    @public
  */

  function isArray(obj) {
    if (!obj || obj.setInterval) {
      return false;
    }
    if (Array.isArray(obj)) {
      return true;
    }
    if (_emberRuntimeMixinsArray.default.detect(obj)) {
      return true;
    }

    var type = typeOf(obj);
    if ('array' === type) {
      return true;
    }
    if (obj.length !== undefined && 'object' === type) {
      return true;
    }
    return false;
  }

  /**
    Returns a consistent type for the passed object.
  
    Use this instead of the built-in `typeof` to get the type of an item.
    It will return the same result across all browsers and includes a bit
    more detail. Here is what will be returned:
  
        | Return Value  | Meaning                                              |
        |---------------|------------------------------------------------------|
        | 'string'      | String primitive or String object.                   |
        | 'number'      | Number primitive or Number object.                   |
        | 'boolean'     | Boolean primitive or Boolean object.                 |
        | 'null'        | Null value                                           |
        | 'undefined'   | Undefined value                                      |
        | 'function'    | A function                                           |
        | 'array'       | An instance of Array                                 |
        | 'regexp'      | An instance of RegExp                                |
        | 'date'        | An instance of Date                                  |
        | 'filelist'    | An instance of FileList                              |
        | 'class'       | An Ember class (created using Ember.Object.extend()) |
        | 'instance'    | An Ember object instance                             |
        | 'error'       | An instance of the Error object                      |
        | 'object'      | A JavaScript object not inheriting from Ember.Object |
  
    Examples:
  
    ```javascript
    Ember.typeOf();                       // 'undefined'
    Ember.typeOf(null);                   // 'null'
    Ember.typeOf(undefined);              // 'undefined'
    Ember.typeOf('michael');              // 'string'
    Ember.typeOf(new String('michael'));  // 'string'
    Ember.typeOf(101);                    // 'number'
    Ember.typeOf(new Number(101));        // 'number'
    Ember.typeOf(true);                   // 'boolean'
    Ember.typeOf(new Boolean(true));      // 'boolean'
    Ember.typeOf(Ember.makeArray);        // 'function'
    Ember.typeOf([1, 2, 90]);             // 'array'
    Ember.typeOf(/abc/);                  // 'regexp'
    Ember.typeOf(new Date());             // 'date'
    Ember.typeOf(event.target.files);     // 'filelist'
    Ember.typeOf(Ember.Object.extend());  // 'class'
    Ember.typeOf(Ember.Object.create());  // 'instance'
    Ember.typeOf(new Error('teamocil'));  // 'error'
  
    // 'normal' JavaScript object
    Ember.typeOf({ a: 'b' });             // 'object'
    ```
  
    @method typeOf
    @for Ember
    @param {Object} item the item to check
    @return {String} the type
    @public
  */

  function typeOf(item) {
    if (item === null) {
      return 'null';
    }
    if (item === undefined) {
      return 'undefined';
    }
    var ret = TYPE_MAP[toString.call(item)] || 'object';

    if (ret === 'function') {
      if (_emberRuntimeSystemObject.default.detect(item)) {
        ret = 'class';
      }
    } else if (ret === 'object') {
      if (item instanceof Error) {
        ret = 'error';
      } else if (item instanceof _emberRuntimeSystemObject.default) {
        ret = 'instance';
      } else if (item instanceof Date) {
        ret = 'date';
      }
    }

    return ret;
  }
});
enifed("ember/features", ["exports"], function (exports) {
  "use strict";

  exports.default = { "features-stripped-test": false, "ember-libraries-isregistered": false, "ember-runtime-computed-uniq-by": true, "ember-improved-instrumentation": false, "ember-runtime-enumerable-includes": true, "ember-string-ishtmlsafe": true, "ember-testing-check-waiters": true, "ember-metal-weakmap": false, "ember-glimmer-allow-backtracking-rerender": true, "ember-testing-resume-test": false, "ember-glimmer-detect-backtracking-rerender": true, "mandatory-setter": true };
});
enifed("ember/version", ["exports"], function (exports) {
  "use strict";

  exports.default = "2.10.2-with-backtracking";
});
/*!
 * @overview RSVP - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/tildeio/rsvp.js/master/LICENSE
 * @version   3.2.1
 */

enifed('rsvp', ['exports'], function (exports) { 'use strict';

function indexOf(callbacks, callback) {
  for (var i=0, l=callbacks.length; i<l; i++) {
    if (callbacks[i] === callback) { return i; }
  }

  return -1;
}

function callbacksFor(object) {
  var callbacks = object._promiseCallbacks;

  if (!callbacks) {
    callbacks = object._promiseCallbacks = {};
  }

  return callbacks;
}

/**
  @class RSVP.EventTarget
*/
var EventTarget = {

  /**
    `RSVP.EventTarget.mixin` extends an object with EventTarget methods. For
    Example:

    ```javascript
    var object = {};

    RSVP.EventTarget.mixin(object);

    object.on('finished', function(event) {
      // handle event
    });

    object.trigger('finished', { detail: value });
    ```

    `EventTarget.mixin` also works with prototypes:

    ```javascript
    var Person = function() {};
    RSVP.EventTarget.mixin(Person.prototype);

    var yehuda = new Person();
    var tom = new Person();

    yehuda.on('poke', function(event) {
      console.log('Yehuda says OW');
    });

    tom.on('poke', function(event) {
      console.log('Tom says OW');
    });

    yehuda.trigger('poke');
    tom.trigger('poke');
    ```

    @method mixin
    @for RSVP.EventTarget
    @private
    @param {Object} object object to extend with EventTarget methods
  */
  'mixin': function(object) {
    object['on']      = this['on'];
    object['off']     = this['off'];
    object['trigger'] = this['trigger'];
    object._promiseCallbacks = undefined;
    return object;
  },

  /**
    Registers a callback to be executed when `eventName` is triggered

    ```javascript
    object.on('event', function(eventInfo){
      // handle the event
    });

    object.trigger('event');
    ```

    @method on
    @for RSVP.EventTarget
    @private
    @param {String} eventName name of the event to listen for
    @param {Function} callback function to be called when the event is triggered.
  */
  'on': function(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    var allCallbacks = callbacksFor(this), callbacks;

    callbacks = allCallbacks[eventName];

    if (!callbacks) {
      callbacks = allCallbacks[eventName] = [];
    }

    if (indexOf(callbacks, callback) === -1) {
      callbacks.push(callback);
    }
  },

  /**
    You can use `off` to stop firing a particular callback for an event:

    ```javascript
    function doStuff() { // do stuff! }
    object.on('stuff', doStuff);

    object.trigger('stuff'); // doStuff will be called

    // Unregister ONLY the doStuff callback
    object.off('stuff', doStuff);
    object.trigger('stuff'); // doStuff will NOT be called
    ```

    If you don't pass a `callback` argument to `off`, ALL callbacks for the
    event will not be executed when the event fires. For example:

    ```javascript
    var callback1 = function(){};
    var callback2 = function(){};

    object.on('stuff', callback1);
    object.on('stuff', callback2);

    object.trigger('stuff'); // callback1 and callback2 will be executed.

    object.off('stuff');
    object.trigger('stuff'); // callback1 and callback2 will not be executed!
    ```

    @method off
    @for RSVP.EventTarget
    @private
    @param {String} eventName event to stop listening to
    @param {Function} callback optional argument. If given, only the function
    given will be removed from the event's callback queue. If no `callback`
    argument is given, all callbacks will be removed from the event's callback
    queue.
  */
  'off': function(eventName, callback) {
    var allCallbacks = callbacksFor(this), callbacks, index;

    if (!callback) {
      allCallbacks[eventName] = [];
      return;
    }

    callbacks = allCallbacks[eventName];

    index = indexOf(callbacks, callback);

    if (index !== -1) { callbacks.splice(index, 1); }
  },

  /**
    Use `trigger` to fire custom events. For example:

    ```javascript
    object.on('foo', function(){
      console.log('foo event happened!');
    });
    object.trigger('foo');
    // 'foo event happened!' logged to the console
    ```

    You can also pass a value as a second argument to `trigger` that will be
    passed as an argument to all event listeners for the event:

    ```javascript
    object.on('foo', function(value){
      console.log(value.name);
    });

    object.trigger('foo', { name: 'bar' });
    // 'bar' logged to the console
    ```

    @method trigger
    @for RSVP.EventTarget
    @private
    @param {String} eventName name of the event to be triggered
    @param {*} options optional value to be passed to any event handlers for
    the given `eventName`
  */
  'trigger': function(eventName, options, label) {
    var allCallbacks = callbacksFor(this), callbacks, callback;

    if (callbacks = allCallbacks[eventName]) {
      // Don't cache the callbacks.length since it may grow
      for (var i=0; i<callbacks.length; i++) {
        callback = callbacks[i];

        callback(options, label);
      }
    }
  }
};

var config = {
  instrument: false
};

EventTarget['mixin'](config);

function configure(name, value) {
  if (name === 'onerror') {
    // handle for legacy users that expect the actual
    // error to be passed to their function added via
    // `RSVP.configure('onerror', someFunctionHere);`
    config['on']('error', value);
    return;
  }

  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}

function objectOrFunction(x) {
  return typeof x === 'function' || (typeof x === 'object' && x !== null);
}

function isFunction(x) {
  return typeof x === 'function';
}

function isMaybeThenable(x) {
  return typeof x === 'object' && x !== null;
}

var _isArray;
if (!Array.isArray) {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
} else {
  _isArray = Array.isArray;
}

var isArray = _isArray;

// Date.now is not available in browsers < IE9
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
var now = Date.now || function() { return new Date().getTime(); };

function F() { }

var o_create = (Object.create || function (o) {
  if (arguments.length > 1) {
    throw new Error('Second argument not supported');
  }
  if (typeof o !== 'object') {
    throw new TypeError('Argument must be an object');
  }
  F.prototype = o;
  return new F();
});

var queue = [];

function scheduleFlush() {
  setTimeout(function() {
    var entry;
    for (var i = 0; i < queue.length; i++) {
      entry = queue[i];

      var payload = entry.payload;

      payload.guid = payload.key + payload.id;
      payload.childGuid = payload.key + payload.childId;
      if (payload.error) {
        payload.stack = payload.error.stack;
      }

      config['trigger'](entry.name, entry.payload);
    }
    queue.length = 0;
  }, 50);
}

function instrument(eventName, promise, child) {
  if (1 === queue.push({
    name: eventName,
    payload: {
      key: promise._guidKey,
      id:  promise._id,
      eventName: eventName,
      detail: promise._result,
      childId: child && child._id,
      label: promise._label,
      timeStamp: now(),
      error: config["instrument-with-stack"] ? new Error(promise._label) : null
    }})) {
      scheduleFlush();
    }
  }

/**
  `RSVP.Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {*} object value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object, label) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop, label);
  resolve(promise, object);
  return promise;
}

function  withOwnPromise() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function noop() {}

var PENDING   = void 0;
var FULFILLED = 1;
var REJECTED  = 2;

var GET_THEN_ERROR = new ErrorObject();

function getThen(promise) {
  try {
    return promise.then;
  } catch(error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then, value, fulfillmentHandler, rejectionHandler) {
  try {
    then.call(value, fulfillmentHandler, rejectionHandler);
  } catch(e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then) {
  config.async(function(promise) {
    var sealed = false;
    var error = tryThen(then, thenable, function(value) {
      if (sealed) { return; }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value, undefined);
      } else {
        fulfill(promise, value);
      }
    }, function(reason) {
      if (sealed) { return; }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    thenable._onError = null;
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function(value) {
      if (thenable !== value) {
        resolve(promise, value, undefined);
      } else {
        fulfill(promise, value);
      }
    }, function(reason) {
      reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$) {
  if (maybeThenable.constructor === promise.constructor &&
      then$$ === then &&
      constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$ === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
    } else if (then$$ === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$)) {
      handleForeignThenable(promise, maybeThenable, then$$);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onError) {
    promise._onError(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) { return; }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length === 0) {
    if (config.instrument) {
      instrument('fulfilled', promise);
    }
  } else {
    config.async(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) { return; }
  promise._state = REJECTED;
  promise._result = reason;
  config.async(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  parent._onError = null;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED]  = onRejection;

  if (length === 0 && parent._state) {
    config.async(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (config.instrument) {
    instrument(settled === FULFILLED ? 'fulfilled' : 'rejected', promise);
  }

  if (subscribers.length === 0) { return; }

  var child, callback, detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch(e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value, error, succeeded, failed;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, withOwnPromise());
      return;
    }

  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    fulfill(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

function initializePromise(promise, resolver) {
  var resolved = false;
  try {
    resolver(function resolvePromise(value){
      if (resolved) { return; }
      resolved = true;
      resolve(promise, value);
    }, function rejectPromise(reason) {
      if (resolved) { return; }
      resolved = true;
      reject(promise, reason);
    });
  } catch(e) {
    reject(promise, e);
  }
}

function then(onFulfillment, onRejection, label) {
  var parent = this;
  var state = parent._state;

  if (state === FULFILLED && !onFulfillment || state === REJECTED && !onRejection) {
    config.instrument && instrument('chained', parent, parent);
    return parent;
  }

  parent._onError = null;

  var child = new parent.constructor(noop, label);
  var result = parent._result;

  config.instrument && instrument('chained', parent, child);

  if (state) {
    var callback = arguments[state - 1];
    config.async(function(){
      invokeCallback(state, child, callback, result);
    });
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

function makeSettledResult(state, position, value) {
  if (state === FULFILLED) {
    return {
      state: 'fulfilled',
      value: value
    };
  } else {
     return {
      state: 'rejected',
      reason: value
    };
  }
}

function Enumerator(Constructor, input, abortOnReject, label) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop, label);
  this._abortOnReject = abortOnReject;

  if (this._validateInput(input)) {
    this._input     = input;
    this.length     = input.length;
    this._remaining = input.length;

    this._init();

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate();
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, this._validationError());
  }
}

Enumerator.prototype._validateInput = function(input) {
  return isArray(input);
};

Enumerator.prototype._validationError = function() {
  return new Error('Array Methods must be provided an Array');
};

Enumerator.prototype._init = function() {
  this._result = new Array(this.length);
};

Enumerator.prototype._enumerate = function() {
  var length     = this.length;
  var promise    = this.promise;
  var input      = this._input;

  for (var i = 0; promise._state === PENDING && i < length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator.prototype._settleMaybeThenable = function(entry, i) {
  var c = this._instanceConstructor;
  var resolve = c.resolve;

  if (resolve === resolve$1) {
    var then$$ = getThen(entry);

    if (then$$ === then &&
        entry._state !== PENDING) {
      entry._onError = null;
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof then$$ !== 'function') {
      this._remaining--;
      this._result[i] = this._makeResult(FULFILLED, i, entry);
    } else if (c === Promise) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, then$$);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function(resolve) { resolve(entry); }), i);
    }
  } else {
    this._willSettleAt(resolve(entry), i);
  }
};

Enumerator.prototype._eachEntry = function(entry, i) {
  if (isMaybeThenable(entry)) {
    this._settleMaybeThenable(entry, i);
  } else {
    this._remaining--;
    this._result[i] = this._makeResult(FULFILLED, i, entry);
  }
};

Enumerator.prototype._settledAt = function(state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (this._abortOnReject && state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = this._makeResult(state, i, value);
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator.prototype._makeResult = function(state, i, value) {
  return value;
};

Enumerator.prototype._willSettleAt = function(promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function(value) {
    enumerator._settledAt(FULFILLED, i, value);
  }, function(reason) {
    enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `RSVP.Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);
  var promises = [ promise1, promise2, promise3 ];

  RSVP.Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `RSVP.all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error("2"));
  var promise3 = RSVP.reject(new Error("3"));
  var promises = [ promise1, promise2, promise3 ];

  RSVP.Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries, label) {
  return new Enumerator(this, entries, true /* abort on reject */, label).promise;
}

/**
  `RSVP.Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  RSVP.Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `RSVP.Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  RSVP.Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  RSVP.Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} entries array of promises to observe
  @param {String} label optional string for describing the promise returned.
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries, label) {
  /*jshint validthis:true */
  var Constructor = this;

  var promise = new Constructor(noop, label);

  if (!isArray(entries)) {
    reject(promise, new TypeError('You must pass an array to race.'));
    return promise;
  }

  var length = entries.length;

  function onFulfillment(value) {
    resolve(promise, value);
  }

  function onRejection(reason) {
    reject(promise, reason);
  }

  for (var i = 0; promise._state === PENDING && i < length; i++) {
    subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
  }

  return promise;
}

/**
  `RSVP.Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {*} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason, label) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop, label);
  reject(promise, reason);
  return promise;
}

var guidKey = 'rsvp_' + now() + '-';
var counter = 0;

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise’s eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  var promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      var xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class RSVP.Promise
  @param {function} resolver
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @constructor
*/
function Promise(resolver, label) {
  this._id = counter++;
  this._label = label;
  this._state = undefined;
  this._result = undefined;
  this._subscribers = [];

  config.instrument && instrument('created', this);

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise ? initializePromise(this, resolver) : needsNew();
  }
}

Promise.cast = resolve$1; // deprecated
Promise.all = all;
Promise.race = race;
Promise.resolve = resolve$1;
Promise.reject = reject$1;

Promise.prototype = {
  constructor: Promise,

  _guidKey: guidKey,

  _onError: function (reason) {
    var promise = this;
    config.after(function() {
      if (promise._onError) {
        config['trigger']('error', reason, promise._label);
      }
    });
  },

/**
  The primary way of interacting with a promise is through its `then` method,
  which registers callbacks to receive either a promise's eventual value or the
  reason why the promise cannot be fulfilled.

  ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```

  Chaining
  --------

  The return value of `then` is itself a promise.  This second, 'downstream'
  promise is resolved with the return value of the first promise's fulfillment
  or rejection handler, or rejected if the handler throws an exception.

  ```js
  findUser().then(function (user) {
    return user.name;
  }, function (reason) {
    return 'default name';
  }).then(function (userName) {
    // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
    // will be `'default name'`
  });

  findUser().then(function (user) {
    throw new Error('Found user, but still unhappy');
  }, function (reason) {
    throw new Error('`findUser` rejected and we're unhappy');
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
    // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
  });
  ```
  If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

  ```js
  findUser().then(function (user) {
    throw new PedagogicalException('Upstream error');
  }).then(function (value) {
    // never reached
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // The `PedgagocialException` is propagated all the way down to here
  });
  ```

  Assimilation
  ------------

  Sometimes the value you want to propagate to a downstream promise can only be
  retrieved asynchronously. This can be achieved by returning a promise in the
  fulfillment or rejection handler. The downstream promise will then be pending
  until the returned promise is settled. This is called *assimilation*.

  ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // The user's comments are now available
  });
  ```

  If the assimliated promise rejects, then the downstream promise will also reject.

  ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // If `findCommentsByAuthor` fulfills, we'll have the value here
  }, function (reason) {
    // If `findCommentsByAuthor` rejects, we'll have the reason here
  });
  ```

  Simple Example
  --------------

  Synchronous Example

  ```javascript
  var result;

  try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```

  Promise Example;

  ```javascript
  findResult().then(function(result){
    // success
  }, function(reason){
    // failure
  });
  ```

  Advanced Example
  --------------

  Synchronous Example

  ```javascript
  var author, books;

  try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  ```js

  function foundBooks(books) {

  }

  function failure(reason) {

  }

  findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```

  Promise Example;

  ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong
  });
  ```

  @method then
  @param {Function} onFulfillment
  @param {Function} onRejection
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
  then: then,

/**
  `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
  as the catch block of a try/catch statement.

  ```js
  function findAuthor(){
    throw new Error('couldn't find that author');
  }

  // synchronous
  try {
    findAuthor();
  } catch(reason) {
    // something went wrong
  }

  // async with promises
  findAuthor().catch(function(reason){
    // something went wrong
  });
  ```

  @method catch
  @param {Function} onRejection
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
  'catch': function(onRejection, label) {
    return this.then(undefined, onRejection, label);
  },

/**
  `finally` will be invoked regardless of the promise's fate just as native
  try/catch/finally behaves

  Synchronous example:

  ```js
  findAuthor() {
    if (Math.random() > 0.5) {
      throw new Error();
    }
    return new Author();
  }

  try {
    return findAuthor(); // succeed or fail
  } catch(error) {
    return findOtherAuther();
  } finally {
    // always runs
    // doesn't affect the return value
  }
  ```

  Asynchronous example:

  ```js
  findAuthor().catch(function(reason){
    return findOtherAuther();
  }).finally(function(){
    // author was either found, or not
  });
  ```

  @method finally
  @param {Function} callback
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
  'finally': function(callback, label) {
    var promise = this;
    var constructor = promise.constructor;

    return promise.then(function(value) {
      return constructor.resolve(callback()).then(function() {
        return value;
      });
    }, function(reason) {
      return constructor.resolve(callback()).then(function() {
        return constructor.reject(reason);
      });
    }, label);
  }
};

function Result() {
  this.value = undefined;
}

var ERROR = new Result();
var GET_THEN_ERROR$1 = new Result();

function getThen$1(obj) {
  try {
   return obj.then;
  } catch(error) {
    ERROR.value= error;
    return ERROR;
  }
}


function tryApply(f, s, a) {
  try {
    f.apply(s, a);
  } catch(error) {
    ERROR.value = error;
    return ERROR;
  }
}

function makeObject(_, argumentNames) {
  var obj = {};
  var name;
  var i;
  var length = _.length;
  var args = new Array(length);

  for (var x = 0; x < length; x++) {
    args[x] = _[x];
  }

  for (i = 0; i < argumentNames.length; i++) {
    name = argumentNames[i];
    obj[name] = args[i + 1];
  }

  return obj;
}

function arrayResult(_) {
  var length = _.length;
  var args = new Array(length - 1);

  for (var i = 1; i < length; i++) {
    args[i - 1] = _[i];
  }

  return args;
}

function wrapThenable(then, promise) {
  return {
    then: function(onFulFillment, onRejection) {
      return then.call(promise, onFulFillment, onRejection);
    }
  };
}

/**
  `RSVP.denodeify` takes a 'node-style' function and returns a function that
  will return an `RSVP.Promise`. You can use `denodeify` in Node.js or the
  browser when you'd prefer to use promises over using callbacks. For example,
  `denodeify` transforms the following:

  ```javascript
  var fs = require('fs');

  fs.readFile('myfile.txt', function(err, data){
    if (err) return handleError(err);
    handleData(data);
  });
  ```

  into:

  ```javascript
  var fs = require('fs');
  var readFile = RSVP.denodeify(fs.readFile);

  readFile('myfile.txt').then(handleData, handleError);
  ```

  If the node function has multiple success parameters, then `denodeify`
  just returns the first one:

  ```javascript
  var request = RSVP.denodeify(require('request'));

  request('http://example.com').then(function(res) {
    // ...
  });
  ```

  However, if you need all success parameters, setting `denodeify`'s
  second parameter to `true` causes it to return all success parameters
  as an array:

  ```javascript
  var request = RSVP.denodeify(require('request'), true);

  request('http://example.com').then(function(result) {
    // result[0] -> res
    // result[1] -> body
  });
  ```

  Or if you pass it an array with names it returns the parameters as a hash:

  ```javascript
  var request = RSVP.denodeify(require('request'), ['res', 'body']);

  request('http://example.com').then(function(result) {
    // result.res
    // result.body
  });
  ```

  Sometimes you need to retain the `this`:

  ```javascript
  var app = require('express')();
  var render = RSVP.denodeify(app.render.bind(app));
  ```

  The denodified function inherits from the original function. It works in all
  environments, except IE 10 and below. Consequently all properties of the original
  function are available to you. However, any properties you change on the
  denodeified function won't be changed on the original function. Example:

  ```javascript
  var request = RSVP.denodeify(require('request')),
      cookieJar = request.jar(); // <- Inheritance is used here

  request('http://example.com', {jar: cookieJar}).then(function(res) {
    // cookieJar.cookies holds now the cookies returned by example.com
  });
  ```

  Using `denodeify` makes it easier to compose asynchronous operations instead
  of using callbacks. For example, instead of:

  ```javascript
  var fs = require('fs');

  fs.readFile('myfile.txt', function(err, data){
    if (err) { ... } // Handle error
    fs.writeFile('myfile2.txt', data, function(err){
      if (err) { ... } // Handle error
      console.log('done')
    });
  });
  ```

  you can chain the operations together using `then` from the returned promise:

  ```javascript
  var fs = require('fs');
  var readFile = RSVP.denodeify(fs.readFile);
  var writeFile = RSVP.denodeify(fs.writeFile);

  readFile('myfile.txt').then(function(data){
    return writeFile('myfile2.txt', data);
  }).then(function(){
    console.log('done')
  }).catch(function(error){
    // Handle error
  });
  ```

  @method denodeify
  @static
  @for RSVP
  @param {Function} nodeFunc a 'node-style' function that takes a callback as
  its last argument. The callback expects an error to be passed as its first
  argument (if an error occurred, otherwise null), and the value from the
  operation as its second argument ('function(err, value){ }').
  @param {Boolean|Array} [options] An optional paramter that if set
  to `true` causes the promise to fulfill with the callback's success arguments
  as an array. This is useful if the node function has multiple success
  paramters. If you set this paramter to an array with names, the promise will
  fulfill with a hash with these names as keys and the success parameters as
  values.
  @return {Function} a function that wraps `nodeFunc` to return an
  `RSVP.Promise`
  @static
*/
function denodeify(nodeFunc, options) {
  var fn = function() {
    var self = this;
    var l = arguments.length;
    var args = new Array(l + 1);
    var arg;
    var promiseInput = false;

    for (var i = 0; i < l; ++i) {
      arg = arguments[i];

      if (!promiseInput) {
        // TODO: clean this up
        promiseInput = needsPromiseInput(arg);
        if (promiseInput === GET_THEN_ERROR$1) {
          var p = new Promise(noop);
          reject(p, GET_THEN_ERROR$1.value);
          return p;
        } else if (promiseInput && promiseInput !== true) {
          arg = wrapThenable(promiseInput, arg);
        }
      }
      args[i] = arg;
    }

    var promise = new Promise(noop);

    args[l] = function(err, val) {
      if (err)
        reject(promise, err);
      else if (options === undefined)
        resolve(promise, val);
      else if (options === true)
        resolve(promise, arrayResult(arguments));
      else if (isArray(options))
        resolve(promise, makeObject(arguments, options));
      else
        resolve(promise, val);
    };

    if (promiseInput) {
      return handlePromiseInput(promise, args, nodeFunc, self);
    } else {
      return handleValueInput(promise, args, nodeFunc, self);
    }
  };

  fn.__proto__ = nodeFunc;

  return fn;
}

function handleValueInput(promise, args, nodeFunc, self) {
  var result = tryApply(nodeFunc, self, args);
  if (result === ERROR) {
    reject(promise, result.value);
  }
  return promise;
}

function handlePromiseInput(promise, args, nodeFunc, self){
  return Promise.all(args).then(function(args){
    var result = tryApply(nodeFunc, self, args);
    if (result === ERROR) {
      reject(promise, result.value);
    }
    return promise;
  });
}

function needsPromiseInput(arg) {
  if (arg && typeof arg === 'object') {
    if (arg.constructor === Promise) {
      return true;
    } else {
      return getThen$1(arg);
    }
  } else {
    return false;
  }
}

/**
  This is a convenient alias for `RSVP.Promise.all`.

  @method all
  @static
  @for RSVP
  @param {Array} array Array of promises.
  @param {String} label An optional label. This is useful
  for tooling.
*/
function all$1(array, label) {
  return Promise.all(array, label);
}

function AllSettled(Constructor, entries, label) {
  this._superConstructor(Constructor, entries, false /* don't abort on reject */, label);
}

AllSettled.prototype = o_create(Enumerator.prototype);
AllSettled.prototype._superConstructor = Enumerator;
AllSettled.prototype._makeResult = makeSettledResult;
AllSettled.prototype._validationError = function() {
  return new Error('allSettled must be called with an array');
};

/**
  `RSVP.allSettled` is similar to `RSVP.all`, but instead of implementing
  a fail-fast method, it waits until all the promises have returned and
  shows you all the results. This is useful if you want to handle multiple
  promises' failure states together as a set.

  Returns a promise that is fulfilled when all the given promises have been
  settled. The return promise is fulfilled with an array of the states of
  the promises passed into the `promises` array argument.

  Each state object will either indicate fulfillment or rejection, and
  provide the corresponding value or reason. The states will take one of
  the following formats:

  ```javascript
  { state: 'fulfilled', value: value }
    or
  { state: 'rejected', reason: reason }
  ```

  Example:

  ```javascript
  var promise1 = RSVP.Promise.resolve(1);
  var promise2 = RSVP.Promise.reject(new Error('2'));
  var promise3 = RSVP.Promise.reject(new Error('3'));
  var promises = [ promise1, promise2, promise3 ];

  RSVP.allSettled(promises).then(function(array){
    // array == [
    //   { state: 'fulfilled', value: 1 },
    //   { state: 'rejected', reason: Error },
    //   { state: 'rejected', reason: Error }
    // ]
    // Note that for the second item, reason.message will be '2', and for the
    // third item, reason.message will be '3'.
  }, function(error) {
    // Not run. (This block would only be called if allSettled had failed,
    // for instance if passed an incorrect argument type.)
  });
  ```

  @method allSettled
  @static
  @for RSVP
  @param {Array} entries
  @param {String} label - optional string that describes the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled with an array of the settled
  states of the constituent promises.
*/

function allSettled(entries, label) {
  return new AllSettled(Promise, entries, label).promise;
}

/**
  This is a convenient alias for `RSVP.Promise.race`.

  @method race
  @static
  @for RSVP
  @param {Array} array Array of promises.
  @param {String} label An optional label. This is useful
  for tooling.
 */
function race$1(array, label) {
  return Promise.race(array, label);
}

function PromiseHash(Constructor, object, label) {
  this._superConstructor(Constructor, object, true, label);
}

PromiseHash.prototype = o_create(Enumerator.prototype);
PromiseHash.prototype._superConstructor = Enumerator;
PromiseHash.prototype._init = function() {
  this._result = {};
};

PromiseHash.prototype._validateInput = function(input) {
  return input && typeof input === 'object';
};

PromiseHash.prototype._validationError = function() {
  return new Error('Promise.hash must be called with an object');
};

PromiseHash.prototype._enumerate = function() {
  var enumerator = this;
  var promise    = enumerator.promise;
  var input      = enumerator._input;
  var results    = [];

  for (var key in input) {
    if (promise._state === PENDING && Object.prototype.hasOwnProperty.call(input, key)) {
      results.push({
        position: key,
        entry: input[key]
      });
    }
  }

  var length = results.length;
  enumerator._remaining = length;
  var result;

  for (var i = 0; promise._state === PENDING && i < length; i++) {
    result = results[i];
    enumerator._eachEntry(result.entry, result.position);
  }
};

/**
  `RSVP.hash` is similar to `RSVP.all`, but takes an object instead of an array
  for its `promises` argument.

  Returns a promise that is fulfilled when all the given promises have been
  fulfilled, or rejected if any of them become rejected. The returned promise
  is fulfilled with a hash that has the same key names as the `promises` object
  argument. If any of the values in the object are not promises, they will
  simply be copied over to the fulfilled object.

  Example:

  ```javascript
  var promises = {
    myPromise: RSVP.resolve(1),
    yourPromise: RSVP.resolve(2),
    theirPromise: RSVP.resolve(3),
    notAPromise: 4
  };

  RSVP.hash(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise: 1,
    //   yourPromise: 2,
    //   theirPromise: 3,
    //   notAPromise: 4
    // }
  });
  ````

  If any of the `promises` given to `RSVP.hash` are rejected, the first promise
  that is rejected will be given as the reason to the rejection handler.

  Example:

  ```javascript
  var promises = {
    myPromise: RSVP.resolve(1),
    rejectedPromise: RSVP.reject(new Error('rejectedPromise')),
    anotherRejectedPromise: RSVP.reject(new Error('anotherRejectedPromise')),
  };

  RSVP.hash(promises).then(function(hash){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === 'rejectedPromise'
  });
  ```

  An important note: `RSVP.hash` is intended for plain JavaScript objects that
  are just a set of keys and values. `RSVP.hash` will NOT preserve prototype
  chains.

  Example:

  ```javascript
  function MyConstructor(){
    this.example = RSVP.resolve('Example');
  }

  MyConstructor.prototype = {
    protoProperty: RSVP.resolve('Proto Property')
  };

  var myObject = new MyConstructor();

  RSVP.hash(myObject).then(function(hash){
    // protoProperty will not be present, instead you will just have an
    // object that looks like:
    // {
    //   example: 'Example'
    // }
    //
    // hash.hasOwnProperty('protoProperty'); // false
    // 'undefined' === typeof hash.protoProperty
  });
  ```

  @method hash
  @static
  @for RSVP
  @param {Object} object
  @param {String} label optional string that describes the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all properties of `promises`
  have been fulfilled, or rejected if any of them become rejected.
*/
function hash(object, label) {
  return new PromiseHash(Promise, object, label).promise;
}

function HashSettled(Constructor, object, label) {
  this._superConstructor(Constructor, object, false, label);
}

HashSettled.prototype = o_create(PromiseHash.prototype);
HashSettled.prototype._superConstructor = Enumerator;
HashSettled.prototype._makeResult = makeSettledResult;

HashSettled.prototype._validationError = function() {
  return new Error('hashSettled must be called with an object');
};

/**
  `RSVP.hashSettled` is similar to `RSVP.allSettled`, but takes an object
  instead of an array for its `promises` argument.

  Unlike `RSVP.all` or `RSVP.hash`, which implement a fail-fast method,
  but like `RSVP.allSettled`, `hashSettled` waits until all the
  constituent promises have returned and then shows you all the results
  with their states and values/reasons. This is useful if you want to
  handle multiple promises' failure states together as a set.

  Returns a promise that is fulfilled when all the given promises have been
  settled, or rejected if the passed parameters are invalid.

  The returned promise is fulfilled with a hash that has the same key names as
  the `promises` object argument. If any of the values in the object are not
  promises, they will be copied over to the fulfilled object and marked with state
  'fulfilled'.

  Example:

  ```javascript
  var promises = {
    myPromise: RSVP.Promise.resolve(1),
    yourPromise: RSVP.Promise.resolve(2),
    theirPromise: RSVP.Promise.resolve(3),
    notAPromise: 4
  };

  RSVP.hashSettled(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise: { state: 'fulfilled', value: 1 },
    //   yourPromise: { state: 'fulfilled', value: 2 },
    //   theirPromise: { state: 'fulfilled', value: 3 },
    //   notAPromise: { state: 'fulfilled', value: 4 }
    // }
  });
  ```

  If any of the `promises` given to `RSVP.hash` are rejected, the state will
  be set to 'rejected' and the reason for rejection provided.

  Example:

  ```javascript
  var promises = {
    myPromise: RSVP.Promise.resolve(1),
    rejectedPromise: RSVP.Promise.reject(new Error('rejection')),
    anotherRejectedPromise: RSVP.Promise.reject(new Error('more rejection')),
  };

  RSVP.hashSettled(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise:              { state: 'fulfilled', value: 1 },
    //   rejectedPromise:        { state: 'rejected', reason: Error },
    //   anotherRejectedPromise: { state: 'rejected', reason: Error },
    // }
    // Note that for rejectedPromise, reason.message == 'rejection',
    // and for anotherRejectedPromise, reason.message == 'more rejection'.
  });
  ```

  An important note: `RSVP.hashSettled` is intended for plain JavaScript objects that
  are just a set of keys and values. `RSVP.hashSettled` will NOT preserve prototype
  chains.

  Example:

  ```javascript
  function MyConstructor(){
    this.example = RSVP.Promise.resolve('Example');
  }

  MyConstructor.prototype = {
    protoProperty: RSVP.Promise.resolve('Proto Property')
  };

  var myObject = new MyConstructor();

  RSVP.hashSettled(myObject).then(function(hash){
    // protoProperty will not be present, instead you will just have an
    // object that looks like:
    // {
    //   example: { state: 'fulfilled', value: 'Example' }
    // }
    //
    // hash.hasOwnProperty('protoProperty'); // false
    // 'undefined' === typeof hash.protoProperty
  });
  ```

  @method hashSettled
  @for RSVP
  @param {Object} object
  @param {String} label optional string that describes the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when when all properties of `promises`
  have been settled.
  @static
*/
function hashSettled(object, label) {
  return new HashSettled(Promise, object, label).promise;
}

/**
  `RSVP.rethrow` will rethrow an error on the next turn of the JavaScript event
  loop in order to aid debugging.

  Promises A+ specifies that any exceptions that occur with a promise must be
  caught by the promises implementation and bubbled to the last handler. For
  this reason, it is recommended that you always specify a second rejection
  handler function to `then`. However, `RSVP.rethrow` will throw the exception
  outside of the promise, so it bubbles up to your console if in the browser,
  or domain/cause uncaught exception in Node. `rethrow` will also throw the
  error again so the error can be handled by the promise per the spec.

  ```javascript
  function throws(){
    throw new Error('Whoops!');
  }

  var promise = new RSVP.Promise(function(resolve, reject){
    throws();
  });

  promise.catch(RSVP.rethrow).then(function(){
    // Code here doesn't run because the promise became rejected due to an
    // error!
  }, function (err){
    // handle the error here
  });
  ```

  The 'Whoops' error will be thrown on the next turn of the event loop
  and you can watch for it in your console. You can also handle it using a
  rejection handler given to `.then` or `.catch` on the returned promise.

  @method rethrow
  @static
  @for RSVP
  @param {Error} reason reason the promise became rejected.
  @throws Error
  @static
*/
function rethrow(reason) {
  setTimeout(function() {
    throw reason;
  });
  throw reason;
}

/**
  `RSVP.defer` returns an object similar to jQuery's `$.Deferred`.
  `RSVP.defer` should be used when porting over code reliant on `$.Deferred`'s
  interface. New code should use the `RSVP.Promise` constructor instead.

  The object returned from `RSVP.defer` is a plain object with three properties:

  * promise - an `RSVP.Promise`.
  * reject - a function that causes the `promise` property on this object to
    become rejected
  * resolve - a function that causes the `promise` property on this object to
    become fulfilled.

  Example:

   ```javascript
   var deferred = RSVP.defer();

   deferred.resolve("Success!");

   deferred.promise.then(function(value){
     // value here is "Success!"
   });
   ```

  @method defer
  @static
  @for RSVP
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Object}
 */

function defer(label) {
  var deferred = {};

  deferred['promise'] = new Promise(function(resolve, reject) {
    deferred['resolve'] = resolve;
    deferred['reject'] = reject;
  }, label);

  return deferred;
}

/**
 `RSVP.map` is similar to JavaScript's native `map` method, except that it
  waits for all promises to become fulfilled before running the `mapFn` on
  each item in given to `promises`. `RSVP.map` returns a promise that will
  become fulfilled with the result of running `mapFn` on the values the promises
  become fulfilled with.

  For example:

  ```javascript

  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);
  var promises = [ promise1, promise2, promise3 ];

  var mapFn = function(item){
    return item + 1;
  };

  RSVP.map(promises, mapFn).then(function(result){
    // result is [ 2, 3, 4 ]
  });
  ```

  If any of the `promises` given to `RSVP.map` are rejected, the first promise
  that is rejected will be given as an argument to the returned promise's
  rejection handler. For example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error('2'));
  var promise3 = RSVP.reject(new Error('3'));
  var promises = [ promise1, promise2, promise3 ];

  var mapFn = function(item){
    return item + 1;
  };

  RSVP.map(promises, mapFn).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === '2'
  });
  ```

  `RSVP.map` will also wait if a promise is returned from `mapFn`. For example,
  say you want to get all comments from a set of blog posts, but you need
  the blog posts first because they contain a url to those comments.

  ```javscript

  var mapFn = function(blogPost){
    // getComments does some ajax and returns an RSVP.Promise that is fulfilled
    // with some comments data
    return getComments(blogPost.comments_url);
  };

  // getBlogPosts does some ajax and returns an RSVP.Promise that is fulfilled
  // with some blog post data
  RSVP.map(getBlogPosts(), mapFn).then(function(comments){
    // comments is the result of asking the server for the comments
    // of all blog posts returned from getBlogPosts()
  });
  ```

  @method map
  @static
  @for RSVP
  @param {Array} promises
  @param {Function} mapFn function to be called on each fulfilled promise.
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled with the result of calling
  `mapFn` on each fulfilled promise or value when they become fulfilled.
   The promise will be rejected if any of the given `promises` become rejected.
  @static
*/
function map(promises, mapFn, label) {
  return Promise.all(promises, label).then(function(values) {
    if (!isFunction(mapFn)) {
      throw new TypeError("You must pass a function as map's second argument.");
    }

    var length = values.length;
    var results = new Array(length);

    for (var i = 0; i < length; i++) {
      results[i] = mapFn(values[i]);
    }

    return Promise.all(results, label);
  });
}

/**
  This is a convenient alias for `RSVP.Promise.resolve`.

  @method resolve
  @static
  @for RSVP
  @param {*} value value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$2(value, label) {
  return Promise.resolve(value, label);
}

/**
  This is a convenient alias for `RSVP.Promise.reject`.

  @method reject
  @static
  @for RSVP
  @param {*} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$2(reason, label) {
  return Promise.reject(reason, label);
}

/**
 `RSVP.filter` is similar to JavaScript's native `filter` method, except that it
  waits for all promises to become fulfilled before running the `filterFn` on
  each item in given to `promises`. `RSVP.filter` returns a promise that will
  become fulfilled with the result of running `filterFn` on the values the
  promises become fulfilled with.

  For example:

  ```javascript

  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);

  var promises = [promise1, promise2, promise3];

  var filterFn = function(item){
    return item > 1;
  };

  RSVP.filter(promises, filterFn).then(function(result){
    // result is [ 2, 3 ]
  });
  ```

  If any of the `promises` given to `RSVP.filter` are rejected, the first promise
  that is rejected will be given as an argument to the returned promise's
  rejection handler. For example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error('2'));
  var promise3 = RSVP.reject(new Error('3'));
  var promises = [ promise1, promise2, promise3 ];

  var filterFn = function(item){
    return item > 1;
  };

  RSVP.filter(promises, filterFn).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === '2'
  });
  ```

  `RSVP.filter` will also wait for any promises returned from `filterFn`.
  For instance, you may want to fetch a list of users then return a subset
  of those users based on some asynchronous operation:

  ```javascript

  var alice = { name: 'alice' };
  var bob   = { name: 'bob' };
  var users = [ alice, bob ];

  var promises = users.map(function(user){
    return RSVP.resolve(user);
  });

  var filterFn = function(user){
    // Here, Alice has permissions to create a blog post, but Bob does not.
    return getPrivilegesForUser(user).then(function(privs){
      return privs.can_create_blog_post === true;
    });
  };
  RSVP.filter(promises, filterFn).then(function(users){
    // true, because the server told us only Alice can create a blog post.
    users.length === 1;
    // false, because Alice is the only user present in `users`
    users[0] === bob;
  });
  ```

  @method filter
  @static
  @for RSVP
  @param {Array} promises
  @param {Function} filterFn - function to be called on each resolved value to
  filter the final results.
  @param {String} label optional string describing the promise. Useful for
  tooling.
  @return {Promise}
*/
function filter(promises, filterFn, label) {
  return Promise.all(promises, label).then(function(values) {
    if (!isFunction(filterFn)) {
      throw new TypeError("You must pass a function as filter's second argument.");
    }

    var length = values.length;
    var filtered = new Array(length);

    for (var i = 0; i < length; i++) {
      filtered[i] = filterFn(values[i]);
    }

    return Promise.all(filtered, label).then(function(filtered) {
      var results = new Array(length);
      var newLength = 0;

      for (var i = 0; i < length; i++) {
        if (filtered[i]) {
          results[newLength] = values[i];
          newLength++;
        }
      }

      results.length = newLength;

      return results;
    });
  });
}

var len = 0;
var vertxNext;
function asap(callback, arg) {
  queue$1[len] = callback;
  queue$1[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 1, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    scheduleFlush$1();
  }
}

var browserWindow = (typeof window !== 'undefined') ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' &&
  typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' &&
  typeof importScripts !== 'undefined' &&
  typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  var nextTick = process.nextTick;
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // setImmediate should be used instead instead
  var version = process.versions.node.match(/^(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)$/);
  if (Array.isArray(version) && version[1] === '0' && version[2] === '10') {
    nextTick = setImmediate;
  }
  return function() {
    nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  return function() {
    vertxNext(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function() {
    node.data = (iterations = ++iterations % 2);
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  return function() {
    setTimeout(flush, 1);
  };
}

var queue$1 = new Array(1000);
function flush() {
  for (var i = 0; i < len; i+=2) {
    var callback = queue$1[i];
    var arg = queue$1[i+1];

    callback(arg);

    queue$1[i] = undefined;
    queue$1[i+1] = undefined;
  }

  len = 0;
}

function attemptVertex() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch(e) {
    return useSetTimeout();
  }
}

var scheduleFlush$1;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush$1 = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush$1 = useMutationObserver();
} else if (isWorker) {
  scheduleFlush$1 = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush$1 = attemptVertex();
} else {
  scheduleFlush$1 = useSetTimeout();
}

// defaults
config.async = asap;
config.after = function(cb) {
  setTimeout(cb, 0);
};
var cast = resolve$2;
function async(callback, arg) {
  config.async(callback, arg);
}

function on() {
  config['on'].apply(config, arguments);
}

function off() {
  config['off'].apply(config, arguments);
}

// Set up instrumentation through `window.__PROMISE_INTRUMENTATION__`
if (typeof window !== 'undefined' && typeof window['__PROMISE_INSTRUMENTATION__'] === 'object') {
  var callbacks = window['__PROMISE_INSTRUMENTATION__'];
  configure('instrument', true);
  for (var eventName in callbacks) {
    if (callbacks.hasOwnProperty(eventName)) {
      on(eventName, callbacks[eventName]);
    }
  }
}

exports.cast = cast;
exports.Promise = Promise;
exports.EventTarget = EventTarget;
exports.all = all$1;
exports.allSettled = allSettled;
exports.race = race$1;
exports.hash = hash;
exports.hashSettled = hashSettled;
exports.rethrow = rethrow;
exports.defer = defer;
exports.denodeify = denodeify;
exports.configure = configure;
exports.on = on;
exports.off = off;
exports.resolve = resolve$2;
exports.reject = reject$2;
exports.async = async;
exports.map = map;
exports.filter = filter;

Object.defineProperty(exports, '__esModule', { value: true });

});
(function (m) { if (typeof module === "object" && module.exports) { module.exports = m } }(requireModule("ember-runtime").default));


}());
