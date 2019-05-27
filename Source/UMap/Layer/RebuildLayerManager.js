// eslint-disable-next-line no-undef
define(['../../Core/defaultValue',
    '../../Core/defined',
    '../../Core/DeveloperError',
    '../../Core/AssociativeArray',
    '../../Core/defineProperties',
    '../../Core/Rectangle',
    '../../Core/Math',
    '../../Scene/BillboardCollection',
    '../../Scene/LabelCollection',
    '../../Scene/PrimitiveCollection',
    '../Primitive/MarkerCollection',
    './RebuildLayer'
], function (defaultValue, defined, DeveloperError, AssociativeArray,
    defineProperties, Rectangle, CesiumMath, BillboardCollection, LabelCollection, PrimitiveCollection, MarkerCollection, RebuildLayer) {
    'use strict';

    var createLayer = {
        clusterPoint: createClusterPointLayer
        // point: createPointLayer,
        // polyline: createPolylineLayer,
        // polygon: createPolygonLayer,
        // model: createModelLayer,
        // tileSet: createTileLayer

    };
    //todo:这样声明，所有的实体类共同具有这一个对象.因此需注意初始化
    var WFS = {
        service: 'WFS',
        request: 'GetFeature',
        version: '1.0.0',
        outputformat: 'json',
        maxFeature: 50,
        typename: '',
        cql_filter: ''
    };

    function createClusterPointLayer(options) {
        options = defaultValue(options, {});
        return new RebuildLayer(options);
    }

    // function createPointLayer(options) {

    // }

    // function createPolylineLayer(options) {

    // }

    // function createPolygonLayer(options) {

    // }

    // function createModelLayer(options) {

    // }

    // function createTileLayer(options) {

    // }

    function RebuildLayerManager(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        if (!defined(options.viewer)) {
            throw new DeveloperError('Viewer is required !');
        }
        if (!defined(options.url)) {
            throw new DeveloperError('the URL with no params is required');
        }
        this._url = options.url;
        this.viewer = options.viewer;
        var scene = this.viewer.scene;
        this._layerList = new AssociativeArray();

        var billboards = new BillboardCollection({
            scene: scene
        });
        var labels = new LabelCollection({
            scene: scene
        });

        this._collection = new MarkerCollection(this.viewer, {
            labels: labels,
            billboards: billboards
        });

        this._primitives = new PrimitiveCollection();

        this._primitives.add(billboards);
        this._primitives.add(labels);
        scene.primitives.add(this._primitives);
    }

    defineProperties(RebuildLayerManager.prototype, {
        layers: {
            get: function () {
                return this._layerList;
            }
        },
        markers: {
            get: function () {
                return this._collection;
            }
        }
    });

    //圈选、框选
    RebuildLayerManager.prototype.search = function (rectangle, result) {
        if (!defined(result) || !(result instanceof Array)) {
            result = [];
        }
        if (!defined(rectangle) && rectangle instanceof Rectangle) {
            return result;
        }
        var markers = this.layers.values;
        //todo: 数据过多时，会导致阻塞。可优化
        for (var i = 0; i < markers.length; i++) {
            var layer = markers[i];
            layer.filter(rectangle, result);
        }
        return result;
    };

    /**
     * 添加图层
     * @method
     */
    RebuildLayerManager.prototype.addLayer = function (layer) {
        layer = defaultValue(layer, {});
        if (!defined(layer.code) || !(layer.code instanceof Array)) {
            return;
        }
        var code = layer.code;
        var show = layer.show;
        var id = code[0] + '_' + layer.layerName;

        //如果该markerLayer不显示，则清除该layer
        //如果显示，这判断该layerlist中是否有该layer
        if (!show) {
            this.remove(id);
            return;
        }

        if (this._layerList.contains(id)) {
            var markerLayer = this._layerList.get(id);
            if (!markerLayer._show) {
                markerLayer.init();
            }
            return;
        }
        var options = this._getMarkerLayerOptions(layer);
        options.id = id;
        this._createLayer(options);
    };

    //todo:未考虑点以外的其他
    /**
     * 和二维一样，根据传递过来的图层数组，绘制相应图层。该图层数组对应的是数据库中的一张表。部门名称对应的是
     * 表中的某个字段。通过部门名称查询相应的数据。表中的每一行对应的是一个Marker点。查询的所有满足要求的点共同
     * 构成一个MarkerLayer
     */
    RebuildLayerManager.prototype.addQueryLayer = function (layerInfo, callback) {
        layerInfo = defaultValue(layerInfo, {});
        if (!defined(layerInfo.code) || !(layerInfo.code instanceof Array)) {
            return;
        }
        var id = layerInfo.layerName; //数据库名称,对应与markerLayer的id
        if (this._layerList.contains(id)) {
            //todo:该图层已经存在。下一步对该图层所需显示的内容进行维护
            return;
        }
        var options = this._getMarkerLayerOptions(layerInfo);
        options.id = id;
        var markerLayer = new RebuildLayer(options);
        markerLayer.init(callback);
        this._layerList.set(options.id, markerLayer);
        layerInfo = null;
    };

    RebuildLayerManager.prototype._getMarkerLayerOptions = function (layerInfo) {
        layerInfo = defaultValue(layerInfo, {});
        var options = {};

        var layerName = defined(layerInfo.dataBaseSpace) ? layerInfo.dataBaseSpace + ':' + layerInfo.layerName : 'beyondb:' + layerInfo.layerName;
        var tableName = defaultValue(layerInfo.tableName, 'the_geom');

        var style = converToCesiumStyle(layerInfo.layerStyle);
        options.viewer = this.viewer;

        options.url = buildUrl(this._url, {
            codeName: layerInfo.codeName, //数据库中部门数组所对应的字段名
            code: layerInfo.code, //部门代号
            layerName: layerName,
            tableName: tableName
        }, getRangeParam(this.getCanvasGeoRange()));

        options.markerCollection = this._collection;

        options.name = layerInfo.name; //图层显示名称,对应与markerLayer的name
        options.type = layerInfo.type; //图层类别
        options.style = style; //样式
        options.labelField = layerInfo.labelField; //feater 对应的label字段名 eg. feature[labelField] 为所需显示的名字
        options.showLabel = layerInfo.showLabel; //是否显示字段名。对于聚合点该参数无效
        options.refresh = layerInfo.refreshable; //是否刷新该图层
        //todo:根据状态不同，图片选择不同的值
        options.imgPath = layerInfo.imgPath; //+ layerInfo.layerIcons[0];
        options.show = defaultValue(layerInfo.show, true);
        return options;
    };

    RebuildLayerManager.prototype._createLayer = function (options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var createHandler = createLayer[options.type];
        if (createHandler) {
            var layer = createHandler(options);
            this._layerList.set(layer.id, layer);
            layer.init();
        }
    };

    /**
     * 删除指定Layer
     * @param key
     * @method
     */
    RebuildLayerManager.prototype.remove = function (key) {
        if (this._layerList.contains(key)) {
            this._layerList.get(key).clear();
            //this._layerList.remove(key);
        }

    };

    RebuildLayerManager.prototype.removeLayers = function (collection) {
        if (!(collection instanceof Array)) {
            return;
        }
        for (var index = 0; index < collection.length; index++) {
            var key = collection[index].code[0] + '_' + collection[index].layerName;
            this.remove(key);
        }
    };
    /**
     * 删除所有Layer
     * @method
     */
    RebuildLayerManager.prototype.removeAll = function () {
        var layers = this._layerList.values;
        for (var i = 0; i < layers.length; i++) {
            layers[i].clear();
        }
        this._layerList.removeAll();
    };

    //获取屏幕经纬度
    RebuildLayerManager.prototype.getCanvasGeoRange = function () {
        var result = new Array(4);
        var rectangle = this.viewer.scene.camera.computeViewRectangle();

        result[0] = [CesiumMath.toDegrees(rectangle.west), CesiumMath.toDegrees(rectangle.south)];
        result[1] = [CesiumMath.toDegrees(rectangle.west), CesiumMath.toDegrees(rectangle.north)];
        result[2] = [CesiumMath.toDegrees(rectangle.east), CesiumMath.toDegrees(rectangle.north)];
        result[3] = [CesiumMath.toDegrees(rectangle.east), CesiumMath.toDegrees(rectangle.south)];

        return result;
    };

    function buildUrl(baseUrl, options, range /**@type {String}  */ ) {
        if (!defined(options.codeName)) {
            return undefined;
        }
        var count = options.code.length;

        var cql_filterStr = '(' + options.codeName + ' like' + " '%25" + options.code[0] + "%25' ";

        for (var i = 1; i < count; i++) {
            cql_filterStr += ' OR ' + options.codeName + ' like ' + "  '%25" + options.code[i] + "%25' ";
        }

        cql_filterStr += ')';
        cql_filterStr += ' AND INTERSECTS(' + options.tableName + ',' + range + ')';

        //var url = baseUrl + options.layerName + '&cql_filter=' + cql_filterStr;
        WFS.cql_filter = cql_filterStr;
        WFS.typename = options.layerName;
        return baseUrl + '?' + getQueryRequest(WFS);
    }

    function getRangeParam(points /**@type {Array} */ ) {
        var rang = 'POLYGON' + '((';
        points.push(points[0]);
        rang += arrayToString(points) + '))';
        return rang;
    }

    //todo:style 转换暂时未实现
    function converToCesiumStyle(options) {
        return options;
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

    function getQueryRequest(obj) {
        var request = '';
        for (var param in obj) {
            if (obj.hasOwnProperty(param)) {
                request += param + '=' + obj[param] + '&';
            }
        }
        return request.slice(0, -1);
    }
    return RebuildLayerManager;
});
