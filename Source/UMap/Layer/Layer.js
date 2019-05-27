// define([
//     '../../Core/defined',
//     '../../Core/createGuid',
//     '../../Core/Math',
//     '../../Core/Resource',
//     '../../Core/DeveloperError',
//     '../../Core/defaultValue',
//     '../../Core/defineProperties',
//     '../../Core/Cartesian3',
//     '../Primitive/MarkerCollection'
// ], function (defined, createGuid, CesiumMath, Resource, DeveloperError, defaultValue, defineProperties,
//     Cartesian3, MarkerCollection) {
//     'use strict';

//     var url_param = '?service=WFS&request=GetFeature&version=1.0.0&outputformat=json&maxFeature=50&typename=beyondb:';
//     function Layer(options) {
//         options = defaultValue(options, {});
//         if (!defined(options.url)) {
//             throw new DeveloperError('url is required to create MarkerLayer !');
//         }
//         this._url = options.url + url_param;

//         if (!defined(options.viewer)) {
//             throw new DeveloperError('viewer is required !');
//         }
//         this.viewer = options.viewer;
//         this._collection = defaultValue(options.markerCollection, new MarkerCollection(this.viewer));

//         this._name = defaultValue(options.name, '未命名');
//         this._codeName = options.codeName;
//         this._code = defaultValue(options.code,[]);
//         this._id = defaultValue(options.id, createGuid());
//         this._imgPath = options.imgPath;
//         var type = options.type;
//         this._type = type;
//         this._labelField = defaultValue(options.labelField, '');
//         this._showLabel = (type === 'clusterPoint' || this._labelField === '') ? false : defaultValue(options.showLabel, true);
//         this._refresh = defaultValue(options.refresh, true);
//         this._show = defaultValue(options.show, true);

//         this._primitiveStyle = defaultValue(options.style, {});

//         this._markeIds = [];
//     }
//     //todo:set 需同步更新
//     defineProperties(Layer.prototype, {
//         name: {
//             get: function () {
//                 return this._name;
//             }
//         },
//         id: {
//             get: function () {
//                 return this._id;
//             }
//         },
//         refresh: {
//             get: function () {
//                 return this._refresh;
//             },
//             set: function (flag) {
//                 this._refresh = flag;
//             }
//         },
//         show: {
//             get: function () {
//                 return this._show;
//             },
//             set: function (value) {
//                 this._show = value;
//             }
//         },
//         type: {
//             get: function () {
//                 return this._type;
//             },
//             set: function (value) {
//                 if (typeof value === 'string') {
//                     this._type = value;
//                 }
//             }
//         }
//     });

//     Layer.prototype.init = function (callback, isthis) {
//         var url = buildUrl(this.viewer, this._url, {
//             codeName: this._codeName,
//             code: this._code,
//             layerName: this._id
//         });
//         var that = this;
//         var temp = this._markeIds.splice(0);
//         this._markeIds = [];
//         fetchGeoJson(url).then(function (JsonObj) {
//             var features = JsonObj.features;
//             for (var i = 0; i < features.length; i++) {
//                 var position = Cartesian3.fromDegrees(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1], 0);
//                 var options = {
//                     id: features[i].id,
//                     viewer: that.viewer,
//                     position: position,
//                     properties: features[i].properties,
//                     billboardStyle: that._billboardStyle,
//                     labelStyle: that._labelStyle,
//                     showLabel: that._showLabel,
//                     show: that._show,
//                     image: that._imgPath
//                 };
//                 that._markeIds.push(options.id);
//                 //如果已经绘制，将不再重新绘制
//                 var index = temp.indexOf(options.id);
//                 if ( -1 !== index) {
//                     temp.splice(index,1);
//                     continue;
//                 }
//                 that._collection.add(options);
//                 that._show = true;
//             }
//             //删除不需要显示的
//             for(var j = 0 ; j < temp.length ; j++){
//                 that._collection.remove(temp[j]);
//             }
//             if (typeof callback === 'function') {
//                 callback.apply(isthis, arguments);
//             }
//             features = null;
//             JsonObj = null;
//             temp = null;
//         }).otherwise(function (error) {
//             console.log(error);
//         });
//     };

//     Layer.prototype.contains = function (key) {
//         var index = this._markeIds.indexOf(key);
//         if (-1 !== index) {
//             return true;
//         }
//         return false;
//     };

//     //请求获取json
//     function fetchGeoJson(url) {
//         var resource = Resource.createIfNeeded(url);
//         return resource.fetchJson();
//     }

//     function buildUrl(viewer, baseUrl, options) {
//         if (!defined(options.codeName)) {
//             return undefined;
//         }
//         var wktGeometry = getRangeParam(viewer);
//         var count = options.code.length;

//         var cql_filterStr = '(' + options.codeName + ' like' + " '%25" + options.code[0] + "%25' ";

//         for (var i = 1; i < count; i++) {
//             cql_filterStr += ' OR ' + options.codeName + ' like ' + "  '%25" + options.code[i] + "%25' ";
//         }

//         cql_filterStr += ')';
//         cql_filterStr += ' AND INTERSECTS(the_geom,' + wktGeometry + ')';

//         var url = baseUrl + options.layerName + '&cql_filter=' + cql_filterStr;

//         return url;
//     }

//     function getRangeParam(viewer) {
//         var rang = 'POLYGON' + '((';
//         var points = getCanvasGeoRange(viewer);
//         points.push(points[0]);
//         rang += arrayToString(points) + '))';
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

//     return Layer;
// });
