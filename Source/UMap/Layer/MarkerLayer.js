// define(['../../Core/defined',
//     '../../Core/defaultValue',
//     '../../Core/destroyObject',
//     '../../Core/DeveloperError',
//     '../../Core/defineProperties',
//     '../../Core/Cartesian3',
//     '../../Core/Math',
//     '../../Core/Resource',
//     '../../Core/combine',
//     '../../Core/createGuid',
//     '../../Core/AssociativeArray',

//     '../OptionsUtil',
//     '../Primitive/MarkerCollection'

// ], function (defined, defaultValue,
//     destroyObject, DeveloperError,
//     defineProperties, Cartesian3, CesiumMath, Resource, combine, createGuid, AssociativeArray,
//     OptionsUtil,MarkerCollection) {
//     'use strict';

//     //todo:这样声明，所有的实体类共同具有这一个对象.因此需注意初始化
//     var WFS = {
//         service: 'WFS',
//         request: 'GetFeature',
//         version: '1.0.0',
//         outputformat: 'json',
//         maxFeature: 50,
//         typename: '',
//         cql_filter: ''
//     };

//     //请求获取json
//     function fetchGeoJson(url) {
//         var resource = Resource.createIfNeeded(url);
//         return resource.fetchJson();
//     }

//     function getQueryRequest(obj) {
//         var request = '';
//         for (var param in obj) {
//             if (obj.hasOwnProperty(param)) {
//                 request += param + '=' + obj[param] + '&';
//             }
//         }
//         return request.slice(0, -1);
//     }

//     function setPolygonParam(viewer) {
//         var rang = 'POLYGON' + '((';
//         var points = getCanvasGeoRange(viewer);
//         points.push(points[0]);
//         rang += arrayToString(points) + ')))';
//         return rang;
//     }

//     function arrayToString(points) {
//         if (!Array.isArray(points)) {
//             return '';
//         }
//         var result = '';
//         for (var i = 0; i < points.length; i++) {
//             var value = points[i];
//             if (value) {
//                 result += value[0] + '%20' + value[1] + ',';
//             }
//         }
//         return result.slice(0, -1);
//     }

//     function getCanvasGeoRange(viewer) {
//         var result = new Array(4);
//         var rectangle = viewer.scene.camera.computeViewRectangle();

//         result[0] = [CesiumMath.toDegrees(rectangle.west), CesiumMath.toDegrees(rectangle.south)];
//         result[1] = [CesiumMath.toDegrees(rectangle.west), CesiumMath.toDegrees(rectangle.north)];
//         result[2] = [CesiumMath.toDegrees(rectangle.east), CesiumMath.toDegrees(rectangle.north)];
//         result[3] = [CesiumMath.toDegrees(rectangle.east), CesiumMath.toDegrees(rectangle.south)];

//         return result;
//     }

//     /**
//      * 发送请求，获取一系列的marker点。所有的marker点具有相同的样式
//      * @param options
//      * @constructor
//      */
//     function MarkerLayer(options) {
//         options = defaultValue(options, defaultValue.EMPTY_OBJECT);

//         if (!defined(options.url)) {
//             throw new DeveloperError('url is required to create MarkerLayer !');
//         }
//         this._url = options.url;
//         if (!defined(options.viewer)) {
//             throw new DeveloperError('viewer is required !');
//         }
//         this._id = defaultValue(options.id, createGuid());
//         this._viewer = options.viewer;
//         this._collection = defaultValue(options.markerCollection,new MarkerCollection(this._viewer));

//         var codeName = options.codeName;
//         var layerName = options.layerName;
//         var codeNum = options.codeNum;
//         var tableName = options.tableName;

//         if (defined(options.dataBaseSpace)) {
//             var dataBaseSpace = options.dataBaseSpace;
//             this._layerName = dataBaseSpace + ':' + layerName;
//         } else {
//             this._layerName = layerName;
//         }

//         this._cql_filter = '(' + codeName + '%20' + 'like' + '%20' + "'" + '%25' + codeNum + '%25' + "'" + ')%20AND%20INTERSECTS' + '(' + tableName + ',';

//         this._show = defaultValue(options.show, true);
//         this._showLabel = defaultValue(options.showLabel, false);

//         this._imgPath = options.imgPath;

//         this._layerStyleOptions = options.layerStyle;

//         var billboardOptions = defaultValue(options.billboardStyle, defaultValue.EMPTY_OBJECT);
//         this._billboardStyle = combine(billboardOptions, OptionsUtil.billboard, false);

//         var labelOptions = defaultValue(options.labelStyle, defaultValue.EMPTY_OBJECT);
//         this._labelStyle = combine(labelOptions, OptionsUtil.label, false);
//     }

//     defineProperties(MarkerLayer.prototype, {
//         url: {
//             get: function () {
//                 WFS.cql_filter = this._cql_filter + setPolygonParam(this._viewer);
//                 return this._url + '?' + getQueryRequest(WFS);
//             }
//         },
//         id: {
//             get: function () {
//                 return this._id;
//             }
//         },
//         type:{
//             get:function(){
//                 return this._type;
//             }
//         }
//     });

//     MarkerLayer.prototype.init = function (callback, obj) {
//         var that = this;
//         WFS.typename = this._layerName;
//         var url = this.url;
//         fetchGeoJson(url).then(function (JsonObj) {
//             var features = JsonObj.features;
//             for (var i = 0; i < features.length; i++) {
//                 var position = Cartesian3.fromDegrees(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1], 0);
//                 var options = {
//                     id: features[i].id,
//                     viewer: that._viewer,
//                     position: position,
//                     properties: features[i].properties,
//                     billboardStyle: that._billboardStyle,
//                     labelStyle: that._labelStyle,
//                     showLabel: that._showLabel,
//                     show: that._show,
//                     image: that._imgPath
//                 };
//                 var marker = that._collection.add(options);
//                 that.markers.set(marker.id, marker);
//                 that._show = true;
//             }
//             if (typeof callback === 'function') {
//                 callback(obj);
//             }
//             features = null;
//             JsonObj = null;
//         }).otherwise(function (error) {
//             console.log(error);
//         });
//     };

//     MarkerLayer.prototype.clear = function () {
//         var markers = this.markers.values;
//         for (var index = 0; index < markers.length; index++) {
//             this._collection.remove(markers[index]);
//         }
//         this.markers.removeAll();
//         this._show = false;
//     };

//     MarkerLayer.prototype.filter = function (rectangle, result) {
//         if (!defined(result) || !(result instanceof Array)) {
//             result = [];
//         }
//         var markers = this.markers.values;
//         for (var i = 0; i < markers.length; i++) {
//             var p = markers[i];
//             if (p.filter(rectangle)) {
//                 result.push(p);
//             }
//         }
//         return result;
//     };

//     MarkerLayer.prototype.destroy = function () {
//         this.billboards.removeAll();
//         this.labels.removeAll();
//         var markers = this.markers.values;
//         for (var index = 0; index < markers.length; index++) {
//             markers[index].destroy();
//         }
//         this.markers.removeAll();
//         destroyObject(this);
//     };

//     return MarkerLayer;
// });
