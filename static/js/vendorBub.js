// Author: Adam Robinson
// .js for generating vendor bubble chart on vendor overview page

// Queue to wait for JSON to be returned from MongoDB at flask URL route /vendorbub

queue()
    .defer(d3.json, "/vendorbub")
    .await(plotVendor);

function plotVendor(error, packetsJson) {

    var packets = packetsJson;

    packets.forEach(function (d) {

        // Combine duplicate manufacturer occurrences from OUI lookup
        if (d["vendor"] === "Samsung Electronics Co.Ltd" || d["vendor"] === "Samsung Electro-Mechanics(Thailand)") {
            d.vendor = 'Samsung'
        }

        if (d["vendor"] === "Sony Mobile Communications Ab" || d["vendor"] === "Sony Mobile Communications Inc") {
            d.vendor = 'Sony Mobile'
        }

        if (d["vendor"] === "Motorola (Wuhan) Mobility Technologies Communication Co. Ltd." || d["vendor"] === "Lenovo Mobile Communication Technology Ltd." || d["vendor"] === "Motorola Mobility Llc A Lenovo Company") {
            d.vendor = 'Motorola'
        }

        if (d["vendor"] === "Huawei Technologies Co.Ltd") {
            d.vendor = 'Huawei'
        }

        if (d["vendor"] === "Murata Manufacturing Co. Ltd." || d["vendor"] === "Nokia Corporation") {
            d.vendor = 'Nokia'
        }

        if (d["vendor"] === "Microsoft Corporation" || d["vendor"] === "Microsoft Mobile Oy") {
            d.vendor = 'Microsoft'
        }

        if (d["vendor"] === "Oneplus Tech (Shenzhen) Ltd" || d["vendor"] === "Oneplus Technology (Shenzhen) Co. Ltd") {
            d.vendor = 'OnePlus'
        }

        // Additional fields added to dataset:
        // Counter - for sum reductions
        // Protection - based on hidden SSID - directed & undirected used in reducer
        d.counter = 1;

        if (d["SSID"] !== "Broadcast") {
            d.direction = "Directed";
            d.undirected = 0;
            d.directed = 1;
        } else {
            d.direction = "Undirected";
            d.undirected = 1;
            d.directed = 0;
        }
    });

    // Crossfilter instance to maintain synchronicity of dimensions through filtering
    var crossFilter = crossfilter(packets);

    // Produce dimensions to be used as data bins based on input JSON data
    var vendorBubbleChartDim = crossFilter.dimension(function (d) { return d.vendor; });
    var vendorFilDim = crossFilter.dimension(function (d) { return d.vendor; });

    // Simple data bin group
    var vendorFilGroup = vendorFilDim.group();

    // DC instance of chart & selection menu for vendor analysis page
    var vendorBubble = dc.bubbleChart("#vendorBubble");
    var selectionFilter = dc.selectMenu('#selectionFilter');

    // Vendor Bubble Chart Reducer
    var vendorBubbleChartGroup = vendorBubbleChartDim.group().reduce(
        function (p, v) {
            ++p.count;
            p.undirectedCount += +v.undirected;
            p.directedCount += +v.directed;
            return p;
        },

        function (p, v) {
            --p.count;
            p.undirectedCount -= +v.undirected;
            p.directedCount -= +v.directed;
            return p;
        },

        function () {
            return {
                count: 0,
                undirectedCount: 0,
                directedCount: 0
            };
        }
    );

    // [
    //     {
    //         "key": "Apple",
    //         "value": {
    //            "count" : 12,
    //            "undirectedCount" : 11,
    //            "directedCount" : 11
    //         }
    //     },
    //     {
    //        "key": "Google",
    //        "value": {
    //           "count" : 4,
    //           "undirectedCount" : 22,
    //           "directedCount" : 21
    //     }
    //     },
    //     ...


    // DC Bubble Chart Setup
    vendorBubble
        .width(1200)
        .height(500)
        .xAxisLabel('Undirected Probe Requests [Broadcast]')
        .yAxisLabel('Directed Probe Requests')
        .transitionDuration(1500)
        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)
        .margins({top: 25, right: 60, bottom: 50, left: 60})
        .dimension(vendorBubbleChartDim)
        .group(vendorBubbleChartGroup)
        // X Axis Value
        .keyAccessor(function (p) {
            return p.value.directedCount;
        })
        // Y Axis Value
        .valueAccessor(function (p) {
            return p.value.undirectedCount;
        })
        // Bubble Size Value
        .radiusValueAccessor(function (d) {
            return (d.value.count / 75);
        })
        .maxBubbleRelativeSize(0.2)
        .elasticX(true)
        .elasticY(true)
        .renderLabel(true)
        // Ensures smaller vendor bubbles shown at front
        .data(function (group) {
            var data = group.all().slice(0);
            var vendorBubbleSize = vendorBubble.radiusValueAccessor();
            data.sort(function (a, b) {
                return d3.descending(vendorBubbleSize(a), vendorBubbleSize(b));
            });
            return data;
        })
        .x(d3.scale.linear())
        .y(d3.scale.linear())
        .r(d3.scale.linear().domain([0, 1000]))
        // Show full bubble don't clip to edges CSS Tweak
        .on('renderlet', function (bubble) {
            bubble.svg().select(".chart-body").attr("clip-path", null);
        })
        .xAxisPadding(50)
        .xAxisMin = function () {
        return 0;
    }
        .yAxisPadding = function () {
        return 500;
    }
        .yAxisMin = function () {
        return 0;
    };


    // Drop down selection menu using vendor bins and grouping
    // Key = Vendor
    // Value = Data set occurrences. Each mongoDB document = 1 packet

    selectionFilter
        .dimension(vendorFilDim)
        .group(vendorFilGroup)
        .multiple(true)
        .numberVisible(10)
        .title(function (d) {
            return d.key + ' --- Packets Collected:' + ' ' + d.value;
        })
        .controlsUseVisibility(true);

    dc.renderAll();
}