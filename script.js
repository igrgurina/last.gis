/* 
redoslijed pozivanja:
    var map = new Map(viewer);

    // čekam input korisnika
    var artist = new Artist(artistName);
    map.init(artist);
*/

function Event(_title, _city, _country, _lat, _long) {
    this.title = _title;
    this.city = _city;
    this.country = _country;
    this.latitude = _lat;
    this.longitude = _long;

    this.getEventCoordinates = function () {
        return new giscloud.LonLat(this.longitude, this.latitude);
    };

    // mislim da mi ovo više ne treba, al' mi žao obrisat'
    //(a i nisam siguran da mi ne treba)
    this.getEventMarker = function () {
        return new giscloud.FlagMarker(
            this.getCoordinates().toBounds().center(),
            this.title, // title
            this.city + this.country, // content
            giscloud.Color.randomHue(70, 50)
        );
    };

    this.toString = function () {
        return "<br/>EVENT: " + this.title + " | Location: " + this.city + ", " + this.country + " (" + this.latitude + ", " + this.longitude + ")";
    };
}

function Artist(_artistName) {
    this.name = _artistName;
    this.e = []; // events

    this.getEvents = function () {
        $.getJSON("http://ws.audioscrobbler.com/2.0/?method=artist.getevents&artist="
                    + this.name + "&api_key=c7e2dc95d8a8f162ab42118cfb0f30db&format=json",
            function (data) {
                $.each(data.events.event, function (i, item) {
                    pom = new Event(item.title, item.venue.location.city, item.venue.location.country, item.venue.location["geo:point"]["geo:lat"], item.venue.location["geo:point"]["geo:long"]);
                    console.log(pom.toString());
                    e.push(pom);
                });
            }
        );
        return e;
    };
}

function Map(_viewer) {
    this.viewer = _viewer;
    this.mapId;
    this.layerId;
    this.tableName;

    //this.markers = [];
    this.init = function(_artist) {
        this.createMap();
        this.createTable();
        this.createLayer();
        
        // prvo trebaš učitat sve evente u featuree
        $.each(_artist.e || _artist.getEvents(), function(t, _event) {
            this.createFeature(_artist.name, _event);
        })
        
        // sad prikaži mapu ko čovjek
        viewer.loadMap(mapId);
    }

    this.createMap = function() {
        var mapName, mapDef;

        mapName = "lastgis";
        //if(!mapName) return;

        // this is a map definition object for a map
        // in the popular (Web) Mercator projection
        mapDef = {
            name: mapName,
            units: "meter";
            proj4: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs"
        };

        // create map
        giscloud.maps.create(mapDef)
        .fail(function() {
            console.error("Create map failed");
        })
        .done(function (newMapId) {
            // save the newly created map id
            mapId = newMapId;
            console.log("Map " + mapName + " with mapID: " + mapId + " created");
        });
    };

    this.createTable = function() {
        var tableDef;

        tableName = "eventsData";
        //if(!tableName) return;

        // convert name to alphanumerics, max length 50
        tableName = tableName.toLowerCase().replace(/(^[^a-z]+)|(\W+)/g, '_').substr(0, 50);
        // add timestamp to help prevent overlaps with existing tables
        tableName += $.now();

        // create table definition
        tableDef = {
            name: tableName,
            geometry: "point", // can also be "line", "polygon" etc.
            srid: 4326, // gps coordinates (WGS84) - nemam pojma šta je ovo, nadam se da radi
            columns: {
                "artist" : { "type" : "text" },
                "eventName" : { "type" : "text" },
                "eventCity" : { "type" : "text" },
                "eventCountry" : { "type" : "text" }
            }
        }

        // create table
        giscloud.tables.create(tableDef)
        .fail(function () {
            console.error("Create table failed");
        })
        .done(function () {
            console.log("Table " + tableName + " created");
        });
    };


    this.createLayer = function () {
        var layerName, layerDef;

        layerName = "eventsLayer";
        //if(!layerName) return;

        // first add the basemap layer
        layerDef = {
            map_id: mapId, // use the saved map id here
            name: "MapQuest OSM",
            source: {
                "type": "tile",
                "src": "mapquest_osm"
            },
            type: "tile",
            x_min: "-20037508.3427892", x_max: "20037508.3427892",
            y_min: "-20037508.3427892", y_max: "20037508.3427892",
            visible: true
        };

        // create basemap layer
        (new giscloud.Layer(layerDef)).update()
        .fail(function () {
            console.error("Create basemap layer failed");
        })
        .done(function () {
            // now add the feature layer
            layerDef.name = layerName;
            layerDef.type = "point";
            layerDef.styles = [{
                "symbol" : {
                    "type": "circle",
                    "color": "250,241,65",
                    "border": "43,104,217",
                    "bw": "2",
                    "size": "14"
                }
            }];
            layerDef.source = {
                "type": "pg", // postgis table is the source
                "src" : tableName
            };
            (new giscloud.Layer(layerDef)).update()
            .fail(function () {
                console.error("Create feature layer failed");
            })
            .done(function (newLayerId) {
                // save the layer id
                layerId = newLayerId;
                //console.log()
            });
        })
    }

    this.createFeature = function(_artistName, _event) { // umjesto (_lon, _lat, _artistName, _title, _city, _country)
        var featureDef, lonLat = _event.getEventCoordinates();

        // check values
        if(!lonLat.valid()) return;

        // prepare feature definition
        featureDef = {
            geometry: new giscloud.geometry.Point(lonLat.lon, lonLat.lat).toOGC(),
            data: {
                "artist" : _artistName,
                "eventName" : _event.title,
                "eventCity" : _event.city,
                "eventCountry" : _event.country
            }
        }

        // create a new feature
        giscloud.features.create(layerId, featureDef)
        .fail(function () {
            console.error("Create feature failed");
        })
        .done(function () {
            console.log(_event.toString() + " converted to feature");
            // viewer.loadMap(mapId);
        })
    }

    // ovo tu mi osto više ne treba (valjda)
    this.createMarkersFromEvents = function (_events) {
        $.each(_events, function (i, event) {
            this.markers.push(event.getEventMarker());
            event.toString();
        });
        return this.markers;
    };

    // također - budem pobrisao kasnije
    this.addMarkersToMap = function (_markers) {
        $.each(_markers, function (i, marker) {
            marker.visible(true);
            this.viewer.addMarker(marker);
        });
    };
}

