define(['../../Core/defaultValue',
    '../../Core/defined',
    '../../Core/DeveloperError',
    '../../Core/AssociativeArray',
    '../../Core/defineProperties',
    '../../Core/PinBuilder',
    '../../Core/Color',
    '../../Core/Rectangle',
    '../../Scene/BillboardCollection',
    '../../Scene/LabelCollection',
    '../../Scene/VerticalOrigin',
    '../../Scene/PrimitiveCollection',
    '../../DataSources/EntityCluster',
    './MarkerLayer',
    './Layer'
], function (defaultValue, defined, DeveloperError, AssociativeArray,
    defineProperties, PinBuilder, Color, Rectangle, BillboardCollection, LabelCollection, VerticalOrigin, PrimitiveCollection,
    EntityCluster, MarkerLayer,Layer) {
    'use strict';

    var createLayer = {
        clusterPoint: createClusterPointLayer,
        point: createPointLayer,
        polyline: createPolylineLayer,
        polygon: createPolygonLayer,
        model: createModelLayer,
        tileSet: createTileLayer

    };

    var current = 0;

    function createClusterPointLayer(options) {
        options = defaultValue(options, {});
        return new MarkerLayer(options);
    }

    function createPointLayer(options) {

    }

    function createPolylineLayer(options) {

    }

    function createPolygonLayer(options) {

    }

    function createModelLayer(options) {

    }

    function createTileLayer(options) {

    }

    function refreshCollection(layerManager) {
        return function (amount) {
            if ((defined(amount) && amount < 0.05)) {
                return;
            }
            var billboardCollection = layerManager._billboardCollection;
            var clusteringBillboardCollection = layerManager._clusterBillboardCollection;
            if (!defined(billboardCollection) && !defined(clusteringBillboardCollection)) {
                return;
            }
            layerManager.removeAll();
            var layers = layerManager._layerList.values;
            for (var index = 0; index < layers.length; index++) {
                layers[index].init(layerManager._renderDone, layerManager);
            }
        };
    }

    // function initClustering(cluster) {
    //     cluster.enabled = true;
    //     cluster.pixelRange = 15;
    //     cluster.minimumClusterSize = 3;
    //     var pinBuilder = new PinBuilder();
    //     cluster.clusterEvent.addEventListener(function(clusteredEntities, cluster) {
    //         cluster.label.show = false;
    //         cluster.billboard.show = true;
    //         cluster.billboard.id = cluster.label.id;
    //         cluster.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
    //         cluster.billboard.image = pinBuilder.fromText(cluster.label._text, Color.RED, 48).toDataURL();
    //     });

    //     var pixelRange = cluster.pixelRange;
    //     cluster.pixelRange = 0;
    //     cluster.pixelRange = pixelRange;
    // }
    //ToDo:聚合导致显示隐藏有Bug
    /**
     * 管理所有的图层。每个图层一般版含有多个最小的绘制单元。例如：LayerManager中有公安局1的枪机、公安局1的球机、公安局2的枪机、公安局2的球机。
     * 公安局1的枪机是一个图层，公安局2的枪机也是一个图层。枪机/球机图层均包含有多个枪机/球机。
     * 集成了之前LayerFactory全部功能
     * @param {*} options
     * @constructor
     */
    function LayerManager(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        if (!defined(options.viewer)) {
            throw new DeveloperError('Viewer is required !');
        }
        if (!defined(options.url)) {
            throw new DeveloperError('the URL with no params is required');
        }
        this._url = options.url;
        this._viewer = options.viewer;
        var scene = this._viewer.scene;
        this._layerList = new AssociativeArray();

        this._billboardCollection = new BillboardCollection({
            scene: scene
        });
        this._labelCollection = new LabelCollection({
            scene: scene
        });

        this._primitives = new PrimitiveCollection();

        this._primitives.add(this._billboardCollection);
        this._primitives.add(this._labelCollection);
        scene.primitives.add(this._primitives);

        //todo:聚合没实现，可针对不同的markerLayer实现
        // this._clusterBillboardCollection = new BillboardCollection({
        //     scene : scene
        // });

        // this.clustering = new EntityCluster();
        // this.clustering._initialize(scene);
        // this.clustering._billboardCollection = this._billboardCollection;
        // this.clustering._clusterBillboardCollection = this._clusterBillboardCollection;
        // initClustering(this.clustering);

        //scene.primitives.add(this.clustering);
        //var refresh = refreshCollection(this);
        //scene.camera.changed.addEventListenerTop(refresh);
    }

    defineProperties(LayerManager.prototype, {
        layers: {
            get: function () {
                return this._layerList;
            }
        },
        billboards: {
            get: function () {
                return this._billboardCollection;
            }
        },
        labels: {
            get: function () {
                return this._labelCollection;
            }
        }
    });

    /**
     * 添加Layer
     * @param key
     * @param value
     * @method
     */
    LayerManager.prototype.add = function (key, value) {
        this._layerList.set(key, value);
    };

    LayerManager.prototype.search = function (rectangle, result) {
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
     * 老版本图层数组加载，每个最小字节点对应与一个MarkerLayer
     * @param collection = []
     * @param [{layer.layerCategory}]
     */
    LayerManager.prototype.addCollection = function (collection) {
        if (!(collection instanceof Array)) {
            return;
        }
        for (var index = 0; index < collection.length; index++) {
            var layer = collection[index];
            var code = layer.code;
            var show = layer.show;
            var id = code[0] + '_' + layer.layerName;
            //如果该markerLayer不显示，则清除该layer
            //如果显示，这判断该layerlist中是否有该layer
            if (!show) {
                this.remove(id);
                continue;
            }
            if (this._layerList.contains(id)) {
                var markerLayer = this._layerList.get(id);
                if(!markerLayer._show){
                    markerLayer.init();
                }
                continue;
            }
            layer.id = id;
            layer.codeNum = code[0];
            layer.url = this._url;
            layer.viewer = this._viewer;
            layer.dataBaseSpace = 'beyondb';
            layer.tableName = 'the_geom';
            layer.billboards = this._billboardCollection;
            layer.labels = this._labelCollection;
            this._createLayer(layer);
        }
    };

    //todo:未考虑点以外的其他
    /**
     * 和二维一样，根据传递过来的图层数组，绘制相应图层。该图层数组对应的是数据库中的一张表。部门名称对应的是
     * 表中的某个字段。通过部门名称查询相应的数据。表中的每一行对应的是一个Marker点。查询的所有满足要求的点共同
     * 构成一个MarkerLayer
     */
    LayerManager.prototype.addQueryLayer = function(layerInfo,callback){
        var options = {};
        options.url = this._url;
        options.code = layerInfo.code;//部门数组的值
        options.name = layerInfo.name; //图层显示名称,对应与markerLayer的name
        options.id = layerInfo.layerName; //数据库名称,对应与markerLayer的id
        options.type = layerInfo.type;//图层类别
        options.style = layerInfo.layerStyle;//样式
        options.codeName = layerInfo.codeName;//数据库中部门数组所对应的字段名
        options.labelField = layerInfo.labelField;//feater 对应的label字段名 eg. feature[labelField] 为所需显示的名字
        options.showLabel = layerInfo.showLabel;//是否显示字段名。对于聚合点该参数无效
        options.refresh = layerInfo.refreshable;//是否刷新该图层

        if(this._layerList.contains(options.id)){
            //todo:该图层已经存在。下一步对该图层所需显示的内容进行维护
            return;
        }
        //this._createLayer(layer);
    };

    LayerManager.prototype._createLayer = function (options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var createHandler = createLayer[options.type];
        if (createHandler) {
            var layer = createHandler(options);
            this._layerList.set(layer.id, layer);
            layer.init(this._renderDone, this);
        }
    };

    LayerManager.prototype._renderDone = function (layerManager) {
        // current++;
        // if (current >= layerManager._layerList.length) {
        //     current = 0;
        //     layerManager.clustering._clusterDirty = true;
        // }
    };

    /**
     * 删除指定Layer
     * @param key
     * @method
     */
    LayerManager.prototype.remove = function (key) {
        if (this._layerList.contains(key)) {
            this._layerList.get(key).clear();
            //this._layerList.remove(key);
        }

    };

    LayerManager.prototype.removeLayers = function (collection) {
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
    LayerManager.prototype.removeAll = function () {
        var layers = this._layerList.values;
        for (var i = 0; i < layers.length; i++) {
            layers[i].clear();
        }
        this._layerList.removeAll();
    };
    /**
     * Layer显示/隐藏
     * @param key
     * @param isVisible
     * @method
     */
    LayerManager.prototype.setVisible = function (key, isVisible) {

    };

    return LayerManager;
});
