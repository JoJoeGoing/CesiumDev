/*global Cesium */
/*eslint-env browser*/
function _createImageryProvider(options) {
    options = Cesium.defaultValue(options, {});
    var request = options.request;
    var url = options.url;
    if (!Cesium.defined(request) || !Cesium.defined(url)) {
        return null;
    }
    var provider = null;
    switch (request) {
        case 'WMS':
            provider = new Cesium.WebMapServiceImageryProvider({
                url: url,
                layers: options.layers,
                parameters: {
                    format: options.format || 'image/jpeg',
                    transparent: options.transparent || false
                },
                minimumLevel: options.minimumLevel || 0,
                maximumLevel: options.maximumLevel,
                enablePickFeatures: false
            });
            break;
        case 'XYZ':
            provider = new Cesium.UrlTemplateImageryProvider({
                url: url,
                enablePickFeatures: false,
                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                hasAlphaChannel: options.transparent || false
            });
            break;
    }
    return provider;
}
function CZMTools(id, baseImageryOptions) {
    if (!Cesium.defined(id)) {
        throw ('id is required');
    }
    this._id = id;

    this._baselayer = baseImageryOptions;
    var provider = _createImageryProvider(baseImageryOptions);

    var layer = Cesium.defined(provider) ? provider : new Cesium.UrlTemplateImageryProvider({
        url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII/') + '{z}/{x}/{reverseY}.jpg',
        tilingScheme: new Cesium.GeographicTilingScheme(),
        maximumLevel: 2
    });

    var viewer = new Cesium.Viewer(id, {
        imageryProvider: layer,
        baseLayerPicker: false,
        animation: false,
        timeline: false,
        homeButton: false,
        geocoder: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        scene3DOnly: true,
        infoBox: true,
        selectionIndicator: false,
        contextOptions: {
            allowTextureFilterAnisotropic: false,
            webgl: {
                preserveDrawingBuffer: true
            }
        }
    });
    this._viewer = viewer;
    this._viewer.scene.fog.enabled = false;
    this._viewer.scene.globe.depthTestAgainstTerrain = false;
    this._imageryLayers = viewer.scene.imageryLayers;
    this._mousePositionHandler = null;
    this._mouse = {};

    this._drawingManager = new Cesium.DrawingManager(viewer);

    this.mapCenter = null;

}
Object.defineProperties(CZMTools.prototype, {
    mousePosition: {
        get: function () {
            return this._mouse;
        }
    },
    viewer: {
        get: function () {
            return this._viewer;
        }
    },
    imageryLayers: {
        get: function () {
            return this._imageryLayers;
        }
    }
});
/**
 *
 * @param lon
 * @param lat
 * @param height
 * @param pitch
 */
CZMTools.prototype.flyTo = function (lon, lat, height, pitch) {
    if (typeof (lon) === 'undefined' || typeof (lat) === 'undefined' || isNaN(lon) || isNaN(lat)) {
        return;
    }

    if (typeof (height) === 'undefined') {
        var cameroCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(this.viewer.camera.position);
        height = cameroCartographic.height;
    }

    if (typeof (pitch) === 'undefined') {
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, height)
        });
    } else {
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(pitch),
                roll: 0.0
            }
        });
    }
};

/**
 * 更改基础图层
 */
CZMTools.prototype.exchangeBaseLayer = function (options) {
    //todo:当初始化未传值时，会使用默认但此时this._baseLayer没值
    if (this._baselayer) {
        this.imageryLayers.remove(this.imageryLayers.get(0), true);
    }

    if (!Cesium.defined(options)) {
        //取消所有底图
        this._baselayer = null;
        return;
    }
    var imagelayer = new Cesium.ImageryLayer(this._createImageryProvider(options), {
        show: true,
        name: '基础图层'
    });

    this.viewer.imageryLayers.add(imagelayer, 0);
    this._baselayer = options;

    //添加影像图、路网等。不包括倾斜摄影图层
    CZMTools.prototype.addLayer = function (options, name, alpha, show) {
        var provider = _createImageryProvider(options);
        if (Cesium.defined(provider)) {
            var layer = this._imageryLayers.addImageryProvider(provider);
            layer.alpha = Cesium.defaultValue(alpha, 0.5);
            layer.show = Cesium.defaultValue(show, true);
            layer.name = name || 'default name';
            Cesium.knockout.track(layer, ['alpha', 'show', 'name']);
        }
    };

    CZMTools.prototype.showMousePosition = function () {
        var viewer = this._viewer;
        var self = this;

        this._mousePositionHandler = this._mousePositionHandler && this._mousePositionHandler.destory();
        this._mousePositionHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        this._mousePositionHandler.setInputAction(function (movement) {

                var position = viewer.scene.pickPosition(movement.endPosition);
                if (!position) {
                    var ray = viewer.camera.getPickRay(movement.endPosition);
                    position = viewer.scene.globe.pick(ray, viewer.scene);
                }
                if (position) {
                    var p = Cesium.Cartographic.fromCartesian(position);

                    self._mouse.longitude = Cesium.Math.toDegrees(p.longitude);
                    self._mouse.latitude = Cesium.Math.toDegrees(p.latitude);
                    self._mouse.height = p.height;
                }
            },
            Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };
};
