define(['../../Core/defined',
     '../../Core/destroyObject',
     '../../Core/DeveloperError',
     '../../Core/defaultValue',
     '../../Core/Ellipsoid',
     '../../Core/Cartographic',
     '../../Core/Rectangle',
     '../../Core/RectangleGeometry',
     '../../Core/RectangleOutlineGeometry',
     '../../Core/Math',
     '../../Core/Color',
     '../../Core/ScreenSpaceEventType',
     '../../Core/ScreenSpaceEventHandler',
     '../../Core/buildModuleUrl',
     '../../Core/Cartesian3',
     '../../Scene/HeightReference',
     '../../Scene/EllipsoidSurfaceAppearance',
     '../../Scene/Material',
     '../DrawingTypes',
     './ChangeablePrimitive',
     ], function(defined, destroyObject, DeveloperError,
                                   defaultValue, Ellipsoid, Cartographic,
                                   Rectangle, RectangleGeometry, RectangleOutlineGeometry,
                                   CesiumMath, Color, ScreenSpaceEventType,
                                   ScreenSpaceEventHandler, buildModuleUrl, Cartesian3,
                                   HeightReference, EllipsoidSurfaceAppearance, Material,
                                   DrawingTypes,  ChangeablePrimitive) {
        'use strict';

        var defaultRectangleOptions = {
            iconUrl : buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png'),
            shiftX : 0,
            shiftY : 0
        };

        var resultPoint = new Cartographic();

        /**
         * @alias Uni_ExtentPrimitive
         * @param options
         * @constructor
         */
        function RectanglePrimitive(options) {

            this.initialiseOptions(options);
            this.setExtent(options.extent);
            this._material =Material.fromType('Color',{
                color : this.color
            });
            this.appearance = new EllipsoidSurfaceAppearance({
                material : this._material,
                aboveGround : true,
                renderState : {
                    lineWidth : 1
                }
            });
        }

        /**
         * @method
         * @param {Cartographic} cartographic1
         * @param {Cartographic} cartographic2
         * @return {Rectangle|exports}
         * @see DrawingManager.getExtend
         */
        function getRectExtend(cartographic1, cartographic2) {
            var rectangle = new Rectangle();
            rectangle.west = Math.min(cartographic1.longitude, cartographic2.longitude);
            rectangle.east = Math.max(cartographic1.longitude, cartographic2.longitude);
            rectangle.south = Math.min(cartographic1.latitude, cartographic2.latitude);
            rectangle.north = Math.max(cartographic1.latitude, cartographic2.latitude);
            //检查大约等于多少
            var epsilon = CesiumMath.EPSILON7;
            if (rectangle.east - rectangle.west < epsilon) {
                rectangle.east += 2 * epsilon;
            }
            if (rectangle.north - rectangle.south < epsilon) {
                rectangle.north += 2 * epsilon;
            }
            return rectangle;
        }

        RectanglePrimitive.prototype = new ChangeablePrimitive();

        RectanglePrimitive.prototype.getType = function() {
            return DrawingTypes.DRAWING_RECTANGLE;
        };
        RectanglePrimitive.prototype.setExtent = function(e) {
            this.setAttribute('extent', e);
        };
        RectanglePrimitive.prototype.getExtent = function() {
            return this.getAttribute('extent');
        };
        RectanglePrimitive.prototype.getGeometry = function() {
            if (defined(this.extent)) {
                return new RectangleGeometry({
                    rectangle : this.extent,
                    height : this.height,
                    vertexFormat : EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation : this.textureRotationAngle,
                    ellipsoid : this.ellipsoid,
                    granularity : this.granularity
                });
            }
        };

        RectanglePrimitive.prototype.getOutlineGeometry = function(e) {
            return new RectangleOutlineGeometry({
                height : this.height,
                rectangle : this.extent
            });
        };

        RectanglePrimitive.prototype.filter = function(primitive) {
            var drawingType = primitive.getType();
            if (primitive.queryPrimitive) {
                return false;
            }
            if (drawingType === DrawingTypes.DRAWING_POLYLINE || drawingType === DrawingTypes.DRAWING_POLYLINE_ARROW || drawingType === DrawingTypes.DRAWING_POLYGON) {
                if (!defined(primitive.positions)) {
                    return false;
                }
                for (var position = 0; position < primitive.positions.length; position++) {
                    resultPoint = this.ellipsoid.cartesianToCartographic(primitive.positions[position], resultPoint);
                    if (Rectangle.contains(this.extent, resultPoint)) {
                        return true;
                    }
                }
            } else if (drawingType === DrawingTypes.DRAWING_MARKER) {
                if (defined(primitive.length)) {
                    for (var point = 0; point < primitive.length; point++) {
                        var marker = primitive.get(point);
                        resultPoint = this.ellipsoid.cartesianToCartographic(marker.billboard.position, resultPoint);
                        if (Rectangle.contains(this.extent, resultPoint)) {
                            return true;
                        }
                    }
                } else if (Rectangle.contains(this.extent, resultPoint)) {
                    resultPoint = this.ellipsoid.cartesianToCartographic(primitive.billboard.position, resultPoint);
                    return true;
                }
            } else {
                if (drawingType === DrawingTypes.DRAWING_CIRCLE) {
                    var cartesianArray = this.ellipsoid.cartographicArrayToCartesianArray([Rectangle.southwest(this.extent), Rectangle.northeast(this.extent)]);
                    return primitive.center.x >= cartesianArray[0].x - primitive.radius && primitive.center.x <= cartesianArray[1].x + primitive.radius && primitive.center.y >= cartesianArray[0].y - primitive.radius && primitive.center.y <= cartesianArray[1].y + primitive.radius;
                }
                if (drawingType === DrawingTypes.DRAWING_RECTANGLE) {
                    return primitive !== this && this.extent.west <= primitive.extent.east && this.extent.east >= primitive.extent.west && this.extent.south <= primitive.extent.north && this.extent.north >= primitive.extent.south;
                }
                if (drawingType === DrawingTypes.DRAWING_MODEL) {
                    if (defined(primitive.length)) {
                        for (var i = 0; i < primitive.length; i++) {
                            var model = primitive.get(i);
                            if ( Rectangle.contains(this.extent, resultPoint)) {
                                resultPoint = this.ellipsoid.cartesianToCartographic(model.position, resultPoint);
                                return true;
                            }
                        }
                    } else if ( Rectangle.contains(this.extent, resultPoint)) {
                        resultPoint = this.ellipsoid.cartesianToCartographic(primitive.position, resultPoint);
                        return true;
                    }
                }
            }
            return false;
        };

        RectanglePrimitive.prototype.toJson = function() {
            if (defined(this.extent)) {
                var west = CesiumMath.toDegrees(this.extent.west);
                var east = CesiumMath.toDegrees(this.extent.east);
                var north = CesiumMath.toDegrees(this.extent.north);
                var south = CesiumMath.toDegrees(this.extent.south);
                // var color = '#F00';
                // if (defined(this.material) && 'Color' === this.material.type) {
                //     color = this.material.uniforms.color.toCssColorString();
                // }
                var geoJson = {
                    type : this.type,
                    geometry : {
                        west : west,
                        east : east,
                        north : north,
                        south : south
                    },
                    properties : {
                        color : this.color.toCssColorString()
                    }
                };
                if (defined(this.height)) {
                    geoJson.properties.height = this.height;
                }
                if (defined(this.extrudedHeight)) {
                    geoJson.properties.extrudedHeight = this.extrudedHeight;
                }
                return JSON.stringify(geoJson);
            }
        };

        RectanglePrimitive.fromJson = function(jsonString) {
            var json = JSON.parse(jsonString);
            var options = {};
            if (defined(json.properties.color)) {
                // options.material = Material.fromType('Color', {
                //     color : Color.fromCssColorString(json.properties.color)
                // });
                options.color = Color.fromCssColorString(json.properties.color);

            }
            if (defined(json.properties.height)) {
                options.height = json.properties.height;
            }
            if (defined(json.properties.extrudedHeight)) {
                options.extrudedHeight = json.properties.extrudedHeight;
            }
            options.extent = Rectangle.fromDegrees(json.geometry.west, json.geometry.south, json.geometry.east, json.geometry.north);
            return new RectanglePrimitive(options);
        };

        RectanglePrimitive.prototype.setEditable = function(editMode) {
            editMode = defaultValue(editMode, true);
            this._editable = editMode;
            var self = this;
            defaultRectangleOptions.primitive = self;

            if (defined(this.owner)) {
                var drawingManager = this.owner;
                var scene = drawingManager._scene;
                self.asynchronous = false;
                var ellipsoid = this.ellipsoid;
                if (editMode) {
                    drawingManager.registerEditableShape(self);
                    self.setEditMode = function(editMode) {
                        function onEdited() {
                            drawingManager._dispatchOverlayEdited(self, {
                                name : 'onEdited',
                                extent : self.extent
                            });
                        }

                        if (this._editMode !== editMode) {
                            drawingManager.disableAllHighlights();
                            if (editMode) {
                                drawingManager.setEdited(this);
                                if (null === this._markers) {
                                    var billboardGroup = new BillboardGroup(drawingManager, defaultRectangleOptions);
                                    var callbacks = {
                                        dragHandlers : {
                                            onDrag : function(e, t) {
                                                scene.renderAlways = true;
                                                var n = billboardGroup.getBillboard((e + 2) % 4).position;
                                                self.setExtent(getRectExtend(ellipsoid.cartesianToCartographic(n), ellipsoid.cartesianToCartographic(t)));
                                                billboardGroup.updateBillboardsPositions(self.getExtentCorners());
                                            },
                                            onDragEnd : function(e, r) {
                                                onEdited();
                                                scene.renderAlways = false;
                                            }
                                        },
                                        tooltip : function() {
                                            return '拖动改变矩形';
                                        }
                                    };
                                    billboardGroup.addBillboards(self.getExtentCorners(), callbacks);
                                    this._markers = billboardGroup;
                                    this._globeClickhandler = new ScreenSpaceEventHandler(scene.canvas);
                                    this._globeClickhandler.setInputAction(function(movement) {
                                        var model = scene.pick(movement.position);
                                        if (!model || !model.primitive || model.primitive.isDestroyed()) {
                                            self.setEditMode(false);
                                        }
                                    }, ScreenSpaceEventType.LEFT_CLICK);
                                    billboardGroup.setOnTop();
                                }
                                this._editMode = true;
                            } else {
                                if (null !== this._markers) {
                                    this._markers.remove();
                                    this._markers = null;
                                    this._globeClickhandler.destroy();
                                }
                                this._editMode = false;
                            }
                        }
                    };
                    self.setHighlighted = drawingManager._setHighlighted;
                    self.setEditMode(false);
                } else {
                    drawingManager.unregisterEditableShape(self);
                }
            }
        };

        RectanglePrimitive.prototype.getExtentCorners = function() {
            var tempPoint;

            var geometry = RectangleOutlineGeometry.createGeometry(new RectangleOutlineGeometry({
                height : this.height,
                rectangle : this.extent
            }));
            var extentCorners = [];

            for (var r = 0; r < geometry.attributes.position.values.length; r += 3) {
                tempPoint = geometry.attributes.position.values;
                extentCorners.push(new Cartesian3(tempPoint[r], tempPoint[r + 1], tempPoint[r + 2]));
            }
            return extentCorners;
        };
        return RectanglePrimitive;
    });
