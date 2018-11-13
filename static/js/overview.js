// Author: Adam Robinson
// .js for generating data graphs on overview page (Client View)

// Queue to wait for JSON to be returned from MongoDB at flask URL route /json
queue()
    .defer(d3.json, "/json")
    .await(plotData);

function plotData(error, packetsJson) {

    var packets = packetsJson;
    var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S");

    packets.forEach(function (d) {
        // Convert ISO timestamp to D3 time format
        d["timestamp"] = dateFormat.parse(d["timestamp"]);
      //  d["timestamp"].setSeconds(0);

        if(d["packet"] === "AP-RES"){
            d.packet = 'PR-RES'
        }

        // Combine duplicate manufacturer occurrences from OUI lookup
        if(d["vendor"] === "Samsung Electronics Co.Ltd" || d["vendor"] === "Samsung Electro-Mechanics(Thailand)"){
            d.vendor = 'Samsung'
        }

        if(d["vendor"] === "Sony Mobile Communications Ab" || d["vendor"] === "Sony Mobile Communications Inc"){
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
        // Direction - based on null SSID - directed & undirected used for sum reductions in number displays

        d.counter = 1;

        if(d["packet"] === "PR-REQ" && d["SSID"] === "Broadcast" || d["SSID"] === "Hidden SSID") {
          d.direction = "Directed";
          d.undirected = 0;
          d.directed = 1;
          } else {
          d.direction = "Undirected";
          d.undirected = 1;
          d.directed = 0;
          }
          // Change BSSID from data to Access Point for user readability
          // Access point for sum reductions in number display
        if(d["identifier"] === "BSSID") {
            d.devices = 0;
            d.identifier = "Access Point"
            } else {
            d.devices = 1;
            d.identifier = "Client"
            }

        //Determine if a genuine MAC or Locally assigned MAC

        var firstOctet = d["mac"].substring(0, 2);
        var binary = parseInt(firstOctet.toString(), 16).toString(2);
        var binaryWithLeadingZeros = "00000000".substr(binary.length) + binary;

        d.BroadcastUnicastBit = binaryWithLeadingZeros.substring(6, 7);
        d.localGlobalBIAbit = binaryWithLeadingZeros.substring(7, 8);

        d.bin = binaryWithLeadingZeros;

        if (binaryWithLeadingZeros.substring(6, 7) === '0') {
            d.randomisation = 'Globally Unique (OUI Enforced)'
        }else {
            d.randomisation = 'Locally Administered'
        }

        if (binaryWithLeadingZeros.substring(7, 8) === '0'){
            d.casting = 'Unicast'
        } else {
            d.casting = 'Broadcast'
        }
    });

    // Crossfilter instance to maintain synchronicity of dimensions through filtering
    var crossFilter = crossfilter(packets);

    // Date scale setup - read all instances of date from JSON data then store as dimension isoDate
    // top and bottom array of isoDate becomes date range
    var isoDate = crossFilter.dimension(function (d) {return d["timestamp"];});
    var minDate = isoDate.bottom(1)[0]["timestamp"];
    var maxDate = isoDate.top(1)[0]["timestamp"];

    // Produce dimensions to be used as data bins based on input JSON data
    var packet = crossFilter.dimension(function (d) { return d["packet"];});
    var ssid = crossFilter.dimension(function (d) { return d["SSID"];});
    var vendor = crossFilter.dimension(function (d) { return d["vendor"]; });
    var identifier = crossFilter.dimension(function (d) { return d["identifier"]; });
    var mac = crossFilter.dimension(function (d) { return d["mac"]; });

    // Produce dimensions to be used as data bins from additional fields added in for each that don't exist in collected data set
    var macRandom = crossFilter.dimension(function (d) { return d.randomisation; });
    var broadcast = crossFilter.dimension(function (d) { return d.direction; });
    var allDim = crossFilter.dimension(function (d) { return d; });
    var unproDimension = crossFilter.dimension(function (d) { return d.undirected; });
    var proDimension = crossFilter.dimension(function (d) { return d.directed; });

    // Group all fields based on dimension variables, Produces data bin based on dimensions.
    // Reduce sum produces KV pair, ie [Key] Access Point [Value] n
    // n = the sum of truples reduction field ie +d.counter

    var undirectedGroup = unproDimension.group().reduceSum(function(d) { return +d.undirected });
    var directedGroup = proDimension.group().reduceSum(function(d) { return +d.directed });
    var broadcastCount = broadcast.group().reduceSum(function (d) { return d.counter;  });

    // Simple data bin groups
    var macRandomGrp = macRandom.group();
    var packetsByDate = isoDate.group();
    var packetsGRP = packet.group();
    var vendors = vendor.group();
    var identifiers = identifier.group();

    // Full Data join on crossfilter instance
    var all = crossFilter.groupAll();

    // DC instances of number displays for overview page
    // #name = HTML <div> reference
    var percentageVun = dc.numberDisplay("#percentageVun");
    var packetsSniffed = dc.numberDisplay("#packetsSniffed");
    var uniqueSSIDS = dc.numberDisplay("#uniqueSSIDS");
    var uniqueDevices = dc.numberDisplay("#uniqueDevices");
    var uniqueVendors = dc.numberDisplay("#uniqueVendors");

    var undirectedPackets = dc.numberDisplay("#unprotectedPackets");
    var directedPackets = dc.numberDisplay("#protectedPackets");
    var accesPointNum = dc.numberDisplay("#accesPointNum");

    // DC instances of charts for overview page
    var timeChart = dc.barChart("#timeChart");
    var packetPie = dc.pieChart("#packetPie");
    var identifierPie = dc.pieChart("#identifierPie");
    var vendorSelectionDD = dc.selectMenu('#search');
    var randomSelectionDD = dc.selectMenu('#randomisation');
    var vendorCommon = dc.rowChart("#vendorCommon");

    // Array of charts to pass to underscore for rendering Leaflet map when new filters have been triggered in GUI
    var overviewCharts = [timeChart, packetPie, identifierPie, vendorSelectionDD, randomSelectionDD, vendorCommon];

    // Leaflet Map Instance
    var map = L.map('map');

    // Number displays - format decimal use highest value from group
    // no conversion needed as using additional counter fields added to data set in for each
    directedPackets
        .formatNumber(d3.format("d"))
        .group(directedGroup);

    undirectedPackets
        .formatNumber(d3.format("d"))
        .group(undirectedGroup);


    // Single Reducer to handle AP & Device Segmentation & Aggregation
    var MACReductions = mac.groupAll().reduce(
        function (p, v) {   // Add Data Entry
            // If not AP
            if (v.identifier !== 'Access Point') {
                if (p.device[v.mac]) {
                    p.device[v.mac]++;
                } else {
                    p.device[v.mac] = 1;
                }
            // If A-Point
            } else {
                if (p.AP[v.mac]) {
                    p.AP[v.mac]++;
                } else {
                    p.AP[v.mac] = 1;
                }
            }
            return p;
        },
        function (p, v) {  // Filter Data Entry

            if (v.identifier !== 'Access Point') {
                p.device[v.mac]--;
                if (p.device[v.mac] === 0) {
                    delete p.device[v.mac];
                }
            }
            else{
                p.AP[v.mac]--;
                if (p.AP[v.mac] === 0) {
                    delete p.AP[v.mac];
                }
            }
            return p;
        },
        function () {
            return {
                device: {},
                AP: {},
            };
        }
    );

    // Reducer to return object of unique SSID strings
    // [    Device: {
    //                {
    //                   "key": "fe:37:dc:0c:50:5a"
    //                   "value": "13",
    //                },
    //                {
    //                   "key": "fe:21:dc:0c:50:5a",
    //                   "value": "23"
    //                },
    //                {
    //                   "key": "fe:17:dc:0c:50:5a",
    //                   "value": "21"
    //                }...
    //                   }
    //         AP: {
    //                {
    //                   "key": "qw:37:dc:0c:50:5a"
    //                   "value": "15",
    //                },
    //                {
    //                   "key": "r2:21:dc:0c:50:5a",
    //                   "value": "2"
    //                },
    //                {
    //                   "key": "42:17:dc:0c:50:5a",
    //                   "value": "9"
    //                }...
    //                   }
    // ]

    // Length of separated arrays used as value accessor of MACreducer to count instances of unique macs
    accesPointNum
        .formatNumber(d3.format("d"))
        .group(MACReductions)
        .valueAccessor(
            function (d) { return Object.keys(d.AP).length; }
        );

    uniqueDevices
        .formatNumber(d3.format("d"))
        .group(MACReductions)
        .valueAccessor(
            function (d) { return Object.keys(d.device).length; }
        );

    // Return values in group matching data field key
    // ie datafield = 'undirected' networks from sourceGroup = directCount
    // returns KV pair of undirected -> 1 '1 = Fake Field added in for each'
    // 1 can be used in reduce sum to gain count of undirected probes that can be synchronised through crossfilter

    function select_data_bin(sourceGroup, dataField) {
        return {
            value: function() {
                return sourceGroup.all().filter(function (kv) {
                    return kv.key === dataField;
                })[0].value;
            }
        }
    }

    var allCount = broadcast.groupAll().reduceSum(function (d) { return d.counter;  });

    var filteredUndirected = select_data_bin(broadcastCount, 'Undirected');

    // allCount Value can be taken as value for number display as reduce sum gives total
    percentageVun
        .group(filteredUndirected)
        .formatNumber(d3.format("%"))
        .valueAccessor(function (x) {
            return x / allCount.value();
        });

    // Reducer to return object of unique SSID strings
    // [
    //     {
    //         "value": "eduroam"
    //         "key": "13",
    //     },
    //     {
    //         "key": "freeWifi",
    //         "value": "23"
    //     },
    //     {
    //         "key": "Starbucks",
    //         "value": "21"
    //     }
    // ]

    var ssidNum = ssid.groupAll().reduce(
        function (p, v) {  // Add Data Entry
            if(p[v.SSID]) {
                p[v.SSID]++;
            } else {
                p[v.SSID] = 1;
            }
            return p;
        },
        function (p, v) { // Filter Data Entry
            p[v.SSID]--;
            if(p[v.SSID] === 0) {
                delete p[v.SSID];
            }
            return p;
        },
        function () {  // Initialisation
            return {};
        }
    );

    // Length of array used as value accessor of reducer to count instances of unique SSIDs
    uniqueSSIDS
    .formatNumber(d3.format("d"))
    .group(ssidNum)
    .valueAccessor(
      function (d) {
          return Object.keys(d).length; }
    );

    // Reducer to return object of unique vendor strings
    // [
    //     {
    //         "key": "Apple",
    //         "value": "12"
    //     },
    //     {
    //         "key": "Google",
    //         "value": "23"
    //     },
    //     {
    //         "key": "Motorola",
    //         "value": "21"
    //     }
    // ]

    var vendorNum = vendor.groupAll().reduce(
        function (p, v) {   // Add Data Entry
            if(p[v.vendor]) {
                p[v.vendor]++;
            } else {
                p[v.vendor] = 1;
            }
            return p;
        },
        function (p, v) {  // Filter Data Entry
            p[v.vendor]--;
            if(p[v.vendor] === 0) {
                delete p[v.vendor];
            }
            return p;
        },
        function () {    // Initialisation
            return {};
        }
    );

    // Length of array used as value accessor of reducer to count instances of unique vendors
    uniqueVendors
        .formatNumber(d3.format("d"))
        .group(vendorNum)
        .valueAccessor(
          function (d) { return Object.keys(d).length; }
        );

    // return a total count of data entries from JSON source using total aggregation group of crossfilter
    packetsSniffed
        .formatNumber(d3.format("d"))
        .valueAccessor(function (d) {
            return d;
        })
        .group(all);

    // Drop down selection menu using vendor bins and grouping
    // Key = Vendor
    // Value = Data set occurrences. Each mongoDB document = 1 packet

    vendorSelectionDD
        .dimension(vendor)
        .group(vendors)
        .title(function (d){
            return d.key + '   ' + d.value + ' (Packets)';})
        .controlsUseVisibility(true);


    randomSelectionDD
        .dimension(macRandom)
        .group(macRandomGrp)
        .title(function (d){
            return d.key + '   ' + d.value + ' (Packets)';})
        .controlsUseVisibility(true);

    // DC Piechart setup
    packetPie
        .height(495)
        .width(350)
        .radius(180)
        .renderLabel(true)
        .transitionDuration(1000)
        .dimension(packet)
        .ordinalColors(['#07453E', '#145C54', '#36847B'])
        // Calculate percentage of field based on pie area then append to 'text.pie-slice' CSS
        .on('renderlet', function (chart) {
            chart.selectAll('text.pie-slice').text( function(d) {
                return d.data.key + ' ' + dc.utils.printSingleValue((d.endAngle - d.startAngle) / (2*Math.PI) * 100) + '%';}) })
        .group(packetsGRP);

    // DC Piechart setup
    identifierPie
        .height(495)
        .width(350)
        .radius(180)
        .renderLabel(true)
        .transitionDuration(1000)
        .ordinalColors([ '#145C54', '#36847B'])
        .dimension(identifier)
        // Calculate percentage of field based on pie area then append to 'text.pie-slice' CSS
        .on('renderlet', function (chart) {
            chart.selectAll('text.pie-slice').text( function(d) {
                return d.data.key + ' ' + dc.utils.printSingleValue((d.endAngle - d.startAngle) / (2*Math.PI) * 100) + '%'; }) })
        .group(identifiers);

    // DC barChart setup - Used timeline filter
    timeChart
        .width(1750)
        .height(150)
        .margins({top: 15, right: 25, bottom: 20, left: 25})
        .dimension(isoDate)
        .ordinalColors([ '#145C54'])
        .group(packetsByDate)
        .transitionDuration(500)
        // Upper & Lower bounds from .top() & .bottom() of ISODate dimension
        .x(d3.time.scale().domain([minDate, maxDate]))
        .elasticX(true)
        .elasticY(true)
        .yAxis().ticks(4);


    var vendorComDim = crossFilter.dimension(function (d) {return d.vendor;});


    // Reducer to return counts of unique devices for each manufacturer
    // [
    //    Device:  {
    //         "key": "fe:37:dc:5d:50:5a",
    //         "value": "12"
    //     },
    //     {
    //         "key": "rf:25:7k:0c:e4:5a",
    //         "value": "23"
    //     },
    //     {
    //         "key": "yg:26:63:0c:54:gf",
    //         "value": "21"
    //     }
    // ]
    //   Count = 3;
    //
    // Device array used for value storage for visualisation synchronising when filtering
    // Count returns value for assessing X-Axis length of row chart


    var test = vendorComDim.group().reduce(
        function (p, v) {   // Add Data Entry
            // If not AP
            if(v.identifier === "Client") {
                if (v.vendor !== "Unknown Vendor") {
                    if (p.device[v.mac]) {
                        p.device[v.mac]++;
                    } else {
                        p.device[v.mac] = 1;
                        ++p.count;
                    }
                }}
            return p;
        },
        function (p, v) {  // Filter Data Entry
            if(v.identifier === "Client") {
                if (v.vendor !== "Unknown Vendor") {
                    p.device[v.mac]--;
                    if (p.device[v.mac] === 0) {
                        delete p.device[v.mac];
                        --p.count;
                    }
                }
            }
            return p;
        },
        function () {
            return {
                device: {},
                count:0
            };
        }
    );

    // Most common vendor rowchart setup

    vendorCommon
        .width(1800)
        .height(310)
        .dimension(vendorComDim)
        .cap(15)
        .group(test)
        .othersGrouper(false)
        .ordering(function (d) { return -d.value.count })
        .ordinalColors([ '#79c5bd'])
        .elasticX(true)
        // .xAxis().ticks(4)
        .valueAccessor(function (d) {
            return  d.value.count;
        });

    // Leaflet map render
    var drawMap = function () {

        // Initial view lat/lon & zoom = 13 - Resets view here on filter
        map.setView([52.46, -1.898], 13);

        // Stamen Toner Light Tile Server
        // https://leaflet-extras.github.io/leaflet-providers/preview/#filter=Stamen.TonerLite

        L.tileLayer(
            'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png', {
                attribution: '<a href="http://stamen.com">Tile Server</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>',
                 maxZoom: 20
            }).addTo(map);

        //  Underscore library to efficiently acquire array of ([lat, lon],[lat, lon]..) from every dimension crossfilter
        //  Geodata used to generate SVG for for heatmap
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

    // Render map initial
    drawMap();

    // Underscore library to cycle overviewCharts array for applied filters - used to redraw heatmap.
    _.each(overviewCharts, function (allChartsUpdated) {
        allChartsUpdated.on("filtered", function () {
            map.eachLayer(function (layer) { map.removeLayer(layer) });
            // Render heat map of filter
            drawMap();
        });
    });


    // Render all DC charts
    dc.renderAll();
}
