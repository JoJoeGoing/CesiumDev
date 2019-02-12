define(['../../Core/defined',
        '../../Core/destroyObject',
        '../../Core/defaultValue',
        '../../Core/DeveloperError',
        '../../Core/Cartesian3',
        '../../Core/CircleGeometry',
        '../../Core/CircleOutlineGeometry',
        '../../Core/Math',
        '../../Core/Color',
        '../../Core/buildModuleUrl',
        '../../Core/ScreenSpaceEventType',
        '../../Core/ScreenSpaceEventHandler',
        '../../Core/Rectangle',
        '../../Core/Ellipsoid',
        '../../Scene/HeightReference',
        '../../Scene/EllipsoidSurfaceAppearance',
        '../../Scene/Material',
        './DrawingTypes',
        './ChangeablePrimitive',
        './BillboardGroup'
], function (defined, destroyObject, defaultValue, DeveloperError, Cartesian3,
            CircleGeometry, CircleOutlineGeometry, CesiumMath, Color, buildModuleUrl,
            ScreenSpaceEventType, ScreenSpaceEventHandler, Rectangle, Ellipsoid,
            HeightReference, EllipsoidSurfaceAppearance, Material, DrawingTypes,
            ChangeablePrimitive, BillboardGroup) {
    'use strict';

    var defaultOptions = {
        iconUrl : buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png'),
        shiftX : 0,
        shiftY : 0
    };

    /**
     * 绘制圆
     * @alias Uni_CirclePrimitive
     * @param options
     * @property ellipsoid
     * @constructor
     * @see ChangeablePrimitive
     */

    function CirclePrimitive(options) {
        if(!defined(options.scene)){
            throw new DeveloperError('cesium scene is required');
        }
        if (!defined(options.center) || !defined(options.radius)) {
            throw new DeveloperError('Center and radius are required');
        }
        this.initialiseOptions(options);
        this.center = options.center;
        this.material = options.material;
        this.appearance = new EllipsoidSurfaceAppearance({
            aboveGround : true,
            renderState : {
                lineWidth : 1
            }
        });
        this.setRadius(options.radius);
    }

    function getBounding(cartesianArray) {
        var northwest = cartesianArray[0].x;
        var northeast = cartesianArray[0].x;
        var southeast = cartesianArray[0].y;
        var southwest = cartesianArray[0].y;
        for (var o = 1; o < cartesianArray.length; o++) {
            northwest = northwest < cartesianArray[o].x ? northwest : cartesianArray[o].x;
            northeast = northeast > cartesianArray[o].x ? northeast : cartesianArray[o].x;
            southeast = southeast < cartesianArray[o].y ? southeast : cartesianArray[o].y;
            southwest = southwest > cartesianArray[o].y ? southwest : cartesianArray[o].y;
        }
        return [northwest, northeast, southeast, southwest];
    }

    CirclePrimitive.prototype = new ChangeablePrimitive();

    CirclePrimitive.prototype.getType = function() {
        return DrawingTypes.DRAWING_CIRCLE;
    };

    CirclePrimitive.prototype.setCenter = function(center) {
        this.setAttribute('center', center);
    };

    CirclePrimitive.prototype.setRadius = function(radius) {
        this.setAttribute('radius', Math.max(0.1, radius));
    };

    CirclePrimitive.prototype.getCenter = function() {
        return this.getAttribute('center');
    };

    CirclePrimitive.prototype.getRadius = function() {
        return this.getAttribute('radius');
    };

    CirclePrimitive.prototype.getGeometry = function() {
        if (defined(this.center) && defined(this.radius)) {
            return new CircleGeometry({
                center : this.center,
                radius : this.radius,
                height : this.height,
                vertexFormat : EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        }
    };

    CirclePrimitive.prototype.getOutlineGeometry = function() {
        return new CircleOutlineGeometry({
            height : this.height,
            center : this.getCenter(),
            radius : this.getRadius()
        });
    };

    CirclePrimitive.prototype.getCircleCartesianCoordinates = function(granularity) {
        var geometry = CircleOutlineGeometry.createGeometry(new CircleOutlineGeometry({
            ellipsoid : this.ellipsoid,
            center : this.getCenter(),
            radius : this.getRadius(),
            granularity : granularity
        }));
        var count = 0, value, values = [];
        for (; count < geometry.attributes.position.values.length; count += 3) {
            value = geometry.attributes.position.values;
            values.push(new Cartesian3(value[count], value[count + 1], value[count + 2]));
        }
        return values;
    };

    CirclePrimitive.prototype.filter = function(primitive) {
        var drawingType = primitive.getType();
        if (primitive.queryPrimitive) {
            return false;
        }
        if (drawingType === DrawingTypes.DRAWING_POLYLINE || drawingType === DrawingTypes.DRAWING_POLYGON || drawingType === DrawingTypes.DRAWING_POLYLINE_ARROW) {
            if (!defined(primitive.positions)) {
                return false;
            }
            for (var i = 0; i < primitive.positions.length; i++) {
                if (Cartesian3.distance(this.center, primitive.positions[i]) <= this.getRadius()) {
                    return true;
                }
            }
        } else if (drawingType === DrawingTypes.DRAWING_MARKER) {
            if (defined(primitive.length)) {
                for (var j = 0; j < primitive.length; j++) {
                    var o = primitive.get(j);
                    if (Cartesian3.distance(this.center, o.position) <= this.getRadius()) {
                        return true;
                    }
                }
            } else if (Cartesian3.distance(this.center, primitive.position) <= this.getRadius()) {
                return true;
            }
        } else if (drawingType === DrawingTypes.DRAWING_CIRCLE) {
            if (Cartesian3.distance(this.center, primitive.center) <= this.getRadius() + primitive.getRadius()) {
                return true;
            }
        } else {
            if (drawingType === DrawingTypes.DRAWING_RECTANGLE) {
                var cartesianArray = getBounding(primitive.getExtentCorners());
                return !(cartesianArray[0] > this.center.x + this.radius || cartesianArray[1] < this.center.x - this.radius || cartesianArray[2] > this.center.y + this.radius || cartesianArray[3] < this.center.y - this.radius);
            }
            if (drawingType === DrawingTypes.DRAWING_MODEL) {
                if (defined(primitive.length)) {
                    for (var k = 0; k < primitive.length; k++) {
                        var model = primitive.get(k);
                        if (Cartesian3.distance(this.center, model.position) <= this.getRadius()) {
                            return true;
                        }
                    }
                } else if (Cartesian3.distance(this.center, primitive.position) <= this.getRadius()) {
                    return true;
                }
            }
        }
        return false;
    };

    CirclePrimitive.prototype.toJson = function() {
        if (defined(this.center) && defined(this.radius)) {
            var position = this.ellipsoid.cartesianToCartographic(this.center);
            var color = '#F00';
            if (defined(this.material) && 'Color' === this.material.type) {
                color = this.material.uniforms.color.toCssColorString();
            }
            var geoJson = {
                type : this.type,
                geometry : {
                    center : [CesiumMath.toDegrees(position.longitude), CesiumMath.toDegrees(position.latitude)],
                    radius : this.getRadius()
                },
                properties : {
                    color : color
                }
            };
            geoJson.properties.height = defaultValue(this.height, 0);
            geoJson.properties.extrudedHeight = defaultValue(this.extrudedHeight, 0);
            return JSON.stringify(geoJson);
        }
    };

    CirclePrimitive.fromJson = function(jsonString, options) {
        var json = JSON.parse(jsonString);
        options = defaultValue(options, {});
        if (defined(json.properties.color)) {
            (options.material = Material.fromType('Color', {
                color : Color.fromCssColorString(json.properties.color)
            }));
        }
        if (defined(json.properties.height)) {
            options.height = json.properties.height;
        }
        if (defined(json.properties.extrudedHeight)) {
            options.extrudedHeight = json.properties.extrudedHeight;
        }
        options.center = Cartesian3.fromDegrees(json.geometry.center[0], json.geometry.center[1]);
        options.radius = json.geometry.radius;

        return new CirclePrimitive(options);
    };

    CirclePrimitive.prototype.setEditable = function(editMode) {
        editMode = defaultValue(editMode, true);
        this._editable = editMode;
        var self = this;
        defaultOptions.primitive = self;
        if (defined(this.owner)) {
            var drawingManager = this.owner;
            var scene = drawingManager._scene;
            self.asynchronous = false;
            if (editMode) {
                drawingManager.registerEditableShape(self);
                self.setEditMode = function(editMode) {

                    if (this._editMode !== editMode) {
                        drawingManager.disableAllHighlights();
                        if (editMode) {
                            drawingManager.setEdited(this);
                            if (null === this._markers) {
                                var markers = new BillboardGroup(drawingManager, defaultOptions);
                                var handleMarkerChanges = {
                                    dragHandlers : {
                                        onDrag : function(index, position) {
                                            scene.renderAlways = true;
                                            self.setRadius(Cartesian3.distance(self.getCenter(), position));
                                            markers.updateBillboardsPositions(getMarkerPositions());
                                        },
                                        onDragEnd : function() {
                                            onEdited();
                                            scene.renderAlways = false;
                                        }
                                    },
                                    tooltip : function() {
                                        return '拖动改变半径';
                                    }
                                };
                                markers.addBillboards(getMarkerPositions(), handleMarkerChanges);
                                this._markers = markers;
                                this._globeClickhandler = new ScreenSpaceEventHandler(scene.canvas);

                                this._globeClickhandler.setInputAction(function(movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    if (pickedObject && pickedObject.primitive) {
                                        self.setEditMode(false);
                                    }
                                }, ScreenSpaceEventType.LEFT_CLICK);
                                markers.setOnTop();
                            }
                            this._editMode = true;
                        } else {
                            if (this._markers !== null) {
                                this._markers.remove();
                                this._markers = null;
                                this._globeClickhandler.destroy();
                            }
                            this._editMode = false;
                        }
                    }

                    function getMarkerPositions() {
                        return self.getCircleCartesianCoordinates(CesiumMath.PI_OVER_TWO);
                    }

                    function onEdited() {
                        drawingManager._dispatchOverlayEdited(self, {
                            name : 'onEdited',
                            center : self.getCenter(),
                            radius : self.getRadius()
                        });
                    }
                };
                self.setHighlighted = drawingManager._setHighlighted;
                self.setEditMode(false);
            } else {
                drawingManager.unregisterEditableShape(self);
            }

        }
    };

    return CirclePrimitive;
});
