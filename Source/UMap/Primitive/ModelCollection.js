// define([
//     '../../Core/defined',
//     '../../Core/destroyObject',
//     '../../Core/DeveloperError',
//     '../../Core/defineProperties',
//     '../../Core/Cartographic',
//     '../../Core/Cartesian3',
//     '../../Core/Rectangle',
//     '../../Core/BoundingSphere',
//     '../../Core/Ray',
//     '../../Scene/LabelCollection',
//     '../../Scene/HeightReference',
//     './DrawingTypes',
//     './ModelPrimitive'],
// function(defined, destroyObject, DeveloperError, defineProperties,
//          Cartographic, Cartesian3, Rectangle, BoundingSphere, Ray, LabelCollection,
//          HeightReference, DrawingTypes, ModelPrimitive) {
//     'use strict';

//     /**
//      * 所有的模型集合，Cesium 会默认自动缓存同一个gltf
//      * @alias Uni_ModelCollection
//      * @param cesiumViewer
//      * @constructor
//      * @see PrimitiveCollection
//      */

//     function ModelCollection(cesiumViewer) {
//         if (!defined(cesiumViewer)) {
//             throw new DeveloperError('No viewer instance');
//         }
//         this._viewer = cesiumViewer;
//         this._labels = new LabelCollection({
//             scene : cesiumViewer.scene
//         });
//         this._show = true;
//         this._needToResampleNextFrame = false;
//         this._resampling = false;
//         this._models = [];
//     }

//     function removePrimitive(modelCollection, modelPrimitive) {
//         modelCollection._labels.remove(modelPrimitive.label);
//         if (defined(modelPrimitive._removeCallbackFunc)) {
//             modelPrimitive._removeCallbackFunc();
//         }
//     }

//     defineProperties(ModelCollection.prototype, {

//         viewer : {
//             get : function() {
//                 return this._viewer;
//             }
//         },
//         baseUrl :{
//             get : function() {
//                 return this._target;
//             }
//         },
//         length : {
//             get : function() {
//                 return this._models.length;
//             }
//         },
//         show : {
//             get : function() {
//                 return this._show;
//             },
//             set : function(e) {
//                 this._show = e;
//             }
//         },
//         models : {
//             get : function() {
//                 return this._models;
//             }
//         },
//         labels : {
//             get : function() {
//                 return this._labels;
//             }
//         }
//     });

//     /**
//      *
//      * @return {number} DrawingTypes.DRAWING_MODEL
//      */
//     ModelCollection.prototype.getType = function() {
//         return DrawingTypes.DRAWING_MODEL;
//     };
//     /**
//      *
//      * @param options
//      * @return {ModelPrimitive|exports}
//      */
//     ModelCollection.prototype.add = function(options) {
//         options = options || {};
//         options.viewer = this._viewer;
//         var primitive = new ModelPrimitive(options, this);
//         primitive.owner = this.owner;
//         this._models.push(primitive);
//         return primitive;

//     };

//     /**
//      *
//      * @param modelPrimitive
//      * @return {boolean}
//      * @see PrimitiveCollection.remove
//      */
//     ModelCollection.prototype.remove = function(modelPrimitive) {
//         if (defined(modelPrimitive) && modelPrimitive._modelCollection === this) {
//             var index = this._models.indexOf(modelPrimitive);
//             if (-1 !== index) {
//                 this._models.splice(index, 1);
//                 removePrimitive(this, modelPrimitive);
//                 return true;
//             }
//         }
//         return false;
//     };
//     /**
//      *
//      * @param primitives
//      * @return {boolean}
//      */
//     ModelCollection.prototype.removeArray = function(primitives) {
//         if (!(defined(primitives) && primitives instanceof Array)) {
//             return false;
//         }
//         for (var index = primitives.length; index > 0; index--) {
//             var modelPrimitive = primitives[index - 1];
//             if (defined(modelPrimitive) && modelPrimitive._modelCollection === this) {
//                 var n = this._models.indexOf(modelPrimitive);
//                 if (-1 !== n) {
//                     this._models.splice(n, 1);
//                     removePrimitive(this, modelPrimitive);
//                 }
//             }
//         }
//         return true;
//     };

//     /**
//      * @see PrimitiveCollection.removeAll
//      */
//     ModelCollection.prototype.removeAll = function() {

//         for (var t = 0; t < this._models.length; ++t) {
//             removePrimitive(this, this._models[t]);
//         }
//     };

//     /**
//      * @see PrimitiveCollection.contains
//      * @param modelPrimitive
//      * @return {Boolean|*|boolean}
//      */
//     ModelCollection.prototype.contains = function(modelPrimitive) {
//         return defined(modelPrimitive) && modelPrimitive._modelCollection === this;
//     };

//     ModelCollection.prototype.get = function(primitiveIndex) {
//         return this._models[primitiveIndex];
//     };

//     ModelCollection.prototype.update = function(frameState) {
//        // if (this._show) {
//             //     if (this._resampling) {
//             //         for (var index = 0; index < this._models.length; index++) {
//             //             var primitive = this._models[index];
//             //             if (defined(primitive) && (primitive._heightReference === HeightReference.CLAMP_TO_GROUND && primitive.needToUpdatePosition)) {
//             //                 this._needToResampleNextFrame = true;
//             //                 break;
//             //             }
//             //         }
//             //     } else {
//             //         var n = [];
//             //         var o = [];
//             //         for (var j = 0; j < this._models.length; j++) {
//             //             var model = this._models[j];
//             //             if (defined(model)) {
//             //                 if (!((model._heightReference !== HeightReference.CLAMP_TO_GROUND || defined(model.needToUpdatePosition) && !model.needToUpdatePosition))) {
//             //                     n.push(model.position);
//             //                     o.push(j);
//             //                 }
//             //             }
//             //         }
//             //         this._updatePositions(this._viewer.scene, n, o);
//             //     }
//             for (var r = 0; r < this._models.length; r++) {
//                 var modelPrimitive = this._models[r];
//                 if (defined(modelPrimitive.model)) {
//                     modelPrimitive.model.update(frameState);
//                 }
//             }
//         //}
//     };

//     ModelCollection.prototype._updatePositions = function(scene, positions, primitives) {
//         if (!(primitives.length < 1)) {
//             this._resampling = true;
//             var modelColliction = this;
//             var ellipsoid = scene.globe.ellipsoid;
//             if (primitives.length !== positions.length) {
//                 modelColliction._resampling = false;
//             } else {
//                 for (var index = 0; index < primitives.length; index++) {
//                     var a = primitives[index];
//                     if (modelColliction._models.length > a) {
//                         var modelPrimitive = modelColliction._models[a];
//                         modelPrimitive.position = ellipsoid.cartographicToCartesian(positions[index]);
//                         modelPrimitive.needToUpdatePosition = false;
//                     }
//                 }
//                 modelColliction._resampling = false;
//                 if (modelColliction._needToResampleNextFrame) {
//                     (modelColliction._needToResampleNextFrame = false);
//                 }
//             }
//             scene.refreshOnce = true;
//         }
//     };

//     ModelCollection.prototype.isDestroyed = function() {
//         return false;
//     };

//     ModelCollection.prototype.destroy = function() {
//         this.removeAll();
//         this._billboards.destroy();
//         this._labels.destroy();
//         return destroyObject(this);
//     };

//     return ModelCollection;
// });
