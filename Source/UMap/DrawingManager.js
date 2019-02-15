define(['../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/createGuid',
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Math',
        '../Core/defaultValue',
        '../Core/Ellipsoid',
        '../Core/EllipsoidGeodesic',
        '../Core/ScreenSpaceEventHandler',
        '../Core/ScreenSpaceEventType',
        '../Core/Color',
        '../Core/Rectangle',
        '../Core/buildModuleUrl',
        '../Core/Cartographic',
        '../Core/Event',
        '../Core/AssociativeArray',
        '../Scene/SceneTransforms',
        '../Scene/HeightReference',
        '../Scene/PrimitiveCollection',
        '../Scene/BillboardCollection',
        '../Scene/LabelCollection',
        '../Widgets/getElement',
        './DrawingTypes',
        './DrawingEvent',
        './Primitive/CirclePrimitive',
        './Primitive/RectanglePrimitive',
        './Primitive/PolylinePrimitive',
        './Primitive/PolygonPrimitive',
        './Primitive/Marker',
        './Primitive/ModelPrimitive',
        './pickGlobe'
    ],
    function (defined, defineProperties, destroyObject,
        DeveloperError, createGuid, Cartesian2,
        Cartesian3, CesiumMath, defaultValue, Ellipsoid, EllipsoidGeodesic,
        ScreenSpaceEventHandler, ScreenSpaceEventType, Color, Rectangle, buildModuleUrl,
        Cartographic, Event, AssociativeArray, SceneTransforms, HeightReference, PrimitiveCollection, BillboardCollection, LabelCollection, getElement,
        DrawingTypes, DrawingEvent, CirclePrimitive, RectanglePrimitive, PolylinePrimitive, PolygonPrimitive, Marker,ModelPrimitive, pickGlobe) {
        'use strict';
        var screenPosition = new Cartesian2();
        var ellipsoid = Ellipsoid.WGS84;
        var defaultBillboard = {
            url: buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png'),
            shiftX: 0,
            shiftY: 0
        };

        var drawHandler = {
            circle: drawCircle,
            polyline: drawPolyline,
            rectangle: drawRectangle,
            polygon: drawPolygon,
            marker: drawMarker,
            model: drawModel
        };

        function drawCircle(manager, options, saveToBuffer) {

            manager._beforeDrawing(saveToBuffer, options);

            manager._drawingMode = DrawingTypes.DRAWING_CIRCLE;

            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var circlePrimitive = null;
            var height = options.height || 0;

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {

                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }

                    var position = pickGlobe(scene, movement.position, height);

                    if (position) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
                        tooltip.showCircleLabelText(movement.position, 0, true);

                        options.center = position;
                        options.radius = 0;
                        options.height = height;
                        circlePrimitive = new CirclePrimitive(options);
                        primitive.add(circlePrimitive);
                        manager._reDraw = true;
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (manager._reDraw && null !== movement.endPosition && null !== circlePrimitive) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    //var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                    if (null !== position) {
                        tooltip.showCircleLabelText(undefined, getSurfaceDistance(circlePrimitive.getCenter(), position), undefined);
                        circlePrimitive.setRadius(Cartesian3.distance(circlePrimitive.getCenter(), position));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (manager._reDraw && null !== movement.position) {
                    var position = pickGlobe(scene, movement.position, height);
                    if (position && null !== circlePrimitive) {

                        tooltip.showCircleLabelText(movement.position, 0, false);

                        options.center = circlePrimitive.getCenter();
                        options.radius = circlePrimitive.getRadius();
                        options.height = height;

                        var newCirclePrimitive = new CirclePrimitive(options);

                        if (saveToBuffer) {
                            primitive.add(newCirclePrimitive);
                            if (options.editable) {
                                newCirclePrimitive.setEditable();
                            }
                        }
                        var centerLatLng = ellipsoid.cartesianToCartographic(newCirclePrimitive.getCenter());
                        var cartesianArray = newCirclePrimitive.getCircleCartesianCoordinates(CesiumMath.PI_OVER_TWO);
                        var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianArray);
                        //TODO: recode
                        manager._dispatchOverlayComplete(newCirclePrimitive, cartographicArray, {
                            center: centerLatLng,
                            radius: circlePrimitive.getRadius(),
                            target: this
                        }, options);

                        if (null !== circlePrimitive) {
                            primitive.remove(circlePrimitive);
                            circlePrimitive = null;
                        }

                        manager._afterDrawing();
                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function drawPolyline(manager, options, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYLINE;
            _drawPoly(manager, options, false, saveToBuffer);
        }

        function drawRectangle(manager, options, saveToBuffer) {

            manager._beforeDrawing(saveToBuffer, options);

            if (saveToBuffer) {
                manager._drawingMode = DrawingTypes.DRAWING_RECTANGLE;
            } else {
                manager._drawingMode = DrawingTypes.DRAWING_RECTANGLE_QUERY;
            }

            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var baseCartographic = null;
            var extentPrimitive = null;
            var height = options.height;

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }
                    var position = pickGlobe(scene, movement.position, options.aboveHeight);
                    if (position && null === extentPrimitive) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
                        baseCartographic = ellipsoid.cartesianToCartographic(position);
                        height = defined(height) ? height : baseCartographic.height;
                        if (defined(options.aboveHeight)) {
                            height += options.aboveHeight;
                        }
                        options.extent = getExtend(baseCartographic, baseCartographic);
                        options.height = height;
                        extentPrimitive = new RectanglePrimitive(options);
                        primitive.add(extentPrimitive);
                        manager._reDraw = true;
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (manager._reDraw && null !== movement.endPosition) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    if (position && null !== extentPrimitive) {
                        var cartographic2 = ellipsoid.cartesianToCartographic(position);

                        extentPrimitive.setExtent(getExtend(baseCartographic, cartographic2));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (manager._reDraw && null !== movement.position) {
                    var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    if (position && null !== extentPrimitive) {
                        var cartographic = ellipsoid.cartesianToCartographic(position);
                        var rectangle = getExtend(baseCartographic, cartographic);
                        extentPrimitive.setExtent(rectangle);
                        options.extent = rectangle;
                        options.height = height;

                        var newExtentPrimitive = new RectanglePrimitive(options);
                        if (saveToBuffer) {
                            newExtentPrimitive.queryPrimitive = true;
                            primitive.add(newExtentPrimitive);
                            if (options.editable) {
                                newExtentPrimitive.setEditable();
                            }
                        }

                        manager._dispatchOverlayComplete(newExtentPrimitive, null, {
                            target: manager
                        }, options);

                        if (null !== extentPrimitive) {
                            primitive.remove(extentPrimitive);
                            extentPrimitive = null;
                        }
                        manager._afterDrawing();

                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function drawPolygon(manager, options, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYGON;
            _drawPoly(manager, options, true, saveToBuffer);
        }

        function drawMarker(manager, options) {

            manager._beforeDrawing(true, options);
            manager._drawingMode = DrawingTypes.DRAWING_MARKER;

            var scene = manager._scene;
            var tooltip = manager._tooltip;
            var height = options.height || 0;
            var marker = null;

            if (defined(options.id)) {
                marker = manager._markerCollection.get(options.id);
            }

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature)) {
                        var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cart).height;
                    }
                    var cartesian3 = pickGlobe(scene, movement.position, height);
                    if (cartesian3) {
                        var center = ellipsoid.cartesianToCartographic(cartesian3);
                        var precision = CesiumMath.EPSILON7;
                        var points = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, center.height), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, center.height)];

                        if (marker) {
                            marker.position = cartesian3;
                        } else {
                            options.position = cartesian3;
                            options.viewer = manager.viewer;
                            marker = new Marker(options, {
                                billboards: manager._billboardCollection,
                                labels: manager._labelCollection
                            });
                            manager.markers.set(marker.id, marker);
                            //manager._drawPrimitives.add(markers);
                            //marker.setEditable(true);
                        }
                        manager._dispatchOverlayComplete(marker, [center], {
                            extent: points
                        }, options);
                        manager._afterDrawing();
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

        function drawModel(manager, options, saveToBuffer) {

            manager._beforeDrawing(true, options);

            manager._drawingMode = DrawingTypes.DRAWING_MODEL;

            var scene = manager._scene;
            var tooltip = manager._tooltip;
            var height = options.height || 0;
            var model = null;

            if (define(options.id)) {
                model = manager.models.get(options.id);
            }

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature)) {
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
                            //options.heightReference = HeightReference.NONE;
                            options.viewer = manager.viewer;
                            model = new ModelPrimitive(options);
                            //todo 未添加tittle
                            manager.drawPrimitives.add(model.model);
                            manager.models.set(model.id,model);
                        }

                        manager._dispatchOverlayComplete(model, [center], {
                            extent: points
                        }, options);
                        manager._afterDrawing();
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

        function _drawPoly(manager, options, isPolygon, saveToBuffer) {
            manager._beforeDrawing(saveToBuffer, options);

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

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && defined(pickedFeature.content)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }
                    var cartesian = pickGlobe(scene, movement.position, height);
                    if (cartesian) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
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
                            manager._reDraw = true;

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
                if (manager._reDraw && null !== position) {
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
                            // manager._markers.getBillboard(cartesianPositions.length - 1).position = cartesian3;
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
                if (manager._reDraw && null !== position) {
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
                        if (isPolygon) {
                            newPoly = new PolygonPrimitive(options);
                        } else {
                            newPoly = new PolylinePrimitive(options, arrow);
                        }
                        newPoly.positions = cartesianPositions;
                        if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            var perimeter = computePerimeter(cartesianPositions);
                            manager._dispatchOverlayComplete(newPoly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, {
                                distance: perimeter
                            });
                        } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                            var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                            var area = new PolygonArea(cartographicArray);
                            manager._dispatchOverlayComplete(newPoly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, {
                                area: area
                            });
                        } else {
                            if (saveToBuffer) {
                                manager._drawPrimitives.add(newPoly);
                                if (options.editable) {
                                    newPoly.setEditable();
                                }
                            }
                            manager._dispatchOverlayComplete(newPoly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, options);
                        }

                        cartesianPositions = [];
                        if (null !== poly) {
                            primitive.remove(poly);
                            poly = null;
                        }
                        manager._afterDrawing();
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }

        function DrawingManager(cesiumView) {
            if (!defined(cesiumView)) {
                throw new DeveloperError('viewer is required.');
            }
            this._viewer = cesiumView;
            this._scene = cesiumView.scene;
            this._showTooltip = true;
            this._id = createGuid();
            this._reDraw = false;

            this._billboardCollection = this._scene.primitives.add(new BillboardCollection({
                scene: this._scene
            }));

            this._labelCollection = this._scene.primitives.add(new LabelCollection({
                scene: this._scene
            }));

            //存放绘制的二维点，key-value. key是该点的id
            this._markerCollection = new AssociativeArray();

            //存放绘制的三维模型
            this._modelCollection = new AssociativeArray();

            if (!defined(this._drawPrimitives)) {
                var collection = new PrimitiveCollection();
                this._scene.primitives.add(collection);
                this._drawPrimitives = collection;
            }
            this._drawingMode = DrawingTypes.DRAWING_NONE;

            var toolbarContainer = cesiumView.container.getElementsByClassName('cesium-viewer-toolbar')[0];

            if (defined(toolbarContainer)) {
                this._container = getElement(toolbarContainer);
                this._tooltip = createToolTip(this._container.parentNode);
            }

            this._surfaces = [];

            this._markers = undefined;
            this._mouseHandler = undefined;
            // this._dragEndEvent = new Event();

            //this._initialiseHandlers();
            //this.listenerMoveEnd();

        }

        (function (drawingManager, drawingEvent, className) {

            drawingManager.prototype = Object.create(drawingEvent.prototype);
            drawingManager.prototype.constructor = drawingManager;
            if ('string' === typeof className) {
                drawingManager.prototype._className = className;
            }
        }(DrawingManager, DrawingEvent, 'DrawingManager'));


        defineProperties(DrawingManager.prototype, {
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
            }
        });

        DrawingManager.prototype.draw = function (type, saveToBuffer, options) {
            if (typeof type === 'string') {
                type = type.toLowerCase();
                var method = drawHandler[type];
                if (method) {
                    options = options || {};
                    options.properties = options.properties||{};
                    if (typeof saveToBuffer !== 'boolean') {
                        saveToBuffer = false;
                    }
                    method(this, options, saveToBuffer);
                }
            }

        };

        // DrawingManager.prototype.setListener = setListener;

        DrawingManager.prototype._muteHandlers = function (mute) {
            this._handlersMuted = mute;
        };

        DrawingManager.prototype.showTooltip = function (visible) {
            this._showTooltip = visible;
        };

        DrawingManager.prototype._beforeDrawing = function (options, callback) {
            var that = this;
            this._tooltip.setVisible(true);
            this._dispatchOverlayBegin(options);

            this._scene.screenSpaceCameraController.enableLook = false;
            this._scene.screenSpaceCameraController.enableTilt = false;
            this._scene.screenSpaceCameraController.enableRotate = false;

            this._mouseHandler = this._mouseHandler && this._mouseHandler.destroy();
            this._mouseHandler = new ScreenSpaceEventHandler(this._scene.canvas);
            this._mouseHandler.setInputAction(function () {
                that.closeDraw();
            }, ScreenSpaceEventType.RIGHT_CLICK);

            exchangeImageUrl(this, false);

        };

        DrawingManager.prototype._afterDrawing = function () {
            this._reDraw = false;
            this._tooltip.setVisible(false);
            this._scene.refreshOnce = true;

        };

        DrawingManager.prototype.closeDraw = function () {

            this._mouseHandler = this._mouseHandler && this._mouseHandler.destroy();
            this._tooltip.setVisible(false);

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

        //TODO: need  change
        DrawingManager.prototype.setInputActions = function () {
            var viewer = this._viewer;
            var scene = this._scene;
            viewer.screenSpaceEventHandler.setInputAction(function (movement) {
                var pick = scene.pick(movement.position);
                if (defined(pick) && defined(pick.primitive) && defined(pick.primitive.markerPrimitive) && pick.primitive.markerPrimitive.showInfo) {
                    viewer.selectedEntity = pick.primitive.markerPrimitive;
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

        };

        DrawingManager.prototype.removeInputActions = function () {
            this._viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
            this._viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        };

        /**
         * 初始化处理鼠标事件
         * @method
         */
        DrawingManager.prototype._initialiseHandlers = function () {

            var pickedObject;
            var mouseOutObject;
            var scene = this._scene;
            var viewer = this._viewer;
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

            handler.setInputAction(function (movement) {}, ScreenSpaceEventType.LEFT_CLICK);

            viewer.screenSpaceEventHandler.setInputAction(function (movement) {
                var pick = scene.pick(movement.position);
                if (defined(pick) && defined(pick.primitive) && defined(pick.primitive.markerPrimitive)) {
                    viewer.selectedEntity = pick.primitive.markerPrimitive;
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

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

        DrawingManager.prototype._setHighlighted = function (e) {
            var t = this.owner;
            if (this._highlighted && this._highlighted === e || true !== this._editMode) {
                this._highlighted = e;
                if (e) {
                    t.setHighlighted(this);
                    this._outlineColor = this.outlineColor;
                    this.setOutlineStyle(Color.fromCssColorString('white'), this.outlineWidth);
                } else if (this._outlineColor) {
                    this.setOutlineStyle(this._outlineColor, this.outlineWidth);
                } else {
                    this.setOutlineStyle();
                }
            }
        };

        /**
         * 开始绘制之前的准备工作
         * @param options
         * @param [options.cursorUrl]
         * @param [options.offsetTipX]
         * @param [options.offsetTipY]
         * @param [options.offsetCursorX]
         * @param [options.offsetCursorY]
         * @param [options.customId]
         * @private
         */
        DrawingManager.prototype._dispatchOverlayBegin = function (options) {
            this._viewer.enableInfoOrSelection = !(this._drawingMode === DrawingTypes.DRAWING_MARKER_QUERY || this._drawingMode === DrawingTypes.DRAWING_CLICK_QUERY);
            if (options && options.cursorUrl) {
                this._tooltip.setCursor(options.cursorUrl, true);
            }
            if (options && (options.offsetTipX || options.offsetTipY)) {
                this._tooltip.setTipOffset(options.offsetTipX, options.offsetTipY);
            }
            if (options && (options.offsetCursorX || options.offsetCursorY)) {
                this._tooltip.setCursorOffset(options.offsetCursorX, options.offsetCursorY);
            }
            exchangeImageUrl(this, true);
            var t = {
                drawingMode: this._drawingMode,
                drawManager: this
            };
            var r = this._drawingMode + 'Begin';
            if (options && options.customId) {
                r = options.customId + 'Begin';
            }
            this.removeInputActions();
            this.dispatchEvent(r, t);
        };

        /**
         * @param primitive
         * @param positions
         * @param  data
         * @param options
         * @private
         */

        DrawingManager.prototype._dispatchOverlayComplete = function (primitive, positions, data, options) {
            if (this._drawingMode !== DrawingTypes.DRAWING_MARKER_QUERY) {
                exchangeImageUrl(this, false);
            }
            if (options && options.cursorUrl) {
                this._tooltip.setCursor(options.cursorUrl, false);
            }
            var defaultOptions = {
                primitive: primitive,
                drawingMode: this._drawingMode,
                positions: positions,
                data: data
            };
            var complete = this._drawingMode + 'Complete';
            if (options && options.customId) {
                complete = options.customId + 'Complete';
            }

            this.dispatchEvent(complete, defaultOptions);

            this.setInputActions();
            if (defined(this._scene)) {
                this._scene.refreshAlways = false;
            }
        };

        /**
         *
         * @param primitive
         * @param content
         * @private
         */
        DrawingManager.prototype._dispatchOverlayEdited = function (primitive, content) {
            var defaultOptions = {
                primitive: primitive,
                drawingMode: primitive.getType(),
                content: content
            };
            this.dispatchEvent(primitive.getType() + 'Edited', defaultOptions);
        };

        /**
         *
         * @param primitive
         * @param results
         * @private
         */
        DrawingManager.prototype._dispatchSearchComplete = function (primitive, results) {
            var defaultOptions = {
                search: primitive,
                results: results
            };
            this.dispatchEvent(primitive.getType() + 'SearchComplete', defaultOptions);
        };
        /**
         * @method
         * @param drawingManager
         * @param options
         * @param {cartesian2}screenPosition
         * @param {number} classSubScript
         * @param {boolean} isSelectImage
         */
        function displayDynamicMarkerDIV(drawingManager, options, screenPosition, classSubScript, isSelectImage) {
            if (defined(options.markerPrimitive)) {
                var a = classSubScript > 9 ? 9 : classSubScript;
                var imageSize = isSelectImage ? options.markerPrimitive.selectImageSize : options.markerPrimitive.imageSize;
                var imageUrl = isSelectImage ? options.markerPrimitive.selectUrl : options.markerPrimitive.url;
                if (defined(imageSize.width) && defined(imageSize.height)) {
                    var div;
                    if (defined(screenPosition)) {
                        if (!defined(drawingManager._viewerContainer)) {
                            var c = drawingManager._viewer.container.getElementsByClassName('beyonmap-viewer')[0];
                            drawingManager._viewerContainer = getElement(c);
                        }
                        div = document.createElement('div');
                        div.className = 'beyonmap-drawingManager-marker-raise beyonmap-drawingManager-marker-' + a;
                        div.setAttribute('style', 'position: absolute; margin: 0px; padding: 0px; width: ' + imageSize.width + 'px; height: ' + imageSize.height + 'px; left:' + (Math.round(screenPosition.x) - Math.round(imageSize.width / 2)) + 'px; top:' + (Math.round(screenPosition.y) - imageSize.height) + 'px');
                        var img = document.createElement('img');
                        img.src = imageUrl;
                        div.appendChild(img);
                        drawingManager._viewerContainer.appendChild(div);
                    }
                    var h = window.setTimeout(function () {
                        if (defined(div)) {
                            drawingManager._viewerContainer.removeChild(div);
                        }
                        window.clearTimeout(h);
                        options.markerPrimitive.selectable = isSelectImage;
                    }, 1e3);
                }
            }
        }

        /**
         * 获取矩形框的四个顶点坐标
         * @param {Rectangle} rectangle
         * @return {Cartesian3[]}
         */
        function getExtentCorners(rectangle) {
            return ellipsoid.cartographicArrayToCartesianArray([Rectangle.northwest(rectangle), Rectangle.northeast(rectangle), Rectangle.southeast(rectangle), Rectangle.southwest(rectangle)]);
        }

        /**
         * 点击绘制时，更改 image的样式
         * @method
         * @param drawingManager
         * @param selected
         */
        function exchangeImageUrl(drawingManager, selected) {
            var id = drawingManager._drawingMode;
            var image = document.getElementById('beyonmap-' + id + '-image');
            if (defined(image)) {
                var currentUrl = image.src;
                var index = currentUrl.lastIndexOf('/');
                var baseUrl = currentUrl.substring(0, index + 1);
                image.src = selected ? baseUrl + id + '-Select.png' : baseUrl + id + '.png';
            }
        }

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
                this._title.innerHTML = "";
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

        function removeListener(primitive, type) {
            primitive[type] = null;
        }

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

        /**
         * @method
         * @param drawingManager
         * @param windowPosition
         * @param callback
         * @see DrawingManager.startDrawingMarkerQuery
         */
        function displayRevealMarker(drawingManager, windowPosition, callback) {
            var revealMarkerDiv;
            if (defined(windowPosition)) {
                if (!defined(drawingManager._viewerContainer)) {
                    var element = drawingManager._viewer.container.getElementsByClassName('cesium-viewer')[0];
                    drawingManager._viewerContainer = getElement(element);
                }
                revealMarkerDiv = document.createElement('div');
                revealMarkerDiv.className = 'reveal-marker-circle reveal-marker-glow';
                revealMarkerDiv.setAttribute('style', 'position: absolute; margin: 0px; padding: 0px; width: 16px; height: 16px; overflow: hidden;left:' + (Math.round(windowPosition.x) - 8) + 'px; top:' + (Math.round(windowPosition.y) - 8) + 'px');
                drawingManager._viewerContainer.appendChild(revealMarkerDiv);
            }
            var a = window.setTimeout(function () {
                if (defined(revealMarkerDiv)) {
                    drawingManager._viewerContainer.removeChild(revealMarkerDiv);
                }
                window.clearTimeout(a);
                if (defined(callback)) {
                    callback();
                }
            }, 300);
        }

        return DrawingManager;
    });