define(['../../Core/defined',
        '../../Core/createGuid',
        '../../Core/destroyObject',
        '../../Core/DeveloperError',
        '../../Core/defineProperties',
        '../../Core/defaultValue',
        '../../Core/Color',
        '../../Core/Cartesian2',
        '../../Core/Cartesian3',
        '../../Core/Cartographic',
        '../../Core/buildModuleUrl',
        '../../Core/Math',
        '../../Core/Rectangle',
        '../../Core/Ellipsoid',
        '../../Core/ScreenSpaceEventType',
        '../../Core/ScreenSpaceEventHandler',
        '../../Core/Transforms',
        '../../Core/getBaseUri',
        '../../Core/RequestScheduler',
        '../../Core/RequestType',
        '../../Core/HeadingPitchRoll',
        '../../Core/combine',
        '../../Scene/HeightReference',
        '../../Scene/VerticalOrigin',
        '../../Scene/HorizontalOrigin',
        '../../Scene/LabelStyle',
        '../../Scene/Model',
        '../../DataSources/Entity',
        '../../DataSources/CallbackProperty',
        '../../Renderer/Pass',
        '../defaultDescriptCallback',
        '../DrawingTypes',
        '../OptionsUtil'
    ],
    function (defined, createGuid, destroyObject, DeveloperError,
        defineProperties, defaultValue, Color,
        Cartesian2, Cartesian3, Cartographic,
        buildModuleUrl, CesiumMath, Rectangle,
        Ellipsoid, ScreenSpaceEventType, ScreenSpaceEventHandler,
        Transforms, getBaseUri, RequestScheduler,
        RequestType, HeadingPitchRoll,combine, HeightReference,
        VerticalOrigin, HorizontalOrigin, LabelStyle,
        Model, Entity, CallbackProperty,
        Pass, defaultDescriptCallback, DrawingTypes,OptionsUtil
    ) {
        'use strict';


        function ModelPrimitive(options) {
            options = defaultValue(options, defaultValue.EMPTY_OBJECT);

            if (!defined(options.viewer)) {
                throw new DeveloperError('Cesium Viewer is need !');
            }

            this._viewer = options.viewer;
            this._url = defaultValue(options.url, buildModuleUrl('Assets/Images/dinosaur.glb'));
            this._id = defaultValue(options.id, createGuid());
            this._description = defaultValue(options.properties, defaultValue.EMPTY_OBJECT);
            this._show = defaultValue(options.show, true);
            this._position = defaultValue(options.position, new Cartesian3(0, 0, 0));
            this._showLabel = defaultValue(options.showLabel, false);
            this._callback = defaultValue(options.callback, defaultDescriptCallback);

            this._heightReference = defaultValue(options.heightReference, HeightReference.CLAMP_TO_GROUND);
            this._heading = defaultValue(options.heading, 0);
            this._pitch = defaultValue(options.pitch, 0);
            this._roll = defaultValue(options.roll, 0);

            this._model = null;

            var model = {
                id: this._id,
                position: this._position,
                url: this._url,
                heading: this._heading,
                pithc: this._pitch,
                roll: this._roll
            };

            var modelStyle = defaultValue(options.modelStyle, OptionsUtil.billboard);
            var modelOptions = combine(model, modelStyle, false);

            var label = {
                position: this._position,
                text: this._description.name || '未命名'
            };

            var labelStyle = defaultValue(options.labelStyle, OptionsUtil.label);
            var labelOptions = combine(label, labelStyle, false);

            // if (this._showLabel) {
            //     addLabel(modelCollection, self, this._position, this._name, this._imageHeight, this._imageWidth);
            // }
            createModel(modelOptions, this);
        }

        function createModel(options, primitive) {
            options = options || {};
            var hpr = new HeadingPitchRoll(options.heading, options.pitch, options.roll);
            var modelMatrix = Transforms.headingPitchRollToFixedFrame(options.position, hpr);
            var model = Model.fromGltf({
                id: options.id,
                url: options.url,
                show: true,
                modelMatrix: modelMatrix,
                scale: options.scale,
                allowPicking: options.allowPicking,
                shadows: options.shadows,
                color: options.color,
                debugShowBoundingVolume: options.debugShowBoundingVolume

            });
            model._owner = primitive;
            primitive._model = model;
        }

        //TODO： Direction 未引用
        function addLabel(modelCollection, modelPrimitive, position, text, height, width) {
            var pixelOffset = Cartesian2.ZERO;
            var verticalOrigin = VerticalOrigin.BOTTOM;
            var horizontalOrigin = HorizontalOrigin.CENTER;
            // switch (modelPrimitive._direction) {
            //     case Direction.TOP:
            //         pixelOffset = new Cartesian2(-4, -height * modelPrimitive._scale - 3);
            //         verticalOrigin = VerticalOrigin.BOTTOM;
            //         break;
            //     case Direction.BOTTOM:
            //         pixelOffset = new Cartesian2(-4, 3);
            //         verticalOrigin = VerticalOrigin.TOP;
            //         break;
            //     case Direction.LEFT:
            //         pixelOffset = new Cartesian2(-width * modelPrimitive._scale / 2 - 3 - 4, 0);
            //         horizontalOrigin = HorizontalOrigin.RIGHT;
            //         break;
            //     case Direction.RIGHT:
            //         pixelOffset = new Cartesian2(width * modelPrimitive._scale / 2 - 4 + 3, 0);
            //         horizontalOrigin = HorizontalOrigin.LEFT;
            // }
            modelPrimitive._label = modelCollection._labels.add({
                position: position,
                text: text,
                font: modelPrimitive._font,
                fillColor: modelPrimitive._labelFillColor,
                outlineColor: modelPrimitive._labelFillColor,
                outlineWidth: modelPrimitive._labelOutlineWidth,
                style: LabelStyle.FILL,
                verticalOrigin: verticalOrigin,
                horizontalOrigin: horizontalOrigin,
                pixelOffset: pixelOffset,
                eyeOffset: Cartesian3.ZERO,
                backgroundColor: modelPrimitive._labelBackgroundColor,
                translucencyByDistance: modelPrimitive._translucencyByDistance,
                heightReference: HeightReference.NONE
            });
            modelPrimitive._label.markerPrimitive = modelPrimitive;
        }

        /**
         *
         * @param {Model} model
         * @param name
         * @param callback
         */
        function setListener(model, name, callback) {
            model[name] = callback;
        }

        /**
         * 便于 cesium.callbackProperty 调用callback函数
         * @param callback 回调函数
         * @param properties 回调函数的参数
         * @return {function(*, *): *}
         */
        function wrapperCallback(callback, properties) {
            return function () {
                return callback(properties);
            };
        }

        defineProperties(ModelPrimitive.prototype, {

            model: {
                get: function () {
                    return this._model;
                }
            },

            id : {
                get : function(){
                    return this._id;
                }
            },
            label: {
                get: function () {
                    return this._label;
                }
            },

            position: {
                get: function () {
                    return this._position;
                },
                set: function (position) {
                    if (defined(position)) {
                        this._position = position;
                        if (defined(this._label)) {
                            this._label.position = this._position;
                        }
                        if (defined(this._model)) {
                            var r = new HeadingPitchRoll(this._heading, this._pitch, this._roll);
                            this._model.modelMatrix = Transforms.headingPitchRollToFixedFrame(this._position, r);
                        }
                        this._cartographic = this.ellipsoid.cartesianToCartographic(this._position);
                    }
                }
            },

            heading: {
                get: function () {
                    return this._heading;
                },
                set: function (heading) {
                    if (defined(heading)) {
                        this._heading = heading;
                        if (defined(this._model)) {
                            var r = new HeadingPitchRoll(this._heading, this._pitch, this._roll);
                            this._model.modelMatrix = Transforms.headingPitchRollToFixedFrame(this._position, r);

                        }
                    }
                }
            },

            pitch: {
                get: function () {
                    return this._pitch;
                },
                set: function (pitch) {
                    if (defined(pitch)) {
                        this._pitch = pitch;
                        if (defined(this._model)) {
                            var r = new HeadingPitchRoll(this._heading, this._pitch, this._roll);
                            this._model.modelMatrix = Transforms.headingPitchRollToFixedFrame(this._position, r);
                        }
                    }
                }
            },

            roll: {
                get: function () {
                    return this._roll;
                },
                set: function (roll) {
                    if (defined(roll)) {
                        this._roll = roll;
                        if (defined(this._model)) {
                            var r = new HeadingPitchRoll(this._heading, this._pitch, this._roll);
                            this._model.modelMatrix = Transforms.headingPitchRollToFixedFrame(this._position, r);
                        }
                    }
                }
            },

            url: {
                get: function () {
                    return this._url;
                },
                set: function (url) {
                    if (this._url !== url) {
                        this._url = url;
                        var t = new HeadingPitchRoll(this._heading, this._pitch, this._roll);
                        var modelMatrix = Transforms.headingPitchRollToFixedFrame(this._position, t);
                        this._model = Model.fromGltf({
                            url: url,
                            show: true,
                            modelMatrix: modelMatrix,
                            scale: this._scale,
                            opaquePass: Pass.CESIUM_3D_TILE,
                            allowPicking: true,
                            shadows: this._shadows,
                            cull: false,
                            releaseGltfJson: true,
                            basePath: getBaseUri(url),
                            incrementallyLoadTextures: true,
                            debugShowBoundingVolume: false,
                            debugWireframe: false
                        });
                        this._model.markerPrimitive = this;
                    }
                }
            },

            description: {
                set: function (value) {
                    this._description = value;
                },
                get: function () {
                    var that = this;
                    return new CallbackProperty(wrapperCallback(that.callback, that._description), false);
                }
            },
            text: {
                get: function () {
                    return this._name;
                },
                set: function (name) {
                    this._name = name;
                    if (defined(this._label)) {
                        this._label.text = name;
                    }
                }
            },

            callback: {
                set: function (value) {
                    this._callback = value;
                },
                get: function () {
                    return this._callback || defaultDescriptCallback;
                }
            }
        });

        ModelPrimitive.prototype.updatePosition = function (lon, lat, height) {
            height = defaultValue(height, 0);
            this._cartographic = Cartographic.fromDegrees(lon, lat, height);
            this.position = Cartesian3.fromDegrees(lon, lat, height);
            this._content.lon = lon;
            this._content.lat = lat;
            this._heightMap = {};
            this.needToUpdatePosition = true;
            if (defined(this._modelCollection)) {
                this._modelCollection._viewer.scene.refreshOnce = false;
            }
        };

        ModelPrimitive.prototype.getType = function () {
            return this._drawingMode;
        };

        ModelPrimitive.prototype._containHeight = function (e) {
            return e in this._heightMap;
        };
        ModelPrimitive.prototype._pushHeight = function (e, t) {
            this._heightMap[e] = t;
        };
        ModelPrimitive.prototype._getHeight = function (e) {
            return this._heightMap[e];
        };

        ModelPrimitive.prototype.filter = function (e) {
            var drawingType = e.getType();
            var cartographic = this.ellipsoid.cartesianToCartographic(this.billboard.position);
            var offset = CesiumMath.EPSILON5;
            var bounding = new Rectangle(cartographic.longitude - offset, cartographic.latitude - offset, cartographic.longitude + offset, cartographic.latitude + offset);
            if (drawingType === DrawingTypes.DRAWING_POLYLINE || drawingType === DrawingTypes.DRAWING_POLYGON) {
                if (!defined(e.positions)) {
                    return false;
                }
                for (var a = 0; a < e.positions.length; a++) {
                    cartographic = this.ellipsoid.cartesianToCartographic(e.positions[a], cartographic);
                    if (Rectangle.contains(bounding, cartographic)) {
                        return true;
                    }
                }
            } else if (drawingType === DrawingTypes.DRAWING_MARKER) {
                if (defined(e.length)) {
                    for (var b = 0; b < e.length; b++) {
                        var s = e.get(b);
                        cartographic = this.ellipsoid.cartesianToCartographic(s.billboard.position, cartographic);
                        if (Rectangle.contains(bounding, cartographic)) {
                            return true;
                        }
                    }
                } else {
                    cartographic = this.ellipsoid.cartesianToCartographic(e.billboard.position, cartographic);
                    if (Rectangle.contains(bounding, cartographic)) {
                        return true;
                    }
                }
            } else if (drawingType === DrawingTypes.DRAWING_MODEL) {
                if (defined(e.length)) {
                    for (var i = 0; i < e.length; i++) {
                        var m = e.get(i);
                        cartographic = this.ellipsoid.cartesianToCartographic(m.position, cartographic);
                        if (Rectangle.contains(bounding, cartographic)) {
                            return true;
                        }
                    }
                } else {
                    cartographic = this.ellipsoid.cartesianToCartographic(e.position, cartographic);
                    if (Rectangle.contains(bounding, cartographic)) {
                        return true;
                    }
                }
            }
            return false;
        };

        ModelPrimitive.prototype.toLonLats = function (result) {
            var r = this.ellipsoid.cartesianToCartographic(this.position);
            if (defined(result)) {
                result.length = 1;
            } else {
                result = new Array(1);
            }
            result[0] = [CesiumMath.toDegrees(r.longitude), CesiumMath.toDegrees(r.latitude)];
            return result;
        };

        ModelPrimitive.prototype.setEditable = function (editable) {

            var drawingManager;
            editable = defaultValue(editable, true);
            this._editable = editable;

            if (defined(this.owner)) {
                drawingManager = this.owner;
                var me = this;
                if (editable) {
                    me.model.owner = drawingManager;
                    setListener(me.model, 'leftDown', function () {

                        var handler = new ScreenSpaceEventHandler(drawingManager._scene.canvas);

                        function onDrag(position) {
                            drawingManager._scene.refreshAlways = true;
                            me.position = position;
                        }

                        function onDragEnd(position) {
                            handler.destroy();
                            startDrawing(true);
                            drawingManager._dispatchOverlayEdited(me, {
                                name: 'dragEnd',
                                positions: position
                            });
                            drawingManager._scene.refreshAlways = false;
                        }

                        handler.setInputAction(function (movement) {
                            //var position = pickGlobe(drawingManager._scene, t.endPosition, void 0, me.heightOffset);
                            var position = self._scene.camera.pickEllipsoid(movement.endPosition, Ellipsoid.WGS84);

                            if (position) {
                                onDrag(position);
                            } else {
                                onDragEnd(position);
                            }

                        }, ScreenSpaceEventType.MOUSE_MOVE);

                        handler.setInputAction(function (movement) {
                            onDragEnd(self._scene.camera.pickEllipsoid(movement.position, Ellipsoid.WGS84));

                        }, ScreenSpaceEventType.LEFT_UP);

                        startDrawing(false);
                    });
                } else {
                    //removeListener(marker, 'leftDown');
                }
            }

            function startDrawing(enable) {
                drawingManager._scene.screenSpaceCameraController.enableRotate = enable;
            }

        };

        ModelPrimitive.prototype.isDestroyed = function () {
            return false;
        };

        return ModelPrimitive;
    });