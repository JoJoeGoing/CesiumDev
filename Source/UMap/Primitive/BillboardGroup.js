define([
        '../../Core/defined',
        '../../Core/defaultValue',
        '../../Core/Color',
        '../../Core/Cartesian2',
        '../../Core/Cartesian3',
        '../../Core/ScreenSpaceEventType',
        '../../Core/ScreenSpaceEventHandler',
        '../../Core/buildModuleUrl',
        '../../Scene/BillboardCollection',
        '../../Scene/HorizontalOrigin',
        '../../Scene/VerticalOrigin',
        '../../Core/Ellipsoid'
        ], function(defined, defaultValue, Color, Cartesian2, Cartesian3, ScreenSpaceEventType,
                                      ScreenSpaceEventHandler, buildModuleUrl, BillboardCollection,
                                      HorizontalOrigin, VerticalOrigin, Ellipsoid) {
        'use strict';

        /**
         * @alias Uni_BillboardGroup
         * @param drawHelper
         * @param options
         * @constructor
         */
        function BillboardGroup(drawHelper, options) {
            this._drawHelper = drawHelper;
            this._scene = drawHelper._scene;
            options. shiftX = 0;
            options. shiftY = 0;
            options.iconUrl = options.iconUrl || buildModuleUrl('Widgets/Images/DrawingManager/dragIcon.png');
            this._options = options;
            //为所有的广告牌创建一个集合
            var _billboards = new BillboardCollection();
            this._drawHelper._drawPrimitives.add(_billboards);
            this._billboards = _billboards;
            this._orderedBillboards = [];
            this._primitive = this._options.primitive;
        }

        function setListener(primitive, type, callback) {
            primitive[type] = callback;
        }

        BillboardGroup.prototype.createBillboard = function(position, callbacks) {

            var billboard = this._billboards.add({
                show : true,
                position : position,
                pixelOffset : new Cartesian2(this._options.shiftX, this._options.shiftY),
                eyeOffset : new Cartesian3(0, 0, 0),
                horizontalOrigin : HorizontalOrigin.CENTER,
                verticalOrigin : VerticalOrigin.CENTER,
                scale : 1,
                image : this._options.iconUrl,
                color : new Color(1, 1, 1, 1)
            });
            billboard.owner = this._drawHelper;
            var _self = this;
            var screenSpaceCameraController = this._scene.screenSpaceCameraController;

            function enableRotation(enable) {
                screenSpaceCameraController.enableRotate = enable;
            }

            function getIndex() {
                for (var i = 0; i < _self._orderedBillboards.length; ++i) {
                    if (_self._orderedBillboards[i] === billboard) {
                        return i;
                    }
                }
            }

            if (callbacks) {
                if (callbacks.dragHandlers) {
                    var self = this;
                    setListener(billboard, 'leftDown', function(position) {

                        var handler = new ScreenSpaceEventHandler(self._scene.canvas);

                        handler.setInputAction(function(movement) {
                            //var cartesian = pickGlobe(self._scene, movement.endPosition, getAltitude(self._primitive), getAboveHeight(self._primitive));
                            var cartesian = self._scene.camera.pickEllipsoid(movement.endPosition, Ellipsoid.WGS84);
                            if (cartesian) {
                                onDrag(cartesian);
                            } else {
                                onDragEnd(cartesian);
                            }
                        }, ScreenSpaceEventType.MOUSE_MOVE);

                        handler.setInputAction(function(movement) {
                            //onDragEnd(pickGlobe(self._scene, movement.position, getAltitude(self._primitive), getAboveHeight(self._primitive)));
                            onDragEnd(self._scene.camera.pickEllipsoid(movement.position, Ellipsoid.WGS84));
                        }, ScreenSpaceEventType.LEFT_UP);

                        enableRotation(false);

                        //var p = pickGlobe(self._scene, position, getAltitude(self._primitive), getAboveHeight(self._primitive));
                        var p = self._scene.camera.pickEllipsoid(position, Ellipsoid.WGS84);

                        if (callbacks.dragHandlers.onDragStart) {
                            callbacks.dragHandlers.onDragStart(getIndex(), p);
                        }

                        function onDrag(position) {
                            billboard.position = position;
                            for (var t = 0; t < self._orderedBillboards.length; ++t) {
                                if (self._orderedBillboards[t] === billboard) {
                                    if (callbacks.dragHandlers.onDrag) {
                                        callbacks.dragHandlers.onDrag(getIndex(), position);
                                    }
                                }
                            }
                        }

                        function onDragEnd(position) {
                            handler.destroy();
                            enableRotation(true);
                            if (callbacks.dragHandlers.onDragEnd) {
                                callbacks.dragHandlers.onDragEnd(getIndex(), position);
                            }
                            self._drawHelper.dragEndEvent.raiseEvent(self._primitive);
                        }

                    });
                }

                if (callbacks.onDoubleClick) {
                    setListener(billboard, 'leftDoubleClick', function(position) {
                        callbacks.onDoubleClick(getIndex());
                    });
                }
                if (callbacks.onClick) {
                    setListener(billboard, 'leftClick', function(position) {
                        callbacks.onClick(getIndex());
                    });
                }
                if (callbacks.tooltip) {
                    setListener(billboard, 'mouseMove', function(position) {
                        _self._drawHelper._tooltip.showAt(position, callbacks.tooltip());
                    });

                    setListener(billboard, 'mouseOut', function(position) {
                        _self._drawHelper._tooltip.setVisible(false);
                    });
                }

            }
            return billboard;
        };
        BillboardGroup.prototype.insertBillboard = function(index, position, callbacks) {
            this._orderedBillboards.splice(index, 0, this.createBillboard(position, callbacks));
        };
        BillboardGroup.prototype.addBillboard = function(position, callbacks) {
            this._orderedBillboards.push(this.createBillboard(position, callbacks));
        };
        BillboardGroup.prototype.addBillboards = function(positions, callbacks) {

            for (var index = 0; index < positions.length; index++) {
                this.addBillboard(positions[index], callbacks);
            }
        };
        BillboardGroup.prototype.updateBillboardsPositions = function(positions) {

            for (var index = 0; index < positions.length; index++) {
                this.getBillboard(index).position = positions[index];
            }
        };
        BillboardGroup.prototype.countBillboards = function() {
            return this._orderedBillboards.length;
        };
        BillboardGroup.prototype.removeBillboard = function(index) {
            this._billboards.remove(this.getBillboard(index));
            this._orderedBillboards.splice(index, 1);
        };
        BillboardGroup.prototype.getBillboard = function(index) {
            return this._orderedBillboards[index];
        };
        BillboardGroup.prototype.remove = function() {
            this._billboards = this._billboards && this._billboards.removeAll() && this._billboards.destroy();
        };
        BillboardGroup.prototype.setOnTop = function() {
            this._drawHelper._drawPrimitives.raiseToTop(this._billboards);
        };
        return BillboardGroup;
    });
