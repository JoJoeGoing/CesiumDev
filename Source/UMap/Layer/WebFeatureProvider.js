define([
    '../../Core/defaultValue',
    '../../Core/defined',
    '../../Core/defineProperties',
    '../../Core/DeveloperError',
    '../../Core/freezeObject',
    '../../Core/GeographicTilingScheme',
    '../../Core/Resource'
], function(
    defaultValue,
    defined,
    defineProperties,
    DeveloperError,
    freezeObject,
    GeographicTilingScheme,
    Resource) {
    'use strict';

    function WebFeatureProvider(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        if (!defined(options.url)) {
            throw new DeveloperError('options.url is required.');
        }
        if (!defined(options.typeName)) {
            throw new DeveloperError('options.typeName is required.');
        }

        var resource = Resource.createIfNeeded(options.url);

        resource.setQueryParameters(WebFeatureProvider.DefaultParameters, true);

        if (defined(options.parameters)) {
            resource.setQueryParameters(objectToLowercase(options.parameters));
        }

        this._reload = undefined;

        var parameters = {};
        parameters.layers = options.layers;
        parameters.bbox = '{westProjected},{southProjected},{eastProjected},{northProjected}';
        parameters.width = '{width}';
        parameters.height = '{height}';

        resource.setQueryParameters(parameters, true);

        this._resource = resource;
    }

    WebFeatureProvider.DefaultParameters = freezeObject({


    });

    WebFeatureProvider.prototype.requestFeature = function() {

    };

    function objectToLowercase(obj) {
        var result = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key.toLowerCase()] = obj[key];
            }
        }
        return result;
    }
});
