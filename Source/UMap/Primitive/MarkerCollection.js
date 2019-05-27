/* eslint-disable no-undef */
define([
    '../../Core/defined',
    '../../Core/defaultValue',
    '../../Core/destroyObject',
    '../../Core/DeveloperError',
    '../../Core/defineProperties',
    '../../Core/AssociativeArray',
    '../../Scene/LabelCollection',
    '../../Scene/BillboardCollection',
    './MarkerPrimitive'
], function (defined, defaultValue, destroyObject, DeveloperError,
    defineProperties, AssociativeArray, LabelCollection,
    BillboardCollection, MarkerPrimitive) {
    'use strict';

    /**
     * @alias Uni_MarkerCollection
     * @param cesiumView
     * @constructor
     */
    function MarkerCollection(cesiumView, options) {
        if (!defined(cesiumView)) {
            throw new DeveloperError('No viewer instance');
        }
        options = defaultValue(options, {});

        this._viewer = cesiumView;
        /**
         *
         * @type {LabelCollection|exports}
         * @public
         */
        this._labels = defaultValue(options.labels, new LabelCollection({
            scene: cesiumView.scene
        }));
        /**
         *
         * @type {BillboardCollection|exports}
         * @public
         */
        this._billboards = defaultValue(options.billboards, new BillboardCollection({
            scene: cesiumView.scene
        }));
        this._show = true;
        this._markers = new AssociativeArray();

    }

    function onDestroy(primitive) {
        if (defined(primitive._removeCallbackFunc)) {
            primitive._removeCallbackFunc();
        }
        if (primitive) {
            primitive.destroy();
        }
    }

    defineProperties(MarkerCollection.prototype, {

        length: {
            get: function () {
                return this._markers.length;
            }
        },
        show: {
            get: function () {
                return this._show;
            },
            set: function (show) {
                this._show = show;
            }
        },
        markers: {
            get: function () {
                return this._markers;
            }
        },
        labels: {
            get: function () {
                return this._labels;
            }
        },
        billboards: {
            get: function () {
                return this._billboards;
            }
        }
    });

    MarkerCollection.prototype.add = function (options) {
        var primitive = new MarkerPrimitive(options, this);
        this._markers.set(primitive.id, primitive);
        return primitive;
    };

    /**
     * @method 移除指定marker点
     * @param markerPrimitive
     * @return {boolean}
     */
    MarkerCollection.prototype.remove = function (markerPrimitive) {
        if (defined(markerPrimitive) && markerPrimitive._collection === this) {
            this._markers.remove(markerPrimitive.id);
            onDestroy(markerPrimitive);
        }
        return false;
    };
    MarkerCollection.prototype.removeById = function (key) {
        if (defined(key)) {
            onDestroy(this._markers.get(key));

            this._markers.remove(key);
        }
        return false;
    };

    /**
     * @method 删除marker集合
     * @param {Array.<MarkerPrimitive>} markerPrimitives
     * @return {boolean}
     */
    MarkerCollection.prototype.removeArray = function (markerPrimitives) {
        if (!(defined(markerPrimitives) && markerPrimitives instanceof Array)) {
            return false;
        }
        for (var r = markerPrimitives.length; r > 0; r--) {
            var primitive = markerPrimitives[r - 1];
            if (defined(primitive) && primitive._markerCollection === this) {
                this._markers.remove(primitive);
                onDestroy(primitive);
            }
        }
        return true;
    };

    /**
     * @method 删除所有marker点
     */
    MarkerCollection.prototype.removeAll = function () {
        this._removeAllInternal();
        this._viewer.scene.refreshOnce = true;
    };

    /**
     *
     * @method 内部方法不要直接调用，调用 removeAll
     */
    MarkerCollection.prototype._removeAllInternal = function () {
        var values = this._markers.value;
        for (var i = 0; i < values.length; i++) {
            onDestroy(values[i]);
        }
        this._markers.removeAll();
        this._labels.removeAll();
        this._billboards.removeAll();
    };
    /**
     * @method 查看是否有该marker点
     * @param key
     * @return {Boolean|boolean}
     */
    MarkerCollection.prototype.contains = function (key) {
        return this._markers.contains(key);
    };
    /**
     * @method 根据下标返回mark点
     * @param {int} index
     * @return {MarkerPrimitive}
     * @see MarkerPrimitive
     */
    MarkerCollection.prototype.get = function (key) {
        return this._markers.get(key);
    };

    MarkerCollection.prototype.update = function (frameState) {
        if (this._show && !this.isDestroyed()) {
            this._billboards.update(frameState);
            this._labels.update(frameState);
        }
    };

    MarkerCollection.prototype.isDestroyed = function () {
        return false;
    };
    MarkerCollection.prototype.destroy = function () {
        this._removeAllInternal();
        this._billboards.destroy();
        this._labels.destroy();
        destroyObject(this);
    };
    return MarkerCollection;
});
