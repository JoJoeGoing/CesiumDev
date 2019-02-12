define([
    '../../Core/defined',
    '../../Core/Ellipsoid',
    '../../Core/destroyObject',
    '../../Core/DeveloperError',
    '../../Core/defaultValue',
    '../../Core/defineProperties',
    '../../Core/Color',
    '../../Core/GeometryInstance',
    '../../Core/ColorGeometryInstanceAttribute',
    '../../Core/Cartographic',
    '../../Core/Cartesian3',
    '../../Core/BoundingSphere',
    '../../Core/Ray',
    '../../Renderer/ContextLimits',
    '../../Scene/HeightReference',
    '../../Scene/GroundPrimitive',
    '../../Scene/Primitive',
    '../../Scene/PerInstanceColorAppearance',
    '../../Scene/GroundPolylinePrimitive',
    '../../Scene/ClassificationType',
    '../DrawingTypes'
], function (defined, Ellipsoid, destroyObject, DeveloperError, defaultValue, defineProperties, CesiumColor,
             GeometryInstance, ColorGeometryInstanceAttribute, Cartographic, Cartesian3, BoundingSphere,
             Ray, ContextLimits, HeightReference, GroundPrimitive, Primitive, PerInstanceColorAppearance,
             GroundPolylinePrimitive,ClassificationType, DrawingTypes) {
    'use strict';

    /**
     * @alias Uni_ChangeablePrimitive
     * @constructor
     */
    function ChangeablePrimitive() {
        this._properties = {};
    }

    /**
     * @param options
     * @param [options.id]
     * @param [options.customId]
     * @param [options.scene]
     * @param [options.ellipsoid]
     * @param [options.show]
     * @param [options.debugShowBoundingVolume]
     * @param [options.geodesic]
     * @param [options.textureRotationAngle]
     * @param [options.perPositionHeight]
     * @param [options.queryPrimitive]
     * @param [options.altitude]
     * @param [options.height]
     * @param [options.heightReference]
     */
    ChangeablePrimitive.prototype.initialiseOptions = function (options) {
        this._scene = options.scene;
        this.ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84);
        this.asynchronous = defaultValue(options.asynchronous, false);
        this.show = defaultValue(options.show, true);
        this.debugShowBoundingVolume = defaultValue(options.debugShowBoundingVolume, false);
        //this.geodesic = defaultValue(options.geodesic, true);
        //this.textureRotationAngle = defaultValue(options.textureRotationAngle, 0);
        //this.perPositionHeight = defaultValue(options.perPositionHeight, true);
        this.editable = defaultValue(options.editable, false);
        //this.aboveHeight = parseFloat(options.aboveHeight) || 0;
        //this.labelBackgroundColor = defaultValue(options.labelBackgroundColor,new CesiumColor(1,1,1,1));
        this.queryPrimitive = defaultValue(options.queryPrimitive, false);
        this.width = parseInt(defaultValue(options.width,5));

        if (defined(options.altitude)) {
            this._heightReference = HeightReference.NONE;
        } else {
            this._heightReference = defaultValue(options.heightReference, HeightReference.CLAMP_TO_GROUND);
        }
        this.height = defaultValue(options.height,0);

        this._ellipsoid = undefined;
        this._granularity = undefined;
        this._height = undefined;
        this._textureRotationAngle = undefined;
        this._id = undefined;
        this._createPrimitive = true;
        this._primitive = undefined;
        this._outlinePolygon = undefined;

        if (defined(this.positions)) {
            this.boundSphere = BoundingSphere.fromPoints(this.positions, new BoundingSphere());
        }
    };

    /**
     * 属性变化后，实时刷新该primitive
     * @method
     * @param name
     * @param value
     */
    ChangeablePrimitive.prototype.setAttribute = function (name, value) {
        this[name] = value;
        this._createPrimitive = true;
    };

    ChangeablePrimitive.prototype.getAttribute = function (name) {
        return this[name];
    };

    ChangeablePrimitive.prototype.destroy = function () {
        this._editMarkers = this._editMarkers && this._editMarkers.remove();
        this._markers = this._markers && this._markers.remove();
        this._primitive = this._primitive && this._primitive.destroy();
        destroyObject(this);
    };

    ChangeablePrimitive.prototype.setOutlineStyle = function (outlineColor, outlineWidth) {
        if (!this.outlineColor || !this.outlineColor.equals(outlineColor) || this.outlineWidth !== outlineWidth) {
            this._createPrimitive = true;
            this.outlineColor = outlineColor;
            this.outlineWidth = outlineWidth;
        }
    };

    ChangeablePrimitive.prototype.needToUpdate = function () {
        if (this._createPrimitive && defined(this._primitive)) {
            this._primitive.co();
        }
    };

    ChangeablePrimitive.prototype.isDestroyed = function () {
        return false;
    };

    ChangeablePrimitive.prototype.update = function (frameState) {
        if (!defined(this.ellipsoid)) {
            throw new DeveloperError('ellipsoid must be defined.');
        }
        if (!defined(this.appearance)) {
            throw new DeveloperError('material must be defined.');
        }
        if (this.granularity < 0) {
            throw new DeveloperError('granularity and scene2D/scene3D overrides must be greater than zero.');
        }
        if (!this._createPrimitive && (!defined(this._primitive))) {
            return;
        }
        if (this.show) {
            if (this._createPrimitive || this._ellipsoid !== this.ellipsoid || this._granularity !== this.granularity|| this._height !== this.height|| this._textureRotationAngle !== this.textureRotationAngle|| this._id !== this.id) {
                var geometry = this.getGeometry(frameState);
                if (!geometry) {
                    return;
                }
                this._createPrimitive = false;
                this._ellipsoid = this.ellipsoid;
                this._granularity = this.granularity;
                this._height = this.height;
                this._textureRotationAngle = this.textureRotationAngle;
                this._id = this.id;
                this._primitive = this._primitive && this._primitive.destroy();

                var isNotGroundPrimitive = true;
                var color = new ColorGeometryInstanceAttribute(0, 1, 1, 0.5);
                if (defined(this.material) && defined(this.material.uniforms) && defined(this.material.uniforms.color)) {
                    var materialColor = this.material.uniforms.color;
                    color = new ColorGeometryInstanceAttribute(materialColor.red, materialColor.green, materialColor.blue, materialColor.alpha);
                }
                if (this._heightReference === HeightReference.CLAMP_TO_GROUND) {
                    switch (this.getType()) {

                        case DrawingTypes.DRAWING_POLYGON:
                        case DrawingTypes.DRAWING_RECTANGLE:
                        case DrawingTypes.DRAWING_CIRCLE:

                            this._primitive = new GroundPrimitive({
                                geometryInstances: new GeometryInstance({
                                    geometry: geometry,
                                    id: this.id,
                                    pickPrimitive: this,
                                    attributes: {
                                        color: color
                                    }
                                }),
                                classificationType :ClassificationType.BOTH,
                                 //appearance: this.appearance,
                                asynchronous: false
                            });
                            this._outlinePolygon = this._outlinePolygon && this._outlinePolygon.destroy();
                            if (this.outlineColor && this.getOutlineGeometry) {
                                this._outlinePolygon = new GroundPrimitive({
                                    geometryInstances: new GeometryInstance({
                                        geometry: this.getOutlineGeometry(frameState),
                                        attributes: {
                                            color: ColorGeometryInstanceAttribute.fromColor(this.outlineColor)
                                        }
                                    }),
                                    appearance: new PerInstanceColorAppearance({
                                        flat: true,
                                        translucent: 1 !== this.outlineColor.alpha,
                                        renderState: {
                                            lineWidth: Math.max(ContextLimits.minimumAliasedLineWidth, Math.min(this.outlineWidth || 4, ContextLimits.maximumAliasedLineWidth))
                                        }
                                    })
                                });
                            }
                            isNotGroundPrimitive = false;
                            break;
                    }
                }
                if (isNotGroundPrimitive) {
                    this._primitive = new Primitive({
                        geometryInstances: new GeometryInstance({
                            geometry: geometry,
                            id: this.id,
                            pickPrimitive: this,
                            attributes: {
                                color: color
                            }
                        }),
                        appearance: this.appearance,
                        asynchronous: this.asynchronous
                    });
                    this._outlinePolygon = this._outlinePolygon && this._outlinePolygon.destroy();
                    if (this.outlineColor && this.getOutlineGeometry) {
                        this._outlinePolygon = new Primitive({
                            geometryInstances: new GeometryInstance({
                                geometry: this.getOutlineGeometry(frameState),
                                attributes: {
                                    color: ColorGeometryInstanceAttribute.fromColor(this.outlineColor)
                                }
                            }),
                            appearance: new PerInstanceColorAppearance({
                                flat: true,
                                translucent: 1 !== this.outlineColor.alpha,
                                renderState: {
                                    lineWidth: Math.max(ContextLimits.minimumAliasedLineWidth, Math.min(this.outlineWidth || 4, ContextLimits.maximumAliasedLineWidth))
                                }
                            })
                        });
                        this._primitive.appearance.material = this.material;
                    }
                }
            }
            var primitive = this._primitive;
            primitive.debugShowBoundingVolume = this.debugShowBoundingVolume;
            primitive.update(frameState);
            if (defined(this._outlinePolygon) && this._outlinePolygon) {
                this._outlinePolygon.update(frameState);
            }
        }
    };

    defineProperties(ChangeablePrimitive.prototype, {
        properties: {
            get: function () {
                return this._properties;
            },
            set: function (value) {
                this._properties = value;
            }
        },
        altitude: {
            get: function () {
                return this.height;
            },
            set: function (value) {
                this.height = value;
                this._heightReference = HeightReference.NONE;
                this._createPrimitive = true;
            }
        },
        heightReference: {
            get: function () {
                return this._heightReference;
            },
            set: function (value) {
                if (this._heightReference !== value) {
                    this._heightReference = value;
                    if (this._heightReference === HeightReference.CLAMP_TO_GROUND) {
                        this.needToUpdatePosition = true;
                    }
                    this._createPrimitive = true;
                }
            }
        }
    });

    return ChangeablePrimitive;
});
