/* eslint-disable no-undef */

// eslint-disable-next-line strict
'use strict';
var ctrl = new Map3DCtrl();

function Map3DCtrl(options) {
    if (options === undefined || options.id === undefined) {
        throw new Error('id is required !');
    }
    this._div = options.id;
    this._mapServer = options.url;
    this.viewer = undefined;

    Map3DCtrl.prototype.initMap = function() {
        if (this.viewer) {
            return this.viewer;
        }

        this.viewer = new Cesium.Viewer(this._div, {
            baseLayerPicker: false,
            animation: false,
            timeline: false,
            homeButton: false,
            geocoder: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            scene3DOnly: true,
            infoBox: true,
            contextOptions: {
                allowTextureFilterAnisotropic: false,
                webgl: {
                    preserveDrawingBuffer: true
                }
            }
        });

        this.viewer.scene.fog.enabled = false;
        this.viewer.scene.globe.depthTestAgainstTerrain = false;
    };

    //TODO:多影像图切换，后期在处理，可考虑使用配置文件
    Map3DCtrl.prototype.addImageryProvider = function(provider) {
        if (this.viewer) {
            this.viewer.scene.imageryLayers.addImageryProvider(provider);
        }
    };

    Map3DCtrl.prototype.addTerrainProvider = function(provider){
        if(this.viewer){
            this.viewer.addTerrainProvider(provider);
        }
    };

    Map3DCtrl.prototype.flyTo = function(lat, lon, height, pitch) {
        if (typeof(lon) === 'undefined' || typeof(lat) === 'undefined' || isNaN(lon) || isNaN(lat)) {
            // eslint-disable-next-line no-alert
            alert('经纬度不能为空！！！');
            return;
        }

        if (typeof(height) === 'undefined') {
            height = 1000;
        }

        if (typeof(pitch) === 'undefined') {
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
     * @method 获取当前屏幕经纬度
     */


    /**
     *
     * @param points
     * @returns {string}
     * @example
     * var point = [
     *  [lat,lng],
     *  [lat,lng]
     * ]
     */

}




/**
 * 点图层，包含有多个绘制点。可以将其看作是一个PrimitiveCollection
 * 替代之前的MarkeCollection
 * @param {*} options
 * @param {*} billboardCollection
 */
function MarkerLayer(options,billboardCollection){
    options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

    if(options.viewer === undefined){
        throw new Cesium.DeveloperError('viewer is reqired !');
    }

    var lon = Cesium.defaultValue(options.lon,0);
    var lat = Cesium.defaultValue(options.lat,0);
    var height = Cesium.defaultValue(options.height,0);
    this._position = Cesium.Cartesian3.fromDegrees(lon,lat,height);

    this._showLabel = Cesium.defaultValue(options.showLabel,true);
    this._selectedCallbak = Cesium.defaultValue(options.selectedCallbak,defaultSelectedCallback);
    this._description = Cesium.defaultValue(options.description,{});

    this._label = undefined;
    this._billboardCollection = billboardCollection;

    function defaultSelectedCallback(options) {
        var html = '';
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                var n = options[option];
                html += 'object' === typeof n ? '<tr><th>' + option + '</th><td>' + defaultCallback(n) + '</td></tr>' : '<tr><th>' + option + '</th><td>' + n + '</td></tr>';
            }
        }
        if (html.length > 0) {
            html = '<table class="cesium-infoBox-defaultTable"><tbody>' + html + '</tbody></table>';
        }
        return html;
    }
}
