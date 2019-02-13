define(['../../Core/defined',
    '../../Core/defaultValue',
    '../../Core/Ellipsoid',
    '../../Core/Cartesian3',
    '../../Core/PolygonGeometry',
    '../../Core/PolygonOutlineGeometry',
    '../../Core/Math',
    '../../Core/buildModuleUrl',
    '../../Core/ScreenSpaceEventType',
    '../../Core/ScreenSpaceEventHandler',
    '../../Core/EllipsoidGeodesic',
    '../../Core/Color',
    '../../Scene/HeightReference',
    '../../Scene/EllipsoidSurfaceAppearance',
    '../../Scene/PerInstanceColorAppearance',
    '../../Scene/Material',
    '../DrawingTypes',
    './ChangeablePrimitive'
], function (defined, defaultValue, Ellipsoid,
    Cartesian3, PolygonGeometry,
    PolygonOutlineGeometry, CesiumMath, buildModuleUrl,
    ScreenSpaceEventType, ScreenSpaceEventHandler,
    EllipsoidGeodesic, Color, HeightReference, EllipsoidSurfaceAppearance, PerInstanceColorAppearance, Material, DrawingTypes,
    ChangeablePrimitive) {
    'use strict';

    var dragBillboard = (buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png'), {
        iconUrl: buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png'),
        shiftX: 0,
        shiftY: 0
    });
    var dragLightBillboard = {
        iconUrl: buildModuleUrl('Widgets/Images/DrawingManager/dragIconLight.png'),
        shiftX: 0,
        shiftY: 0
    };

    /**
     * @alias Uni_PolygonPrimitive
     * @constructor
     */
    function PolygonPrimitive(options) {

        this.initialiseOptions(options);

        this._material = Material.fromType('Color', {
            color: this.color
        });

        this.appearance = new PerInstanceColorAppearance({
            closed: true,
            translucent: false
        });

        if (defined(options.coordinates)) {
            this.positions = Cartesian3.fromDegreesArrayHeights(options.coordinates, this.ellipsoid);
            this.coordinates = undefined;
        }
        if (defined(options.positions)) {
            this.positions = options.positions;
        }
        this.isPolygon = true;
    }

    PolygonPrimitive.prototype = new ChangeablePrimitive();

    PolygonPrimitive.prototype.getType = function () {
        return DrawingTypes.DRAWING_POLYGON;
    };
    PolygonPrimitive.prototype.setPositions = function (positions) {
        this.setAttribute('positions', positions);
    };
    PolygonPrimitive.prototype.getPositions = function () {
        return this.getAttribute('positions');
    };
    PolygonPrimitive.prototype.getGeometry = function () {
        if (defined(this.positions) && (this.positions.length >= 3)) {
            if (this._heightReference === HeightReference.CLAMP_TO_GROUND) {
                return PolygonGeometry.fromPositions({
                    positions: this.positions,
                    perPositionHeight: this.perPositionHeight,
                    vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation: this.textureRotationAngle,
                    ellipsoid: this.ellipsoid,
                    granularity: this.granularity
                });
            }
            return PolygonGeometry.fromPositions({
                positions: this.positions,
                height: this.height,
                vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation: this.textureRotationAngle,
                ellipsoid: this.ellipsoid,
                granularity: this.granularity
            });

        }
    };

    PolygonPrimitive.prototype.getOutlineGeometry = function () {
        if (this._heightReference === HeightReference.CLAMP_TO_GROUND) {
            return PolygonOutlineGeometry.fromPositions({
                perPositionHeight: this.perPositionHeight,
                positions: this.getPositions()
            });
        }
        return PolygonOutlineGeometry.fromPositions({
            height: this.height,
            positions: this.getPositions()
        });

    };

    /**
     *
     * @param {Array} result
     */
    PolygonPrimitive.prototype.toLonLats = function (result) {
        var cartographicArray = this.ellipsoid.cartesianArrayToCartographicArray(this.positions);
        var i = cartographicArray.length;
        if (defined(result)) {
            result.length = i;
        } else {
            result = new Array(i);
        }
        for (var n = 0; n < i; ++n) {
            result[n] = [CesiumMath.toDegrees(cartographicArray[n].longitude), CesiumMath.toDegrees(cartographicArray[n].latitude)];
        }
        return result;
    };

    /**
     *
     * @param coordinate
     * @param options
     * @return {PolygonPrimitive}
     */
    PolygonPrimitive.fromDegrees = function (coordinate, options) {
        options = defaultValue(options, {});
        options.coordinates = coordinate;
        options.asynchronous = false;
        return new PolygonPrimitive(options);
    };

    /**
     *
     * @param {boolean} editMode
     */
    PolygonPrimitive.prototype.setEditable = function (editable) {
        editable = defaultValue(editable, true);
        this._editable = editable;
        var self = this;
        self.asynchronous = false;
        if (defined(this.owner)) {
            var drawingManager = this.owner;
            if (editable) {
                drawingManager.registerEditableShape(self);
                self.setHighlighted = drawingManager._setHighlighted;
                self.setEditMode(false);
            } else {
                drawingManager.unregisterEditableShape(self);
            }
        }
    };
    /**
     *
     * @param {boolean} editMode
     */
    PolygonPrimitive.prototype.setEditMode = function (editMode) {

        var drawingManager = this.owner;
        var self = this;
        var ellipsoid = this.ellipsoid;

        if (this._editMode !== editMode) {
            drawingManager.disableAllHighlights();
            dragBillboard.primitive = self;
            dragLightBillboard.primitive = self;
            if (editMode) {
                self.updateHeightPositions();
                drawingManager.setEdited(this);
                var scene = drawingManager._scene;
                if (null === this._markers) {
                    var dragBillboardGroup = new BillboardGroup(drawingManager, dragBillboard);
                    var dragLightBillboardGroup = new BillboardGroup(drawingManager, dragLightBillboard);
                    var handleMarkerChanges = {
                        dragHandlers: {
                            onDrag: function (index, position) {
                                scene.refreshAlways = true;
                                self.positions[index] = Cartesian3.clone(position, self.positions[index]);
                                updateBillboardPosition(dragLightBillboardGroup, index, self.positions);
                                self._createPrimitive = true;
                            },
                            onDragEnd: function (e, t) {
                                self._createPrimitive = true;
                                onEdited();
                                scene.refreshAlways = false;
                            }
                        },
                        onDoubleClick: function (index) {
                            if (self.positions.length >= 4) {
                                self.positions.splice(index, 1);
                                self._createPrimitive = true;
                                dragBillboardGroup.removeBillboard(index);
                                dragLightBillboardGroup.removeBillboard(index);
                                updateBillboardPosition(dragLightBillboardGroup, index, self.positions);
                                onEdited();
                            }
                        },
                        tooltip: function () {
                            if (self.positions.length > 3) {
                                return '拖动移位，双击删除';
                            }
                        }
                    };
                    dragBillboardGroup.addBillboards(self.positions, handleMarkerChanges);
                    this._markers = dragBillboardGroup;
                    var positions = [];
                    for (var y = 0; y < self.positions.length; y++) {
                        positions.push(getPosition(y));
                    }
                    var callbacks = {
                        dragHandlers: {
                            onDragStart: function (e, t) {
                                scene.refreshAlways = true;
                                this.index = e + 1;
                                self.positions.splice(this.index, 0, t);
                                self._createPrimitive = true;
                            },
                            onDrag: function (index, position) {
                                self.positions[this.index] = Cartesian3.clone(position, self.positions[this.index]);
                                self._createPrimitive = true;
                            },
                            onDragEnd: function (index, position) {
                                dragBillboardGroup.insertBillboard(this.index, position, handleMarkerChanges);
                                dragLightBillboardGroup.getBillboard(this.index - 1).position = getPosition(this.index - 1);
                                dragLightBillboardGroup.insertBillboard(this.index, getPosition(this.index), callbacks);
                                self._createPrimitive = true;
                                onEdited();
                                scene.refreshAlways = false;
                            }
                        },
                        tooltip: function () {
                            return '拖动创建新点';
                        }
                    };
                    dragLightBillboardGroup.addBillboards(positions, callbacks);
                    this._editMarkers = dragLightBillboardGroup;
                    this._globeClickhandler = new ScreenSpaceEventHandler(scene.canvas);

                    this._globeClickhandler.setInputAction(function (movement) {
                        var t = scene.pick(movement.position);
                        if (!(t && t.primitive)) {
                            self.setEditMode(false);
                        }
                    }, ScreenSpaceEventType.LEFT_CLICK);

                    dragBillboardGroup.setOnTop();
                    dragLightBillboardGroup.setOnTop();
                }
                this._editMode = true;
            } else {
                if (null !== this._markers) {
                    this._markers.remove();
                    if (this._editMarkers) {
                        this._editMarkers.remove();
                    }
                    this._markers = null;
                    this._editMarkers = undefined;
                    this._globeClickhandler.destroy();
                }
                this._editMode = false;
            }
        }

        function getPosition(index) {
            var positions = self.positions;
            var cartographic = ellipsoid.cartesianToCartographic(positions[index]);
            var cartesian = ellipsoid.cartesianToCartographic(positions[index < positions.length - 1 ? index + 1 : 0]);
            var geodesic = new EllipsoidGeodesic(cartographic, cartesian).interpolateUsingFraction(0.5);
            if (self.heightReference !== HeightReference.CLAMP_TO_GROUND) {
                if (defined(self.height)) {
                    geodesic.height = self.height;
                } else {
                    geodesic.height = (cartographic.height + cartesian.height) / 2;
                }
            }
            return ellipsoid.cartographicToCartesian(geodesic);
        }

        function updateBillboardPosition(billboardGroup, index, positions) {
            var n = index - 1 < 0 ? positions.length - 1 : index - 1;
            if (n < billboardGroup.countBillboards()) {
                billboardGroup.getBillboard(n).position = getPosition(n);
            }
        }

        function onEdited() {
            drawingManager._dispatchOverlayEdited(self, {
                name: 'onEdited',
                positions: self.positions
            });
        }
    };

    PolygonPrimitive.prototype.updateHeightPositions = function () {
        if (this._heightReference !== HeightReference.CLAMP_TO_GROUND) {
            var tempPosition;
            var t = PolygonOutlineGeometry.createGeometry(PolygonOutlineGeometry.fromPositions({
                height: this.height,
                positions: this.positions
            }));
            var positions = [];
            for (var r = 0; r < t.attributes.position.values.length; r += 3) {
                tempPosition = t.attributes.position.values;
                positions.push(new Cartesian3(tempPosition[r], tempPosition[r + 1], tempPosition[r + 2]));
            }
            this.positions = positions;
        }
    };
    return PolygonPrimitive;
});