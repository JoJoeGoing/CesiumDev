define([
        '../../Core/buildModuleUrl',
        '../../Core/Check',
        '../../Core/Color',
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/destroyObject',
        '../../ThirdParty/knockout',
        '../getElement',
        '../subscribeAndEvaluate',
        './InfoBoxViewModel'
    ], function(
        buildModuleUrl,
        Check,
        Color,
        defined,
        defineProperties,
        destroyObject,
        knockout,
        getElement,
        subscribeAndEvaluate,
        InfoBoxViewModel) {
    'use strict';

    /**
     * A widget for displaying information or a description.
     *
     * @alias InfoBox
     * @constructor
     *
     * @param {Element|String} container The DOM element or ID that will contain the widget.
     * @param {Scene} scene The Scene instance to use.
     * @exception {DeveloperError} Element with id "container" does not exist in the document.
     */
    function InfoBox(container, scene) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('container', container);
        //>>includeEnd('debug')

        container = getElement(container);
        this._container = container;

        var infoElement = document.createElement('div');
        infoElement.className = 'cesium-infoBox';
        infoElement.setAttribute('data-bind', '\
style: { "top" : _screenPositionY, "left" : _screenPositionX },\
css: { "cesium-infoBox-visible" : showInfo, "cesium-infoBox-bodyless" : _bodyless }');
        container.appendChild(infoElement);

        var titleElement = document.createElement('div');
        titleElement.className = 'cesium-infoBox-title';
        titleElement.setAttribute('data-bind', 'text: titleText');
        infoElement.appendChild(titleElement);

        var cameraElement = document.createElement('button');
        cameraElement.type = 'button';
        cameraElement.className = 'cesium-button cesium-infoBox-camera';
        cameraElement.setAttribute('data-bind', '\
attr: { title: "Focus camera on object" },\
click: function () { cameraClicked.raiseEvent(this); },\
enable: enableCamera,\
cesiumSvgPath: { path: cameraIconPath, width: 32, height: 32 }');
        infoElement.appendChild(cameraElement);
        this._element = infoElement;

        var closeElement = document.createElement('button');
        closeElement.type = 'button';
        closeElement.className = 'cesium-infoBox-close';
        closeElement.setAttribute('data-bind', '\
click: function () { closeClicked.raiseEvent(this); }');
        closeElement.innerHTML = '&times;';
        infoElement.appendChild(closeElement);


        var viewModel = new InfoBoxViewModel(scene, this._element, this._container);

        this._viewModel = viewModel;
        this._descriptionSubscription = undefined;

        knockout.applyBindings(this._viewModel, this._element);
        var that = this;


        var frameContent = document.createElement('div');
            frameContent.className = 'cesium-infoBox-description';

        infoElement.appendChild(frameContent);

            that._descriptionSubscription = subscribeAndEvaluate(viewModel, 'description', function(value) {
                // Set the frame to small height, force vertical scroll bar to appear, and text to wrap accordingly.
                frameContent.innerHTML = value;

                var background = null;
                var firstElementChild = frameContent.firstElementChild;
                if (firstElementChild !== null && frameContent.childNodes.length === 1) {
                    var style = window.getComputedStyle(firstElementChild);
                    if (style !== null) {
                        var backgroundColor = style['background-color'];
                        var color = Color.fromCssColorString(backgroundColor);
                        if (defined(color) && color.alpha !== 0) {
                            background = style['background-color'];
                        }
                    }
                }
                infoElement.style['background-color'] = background;

        });

    }

    defineProperties(InfoBox.prototype, {
        /**
         * Gets the parent container.
         * @memberof InfoBox.prototype
         *
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        },

        /**
         * Gets the view model.
         * @memberof InfoBox.prototype
         *
         * @type {InfoBoxViewModel}
         */
        viewModel : {
            get : function() {
                return this._viewModel;
            }
        },

        /**
         * Gets the iframe used to display the description.
         * @memberof InfoBox.prototype
         *
         * @type {HTMLIFrameElement}
         */
        frame : {
            get : function() {
                return this._frame;
            }
        }
    });

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    InfoBox.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the widget.  Should be called if permanently
     * removing the widget from layout.
     */
    InfoBox.prototype.destroy = function() {
        var container = this._container;
        knockout.cleanNode(this._element);
        container.removeChild(this._element);

        if (defined(this._descriptionSubscription)) {
            this._descriptionSubscription.dispose();
        }

        return destroyObject(this);
    };

    return InfoBox;
});
