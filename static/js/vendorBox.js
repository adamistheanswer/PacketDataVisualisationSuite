// Author: Adam Robinson
// .js for generating common vendors Box Plot

// Queue to wait for JSON to be returned from MongoDB at flask URL route /uniquessids
// Unique ssids = one occurrence of ssid in data against mac

queue()
    .defer(d3.json, "/uniquessids")
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
        // Counter - for reductions
        d.counter = 1;
    });

    var crossFilter = crossfilter(packets);

    var vendorBoxPlotDim = crossFilter.dimension(function (d) { return d["vendor"]; });

    // Two phase reduction for mac to network count box chart

    // Reduction 1
    var vendorMacCountsGroup = vendorBoxPlotDim.group().reduce(
        function (p, v) {
            p[v.mac] = (p[v.mac] || 0) + v.counter;
            return p;
        },
        function (p, v) {
            p[v.mac] -= v.counter;
            return p;
        },
        function () {
            return {};
        }
    );

    // [
    //     {
    //         "key": "Apple",
    //         "value": {
    //            "fe:37:dc:0c:50:5a" : 12,
    //            "f8:e0:79:cd:22:1e" : 11
    //         }
    //     },
    //     {
    //        "key": "Google",
    //         "value": {
    //          "6c:ad:f8:75:ad:b0" : 4,
    //          "88:87:17:1d:36:52" : 4,
    //          "84:ba:3b:bd:0c:ce" : 2
    //         }
    //     },
    //     ...


    // Reduction 2
    function strip_MAC_Value(group) {
        return {
            all() {
                return group.all().map(function (group) {
                    return {
                        key: group.key,
                        // Finds non string values > 0 removing MAC from group returns array
                        value: Object.values(group.value).filter(function (value) {
                            return value > 0;
                        })
                    };
                });
            }
        };
    }

    // [
    //     {
    //         "key": "Apple",
    //         "value": [12, 11]
    //     },
    //     {
    //         "key": "Google",
    //         "value": [4, 4 ,2]
    //     },
    //     ...
    // ]


    function top_vendor(group) {
        return {
            all() {
                // Returns top 10 sliced from sorted array.
                // Vendors based on the length of the value array in group. 1 arr position = 1 device
                return group.all().sort(function (a, b) {
                    return b.value.length - a.value.length;
                }).slice(0, 10);
            }
        };
    }

    // Reduced group to be passed to boxplot. Value array elements used for plot
    var boxPlotGroup = top_vendor(strip_MAC_Value(vendorMacCountsGroup));

    // DC BoxPlot setup
    var boxPlot = dc.boxPlot("#boxPlot");
    boxPlot
        .width(1200)
        .height(600)
        .dimension(vendorBoxPlotDim)
        .group(boxPlotGroup)
        .tickFormat(d3.format('.1f'))
        .elasticY(true)
        .elasticX(true);

    // Drop down selection menu using vendor bins and grouping
    // Key = Vendor
    // Value = Data set occurrences. Each mongoDB document = 1 Network

    var vendorFilDim = crossFilter.dimension(function (d) { return d.vendor; });
    var vendorFilGroup = vendorFilDim.group();

    // DC SelectMenu setup
    var boxPlotSelectionFilter = dc.selectMenu('#boxPlotSelectionFilter');

    boxPlotSelectionFilter
        .dimension(vendorFilDim)
        .group(vendorFilGroup)
        .multiple(true)
        .numberVisible(10)
        .title(function (d) {
            return d.key + ' --- Networks Found:' + ' ' + d.value;
        })
        .controlsUseVisibility(true);

    dc.renderAll();

}
