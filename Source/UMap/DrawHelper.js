/*global document*/
// eslint-disable-next-line no-undef
define(['../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/createGuid',
        '../Core/Cartesian3',
        '../Core/Math',
        '../Core/Ellipsoid',
        '../Core/EllipsoidGeodesic',
        '../Core/ScreenSpaceEventHandler',
        '../Core/ScreenSpaceEventType',
        '../Core/Rectangle',
        '../Core/Cartographic',
        '../Core/AssociativeArray',
        '../Scene/PrimitiveCollection',
        '../Scene/BillboardCollection',
        '../Scene/LabelCollection',
        '../Scene/Cesium3DTileset',
        './DrawingTypes',
        './Primitive/CirclePrimitive',
        './Primitive/RectanglePrimitive',
        './Primitive/PolylinePrimitive',
        './Primitive/PolygonPrimitive',
        './Primitive/Marker',
        './Primitive/ModelPrimitive',
        './pickGlobe',
        './PolygonArea'
    ],
    function (defined, defineProperties,
        DeveloperError, createGuid,
        Cartesian3, CesiumMath, Ellipsoid, EllipsoidGeodesic,
        ScreenSpaceEventHandler, ScreenSpaceEventType, Rectangle,
        Cartographic, AssociativeArray, PrimitiveCollection, BillboardCollection, LabelCollection, Cesium3DTileset,
        DrawingTypes, CirclePrimitive, RectanglePrimitive, PolylinePrimitive, PolygonPrimitive, Marker, ModelPrimitive, pickGlobe, PolygonArea) {

        var ellipsoid = Ellipsoid.WGS84;

        var drawHandler = {
            circle: drawCircle,
            polyline: drawPolyline,
            rectangle: drawRectangle,
            polygon: drawPolygon,
            marker: drawMarker,
            model: drawModel
        };

        function DrawHelper(cesiumView) {
            if (!defined(cesiumView)) {
                throw new DeveloperError('viewer is required.');
            }
            this._viewer = cesiumView;
            this._scene = cesiumView.scene;
            this._showTooltip = true;
            this._id = createGuid();
            this._reDraw = false;

            //绘制过程中的所有billboard的集合
            this._billboardCollection = this._scene.primitives.add(new BillboardCollection({
                scene: this._scene
            }));

            //绘制过程中的所有label的集合
            this._labelCollection = this._scene.primitives.add(new LabelCollection({
                scene: this._scene
            }));

            //存放绘制的二维点，key-value. key是该点的id
            this._markerCollection = new AssociativeArray();

            //存放绘制的三维模型
            this._modelCollection = new AssociativeArray();

            var collection = new PrimitiveCollection();
            this._scene.primitives.add(collection);
            this._drawPrimitives = collection;

            this._drawingMode = DrawingTypes.DRAWING_NONE;

            this._tooltip = createToolTip(cesiumView.container);

            this._markers = undefined;

            this._mouseHandler = undefined;

            this._cleanUp = null;

            this._editedShape = null;
            this._initialiseHandlers();
        }

        defineProperties(DrawHelper.prototype, {
            container: {
                get: function () {
                    return this._container;
                }
            },
            drawPrimitives: {
                get: function () {
                    return this._drawPrimitives;
                }
            },
            scene: {
                get: function () {
                    return this._scene;
                }
            },
            viewer: {
                get: function () {
                    return this._viewer;
                }
            },
            markers: {
                get: function () {
                    return this._markerCollection;
                }
            },
            models: {
                get: function () {
                    return this._modelCollection;
                }
            },
            dragEndEvent: {
                get: function () {
                    return this._dragEndEvent;
                }
            },
            toolTip: {
                get: function () {
                    return this._tooltip;
                }
            }
        });

        /**
         * 初始化处理鼠标事件
         * @method
         */
        DrawHelper.prototype._initialiseHandlers = function () {

            var pickedObject;
            var mouseOutObject;
            var scene = this._scene;
            //var viewer = this._viewer;
            var self = this;
            var isNotLeftUp = true;
            var handler = new ScreenSpaceEventHandler(scene.canvas);

            handler.setInputAction(function (movement) {
                if (true !== self._handlersMuted && 0 !== self._drawPrimitives.length && pickedObject && isNotLeftUp) {
                    if (mouseOutObject && (!pickedObject || mouseOutObject !== pickedObject.primitive)) {

                        if (!(mouseOutObject.isDestroyed && mouseOutObject.isDestroyed())) {
                            mouseOutObject.mouseOut(movement.endPosition);
                        }
                        mouseOutObject = null;
                    }
                    if (pickedObject && pickedObject.primitive) {
                        pickedObject = pickedObject.primitive;
                        if (pickedObject.mouseOut) {
                            mouseOutObject = pickedObject;
                        }
                        if (pickedObject.mouseMove) {
                            pickedObject.mouseMove(movement.endPosition);
                        }
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            handler.setInputAction(function (movement) {
                if (true !== self._handlersMuted) {
                    callPrimitiveCallback('leftUp', movement.position);
                }
            }, ScreenSpaceEventType.LEFT_UP);

            handler.setInputAction(function (movement) {
                if (true !== self._handlersMuted) {
                    callPrimitiveCallback('leftDown', movement.position);
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            // viewer.screenSpaceEventHandler.setInputAction(function (movement) {
            //     var pick = scene.pick(movement.position);
            //     if (defined(pick) && defined(pick.primitive) && defined(pick.primitive.markerPrimitive)) {
            //         viewer.selectedEntity = pick.primitive.markerPrimitive;
            //     }
            // }, ScreenSpaceEventType.LEFT_CLICK);

            function callPrimitiveCallback(name, position) {
                if (true !== self._handlersMuted) {
                    isNotLeftUp = true;
                    if ('leftUp' === name) {
                        isNotLeftUp = false;
                        return isNotLeftUp;
                    }
                    if (pickedObject && pickedObject.primitive && pickedObject.primitive.markerPrimitive) {
                        self._dragEndEvent.raiseEvent(pickedObject.primitive.markerPrimitive);
                    }
                    pickedObject = scene.pick(position);
                    if (pickedObject && pickedObject.primitive && pickedObject.primitive[name]) {
                        pickedObject.primitive[name](position);
                    }
                }
            }
        };

        DrawHelper.prototype.setListener = function (primitive, type, callback) {
            primitive[type] = callback;
        };

        DrawHelper.prototype._muteHandlers = function (mute) {
            this._handlersMuted = mute;
        };
        // register event handling for an editable shape
        // shape should implement setEditMode and setHighlighted
        DrawHelper.prototype.registerEditableShape = function (shape) {
            var _self = this;

            // handlers for interactions
            // highlight polygon when mouse is entering
            setListener(shape, 'mouseMove', function (position) {
                shape.setHighlighted(true);
                if (!shape._editMode) {
                    _self._tooltip.showAt(position, 'Click to edit this shape');
                }
            });
            // hide the highlighting when mouse is leaving the polygon
            setListener(shape, 'mouseOut', function () {
                shape.setHighlighted(false);
                _self._tooltip.setVisible(false);
            });
            setListener(shape, 'leftClick', function () {
                shape.setEditMode(true);
            });
        };

        DrawHelper.prototype.draw = function (type, options, callback, saveToBuffer) {
            if (typeof type === 'string') {
                type = type.toLowerCase();
                var method = drawHandler[type];
                if (method) {
                    options = options || {};
                    options.properties = options.properties || {};
                    if (typeof saveToBuffer !== 'boolean') {
                        saveToBuffer = false;
                    }
                    method(this, options, callback, saveToBuffer);
                }
            }

        };

        DrawHelper.prototype.showTooltip = function (visible) {
            this._showTooltip = visible;
        };

        DrawHelper.prototype.startDrawing = function (cleanUp) {
            var that = this;
            if (this._cleanUp) {
                this._cleanUp();
            }
            this._cleanUp = cleanUp;
            this._muteHandlers(true);
            this._tooltip.setVisible(true);

            this._scene.screenSpaceCameraController.enableLook = false;
            this._scene.screenSpaceCameraController.enableTilt = false;
            this._scene.screenSpaceCameraController.enableRotate = false;

            this._mouseHandler = this._mouseHandler && this._mouseHandler.destroy();
            this._mouseHandler = new ScreenSpaceEventHandler(this._scene.canvas);
            this._mouseHandler.setInputAction(function () {
                that.closeDraw();
            }, ScreenSpaceEventType.RIGHT_CLICK);
            this.removeInputActions();
        };

        DrawHelper.prototype.stopDrawing = function () {
            if (this._cleanUp) {
                this._cleanUp();
            }
            this._cleanUp = null;

            this._tooltip.setVisible(false);
            this._scene.refreshOnce = true;

            this._muteHandlers(false);

        };

        DrawHelper.prototype.closeDraw = function () {

            this._mouseHandler = this._mouseHandler && this._mouseHandler.destroy();
            this._tooltip.setVisible(false);
            if (this._cleanUp) {
                this._cleanUp();
            }
            this._cleanUp = null;

            if (defined(this._scene)) {
                this._scene.screenSpaceCameraController.enableLook = true;
                this._scene.screenSpaceCameraController.enableTilt = true;
                this._scene.screenSpaceCameraController.enableRotate = true;
                this._scene.refreshAlways = false;
            }
            if (defined(this._viewer)) {
                this._viewer.enableInfoOrSelection = true;
                this.removeInputActions();
                this.setInputActions();
                this._scene.refreshOnce = true;
            }
        };

        //todo: has problem
        DrawHelper.prototype.setHighlighted = function (shape) {
            if (this._highlightedSurface && !this._highlightedSurface.isDestroyed() && this._highlightedSurface !== shape) {
                this._highlightedSurface.setHighlighted(false);
            }
            this._highlightedSurface = shape;
        };

        // make sure only one shape is highlighted at a time
        DrawHelper.prototype.disableAllHighlights = function () {
            this.setHighlighted(undefined);
        };

        DrawHelper.prototype.disableAllEditMode = function () {
            this.setEdited(undefined);
        };

        DrawHelper.prototype.setEdited = function (shape) {
            if (this._editedShape && !this._editedShape.isDestroyed()) {
                this._editedShape.setEditMode(false);
            }
            this._editedShape = shape;
        };

        /****************************************************************************************/
        //TODO: need  change
        DrawHelper.prototype.setInputActions = function () {
            // var viewer = this._viewer;
            // var scene = this._scene;
            // viewer.screenSpaceEventHandler.setInputAction(function (movement) {
            //     var pick = scene.pick(movement.position);
            //     if (defined(pick) && defined(pick.primitive) && defined(pick.primitive.markerPrimitive) && pick.primitive.markerPrimitive.showInfo) {
            //         viewer.selectedEntity = pick.primitive.markerPrimitive;
            //     }
            // }, ScreenSpaceEventType.LEFT_CLICK);

        };

        DrawHelper.prototype.removeInputActions = function () {
            this._viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
            this._viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        };

        /**
         * 根据给定的两个点，获取矩形框
         * @method
         * @param cartographic1
         * @param cartographic2
         * @return {Rectangle|exports}
         */
        function getExtend(cartographic1, cartographic2) {
            var rect = new Rectangle();
            rect.west = Math.min(cartographic1.longitude, cartographic2.longitude);
            rect.east = Math.max(cartographic1.longitude, cartographic2.longitude);
            rect.south = Math.min(cartographic1.latitude, cartographic2.latitude);
            rect.north = Math.max(cartographic1.latitude, cartographic2.latitude);

            //检查大约等于多少
            var epsilon = CesiumMath.EPSILON7;
            if (rect.east - rect.west < epsilon) {
                rect.east += 2 * epsilon;
            }
            if (rect.north - rect.south < epsilon) {
                rect.north += 2 * epsilon;
            }

            return rect;
        }

        function createToolTip(frameDiv) {

            var Tooltip = function (frameDiv) {

                var div = document.getElementsByClassName('twipsy right')[0];

                if (!defined(div)) {
                    div = document.createElement('DIV');
                    div.className = 'twipsy right';
                    var i = document.createElement('DIV');
                    i.className = 'twipsy-arrow';
                    div.appendChild(i);
                    frameDiv.appendChild(div);
                }
                var title = document.getElementsByClassName('twipsy-inner')[0];

                if (!defined(title)) {
                    title = document.createElement('DIV');
                    title.className = 'twipsy-inner';
                    div.appendChild(title);
                }
                this._div = div;
                this._title = title;

                var cursor = document.getElementsByClassName('twipsy-cursor')[0];
                if (!defined(cursor)) {
                    cursor = document.createElement('img');
                    cursor.className = 'twipsy-cursor';
                    cursor.setAttribute('draggable', 'false');
                    cursor.setAttribute('id', 'CesiumImageCursor');
                    cursor.style.position = 'absolute';
                    frameDiv.appendChild(cursor);
                }
                this._cursor = cursor;

                var label = document.getElementsByClassName('cesium-circle-label')[0];
                if (!defined(label)) {
                    label = document.createElement('div');
                    label.className = 'cesium-circle-label';
                    label.style.position = 'absolute';
                    label.innerHTML = '0米';
                    frameDiv.appendChild(label);
                }

                this._circleLabel = label;
                this._offsetTip = {
                    x: 0,
                    y: 0
                };
                this._offsetCursor = {
                    x: 0,
                    y: 0
                };
            };

            Tooltip.prototype.setVisible = function (visible) {
                this._div.style.display = visible ? 'block' : 'none';
                this._title.innerHTML = '';
            };
            Tooltip.prototype.setAllVisible = function (visible) {
                this.setVisible(visible);
                this._cursor.style.display = visible ? 'block' : 'none';
                this._circleLabel.style.display = visible ? 'block' : 'none';
            };
            Tooltip.prototype.setCursor = function (cursor, visible) {
                if (!defined(cursor)) {
                    visible = false;
                    return visible;
                }
                this._cursor.style.display = 'none';
                void(this._cursor.src = '');
                this._cursor.style.display = visible ? 'block' : 'none';
                this._cursor.src = cursor;
            };
            Tooltip.prototype.setTipOffset = function (horizontal, hierarchy) {
                if (defined(horizontal)) {
                    this._offsetTip.HorizontalOrigin = horizontal;
                }
                if (defined(hierarchy)) {
                    this._offsetTip.PolygonHierarchy = hierarchy;
                }
            };

            Tooltip.prototype.setCursorOffset = function (horizontal, hierarchy) {
                if (defined(horizontal)) {
                    this._offsetCursor.HorizontalOrigin = horizontal;
                }
                if (defined(hierarchy)) {
                    this._offsetCursor.PolygonHierarchy = hierarchy;
                }
            };

            Tooltip.prototype.showCircleLabelText = function (windowPosition, distance, visible) {
                if (defined(visible)) {
                    this._circleLabel.style.display = visible ? 'block' : 'none';
                }
                if (defined(windowPosition)) {
                    this._circleLabel.style.left = Math.round(windowPosition.x) - 40 + 'px';
                    this._circleLabel.style.top = Math.round(windowPosition.y) - 15 + 'px';
                }

                this._circleLabel.innerHTML = addUnit(distance);
            };

            Tooltip.prototype.showAt = function (windowPosition, message) {
                if (windowPosition && message) {
                    this.setVisible(true);
                    this._title.innerHTML = message;
                    this._div.style.position = 'absolute';
                    this._div.style.left = windowPosition.x + this._offsetTip.x + 2 + 'px';
                    this._div.style.top = windowPosition.y + this._offsetTip.y - this._div.clientHeight / 2 + 20 + 'px';
                    this._cursor.style.left = windowPosition.x + this._offsetCursor.x - this._cursor.clientWidth / 2 + 'px';
                    this._cursor.style.top = windowPosition.y + this._offsetCursor.y - this._cursor.clientHeight + 'px';
                }
            };

            return new Tooltip(frameDiv);
        }

        function setListener(primitive, type, callback) {
            primitive[type] = callback;
        }

        // function removeListener(primitive, type) {
        //     primitive[type] = null;
        // }

        /**
         * 计算周长
         * @method
         * @param {Array } cartesianPositions
         * @return {number}
         */
        function computePerimeter(cartesianPositions) {
            var perimeter = 0;
            if (defined(cartesianPositions) && cartesianPositions.length > 1) {
                for (var i = 0; i < cartesianPositions.length - 1; i++) {
                    var n = cartesianPositions[i];
                    var o = cartesianPositions[i + 1];
                    perimeter += getSurfaceDistance(n, o);
                }
            }
            return perimeter;
        }

        /**
         * 将笛卡尔坐标转换为经纬度坐标，在计算两点在地球表面上的距离
         * @method
         * @param {Cartesian3} pos1
         * @param {Cartesian3} pos2
         * @return {Number}
         */
        function getSurfaceDistance(pos1, pos2) {
            var cartographic1 = ellipsoid.cartesianToCartographic(pos1);
            var cartographic2 = ellipsoid.cartesianToCartographic(pos2);
            return new EllipsoidGeodesic(cartographic1, cartographic2).surfaceDistance;
        }

        /**
         * 对数值添加距离单位
         * @method
         * @param {number} value 长度
         * @returns {string|string} 米/公里
         */
        function addUnit(value) {
            var distance = '';
            if (value < 1e4) {
                distance = value.toFixed(2) + '米 ';
            } else {
                distance = (Math.round(value / 100) / 10).toFixed(1) + '公里 ';
            }
            return distance;
        }

        /**
         * 对数值添加面积单位
         * @method
         * @param {number} value
         * @returns {string|string}
         */
        function getAreaText(value) {
            var area = '';
            if (value < 0) {
                value = 0 - value;
            }
            if (value < 1e6) {
                area = value.toFixed(2) + '平方米 ';
            } else {
                area = (Math.round(value / 1e5) / 10).toFixed(1) + '平方公里 ';
            }
            return area;
        }

        function drawCircle(manager, options, callback, saveToBuffer) {

            manager._drawingMode = DrawingTypes.DRAWING_CIRCLE;

            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var circlePrimitive = null;
            var height = options.height || 0;

            manager.startDrawing(function () {
                if (circlePrimitive !== null) {
                    primitive.remove(circlePrimitive);
                }
            });

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {

                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height += Cartographic.fromCartesian(cartesian3).height;
                    }

                    var position = pickGlobe(scene, movement.position, height);

                    if (position) {
                        scene.refreshAlways = true;
                        tooltip.showCircleLabelText(movement.position, 0, true);

                        options.center = position;
                        options.radius = 0;
                        //todo:高度可能有问题
                        options.height = height;
                        circlePrimitive = new CirclePrimitive(options);
                        primitive.add(circlePrimitive);
                        // manager._reDraw = true;
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.endPosition && null !== circlePrimitive) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    if (null !== position) {
                        tooltip.showCircleLabelText(undefined, getSurfaceDistance(circlePrimitive.getCenter(), position), undefined);
                        circlePrimitive.setRadius(Cartesian3.distance(circlePrimitive.getCenter(), position));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position && null !== circlePrimitive) {
                    var position = pickGlobe(scene, movement.position, height);
                    if (position) {

                        tooltip.showCircleLabelText(movement.position, 0, false);

                        options.center = circlePrimitive.getCenter();
                        options.radius = circlePrimitive.getRadius();
                        options.height = height;

                        var newCirclePrimitive = new CirclePrimitive(options);

                        if (saveToBuffer) {
                            primitive.add(newCirclePrimitive);
                        }
                        var centerLatLng = ellipsoid.cartesianToCartographic(newCirclePrimitive.getCenter());
                        var cartesianArray = newCirclePrimitive.getCircleCartesianCoordinates(CesiumMath.PI_OVER_TWO);
                        var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianArray);

                        if (null !== circlePrimitive) {
                            primitive.remove(circlePrimitive);
                            circlePrimitive = null;
                        }
                        if (callback) {
                            callback(manager._drawingMode, {
                                primitive: newCirclePrimitive,
                                positions: cartographicArray,
                                center: centerLatLng,
                                radius: options.radius
                            });
                        }

                        manager.stopDrawing();
                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function drawPolyline(manager, options, callback, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYLINE;
            _drawPoly(manager, options, false, callback, saveToBuffer);
        }

        function drawRectangle(manager, options, callback, saveToBuffer) {

            if (saveToBuffer) {
                manager._drawingMode = DrawingTypes.DRAWING_RECTANGLE;
            } else {
                manager._drawingMode = DrawingTypes.DRAWING_RECTANGLE_QUERY;
            }

            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var baseCartographic = null;
            var extentPrimitive = null;
            var height = options.height || 0;

            manager.startDrawing(function () {
                if (extentPrimitive !== null) {
                    primitive.remove(extentPrimitive);
                }
            });

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height += Cartographic.fromCartesian(cartesian3).height;
                    }
                    var position = pickGlobe(scene, movement.position, height);
                    if (position && null === extentPrimitive) {

                        scene.refreshAlways = true;
                        baseCartographic = ellipsoid.cartesianToCartographic(position);
                        options.extent = getExtend(baseCartographic, baseCartographic);
                        options.height = height;
                        extentPrimitive = new RectanglePrimitive(options);
                        primitive.add(extentPrimitive);
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== extentPrimitive && null !== movement.endPosition) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    if (position) {
                        var cartographic2 = ellipsoid.cartesianToCartographic(position);

                        extentPrimitive.setExtent(getExtend(baseCartographic, cartographic2));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== extentPrimitive && null !== movement.position) {
                    var position = pickGlobe(scene, movement.position, height);
                    if (position && null !== extentPrimitive) {
                        var cartographic = ellipsoid.cartesianToCartographic(position);
                        var rectangle = getExtend(baseCartographic, cartographic);
                        extentPrimitive.setExtent(rectangle);
                        options.extent = rectangle;
                        options.height = height;

                        var newExtentPrimitive = new RectanglePrimitive(options);
                        if (saveToBuffer) {
                            primitive.add(newExtentPrimitive);
                        }

                        if (null !== extentPrimitive) {
                            primitive.remove(extentPrimitive);
                            extentPrimitive = null;
                        }

                        if (callback) {
                            callback(manager._drawingMode, {
                                primitive: newExtentPrimitive,
                                extent: options.extent
                            });
                        }

                        manager.stopDrawing();

                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function drawPolygon(manager, options, callback, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYGON;
            _drawPoly(manager, options, true, callback, saveToBuffer);
        }

        //todo:点击绘制时会弹出info框
        function drawMarker(manager, options,callback) {

            manager._drawingMode = DrawingTypes.DRAWING_MARKER;

            var scene = manager._scene;
            //var tooltip = manager._tooltip;
            var height = options.height || 0;
            var marker = null;

            if (defined(options.id)) {
                marker = manager._markerCollection.get(options.id);
            }
            if (!defined(marker)) {
                options.viewer = manager.viewer;
                marker = new Marker(options, {
                    billboards: manager._billboardCollection,
                    labels: manager._labelCollection
                });
                manager.markers.set(marker.id, marker);
            }

            manager.startDrawing();

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height += Cartographic.fromCartesian(cart).height;
                    }
                    var cartesian3 = pickGlobe(scene, movement.position, height);
                    if (cartesian3) {
                        var center = ellipsoid.cartesianToCartographic(cartesian3);
                        var precision = CesiumMath.EPSILON7;
                        var points = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, center.height), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, center.height)];
                        marker.position = cartesian3;
                        if (callback) {
                            callback(manager._drawingMode, {
                                primitive: marker,
                                position: points
                            });
                        }
                        manager.stopDrawing();
                        manager.closeDraw();
                    }
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.endPosition) {
                    //tooltip.showAt(position, '点击添加');
                    var pickedFeature = scene.pick(movement.endPosition);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height += Cartographic.fromCartesian(cart).height;
                    }
                    var cartesian3 = pickGlobe(scene, movement.endPosition, height);
                    if (cartesian3) {
                        marker.position = cartesian3;
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);
        }

        function drawModel(manager, options,callback) {

            manager.startDrawing(true, options);

            manager._drawingMode = DrawingTypes.DRAWING_MODEL;

            var scene = manager._scene;
            var tooltip = manager._tooltip;
            var height = options.height || 0;
            var model = null;

            if (defined(options.id)) {
                model = manager.models.get(options.id);
            }

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cart).height;
                    }
                    var position = pickGlobe(scene, movement.position, height);
                    if (position) {
                        var center = ellipsoid.cartesianToCartographic(position);
                        var precision = CesiumMath.EPSILON7;
                        var points = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, center.height), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, center.height)];

                        if (model) {
                            model.position = position;
                        } else {
                            options.position = position;
                            options.properties.location = points;
                            options.viewer = manager.viewer;
                            model = new ModelPrimitive(options);
                            //todo 未添加tittle
                            manager.drawPrimitives.add(model.model);
                            manager.models.set(model.id, model);
                        }

                        if(callback){
                            callback();
                        }
                        manager.stopDrawing();
                        manager.closeDraw();
                    }
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

            manager._mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (null !== position && manager._showTooltip) {
                    tooltip.showAt(position, '点击添加');
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);
        }

        function _drawPoly(manager, options, isPolygon, callback, saveToBuffer) {

            var poly = null;
            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var minPoints = isPolygon ? 3 : 2;
            var arrow = options.arrow;
            var height = options.height || 0;

            var baseHtml = '';
            if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                baseHtml = '距离：';

            } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                baseHtml = '面积：';
            }

            var cartesianPositions = [];

            manager.startDrawing(function () {
                if (poly !== null) {
                    primitive.remove(poly);
                }
            });

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && pickedFeature.primitive instanceof Cesium3DTileset) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height += Cartographic.fromCartesian(cartesian3).height;
                    }
                    var cartesian = pickGlobe(scene, movement.position, height);
                    if (cartesian) {

                        scene.refreshAlways = true;
                        if (0 === cartesianPositions.length) {
                            cartesianPositions.push(cartesian.clone());
                        }
                        if (poly === null) {
                            if (isPolygon) {
                                poly = new PolygonPrimitive(options);
                            } else {
                                poly = new PolylinePrimitive(options, arrow);
                            }
                            primitive.add(poly);

                        }
                        if (cartesianPositions.length >= minPoints) {
                            poly.positions = cartesianPositions;
                            poly._createPrimitive = true;
                        }
                        cartesianPositions.push(cartesian);
                    }
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

            manager._mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (null !== position) {
                    if (0 === cartesianPositions.length) {
                        if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            tooltip.showAt(position, baseHtml + '0米');
                        } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                            tooltip.showAt(position, baseHtml + '0平方米');
                        } else if (manager._showTooltip) {
                            tooltip.showAt(position, '点击添加第一个点');
                        }
                    } else {
                        var cartesian3 = pickGlobe(scene, position, height);
                        if (cartesian3) {
                            cartesianPositions.pop();
                            //确保移动的两个点是不同的值
                            cartesian3.y += 1 + Math.random();
                            cartesianPositions.push(cartesian3);
                            if (cartesianPositions.length >= minPoints) {
                                poly.positions = cartesianPositions;
                                poly._createPrimitive = true;
                            }
                            if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                                var perimeter = computePerimeter(cartesianPositions);
                                var distanceHtml = addUnit(perimeter);
                                tooltip.showAt(position, baseHtml + distanceHtml + (cartesianPositions.length > minPoints ? ',双击结束' : ''));
                            } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                                var cartographicPositions = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                                var area = new PolygonArea(cartographicPositions);
                                var areaHtml = getAreaText(area);
                                tooltip.showAt(position, baseHtml + areaHtml + (cartesianPositions.length > minPoints ? ',双击结束' : ''));
                            } else if (manager._showTooltip) {
                                tooltip.showAt(position, (cartesianPositions.length <= minPoints ? '点击添加新点 (' + cartesianPositions.length + ')' : '') + (cartesianPositions.length > minPoints ? '双击结束绘制' : ''));
                            }
                        }
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                var position = movement.position;
                if (null !== position) {
                    if (cartesianPositions.length < minPoints + 2) {
                        return;
                    }
                    var p = pickGlobe(scene, position, height);
                    if (p) {

                        cartesianPositions.pop();
                        cartesianPositions.pop();
                        for (var a = cartesianPositions.length - 1; a > 0; a--) {
                            cartesianPositions[a].equalsEpsilon(cartesianPositions[a - 1], CesiumMath.EPSILON3);
                        }
                        var newPoly;
                        var distanceOrArea;
                        if (isPolygon) {
                            newPoly = new PolygonPrimitive(options);
                        } else {
                            newPoly = new PolylinePrimitive(options, arrow);
                        }
                        newPoly.positions = cartesianPositions;
                        if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            distanceOrArea = computePerimeter(cartesianPositions);

                        } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                            var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                            distanceOrArea = new PolygonArea(cartographicArray);
                        }
                        if (callback) {
                            callback(manager._drawingMode, {
                                primitive: newPoly,
                                data: distanceOrArea
                            });
                        }
                        if (saveToBuffer) {
                            manager._drawPrimitives.add(newPoly);
                        }
                        cartesianPositions = [];
                        if (null !== poly) {
                            primitive.remove(poly);
                            poly = null;
                        }
                        manager.stopDrawing();
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }

        return DrawHelper;
    });
