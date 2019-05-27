// eslint-disable-next-line no-undef
define([
    '../../Core/defined',
    '../../Core/destroyObject',
    '../../Core/createGuid',
    '../../Core/Resource',
    '../../Core/combine',
    '../../Core/DeveloperError',
    '../../Core/defaultValue',
    '../../Core/defineProperties',
    '../../Core/Cartesian3',
    '../OptionsUtil',
    '../Primitive/MarkerCollection'
], function (defined,destroyObject, createGuid, Resource,combine, DeveloperError, defaultValue, defineProperties,
    Cartesian3,OptionsUtil, MarkerCollection) {
    'use strict';

    function RebuildLayer(options) {
        options = defaultValue(options, {});
        if (!defined(options.url)) {
            throw new DeveloperError('url is required to create MarkerLayer !');
        }
        this._url = options.url;

        if (!defined(options.viewer)) {
            throw new DeveloperError('viewer is required !');
        }
        this._id = defaultValue(options.id, createGuid());
        this.viewer = options.viewer;
        this._collection = defaultValue(options.markerCollection, new MarkerCollection(this.viewer));
        this._markeIds = [];

        this._name = defaultValue(options.name, '未命名');
        this._codeName = options.codeName;
        this._code = defaultValue(options.code, []);
        this._imgPath = options.imgPath;
        var type = options.type;
        this._type = type;
        this._labelField = defaultValue(options.labelField, '');
        this._showLabel = (type === 'clusterPoint' || this._labelField === '') ? false : defaultValue(options.showLabel, true);
        this._refresh = defaultValue(options.refresh, true);
        this._show = defaultValue(options.show, true);
        var style = defaultValue(options.style, {});
        var billboardOptions = defaultValue(style.billboardStyle, defaultValue.EMPTY_OBJECT);
        this._billboardStyle = combine(billboardOptions, OptionsUtil.billboard, false);
        var labelOptions = defaultValue(style.labelStyle, defaultValue.EMPTY_OBJECT);
        this._labelStyle = combine(labelOptions, OptionsUtil.label, false);

    }
    //todo:set 需同步更新
    defineProperties(RebuildLayer.prototype, {
        name: {
            get: function () {
                return this._name;
            }
        },
        id: {
            get: function () {
                return this._id;
            }
        },
        markerIds:{
            get:function(){
                return this._markeIds;
            }
        },
        refresh: {
            get: function () {
                return this._refresh;
            },
            set: function (flag) {
                this._refresh = flag;
            }
        },
        show: {
            get: function () {
                return this._show;
            },
            set: function (value) {
                this._show = value;
            }
        },
        type: {
            get: function () {
                return this._type;
            },
            set: function (value) {
                if (typeof value === 'string') {
                    this._type = value;
                }
            }
        }
    });

    RebuildLayer.prototype.init = function (callback, isthis) {

        var that = this;
        var temp = this._markeIds.splice(0);
        this._markeIds = [];
        fetchGeoJson(this._url).then(function (JsonObj) {
            var features = JsonObj.features;
            for (var i = 0; i < features.length; i++) {
                var position = Cartesian3.fromDegrees(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1], 0);
                var options = {
                    id: features[i].id,
                    viewer: that.viewer,
                    position: position,
                    properties: features[i].properties,
                    billboardStyle: that._billboardStyle,
                    labelStyle: that._labelStyle,
                    showLabel: that._showLabel,
                    show: that._show,
                    image: that._imgPath,
                    labelField: that.labelField
                };
                that._markeIds.push(options.id);
                //如果已经绘制，将不再重新绘制
                var index = temp.indexOf(options.id);
                if (-1 !== index) {
                    temp.splice(index, 1);
                    continue;
                }
                that._collection.add(options);
                that._show = true;
            }
            //删除不需要显示的
            for (var j = 0; j < temp.length; j++) {
                that._collection.remove(temp[j]);
            }
            if (typeof callback === 'function') {
                callback.apply(isthis, arguments);
            }
            features = null;
            JsonObj = null;
            temp = null;
        }).otherwise(function (error) {
            console.log(error);
        });
    };

    RebuildLayer.prototype.contains = function (key) {
        var index = this._markeIds.indexOf(key);
        if (-1 !== index) {
            return true;
        }
        return false;
    };

    RebuildLayer.prototype.clear = function () {
        for (var i = 0; i < this._markeIds.length; i++) {
            this._collection.removeById(this._markeIds[i]);
        }
        this._markeIds = [];
        this._show = false;
    };

    RebuildLayer.prototype.destroy = function () {
        this.clear();
        destroyObject(this);
    };

    RebuildLayer.prototype.filter = function (rectangle, result) {
        if (!defined(result) || !(result instanceof Array)) {
            result = [];
        }
        var markers = this._markeIds;
        for (var i = 0; i < markers.length; i++) {
            var p =  this._collection.get[i];
            if (p.filter(rectangle)) {
                result.push(p);
            }
        }
        return result;
    };

    //请求获取json
    function fetchGeoJson(url) {
        var resource = Resource.createIfNeeded(url);
        return resource.fetchJson();
    }

    return RebuildLayer;
});
