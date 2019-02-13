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
        '../Scene/SceneTransforms',
        '../Scene/HeightReference',
        '../Scene/PrimitiveCollection',
        '../Widgets/getElement',
        './DrawingTypes',
        './DrawingEvent',
        './Primitive/CirclePrimitive',
        './Primitive/RectanglePrimitive',
        './Primitive/PolylinePrimitive',
        './Primitive/PolygonPrimitive',
        './pickGlobe'
    ],
    function (defined, defineProperties, destroyObject,
        DeveloperError, createGuid, Cartesian2,
        Cartesian3, CesiumMath, defaultValue, Ellipsoid, EllipsoidGeodesic,
        ScreenSpaceEventHandler, ScreenSpaceEventType, Color, Rectangle, buildModuleUrl,
        Cartographic, Event, SceneTransforms, HeightReference, PrimitiveCollection, getElement,
        DrawingTypes, DrawingEvent, CirclePrimitive,RectanglePrimitive,PolylinePrimitive,PolygonPrimitive, pickGlobe) {
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
            polygon : drawPolygon
        };

        function drawCircle(manager, options, saveToBuffer) {
            options = options || {};
            exchangeImageUrl(manager, false);
            manager._drawingMode = DrawingTypes.DRAWING_CIRCLE;
            manager._dispatchOverlayBegin(options);
            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var circlePrimitive = null;
            var height = options.height || 0;
            saveToBuffer = saveToBuffer || false;

            manager._beforeDrawing(function () {
                if (null !== circlePrimitive) {
                    primitive.remove(circlePrimitive);
                }
                manager._mouseHandler = manager._mouseHandler && manager._mouseHandler.destroy();
                tooltip = tooltip && tooltip.setVisible(false);
            });

            scene.screenSpaceCameraController.enableLook = false;
            scene.screenSpaceCameraController.enableTilt = false;
            scene.screenSpaceCameraController.enableRotate = false;
            manager._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {

                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }

                    var position = pickGlobe(scene, movement.position, height);

                    if (position && null === circlePrimitive) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
                        tooltip.showCircleLabelText(movement.position, 0, true);

                        options.center = position;
                        options.radius = 0;
                        options.height = height;
                        circlePrimitive = new CirclePrimitive(options);
                        primitive.add(circlePrimitive);
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.endPosition && null !== circlePrimitive) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    //var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                    if (null !== position) {
                        tooltip.showCircleLabelText(undefined, getSurfaceDistance(circlePrimitive.getCenter(), position), undefined);
                        circlePrimitive.setRadius(Cartesian3.distance(circlePrimitive.getCenter(), position));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var position = pickGlobe(scene, movement.position, height);
                    //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    if (position && null !== circlePrimitive) {
                        tooltip.showCircleLabelText(movement.position, 0, false);

                        options.center = circlePrimitive.getCenter();
                        options.radius = circlePrimitive.getRadius();
                        options.height = height;

                        var newCirclePrimitive = new CirclePrimitive(options);
                        //ellipsoid.cartesianToCartographic(position);
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
                            radius: circlePrimitive.getRadius(), // geodesic.surfaceDistance,
                            target: this
                        }, options);

                        scene.screenSpaceCameraController.enableLook = true;
                        scene.screenSpaceCameraController.enableTilt = true;
                        scene.screenSpaceCameraController.enableRotate = true;
                        manager._afterDrawing();
                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function drawPolyline(manager, options, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYLINE;
            _drawPoly(manager, options, false, saveToBuffer);
        }

        function drawPolygon(manager, options, saveToBuffer) {
            manager._drawingMode = DrawingTypes.DRAWING_POLYGON;
            _drawPoly(manager, options, true, saveToBuffer);
        }

        function drawRectangle(manager, options, saveToBuffer) {
            options = options || {};
            exchangeImageUrl(manager, false);
            manager._drawingMode = DrawingTypes.DRAWING_RECTANGLE_QUERY;

            manager._dispatchOverlayBegin(options);
            var scene = manager._scene;
            var primitive = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var baseCartographic = null;
            var extentPrimitive = null;
            var height = options.height;

            manager._beforeDrawing(function () {
                if (null !== extentPrimitive) {
                    primitive.remove(extentPrimitive);
                }
                manager._markers = manager._markers && manager._markers.remove();
                manager._mouseHandler = manager._mouseHandler && manager._mouseHandler.destroy();
                tooltip = tooltip && tooltip.setVisible(false);
            });

            manager._markers = null;
            scene.screenSpaceCameraController.enableLook = false;
            scene.screenSpaceCameraController.enableTilt = false;
            scene.screenSpaceCameraController.enableRotate = false;
            manager._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

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
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOWN);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.endPosition) {
                    var position = pickGlobe(scene, movement.endPosition, height);
                    if (position && null !== extentPrimitive) {
                        var cartographic2 = ellipsoid.cartesianToCartographic(position);
                       
                        extentPrimitive.setExtent(getExtend(baseCartographic, cartographic2));
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
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

                        scene.screenSpaceCameraController.enableLook = true;
                        scene.screenSpaceCameraController.enableTilt = true;
                        scene.screenSpaceCameraController.enableRotate = true;
                        manager._afterDrawing();

                    }
                }
            }, ScreenSpaceEventType.LEFT_UP);
        }

        function _drawPoly(manager, options, isPolygon, saveToBuffer) {
            options = options || {};
            var poly;
            var scene = manager._scene;
            var primitives = manager._drawPrimitives;
            var tooltip = manager._tooltip;
            var minPoints = isPolygon ? 3 : 2;
            var arrow = options.arrow;
            if (isPolygon) {
                poly = new PolygonPrimitive(options);
            } 
            // else if (manager._drawingMode === DrawingTypes.DRAWING_POLYLINE) {
            //     poly = new PolylinePrimitive(options, false);
            // } 
            else {
                poly = new PolylinePrimitive(options, arrow);
            }
            primitives.add(poly);
            var height = options.altitude || 0;
            var baseHtml = '';
            if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                baseHtml = '距离：';

            } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                baseHtml = '面积：';
            }
            var cartesianPositions = [];

            manager._beforeDrawing(function () {
                primitives = primitives && primitives.remove(poly);
                manager._markers = manager._markers && manager._markers.remove();
                manager._mouseHandler = manager._mouseHandler && manager._mouseHandler.destroy();
                tooltip = tooltip && tooltip.setVisible(false);
            });

            manager._dispatchOverlayBegin(options);

            //manager._markers = new BillboardGroup(manager, defaultBillboard);

            manager._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

            manager._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && defined(pickedFeature.content)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }
                    //var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    var cartesian = pickGlobe(scene, movement.position, height);
                    if (cartesian) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
                        if (0 === cartesianPositions.length) {
                            cartesianPositions.push(cartesian.clone());
                           // manager._markers.addBillboard(cartesianPositions[0]);
                        }
                        if (cartesianPositions.length >= minPoints) {
                            poly.positions = cartesianPositions;
                            poly._createPrimitive = true;
                        }
                        cartesianPositions.push(cartesian);
                       // manager._markers.addBillboard(cartesian);
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
                        //var cartesian3 = scene.camera.pickEllipsoid(position, ellipsoid);
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
                if (null !== position) {
                    if (cartesianPositions.length < minPoints + 2) {
                        return;
                    }
                    // var p = scene.camera.pickEllipsoid(position, ellipsoid);
                    var p = pickGlobe(scene, position, height);
                    if (p) {
                        manager._afterDrawing();
                        cartesianPositions.pop();
                        cartesianPositions.pop();
                        for (var a = cartesianPositions.length - 1; a > 0; a--) {
                            cartesianPositions[a].equalsEpsilon(cartesianPositions[a - 1], CesiumMath.EPSILON3);
                        }
                        var poly;
                        if (isPolygon) {
                            poly = new PolygonPrimitive(options);
                        } 
                        // else if (manager._drawingMode === DrawingTypes.DRAWING_POLYLINE) {
                        //     poly = new PolylinePrimitive(options, false);
                        //     //poly.heightReference = HeightReference.NONE;
                        // } 
                        else {
                            poly = new PolylinePrimitive(options, arrow);
                        }
                        poly.positions = cartesianPositions;
                        if (manager._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            var perimeter = computePerimeter(cartesianPositions);
                            manager._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, {
                                distance: perimeter
                            });
                        } else if (manager._drawingMode === DrawingTypes.DRAWING_AREA) {
                            var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                            var area = new PolygonArea(cartographicArray);
                            manager._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, {
                                area: area
                            });
                        } else {
                            if(saveToBuffer){
                                manager._drawPrimitives.add(poly);
                                if (options.editable) {
                                    poly.setEditable();
                                }
                            }
                           
                            manager._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: manager
                            }, options);
                        }
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

            if (!defined(this._drawPrimitives)) {
                // var collection = new DrawingCollection(this);
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

            this._initialiseHandlers();
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
            dragEndEvent: {
                get: function () {
                    return this._dragEndEvent;
                }
            }
        });

        DrawingManager.prototype.draw = function (type, saveToBuffer, options) {
            if(typeof type === 'string'){
                type = type.toLowerCase();
                var method = drawHandler[type];
                if (method) {
                    method(this, options, saveToBuffer);
                }
            }
          
        };
        // DrawingManager.prototype.remove = function (primitive) {
        //     return !!defined(this._drawPrimitives) && this._drawPrimitives.remove(primitive);
        // };

        // DrawingManager.prototype.close = function () {
        //     if (!this._isOpen) {
        //         return true;
        //     }
        //     this.disableAllEditMode();
        //     if (this._editCleanUp) {
        //         this._editCleanUp();
        //         this._editCleanUp = null;
        //     }
        //     this._muteHandlers(false);
        //     this._isOpen = false;
        // };

        // DrawingManager.prototype.clearEdit = function () {
        //     for (var t = 0; t < this._drawPrimitives.length; t++) {
        //         var r = this._drawPrimitives.get(t);
        //         if (defined(r) && r.isDestroyed && !r.isDestroyed()) {
        //             if (defined(r.length)) {
        //                 for (var i = 0; i < r.length; i++) {
        //                     var n = r.get(i);
        //                     if (defined(n) && n._editable && defined(n.markerCollection)) {
        //                         n.markerCollection.remove(n);
        //                     }
        //                 }
        //                 if (0 === r.length) {
        //                     this._drawPrimitives.removeAndDestroy(r);
        //                 }
        //             } else if (r._editable) {
        //                 this._drawPrimitives.removeAndDestroy(r);
        //             }
        //         }
        //     }
        // };

        // DrawingManager.prototype.setListener = setListener;

        DrawingManager.prototype._muteHandlers = function (mute) {
            this._handlersMuted = mute;
        };

        DrawingManager.prototype.showTooltip = function (visible) {
            this._showTooltip = visible;
        };

        // /**
        //  * 为可以编辑的图形注册鼠标和回调事件
        //  * 该图形必须实现{setEditMode} 和{setHighlighted}
        //  * @method
        //  * @param shape
        //  */
        // DrawingManager.prototype.registerEditableShape = function (shape) {
        //     var self = this;

        //     //移动鼠标时高亮该shape
        //     setListener(shape, 'mouseMove', function (position) {
        //         shape.setHighlighted(true);
        //         if (!shape._editMode && self._showTooltip) {
        //             self._tooltip.showAt(position, '点击编辑此要素');
        //         }
        //     });

        //     //鼠标移开时取消高亮
        //     setListener(shape, 'mouseOut', function (position) {
        //         shape.setHighlighted(false);
        //         self._tooltip.setVisible(false);
        //     });

        //     setListener(shape, 'leftClick', function (position) {
        //         shape.setEditMode(true);
        //     });
        // };

        // DrawingManager.prototype.unregisterEditableShape = function (shape) {
        //     removeListener(shape, 'mouseMove');
        //     removeListener(shape, 'mouseOut');
        //     removeListener(shape, 'leftClick');
        // };

        DrawingManager.prototype._beforeDrawing = function (callback) {
            //this.disableAllEditMode();
            if (this._editCleanUp) {
                this._editCleanUp();
            }
            this._editCleanUp = callback;
            this._muteHandlers(true);
        };

        DrawingManager.prototype._afterDrawing = function () {
            this._markers = this._markers && this._markers.remove();
            this._mouseHandler = this._mouseHandler && this._mouseHandler.destroy();
            this.tooltip = this.tooltip && this.tooltip.setVisible(false);
            if (this._editCleanUp) {
                this._editCleanUp();
                this._editCleanUp = null;
            }
            this._muteHandlers(false);

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

        // /**
        //  *
        //  * @param primitive
        //  * @param {boolean} editable
        //  */
        // DrawingManager.prototype.setEditable = function (primitive, editable) {
        //     if (primitive && !primitive.isDestroyed()) {
        //         primitive.setEditable(editable);
        //     }
        // };

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
        // /**
        //  * 确保同一时间只有一个图形是处于高亮状态
        //  * @method
        //  */
        // DrawingManager.prototype.disableAllHighlights = function () {
        //     this.setHighlighted(undefined);
        // };

        // /**
        //  * 设置该图形为高亮状态
        //  * @method
        //  * @param surface
        //  */
        // DrawingManager.prototype.setHighlighted = function (surface) {
        //     if (this._highlightedSurface && !this._highlightedSurface.isDestroyed() && this._highlightedSurface !== surface) {
        //         this._highlightedSurface.setHighlighted(false);
        //     }
        //     this._highlightedSurface = surface;
        // };

        // /**
        //  * 确保同一时间只有一个图形处于可编辑状态
        //  * @method
        //  */
        // DrawingManager.prototype.disableAllEditMode = function () {
        //     this.setEdited(undefined);
        // };

        // /**
        //  * 设置该图形为当前可编辑对象
        //  * @method
        //  * @param surface
        //  */
        // DrawingManager.prototype.setEdited = function (surface) {
        //     if (this._editedSurface && !this._editedSurface.isDestroyed()) {
        //         this._editedSurface.setEditMode(false);
        //     }
        //     this._editedSurface = surface;
        // };

        // /**
        //  * 显示或隐藏所有特定类型的图形
        //  * @method
        //  * @param {DrawingTypes} drawingType
        //  * @param visible
        //  */
        // DrawingManager.prototype.setVisible = function (drawingType, visible) {
        //     if (drawingType === DrawingTypes.DRAWING_MARKER || drawingType === DrawingTypes.DRAWING_MODEL) {
        //         for (var index = 0; index < this._drawPrimitives.length; index++) {
        //             var markerPrimitive = this._drawPrimitives.get(index);
        //             if (defined(markerPrimitive) && markerPrimitive.isDestroyed && !markerPrimitive.isDestroyed() && defined(markerPrimitive.length)) {
        //                 markerPrimitive.show = visible;
        //             }
        //         }
        //     } else {
        //         for (var i = 0; i < this._drawPrimitives.length; i++) {
        //             var primitive = this._drawPrimitives.get(i);
        //             if (defined(primitive) && primitive.isDestroyed && !primitive.isDestroyed() && primitive.getType && primitive.getType() === drawingType) {
        //                 primitive.show = visible;
        //             }
        //         }
        //     }

        //     this._scene.refreshOnce = true;
        // };

        // /**
        //  * 显示所有图层
        //  * @method
        //  * @param {boolean} show
        //  */
        // DrawingManager.prototype.setAllVisible = function (show) {
        //     for (var index = 0; index < this._drawPrimitives.length; index++) {
        //         var primitive = this._drawPrimitives.get(index);
        //         if (defined(primitive) && primitive.isDestroyed && !primitive.isDestroyed()) {
        //             primitive.show = show;
        //         }
        //     }
        //     this._scene.refreshOnce = true;
        // };



        // /**
        //  *
        //  * @param points
        //  * @param options
        //  * @param callbacks
        //  * @return {BillboardGroup}
        //  */
        // DrawingManager.prototype.createBillboardGroup = function (points, options, callbacks) {
        //     var markers = new BillboardGroup(this, options);
        //     markers.addBillboards(points, callbacks);
        //     return markers;
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingMarkerQuery = function (options) {
        //     var self = this;
        //     var scene = this._scene;
        //     var tooltip = this._tooltip;
        //     if (this._drawingMode === DrawingTypes.DRAWING_MARKER_QUERY) {
        //         return exchangeImageUrl(self, false);
        //     }
        //     this._afterDrawing();
        //     this._drawingMode = DrawingTypes.DRAWING_NONE;
        //     this._viewer.enableInfoOrSelection = true;

        //     options.shiftX = options.shiftX || 0;
        //     options.shiftY = options.shiftY || 0;

        //     this._beforeDrawing(function () {
        //         self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_MARKER_QUERY;
        //     this._dispatchOverlayBegin(options);

        //     self._markers = new BillboardGroup(this, options);
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);
        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             //var cartesian3 = pickGlobe(scene, movement.position);
        //             var cartesian3 = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             if (cartesian3) {
        //                 self.clearSelect();
        //                 var center = ellipsoid.cartesianToCartographic(cartesian3);
        //                 var precision = CesiumMath.EPSILON7;
        //                 var range = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, 0), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, 0)];
        //                 var markers = new MarkerCollection(self._viewer);
        //                 options.lon = CesiumMath.toDegrees(center.longitude);
        //                 options.lat = CesiumMath.toDegrees(center.latitude);
        //                 options.data = range;
        //                 var markerPrimitive = markers.addModel(options);

        //                 markerPrimitive.drawingMode = DrawingTypes.DRAWING_MARKER_QUERY;

        //                 var windowPosition = SceneTransforms.wgs84ToWindowCoordinates(self._scene, cartesian3);

        //                 displayRevealMarker(self, windowPosition, function () {
        //                     markerPrimitive.mousePosition = movement.position;
        //                     self._dispatchOverlayComplete(markerPrimitive, [center], {
        //                         extent: range
        //                     });
        //                 });
        //                 scene.refreshOnce = true;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_CLICK);
        // };

        // /**
        //  * 绘制marker点
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingMarker = function (options) {
        //     var self = this;
        //     var scene = this._scene;
        //     var tooltip = this._tooltip;

        //     options.shiftX = options.shiftX || 0;
        //     options.shiftY = options.shiftY || 0;
        //     var height = options.altitude;
        //     this._beforeDrawing(function () {
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_MARKER;
        //     this._dispatchOverlayBegin(options);
        //     var markers = new MarkerCollection(self._viewer);

        //     var primitive = void 0;
        //     if (defined(options.data) && defined(options.data.id)) {
        //         primitive = self._drawPrimitives.findPrimitiveByDataId(options.data.id);
        //     }
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);
        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cart).height;
        //             }
        //             var cartesian3 = pickGlobe(scene, movement.position, height);
        //             if (cartesian3) {
        //                 var center = ellipsoid.cartesianToCartographic(cartesian3);
        //                 var precision = CesiumMath.EPSILON7;
        //                 var points = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, center.height), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, center.height)];

        //                 if (primitive) {
        //                     primitive._markers[0].position = cartesian3;
        //                     self._afterDrawing();
        //                 } else {
        //                     options.lon = CesiumMath.toDegrees(center.longitude);
        //                     options.lat = CesiumMath.toDegrees(center.latitude);
        //                     options.height = center.height;
        //                     options.data = points;
        //                     primitive = markers.addModel(options);
        //                     self._afterDrawing();
        //                     self._drawPrimitives.add(markers);
        //                     primitive.setEditable(true);
        //                 }
        //                 self._dispatchOverlayComplete(primitive, [center], {
        //                     extent: points
        //                 }, options);
        //                 scene.refreshOnce = true;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_CLICK);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         var position = movement.endPosition;
        //         if (null !== position && self._showTooltip) {
        //             tooltip.showAt(position, '点击添加');
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);
        // };

        // /**
        //  * 绘制人物模型
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingModel = function (options) {
        //     var self = this;
        //     var scene = this._scene;
        //     var tooltip = this._tooltip;
        //     options.properties = options.properties || {};
        //     var height = options.altitude;
        //     this._beforeDrawing(function () {
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });
        //     this._drawingMode = DrawingTypes.DRAWING_MODEL;
        //     this._dispatchOverlayBegin(options);
        //     var markers = new ModelCollection(self._viewer);

        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);
        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cart = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cart).height;
        //             }
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             var position = pickGlobe(scene, movement.position, height);
        //             if (position) {
        //                 var center = ellipsoid.cartesianToCartographic(position);
        //                 var precision = CesiumMath.EPSILON7;
        //                 var points = [Cartographic.fromRadians(center.longitude - precision, center.latitude - precision, center.height), Cartographic.fromRadians(center.longitude + precision, center.latitude + precision, center.height)];
        //                 options.lon = CesiumMath.toDegrees(center.longitude);
        //                 options.lat = CesiumMath.toDegrees(center.latitude);
        //                 options.height = center.height;
        //                 options.properties.location = points;
        //                 options.heightReference = HeightReference.NONE;
        //                 options.viewer = self._viewer;

        //                 var primitive = markers.addModel(options);
        //                 self._afterDrawing();
        //                 self._drawPrimitives.add(markers);
        //                 primitive.setEditable(true);
        //                 self._dispatchOverlayComplete(primitive, [center], {
        //                     extent: points
        //                 }, options);
        //                 scene.refreshOnce = true;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_CLICK);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         var position = movement.endPosition;
        //         if (null !== position && self._showTooltip) {
        //             tooltip.showAt(position, '点击添加');
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);
        // };

        // /**
        //  * 绘制多边形
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingPolygon = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_POLYGON;
        //     this._startDrawingPolyShape(true, options);
        // };

        // /**
        //  * 绘制折线
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingPolyline = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_POLYLINE;
        //     this._startDrawingPolyShape(false, options);
        // };

        // /**
        //  * 绘制距离，暂时好像没有用处
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingDistance = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_DISTANCE;
        //     this._startDrawingPolyShape(false, options);
        // };

        // /**
        //  * 绘制面积，暂时好像没有用处
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingArea = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_AREA;
        //     this._startDrawingPolyShape(true, options);
        // };

        // /**
        //  * 绘制带箭头的折线
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingPolylineArrow = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_POLYLINE_ARROW;
        //     this._startDrawingPolyShape(false, options);
        // };

        // /**
        //  * 绘制带高度的折线
        //  * @method
        //  * @param options
        //  * @see PolylinePrimitive
        //  */
        // DrawingManager.prototype.startDrawingHeight = function (options) {
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_HEIGHT;
        //     var self = this;
        //     var poly;
        //     var scene = this._scene;
        //     var primitive = this._drawPrimitives;
        //     var tooltip = this._tooltip;
        //     var polyLine = new PolylinePrimitive(options);
        //     polyLine.heightReference = HeightReference.NONE;
        //     polyLine.asynchronous = false;
        //     primitive.add(polyLine);
        //     var position;
        //     var points = [];
        //     this._beforeDrawing(function () {
        //         primitive = primitive && primitive.remove(poly) && primitive.remove(polyLine);
        //         self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });
        //     this._dispatchOverlayBegin(options);
        //     var altitude = options.altitude;

        //     self._markers = new BillboardGroup(this, defaultBillboard);
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);
        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             if (0 === points.length) {
        //                 // position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //                 position = pickGlobe(scene, movement.position, altitude);
        //                 if (position !== null) {
        //                     if (defined(scene)) {
        //                         scene.refreshAlways = true;
        //                     }
        //                     points.push(position.clone());
        //                     self._markers.addBillboard(points[0]);
        //                     var options = {
        //                         center: position,
        //                         radius: 0,
        //                         height: 0,
        //                         asynchronous: false
        //                     };
        //                     poly = new CirclePrimitive(options);
        //                     poly.heightReference = HeightReference.NONE;
        //                     primitive.add(poly);
        //                 }
        //             } else {
        //                 self._afterDrawing();
        //                 position = pickGlobe(scene, movement.position, altitude);
        //                 // position = scene.camera.pickEllipsoid(movement.position, ellipsoid);

        //                 if (!defined(position)) {
        //                     return;
        //                 }
        //                 var cartographic = ellipsoid.cartesianToCartographic(position);
        //                 EllipsoidGeodesic = ellipsoid.cartesianToCartographic(position);
        //                 ScreenSpaceEventHandler = cartographic.height - EllipsoidGeodesic.height;
        //                 self._dispatchOverlayComplete(null, null, {
        //                     target: this
        //                 }, {
        //                     height: ScreenSpaceEventHandler
        //                 });
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_CLICK);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         var o = movement.endPosition;
        //         if (null !== o) {
        //             if (0 === points.length) {
        //                 tooltip.showAt('高度为: 0米');
        //             } else {
        //                 var d = pickGlobe(scene, o, options.altitude);
        //                 //var d = scene.camera.pickEllipsoid(movement.position, ellipsoid);

        //                 if (!defined(d)) {
        //                     return;
        //                 }
        //                 var h = ellipsoid.cartesianToCartographic(d);
        //                 var p = ellipsoid.cartesianToCartographic(position);
        //                 var f = h.height - p.height;
        //                 p.height = h.height;
        //                 var m = ellipsoid.cartographicToCartesian(p);
        //                 if (points.length < 2) {
        //                     points.push(m);
        //                     self._markers.addBillboard(m);
        //                 } else {
        //                     points[1] = m;
        //                     self._markers.getBillboard(points.length - 1).position = m;
        //                     polyLine.positions = points;
        //                     polyLine._createPrimitive = true;
        //                     if (defined(poly)) {
        //                         poly.center = m;
        //                         poly.height = h.height;
        //                         poly.setRadius(Cartesian3.distance(m, d));
        //                     }
        //                     tooltip.showAt(o, '高度为: ' + addUnit(f));
        //                 }

        //             }
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingRectangleQuery = function (options) {

        //     var self = this;
        //     options.perPositionHeight = false;
        //     options.height = 0;
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_RECTANGLE_QUERY;

        //     this._dispatchOverlayBegin(options);
        //     var scene = this._scene;
        //     var primitive = this._drawPrimitives;
        //     var tooltip = this._tooltip;
        //     var baseCartographic = null;
        //     var extentPrimitive = null;
        //     var height = options.altitude;

        //     this._beforeDrawing(function () {
        //         if (null !== extentPrimitive) {
        //             primitive.remove(extentPrimitive);
        //         }
        //         self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });

        //     self._markers = null;
        //     scene.screenSpaceCameraController.enableLook = false;
        //     scene.screenSpaceCameraController.enableTilt = false;
        //     scene.screenSpaceCameraController.enableRotate = false;
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cartesian3).height;
        //             }
        //             var position = pickGlobe(scene, movement.position, options.aboveHeight);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             if (position && null === extentPrimitive) {
        //                 if (defined(scene)) {
        //                     scene.refreshAlways = true;
        //                 }
        //                 baseCartographic = ellipsoid.cartesianToCartographic(position);
        //                 height = defined(height) ? height : baseCartographic.height;
        //                 if (defined(options.aboveHeight)) {
        //                     height += options.aboveHeight;
        //                 }
        //                 setExtent(getExtend(baseCartographic, baseCartographic), options);
        //                 extentPrimitive.height = height;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_DOWN);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.endPosition) {
        //             var position = pickGlobe(scene, movement.endPosition, height);
        //             // var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
        //             if (position && null !== extentPrimitive) {
        //                 var cartographic2 = ellipsoid.cartesianToCartographic(position);
        //                 setExtent(getExtend(baseCartographic, cartographic2), options);
        //             }
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             // var position = pickGlobe(scene, movement.position, height);
        //             var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             if (position && null !== extentPrimitive) {
        //                 var cartographic = ellipsoid.cartesianToCartographic(position);
        //                 var rectangle = getExtend(baseCartographic, cartographic);
        //                 setExtent(rectangle, options);
        //                 self._afterDrawing();

        //                 options.extent = rectangle;
        //                 options.asynchronous = false;
        //                 var newExtentPrimitive = new ExtentPrimitive(options);
        //                 newExtentPrimitive.queryPrimitive = true;
        //                 newExtentPrimitive.height = height;
        //                 self._dispatchOverlayComplete(newExtentPrimitive, null, {
        //                     target: this
        //                 }, options);
        //                 scene.screenSpaceCameraController.enableLook = true;
        //                 scene.screenSpaceCameraController.enableTilt = true;
        //                 scene.screenSpaceCameraController.enableRotate = true;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_UP);

        //     function setExtent(rectangle, options) {
        //         if (null === extentPrimitive) {
        //             extentPrimitive = new ExtentPrimitive(options);
        //             extentPrimitive.asynchronous = false;
        //             extentPrimitive.queryPrimitive = true;
        //             primitive.add(extentPrimitive);
        //         }
        //         extentPrimitive.setExtent(rectangle);
        //     }
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingRectangle = function (options) {

        //     var self = this;
        //     options.perPositionHeight = false;
        //     options.height = 0;
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_RECTANGLE;
        //     var scene = this._scene;
        //     var primitives = this._drawPrimitives;
        //     var tooltip = this._tooltip;
        //     var baseCartographic = null;
        //     var extentPrimitive = null;
        //     var height = options.altitude;

        //     this._beforeDrawing(function () {
        //         if (null !== extentPrimitive) {
        //             primitives.remove(extentPrimitive);
        //         }
        //         self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });

        //     this._dispatchOverlayBegin(options);

        //     self._markers = null;
        //     scene.screenSpaceCameraController.enableLook = false;
        //     scene.screenSpaceCameraController.enableTilt = false;
        //     scene.screenSpaceCameraController.enableRotate = false;
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cartesian3).height;
        //             }
        //             var position = pickGlobe(scene, movement.position, height);
        //             // var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);

        //             if (position && null === extentPrimitive) {
        //                 if (defined(scene)) {
        //                     (scene.refreshAlways = true);
        //                 }
        //                 baseCartographic = ellipsoid.cartesianToCartographic(position);
        //                 height = defined(height) ? height : baseCartographic.height;
        //                 if (defined(options.aboveHeight)) {
        //                     (height += options.aboveHeight);
        //                 }
        //                 setExtent(getExtend(baseCartographic, baseCartographic), options);
        //                 extentPrimitive.height = height;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_DOWN);

        //     self._mouseHandler.setInputAction(function (movement) {

        //         if (null !== movement.endPosition) {
        //             var position = pickGlobe(scene, movement.endPosition, height);
        //             //var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);

        //             if (position && null !== extentPrimitive) {
        //                 var cartographic1 = ellipsoid.cartesianToCartographic(position);
        //                 setExtent(getExtend(baseCartographic, cartographic1), options);
        //             }
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var position = pickGlobe(scene, movement.position, height);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);

        //             if (position && null !== extentPrimitive) {
        //                 var cartographic1 = ellipsoid.cartesianToCartographic(position);
        //                 var rectangle = getExtend(baseCartographic, cartographic1);
        //                 setExtent(rectangle, options);
        //                 self._afterDrawing();
        //                 options.extent = rectangle;
        //                 options.asynchronous = false;
        //                 var newExtentPrimitive = new ExtentPrimitive(options);
        //                 newExtentPrimitive.height = height;
        //                 self._drawPrimitives.add(newExtentPrimitive);
        //                 if (options.editable) {
        //                     newExtentPrimitive.setEditable();
        //                 }
        //                 self._dispatchOverlayComplete(newExtentPrimitive, null, {
        //                     target: this
        //                 }, options);
        //                 scene.screenSpaceCameraController.enableLook = true;
        //                 scene.screenSpaceCameraController.enableTilt = true;
        //                 scene.screenSpaceCameraController.enableRotate = true;
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_UP);

        //     function setExtent(rectangle, options) {
        //         if (null === extentPrimitive) {
        //             extentPrimitive = new ExtentPrimitive(options);
        //             extentPrimitive.asynchronous = false;
        //             primitives.add(extentPrimitive);
        //         }
        //         extentPrimitive.setExtent(rectangle);
        //         var points = getExtentCorners(rectangle);
        //         if (null === self._markers) {
        //             self._markers = new BillboardGroup(self, defaultBillboard);
        //             self._markers.addBillboards(points);
        //         } else {
        //             self._markers.updateBillboardsPositions(points);
        //         }
        //     }
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingCircleQuery = function (options) {
        //     var self = this;
        //     this._drawingMode = DrawingTypes.DRAWING_CIRCLE_QUERY;
        //     exchangeImageUrl(this, false);
        //     this._dispatchOverlayBegin(options);
        //     var scene = this._scene;
        //     var primitive = this._drawPrimitives;
        //     var tooltip = this._tooltip;
        //     var height = options.altitude;
        //     var circlePrimitive = null;

        //     this._beforeDrawing(function () {
        //         if (null !== circlePrimitive) {
        //             primitive.remove(circlePrimitive);
        //         }
        //         self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });

        //     self._markers = null;
        //     scene.screenSpaceCameraController.enableLook = false;
        //     scene.screenSpaceCameraController.enableTilt = false;
        //     scene.screenSpaceCameraController.enableRotate = false;
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);
        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cartesian3).height;
        //             }
        //             var position = pickGlobe(scene, movement.position, height);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             if (position && null === circlePrimitive) {
        //                 if (defined(scene)) {
        //                     scene.refreshAlways = false;
        //                 }
        //                 tooltip.showCircleLabelText(movement.position, 0, true);
        //                 var cartographic = ellipsoid.cartesianToCartographic(position);
        //                 height = defined(height) ? height : cartographic.height;
        //                 if (defined(options.aboveHeight)) {
        //                     height += options.aboveHeight;
        //                 }
        //                 options.center = position;
        //                 options.radius = 0;
        //                 options.height = height;
        //                 options.asynchronous = false;
        //                 options.queryPrimitive = true;
        //                 circlePrimitive = new CirclePrimitive(options);

        //                 primitive.add(circlePrimitive);
        //                 // self._markers = new BillboardGroup(self, defaultBillboard);
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_DOWN);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.endPosition) {
        //             var position = pickGlobe(scene, movement.endPosition, height);
        //             //var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
        //             if (null !== position && null !== circlePrimitive) {
        //                 tooltip.showCircleLabelText(undefined, getSurfaceDistance(circlePrimitive.getCenter(), position), undefined);
        //                 circlePrimitive.setRadius(Cartesian3.distance(circlePrimitive.getCenter(), position));
        //             }
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position && null !== circlePrimitive) {
        //             //var position =  pickGlobe(scene, movement.position, height)
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             tooltip.showCircleLabelText(movement.position, circlePrimitive.getRadius(), false);
        //             options.center = circlePrimitive.getCenter();
        //             options.radius = circlePrimitive.getRadius();
        //             options.height = height;
        //             options.asynchronous = false;
        //             options.queryPrimitive = true;
        //             var newCirclePrimitive = new CirclePrimitive(options);
        //             self._dispatchOverlayComplete(newCirclePrimitive, null, {
        //                 target: this
        //             }, options);
        //             self._afterDrawing();
        //             scene.screenSpaceCameraController.enableLook = true;
        //             scene.screenSpaceCameraController.enableTilt = true;
        //             scene.screenSpaceCameraController.enableRotate = true;
        //         }
        //     }, ScreenSpaceEventType.LEFT_UP);
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingCircle = function (options) {
        //     var self = this;
        //     options = options || {};
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_CIRCLE;
        //     this._dispatchOverlayBegin(options);
        //     var scene = this._scene;
        //     var primitive = this._drawPrimitives;
        //     var tooltip = this._tooltip;
        //     var circlePrimitive = null;
        //     var height = options.altitude || 0;

        //     this._beforeDrawing(function () {
        //         if (null !== circlePrimitive) {
        //             primitive.remove(circlePrimitive);
        //         }
        //         // self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });

        //     //self._markers = null;
        //     scene.screenSpaceCameraController.enableLook = false;
        //     scene.screenSpaceCameraController.enableTilt = false;
        //     scene.screenSpaceCameraController.enableRotate = false;
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {

        //             var pickedFeature = scene.pick(movement.position);
        //             if (defined(pickedFeature)) {
        //                 var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
        //                 height = Cartographic.fromCartesian(cartesian3).height;
        //             }

        //             var position = pickGlobe(scene, movement.position, height);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);

        //             if (position && null === circlePrimitive) {
        //                 if (defined(scene)) {
        //                     scene.refreshAlways = true;
        //                 }
        //                 tooltip.showCircleLabelText(movement.position, 0, true);

        //                 options.center = position;
        //                 options.radius = 0;
        //                 options.height = height;
        //                 options.asynchronous = false;
        //                 circlePrimitive = new CirclePrimitive(options);
        //                 primitive.add(circlePrimitive);
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_DOWN);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.endPosition && null !== circlePrimitive) {
        //             var position = pickGlobe(scene, movement.endPosition, height);
        //             //var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
        //             if (null !== position) {
        //                 tooltip.showCircleLabelText(undefined, getSurfaceDistance(circlePrimitive.getCenter(), position), undefined);
        //                 circlePrimitive.setRadius(Cartesian3.distance(circlePrimitive.getCenter(), position));
        //             }
        //         }
        //     }, ScreenSpaceEventType.MOUSE_MOVE);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var position = pickGlobe(scene, movement.position, height);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             if (position && null !== circlePrimitive) {
        //                 tooltip.showCircleLabelText(movement.position, 0, false);

        //                 options.center = circlePrimitive.getCenter();
        //                 options.radius = circlePrimitive.getRadius();
        //                 options.height = height;
        //                 options.asynchronous = false;
        //                 var newCirclePrimitive = new CirclePrimitive(options);
        //                 ellipsoid.cartesianToCartographic(position);
        //                 primitive.add(newCirclePrimitive);
        //                 if (options.editable) {
        //                     newCirclePrimitive.setEditable();
        //                 }
        //                 var centerLatLng = ellipsoid.cartesianToCartographic(newCirclePrimitive.getCenter());
        //                 var cartesianArray = newCirclePrimitive.getCircleCartesianCoordinates(CesiumMath.PI_OVER_TWO);
        //                 var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianArray);
        //                 self._dispatchOverlayComplete(newCirclePrimitive, cartographicArray, {
        //                     center: centerLatLng,
        //                     radius: circlePrimitive.getRadius(), // geodesic.surfaceDistance,
        //                     target: this
        //                 }, options);
        //                 scene.screenSpaceCameraController.enableLook = true;
        //                 scene.screenSpaceCameraController.enableTilt = true;
        //                 scene.screenSpaceCameraController.enableRotate = true;
        //                 self._afterDrawing();
        //             }
        //         }
        //     }, ScreenSpaceEventType.LEFT_UP);
        // };

        // /**
        //  * @method
        //  * @param options
        //  */
        // DrawingManager.prototype.startDrawingClickQuery = function (options) {
        //     var self = this;
        //     exchangeImageUrl(this, false);
        //     this._drawingMode = DrawingTypes.DRAWING_CLICK_QUERY;
        //     options = options || {};
        //     this._dispatchOverlayBegin(options);
        //     var scene = this._scene;
        //     var tooltip = this._tooltip;

        //     this._beforeDrawing(function () {
        //         //  self._markers = self._markers && self._markers.remove();
        //         self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
        //         tooltip = tooltip && tooltip.setVisible(false);
        //     });

        //     // self._markers = new BillboardGroup(this, options);
        //     self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

        //     self._mouseHandler.setInputAction(function (movement) {
        //         if (null !== movement.position) {
        //             var position = pickGlobe(scene, movement.position);
        //             //var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
        //             var cartographic = ellipsoid.cartesianToCartographic(position);
        //             var newMarkerCollection = new MarkerCollection(self._viewer);
        //             options.lon = CesiumMath.toDegrees(cartographic.longitude);
        //             options.lat = CesiumMath.toDegrees(cartographic.latitude);
        //             var newPrimitive = newMarkerCollection.addModel(options);
        //             newPrimitive.mousePosition = movement.position;
        //             self._dispatchOverlayComplete(newPrimitive, null, {
        //                 target: this
        //             }, options);
        //             scene.refreshOnce = true;
        //         }
        //     }, ScreenSpaceEventType.LEFT_CLICK);
        // };

        // DrawingManager.prototype.drawDynamicMarker = function (t, r, i) {
        //     var cartographicPosition = ellipsoid.cartesianToCartographic(t.position);
        //     var height = this._scene.globe.getHeight(cartographicPosition);
        //     if (defined(height)) {
        //         cartographicPosition.height = height;
        //         screenPosition = SceneTransforms.wgs84ToWindowCoordinates(this._scene, ellipsoid.cartographicToCartesian(cartographicPosition), screenPosition);
        //     } else {
        //         screenPosition = SceneTransforms.wgs84ToWindowCoordinates(this._scene, t.position, screenPosition);
        //     }
        //     displayDynamicMarkerDIV(this, t, screenPosition, r, i);
        // };

        /**
         * 内部方法，绘制多边形
         * @param isPolygon
         * @param options
         * @private
         * @see PolygonPrimitive
         * @see PolylinePrimitive
         */
        DrawingManager.prototype._startDrawingPolyShape = function (isPolygon, options) {
            var self = this;

            var poly;
            var scene = this._scene;
            var primitives = this._drawPrimitives;
            var tooltip = this._tooltip;
            var minPoints = isPolygon ? 3 : 2;
            if (isPolygon) {
                poly = new PolygonPrimitive(options);
            } else if (self._drawingMode === DrawingTypes.DRAWING_POLYLINE) {
                poly = new PolylinePrimitive(options, false);
            } else {
                poly = new PolylinePrimitive(options, true);
            }
            primitives.add(poly);
            var height = options.altitude || 0;
            var baseHtml = '';
            if (this._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                baseHtml = '距离：';

            } else if (this._drawingMode === DrawingTypes.DRAWING_AREA) {
                baseHtml = '面积：';
            }
            var cartesianPositions = [];

            this._beforeDrawing(function () {
                primitives = primitives && primitives.remove(poly);
                self._markers = self._markers && self._markers.remove();
                self._mouseHandler = self._mouseHandler && self._mouseHandler.destroy();
                tooltip = tooltip && tooltip.setVisible(false);
            });

            this._dispatchOverlayBegin(options);

            self._markers = new BillboardGroup(this, defaultBillboard);

            self._mouseHandler = new ScreenSpaceEventHandler(scene.canvas);

            self._mouseHandler.setInputAction(function (movement) {
                if (null !== movement.position) {
                    var pickedFeature = scene.pick(movement.position);
                    if (defined(pickedFeature) && defined(pickedFeature.content)) {
                        var cartesian3 = pickedFeature.content._tile._boundingVolume._boundingSphere.center;
                        height = Cartographic.fromCartesian(cartesian3).height;
                    }
                    //var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    var cartesian = pickGlobe(scene, movement.position, height);
                    if (cartesian) {
                        if (defined(scene)) {
                            scene.refreshAlways = true;
                        }
                        if (0 === cartesianPositions.length) {
                            cartesianPositions.push(cartesian.clone());
                            self._markers.addBillboard(cartesianPositions[0]);
                        }
                        if (cartesianPositions.length >= minPoints) {
                            poly.positions = cartesianPositions;
                            poly._createPrimitive = true;
                        }
                        cartesianPositions.push(cartesian);
                        self._markers.addBillboard(cartesian);
                    }
                }
            }, ScreenSpaceEventType.LEFT_CLICK);

            self._mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (null !== position) {
                    if (0 === cartesianPositions.length) {
                        if (self._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            tooltip.showAt(position, baseHtml + '0米');
                        } else if (self._drawingMode === DrawingTypes.DRAWING_AREA) {
                            tooltip.showAt(position, baseHtml + '0平方米');
                        } else if (self._showTooltip) {
                            tooltip.showAt(position, '点击添加第一个点');
                        }
                    } else {
                        var cartesian3 = pickGlobe(scene, position, height);
                        //var cartesian3 = scene.camera.pickEllipsoid(position, ellipsoid);
                        if (cartesian3) {
                            cartesianPositions.pop();
                            //确保移动的两个点是不同的值
                            cartesian3.y += 1 + Math.random();
                            cartesianPositions.push(cartesian3);
                            if (cartesianPositions.length >= minPoints) {
                                poly.positions = cartesianPositions;
                                poly._createPrimitive = true;
                            }
                            self._markers.getBillboard(cartesianPositions.length - 1).position = cartesian3;
                            if (self._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                                var perimeter = computePerimeter(cartesianPositions);
                                var distanceHtml = addUnit(perimeter);
                                tooltip.showAt(position, baseHtml + distanceHtml + (cartesianPositions.length > minPoints ? ',双击结束' : ''));
                            } else if (self._drawingMode === DrawingTypes.DRAWING_AREA) {
                                var cartographicPositions = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                                var area = new PolygonArea(cartographicPositions);
                                var areaHtml = getAreaText(area);
                                tooltip.showAt(position, baseHtml + areaHtml + (cartesianPositions.length > minPoints ? ',双击结束' : ''));
                            } else if (self._showTooltip) {
                                tooltip.showAt(position, (cartesianPositions.length <= minPoints ? '点击添加新点 (' + cartesianPositions.length + ')' : '') + (cartesianPositions.length > minPoints ? '双击结束绘制' : ''));
                            }
                        }
                    }
                }
            }, ScreenSpaceEventType.MOUSE_MOVE);

            self._mouseHandler.setInputAction(function (movement) {
                var position = movement.position;
                if (null !== position) {
                    if (cartesianPositions.length < minPoints + 2) {
                        return;
                    }
                    // var p = scene.camera.pickEllipsoid(position, ellipsoid);
                    var p = pickGlobe(scene, position, height);
                    if (p) {
                        self._afterDrawing();
                        cartesianPositions.pop();
                        cartesianPositions.pop();
                        for (var a = cartesianPositions.length - 1; a > 0; a--) {
                            cartesianPositions[a].equalsEpsilon(cartesianPositions[a - 1], CesiumMath.EPSILON3);
                        }
                        var poly;
                        if (isPolygon) {
                            poly = new PolygonPrimitive(options);
                        } else if (self._drawingMode === DrawingTypes.DRAWING_POLYLINE) {
                            poly = new PolylinePrimitive(options, false);
                            //poly.heightReference = HeightReference.NONE;
                        } else {
                            poly = new PolylinePrimitive(options, true);
                        }
                        poly.positions = cartesianPositions;
                        if (self._drawingMode === DrawingTypes.DRAWING_DISTANCE) {
                            var perimeter = computePerimeter(cartesianPositions);
                            self._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: this
                            }, {
                                distance: perimeter
                            });
                        } else if (self._drawingMode === DrawingTypes.DRAWING_AREA) {
                            var cartographicArray = ellipsoid.cartesianArrayToCartographicArray(cartesianPositions);
                            var area = new PolygonArea(cartographicArray);
                            self._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: this
                            }, {
                                area: area
                            });
                        } else {
                            self._drawPrimitives.add(poly);
                            if (options.editable) {
                                poly.setEditable();
                            }
                            self._dispatchOverlayComplete(poly, ellipsoid.cartesianArrayToCartographicArray(cartesianPositions), {
                                target: this
                            }, options);
                        }
                    }
                }
            }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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