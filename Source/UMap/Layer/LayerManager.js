define(['../../Core/defaultValue',
        '../../Core/defined',
        '../../Core/DeveloperError',
        '../../Core/AssociativeArray',
        '../../Core/defineProperties',
        '../../Core/PinBuilder',
        '../../Core/Color',
        '../../Scene/BillboardCollection',
        '../../Scene/LabelCollection',
        '../../Scene/VerticalOrigin',
        '../../DataSources/EntityCluster',
        './MarkerLayer'
], function(defaultValue, defined, DeveloperError, AssociativeArray,
            defineProperties, PinBuilder, Color, BillboardCollection, LabelCollection, VerticalOrigin,
            EntityCluster, MarkerLayer) {
    'use strict';

    var createLayer = {
        clusterPoint : createClusterPointLayer,
        point : createPointLayer,
        polyline : createPolylineLayer,
        polygon : createPolygonLayer,
        model : createModelLayer,
        tileSet : createTileLayer

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
        return function(amount) {
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

    function initClustering(cluster) {
        cluster.enabled = true;
        cluster.pixelRange = 15;
        cluster.minimumClusterSize = 3;
        var pinBuilder = new PinBuilder();
        cluster.clusterEvent.addEventListener(function(clusteredEntities, cluster) {
            cluster.label.show = false;
            cluster.billboard.show = true;
            cluster.billboard.id = cluster.label.id;
            cluster.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
            cluster.billboard.image = pinBuilder.fromText(cluster.label._text, Color.RED, 48).toDataURL();
        });

        var pixelRange = cluster.pixelRange;
        cluster.pixelRange = 0;
        cluster.pixelRange = pixelRange;
    }

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
            throw  new DeveloperError('the URL with no params is required');
        }
        this._url = options.url;
        this._viewer = options.viewer;
        var scene = this._viewer.scene;
        this._layerList = new AssociativeArray();

        this._billboardCollection = new BillboardCollection({
            scene : scene
        });
        this._labelCollection = new LabelCollection({
            scene : scene
        });

        this._clusterBillboardCollection = new BillboardCollection({
            scene : scene
        });

        this.clustering = new EntityCluster();
        this.clustering._initialize(scene);
        this.clustering._billboardCollection = this._billboardCollection;
        this.clustering._clusterBillboardCollection = this._clusterBillboardCollection;
        initClustering(this.clustering);

        scene.primitives.add(this.clustering);
        var refresh = refreshCollection(this);
        scene.camera.changed.addEventListenerTop(refresh);
    }

    defineProperties(LayerManager.prototype, {
        layers : {
            get : function() {
                return this._layerList;
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
        }
    });

    /**
     * 添加Layer
     * @param key
     * @param value
     * @method
     */
    LayerManager.prototype.add = function(key, value) {
        this._layerList.set(key, value);
    };

    /**
     *
     * @param collection = []
     * @param [{layer.layerCategory}]
     */
    LayerManager.prototype.addCollection = function(collection) {
        if (!(collection instanceof Array)) {
            return;
        }
        for (var index = 0; index < collection.length; index++) {
            var layer = collection[index];
            var code = layer.code;
            layer.id = code[0] + '_' + layer.layerCategory;
            if (this._layerList.contains(layer.id)) {
                this._billboardCollection.removeAll();
                this._layerList.get(layer.id)._init(this._billboardCollection);
                break;
            }
            layer.codeNum = code[0];
            layer.url = this._url;
            layer.viewer = this._viewer;
            layer.dataBaseSpace = 'beyondb';
            layer.tableName = 'the_geom';
            layer.billboards = this._billboardCollection;
            layer.labels = this._labelCollection;
            this._createLayer(layer);
            // for(var i = 0 ; i < code.length ; i++){
            //     layer.id = code[i] + '_' + layer.layerCategory;
            //     if(this._layerList.contains(layer.id)){
            //         break;
            //     }
            //     layer.codeNum = code[i];
            //     this._createLayer(layer);
            // }
        }
    };

    LayerManager.prototype._createLayer = function(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var createHandler = createLayer[options.type];
        if (createHandler) {
            var layer = createHandler(options);
            this._layerList.set(layer.id, layer);
            layer.init(this._renderDone, this);
        }
    };

    LayerManager.prototype._renderDone = function(layerManager) {
        current++;
        if (current >= layerManager._layerList.length) {
            current = 0;
            layerManager.clustering._clusterDirty = true;
        }
    };

    /**
     * 删除指定Layer
     * @param key
     * @method
     */
    LayerManager.prototype.remove = function(key) {

    };
    /**
     * 删除所有Layer
     * @method
     */
    LayerManager.prototype.removeAll = function() {
        var layers = this.layers.values;
        for(var i = 0; i < layers.length ; i++){
            layers[i].clear();
        }
    };
    /**
     * Layer显示/隐藏
     * @param key
     * @param isVisible
     * @method
     */
    LayerManager.prototype.setVisible = function(key, isVisible) {

    };

    return LayerManager;
});
