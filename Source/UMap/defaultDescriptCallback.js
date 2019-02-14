define(function(){
    function defaultDescriptCallback(options) {
        var html = '';
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                var n = options[option];
                html += 'object' === typeof n ? '<tr><th>' + option + '</th><td>' + defaultDescriptCallback(n) + '</td></tr>' : '<tr><th>' + option + '</th><td>' + n + '</td></tr>';
            }
        }
        if (html.length > 0) {
            html = '<table class="cesium-infoBox-defaultTable"><tbody>' + html + '</tbody></table>';
        }
        return html;
    }
    return defaultDescriptCallback;
});