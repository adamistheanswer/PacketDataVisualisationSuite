// Author: Adam Robinson
// .js for generating SSID geo location map - accessed on SSID analysis page data table (Client View)

// Queue to wait for JSON to be returned from MongoDB

// Using flask URL routing @app.route("/geolocate/<identifier>") to render map full page at any URL ...geolocate/'SSID'
// template geo.html

// Button in results table on SSID overview page generates URL with SSID appended

// URL then stripped below and passed to queue to run flask URL routing at @app.route('/geo/<identifier>')
// Python code at URL route requests JSON results based on SSID in question from Wigle API & MongoDB of stored results

var url = window.location.pathname;

var array = url.split('/');

var lastsegment = array[array.length - 1];

queue()
    .defer(d3.json, "/geoallnofree/" + lastsegment)
    .await(plotData);

function plotData(error, packetsJson) {

    // Geolocation map uses same setup as overview page although uses requested data from Wigle and mongo based on all SSIDs for a device excluding free and paid networks

    var packets = packetsJson;

    var crossFilter = crossfilter(packets);

    var allDim = crossFilter.dimension(function (d) { return d; });

    var map = L.map('map');

    var drawMap = function () {

        map.setView([20, 0], 2);

        // Stamen Toner Light Tile Server
        // https://leaflet-extras.github.io/leaflet-providers/preview/#filter=Stamen.TonerLite

        L.tileLayer(
            'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png', {
                attribution: '<a href="http://stamen.com">Tile Server</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>',
                maxZoom: 20
            }).addTo(map);

        var geoData = [];
        _.each(allDim.top(Infinity), function (d) {
            geoData.push([d["latitude"], d["longitude"], 1]);
        });
        L.heatLayer(geoData, {
            radius: 10,
            blur: 20,
            maxZoom: 1
        }).addTo(map);

    };

    drawMap();

    dc.renderAll();

}
