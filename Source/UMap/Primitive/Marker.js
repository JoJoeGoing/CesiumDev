// define(['../../Core/createGuid',
//         '../../Core/defined',
//         '../../Core/combine',
//         '../../Core/destroyObject',
//         '../../Core/DeveloperError',
//         '../../Core/defineProperties',
//         '../../Core/defaultValue',
//         '../../Core/Cartesian3',
//         '../../Core/Math',
//         '../../Core/Rectangle',
//         '../../Core/buildModuleUrl',
//         '../../DataSources/CallbackProperty',
//         '../OptionsUtil',
//         '../defaultDescriptCallback'
// ], function(createGuid, defined, combine, destroyObject, DeveloperError,
//             defineProperties, defaultValue, Cartesian3,CesiumMath,Rectangle, buildModuleUrl,CallbackProperty,OptionsUtil,defaultDescriptCallback) {
//     'use strict';

//     /**
//      * 便于 cesium.callbackProperty 调用callback函数
//      * @param callback 回调函数
//      * @param properties 回调函数的参数
//      * @return {function(*, *): *}
//      */
//     function wrapperCallback(callback, properties) {
//         return function() {
//             return callback(properties);
//         };
//     }

//     /**
//      *
//      * @param options
//      * @param [options.id]
//      * @param [options.viewer]
//      * @param [options.position]
//      * @param [options.properties]
//      * @param [options.image]
//      * @param [options.show]
//      * @param [options.showLabel]
//      * @param [options.billboardStyle]
//      * @param [options.labelStyle]
//      * @param [options.markerLayer]
//      * @param markerLayer
//      * @constructor
//      */
//     function Marker(options, markerLayer) {
//         options = defaultValue(options, defaultValue.EMPTY_OBJECT);
//         if (!defined(options.viewer)) {
//             throw  new DeveloperError('viewer is required !');
//         }
//         this._id = defaultValue(options.id, createGuid());
//         this._viewer = options.viewer;
//         this._position = defaultValue(options.position, new Cartesian3(0, 0, 0));
//         this._show = defaultValue(options.show, true);
//         this._description = defaultValue(options.properties, defaultValue.EMPTY_OBJECT);
//         this._showLabel = defaultValue(options.showLabel, false);
//         this._image = defaultValue(options.image, buildModuleUrl('Assets/Images/marker.png'));
//         this._layer = defaultValue(options.markerLayer, markerLayer);

//         var billboard = {
//             id:this._id,
//             position : this._position,
//             image : this._image
//         };
//         var billboardStyle = defaultValue(options.billboardStyle, OptionsUtil.billboard);
//         var billboardOptions = combine(billboard, billboardStyle, false);

//         var label = {
//             position : this._position,
//             text : this._description.name || '未命名'
//         };
//         var labelStyle = defaultValue(options.labelStyle, OptionsUtil.label);
//         var labelOptions = combine(label, labelStyle, false);

//         if (defined(this._layer)) {
//             this._billboard = this._layer.billboards.add(billboardOptions);
//             //用于点击回调。点击后，将selectEntity设置为该marker,inforBox会调用其description属性
//             this._billboard._owner = this;

//             if (this._showLabel) {

//                 this._label = this._layer.labels.add(labelOptions);
//                 this._label._owner = this;
//             }
//         }
//     }

//     /**
//      *
//      * @param {BillboardCollection}billboardCollection
//      * @param {string}name
//      * @param callback callback
//      */
//     function setListener(billboardCollection, name, callback) {
//         billboardCollection[name] = callback;
//     }

//     defineProperties(Marker.prototype, {
//         id : {
//             get : function() {
//                 return this._id;
//             }
//         },
//         viewer : {
//             get : function() {
//                 return this._viewer;
//             }
//         },
//         show : {
//             set : function(value) {
//                 this._show = value;
//             },
//             get : function() {
//                 return this._show;
//             }
//         },
//         showLabel : {
//             set : function(value) {
//                 this._showLabel = value;
//             },
//             get : function() {
//                 return this._showLabel;
//             }
//         },
//         callback : {
//             set : function(value) {
//                 this._callback = value;
//             },
//             get : function() {
//                 return this._callback || defaultDescriptCallback;
//             }
//         },
//         description : {
//             set : function(value) {
//                 this._description = value;
//             },
//             get : function() {
//                 var that = this;
//                 return new CallbackProperty(wrapperCallback(that.callback, that._description), false);
//             }
//         },
//         position : {
//             set : function(value) {
//                 this._position = value;
//                 this._billboard.position = value;
//                 if(this._showLabel){
//                     this._label.position = value;
//                 }
//             },
//             get : function() {
//                 return this._position;
//             }
//         },
//         owner : {
//             get : function() {
//                 return this._layer;
//             }
//         }

//     });

//     Marker.prototype.updatePosition = function(lon, lat, height) {
//         height = defaultValue(height, 0);
//         this.position = Cartesian3.fromDegrees(lon, lat, height);
//         this._viewer.scene.refreshOnce = true;
//     };

//     Marker.prototype.getType = function() {
//         return 'marker';
//     };

//     Marker.prototype.isDestroyed = function() {
//         return false;
//     };

//     Marker.prototype.destroy = function() {
//         if (defined(this._label)) {
//             this._label = null;
//         }
//         if (defined(this._billboard)) {
//             this._billboard = null;
//         }
//         this._layer = undefined;
//         destroyObject(this);
//     };

//     Marker.prototype.filter = function(rectangle){

//         var cartographic = this.viewer.scene.globe.ellipsoid.cartesianToCartographic(this.position);

//         if(!cartographic){
//             return false;
//         }
//         //cartographic.height = 0;
//         return Rectangle.contains(rectangle, cartographic);

//     };

//     return Marker;
// });
