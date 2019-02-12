define(function() {
    'use strict';

    var original = '$BEYON$';
    window[original] = {};
    window[original]._counter = window[original]._counter || 1;
    window[original]._instances = window[original]._instances || {};
    window[original]._instances = window[original]._instances || {};

    function setGuid() {
        return 'TANGRAM__' + (window[original]._counter++).toString(36);
    }

    /**
     * DrawingManager 的父类
     * @alias Uni_DrawingEvent
     * @param guid
     * @constructor
     * @see DrawingManager
     */
    function DrawingEvent(guid) {
        this.guid = guid || setGuid();
        window[original]._instances[this.guid] = this;
    }

    /**
     * 判断该对象是否为string类型
     * @method
     * @param obj
     * @return {boolean}
     */
    function checkedStringType(obj) {
        return '[object String]' === Object.prototype.toString.call(obj);
    }

    /**
     *判断该对象是否为Function
     * @method
     * @param obj
     * @return {boolean}
     */
    function checkedFunctionType(obj) {
        return '[object Function]' === Object.prototype.toString.call(obj);
    }

    function CreateBaseStringObj(type, target) {
        this.type = type;
        this.returnValue = true;
        this.target = target || null;
        this.currentTarget = null;
    }

    DrawingEvent.prototype.dispose = function() {
        delete window[original]._instances[this.guid];
        for (var proto in this) {
            if (!checkedFunctionType(this[proto])) {
                delete this[proto];
            }
        }
        this.disposed = true;
    };

    DrawingEvent.prototype.addEventListener = function(name, obj, hashCode) {
        if (checkedFunctionType(obj)) {
            if (!this.__listeners) {
                this.__listeners = {};
            }
            var guid;
            var listeners = this.__listeners;
            if ('string' === typeof hashCode && hashCode) {
                if (/[^\w\-]/.test(hashCode)) {
                    throw 'nonstandard key:' + hashCode;
                }
                obj.hashCode = hashCode;
                guid = hashCode;
            }
            if (0 !== name.indexOf('on')) {
                name = 'on' + name;
            }
            if ('object' !== typeof listeners[name]) {
                listeners[name] = {};
            }
            guid = guid || setGuid();
            obj.hashCode = guid;
            listeners[name][guid] = obj;
        }
    };

    DrawingEvent.prototype.removeEventListener = function(name, obj) {
        if (checkedFunctionType(obj)) {
            obj = obj.hashCode;
        } else if (!checkedStringType(obj)) {
            if (!this.__listeners) {
                this.__listeners = {};
            }
            if (0 !== name.indexOf('on')) {
                name = 'on' + name;
            }
            var listeners = this.__listeners;
            if (!listeners[name]) {
                return;
            }
            return void(listeners[name] && delete listeners[name]);
        }
        if (!this.__listeners) {
            this.__listeners = {};
        }

        if (0 !== name.indexOf('on')) {
            name = 'on' + name;
        }
        if (this.__listeners[name] && this.__listeners[name][obj]) {
            delete this.__listeners[name][obj];
        }
    };

    DrawingEvent.prototype.dispatchEvent = function(type, options) {
        if (checkedStringType(type)) {
            type = new CreateBaseStringObj(type);
        }
        if (!this.__listeners) {
            this.__listeners = {};
        }
        options = options || {};
        for (var property in options) {
            if (options.hasOwnProperty(property)) {
                type[property] = options[property];
            }
        }
        var listeners = this.__listeners;
        var key = type.type;
        type.target = type.target || this;
        type.currentTarget = this;
        if (0 !== key.indexOf('on')) {
            key = 'on' + key;
        }
        if (checkedFunctionType(this[key])) {
            this[key].apply(this, arguments);
        }
        if ('object' === typeof listeners[key]) {
            for (var r in listeners[key]) {
                if (listeners[key].hasOwnProperty(r)) {
                    listeners[key][r].apply(this, arguments);
                }
            }
        }
        return type.returnValue;
    };

    DrawingEvent.prototype.toString = function() {
        return '[object ' + (this._className || 'Object') + ']';
    };
    return DrawingEvent;
});
