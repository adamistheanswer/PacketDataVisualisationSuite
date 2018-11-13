# http://flask.pocoo.org/
from flask import Flask
from flask import render_template
from flask_caching import Cache
# JSON Handlers
import json
from bson import json_util

# Pymongo mongoDB connection library
# https://api.mongodb.com/python/current/
from pymongo import MongoClient

# Wigle Swagger API Interface
# https://pypi.org/project/pygle/
from pygle import network

app = Flask(__name__)
# Flask Local caching
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

# MongoDB Connection settings for PYMONGO
MONGO_IP = 'localhost'
MONGO_PORT = 27017

DATABASE = 'probe'
# Main data collection & geolocation collection in DB probe
COLLECTION_MAIN = 'main'
COLLECTION_GEOLOCATE = 'geo'

# collected data fields - projection used to exclude mongoDB document ID from JSON
DATA_FIELDS = {'_id': False, 'packet': True, 'timestamp': True, 'latitude': True, 'longitude': True, 'identifier': True,
               'mac': True, 'vendor': True, 'SSID': True}

connection = MongoClient(MONGO_IP, MONGO_PORT)
collectionMain = connection[DATABASE][COLLECTION_MAIN]
collectionGeo = connection[DATABASE][COLLECTION_GEOLOCATE]

@app.route('/geo/<identifier>')
# Example JSON - URL Route = 0.0.0.0:5000/geo/eduroam
# [{"latitude": 41.15621567, "longitude": 1.11557901, "SSID": "eduroam", "BSSID": "00:22:57:48:67:02"},
# {"latitude": 41.15605164, "longitude": 1.11581504, "SSID": "eduroam", "BSSID": "00:22:57:48:69:02"},
# {"latitude": 41.40758133, "longitude": 2.17919087, "SSID": "eduroam", "BSSID": "00:22:57:48:81:02"}...]
def geo_location_json(identifier):

    lats = []
    lngs = []
    ssids = []
    netids = []
    uniques = []

    # First checks geo collection based on SSID field passed from URL route and returns unique instances of BSSID
    # Cached Geolocations in collection for if wigle is down + allows to increase results for popular SSIDs as wigle returns only 100 results per request

    for i in collectionGeo.find({"SSID": identifier}):
        BSSID = i['BSSID']
        SSID = i['SSID']
        lat = i['latitude']
        lng = i['longitude']

        if BSSID in uniques:
            continue

        uniques.append(BSSID)

        lats.append(lat)
        lngs.append(lng)
        ssids.append(SSID)
        netids.append(BSSID)

    # make search request to Wigle API through pygle library
    res = network.search(ssid=identifier)

    # if results are returned from Wigle they are checked against database results and new values are appended to JSON for display and also stored in geolocation collection
    if res['success']:

        for i in res['results']:
            lat = i['trilat']
            lng = i['trilong']
            ssid = i['ssid']
            netid = i['netid']

            if netid in uniques:
                continue

            uniques.append(netid)

            lats.append(lat)
            lngs.append(lng)
            ssids.append(ssid)
            netids.append(netid)

            collectionGeo.insert_one(
                {
                    "BSSID": netid,
                    "SSID": ssid,
                    "latitude": lat,
                    "longitude": lng
                })

        outputjson = json.dumps([{'BSSID': BSSID, 'SSID': SSID, 'latitude': latitude, 'longitude': longitude} for BSSID, SSID, latitude, longitude in zip(netids, ssids, lats, lngs)])
    else:
        outputjson = json.dumps([{'BSSID': BSSID, 'SSID': SSID, 'latitude': latitude, 'longitude': longitude} for BSSID, SSID, latitude, longitude in zip(netids, ssids, lats, lngs)])

    return outputjson

# Returns Json to url route 0.0.0.0:5000/geoall/<MAC ADDRESS> for for all associated networks
@app.route('/geoall/<identifier>')
def geo_location_all_json(identifier):

    lats = []
    lngs = []
    ssids = []
    netids = []

    uniqueAP = []

    SSIDList2 = dict()

    for packet in collectionMain.find({"$and": [{"mac": identifier}, {"packet": 'PR-REQ'}]}):

        SSID = packet['SSID']

        # Filter only Visible SSIDs
        if SSID == 'Broadcast':
            continue

        # O(1) lookup for data scalability
        if SSID in SSIDList2:
          continue
        else:
            SSIDList2[SSID] = True
            print (SSID)


    for networkz in SSIDList2:
        for packet in collectionGeo.find({"SSID": networkz}):

            BSSID = packet['BSSID']
            SSID = packet['SSID']
            lat = packet['latitude']
            lng = packet['longitude']

            uniqueAP.append(BSSID)

            lats.append(lat)
            lngs.append(lng)
            ssids.append(SSID)
            netids.append(BSSID)


    for networkSSID in SSIDList2:
        res = network.search(ssid=networkSSID)
        if res['success']:

            for packet in res['results']:
                lat = packet['trilat']
                lng = packet['trilong']
                ssid = packet['ssid']
                netid = packet['netid']

                if netid in uniqueAP:
                    continue

                uniqueAP.append(netid)

                lats.append(lat)
                lngs.append(lng)
                ssids.append(ssid)
                netids.append(netid)

                collectionGeo.insert_one(
                    {
                        "BSSID": netid,
                        "SSID": ssid,
                        "latitude": lat,
                        "longitude": lng
                    })

        else: continue

    outputjson = json.dumps([{'BSSID': BSSID, 'SSID': SSID, 'latitude': latitude, 'longitude': longitude} for
                             BSSID, SSID, latitude, longitude in zip(netids, ssids, lats, lngs)])

    return outputjson

# Returns Json to url route 0.0.0.0:5000/geoall/<MAC ADDRESS> for for all associated networks excluding public networks
@app.route('/geoallnofree/<identifier>')
def geo_location_allnofree_json(identifier):

    lats = []
    lngs = []
    ssids = []
    netids = []

    uniqueAP = []
    SSIDList = []

    SSIDList2 = dict()

    for packet in collectionMain.find({"$and": [{"mac": identifier}, {"packet": 'PR-REQ'}]}):

        SSID = packet['SSID']

        # Filter only Visible SSIDs
        if SSID == 'Broadcast':
            continue

        # O(1) lookup for data scalability
        if SSID in SSIDList2:
            continue
        else:
            SSIDList2[SSID] = True
            SSIDList.append(SSID)

    for networkSSID in SSIDList:
        res = network.search(ssid=networkSSID)
        if res['success']:

            for packet in res['results']:
                lat = packet['trilat']
                lng = packet['trilong']
                ssid = packet['ssid']
                netid = packet['netid']
                freenet = packet['freenet']
                paynet = packet['paynet']

                if freenet == 'Y':
                    continue

                if paynet == 'Y':
                    continue

                if netid in uniqueAP:
                    continue

                uniqueAP.append(netid)

                lats.append(lat)
                lngs.append(lng)
                ssids.append(ssid)
                netids.append(netid)

                collectionGeo.insert_one(
                    {
                        "BSSID": netid,
                        "SSID": ssid,
                        "latitude": lat,
                        "longitude": lng,
                    })

        else:
            continue

    outputjson = json.dumps([{'BSSID': BSSID, 'SSID': SSID, 'latitude': latitude, 'longitude': longitude} for
                             BSSID, SSID, latitude, longitude in zip(netids, ssids, lats, lngs)])

    return outputjson

# Three navigation routes
# Render index.html at URL Route /
@app.route("/")
@cache.cached(timeout=5000)
def index():
    return render_template("index.html")

# Render vendor.html at URL Route /vendor
@app.route("/vendor")
@cache.cached(timeout=5000)
def vendor_analysis():
    return render_template("vendor.html")

# Render ssid.html at URL Route /ssid
@app.route("/ssid")
@cache.cached(timeout=5000)
def ssid_analysis_nl():
    return render_template("ssid.html")

# Render ssidnolocal.html at URL Route /ssidnolocal
@app.route("/ssidnolocal")
@cache.cached(timeout=5000)
def ssid_analysis():
    return render_template("ssidnolocal.html")

# Dynamic URL route for displaying geolocation map based on SSID
@app.route("/geolocate/<identifier>")
def geo_location(identifier):
    return render_template("geo.html")

@app.route("/geolocateall/<identifier>")
def geo_location_all(identifier):
    return render_template("geoall.html")

@app.route("/geolocateallnofree/<identifier>")
def geo_location_allnofree(identifier):
    return render_template("geoallnofree.html")

# Returns JSON to URL Route = /uniquessidsnolocal based on Collection Query and filter
@app.route("/uniquessidsnolocal")
@cache.cached(timeout=5000, key_prefix='UniSSIDLocal')
def get_uniquessidsnolocal():
    uniques = []
    APoints = dict()
    checkList = dict()

    # Retrieves AP Becons and stores unique instances of Network based on SSID and name (SSID useful dimention for filtering probe requests against)
    for AP in collectionMain.find({"packet": 'AP-BEC'}):

        SSID = AP['SSID']
        timestamp = AP['timestamp']
        timestampTrim = timestamp[0:14]

        # Timestamp = '10/08/2018  13'
        # Checks data entry on same day and within same hour (Local range of data collection)

        # O(1) lookup for data scalability
        if SSID in APoints:
            if timestampTrim in APoints[SSID]:
                continue
            else:
                APoints[SSID].append(timestampTrim)
        else:
            APoints[SSID] = [timestampTrim]

    for packet in collectionMain.find({"packet": 'PR-REQ'}):

        mac = packet['mac']
        SSID = packet['SSID']
        timestamp = packet['timestamp']
        timestampTrim = timestamp[0:14]

        # Filter only Visible SSIDs
        if SSID == 'Broadcast':
            continue

        if SSID in APoints:
            if timestampTrim in APoints[SSID]:
                continue

        # O(1) lookup for data scalability
        if mac in checkList:
            if SSID in checkList[mac]:
                continue
            else:
                 checkList[mac].append(SSID)
                 uniques.append(packet)
        else:
            checkList[mac] = [SSID]
            uniques.append(packet)


    outputjson = json.dumps(uniques, default=json_util.default, separators=(',', ':'))

    connection.close()

    return outputjson

# Returns JSON to URL Route = /uniquessids based on Collection Query and filter
# One instance of an SSID -> MAC Address
@app.route("/uniquessids")
@cache.cached(timeout=5000, key_prefix='UniSSID')
def get_uniqueSSID():
    uniques = []
    checkList = dict()

    for packet in collectionMain.find({"$and": [{"packet": 'PR-REQ'}, {"SSID": {"$ne": 'Broadcast'}}]}):

        ssid = packet['SSID']
        mac = packet['mac']

        # O(1) lookup for data scalability
        if mac in checkList:
            if ssid in checkList[mac]:
                continue
            else:
                 checkList[mac].append(ssid)
                 uniques.append(packet)
        else:
            checkList[mac] = [ssid]
            uniques.append(packet)

    outputjson = json.dumps(uniques, default=json_util.default, separators=(',', ':'))

    connection.close()

    return outputjson

# Returns ALL JSON to URL Route = /json based on full Collection Query
@app.route("/json")
@cache.cached(timeout=5000, key_prefix='all_data')
def get_data():

    packet_documents = []

    for packet in collectionMain.find(projection=DATA_FIELDS):
        packet_documents.append(packet)

    packet_documents_json = json.dumps(packet_documents, default=json_util.default, separators=(',', ':'))

    connection.close()

    return packet_documents_json

# Returns ALL JSON to URL Route = /vendorbub removing Unknown Vendors
@app.route("/vendorbub")
@cache.cached(timeout=5000, key_prefix='V_bub')
def vendor_bubble_chart():

    packets = collectionMain.find({"vendor": {"$ne": 'Unknown Vendor'}})

    packet_documents = []

    for packet in packets:

        packet_documents.append(packet)

    packet_documents_json = json.dumps(packet_documents, default=json_util.default, separators=(',', ':'))

    connection.close()

    return packet_documents_json

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
