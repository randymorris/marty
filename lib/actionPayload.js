var _ = require('underscore');
var uuid = require('./utils/uuid');
var cloneState = require('./utils/cloneState');
var StatusConstants = require('../constants/status');

function ActionPayload(options) {
  options || (options = {});

  var rollbackHandlers = [];
  var status = StatusConstants.PENDING;
  var handlers = options.handlers || [];

  _.extend(this, options);

  this.id = options.id || uuid.small();
  this.type = actionType(options.type);
  this.arguments = _.toArray(options.arguments);

  this.toJSON = toJSON;
  this.toString = toString;
  this.rollback = rollback;
  this.verbose = !!options.verbose;
  this.addViewHandler = addViewHandler;
  this.addStoreHandler = addStoreHandler;
  this.addRollbackHandler = addRollbackHandler;
  this.timestamp = options.timestamp || new Date();

  Object.defineProperty(this, 'handlers', {
    get: function () {
      return handlers;
    }
  });

  Object.defineProperty(this, 'status', {
    get: function () {
      return status;
    }
  });

  Object.defineProperty(this, 'pending', {
    get: function () {
      return status === StatusConstants.PENDING;
    }
  });

  Object.defineProperty(this, 'failed', {
    get: function () {
      return status === StatusConstants.FAILED;
    }
  });

  Object.defineProperty(this, 'done', {
    get: function () {
      return status === StatusConstants.DONE;
    }
  });

  function actionType(type) {
    if (_.isFunction(type)) {
      return type.toString();
    }

    return type;
  }

  function toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  function toJSON() {
    var json = _.pick(this,
      'id',
      'type',
      'source',
      'creator',
      'verbose',
      'handlers',
      'arguments',
      'timestamp'
    );

    json.status = this.status.toString();

    return json;
  }

  function rollback() {
    _.each(rollbackHandlers, function (rollback) {
      rollback();
    });
  }

  function addViewHandler(name, view, lastState) {
    var storeHandler = handlers[handlers.length - 1];

    var viewHandler = {
      name: name,
      error: null,
      id: uuid.small(),
      state: {
        after: null,
        before: lastState
      }
    };

    storeHandler.views.push(viewHandler);

    return {
      dispose: function () {
        viewHandler.state.after = cloneState(view.state);
      },
      failed: function (err) {
        viewHandler.error = err;
      }
    };
  }

  function addStoreHandler(store, handlerName) {
    var handler = {
      views: [],
      error: null,
      type: 'Store',
      id: uuid.small(),
      store: store.displayName,
      name: handlerName,
      state: {
        before: cloneState(store.getState()),
        after: undefined
      },
    };

    handlers.push(handler);

    return {
      dispose: function () {
        handler.state.after = cloneState(store.getState());
      },
      failed: function (err) {
        handler.error = err;
      }
    };
  }

  function addRollbackHandler(rollbackHandler, context) {
    if (_.isFunction(rollbackHandler)) {
      if (context) {
        rollbackHandler = _.bind(rollbackHandler, context);
      }

      rollbackHandlers.push(rollbackHandler);
    }
  }
}

module.exports = ActionPayload;