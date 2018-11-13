// Author: Adam Robinson
// .js for generating SSID overview page (Client View)

// Function to handle new window for Geolocation map called in HTML button in results table
function geoPopUp(URL) {
    window.open(URL, '_blank', height = 400, width = 600);
}

// Function to handle new window for Geolocation of all networks map. Value from text field - triggered by OnClick Button
function InputMACBox() {
    var macSearch = document.getElementById("MACLocate").value;
        if (macSearch.length === 17)
        geoPopUp('http://0.0.0.0:5000/geolocateall/' + macSearch);
}

function InputMACBoxNoLocal() {
    var macSearch = document.getElementById("SSIDLocateNoLocal").value;
    if (macSearch.length === 17)
        geoPopUp('http://0.0.0.0:5000/geolocateallnofree/' + macSearch);
}

// Queue to wait for JSON to be returned from MongoDB at flask URL route /uniquessids
queue()
    .defer(d3.json, "/uniquessids")
    .await(plotVendor);

// Results table size = elements
var elements;
// Results table <div> identifier
var visibleSSIDTable = dc.dataTable('#dataTable');

function plotVendor(error, packetsJson) {

    var packets = packetsJson;
    var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S");

    packets.forEach(function (d) {
        // Convert ISO timestamp to D3 time format
        d["timestamp"] = dateFormat.parse(d["timestamp"]);
        d["timestamp"].setSeconds(0);

        if(d["vendor"] === "Samsung Electronics Co.Ltd" || d["vendor"] === "Samsung Electro-Mechanics(Thailand)"){
            d.vendor = 'Samsung'
        }

        if(d["vendor"] === "Sony Mobile Communications Ab" || d["vendor"] === "Sony Mobile Communications Inc"){
            d.vendor = 'Sony Mobile'
        }

        if (d["vendor"] === "Motorola (Wuhan) Mobility Technologies Communication Co. Ltd." || d["vendor"] === "Motorola Mobility Llc A Lenovo Company") {
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
        // Counter - for sum reductions added to every truple
        d.counter = 1;

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
    var vendor = crossFilter.dimension(function (d) { return d["vendor"]; });
    var macNumeric = crossFilter.dimension(function (d) { return d["mac"]; });
    var macRowChart = crossFilter.dimension(function (d) { return d["mac"]; });
    var macPieDim = crossFilter.dimension(function (d) { return d["mac"]; });
    var ssidResultsDim = crossFilter.dimension(function (d) { return d["SSID"]; });
    var ssidRowDim = crossFilter.dimension(function (d) { return d["SSID"]; });
    var allDim = crossFilter.dimension(function (d) {return d;});
    var randomisation = crossFilter.dimension(function (d) {return d.randomisation;});

    // Full Data join on crossfilter instance
    var all = crossFilter.groupAll();

    // Simple data bin groups
    var packetsByDate = isoDate.group();
    var randomisationGrp = randomisation.group();
    var vendors = vendor.group();
    var macs = macNumeric.group();
    var ssids = ssidRowDim.group();

    // DC instances of number displays for overview page
    // #name = HTML <div> reference
    var AverageMac = dc.numberDisplay("#AverageMac");
    var HighestCountForDevice = dc.numberDisplay("#maxNetVis");
    var networkCountVisible = dc.numberDisplay("#VisNetworks");
    var DeviceCount = dc.numberDisplay("#uniqueDevices");

    // DC instances of charts for overview page
    var timeFilter = dc.barChart("#timeChart");
    var connectionCountPie = dc.pieChart("#packetPies");
    var macChart = dc.rowChart("#macChart");
    var ssidChart = dc.rowChart("#ssidChart");
    var vendorSelection = dc.selectMenu('#search');
    var randomSelection = dc.selectMenu('#randomisation');

    // Mean network connections per mac reducer

    //   [{
    //     "key": "fe:37:dc:5d:50:5a",
    //     "value": 12
    //   },
    //   {
    //     "key": "tg:64:dc:4f:50:ew",
    //     "value": 3
    //   }]
    //
    //   networks = 15;
    //   devices = 2;

    var averageReducer = allDim.groupAll().reduce(
        function (p, v) {    // Add Data Entry
            ++p.networks;
            if (p[v.mac]) {
                p[v.mac]++;
            } else {
                p[v.mac] = 1;
                p.devices += v.counter;
            }
            return p;
        },
        function (p, v) {  // Filter Data Entry
            --p.networks;
            p[v.mac]--;
            if (p[v.mac] === 0) {
                delete p[v.mac];
                p.devices -= v.counter;
            }
            return p;
        },
        function () {    // Initialisation
            return {
                networks:0,
                devices:0
            };
        }
    );

    // Number Display Value accessor applies mean division on values returned from average reducer
    AverageMac
        .formatNumber(d3.format(".2n")) // Format to decimal 2 values
        .valueAccessor(function (d) {return (d.networks / d.devices) ;})
        .group(averageReducer);

    // MAC as dimension -> Grouped on Individual MACs -> return sum of counter value added in for each as extra data set value
    var SSIDtoMac = macNumeric.group().reduceSum(function (d) { return +d.counter});

    // Top value selected from group (sorted by crossfilter)
    HighestCountForDevice
        .formatNumber(d3.format("d"))
        .group(SSIDtoMac);

    // Count of all data entries
    networkCountVisible
        .formatNumber(d3.format("d"))
        .valueAccessor(function (d) { return d;})
        .group(all);

    // Reducer to return object of unique mac strings
    // [
    //     {
    //         "key": "fe:37:dc:0c:50:5a",
    //         "value": 3
    //     },
    //     {
    //         "key": "6c:71:d9:46:12:2f"
    //         "value": 5
    //     },
    //     {
    //         "key": "84:ba:3b:bd:0c:ce"
    //         "value": 5
    //     }
    // ]

    var deviceNum = macNumeric.groupAll().reduce(
        function (p, v) { // Add Data Entry
            if (p[v.mac]) {
                p[v.mac]++;
            } else {
                p[v.mac] = 1;
            }
            return p;
        },
        function (p, v) { // Filter Data Entry
            p[v.mac]--;
            if (p[v.mac] === 0) {
                delete p[v.mac];
            }
            return p;
        },
        function () {  // Initialisation
            return {};
        }
    );


    // Length of array used as value accessor of reducer to count instances of unique MACs
    DeviceCount
        .formatNumber(d3.format("d"))
        .group(deviceNum)
        .valueAccessor(
            function (d) {
                return (Object.keys(d).length);
            }
        );



    // DC barChart setup - Used timeline filter
    timeFilter
        .width(1750)
        .height(150)
        .margins({top: 15, right: 20, bottom: 20, left: 20})
        .dimension(isoDate)
        .ordinalColors(['#145C54'])
        .group(packetsByDate)
        .transitionDuration(500)
        // Upper & Lower bounds from .top() & .bottom() of ISODate dimension
        .x(d3.time.scale().domain([minDate, maxDate]))
        .elasticY(true)
        .yAxis().ticks(4);



    // DC rowChart setup
    macChart
        .width(600)
        .height(360)
        .dimension(macRowChart)
        .group(macs)
        // Order bars by group values (KV pair)
        .ordering(function (d) { return -d.value })
        .ordinalColors(['#81E6DA'])
        .elasticX(true)
        // Datafilter on macs group top 10 -> Pre sorted by crossfilter
        .data(function (group) {return group.top(10);})
        .xAxis().ticks(4);



    // DC rowChart setup
    ssidChart
        .width(600)
        .height(360)
        .dimension(ssidRowDim)
        .group(ssids)
        // Order bars by group values (KV pair)
        .ordering(function (d) { return -d.value })
        .ordinalColors(['#81E6DA'])
        .elasticX(true)
        // Datafilter on macs group top 10 -> Pre sorted by crossfilter
        .data(function (group) { return group.top(10);})
        .xAxis().ticks(4);

    // Drop down selection menu using vendor bins and grouping
    // Key = Vendor
    // Value = Data set occurrences. Each mongoDB document = 1 Network as JSON passed to page contains only unique MAC -> Network occurrences

    vendorSelection
        .dimension(vendor)
        .group(vendors)
        .title(function (d) {
            return d.key + ' --- Networks:' + ' ' + d.value;})
        .controlsUseVisibility(true);

    randomSelection
        .dimension(randomisation)
        .group(randomisationGrp)
        .title(function (d) {
            return d.key + '   ' + d.value + ' (Networks)';})
        .controlsUseVisibility(true);

    // DC DataTable Setup - SSID Results Table

    visibleSSIDTable
        .width(1200)
        .height(480)
        .dimension(ssidResultsDim)
        // Grouping pulled from data table and styled in CSS to separate data
        .group(function (d) { return d.mac.bold() + ' --- ' + d.randomisation + '  ---  ' + d.vendor;  })
        .columns([
            function (d) { return d.SSID; },
            function (d) { return d.packet; },
            function (d) { return d.timestamp; },
            // Google maps HTML button that appends data lat/lon into URL
            function (d) { return '<center><button class=\"button\"  href=\"http://maps.google.com/maps?z=12&t=m&q=loc:' + d.latitude + '+' + d.longitude + "\" target=\"_blank\"> <i class=\"fas fa-search\"></i>  Packet Location</button></center>" },
            // Generates button HTML and appends SSID to flask URL route geolocate/<identifier>. geoPopup JS function trigger to open new window on button press
            function (d) { return '<center><button class=\"button\" onclick=\"geoPopUp(\'http://0.0.0.0:5000/geolocate/' + d.SSID + '\')' + "\"><i class=\"fas fa-globe\"></i>  Geolocate SSID</button></center>" } ])
        .size(Infinity) // Overidden through pagination
        .sortBy(function(d) { return d.timestamp; })
        .order(d3.descending);


    // Two phase reduction for mac to SSID chart
    // Reduction 1
    var macNetworkCounted = macNumeric.group().reduceSum (function (d) { return d.counter; });

    //  [
    //   {
    //     "key": "f8:cf:c5:85:3e:f3",
    //     "value": 8
    //   },
    //   {
    //     "key": "f8:e0:79:cd:22:1e",
    //     "value": 3
    //   },...
    // [
    //
    // -----------------------------------

    // Reduction 2
    var macNetworkGroup = macNetworkCounted.all().reduce(function (arr, mac) {
        if (arr[mac.value]) {
        } else {
            arr[mac.value] = [];
        }
        arr[mac.value].push(mac.key);
        return arr;
    }, {});

    // [
    // {
    //     "1": [
    //     "fe:37:dc:0c:50:5a",
    //     "f8:e0:79:cd:22:1e",
    //     "6c:71:d9:46:12:2f"
    // ],
    //     "2": [
    //     "6c:ad:f8:75:ad:b0",
    //     "88:87:17:1d:36:52",
    //     "84:ba:3b:bd:0c:ce"
    // ]
    // },...
    // [
    //
    //-----------------------------------

    // Convert to Key Val pair DC group & pass through macNetworkGroup() Reduction
    function MAC_NET_KEY_VAL(countMacArrGroup) {
        var macToNetCountArr;
        return {
            all: function () {
                macNetworkGroup = countMacArrGroup.all().reduce(function (arr, mac) {
                    if (arr[mac.value]) {
                    } else {
                        arr[mac.value] = [];
                    }
                    arr[mac.value].push(mac.key);
                    return arr;
                }, {});

                macToNetCountArr = macNetworkGroup;
                return Object.keys(macNetworkGroup)
                    .map(function (key) { return {key: key, value: macNetworkGroup[key]}; });
            },
            macNetworkGroup: function () {
                return macToNetCountArr;
            }
        }
    }

    // [
    //     {
    //         "key": "1",
    //         "value": [
    //         "fe:37:dc:0c:50:5a",
    //         "f8:e0:79:cd:22:1e",
    //         "6c:71:d9:46:12:2f"
    //         ]
    //     },
    //     {
    //         "key": "2",
    //         "value": [
    //         "6c:ad:f8:75:ad:b0",
    //         "88:87:17:1d:36:52",
    //         "84:ba:3b:bd:0c:ce"
    //         ]
    //     }...
    // ]
    //
    // -----------------------------------


    // Crossfilter moves all filtered values into key 0 bin. To prevent this showing on pie chart push filtered by returning all objects where key !== 0
    // First reduction must cascade through this method to preserve filters

    function filter_remainder_bin(group) {
        return {
            all:function () {
                return group.all().filter(function(databin) {
                    return databin.key !== '0';
                });
            },
            macNetworkGroup: function() {
                return group.macNetworkGroup();
            }
        };
    }

    // DC Pie Chart Setup
    connectionCountPie
        .height(350)
        .width(550)
        .transitionDuration(1000)
        .dimension(macPieDim)
        .externalRadiusPadding(10)
        .ordinalColors(['#07453E', '#145C54', '#36847B' , '#009E90', '#00B3A6', '#00D1C0' ,'#00F6DF'])
        .group(filter_remainder_bin(MAC_NET_KEY_VAL(macNetworkCounted)))
        .valueAccessor(function (d) {
            return d.value.length;})

        .legend(dc.legend());

    // Pie chart Legend pull CSS & amend
    connectionCountPie.on('pretransition', function (pie) {
        pie.selectAll('.dc-legend-item text')
            .text('')
            .append('tspan')
            .text(function (d) {
                return d.name;
            })
            .append('tspan')
    });

    // MAC addresses from first reduction unpacked and used as filter dimension

    connectionCountPie.filterHandler(function (dimension, filter) {
        if (filter.length !== 0) {
            var macNetworkGroup = connectionCountPie.group().macNetworkGroup();
            var preservedMacsForFiltering = filter.reduce(
                function (p, v) {
                    return p.concat(macNetworkGroup[v]);
                }, []);
            dimension.filterFunction(function (k) {
                return preservedMacsForFiltering.indexOf(k) !== -1;
            });
        }
        else {
            dimension.filter(null);
        }
        return filter;
    });

    //Set size for pagination & update
    elements = crossFilter.size();
    update();

    // Render all charts
    dc.renderAll();

}
// Functions for Spotted Networks Results Table Pagination
// https://github.com/dc-js/dc.js/blob/master/web/examples/table-pagination.html

var lowerBound = 0, upperBound = 25;
function display() {
    // CONTROLS DIV ID
    d3.select('#begin')
        .text(lowerBound);
    d3.select('#size').text(elements);
    d3.select('#end')
        .text(lowerBound + upperBound - 1);
    d3.select('#last')
        .attr('disabled', lowerBound - upperBound < 0 ? 'true' : null);
    d3.select('#next')
        .attr('disabled', lowerBound + upperBound >= elements ? 'true' : null);
}
function update() {
    // Use new slices for display
    visibleSSIDTable.beginSlice(lowerBound);
    visibleSSIDTable.endSlice(lowerBound + upperBound);
    display();
}
function next() {
    // Increment Page
    lowerBound += upperBound;
    update();
    visibleSSIDTable.redraw();
}
function last() {
    // Decrement Page
    lowerBound -= upperBound;
    update();
    visibleSSIDTable.redraw();
}