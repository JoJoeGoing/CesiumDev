define(['../../Core/defined',
        '../../Core/defaultValue',
        '../../Core/destroyObject',
        '../../Core/DeveloperError',
        '../../Core/defineProperties',
        '../../Core/Cartesian2',
        '../../Core/Cartesian3',
        '../../Core/Math',
        '../../Core/Resource',
        '../../Core/combine',
        '../../Core/createGuid',
        '../../Core/AssociativeArray',
        '../../Scene/BillboardCollection',
        '../../Scene/LabelCollection',
        '../../Scene/PrimitiveCollection',
        '../OptionsUtil',
        '../Primitive/Marker'

], function(defined, defaultValue,
            destroyObject, DeveloperError,
            defineProperties, Cartesian2, Cartesian3, CesiumMath, Resource, combine, createGuid,AssociativeArray,
            BillboardCollection,LabelCollection, PrimitiveCollection, OptionsUtil,Marker) {
    'use strict';

    var WFS = {
        service : 'WFS',
        request : 'GetFeature',
        version : '1.0.0',
        outputformat : 'json',
        maxFeature : 50,
        typename : '',
        cql_filter : ''
    };

    //请求获取json
    function fetchGeoJson(url) {
        var resource = Resource.createIfNeeded(url);
        return resource.fetchJson();
    }

    function getQueryRequest(obj) {
        var request = '';
        for (var param in obj) {
            if (obj.hasOwnProperty(param)) {
                request += param + '=' + obj[param] + '&';
            }
        }
        return request.slice(0, -1);
    }

    function setPolygonParam(viewer) {
        var rang = 'POLYGON' + '((';
        var points = getCanvasGeoRange(viewer);
        points.push(points[0]);
        rang += arrayToString(points) + ')))';
        return rang;
    }

    function arrayToString(points) {
        if (!Array.isArray(points)) {
            return '';
        }
        var result = '';
        for (var i = 0; i < points.length; i++) {
            var value = points[i];
            if (value) {
                result += value[0] + '%20' + value[1] + ',';
            }
        }
        return result.slice(0, -1);
    }

    function getCanvasGeoRange(viewer, result) {
        var canvas = viewer.scene.canvas;
        if (!result) {
            result = new Array(4);
        }
        var leftTop = new Cartesian2(1, 1);
        var rightTop = new Cartesian2(canvas.width - 1, 1);
        var leftBottom = new Cartesian2(1, canvas.height - 1);
        var rightBottom = new Cartesian2(canvas.width - 1, canvas.height - 1);

        result[0] = canvasPositionToLatLng(viewer, leftBottom);
        result[1] = canvasPositionToLatLng(viewer, leftTop);
        result[2] = canvasPositionToLatLng(viewer, rightTop);
        result[3] = canvasPositionToLatLng(viewer, rightBottom);
        return result;
    }

    function canvasPositionToLatLng(viewer, canvasPosition) {
        var pick = viewer.scene.camera.pickEllipsoid(canvasPosition);
        if (!pick) {
            return undefined;
        }
        var geoPt = viewer.scene.globe.ellipsoid.cartesianToCartographic(pick);
        return [CesiumMath.toDegrees(geoPt.longitude), CesiumMath.toDegrees(geoPt.latitude)];
    }

    /**
     * 发送请求，获取一系列的marker点。所有的marker点具有相同的样式
     * @param options
     * @constructor
     */
    function MarkerLayer(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        if (!defined(options.url)) {
            throw new DeveloperError('url is required to create MarkerLayer !');
        }
        this._url = options.url;
        if (!defined(options.viewer)) {
            throw new DeveloperError('viewer is required !');
        }
        this._id = defaultValue(options.id, createGuid());
        this._viewer = options.viewer;
        var scene = this._viewer.scene;

        this._billboardCollection = options.billboards || scene.primitives.add(new BillboardCollection({
            scene : scene
        }));

        this._labelCollection = options.labels || scene.primitives.add(new LabelCollection({
            scene : scene
        }));

        var codeName = options.codeName;
        var layerName = options.layerName;
        var codeNum = options.codeNum;
        var tableName = options.tableName;

        if (defined(options.dataBaseSpace)) {
            var dataBaseSpace = options.dataBaseSpace;
            WFS.typename = dataBaseSpace + ':' + layerName;
        } else {
            WFS.typename = layerName;
        }
        this._cql_filter = '(' + codeName + '%20' + 'like' + '%20' + "'" + '%25' + codeNum + '%25' + "'" + ')%20AND%20INTERSECTS' + '(' + tableName + ',';

        this._show = defaultValue(options.show, true);
        this._showLabel = defaultValue(options.showLabel, false);

        this._imgPath = options.imgPath;

        this._layerStyleOptions = options.layerStyle;

        var billboardOptions = defaultValue(options.billboardStyle, defaultValue.EMPTY_OBJECT);
        this._billboardStyle = combine(billboardOptions, OptionsUtil.billboard, false);

        var labelOptions = defaultValue(options.labelStyle, defaultValue.EMPTY_OBJECT);
        this._labelStyle = combine(labelOptions, OptionsUtil.label, false);
        this._markers = new AssociativeArray();
    }

    defineProperties(MarkerLayer.prototype, {
        url : {
            get : function() {
                WFS.cql_filter = this._cql_filter + setPolygonParam(this._viewer);
                return this._url + '?' + getQueryRequest(WFS);
            }
        },
        id : {
            get : function() {
                return this._id;
            }
        },
        billboards : {
            get : function() {
                return this._billboardCollection;
            }
        },
        labels : {
            get : function() {
                return this._labelCollection;
            }
        },
        markers : {
            get : function() {
                return this._markers;
            }
        }
    });

    MarkerLayer.prototype.init = function(callback, obj) {
        var that = this;
        var url = this.url;
        fetchGeoJson(url).then(function(JsonObj) {
            var features = JsonObj.features;
            for (var i = 0; i < features.length; i++) {
                var position = Cartesian3.fromDegrees(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1], features[i].properties.height);
                //var properties = features[i].properties;
                var options = {
                    id : features[i].id,
                    viewer : that._viewer,
                    position : position,
                    properties : features[i].properties,
                    billboardStyle : that._billboardStyle,
                    labelStyle : that._labelStyle,
                    showLabel : that._showLabel,
                    show : that._show,
                    image : that._imgPath
                };
                var marker = new Marker(options,that);
                that.markers.set(marker.id,marker);
            }
            if (typeof callback === 'function') {
                callback(obj);
            }
            features = null;
            JsonObj = null;
        }).otherwise(function(error) {
            console.log(error);
        });
    };

    MarkerLayer.prototype.clear = function(){
        this.billboards.removeAll();
        this.labels.removeAll();
        var markers = this.markers.values;
        for(var index = 0 ; index < markers.length ; index++){
            markers[index].destroy();
        }
        this.markers.removeAll();
    };

    MarkerLayer.prototype.destroy = function() {
        this.billboards.removeAll();
        this.labels.removeAll();
        var markers = this.markers.values;
        for(var index = 0 ; index < markers.length ; index++){
            markers[index].destroy();
        }
        this.markers.removeAll();
        destroyObject(this);
    };

    return MarkerLayer;
});
